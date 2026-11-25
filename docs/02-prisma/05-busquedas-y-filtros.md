---
title: Búsquedas y filtros
sidebar_position: 5
description: Buscar por slug o UUID, filtros combinados, arrays, texto sin distinguir mayúsculas ni tildes y búsqueda de texto completo en PostgreSQL.
---

# Búsquedas y filtros

<Tech ids={['prisma', 'postgresql']} />

<Estado tipo="construye">El buscador del listado de pueblos: por nombre (con o sin tildes), región, rango de población y etiquetas, y la ficha accesible por slug o por id.</Estado>

## Los operadores de Prisma

```ts
where: {
  country: 'ES',                                   // igual
  population: { gte: 500, lte: 5000 },             // rango
  region: { in: ['Aragón', 'Abruzzo'] },           // uno de varios
  officialName: { contains: 'alba', mode: 'insensitive' }, // ILIKE '%alba%'
  tags: { hasSome: ['montaña', 'teletrabajo'] },   // arrays: has, hasEvery, hasSome, isEmpty
  description: { not: Prisma.DbNull },             // JSON no nulo
  OR: [{ region: 'Aragón' }, { province: 'Teruel' }],
  NOT: { status: 'ARCHIVED' },
}
```

Un valor `undefined` **se ignora**: es lo que permite armar filtros opcionales
sin `if`. Un valor `null` **sí filtra** (`IS NULL`). Cuidado con esa diferencia.

## En ripopola

### 1. Ampliar el DTO de búsqueda

```ts title="dto/list-towns-query.dto.ts"
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListTownsQueryDto {
  @IsOptional() @IsString() @MaxLength(60)
  q?: string;

  @IsOptional() @IsIn(['ES', 'IT'])
  country?: string;

  @IsOptional() @IsString() @MaxLength(80)
  region?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  minPopulation?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  maxPopulation?: number;

  // ?tags=montaña,teletrabajo → ['montaña', 'teletrabajo']
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  @IsString({ each: true }) @ArrayMaxSize(10)
  tags?: string[];

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize?: number = 20;
}
```

### 2. Armar el `where` en una función aparte

```ts title="towns/town-filters.ts"
import { Prisma, TownStatus } from '../../generated/prisma/client';
import { ListTownsQueryDto } from './dto/list-towns-query.dto';

export function buildTownWhere(q: ListTownsQueryDto): Prisma.TownWhereInput {
  return {
    status: TownStatus.PUBLISHED,
    country: q.country,
    region: q.region,
    population:
      q.minPopulation !== undefined || q.maxPopulation !== undefined
        ? { gte: q.minPopulation, lte: q.maxPopulation }
        : undefined,
    tags: q.tags?.length ? { hasEvery: q.tags } : undefined,
    officialName: q.q ? { contains: q.q, mode: 'insensitive' } : undefined,
  };
}
```

Separarlo tiene dos ventajas: el servicio queda corto y la función se prueba
sola, sin base, con tests muy simples.

### 3. Por slug o por UUID

El panel trabaja con ids y la web con slugs. Un solo endpoint puede aceptar los dos:

```ts
import { isUUID } from 'class-validator';

findByTerm(term: string) {
  const where = isUUID(term) ? { id: term } : { slug: term.toLowerCase() };
  return this.prisma.town.findFirst({ where: { ...where, status: TownStatus.PUBLISHED } });
}
```

:::tip ¿Uno o dos endpoints?
Para una API pública es más claro tener **una forma canónica** (el slug para
la web) y dejar el id para las rutas del panel. Mostramos el truco porque
aparece en el curso de referencia y en muchos proyectos, pero no abuses.
:::

### 4. Tildes: "Albarracin" tiene que encontrar "Albarracín"

`mode: 'insensitive'` ignora mayúsculas, **no tildes**. PostgreSQL tiene la
extensión `unaccent`. Se habilita en una migración:

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
```

Y como Prisma no la conoce, la búsqueda por nombre va con SQL (próximos temas):

```ts
const ids = await this.prisma.$queryRaw<{ id: string }[]>`
  SELECT id FROM towns
  WHERE status = 'PUBLISHED'
    AND unaccent(official_name) ILIKE unaccent(${'%' + q + '%'})
  LIMIT 50
`;
```

### 5. Búsqueda de texto completo (concepto)

Para buscar dentro de descripciones largas ("pueblo con escuela y fibra"),
`ILIKE` no alcanza ni escala. PostgreSQL trae **full-text search**:
`to_tsvector('spanish', texto) @@ plainto_tsquery('spanish', 'escuela fibra')`,
con índices GIN y ranking. Más adelante, ripopola sumaría búsqueda semántica
con **pgvector** (embeddings) en la misma base. Elasticsearch, Meilisearch o
Algolia son las alternativas externas del mercado.

<Resumen>

- `undefined` se ignora, `null` filtra: así se arman filtros opcionales.
- Arrays con `has`, `hasSome`, `hasEvery`.
- `insensitive` no quita tildes: `unaccent` sí.
- El `where` en una función pura es fácil de probar.

</Resumen>

## Preguntas de entrevista

**1. ¿Cómo armás un filtro con parámetros opcionales en Prisma?**
Pasando `undefined` en los que no vienen: Prisma los ignora. `null` en cambio filtra por `IS NULL`.

**2. ¿Cómo harías una búsqueda que ignore tildes en PostgreSQL?**
Con la extensión `unaccent` aplicada a la columna y al término, idealmente con un índice de expresión.

**3. ¿`ILIKE '%x%'` usa índices?**
Un índice B-tree normal no. Hace falta un índice trigram (`pg_trgm`, GIN) o full-text search.

**4. ¿Cuándo pasarías a un motor de búsqueda externo?**
Cuando necesitás relevancia avanzada, tolerancia a errores de tipeo, facetas a gran escala o el volumen supera lo razonable para PostgreSQL. Antes, full-text search y pg_trgm suelen alcanzar.
