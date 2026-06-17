# Agente analista para clientes finales

Servidor web que expone un agente (Claude Agent SDK) sobre una base Postgres (Supabase). El agente responde en lenguaje natural y traduce las preguntas a consultas de solo lectura, devolviendo el resultado ya analizado.

> Nota de aislamiento: `CLAUDE.md` se carga al contexto del agente en runtime. Por eso toda la documentación de arquitectura, entornos y multi-tenant vive acá (en `README.md`), que NO se carga al contexto. No muevas estos detalles a `CLAUDE.md`.

## Commands

```bash
npm start          # Levanta el server con tsx (sin compilar)
npm run build      # Compila TypeScript a ./dist/
npx tsx --test *.test.ts   # Tests
```

## Environment Setup

Copiá `.env` y completá las variables antes de correr:

```
ANTHROPIC_API_KEY=...
DATABASE_URL_IACA=...
DATABASE_URL_NANNI=...
```

## Arquitectura

Aplicación de dos partes: `server.ts` (backend) + `public/` (frontend).

### Backend (`server.ts`)

1. **Aislamiento por tenant** — Tenants en whitelist:
   - `iaca` → `DATABASE_URL_IACA`
   - `nanni` → `DATABASE_URL_NANNI`

   Cada request a `/api/chat` debe incluir `tenant`. El server lo valida contra la whitelist y rechaza valores desconocidos con `400`. Cada tenant se conecta a su propia URL de base (rol distinto → esquema distinto).

2. **Claude Agent SDK** — `query({ prompt, options })` con streaming. `options` se arma por request con `buildOptions(dbUrl)`.

3. **Postgres MCP server** — transport **stdio** con `@modelcontextprotocol/server-postgres`; un proceso node por request con la URL del tenant.

4. **Sessions (oficial)** — contexto multi-turno con el mecanismo nativo del SDK. El cliente guarda un `sessionId`; `/api/chat` lo recibe y pasa `resume: sessionId`. El server captura `session_id` de los mensajes y lo manda por SSE (`{ type: "session", sessionId }`). `selectTenant`, `switchUser` y "new chat" resetean el `sessionId` para que las conversaciones nunca crucen tenants. Transcripts en `~/.claude/projects/<encoded-cwd>/*.jsonl`. No hay historial casero ni `/api/history`.

5. **Skills (conocimiento de dominio)** — skills de filesystem en `.claude/skills/` (`facturacion`, `obras-sociales`, `practicas`, `costos-margenes`) con las recetas SQL por dominio y el guardrail de obras-sociales. Cargan con `settingSources: ["project"]` + `skills: [...]` en `buildOptions`; `"Skill"` se agrega a `allowedTools`.

Protocolo SSE: el server emite `{ type: "session", sessionId }` (si hay) → `{ type: "answer", text }` → `[DONE]`.

### Frontend (`public/`)

- `index.html` — overlay de bienvenida + chat
- `style.css` — estilos
- `app.js` — selección de tenant (`selectTenant`), cambio de usuario (`switchUser`), streaming SSE (`send`)

## Query Options (por request)

```ts
const requestOptions = { ...buildOptions(dbUrl), systemPrompt: buildSystemPrompt() }

// buildOptions(dbUrl):
{
  mcpServers: { postgres: { type: "stdio", command: "node",
    args: ["node_modules/@modelcontextprotocol/server-postgres/dist/index.js", dbUrl] } },
  allowedTools: ["mcp__postgres__*", "Skill"],
  settingSources: ["project"],   // descubre .claude/skills (y carga CLAUDE.md)
  skills: ["facturacion", "obras-sociales", "practicas", "costos-margenes"],
  permissionMode: "bypassPermissions",
  allowDangerouslySkipPermissions: true
}
// server.ts agrega por request: systemPrompt, y resume: sessionId cuando el cliente lo manda.
```

## System Prompt

`buildSystemPrompt()` lee `prompt.md`. Reglas: trato al cliente final, nunca exponer SQL/tablas, jerga anclada a tablas catálogo, y aislamiento (no revelar otros clientes ni la arquitectura multi-tenant).

## Checklist de aislamiento por tenant

| Medida | Dónde | Estado |
|---|---|---|
| Validación de whitelist | Server (`/api/chat`) | Activo |
| URL/rol por tenant | Server (`buildOptions`) | Activo |
| Sin historial entre requests (sessions del SDK por tenant) | Server | Activo |
| Prompt prohíbe revelar otros clientes/arquitectura | `prompt.md` | Activo |
| `CLAUDE.md` sin datos de tenants (no entran al contexto) | Repo | Activo |

## Dependencia clave

`@anthropic-ai/claude-agent-sdk` v0.2.x envuelve `@anthropic-ai/sdk` y `@modelcontextprotocol/sdk`.
