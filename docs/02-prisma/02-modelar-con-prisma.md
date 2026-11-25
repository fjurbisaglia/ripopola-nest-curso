---
title: Modelar con Prisma
sidebar_position: 2
description: El lenguaje del schema de Prisma, tipos, atributos, enums, arrays, JSON, nombres en snake_case y el modelo de pueblo de ripopola.
---

# Modelar con Prisma

<Tech ids={['prisma', 'postgresql']} />

<Estado tipo="construye">El modelo `Town` crece con nombres en `snake_case`, etiquetas, descripción y región. Es la base del resto del curso.</Estado>

## Concepto

El `schema.prisma` es **la fuente de verdad**: de él salen las tablas (con
migraciones) y los tipos de TypeScript (con `prisma generate`). Tiene tres bloques:

```prisma
generator client { ... }   // qué se genera (el cliente TypeScript)
datasource db { ... }      // qué base (postgresql)
model Town { ... }         // cada tabla
```

### Tipos escalares

| Prisma | PostgreSQL | TypeScript |
| --- | --- | --- |
| `String` | `text` (o `varchar(n)` con `@db.VarChar(n)`) | `string` |
| `Int` | `integer` | `number` |
| `BigInt` | `bigint` | `bigint` |
| `Float` | `double precision` | `number` |
| `Decimal` | `numeric` | `Prisma.Decimal` |
| `Boolean` | `boolean` | `boolean` |
| `DateTime` | `timestamp(3)` | `Date` |
| `Json` | `jsonb` | `JsonValue` |
| `Bytes` | `bytea` | `Uint8Array` |
| `Unsupported("geography")` | lo que digas | no se puede leer con el cliente |

:::warning Dinero
Nunca guardes dinero en `Float`: `0.1 + 0.2` no da `0.3`. Usá `Decimal` o un
`Int` con céntimos, y siempre la moneda al lado. Es una regla de la
arquitectura de ripopola.
:::

### Modificadores y atributos

- `?` opcional (`NULL` permitido); `[]` lista.
- `@id`, `@unique`, `@default(...)`, `@updatedAt`.
- `@map("columna")` y `@@map("tabla")`: nombre real en la base.
- `@db.X`: tipo nativo de PostgreSQL (`@db.Uuid`, `@db.Char(2)`, `@db.Timestamptz(3)`).
- `@@unique([a, b])`, `@@index([a])`: restricciones e índices de varias columnas.

## En ripopola: el modelo del pueblo

### 1. Decidir qué va en columnas y qué en JSON

La interfaz `Town` de `@ripopola/town` tiene muchísimas secciones (clima,
salud, transporte…). No todo merece una columna:

- **Columnas**: lo que se **filtra, ordena o relaciona** (país, región, población, publicado).
- **JSONB**: bloques que se leen enteros y casi nunca se filtran (servicios, clima, cultura).
- **Tablas aparte**: lo que tiene **identidad propia** o se lista (fotos, viviendas, empleos).

### 2. El schema

```prisma title="apps/api/prisma/schema.prisma"
enum TownStatus {
  DRAFT
  PUBLISHED
  ARCHIVED

  @@map("town_status")
}

model Town {
  id           String     @id @default(uuid(7)) @db.Uuid
  slug         String     @unique @db.VarChar(80)
  officialName String     @map("official_name") @db.VarChar(120)
  country      String     @db.Char(2)
  region       String?    @db.VarChar(80)
  province     String?    @db.VarChar(80)
  population   Int?
  status       TownStatus @default(DRAFT)
  tags         String[]   @default([])
  /// Texto del municipio por idioma: { "es": "...", "it": "..." }
  description  Json?
  /// Secciones de la ficha que no se filtran (clima, servicios...)
  details      Json       @default("{}")
  createdAt    DateTime   @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt    DateTime   @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@index([country, status])
  @@map("towns")
}
```

Qué cambió respecto del modelo de práctica:

- `published Boolean` pasa a `status` con un **enum**: un pueblo puede estar
  en borrador, publicado o archivado. Un booleano no alcanza para tres estados.
  Actualizá el servicio: `where: { status: 'PUBLISHED' }`.
- `uuid(7)`: ids ordenados por tiempo, mejores para los índices.
- `@map` / `@@map`: en TypeScript `officialName`, en la base `official_name`.
- `Timestamptz`: fechas con zona horaria (regla de ripopola: fechas en UTC).
- `tags String[]`: un array nativo de PostgreSQL (`text[]`), para etiquetas como `montaña`, `costa`, `teletrabajo`.
- `@@index([country, status])`: la consulta más común del listado (sección 9 de este capítulo).
- Los comentarios con `///` aparecen en los tipos generados.

### 3. Migrar y generar

```bash
pnpm exec prisma migrate dev --name towns_status_and_details
```

`migrate dev` genera el SQL, lo aplica y corre `generate`. Revisá el
archivo nuevo en `apps/api/prisma/migrations/`: renombrar `published` a
`status` borra la columna vieja. **Con datos reales** harías una migración en
dos pasos (agregar, copiar, borrar). Lo vemos en el próximo tema.

### 4. Usar los tipos generados

```ts
import { Prisma, Town, TownStatus } from '../../generated/prisma/client';

const where: Prisma.TownWhereInput = { status: TownStatus.PUBLISHED, tags: { has: 'teletrabajo' } };
```

Prisma genera un tipo por modelo (`Town`) y tipos de entrada para cada
operación (`TownWhereInput`, `TownCreateInput`…). Son ideales para escribir
funciones auxiliares tipadas.

### 5. JSON tipado

`Json` llega como `JsonValue`: TypeScript no sabe su forma. Lo tipamos con
las interfaces de `@ripopola/town` y **validamos al escribir** (con el DTO):

```ts
import type { TownDescription } from '@ripopola/town';

const description = town.description as TownDescription | null;
```

<Alternativa title="TypeORM y Mongoose">

En **TypeORM** el modelo es una clase con decoradores (`@Entity`, `@Column`,
`@PrimaryGeneratedColumn('uuid')`) y los arrays se declaran con
`@Column('text', { array: true })`. En **Mongoose** se define un `Schema` de
documentos. Los conceptos (tipos, únicos, índices, valores por defecto) son
los mismos; cambia dónde se escriben. Prisma los centraliza en un archivo
que leen tanto la base como TypeScript.

</Alternativa>

<Resumen>

- Columnas para lo que se filtra, JSONB para bloques de lectura, tablas para lo que tiene identidad.
- Enums para estados, `Decimal` para dinero, `Timestamptz` para fechas.
- `@map`/`@@map` para `snake_case` en la base.
- Los tipos generados (`Prisma.TownWhereInput`) hacen tipado todo el acceso a datos.

</Resumen>

## Preguntas de entrevista

**1. ¿Cuándo usarías una columna JSONB en vez de columnas o tablas?**
Para datos semiestructurados que se leen enteros y rara vez se filtran. Lo
que se filtra, ordena o relaciona va en columnas o tablas.

**2. ¿Por qué un enum y no un booleano para el estado?**
Porque hay más de dos estados posibles y el enum documenta y restringe los valores válidos.

**3. ¿Cómo guardarías precios?**
`Decimal` o enteros en la unidad menor, con la moneda en otra columna. Nunca `float`.

**4. ¿Qué hacen `@map` y `@@map`?**
Mapean el nombre del campo o del modelo a otro nombre de columna o tabla en la base.

**5. ¿Qué es schema-first?**
Que el schema es la fuente de verdad y de él se generan la base y los tipos (Prisma), frente a code-first, donde son las clases (TypeORM).
