import { query } from "@anthropic-ai/claude-agent-sdk";
import * as dotenv from "dotenv";
import express from "express";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!SUPABASE_ACCESS_TOKEN || !ANTHROPIC_API_KEY) {
  console.error("ERROR: Faltan variables de entorno: ANTHROPIC_API_KEY y/o SUPABASE_ACCESS_TOKEN.");
  process.exit(1);
}

const SYSTEM_PROMPT =
  "Eres un asistente especializado en bases de datos Supabase. " +
  "Consulta EXCLUSIVAMENTE el schema 'public'. " +
  "No accedas ni menciones ningún otro schema (auth, storage, extensions, etc.). " +
  "Si una consulta requiriese datos fuera del schema public, indícalo al usuario en lugar de acceder a otros schemas."
  "Laboratorios = Laboratories  |  Sede = headquarter";

const options = {
  mcpServers: {
    supabase: {
      type: "http" as const,
      url: "https://mcp.supabase.com/mcp?project_ref=nfjjlfovpznoipgkugdf&read_only=true",
      headers: {
        Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      },
    },
  },
  allowedTools: ["mcp__supabase__*"],
  permissionMode: "bypassPermissions" as const,
  system: SYSTEM_PROMPT,
};

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
  const { message } = req.body as { message: string };
  if (!message?.trim()) {
    res.status(400).json({ error: "message required" });
    return;
  }

  const history = readHistory();

  // Construir prompt con historial de contexto
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

  try {
    for await (const msg of query({ prompt: fullPrompt, options })) {
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
