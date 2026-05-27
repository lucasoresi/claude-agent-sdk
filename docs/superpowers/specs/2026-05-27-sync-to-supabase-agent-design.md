# Spec: Sincronizar claude-agent-sdk con supabase-agent

**Fecha:** 2026-05-27  
**Proyecto:** `/mnt/c/Users/lucas/Desktop/clonGithub/claude-agent-sdk/`  
**Fuente:** `/mnt/c/Users/lucas/Desktop/claude agent sdk - ui/supabase-agent/`

## Objetivo

Hacer que `claude-agent-sdk` quede como copia exacta de `supabase-agent`, migrando de HTTP/Supabase MCP a stdio/Postgres directo, agregando multi-tenancy real por URL de base de datos, y suprimiendo emojis en las respuestas del agente.

## Archivos a sobrescribir

### `index.ts`

- Reemplaza `SUPABASE_ACCESS_TOKEN` por `DATABASE_URL_IACA`
- Cambia MCP de HTTP (`mcp.supabase.com`) a stdio (`server-postgres` local)
- Cambia `allowedTools` de `mcp__supabase__*` a `mcp__postgres__*`
- Cambia la clave del system prompt de `system` a `systemPrompt`
- Agrega `allowDangerouslySkipPermissions: true`
- System prompt: genérico (idioma + vocabulario), **sin emojis**

### `server.ts`

- Reemplaza `SUPABASE_ACCESS_TOKEN` por `DATABASE_URL_IACA` + `DATABASE_URL_NANNI`
- Agrega mapa `TENANTS: Record<string, string>` → `{ iaca: DATABASE_URL_IACA, nanni: DATABASE_URL_NANNI }`
- `buildOptions(dbUrl)`: construye config MCP stdio por tenant (usa la URL recibida)
- `buildSystemPrompt()`: prompt genérico (idioma + vocabulario), **incluye "No uses emojis en tus respuestas."**
- `/api/chat`: valida campo `tenant` contra el mapa, construye `requestOptions` dinámicamente
- Clave del system prompt: `systemPrompt` (no `system`)
- Agrega `allowDangerouslySkipPermissions: true` en options

### `public/index.html`

- Agrega `<div id="welcome">` con overlay de selección de tenant
  - Botón `iaca` (data-tenant="iaca", muestra schema `public`)
  - Botón `nanni` (data-tenant="nanni", muestra schema `tenant_nanni`)
- El `<div id="chatApp">` arranca con `display:none`
- Header del chat muestra el tenant activo (`<strong id="tenantLabel">`)
- Botón "Cambiar usuario" (`id="switchUserBtn"`) junto al de nueva conversación

### `public/app.js`

- Variable `currentTenant = null`
- `selectTenant(tenant)`: setea tenant, oculta welcome, muestra chat
- `switchUser()`: limpia historial vía `DELETE /api/history`, limpia mensajes, vuelve al welcome
- `send()`: incluye `tenant: currentTenant` en el body del fetch
- Elimina `loadHistory()` al startup (la historia se carga implícitamente desde el servidor con el historial del tenant)
- Agrega listener en `.user-card` para `selectTenant`
- Agrega listener en `switchUserBtn` para `switchUser`

### `public/style.css`

- Agrega al final los estilos del welcome overlay:
  - `.welcome-overlay`: `position: fixed; inset: 0; backdrop-filter: blur(20px)`
  - `.welcome-subtitle`, `.user-cards`
  - `.user-card`: liquid glass (`.glass`, `.glass::before`)
  - `.card-content`, `.card-dot`, `.card-info`, `.card-name`, `.card-schema`
  - Colores por tenant: `.iaca .card-dot` azul, `.nanni .card-dot` verde

### `package.json`

- Agrega dependencia: `"@modelcontextprotocol/server-postgres": "^0.6.2"`
- Agrega devDependency: `"tsx": "^4.22.3"`
- Cambia script `start`: `"ts-node server.ts"` → `"tsx server.ts"`

### `CLAUDE.md`

- Actualiza sección Architecture para describir arquitectura multi-tenant con postgres stdio
- Actualiza Environment Setup para listar `DATABASE_URL_IACA` y `DATABASE_URL_NANNI` en lugar de `SUPABASE_ACCESS_TOKEN`
- Actualiza sección Query Options para reflejar config stdio
- Actualiza Tenant Isolation Checklist

## Archivos que NO se tocan

| Archivo | Razón |
|---|---|
| `.env` | Credenciales propias del proyecto |
| `node_modules/` | Se regenera con `npm install` |
| `.git/` | Historial propio del proyecto |
| `chat-history.json` | Archivo de runtime |
| `tsconfig.json` | Idéntico en ambos proyectos |

## Paso post-copia

Ejecutar `npm install` en `clonGithub/claude-agent-sdk/` para instalar:
- `@modelcontextprotocol/server-postgres`
- `tsx`

## Variables de entorno requeridas tras la migración

```
ANTHROPIC_API_KEY=...
DATABASE_URL_IACA=...      # Reemplaza SUPABASE_ACCESS_TOKEN
DATABASE_URL_NANNI=...     # Nuevo — conexión directa al schema tenant_nanni
```

## System prompt (no emojis)

```
"Eres un asistente de base de datos. Respondé en el mismo idioma en que te hablen. " +
"No uses emojis en tus respuestas. " +
"Laboratorios = Laboratories | Sede = headquarter"
```
