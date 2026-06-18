---
name: historico-precios
description: Consultas sobre evolución temporal de precios y costos: cómo cambió un precio, cuánto subió/bajó, comparar contra meses anteriores, variaciones de precio por obra social o práctica. Usar para "cómo evolucionó", "cuánto aumentó", "histórico de precios", "comparado con el mes/año pasado".
---

# Histórico de precios y costos (interno)

Para preguntas de evolución NO uses el precio actual (`pricing`); usá las tablas/vistas históricas.

## Precios de prácticas en el tiempo

- **`historical_pricing`** — `practice_id`, `practice_name`, `consumer`, `distribuitor`, `special`, `created_at`, `job_id`. Cada fila es una foto del precio en un momento.
- **`v_os_practicas_precios`** — cambios de precio por obra social y práctica ya calculados: `os_code`, `nombre_os`, `practice_code`, `practice_name`, `precio_actual`, `precio_anterior`, `fecha_ultimo_cambio`, `diferencia_precio`, `porcentaje_cambio`. La más directa para "cuánto cambió el precio".

## Costos y UB en el tiempo

- **`historical_costs`** — costos por entidad en el tiempo (`entity_id`, `type`, `price`, `created_at`).
- **`historical_ub`** — valor de la UB por obra social en el tiempo (`os_code`, `os`, `price`, `created_at`).
- **`historical_supplies`** / **`historical_relations`** — precios de insumos y relaciones práctica–insumo históricos.

## Estadísticas mensuales por OS

- **`v_os_estadisticas_mensuales`** — `os_code`, `nombre_os`, `mes`, `total_practicas_actualizadas`, `precio_promedio`, `valor_total`, `total_registros`.

## Reglas

- Para "cuánto aumentó/bajó X": preferí `v_os_practicas_precios` (ya trae diferencia y porcentaje).
- Indicá siempre el rango de fechas/períodos comparados.
