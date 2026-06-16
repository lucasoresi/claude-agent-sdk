# Diseño: Agente analista de datos para clientes finales

**Fecha:** 2026-06-16
**Proyecto:** `clonGithub/claude-agent-sdk` (producto final)

## Objetivo

Convertir el agente actual en un agente de datos **100% orientado a clientes finales**.
El cliente debe recibir **únicamente la respuesta final** (la conclusión / el dato que
buscaba), sin ver tablas, columnas, vistas, SQL, herramientas, ni ninguna narración del
proceso por el cual el agente llegó a esa respuesta.

Internamente el agente sigue siendo un analista completo: consulta la base de datos vía
MCP y usa todo el conocimiento de dominio. Lo que cambia no es *qué sabe*, sino
*qué muestra*.

## Premisa sobre `temperature`

`temperature` **no** es la palanca para ocultar el detrás de escena. Controla la
aleatoriedad del muestreo de tokens (tono / consistencia), no si el modelo menciona
tablas o queries. La garantía de "solo respuesta final" la da la **arquitectura**
(emitir solo la salida final) reforzada por el **system prompt**. `temperature` es
secundario: si el SDK lo expone, se fija bajo (~0.2) para consistencia de tono.

## Decisiones tomadas

| Decisión | Elección |
|---|---|
| Dónde vive | `clonGithub/claude-agent-sdk` (se transforma el actual) |
| Nivel de ocultamiento | Garantía fuerte: el server filtra la salida |
| Estilo de respuesta | Analista claro y directo, español, tablas cuando aporten |
| Enfoque de filtrado | A — emitir solo el `result` final del SDK |

## Arquitectura

### 1. System prompt en dos capas

El system prompt se reescribe (archivo `prompt.md`, leído por el server en cada request,
como en `supabase-agent`) con dos capas:

**Capa B — Contrato de cara al cliente (al PRINCIPIO del prompt):**
- Rol: analista de datos que responde a clientes finales; entrega solo la conclusión.
- Prohibido mencionar: tablas, columnas, vistas, SQL, "consulté/ejecuté query",
  nombres de herramientas, el proceso, o que existe una base de datos.
- No explicar *cómo* se llegó al número; explicar *qué significa*.
- Español, tono profesional y claro. Dato/conclusión primero; tablas markdown solo si aportan.
- Sin datos o fuera de alcance → decirlo de forma amable y humana, sin tecnicismos ni
  mensajes de error crudos.
- Nunca inventar datos.

**Capa A — Conocimiento interno (material de referencia, DESPUÉS):**
Reutiliza el contenido de dominio del `prompt.md` del `supabase-agent`: glosario,
tablas, vistas precalculadas, relaciones, fórmulas de cálculo, reglas de query
(solo SELECT, preferir vistas, verificar esquema con `SELECT * ... LIMIT 1`).
Este bloque el cliente nunca lo ve; es la "cabeza" del analista.

### 2. Filtrado de salida en el server (enfoque A)

Cambio en `server.ts`, dentro del loop de `query()`:

- **Hoy:** por cada mensaje `assistant` se hace `res.write` del texto → se filtra todo
  lo intermedio (narración + posibles menciones técnicas).
- **Nuevo:** acumular el texto final y emitirlo **solo cuando llega el mensaje `result`**
  (subtype `success`). Ningún bloque `assistant` intermedio se manda al cliente, sin
  importar cuántas consultas haga el agente.
- **Efecto de tipeo (opcional/cosmético):** el texto final puede re-chunkearse en pedazos
  al escribir el SSE para simular streaming. Activable; no afecta la garantía.
- **Frontend:** muestra indicador "Analizando…" hasta el primer chunk de la respuesta final.

### 3. Manejo de errores y bordes

- Reemplazar `"[Error: el agente no pudo responder]"` por un mensaje amable, ej.:
  *"No pude obtener esa información en este momento. ¿Querés que lo intente de otra forma?"*.
- Pregunta fuera de dominio → respuesta cortés indicando que no se dispone de esos datos,
  sin revelar el motivo técnico.
- `temperature`: verificar si la versión del SDK lo expone en las opciones de `query()`.
  Si sí → fijar ~0.2. Si no → omitir; la garantía no depende de él.

### 4. Lo que NO cambia

- Multi-tenant (`iaca` / `nanni`) con `DATABASE_URL` por tenant.
- MCP Postgres por transporte stdio.
- Historial por tenant, limpiado en arranque y al cambiar de tenant.
- Modo de permisos del agente.

## Flujo de datos

```
Cliente → POST /api/chat { message, tenant }
  → server arma prompt (historial + mensaje)
  → query({ prompt, options: { ...buildOptions(dbUrl), systemPrompt(prompt.md), temperature? } })
     → agente consulta DB vía MCP (oculto)
     → mensajes assistant intermedios: IGNORADOS
  → al recibir result(success): se emite SOLO el texto final por SSE
  → cliente ve "Analizando…" y luego la respuesta final
```

## Criterios de éxito

1. El cliente nunca ve SQL, nombres de tablas/columnas/vistas ni narración de proceso.
2. Las respuestas son correctas (el conocimiento de dominio se conserva internamente).
3. Errores y preguntas fuera de alcance se comunican de forma amable, sin tecnicismos.
4. Multi-tenant y el resto de la infraestructura siguen funcionando igual.

## Fuera de alcance (YAGNI)

- Doble pasada con un segundo modelo "limpiador" (enfoque C): innecesario, doble costo/latencia.
- Cambios de UI más allá del indicador "Analizando…" y el wording de error.
- Separación de esquema por tenant en el prompt (la separación es física por `DATABASE_URL`).
