import { query } from "@anthropic-ai/claude-agent-sdk";
import { finalAnswerFor, FRIENDLY_ERROR } from "./agent-output";
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

// Skills de dominio (archivos en .claude/skills/<nombre>/SKILL.md).
// Claude las carga sola cuando la consulta coincide con su `description`.
const DOMAIN_SKILLS = ["facturacion", "obras-sociales", "practicas", "costos-margenes"];

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
    // "Skill" habilita la carga de las skills de dominio; el resto es la DB.
    allowedTools: ["mcp__postgres__*", "Skill"],
    // Carga skills (y CLAUDE.md) del proyecto; necesario para descubrir .claude/skills.
    settingSources: ["project"] as ("user" | "project" | "local")[],
    skills: DOMAIN_SKILLS,
    permissionMode: "bypassPermissions" as const,
    allowDangerouslySkipPermissions: true,
  };
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

app.post("/api/chat", async (req, res) => {
  const { message, tenant, sessionId } = req.body as {
    message: string;
    tenant: string;
    sessionId?: string;
  };
  if (!message?.trim()) {
    res.status(400).json({ error: "message required" });
    return;
  }
  const dbUrl = TENANTS[tenant];
  if (!dbUrl) {
    res.status(400).json({ error: "tenant inválido" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let fullResponse = FRIENDLY_ERROR;
  let sawResult = false;
  let currentSessionId: string | undefined = sessionId;

  // Official session management: resume the prior session if the client sent its ID.
  const requestOptions = {
    ...buildOptions(dbUrl),
    systemPrompt: buildSystemPrompt(),
    ...(sessionId ? { resume: sessionId } : {}),
  };

  try {
    // Emit only the final result message; every intermediate message (assistant narration, tool calls, tool results) is dropped so the client never sees them.
    for await (const msg of query({ prompt: message, options: requestOptions })) {
      // Capture/refresh the session id from any message that carries it.
      if (msg && typeof msg === "object" && "session_id" in msg) {
        currentSessionId = (msg as { session_id: string }).session_id;
      }
      const final = finalAnswerFor(msg as any);
      if (final !== null) {
        fullResponse = final;
        sawResult = true;
      }
    }
  } catch (err) {
    console.error("[agent error]", err);
    fullResponse = FRIENDLY_ERROR;
  }

  if (!sawResult) console.warn("[agent] stream ended without a result message");

  if (currentSessionId) {
    res.write(`data: ${JSON.stringify({ type: "session", sessionId: currentSessionId })}\n\n`);
  }
  res.write(`data: ${JSON.stringify({ type: "answer", text: fullResponse })}\n\n`);
  res.write(`data: [DONE]\n\n`);
  res.end();
});

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`Agente Supabase — http://localhost:${PORT}`);
  console.log(`=========================================`);
});
