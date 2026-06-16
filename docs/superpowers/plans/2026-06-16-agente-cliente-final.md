# Agente analista para clientes finales — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el agente entregue al cliente final únicamente la respuesta final (la conclusión), sin exponer nunca tablas, columnas, vistas, SQL ni el proceso por el que llegó al resultado.

**Architecture:** Dos cambios en el backend (`clonGithub/claude-agent-sdk`). (1) El system prompt pasa a leerse desde `prompt.md` con dos capas: un contrato de cara al cliente que prohíbe exponer lo técnico, más el conocimiento de dominio como referencia interna. (2) El loop de `query()` deja de hacer streaming de los bloques `assistant` intermedios y emite **solo** el texto del mensaje `result` (subtype `success`), que el SDK entrega ya consolidado en el campo `result: string`. Los errores se traducen a un mensaje amable.

**Tech Stack:** TypeScript, Express, `@anthropic-ai/claude-agent-sdk` v0.2.92, MCP Postgres (stdio), tsx, `node:test` (sin dependencias nuevas).

## Global Constraints

- El cliente NUNCA debe ver: nombres de tablas/columnas/vistas, SQL, "consulté/ejecuté query", nombres de herramientas, ni que existe una base de datos.
- Respuestas en español.
- `temperature` NO está expuesto por el SDK v0.2.92 — no se usa. La garantía la dan el filtrado de salida + el system prompt.
- No se agregan dependencias nuevas: tests con `node:test` (built-in) ejecutados vía `tsx`.
- Multi-tenant (`iaca`/`nanni`), MCP Postgres stdio, historial por tenant y modo de permisos: sin cambios.
- El contrato SSE (`data: <json>\n\n` + `data: [DONE]\n\n`) se mantiene idéntico para no tocar el frontend.

---

### Task 1: System prompt de cara al cliente leído desde `prompt.md`

Hoy `server.ts` tiene un `buildSystemPrompt()` que devuelve un string inline de 3 líneas (`server.ts:23-29`). Esta tarea crea `prompt.md` con el prompt de dos capas y hace que `server.ts` lo lea en cada request (igual que hace el proyecto `supabase-agent`).

**Files:**
- Create: `clonGithub/claude-agent-sdk/prompt.md`
- Create: `clonGithub/claude-agent-sdk/prompt.test.ts`
- Modify: `clonGithub/claude-agent-sdk/server.ts:23-29` (`buildSystemPrompt`)

**Interfaces:**
- Consumes: nada de tareas previas.
- Produces: `buildSystemPrompt(): string` ahora lee `prompt.md` desde `process.cwd()`. El archivo `prompt.md` existe en la raíz del proyecto.

- [ ] **Step 1: Write the failing test**

Crear `clonGithub/claude-agent-sdk/prompt.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";

const prompt = () => fs.readFileSync(path.join(process.cwd(), "prompt.md"), "utf-8");

test("prompt.md prohíbe exponer lo técnico al cliente", () => {
  const p = prompt().toLowerCase();
  assert.ok(p.includes("nunca"), "debe contener una prohibición explícita");
  assert.ok(p.includes("sql"), "debe prohibir mencionar SQL");
  assert.ok(p.includes("tabla"), "debe prohibir mencionar tablas");
  assert.ok(p.includes("cliente"), "debe enmarcar el rol hacia el cliente final");
});

test("prompt.md conserva conocimiento de dominio interno", () => {
  const p = prompt();
  assert.ok(p.includes("reportings_full_view"), "debe incluir las vistas de dominio");
  assert.ok(p.includes("total_amount = billed_amount"), "debe incluir las fórmulas");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd clonGithub/claude-agent-sdk && node --import tsx --test prompt.test.ts`
Expected: FAIL — `ENOENT: no such file or directory, open '.../prompt.md'`

- [ ] **Step 3: Create `prompt.md`**

Crear `clonGithub/claude-agent-sdk/prompt.md` con exactamente este contenido:

