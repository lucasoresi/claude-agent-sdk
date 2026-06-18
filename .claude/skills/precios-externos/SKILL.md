---
name: precios-externos
description: Consultas que comparan precios propios contra proveedores o fuentes externas: qué tan caro/barato está algo respecto del mercado, diferencias de precio con proveedores, precios de fuentes externas. Usar para "comparar con proveedores", "precio de mercado", "diferencia con la fuente externa".
---

# Precios externos / comparación (interno)

## Comparación lista

- **`external_prices_comparison_view`** — compara precio propio vs fuente externa por práctica: `code`, `description`, `laboratory`, `practice_id`, `source`, `period`, `source_period`, `client_special_price`, `client_distribuitor_price`, `source_price`, `special_price_difference`, `special_price_difference_percentage`, `distribuitor_price_difference`, `distribuitor_price_difference_percentage`, `unit_cost`. Es la vía directa para "¿cómo estoy contra el mercado?".

## Precios de proveedores en el tiempo

- **`historical_providers_pricings`** — precios de insumos por proveedor: `provider_id`, `provider_description`, `supply_description`, `supply_code`, `price`, `period`.
- **`historical_practice_providers_pricings`** — precios de prácticas por proveedor: `provider_description`, `practice_description`, `practice_code`, `price`, `period`.

## Mapeos (códigos propios ↔ externos)

- **`providers_practices_mapping`** / **`providers_supplies_mapping`** — `provider_id`, `provider_code`, `client_code`.
- **`sources_codes_mapping`** — `source_id`, `client_code`, `code`.

## Notas

- `external_cost` casi no tiene datos; preferí `external_prices_comparison_view`.
- Diferencia positiva = el precio propio está por encima de la fuente; negativa = por debajo. Aclará el sentido al responder.
