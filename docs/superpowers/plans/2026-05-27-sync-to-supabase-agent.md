# Sync claude-agent-sdk to supabase-agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sobrescribir 7 archivos en `clonGithub/claude-agent-sdk/` para que queden idénticos a `claude agent sdk - ui/supabase-agent/`, migrando de HTTP/Supabase MCP a stdio/Postgres, agregando multi-tenancy y suprimiendo emojis.

**Architecture:** El backend pasa de un MCP HTTP estático a un MCP stdio dinámico por tenant. Cada request a `/api/chat` incluye `tenant`, el servidor lo valida contra un whitelist, y construye las opciones del agente con la URL de base de datos correspondiente. El frontend agrega una pantalla de bienvenida con selección de tenant antes de mostrar el chat.

**Tech Stack:** TypeScript, Express 5, `@anthropic-ai/claude-agent-sdk` v0.2.x, `@modelcontextprotocol/server-postgres`, tsx

---

## File Map

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `package.json` | Modificar | Agregar deps + cambiar script start |
| `server.ts` | Reemplazar | Multi-tenant postgres MCP, system prompt sin emojis |
| `index.ts` | Reemplazar | CLI postgres MCP, system prompt sin emojis |
| `public/style.css` | Modificar | Agregar estilos welcome overlay al final |
| `public/index.html` | Reemplazar | Pantalla selección de tenant + chat app |
| `public/app.js` | Reemplazar | Lógica tenant selection + send con tenant |
| `CLAUDE.md` | Reemplazar | Docs actualizadas para arquitectura postgres |

---

### Task 1: Actualizar package.json e instalar dependencias

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Reemplazar package.json**

Contenido completo:

```json
{
  "name": "supabase-agent",
  "version": "1.0.0",
  "description": "Agente basado en Claude Agent SDK con Supabase MCP",
  "main": "index.ts",
  "scripts": {
    "start": "tsx server.ts",
    "build": "tsc"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.2.92",
    "@modelcontextprotocol/server-postgres": "^0.6.2",
    "@types/node": "^25.5.2",
    "dotenv": "^17.4.1",
    "express": "^5.2.1",
    "ts-node": "^10.9.2",
    "typescript": "^6.0.2"
  },
  "devDependencies": {
    "@types/express": "^5.0.6",
    "tsx": "^4.22.3"
  }
}
```

- [ ] **Step 2: Instalar nuevas dependencias**

```bash
cd /mnt/c/Users/lucas/Desktop/clonGithub/claude-agent-sdk
npm install
```

Expected: instala `@modelcontextprotocol/server-postgres` y `tsx`. Sin errores.

- [ ] **Step 3: Verificar que el paquete existe**

```bash
ls node_modules/@modelcontextprotocol/server-postgres/dist/index.js
```

Expected: muestra el path sin error.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add server-postgres and tsx, switch start to tsx"
```

---

### Task 2: Reemplazar server.ts (multi-tenant postgres)

**Files:**
- Modify: `server.ts`

- [ ] **Step 1: Reemplazar server.ts**

Contenido completo:

```ts
import { query } from "@anthropic-ai/claude-agent-sdk";
import * as dotenv from "dotenv";
import express from "express";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const DATABASE_URL_IACA = process.env.DATABASE_URL_IACA;
const DATABASE_URL_NANNI = process.env.DATABASE_URL_NANNI;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!DATABASE_URL_IACA || !DATABASE_URL_NANNI || !ANTHROPIC_API_KEY) {
  console.error("ERROR: Faltan variables de entorno: ANTHROPIC_API_KEY, DATABASE_URL_IACA y/o DATABASE_URL_NANNI.");
  process.exit(1);
}

const TENANTS: Record<string, string> = {
  iaca: DATABASE_URL_IACA,
  nanni: DATABASE_URL_NANNI,
};

function buildSystemPrompt(): string {
  return (
    "Eres un asistente de base de datos. Respondé en el mismo idioma en que te hablen. " +
    "No uses emojis en tus respuestas. " +
    "Laboratorios = Laboratories | Sede = headquarter"
  );
}

function buildOptions(dbUrl: string) {
  return {
    mcpServers: {
      postgres: {
        type: "stdio" as const,
        command: "node",
        args: [
          "node_modules/@modelcontextprotocol/server-postgres/dist/index.js",
          dbUrl,
        ],
      },
    },
    allowedTools: ["mcp__postgres__*"],
    permissionMode: "bypassPermissions" as const,
    allowDangerouslySkipPermissions: true,
  };
}