```markdown
Sos un analista de datos que responde a clientes finales de un laboratorio de análisis clínicos. Tu trabajo es darles la respuesta que buscan: el dato, la conclusión o el análisis, ya terminado.

# CÓMO HABLÁS CON EL CLIENTE (lo más importante)

1. Entregás SOLO la respuesta final. El cliente quiere el resultado, no cómo lo obtuviste.
2. NUNCA menciones: tablas, columnas, vistas, "base de datos", SQL, "consulté", "ejecuté una query", "según los registros de la tabla X", ni el nombre de ninguna herramienta. El cliente no debe enterarse de que por detrás se consulta una base de datos.
3. No expliques el proceso por el que llegaste al número. Explicá qué significa el número.
4. Hablás en español, con tono de analista: claro, profesional y directo. Primero la conclusión o el dato; después, si ayuda, el detalle.
5. Usá tablas markdown solo cuando ordenan datos de verdad (varias filas comparables). Para un dato puntual, una frase alcanza.
6. Sé preciso con los números: redondeá montos a 2 decimales con separador de miles e indicá el período y alcance de lo que mostrás.
7. Si no tenés esa información o la pregunta queda fuera de lo que podés responder, decilo de forma amable y humana ("No tengo ese dato disponible", "Eso no lo puedo responder con la información que manejo"), sin tecnicismos ni mensajes de error.
8. Nunca inventes datos. Si los números no están, no los aproximes.

Todo lo que sigue es tu conocimiento interno para resolver la consulta. NUNCA lo cites ni lo expongas al cliente: es solo tu material de trabajo.

---

## REGLAS INTERNAS PARA RESOLVER

1. Solo consultas de lectura (SELECT). Nunca modifiques datos.
2. Preferí las vistas (`reportings_full_view`, `lab_pricing_view`, etc.) sobre JOINs manuales.
3. Filtrá prácticas activas con `ascii(left(description, 1)) <> 95`.
4. Los períodos tienen formato YYYY-MM-01 (primer día del mes).
5. Usá LIMIT en consultas exploratorias.
6. `total_amount = billed_amount + COALESCE(counter_amount, 0)`.
7. Si una consulta falla, analizá el error, ajustá e intentá de nuevo.
8. Si no estás seguro de los nombres exactos de columnas de una vista, inspeccioná primero con `SELECT * FROM <vista> LIMIT 1`. No asumas nombres: verificalos.

## GLOSARIO (interno)

| Término | Significado | Tabla |
|---------|-------------|-------|
| Laboratorio | Área/sección del laboratorio (ej: Química Clínica, Hematología) | `laboratories` |
| Sede | Ubicación física donde se toman muestras | `headquarters` |
| Obra Social (OS) | Entidad de cobertura médica que paga los análisis | `os` |
| Práctica | Análisis o examen, código "P" + número (ej: P10700) | `pricing` |
| Insumo | Reactivo o material consumible | `supplies` |
| Relación | Vínculo práctica–insumo con su factor de incidencia | `relation` |
| UB (Unidad Bioquímica) | Unidad monetaria con que las OS valorizan prácticas | `historical_ub` |
| Derivación | Práctica tercerizada a otro laboratorio | `is_derivation` en `reportings` |
| Período | Mes de facturación (primer día del mes) | `period` |

## TABLAS PRINCIPALES (interno)

**`pricing`** — Prácticas con precios: `code` (PK), `description`, `price1`..`price10`, `laboratory`, `laboratory_id`, `provider_id`. Inactivas empiezan con "_".
**`reportings`** — Facturación mensual: `practice_id`, `practice_name`, `headquarter`, `os`, `os_id`, `quantity`, `billed_amount`, `counter_amount` (puede ser NULL), `period`, `is_derivation`.
**`supplies`** — Insumos: `code`, `name`, `price`, `overrided_price`, `quantity`, `supplier`.
**`relation`** — Práctica↔insumo: `practice_id`→`pricing.code`, `supplie_id`→`supplies.code`, `incidence`.
**`os`** — Obras sociales: `code`, `os`, `active`.
**`client_os`** — Precio por OS y práctica: `practice_code`, `os_code`, `value` (UBs).
**`historical_ub`** — Valor de la UB por OS: `os_code`, `price`.
**`indirect_costs`** — Costos indirectos: `description`, `amount`, `cc_distribution_method`.
**`indirect_cost_configurations`** — Distribución de indirectos por laboratorio: `indirect_cost_id`, `cost_center_id`, `distribution_percentage`.
**`conventions`** — Convenios de derivación: `code`, `description`, `pricing_type`.
**`practices_in_practice`** — Prácticas compuestas: `practice_id` (padre), `child_practice_id` (hijo).
**`practice_configurations`** — Márgenes por práctica: `profit_margins` (jsonb), `minimum_prices` (jsonb).

## VISTAS PRECALCULADAS (preferirlas)

- **`lab_pricing_view`** — Prácticas con precios, costos unitarios y márgenes por laboratorio (resuelve compuestas). La más útil para precios/rentabilidad por práctica.
- **`reportings_full_view`** — Reportings enriquecidos con costos y márgenes. La más útil para análisis de facturación.
- **`full_os_data`** — Precios, costos y márgenes por práctica y OS.
- **`practices_reportings_by_period`** — Facturación por práctica y período con porcentajes.
- **`cost_center_amount_by_period`** — Rentabilidad por laboratorio y período.
- **`active_pricing`**, **`supplies_with_practices`**, **`derivations_practices`**, **`os_pricings_types`**.

> Los nombres de columna son orientativos: ante la duda, inspeccioná con `SELECT * FROM <vista> LIMIT 1`.

## RELACIONES (interno)

```
pricing.laboratory_id --> laboratories.id
reportings.practice_id --> pricing.code
reportings.os_id --> os.code
relation.practice_id --> pricing.code
relation.supplie_id --> supplies.code
client_os.practice_code --> pricing.code
client_os.os_code --> os.code
historical_ub.os_code --> os.code
practices_in_practice.practice_id / child_practice_id --> pricing.code
indirect_cost_configurations.cost_center_id --> laboratories.id
indirect_cost_configurations.indirect_cost_id --> indirect_costs.id
```

## FÓRMULAS (interno)

- Costo unitario directo: `unit_cost = SUM(supply.price / relation.incidence)` por insumo vinculado.
- Prácticas compuestas: `total_unit_cost = unit_cost_propio + SUM(unit_cost de cada child_practice)`.
- Precio de venta por OS: `precio = client_os.value * historical_ub.price`.
- Total facturado: `total_amount = billed_amount + COALESCE(counter_amount, 0)`.
- Margen: `margin = precio_venta - unit_cost`; `margin_percentage = margin / unit_cost` (0 si unit_cost = 0).
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd clonGithub/claude-agent-sdk && node --import tsx --test prompt.test.ts`
Expected: PASS — `# pass 2` `# fail 0`

