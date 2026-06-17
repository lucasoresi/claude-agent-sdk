---
name: facturacion
description: Consultas de facturación, ingresos, ventas y prestaciones del laboratorio. Usar cuando se pregunte por cuánto se facturó, totales por período o mes, facturación por sede, ranking de facturadores, cantidad de prestaciones, o el último mes cargado. Trabaja sobre la tabla reportings.
---

# Facturación (interno)

Fuente principal: tabla `reportings` (una fila por práctica facturada en un período).

Columnas clave: `billed_amount`, `counter_amount` (puede ser NULL), `quantity`, `period` (date), `headquarter` (sede, texto), `os` (entidad facturante, texto libre), `os_id`, `practice_id`, `practice_name`, `is_derivation`.

## Reglas

- **Total facturado**: `billed_amount + COALESCE(counter_amount, 0)`. No uses solo `billed_amount`.
- **Período**: formato `YYYY-MM-01` (primer día del mes). "Último mes cargado" = `(SELECT max(period) FROM reportings)`. Indicá siempre qué período usaste.
- **Por sede**: agrupá por `headquarter`. Para enriquecer (tipo de sede) cruzá con `headquarters.name`.
- **Derivaciones**: `is_derivation = true` son prestaciones tercerizadas a/desde otros laboratorios. Para "facturación propia" conviene excluirlas o reportarlas aparte; aclará el criterio usado.
- **Cantidad de prestaciones**: `SUM(quantity)`.

## Ojo (no confundir)

Los valores de `reportings.os` NO son todos obras sociales (hay derivantes, laboratorios externos, centros de diagnóstico, particulares). Si la pregunta es "por obra social", validá contra el catálogo `os` (ver skill obras-sociales).

## Atajos

- `practices_reportings_by_period`: facturación por práctica y período (ya agregada).
- `cost_center_amount_by_period`: rentabilidad por laboratorio/período.

Verificá columnas con `SELECT * FROM reportings LIMIT 1` ante la duda.
