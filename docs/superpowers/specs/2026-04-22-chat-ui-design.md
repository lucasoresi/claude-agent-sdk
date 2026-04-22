# Chat UI — Diseño

## Resumen

Agregar una interfaz web al agente Supabase existente. Reemplaza el REPL de readline con un servidor Express que sirve un chat visual. El historial de conversación persiste entre recargas en un archivo JSON local.

---

## Stack

- **Backend**: Express (TypeScript) en el mismo repo
- **Frontend**: HTML + CSS + JS vanilla (sin frameworks)
- **Streaming**: Server-Sent Events (SSE) para mostrar la respuesta del agente en tiempo real
- **Persistencia**: `chat-history.json` en la raíz del proyecto (gitignored)

### Dependencias nuevas a instalar

```bash
npm install express
npm install --save-dev @types/express
```

---

## Estructura de archivos

```
supabase-agent/
├── agent.ts              # lógica del agente SDK (extraída de index.ts)
├── server.ts             # Express + rutas + SSE
├── public/
│   ├── index.html        # estructura del chat
│   ├── style.css         # estilos (fiel a ui.md)
│   └── app.js            # lógica frontend: SSE, render de mensajes
├── chat-history.json     # generado en runtime (gitignored)
└── .env
```

`index.ts` original se reemplaza por `server.ts` como entry point. El `package.json` apunta `npm start` a `ts-node server.ts`.

---

## Módulo `agent.ts`

Exporta una única función:

```ts
export async function* runAgent(
  prompt: string,
  history: { role: "user" | "assistant"; content: string }[]
): AsyncGenerator<string>
```

- Construye el historial como string de contexto antepuesto al prompt: cada turno previo se formatea como `Usuario: ...\nAsistente: ...` y se concatena antes del mensaje actual
- Itera los mensajes del SDK y emite solo los chunks de texto (`assistant` messages con `text` blocks)
- No sabe nada del servidor ni del historial en disco

---

## Módulo `server.ts`

Servidor Express en el puerto `3000` (configurable vía `PORT` en `.env`).

### Rutas

| Método | Path | Descripción |
|--------|------|-------------|
| `GET /` | — | Sirve `public/index.html` |
| `GET /api/history` | — | Devuelve el array del historial JSON |
| `POST /api/chat` | `{ message: string }` | Abre SSE, llama `runAgent()`, streama chunks, guarda par user/assistant al terminar |
| `DELETE /api/history` | — | Vacía el historial y responde `{ ok: true }` |

### Flujo de `/api/chat`

1. Lee `chat-history.json` (o `[]` si no existe)
2. Agrega `{ role: "user", content: message }` al array en memoria
3. Setea headers SSE (`Content-Type: text/event-stream`)
4. Itera `runAgent(message, history)` — por cada chunk envía `data: <chunk>\n\n`
5. Al terminar el stream, envía `data: [DONE]\n\n`
6. Agrega `{ role: "assistant", content: fullResponse }` al historial
7. Guarda el historial actualizado en `chat-history.json`

### Persistencia del historial

Formato de `chat-history.json`:

```json
[
  { "role": "user", "content": "¿Cuántas tablas hay?" },
  { "role": "assistant", "content": "Hay 5 tablas en el schema public." }
]
```

Se lee en cada request (no se cachea en memoria) para garantizar consistencia entre recargas.

---

## Frontend

### `public/index.html`

Estructura:
```
<div class="chat-app">
  <header>                  ← título + botón "Nueva conversación"
  <div class="messages">    ← área scrolleable de burbujas
  <div class="input-area">  ← input + botón envío
```

### `public/style.css`

Fiel a la spec de `ui.md`:

| Elemento | Estilo |
|----------|--------|
| Fondo | `#FAFAFA` |
| Burbuja usuario | Derecha, `#3B82F6`, texto blanco, `border-radius: 9999px`, `padding: 10px 18px` |
| Burbuja asistente | Centrada (`justify-content: center`), `#F3F4F6`, texto `#1F2937`, `border-radius: 9999px` |
| Input container | Centrado, `max-width: 680px`, `border: 1px solid #E5E7EB`, `border-radius: 20px`, `box-shadow: sm` |
| Placeholder | `"Escribe tu mensaje..."`, color `#9CA3AF` |
| Botón envío | Flecha ↑ SVG, negro, sin background |
| Scrollbar | 4px, gris `#D1D5DB`, sin border-radius |

### `public/app.js`

Responsabilidades:
1. Al cargar: `GET /api/history` → renderiza mensajes existentes
2. Al enviar: deshabilita input, agrega burbuja usuario, muestra typing indicator
3. Abre `EventSource` a `POST /api/chat` (usando `fetch` con `ReadableStream`, no `EventSource` nativo porque este no soporta POST)
4. Por cada chunk recibido: actualiza la burbuja del asistente en tiempo real (streaming visible)
5. Al recibir `[DONE]`: elimina typing indicator, rehabilita input
6. Botón "Nueva conversación": `DELETE /api/history` → limpia el DOM

---

## Arranque

```bash
npm start   # ts-node server.ts → http://localhost:3000
```

---

## Variables de entorno

Sin cambios. Las mismas del proyecto original:

```
ANTHROPIC_API_KEY=...
SUPABASE_ACCESS_TOKEN=...
PORT=3000   # opcional, default 3000
```

---

## `.gitignore` — agregar

```
chat-history.json
```
