---
title: Pueblos cerca de un punto y dentro del mapa
sidebar_label: Búsquedas geográficas
sidebar_position: 3
description: ST_DWithin, ST_Distance, búsqueda por bounding box y el operador KNN para encontrar pueblos cercanos y pintarlos en MapLibre.
---

# Pueblos cerca de un punto y dentro del mapa

<Tech ids={['postgresql', 'nestjs', 'maplibre', 'nextdotjs']} />

<Estado tipo="construye">Dos endpoints que son el corazón de la búsqueda de ripopola: pueblos a menos de X km de un lugar, y pueblos dentro de lo que se ve en el mapa.</Estado>

## Las funciones clave

| Función | Para qué | Usa el índice GiST |
| --- | --- | --- |
| `ST_DWithin(a, b, metros)` | ¿Están a menos de X metros? | **Sí** |
| `ST_Distance(a, b)` | Distancia en metros | No (calculala solo para los resultados) |
| `a <-> b` | Ordenar por cercanía (KNN) | **Sí** |
| `ST_MakeEnvelope(oeste, sur, este, norte, 4326)` | Rectángulo del mapa | — |
| `a && b` | ¿Se superponen sus rectángulos? | **Sí** |
| `ST_Intersects(a, b)` | ¿Se tocan? | Sí |

:::danger El error clásico
`WHERE ST_Distance(location, punto) < 50000` **no usa el índice**: calcula la
distancia a todos los pueblos. Siempre `ST_DWithin` para filtrar y
`ST_Distance` solo para mostrar.
:::

## En ripopola

### 1. Pueblos cerca de un punto

"Quiero vivir a menos de 40 km de Teruel":

```ts title="towns/geo/town-geo.repository.ts"
nearby(lng: number, lat: number, radiusKm: number, limit = 50) {
  return this.prisma.$queryRaw<{ id: string; slug: string; officialName: string; distanceKm: number }[]>`
    WITH origin AS (
      SELECT ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography AS g
    )
    SELECT t.id, t.slug, t.official_name AS "officialName",
           round((ST_Distance(t.location, origin.g) / 1000)::numeric, 1)::float AS "distanceKm"
    FROM towns t, origin
    WHERE t.status = 'PUBLISHED'
      AND ST_DWithin(t.location, origin.g, ${radiusKm * 1000})
    ORDER BY t.location <-> origin.g
    LIMIT ${limit}
  `;
}
```

El DTO:

```ts title="towns/dto/nearby-query.dto.ts"
export class NearbyQueryDto {
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180)
  lng!: number;

  @Type(() => Number) @IsNumber() @Min(-90) @Max(90)
  lat!: number;

  @Type(() => Number) @IsInt() @Min(1) @Max(200)
  radiusKm: number = 50;
}
```

Y la ruta, **antes** de `:slug` (¿te acordás del orden de rutas?):

```ts
@Get('nearby')
nearby(@Query() q: NearbyQueryDto) {
  return this.townsService.nearby(q);
}
```

### 2. Pueblos dentro del mapa (bounding box)

Cuando el usuario mueve el mapa, el frontend manda el rectángulo visible:
`?bbox=oeste,sur,este,norte`.

```ts
inBbox([w, s, e, n]: [number, number, number, number]) {
  return this.prisma.$queryRaw<{ id: string; slug: string; name: string; geojson: string }[]>`
    SELECT id, slug, official_name AS name, ST_AsGeoJSON(location, 5) AS geojson
    FROM towns
    WHERE status = 'PUBLISHED'
      AND location && ST_MakeEnvelope(${w}, ${s}, ${e}, ${n}, 4326)::geography
    LIMIT 500
  `;
}
```

Y se devuelve como **FeatureCollection**, listo para MapLibre:

```ts
toFeatureCollection(rows: { id: string; slug: string; name: string; geojson: string }[]) {
  return {
    type: 'FeatureCollection',
    features: rows.map((r) => ({
      type: 'Feature',
      id: r.id,
      geometry: JSON.parse(r.geojson),
      properties: { slug: r.slug, name: r.name },
    })),
  };
}
```

:::tip El límite
Con todo el mapa de Europa visible serían miles de pueblos. `LIMIT 500` y, en
el frontend, **clustering** de MapLibre (agrupar puntos cercanos). Con
muchos más datos, se pasa a *vector tiles* generados por PostGIS (`ST_AsMVT`).
:::

### 3. ¿En qué pueblo está este punto?

Con los límites municipales cargados:

```sql
SELECT slug FROM towns WHERE ST_Intersects(boundary, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography);
```

Útil para "estás en…" o para asignar una vivienda a su pueblo a partir de su dirección.

<Next>

```tsx
// Componente del mapa en la web ('use client'), con react-map-gl + maplibre-gl
const [bbox, setBbox] = useState<[number, number, number, number]>();
const debouncedBbox = useDebouncedValue(bbox, 300);          // no pedir por cada píxel
const { data } = useQuery({
  queryKey: ['towns-map', debouncedBbox],
  queryFn: () => fetchTownsInBbox(debouncedBbox!),          // GET /api/v1/towns/map?bbox=...
  enabled: !!debouncedBbox,
  placeholderData: keepPreviousData,                        // que los puntos no parpadeen
});

<Map onMoveEnd={(e) => { const b = e.target.getBounds(); setBbox([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]); }}>
  <Source id="towns" type="geojson" data={data}>
    <Layer type="circle" paint={{ 'circle-radius': 6, 'circle-color': '#e0234e' }} />
  </Source>
</Map>
```

En Angular lo resolvías con `debounceTime` de RxJS o un `resource()` con
señales; acá, un valor con *debounce* y la clave de la consulta de TanStack Query.

</Next>

<Resumen>

- Filtrar con `ST_DWithin` (usa índice), mostrar con `ST_Distance`.
- Ordenar por cercanía con `<->`.
- Bounding box con `&&` y `ST_MakeEnvelope`.
- Devolver FeatureCollection para el mapa, con límite y clustering.

</Resumen>

## Preguntas de entrevista

**1. ¿Cómo buscás los puntos a menos de X km de forma eficiente en PostGIS?**
Con `ST_DWithin` sobre `geography`, que usa el índice GiST. No con `ST_Distance` en el `WHERE`.

**2. ¿Qué es una búsqueda KNN?**
Los K vecinos más cercanos; en PostGIS se ordena con el operador `<->`, que usa el índice.

**3. ¿Cómo cargarías en un mapa solo lo visible?**
El cliente manda el bounding box y el backend filtra con `&&` y `ST_MakeEnvelope`, con un límite y clustering en el cliente.

**4. ¿Qué harías si son cientos de miles de puntos?**
Vector tiles (`ST_AsMVT`) servidos por teselas, con caché.
