---
title: 'Paginación: offset contra cursor'
sidebar_label: Paginación
sidebar_position: 6
description: Paginación por offset y por cursor, sus costos, el orden estable y cuándo usar cada una en ripopola.
---

# Paginación: offset contra cursor

<Tech ids={['prisma', 'postgresql']} />

<Estado tipo="construye">Offset para el listado del panel (con número de página) y cursor para el scroll infinito de la web y los mensajes.</Estado>

## Las dos formas

### Offset (`skip` / `take`)

```ts
findMany({ orderBy: [{ officialName: 'asc' }, { id: 'asc' }], skip: (page - 1) * 20, take: 20 })
```

```sql
SELECT ... ORDER BY official_name, id LIMIT 20 OFFSET 400;
```

- ✅ Permite saltar a la página 37 y mostrar "página 3 de 50".
- ❌ La base **lee y descarta** todas las filas anteriores: la página 1000 es lenta.
- ❌ Si alguien inserta un pueblo mientras paginás, una fila se **repite o se saltea**.

### Cursor (keyset)

En vez de "saltá 400", decís "dame los 20 que vienen **después de este**":

```ts
findMany({
  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  take: 20,
  cursor: lastId ? { id: lastId } : undefined,
  skip: lastId ? 1 : 0, // no repetir el del cursor
})
```

- ✅ Siempre rápido (usa el índice para ir directo al punto).
- ✅ Estable aunque entren datos nuevos.
- ❌ No hay "ir a la página 37" ni total barato.

| | Offset | Cursor |
| --- | --- | --- |
| Saltar a una página | Sí | No |
| Rendimiento en páginas lejanas | Malo | Bueno |
| Estable con inserciones | No | Sí |
| Ideal para | Tablas de admin, resultados con número de página | Scroll infinito, feeds, chats, APIs públicas grandes |

## El orden estable

Paginar sin un orden **único** es un error clásico: si dos pueblos se llaman
igual, PostgreSQL puede devolverlos en cualquier orden entre una consulta y
otra. Siempre agregá un desempate único (`id`) al final del `orderBy`.

## En ripopola

### Panel: offset (ya lo tenés)

El listado de pueblos del panel usa `page` y `pageSize` con el total. Son
pocos miles de registros: offset va perfecto.

### Web: cursor para "Novedades"

```ts title="dto/cursor-query.dto.ts"
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CursorQueryDto {
  @IsOptional() @IsUUID()
  after?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number = 20;
}
```

```ts title="towns.service.ts"
async latest({ after, limit = 20 }: CursorQueryDto) {
  const items = await this.prisma.town.findMany({
    where: { status: TownStatus.PUBLISHED },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1, // uno de más para saber si hay otra página
    ...(after && { cursor: { id: after }, skip: 1 }),
    select: TOWN_SUMMARY,
  });

  const hasMore = items.length > limit;
  if (hasMore) items.pop();
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
}
```

El truco de pedir `limit + 1` evita una consulta de `count`.

<Next>

En la web, el cursor encaja directo con `useInfiniteQuery` de TanStack Query:

```ts
const query = useInfiniteQuery({
  queryKey: ['towns', filters],
  queryFn: ({ pageParam }) => fetchTowns({ ...filters, after: pageParam }),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (last) => last.nextCursor ?? undefined,   // null = no hay más
});
// cuando un IntersectionObserver ve el final de la lista: query.fetchNextPage()
```

En Angular era lo mismo a mano: `nextCursor` en un signal y concatenar.

</Next>

<Resumen>

- Offset: simple, con número de página, lento lejos y con saltos si cambian los datos.
- Cursor: rápido y estable, sin saltos de página.
- Siempre un orden único (desempate por `id`).
- `take: limit + 1` para saber si hay más.

</Resumen>

## Preguntas de entrevista

**1. ¿Por qué el `OFFSET` es lento con valores grandes?**
Porque la base tiene que recorrer y descartar todas las filas anteriores antes de devolver las que pediste.

**2. ¿Qué es la paginación por cursor?**
Pedir los registros posteriores a uno dado según un orden indexado. Es estable y de costo constante.

**3. ¿Por qué el orden tiene que ser único?**
Porque si hay empates, el orden entre consultas no está garantizado y aparecen repetidos o faltantes.

**4. ¿Cuándo usarías cada una?**
Offset para tablas con número de página y volumen moderado; cursor para feeds, scroll infinito y listas grandes.
