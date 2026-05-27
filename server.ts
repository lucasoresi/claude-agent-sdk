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
