import { query } from "@anthropic-ai/claude-agent-sdk";
import * as dotenv from "dotenv";
import * as readline from "readline";

dotenv.config();

const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!SUPABASE_ACCESS_TOKEN || !ANTHROPIC_API_KEY) {
  console.error("ERROR: Faltan variables de entorno: ANTHROPIC_API_KEY y/o SUPABASE_ACCESS_TOKEN.");
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const askQuestion = (q: string): Promise<string> => new Promise(resolve => rl.question(q, resolve));

const SYSTEM_PROMPT =
  "Eres un asistente especializado en bases de datos Supabase. " +
  "Consulta EXCLUSIVAMENTE el schema 'public'. " +
  "No accedas ni menciones ningún otro schema (auth, storage, extensions, etc.). " +
  "Si una consulta requiriese datos fuera del schema public, indícalo al usuario en lugar de acceder a otros schemas.";

const options = {
  mcpServers: {
    supabase: {
      type: "http" as const,
      url: "https://mcp.supabase.com/mcp?project_ref=nfjjlfovpznoipgkugdf&read_only=true",
      headers: {
        "Authorization": `Bearer ${SUPABASE_ACCESS_TOKEN}`
      }
    }
  },
  allowedTools: ["mcp__supabase__*"],
  permissionMode: "bypassPermissions" as const,
  system: SYSTEM_PROMPT
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