const HISTORY_FILE = path.join(process.cwd(), "chat-history.json");

type Message = { role: "user" | "assistant"; content: string };

function readHistory(): Message[] {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeHistory(history: Message[]): void {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

writeHistory([]);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

app.get("/api/history", (_req, res) => {
  res.json(readHistory());
});

app.delete("/api/history", (_req, res) => {
  writeHistory([]);
  res.json({ ok: true });
});

app.post("/api/chat", async (req, res) => {
  const { message, tenant } = req.body as { message: string; tenant: string };
  if (!message?.trim()) {
    res.status(400).json({ error: "message required" });
    return;
  }
  const dbUrl = TENANTS[tenant];
  if (!dbUrl) {
    res.status(400).json({ error: "tenant inválido" });
    return;
  }

  const history = readHistory();

  let fullPrompt = message;
  if (history.length > 0) {
    const ctx = history
      .map((m) => `${m.role === "user" ? "Usuario" : "Asistente"}: ${m.content}`)
      .join("\n");
    fullPrompt = `[Conversación previa]\n${ctx}\n\n[Mensaje actual]\nUsuario: ${message}`;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let fullResponse = "";
  const requestOptions = { ...buildOptions(dbUrl), systemPrompt: buildSystemPrompt() };

  try {
    for await (const msg of query({ prompt: fullPrompt, options: requestOptions })) {
      if (msg.type === "assistant") {
        const content = (msg as any).message?.content ?? [];
        const text = content
          .filter((b: any) => b.type === "text")
          .map((b: any) => b.text)
          .join("");
        if (text) {
          fullResponse = text;
          res.write(`data: ${JSON.stringify(text)}\n\n`);
        }
      }
    }
  } catch (err) {
    console.error("[agent error]", err);
    res.write(`data: ${JSON.stringify("[Error: el agente no pudo responder]")}\n\n`);
    fullResponse = "[Error: el agente no pudo responder]";
  }

  writeHistory([
    ...history,
    { role: "user", content: message },
    { role: "assistant", content: fullResponse },
  ]);

  res.write(`data: [DONE]\n\n`);
  res.end();
});

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`Agente Supabase — http://localhost:${PORT}`);
  console.log(`=========================================`);
});
```

- [ ] **Step 2: Verificar compilación TypeScript**

```bash
cd /mnt/c/Users/lucas/Desktop/clonGithub/claude-agent-sdk
npx tsc --noEmit
```

Expected: sin errores de compilación.

- [ ] **Step 3: Commit**

```bash
git add server.ts
git commit -m "feat: replace server.ts with multi-tenant postgres MCP, add no-emoji system prompt"
```

---

### Task 3: Reemplazar index.ts (CLI postgres)

**Files:**
- Modify: `index.ts`

- [ ] **Step 1: Reemplazar index.ts**

Contenido completo:

```ts
import { query } from "@anthropic-ai/claude-agent-sdk";
import * as dotenv from "dotenv";
import * as readline from "readline";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL_IACA;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!DATABASE_URL || !ANTHROPIC_API_KEY) {
  console.error("ERROR: Faltan variables de entorno: ANTHROPIC_API_KEY y/o DATABASE_URL_IACA.");
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const askQuestion = (q: string): Promise<string> => new Promise(resolve => rl.question(q, resolve));

const SYSTEM_PROMPT =
  "Eres un asistente de base de datos. Respondé en el mismo idioma en que te hablen. " +
  "No uses emojis en tus respuestas. " +
  "Laboratorios = Laboratories | Sede = headquarter";

const options = {
  mcpServers: {
    postgres: {
      type: "stdio" as const,
      command: "node",
      args: [
        "node_modules/@modelcontextprotocol/server-postgres/dist/index.js",
        DATABASE_URL,
      ],
    },
  },
  allowedTools: ["mcp__postgres__*"],
  permissionMode: "bypassPermissions" as const,
  allowDangerouslySkipPermissions: true,
  systemPrompt: SYSTEM_PROMPT,
};

async function main() {
  console.log("=========================================");
  console.log("Agente TypeScript + Supabase MCP");
  console.log("=========================================\n");
  console.log("Escribe tu consulta sobre la base de datos o 'exit' para salir.\n");

  while (true) {
    const userInput = await askQuestion("> Usuario: ");

    if (userInput.toLowerCase() === "exit" || userInput.toLowerCase() === "quit") {
      console.log("Saliendo...");
      rl.close();
      break;
    }

    try {
      let lastAssistantText = "";

      for await (const message of query({ prompt: userInput, options })) {
        if (message.type === "system" && message.subtype === "init") {
          const servers = (message as any).mcp_servers ?? [];
          const failed = servers.filter((s: any) => s.status !== "connected");
          if (failed.length > 0) {
            console.warn("MCP no conectado:", failed.map((s: any) => s.name).join(", "));
          }
        }

        if (message.type === "assistant") {
          const content = (message as any).message?.content ?? [];
          const text = content
            .filter((b: any) => b.type === "text")
            .map((b: any) => b.text)
            .join("");
          if (text) lastAssistantText = text;
        }

        if (message.type === "result") {
          if ((message as any).subtype === "error_during_execution") {
            console.error("\n[Error durante la ejecución]");
          } else if (lastAssistantText) {
            process.stdout.write("\nClaude: " + lastAssistantText + "\n");
          }
        }
      }
    } catch (error) {
      console.error("\n[Error]:", error);
    }
  }
}

main().catch(console.error);
```

- [ ] **Step 2: Verificar compilación TypeScript**

```bash
cd /mnt/c/Users/lucas/Desktop/clonGithub/claude-agent-sdk
npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add index.ts
git commit -m "feat: replace index.ts with postgres MCP CLI, add no-emoji system prompt"
```

---

### Task 4: Agregar estilos welcome overlay a style.css

**Files:**
- Modify: `public/style.css`

- [ ] **Step 1: Agregar estilos al final de public/style.css**

Agregar a partir de la línea 197 (después de `.send-btn:disabled`):

```css

/* Welcome overlay */
.welcome-overlay {
  position: fixed;
  inset: 0;
  backdrop-filter: blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  background: rgba(245, 245, 247, 0.25);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 36px;
  z-index: 100;
}

.welcome-subtitle {
  font-size: 14px;
  color: #6b7280;
  text-align: center;
}

/* User selection cards */
.user-cards {
  display: flex;
  gap: 16px;
}

.user-card {
  position: relative;
  width: 200px;
  height: 72px;
  border-radius: 16px;
  cursor: pointer;
  overflow: hidden;
  border: none;
  padding: 0;
  background: transparent;
  transition: transform 0.2s ease;
}
.user-card:hover { transform: translateY(-2px); }

.glass {
  position: absolute;
  inset: 0;
  border-radius: 16px;
  background: linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.38) 0%,
    rgba(255, 255, 255, 0.12) 50%,
    rgba(255, 255, 255, 0.22) 100%
  );
  backdrop-filter: blur(28px) saturate(1.6);
  -webkit-backdrop-filter: blur(28px) saturate(1.6);
  border: 1px solid rgba(255, 255, 255, 0.55);
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.85),
    inset 0 -1px 0 rgba(255, 255, 255, 0.15);
}
.glass::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 45%;
  border-radius: 16px 16px 60% 60%;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0) 100%);
  pointer-events: none;
}

