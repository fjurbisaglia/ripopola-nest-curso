---
title: Leer y escribir datos geográficos con Prisma
sidebar_label: Leer y escribir geografía
sidebar_position: 2
description: Un repositorio de geografía con $queryRaw, ST_GeomFromGeoJSON y ST_AsGeoJSON, validación de GeoJSON en DTOs y cómo encapsular PostGIS en ripopola.
---

# Leer y escribir datos geográficos con Prisma

<Tech ids={['postgresql', 'prisma', 'nestjs']} />

<Estado tipo="construye">Un `TownGeoRepository` que encapsula todo el SQL de PostGIS, y el endpoint para que el superadmin cargue la ubicación de un pueblo.</Estado>

## La idea: encapsular el SQL geográfico

Como el cliente de Prisma no ve las columnas geográficas, todo el SQL de
PostGIS va en **una sola clase**. El resto de la app no sabe que existe
PostGIS: recibe y entrega GeoJSON. Es el patrón **repositorio** aplicado a
la parte que el ORM no cubre.

## En ripopola

### 1. Los tipos

```ts title="towns/geo/geojson.ts"
export interface GeoPoint {
  type: 'Point';
  coordinates: [lng: number, lat: number];
}

export interface GeoMultiPolygon {
  type: 'MultiPolygon';
  coordinates: number[][][][];
}
```

(En ripopola ya existen en `@ripopola/town`, en `common/geo.ts`: usá esos.)

### 2. El repositorio

```ts title="towns/geo/town-geo.repository.ts"
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { GeoMultiPolygon, GeoPoint } from './geojson';

@Injectable()
export class TownGeoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async setLocation(townId: string, point: GeoPoint): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE towns
      SET location = ST_GeomFromGeoJSON(${JSON.stringify(point)})::geography
      WHERE id = ${townId}::uuid
    `;
  }

  async setBoundary(townId: string, boundary: GeoMultiPolygon): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE towns
      SET boundary = ST_Multi(ST_MakeValid(ST_GeomFromGeoJSON(${JSON.stringify(boundary)})))::geography
      WHERE id = ${townId}::uuid
    `;
  }

  async getLocation(townId: string): Promise<GeoPoint | null> {
    const [row] = await this.prisma.$queryRaw<{ geojson: string | null }[]>`
      SELECT ST_AsGeoJSON(location, 6) AS geojson FROM towns WHERE id = ${townId}::uuid
    `;
    return row?.geojson ? (JSON.parse(row.geojson) as GeoPoint) : null;
  }
}
```

Qué mirar:

- `ST_GeomFromGeoJSON` convierte el texto GeoJSON en geometría; `::geography` la pasa al tipo de la columna.
- `ST_AsGeoJSON(location, 6)` devuelve texto GeoJSON con 6 decimales (~10 cm: de sobra).
- `ST_MakeValid` arregla polígonos mal formados (pasa con datos oficiales) y `ST_Multi` asegura que sea multipolígono.
- El GeoJSON viaja **como parámetro**: sin inyección SQL.
- `::uuid` castea el texto del parámetro al tipo de la columna.

### 3. Validar el GeoJSON que llega

```ts title="towns/dto/set-location.dto.ts"
import { ArrayMaxSize, ArrayMinSize, Equals, IsArray, IsNumber, Max, Min } from 'class-validator';

export class SetLocationDto {
  @Equals('Point')
  type!: 'Point';

  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  coordinates!: [number, number];
}
```

Y en el servicio, el rango (los decoradores no saben que el primero es longitud):

```ts
const [lng, lat] = dto.coordinates;
if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
  throw new BadRequestException('Coordenadas fuera de rango: el orden es [longitud, latitud]');
}
```

### 4. El endpoint

```ts
@Put(':id/location')
@HttpCode(204)
async setLocation(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetLocationDto) {
  await this.townsService.setLocation(id, dto);
}
```

`PUT` porque **reemplaza** la ubicación entera, y es idempotente.

### 5. Leer la ficha con su ubicación

La ficha junta dos fuentes: el cliente de Prisma para los datos y el
repositorio para la geografía. Se pueden pedir **en paralelo**:

```ts
const [town, location] = await Promise.all([
  this.prisma.town.findFirst({ where: { slug, status: 'PUBLISHED' }, select: TOWN_DETAIL }),
  this.geo.getLocationBySlug(slug),
]);
```

## Alternativas para no escribir SQL

- **Columnas `lat` y `lng` como `Float`** además de la geografía: el cliente
  las lee sin SQL, pero hay que mantener las dos sincronizadas (con un
  trigger o en el servicio). Útil si solo necesitás mostrar el punto.
- **Una vista** con `ST_AsGeoJSON(location)` como texto, mapeada en Prisma como `view` (preview feature).
- **TypedSQL** (sección 2): el mismo SQL, pero con tipos generados. Buen siguiente paso.

<Resumen>

- Todo el SQL de PostGIS en un repositorio; afuera solo GeoJSON.
- `ST_GeomFromGeoJSON` para escribir, `ST_AsGeoJSON` para leer.
- Validar forma y rango de las coordenadas.
- Consultas independientes en paralelo con `Promise.all`.

</Resumen>

## Preguntas de entrevista

**1. ¿Cómo integrás una función que tu ORM no soporta?**
Con SQL parametrizado encapsulado en un repositorio o adaptador, para que el resto del código no dependa de ese detalle.

**2. ¿Qué es el patrón repositorio?**
Una clase que abstrae el acceso a datos de un agregado, ofreciendo métodos de dominio en vez de consultas.

**3. ¿Por qué `PUT` y no `PATCH` para la ubicación?**
Porque se reemplaza el recurso completo (el punto) y la operación es idempotente.
