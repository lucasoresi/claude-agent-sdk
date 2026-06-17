---
name: costos-margenes
description: Consultas sobre costos, márgenes, rentabilidad o ganancia: costo unitario de una práctica, incidencia de insumos, costos indirectos, márgenes por práctica/obra social/laboratorio. Usar cuando se pregunte por costo, margen, rentabilidad, ganancia o insumos.
---

# Costos y márgenes (interno)

## Costo directo

`unit_cost` de una práctica = suma, por cada insumo vinculado, de `supplies.price / relation.incidence`.
- `relation` (`practice_id` → `pricing.code`, `supplie_id` → `supplies.code`, `incidence`).
- `supplies` (`code`, `name`, `price`, `overrided_price`, `quantity`, `supplier`).
- Prácticas compuestas: `costo_total = costo_propio + SUM(costo de cada práctica hija)` (ver `practices_in_practice`).

## Costos indirectos

- `indirect_costs` (`description`, `amount`, `cc_distribution_method`).
- `indirect_cost_configurations` distribuye indirectos por laboratorio (`cost_center_id` → `laboratories.id`, `distribution_percentage`).

## Margen

- Precio de venta por OS: `client_os.value * historical_ub.price`.
- `margin = precio_venta - unit_cost`; `margin_porcentaje = margin / unit_cost` (0 si `unit_cost = 0`).

## Atajos (preferir cuando existan)

- `lab_pricing_view`: precios, costos unitarios y márgenes por práctica/laboratorio (resuelve compuestas). La más útil para rentabilidad por práctica.
- `full_os_data`: precios, costos y márgenes por práctica y OS.
- `cost_center_amount_by_period`: rentabilidad por laboratorio y período.

Verificá existencia de vistas con information_schema y columnas con `SELECT * FROM <objeto> LIMIT 1`.
