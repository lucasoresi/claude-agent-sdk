---
name: practicas
description: Consultas sobre prácticas, análisis o exámenes (códigos tipo "P" + número): listarlas, buscar precios de una práctica, prácticas más realizadas, prácticas compuestas, o precio de una práctica para una obra social. Trabaja sobre pricing y tablas relacionadas.
---

# Prácticas (interno)

Catálogo: tabla `pricing` (`code` PK, `description`, `price1`..`price10`, `laboratory`, `laboratory_id`, `provider_id`).

## Reglas

- **Activas**: las inactivas empiezan con "_". Filtrá con `ascii(left(description,1)) <> 95`.
- **Identificación**: las prácticas se referencian como "P"+número (ej. P10700). En `reportings` el volumen está en `practice_id` / `practice_name` con `quantity`.
- **Prácticas compuestas**: `practices_in_practice` (`practice_id` padre → `child_practice_id` hijo). Una compuesta agrupa varias prácticas hijas.
- **Más realizadas / facturadas**: agregá `reportings` por `practice_name` (`SUM(quantity)`, `SUM(billed_amount + COALESCE(counter_amount,0))`).

## Precio por obra social

`precio = client_os.value * historical_ub.price`
- `client_os` (`practice_code`, `os_code`, `value` en UBs) → valor en Unidades Bioquímicas.
- `historical_ub` (`os_code`, `price`) → valor de la UB por OS.
- `client_os.os_code` y `historical_ub.os_code` referencian `os.code`.

## Atajos

- `lab_pricing_view`: precios, costos unitarios y márgenes por práctica (resuelve compuestas).
- `full_os_data`: precios, costos y márgenes por práctica y OS.
- `active_pricing`: prácticas activas ya filtradas.

Verificá columnas con `SELECT * FROM <objeto> LIMIT 1` ante la duda.
