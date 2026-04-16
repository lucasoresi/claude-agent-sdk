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

2. **Claude Agent SDK** — calls `query()` from `@anthropic-ai/claude-agent-sdk` with streaming. Only `assistant` messages with `text` blocks are displayed; tool invocations are handled silently by the SDK.

3. **Supabase MCP server** — spawned via `npx @supabase/mcp-server-supabase` with `SUPABASE_ACCESS_TOKEN` injected. The MCP server exposes Supabase database tools to Claude automatically; no explicit tool definitions are needed in application code. `bypassPermissions: true` skips per-action prompts during tool execution.

## Key Dependency

`@anthropic-ai/claude-agent-sdk` v0.2.x wraps `@anthropic-ai/sdk` and `@modelcontextprotocol/sdk`. The MCP server config is passed directly to `query()` — changes to Supabase tooling only require updating the MCP server arguments, not the agent logic.
