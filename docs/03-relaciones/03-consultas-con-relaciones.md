---
title: Consultas y escrituras con relaciones
sidebar_label: Consultas con relaciones
sidebar_position: 3
description: include, select anidado, filtros por relaciones, _count, escrituras anidadas y cómo aplanar la respuesta para el frontend.
---

# Consultas y escrituras con relaciones

<Tech ids={['prisma', 'nestjs']} />

<Estado tipo="construye">La ficha del pueblo trae sus fotos y la cantidad de viviendas activas; el alta de un pueblo puede crear sus fotos en la misma operación.</Estado>

## Leer relaciones

```ts
// include: todo el modelo + sus relaciones
prisma.town.findUnique({ where: { slug }, include: { photos: true } });

// select anidado: solo lo necesario (preferible)
prisma.town.findUnique({
  where: { slug },
  select: {
    slug: true,
    officialName: true,
    photos: { select: { storageKey: true, alt: true }, orderBy: { position: 'asc' }, take: 10 },
    _count: { select: { housing: { where: { expiresAt: { gt: new Date() } } } } },
  },
});
```

- Las relaciones admiten `where`, `orderBy`, `take` y `skip` adentro.
- `_count` cuenta sin traer las filas.
- `include` y `select` **no se mezclan** en el mismo nivel.

### Filtrar por relaciones

| Operador | Relación | Significa |
| --- | --- | --- |
| `some` | 1:N | Al menos un hijo cumple |
| `every` | 1:N | Todos los hijos cumplen |
| `none` | 1:N | Ningún hijo cumple |
| `is` / `isNot` | N:1, 1:1 | El padre cumple |

```ts
// Pueblos con al menos una vivienda en alquiler
prisma.town.findMany({ where: { housing: { some: { operation: 'RENT' } } } });

// Viviendas de pueblos de Aragón
prisma.housingListing.findMany({ where: { town: { is: { region: 'Aragón' } } } });
```

## Escrituras anidadas

Crear o conectar relaciones en la misma operación (Prisma lo hace en una transacción):

```ts
prisma.town.create({
  data: {
    slug: 'albarracin',
    officialName: 'Albarracín',
    country: 'ES',
    organization: { connect: { id: orgId } },                // conectar una existente
    photos: { create: [{ storageKey: 'towns/albarracin/1.jpg', position: 0 }] }, // crear hijos
  },
});

prisma.town.update({
  where: { id },
  data: {
    photos: {
      deleteMany: { id: { in: removedIds } },
      create: newPhotos,
    },
  },
});
```

Operaciones disponibles: `create`, `createMany`, `connect`, `connectOrCreate`,
`disconnect`, `set`, `update`, `updateMany`, `upsert`, `delete`, `deleteMany`.

## En ripopola: la ficha con respuesta aplanada

El frontend no necesita la forma de la base. Para la ficha quiere
`photos: string[]` (URLs) y `activeListings: number`, no `_count.housing`.
Aplanar es trabajo del backend:

```ts title="towns/town-detail.ts"
import { Prisma } from '../../generated/prisma/client';

export const TOWN_DETAIL = {
  id: true, slug: true, officialName: true, country: true, region: true,
  population: true, tags: true, description: true, details: true,
  photos: { select: { storageKey: true, alt: true }, orderBy: { position: 'asc' } },
  _count: { select: { housing: true } },
} satisfies Prisma.TownSelect;

type TownDetailRow = Prisma.TownGetPayload<{ select: typeof TOWN_DETAIL }>;

export interface TownDetail extends Omit<TownDetailRow, '_count' | 'photos'> {
  photos: { url: string; alt: unknown }[];
  housingCount: number;
}

export function toTownDetail(row: TownDetailRow, mediaUrl: (key: string) => string): TownDetail {
  const { _count, photos, ...rest } = row;
  return {
    ...rest,
    photos: photos.map((p) => ({ url: mediaUrl(p.storageKey), alt: p.alt })),
    housingCount: _count.housing,
  };
}
```

`TownDetail` va a la librería de contratos y la usan `web` y `panel`.
`mediaUrl` convierte la clave de Cloud Storage en una URL (sección 7).

<Angular>

Es la misma idea que un *adapter* o *mapper* que harías en un servicio de
Angular para convertir la respuesta de una API externa a tu modelo de vista,
solo que ahora el adaptador lo ponés vos del lado del servidor y el
frontend recibe la forma ideal.

</Angular>

<Resumen>

- `select` anidado mejor que `include`: solo lo necesario.
- `some`, `every`, `none`, `is` para filtrar por relaciones; `_count` para contar.
- Escrituras anidadas con `create`, `connect`, `deleteMany`… en una transacción.
- Aplanar en el backend: el contrato con el frontend no es la base.

</Resumen>

## Preguntas de entrevista

**1. ¿`include` o `select`?**
`select` cuando sabés qué campos necesitás: menos datos y sin exponer campos internos.

**2. ¿Cómo traés pueblos que tengan al menos una vivienda en alquiler?**
`where: { housing: { some: { operation: 'RENT' } } }`.

**3. ¿Qué son las escrituras anidadas y qué garantía dan?**
Crear, conectar o borrar relaciones en la misma operación; Prisma las ejecuta en una transacción.

**4. ¿Por qué no devolver directamente lo que da la base?**
Porque el contrato de la API debe ser estable y cómodo para el cliente, independiente de cómo se guardan los datos.
