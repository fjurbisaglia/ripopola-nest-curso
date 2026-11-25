---
title: SQL crudo y TypedSQL
sidebar_position: 8
description: Cuándo bajar a SQL con Prisma, $queryRaw seguro contra inyección, Prisma.sql para armar consultas dinámicas y TypedSQL para SQL con tipos generados.
---

# SQL crudo y TypedSQL

<Tech ids={['prisma', 'postgresql']} />

<Estado tipo="construye">Una consulta de estadísticas por región con SQL crudo y la búsqueda sin tildes como TypedSQL tipado.</Estado>

## Cuándo bajar a SQL

El cliente de Prisma cubre el 90 % de los casos. Bajás a SQL cuando necesitás:

- Funciones del motor: **PostGIS**, `unaccent`, full-text search, funciones de ventana.
- Agregaciones complejas, CTE (`WITH`), reportes.
- Rendimiento fino en una consulta concreta.

Es lo que en TypeORM se haría con el **QueryBuilder** o `query()`.

## `$queryRaw` y `$executeRaw`

```ts
// Lectura: devuelve filas
const rows = await prisma.$queryRaw<{ region: string; total: bigint }[]>`
  SELECT region, count(*) AS total FROM towns WHERE country = ${country} GROUP BY region
`;

// Escritura: devuelve el número de filas afectadas
const n = await prisma.$executeRaw`UPDATE towns SET population = ${p} WHERE id = ${id}::uuid`;
```

### Por qué es seguro (y cuándo no)

Con el **template literal** (las comillas invertidas), cada `${valor}` se
envía como **parámetro** (`$1`, `$2`), nunca pegado al texto del SQL. Eso
impide la **inyección SQL**.

```ts
// ✅ Seguro: country viaja como parámetro
prisma.$queryRaw`SELECT * FROM towns WHERE country = ${country}`;

// ❌ PELIGROSO: concatenación. Si country = "ES' OR '1'='1", devuelve todo
prisma.$queryRawUnsafe(`SELECT * FROM towns WHERE country = '${country}'`);
```

:::danger Nunca `$queryRawUnsafe` con datos del usuario
Si de verdad necesitás `Unsafe` (por ejemplo, un nombre de columna dinámico),
**validá contra una lista cerrada** de valores permitidos. Los nombres de
columnas y tablas no se pueden parametrizar.
:::

### Armar consultas dinámicas: `Prisma.sql`

```ts
import { Prisma } from '../../generated/prisma/client';

const conditions: Prisma.Sql[] = [Prisma.sql`status = 'PUBLISHED'`];
if (country) conditions.push(Prisma.sql`country = ${country}`);
if (q) conditions.push(Prisma.sql`unaccent(official_name) ILIKE unaccent(${'%' + q + '%'})`);

const rows = await prisma.$queryRaw`
  SELECT id, slug, official_name FROM towns
  WHERE ${Prisma.join(conditions, ' AND ')}
  LIMIT 50
`;
```

`Prisma.sql`, `Prisma.join` y `Prisma.empty` arman fragmentos que siguen
siendo parametrizados.

### Detalles de tipos

- `count(*)` en PostgreSQL es `bigint` y llega como `BigInt` de JavaScript,
  que **no se puede serializar a JSON**. Convertilo (`Number(total)`) o
  casteá en SQL (`count(*)::int`).
- Los nombres de columna vienen como están en la base (`official_name`).
  Usá alias (`official_name AS "officialName"`) si querés camelCase.
- El tipo que ponés en `$queryRaw<T>` es **una promesa tuya**: Prisma no lo comprueba.

## TypedSQL: SQL con tipos de verdad

**TypedSQL** resuelve el último punto: escribís el SQL en un archivo `.sql`
y Prisma **genera una función tipada** a partir de él, comprobando la
consulta contra la base.

### 1. Activarlo

En el `generator` del schema: `previewFeatures = ["typedSql"]` (comprobá en la
documentación de tu versión si sigue siendo *preview*).

### 2. Escribir la consulta

```sql title="apps/api/prisma/sql/searchTownsUnaccent.sql"
-- @param {String} $1:term
-- @param {Int} $2:limit
SELECT id, slug, official_name AS "officialName", region
FROM towns
WHERE status = 'PUBLISHED'
  AND unaccent(official_name) ILIKE unaccent('%' || $1 || '%')
ORDER BY official_name
LIMIT $2;
```

### 3. Generar y usar

```bash
pnpm exec prisma generate --sql
```

```ts
import { searchTownsUnaccent } from '../../generated/prisma/sql';

const towns = await this.prisma.$queryRawTyped(searchTownsUnaccent(q, 20));
// towns: { id: string; slug: string; officialName: string; region: string | null }[]
```

`prisma generate --sql` necesita la base levantada, porque le pregunta a
PostgreSQL los tipos de cada columna.

## En ripopola: estadísticas para el panel del superadmin

```ts title="towns/towns-stats.service.ts"
@Injectable()
export class TownsStatsService {
  constructor(private readonly prisma: PrismaService) {}

  byRegion(country: string) {
    return this.prisma.$queryRaw<{ region: string; towns: number; population: number }[]>`
      SELECT coalesce(region, 'Sin región') AS region,
             count(*)::int AS towns,
             coalesce(sum(population), 0)::int AS population
      FROM towns
      WHERE country = ${country} AND status = 'PUBLISHED'
      GROUP BY 1
      ORDER BY towns DESC
    `;
  }
}
```

<Alternativa title="QueryBuilder de TypeORM, Kysely y Drizzle">

El QueryBuilder de TypeORM arma SQL con métodos encadenados
(`createQueryBuilder('t').where('t.country = :c', { c })`). **Kysely** es un
query builder con tipado excelente y se combina bien con Prisma
(`prisma-extension-kysely`). **Drizzle** es un ORM liviano cercano al SQL.
Todos parametrizan los valores: la regla de no concatenar es universal.

</Alternativa>

<Resumen>

- `$queryRaw` con template literal: parámetros, sin inyección.
- `Prisma.sql` y `Prisma.join` para SQL dinámico seguro.
- `bigint` no va a JSON: castear o convertir.
- TypedSQL genera funciones con tipos reales a partir de archivos `.sql`.

</Resumen>

## Preguntas de entrevista

**1. ¿Qué es la inyección SQL y cómo se previene?**
Meter SQL dentro de un dato para alterar la consulta. Se previene con
consultas parametrizadas, nunca concatenando valores en el texto del SQL.

**2. ¿Por qué `$queryRaw` es seguro y `$queryRawUnsafe` no?**
El primero usa un template literal que envía cada valor como parámetro; el segundo recibe un string ya armado.

**3. ¿Cómo parametrizás un nombre de columna?**
No se puede: se valida contra una lista cerrada de valores permitidos.

**4. ¿Qué aporta TypedSQL?**
Tipos generados a partir de la consulta real, validados contra la base, en vez de un tipo genérico que el desarrollador "promete".
