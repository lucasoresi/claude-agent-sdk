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

const PROMPT_FILE = path.join(process.cwd(), "prompt.md");

function buildSystemPrompt(): string {
  return fs.readFileSync(PROMPT_FILE, "utf-8");
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

type Message = { role: "user" | "assistant"; content: string };

function historyFile(tenant: string): string {
  return path.join(process.cwd(), `chat-history-${tenant}.json`);
}

function readHistory(tenant: string): Message[] {
  try {
    return JSON.parse(fs.readFileSync(historyFile(tenant), "utf-8"));
  } catch {
    return [];
  }
}

function writeHistory(tenant: string, history: Message[]): void {
  fs.writeFileSync(historyFile(tenant), JSON.stringify(history, null, 2));
}

for (const tenant of Object.keys(TENANTS)) writeHistory(tenant, []);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

app.get("/api/history", (req, res) => {
  const tenant = req.query.tenant as string | undefined;
  if (!tenant || !TENANTS[tenant]) { res.json([]); return; }
  res.json(readHistory(tenant));
});

app.delete("/api/history", (req, res) => {
  const tenant = req.query.tenant as string | undefined;
  if (tenant && TENANTS[tenant]) writeHistory(tenant, []);
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

  const history = readHistory(tenant);

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

  writeHistory(tenant, [
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
