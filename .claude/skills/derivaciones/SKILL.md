---
name: derivaciones
description: Consultas sobre derivaciones y derivantes (prestaciones tercerizadas a/desde otro laboratorio o profesional). Usar cuando se pregunte por derivantes, derivaciones, prestaciones derivadas, convenios de derivación, o facturación/márgenes de derivaciones.
---

# Derivaciones (interno)

Un **derivante** NO es una obra social ni un laboratorio propio: es un tercero (profesional, clínica u otro lab) al que se le deriva o desde el que se recibe trabajo.

## Dónde está cada cosa

- **`conventions`** — catálogo/convenio del derivante: `code`, `description` (nombre), `pricing_type`, `original_pricing_type`, `factor`. Acá está "registrado" el derivante con su tipo de arancel.
- **`reportings`** — facturación; las filas con `is_derivation = true` son derivaciones. El nombre del derivante está en la columna de texto libre `os`.
- **`report_derivantes`** (vista materializada, detallada por período/derivante/práctica): `period`, `os` (derivante), `practice_name`, `quantity`, `total_amount`, `margin`, `margin_percentage`, `unit_price`, variaciones vs período anterior y año anterior (`price_lp_variance`, `demand_ly_variance_percentage`, etc.), `price_elasticity`.
- **`report_derivantes_compact`** — resumen por `period` + `os`: `total_sum_quantity`, `total_sum_amount`, `avg_margin`, `avg_margin_percentage`. Ideal para totales rápidos por derivante.
- **`derivations_practices`** (vista materializada) — por práctica/período, separa lo "special" de lo "derivation": cantidades, montos, precios unitarios y variaciones.

## Reglas

- Para rankings/totales de derivantes por mes, preferí `report_derivantes_compact`.
- Para análisis fino (margen, elasticidad, variación de precio/demanda), usá `report_derivantes`.
- No mezcles derivaciones con facturación a obras sociales: son cosas distintas. Si te piden "facturación de obras sociales", excluí `is_derivation = true` o reportalo aparte.
- El campo `os` en estos objetos es texto libre (nombre del derivante), no el catálogo `os`.
