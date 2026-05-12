# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Run interactively with ts-node (no compilation needed)
npm run build      # Compile TypeScript to ./dist/
```

No test suite is configured.

## Environment Setup

Copy `.env` and populate both required variables before running:

```
ANTHROPIC_API_KEY=...
SUPABASE_ACCESS_TOKEN=...
```

## Architecture

Single-file TypeScript application (`index.ts`) that wires three things together:

1. **Interactive REPL** — `readline` loop that accepts user input, sends it to Claude, and prints responses. Type `exit` or `quit` to stop.

2. **Claude Agent SDK** — calls `query({ prompt, options })` from `@anthropic-ai/claude-agent-sdk` with streaming. The loop handles three message types:
   - `system/init` — checks MCP connection status and warns on failure
   - `assistant` — accumulates `text` blocks from `message.content`
   - `result` — prints the accumulated assistant text or an error marker

3. **Supabase MCP server** — connected via **HTTP transport** to `https://mcp.supabase.com/mcp?project_ref=<ref>&read_only=true`. Authentication uses `SUPABASE_ACCESS_TOKEN` as a Bearer token in headers. No local process is spawned.

## Query Options

The `options` object passed to `query()` configures the agent:

```ts
{
  mcpServers: {
    supabase: {
      type: "http",
      url: "https://mcp.supabase.com/mcp?project_ref=<ref>&read_only=true",
      headers: { Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}` }
    }
  },
  allowedTools: ["mcp__supabase__*"],   // only Supabase MCP tools are permitted
  permissionMode: "bypassPermissions",  // skips per-action prompts
  system: SYSTEM_PROMPT
}
```

## System Prompt

The agent is restricted to the `public` schema. It will not access or mention `auth`, `storage`, `extensions`, or any other schema — it tells the user instead.

## Key Dependency

`@anthropic-ai/claude-agent-sdk` v0.2.x wraps `@anthropic-ai/sdk` and `@modelcontextprotocol/sdk`. The MCP server config is passed directly to `query()` — changes to Supabase tooling only require updating the `mcpServers` entry in `options`, not the agent logic.
