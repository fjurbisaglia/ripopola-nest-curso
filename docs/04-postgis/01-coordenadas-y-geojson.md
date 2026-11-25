---
title: Coordenadas, SRID y GeoJSON
sidebar_position: 1
description: Lo básico de datos geográficos para un backend - WGS84, SRID 4326, geometry contra geography, GeoJSON y cómo modelarlo en Prisma con PostGIS.
---

# Coordenadas, SRID y GeoJSON

<Tech ids={['postgresql', 'prisma', 'maplibre']} />

<Estado tipo="construye">Columnas geográficas en el pueblo: su ubicación (punto) y su término municipal (multipolígono), con índices espaciales.</Estado>

## Concepto

### Coordenadas y SRID

Una coordenada es un par **longitud, latitud** en grados. Pero los grados
no significan nada sin un **sistema de referencia**: el que usa el GPS y
todos los mapas web es **WGS84**, identificado como **SRID 4326**.

:::warning Longitud primero
En GeoJSON y PostGIS el orden es **`[lng, lat]`** (x, y). Google Maps
muestra "lat, lng". Confundirlo pone Albarracín en el océano Índico. Es el
error más común con datos geográficos.
:::

### `geometry` contra `geography`

PostGIS tiene dos tipos:

| | `geometry` | `geography` |
| --- | --- | --- |
| Calcula sobre | Un plano | La esfera terrestre |
| Distancias en SRID 4326 | En grados (inútil) | En **metros** |
| Funciones disponibles | Todas | Las principales |
| Velocidad | Más rápido | Un poco más lento |

Para ripopola (distancias en km entre pueblos, "a menos de 50 km de…"),
**`geography`** es lo más simple y correcto.

### GeoJSON

El formato estándar (RFC 7946) para intercambiar geometrías. Es lo que
entiende MapLibre en el frontend y lo que usa `@ripopola/town`:

```json
{ "type": "Point", "coordinates": [-1.4436, 40.4078] }
```

```json
{ "type": "MultiPolygon", "coordinates": [[[[-1.5, 40.3], [-1.3, 40.3], [-1.3, 40.5], [-1.5, 40.3]]]] }
```

Y un `FeatureCollection` agrupa geometrías con propiedades: es lo que se
manda a un mapa para pintar muchos pueblos.

## En ripopola: modelar la ubicación

Prisma no conoce los tipos de PostGIS, así que se declaran como `Unsupported`:

```prisma title="schema.prisma"
model Town {
  // ...
  location Unsupported("geography(Point, 4326)")?
  boundary Unsupported("geography(MultiPolygon, 4326)")?

  @@index([location], type: Gist)
}
```

Consecuencias de `Unsupported`:

- La migración crea la columna correcta.
- **El cliente de Prisma no puede leerla ni escribirla**: esos campos no
  aparecen en los tipos. Se usan con `$queryRaw` / `$executeRaw` (próximo tema).
- `@@index(..., type: Gist)` crea el **índice espacial** (GiST), sin el cual
  toda búsqueda geográfica recorre la tabla entera.

```bash
pnpm exec prisma migrate dev --name town_location
```

Revisá el SQL: tiene que decir `geography(Point,4326)` y `USING GIST`.

<Next>

En el frontend, MapLibre recibe GeoJSON tal cual (con react-map-gl,
`<Source type="geojson" data={featureCollection} />`). Si el backend ya
devuelve GeoJSON, no hay ninguna conversión en el front.

</Next>

<Resumen>

- SRID 4326 = WGS84 = GPS. Orden `[lng, lat]`.
- `geography` para distancias en metros.
- GeoJSON es el formato de intercambio.
- En Prisma: `Unsupported(...)` + índice GiST + SQL crudo.

</Resumen>

## Preguntas de entrevista

**1. ¿Qué es un SRID y cuál usa el GPS?**
El identificador del sistema de referencia de las coordenadas. El GPS usa WGS84, SRID 4326.

**2. ¿Diferencia entre `geometry` y `geography` en PostGIS?**
`geometry` calcula en un plano; `geography` sobre la esfera y devuelve distancias en metros.

**3. ¿Qué índice usás para datos espaciales?**
GiST.

**4. ¿En qué orden van las coordenadas en GeoJSON?**
Longitud, latitud.
