---
name: insumos-stock
description: Consultas sobre insumos, reactivos, stock, consumo y reposición. Usar cuando se pregunte por insumos, reactivos, stock, existencias, consumo de insumos, faltantes, o umbrales de reposición. Trabaja sobre supplies y objetos relacionados.
---

# Insumos y stock (interno)

## Catálogo de insumos

- **`supplies`** — `code`, `name`, `quantity` (stock actual), `price`, `overrided_price`, `supplier`, `class`, `last_purchase`, `active`, `deprecated`, `with_iva`. Filtrá `active = true` para los vigentes.
- **`active_supplies`** / **`supplies_with_practices`** — insumos activos ya filtrados; el segundo agrega `practice_count` y `quantity_with_incoming` (stock + entrante).

## Consumo y stock en el tiempo

- **`supply_consumptions_by_period`** (vista materializada) — consumo por insumo y período: `supplie_id`, `period`, `practice_id`, `quantity_sum`, `supply_consumption`, `avg_supply_consumption`, `stock`, `name`. Úsala para "cuánto se consumió" y "consumo promedio".
- **`historical_stocks`** — evolución del stock: `supply_id`, `quantity`, `created_at`, `update_method`.

## Reposición

- **`supply_configurations`** — umbrales por insumo: `months_of_stock_remaining_threshold`, `remaining_practices_threshold`. Sirve para detectar insumos por debajo del umbral (riesgo de faltante).

## Notas

- "Stock actual" = `supplies.quantity`. "Consumo" = `supply_consumptions_by_period`.
- `purchase_requirements` (compras/órdenes) hoy está vacía; no la uses para responder.
- El costo de un insumo dentro de una práctica se maneja en la skill costos-margenes (`relation`).