.card-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 22px;
  gap: 14px;
}

.card-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.iaca .card-dot { background: #3b82f6; box-shadow: 0 0 6px rgba(59, 130, 246, 0.6); }
.nanni .card-dot { background: #10b981; box-shadow: 0 0 6px rgba(16, 185, 129, 0.6); }

.card-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.card-name {
  font-size: 15px;
  font-weight: 600;
  color: #1d1d1f;
  letter-spacing: -0.2px;
}
.card-schema {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.4);
  font-family: 'Menlo', 'Consolas', monospace;
}
```

- [ ] **Step 2: Commit**

```bash
git add public/style.css
git commit -m "feat: add welcome overlay styles (liquid glass tenant cards)"
```

---

### Task 5: Reemplazar public/index.html (pantalla de selección de tenant)

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Reemplazar public/index.html**

Contenido completo:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Agente Supabase</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div id="welcome" class="welcome-overlay">
    <p class="welcome-subtitle">Seleccioná tu usuario para comenzar</p>
    <div class="user-cards">
      <button class="user-card iaca" data-tenant="iaca">
        <div class="glass"></div>
        <div class="card-content">
          <div class="card-dot"></div>
          <div class="card-info">
            <span class="card-name">iaca</span>
            <span class="card-schema">public</span>
          </div>
        </div>
      </button>
      <button class="user-card nanni" data-tenant="nanni">
        <div class="glass"></div>
        <div class="card-content">
          <div class="card-dot"></div>
          <div class="card-info">
            <span class="card-name">nanni</span>
            <span class="card-schema">tenant_nanni</span>
          </div>
        </div>
      </button>
    </div>
  </div>

  <div class="chat-app" id="chatApp" style="display:none">
    <header class="chat-header">
      <span class="chat-title">Agente Supabase — <strong id="tenantLabel"></strong></span>
      <div style="display:flex;gap:8px;align-items:center;">
        <button class="new-chat-btn" id="switchUserBtn">Cambiar usuario</button>
        <button class="new-chat-btn" id="newChatBtn">+ Nueva conversación</button>
      </div>
    </header>

    <div class="chat-body">
      <div class="messages" id="messages"></div>

      <div class="input-area">
        <div class="input-box">
          <input
            type="text"
            id="messageInput"
            placeholder="Escribe tu mensaje..."
            autocomplete="off"
          />
          <button class="send-btn" id="sendBtn" aria-label="Enviar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"></line>
              <polyline points="5 12 12 5 19 12"></polyline>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add public/index.html
git commit -m "feat: add tenant selection welcome overlay to index.html"
```

---

### Task 6: Reemplazar public/app.js (lógica de tenant)

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Reemplazar public/app.js**

Contenido completo:

```js
const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const switchUserBtn = document.getElementById('switchUserBtn');
const welcomeEl = document.getElementById('welcome');
const chatAppEl = document.getElementById('chatApp');

let currentTenant = null;

function selectTenant(tenant) {
  currentTenant = tenant;
  document.getElementById('tenantLabel').textContent = tenant;
  welcomeEl.style.display = 'none';
  chatAppEl.style.display = 'flex';
  inputEl.focus();
}

async function switchUser() {
  await fetch('/api/history', { method: 'DELETE' });
  messagesEl.innerHTML = '';
  currentTenant = null;
  chatAppEl.style.display = 'none';
  welcomeEl.style.display = 'flex';
}

function addUserBubble(text) {
  const row = document.createElement('div');
  row.className = 'msg-user';
  const bubble = document.createElement('div');
  bubble.className = 'bubble-user';
  bubble.textContent = text;
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  scrollBottom();
}

function addAssistantBubble(text) {
  const row = document.createElement('div');
  row.className = 'msg-assistant';
  const bubble = document.createElement('div');
  bubble.className = 'bubble-assistant';
  bubble.innerHTML = marked.parse(text);
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  scrollBottom();
  return bubble;
}

function showTyping() {
  const row = document.createElement('div');
  row.className = 'msg-typing';
  row.id = 'typing';
  row.innerHTML = `<div class="typing-bubble">
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  </div>`;
  messagesEl.appendChild(row);
  scrollBottom();
}

function hideTyping() {
  document.getElementById('typing')?.remove();
}

function scrollBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setEnabled(on) {
  inputEl.disabled = !on;
  sendBtn.disabled = !on;
}

async function send() {
  const text = inputEl.value.trim();
  if (!text) return;

  inputEl.value = '';
  setEnabled(false);
  addUserBubble(text);
  showTyping();

  let bubble = null;
  let rawText = '';
  let buf = '';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, tenant: currentTenant }),
    });

    const reader = res.body.getReader();
    const dec = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6);
        if (payload === '[DONE]') break;
        try {
          const chunk = JSON.parse(payload);
          rawText += chunk;
          hideTyping();
          if (!bubble) bubble = addAssistantBubble('');
          bubble.innerHTML = marked.parse(rawText);
          scrollBottom();
        } catch {}
      }
    }
  } catch {
    hideTyping();
    addAssistantBubble('Error al conectar con el agente.');
  }

  setEnabled(true);
  inputEl.focus();
}

document.querySelectorAll('.user-card').forEach(btn => {
  btn.addEventListener('click', () => selectTenant(btn.dataset.tenant));
});

switchUserBtn.addEventListener('click', switchUser);

newChatBtn.addEventListener('click', async () => {
  await fetch('/api/history', { method: 'DELETE' });
  messagesEl.innerHTML = '';
  inputEl.focus();
});

sendBtn.addEventListener('click', send);
inputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});
```

- [ ] **Step 2: Commit**

```bash
git add public/app.js
git commit -m "feat: add tenant selection logic to app.js, remove loadHistory on startup"
```

---

### Task 7: Actualizar CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Reemplazar CLAUDE.md**

Contenido completo:

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

\`\`\`bash
npm start          # Run the web server with tsx (no compilation needed)
npm run build      # Compile TypeScript to ./dist/
\`\`\`

No test suite is configured.

## Environment Setup

Copy `.env` and populate all required variables before running:

\`\`\`
ANTHROPIC_API_KEY=...
DATABASE_URL_IACA=...
DATABASE_URL_NANNI=...
\`\`\`

## Architecture

Two-file application: `server.ts` (backend) + `public/` (frontend).

### Backend (`server.ts`)

Express server that wires three things together:

1. **Tenant isolation** — Two tenants are defined in a whitelist:
   - `iaca` → `DATABASE_URL_IACA`
   - `nanni` → `DATABASE_URL_NANNI`

   Every `/api/chat` request must include a `tenant` field. The server validates it against the whitelist and rejects unknown values with `400`. Each tenant connects to its own database URL.

2. **Claude Agent SDK** — calls `query({ prompt, options })` from `@anthropic-ai/claude-agent-sdk` with streaming. `options` is built per-request via `buildOptions(dbUrl)`. The loop handles:
   - `assistant` — accumulates `text` blocks from `message.content`, streams via SSE
   - errors — written as SSE data before closing

3. **Postgres MCP server** — connected via **stdio transport** using `@modelcontextprotocol/server-postgres`. A local node process is spawned per request with the tenant's database URL as argument.

4. **Chat history** — persisted to `chat-history.json`. Cleared on server startup and on tenant switch (`DELETE /api/history`).

### Frontend (`public/`)

- `index.html` — welcome overlay (liquid glass) + chat app (hidden until tenant selected)
- `style.css` — chat styles + liquid glass card styles
- `app.js` — tenant selection (`selectTenant`), user switch (`switchUser`), SSE streaming (`send`)

## Query Options (per request)

\`\`\`ts
const requestOptions = {
  ...buildOptions(dbUrl),
  systemPrompt: buildSystemPrompt()
}

// buildOptions(dbUrl) returns:
{
  mcpServers: {
    postgres: {
      type: "stdio",
      command: "node",
      args: ["node_modules/@modelcontextprotocol/server-postgres/dist/index.js", dbUrl]
    }
  },
  allowedTools: ["mcp__postgres__*"],
  permissionMode: "bypassPermissions",
  allowDangerouslySkipPermissions: true
}
\`\`\`

## System Prompt

Generated by `buildSystemPrompt()`. Key rules:
- Responds in the language of the user
- No emojis in responses
- Vocabulary hints: Laboratorios = Laboratories | Sede = headquarter

## Tenant Isolation Checklist

| Measure | Where | Status |
|---|---|---|
| Tenant whitelist validation | Server (`/api/chat`) | Active |
| Per-tenant database URL | Server (`buildOptions`) | Active |
| History cleared on server startup | Server | Active |
| History cleared on tenant switch | Server + UI | Active |

## Key Dependency

`@anthropic-ai/claude-agent-sdk` v0.2.x wraps `@anthropic-ai/sdk` and `@modelcontextprotocol/sdk`. The MCP server config is passed directly to `query()` — changes to database tooling only require updating the `mcpServers` entry in `buildOptions`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for postgres multi-tenant architecture"
```

---

### Task 8: Verificación final

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Verificar compilación limpia**

```bash
cd /mnt/c/Users/lucas/Desktop/clonGithub/claude-agent-sdk
npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 2: Verificar que .env tiene las variables correctas**

```bash
grep -E "ANTHROPIC_API_KEY|DATABASE_URL_IACA|DATABASE_URL_NANNI" .env
```

Expected: las 3 variables presentes. Si `DATABASE_URL_IACA` o `DATABASE_URL_NANNI` no existen, agregarlas al `.env` antes de continuar.

- [ ] **Step 3: Verificar que el servidor arranca**

```bash
npm start
```

Expected: imprime `Agente Supabase — http://localhost:3000` sin errores de módulos faltantes.

- [ ] **Step 4: Verificar diff contra supabase-agent**

```bash
diff /mnt/c/Users/lucas/Desktop/clonGithub/claude-agent-sdk/server.ts \
     "/mnt/c/Users/lucas/Desktop/claude agent sdk - ui/supabase-agent/server.ts"
```

Expected: sin diferencias (o solo espaciado irrelevante).

```bash
diff /mnt/c/Users/lucas/Desktop/clonGithub/claude-agent-sdk/public/app.js \
     "/mnt/c/Users/lucas/Desktop/claude agent sdk - ui/supabase-agent/public/app.js"
```

Expected: sin diferencias.