- [ ] **Step 5: Make `server.ts` read `prompt.md`**

En `clonGithub/claude-agent-sdk/server.ts`, reemplazar el `buildSystemPrompt` inline (líneas 23-29):

```ts
function buildSystemPrompt(): string {
  return (
    "Eres un asistente de base de datos. Respondé en el mismo idioma en que te hablen. " +
    "No uses emojis en tus respuestas. " +
    "Laboratorios = Laboratories | Sede = headquarter"
  );
}
```

por:

```ts
const PROMPT_FILE = path.join(process.cwd(), "prompt.md");

function buildSystemPrompt(): string {
  return fs.readFileSync(PROMPT_FILE, "utf-8");
}
```

(`fs` y `path` ya están importados en `server.ts:4-5`.)

- [ ] **Step 6: Verify the server boots and serves the new prompt**

Run: `cd clonGithub/claude-agent-sdk && node --import tsx -e "import('./server.ts').then(()=>{}); setTimeout(()=>{require('http').get('http://localhost:3000/',r=>{console.log('HTTP',r.statusCode);process.exit(0)})},1500)"`
Expected: imprime `HTTP 200` sin lanzar `ENOENT` de `prompt.md`. (Requiere las env vars; si faltan, el server sale con el error de variables — en ese caso verificar solo que NO sea un error de `prompt.md`.)

- [ ] **Step 7: Commit**

```bash
cd clonGithub/claude-agent-sdk
git add prompt.md prompt.test.ts server.ts
git commit -m "feat: system prompt de cara al cliente leído desde prompt.md"
```

---

### Task 2: Emitir solo la respuesta final + errores amables

Hoy el loop hace streaming de cada bloque `assistant` (`server.ts:117-135`), lo que filtraría la narración intermedia del agente. Esta tarea extrae un helper puro que decide el texto final a partir de cada mensaje del SDK, lo testea, y reescribe el loop para emitir **solo** ese texto final.

**Files:**
- Create: `clonGithub/claude-agent-sdk/agent-output.ts`
- Create: `clonGithub/claude-agent-sdk/agent-output.test.ts`
- Modify: `clonGithub/claude-agent-sdk/server.ts:114-135` (loop de streaming) y el import de `query`/tipos.

**Interfaces:**
- Consumes: `buildSystemPrompt()` y `buildOptions()` de Task 1 / código existente.
- Produces:
  - `FRIENDLY_ERROR: string`
  - `finalAnswerFor(msg: { type: string; subtype?: string; result?: string }): string | null` — devuelve el texto final si `msg` es el `result` terminal (`success` → `msg.result`; cualquier `error_*` → `FRIENDLY_ERROR`), o `null` para mensajes intermedios que se ignoran.

- [ ] **Step 1: Write the failing test**

Crear `clonGithub/claude-agent-sdk/agent-output.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { finalAnswerFor, FRIENDLY_ERROR } from "./agent-output";

test("ignora mensajes assistant intermedios", () => {
  assert.equal(finalAnswerFor({ type: "assistant" }), null);
});

test("ignora mensajes system", () => {
  assert.equal(finalAnswerFor({ type: "system", subtype: "init" }), null);
});

test("devuelve el texto final en result success", () => {
  assert.equal(
    finalAnswerFor({ type: "result", subtype: "success", result: "El total facturado fue $1.234,56" }),
    "El total facturado fue $1.234,56"
  );
});

test("devuelve mensaje amable en result de error", () => {
  assert.equal(
    finalAnswerFor({ type: "result", subtype: "error_during_execution" }),
    FRIENDLY_ERROR
  );
  assert.equal(
    finalAnswerFor({ type: "result", subtype: "error_max_turns" }),
    FRIENDLY_ERROR
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd clonGithub/claude-agent-sdk && node --import tsx --test agent-output.test.ts`
Expected: FAIL — `Cannot find module './agent-output'`

