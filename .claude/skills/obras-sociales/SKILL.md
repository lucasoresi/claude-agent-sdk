---
name: obras-sociales
description: Consultas sobre obras sociales (OS), coberturas o prepagas, ya sea para listarlas, contarlas, o medir su facturación. Usar siempre que la pregunta mencione "obra social", "obras sociales", "OS", "cobertura" o "prepaga", para no confundirlas con derivantes, laboratorios externos o particulares.
---

# Obras sociales (interno)

## Regla central

El catálogo oficial de obras sociales es la tabla `os` (columnas: `code`, `os`, `active`). **Algo es obra social solo si figura en `os`.**

La columna `os` de `reportings` es **texto libre**: mezcla obras sociales con derivantes, laboratorios externos, centros de diagnóstico, hospitales y particulares. Que un nombre facture en `reportings` NO lo convierte en obra social.

## Prohibido

- No reportes "obras sociales activas" con `COUNT(DISTINCT os)` de `reportings`: eso cuenta entidades de todo tipo.
- No uses `reportings.os_id` para clasificar/identificar obras sociales: su codificación NO coincide de forma confiable con `os.code`.

## Cómo responder bien

- Para "cuáles/cuántas obras sociales": consultá la tabla `os` (filtrá `active = true` si corresponde).
- Para "facturación por obra social": cruzá `reportings` con `os` por nombre normalizado: `lower(trim(r.os)) = lower(trim(o.os))`. Verificá cuántos nombres realmente matchean antes de concluir; los nombres en facturación suelen traer sufijos/variantes.
- Si una entidad relevante (ej. un gran facturador) NO está en `os`, decilo: es "otro (derivante / laboratorio externo / particular)", no una obra social.
- Si el catálogo no alcanza para responder con precisión, aclará el alcance de lo que mostrás.

## Relacionado

- Precio de una práctica por OS: `client_os.value * historical_ub.price` (ver skill costos-margenes / practicas).
