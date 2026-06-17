# CLAUDE.md

Guía para Claude Code al trabajar en este repositorio.

> IMPORTANTE: este archivo se carga al contexto del agente en runtime. Mantenelo libre de detalles de negocio, infraestructura o entornos (nombres de clientes, URLs, esquemas, multi-tenant, etc.). Todo eso va en `README.md`, que NO se carga al contexto.

## Commands

```bash
npm start                  # Levanta el server con tsx
npm run build              # Compila a ./dist/
npx tsx --test *.test.ts   # Tests
```

## Estructura

- `server.ts` — backend
- `public/` — frontend
- `prompt.md` — system prompt de cara al cliente (lo lee `buildSystemPrompt()`)
- `.claude/skills/` — conocimiento de dominio (skills)

La arquitectura completa, el setup y las notas de diseño están en `README.md`.