- [ ] **Step 3: Write minimal implementation**

Crear `clonGithub/claude-agent-sdk/agent-output.ts`:

```ts
export const FRIENDLY_ERROR =
  "No pude obtener esa información en este momento. ¿Querés que lo intente de otra forma?";

type ResultLike = { type: string; subtype?: string; result?: string };

// Dado un mensaje del SDK, devuelve el texto final si es el resultado
// terminal, o null si es un mensaje intermedio que el cliente no debe ver.
export function finalAnswerFor(msg: ResultLike): string | null {
  if (msg.type !== "result") return null;
  if (msg.subtype === "success") return msg.result ?? FRIENDLY_ERROR;
  return FRIENDLY_ERROR;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd clonGithub/claude-agent-sdk && node --import tsx --test agent-output.test.ts`
Expected: PASS — `# pass 4` `# fail 0`

- [ ] **Step 5: Wire the helper into the server loop**

En `clonGithub/claude-agent-sdk/server.ts`, agregar el import junto al de `query` (línea 1):

```ts
import { query } from "@anthropic-ai/claude-agent-sdk";
import { finalAnswerFor, FRIENDLY_ERROR } from "./agent-output";
```

Reemplazar el bloque actual del loop + manejo de error (`server.ts:114-135`):

```ts
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
```

por:

```ts
  let fullResponse = FRIENDLY_ERROR;
  const requestOptions = { ...buildOptions(dbUrl), systemPrompt: buildSystemPrompt() };

  try {
    // Enfoque A: ignorar todos los mensajes intermedios (assistant, tool_use,
    // tool_result) y quedarnos solo con el texto final del mensaje `result`.
    for await (const msg of query({ prompt: fullPrompt, options: requestOptions })) {
      const final = finalAnswerFor(msg as any);
      if (final !== null) fullResponse = final;
    }
  } catch (err) {
    console.error("[agent error]", err);
    fullResponse = FRIENDLY_ERROR;
  }

  res.write(`data: ${JSON.stringify(fullResponse)}\n\n`);
```

(La línea `res.write('data: [DONE]\n\n')` y el `writeHistory(...)` que siguen quedan tal cual; `fullResponse` ya contiene la respuesta final.)

- [ ] **Step 6: Run the helper tests again to confirm no regression**

Run: `cd clonGithub/claude-agent-sdk && node --import tsx --test agent-output.test.ts prompt.test.ts`
Expected: PASS — `# pass 6` `# fail 0`

- [ ] **Step 7: Manual integration verification**

Con las env vars configuradas (`ANTHROPIC_API_KEY`, `DATABASE_URL_IACA`, `DATABASE_URL_NANNI`):

```bash
cd clonGithub/claude-agent-sdk && npm start
```

En otra terminal:

```bash
curl -sN -X POST http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"tenant":"iaca","message":"cuanto se facturo en total el ultimo periodo?"}'
```

Expected:
- Llega un único `data: "<respuesta>"` seguido de `data: [DONE]`.
- La respuesta es una conclusión en español (un monto / análisis), SIN mencionar `SELECT`, nombres de tablas/vistas, ni "consulté la base de datos".
- Verificación de fuga (debe NO imprimir nada): `... | grep -iE "select |reportings|pricing|\\bSQL\\b|tabla |query"` sobre el cuerpo de la respuesta.

- [ ] **Step 8: Commit**

```bash
cd clonGithub/claude-agent-sdk
git add agent-output.ts agent-output.test.ts server.ts
git commit -m "feat: emitir solo la respuesta final del agente + errores amables"
```

---

## Fuera de alcance (YAGNI)

- `index.ts` (CLI standalone) mantiene su prompt inline: es herramienta interna de desarrollo, no de cara al cliente. No se modifica.
- Re-chunkeo del texto final para efecto de tipeo: el indicador "escribiendo…" del frontend ya cubre la espera; se deja como mejora cosmética futura.
- `temperature`: no expuesto por el SDK v0.2.92.

## Notas de verificación contra el SDK (v0.2.92)

- `SDKResultSuccess` (`node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts:2478`) tiene `subtype: 'success'` y `result: string` con el texto final consolidado.
- `SDKResultError` tiene `subtype: 'error_during_execution' | 'error_max_turns' | 'error_max_budget_usd' | 'error_max_structured_output_retries'`.
- `Options` no incluye `temperature`.
