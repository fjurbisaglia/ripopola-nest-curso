---
title: Lógica antes de guardar y Client Extensions
sidebar_label: Lógica antes de guardar
sidebar_position: 7
description: Generar el slug automáticamente, normalizar datos y dónde poner esa lógica, con Prisma Client Extensions como equivalente a los hooks BeforeInsert de TypeORM.
---

# Lógica antes de guardar y Client Extensions

<Tech ids={['prisma', 'nestjs']} />

<Estado tipo="construye">El slug del pueblo se genera solo a partir del nombre oficial, sin tildes y sin repetirse.</Estado>

## El problema

Al crear un pueblo, no queremos que el panel tenga que inventar el slug.
"Santo Stefano di Sessanio" tiene que dar `santo-stefano-di-sessanio`, y
"Albarracín" `albarracin`. Si ya existe, `albarracin-2`.

En el curso de referencia esto se hace con `@BeforeInsert()` de TypeORM, un
método de la entidad que corre antes de guardar. Prisma no tiene hooks en
el modelo. Hay dos lugares posibles, y el primero es casi siempre el mejor.

## Opción 1: en el servicio (la recomendada)

### 1. Una función pura para el slug

```ts title="apps/api/src/app/common/slugify.ts"
export function slugify(text: string): string {
  return text
    .normalize('NFD')                 // separa letras y tildes: "í" → "i" + "´"
    .replace(/[̀-ͯ]/g, '')  // borra las tildes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')      // todo lo que no es letra o número → guion
    .replace(/^-+|-+$/g, '')          // sin guiones al principio ni al final
    .slice(0, 80);
}
```

```ts title="slugify.spec.ts"
it.each([
  ['Albarracín', 'albarracin'],
  ['Santo Stefano di Sessanio', 'santo-stefano-di-sessanio'],
  ["L'Aquila", 'l-aquila'],
])('%s → %s', (input, expected) => expect(slugify(input)).toBe(expected));
```

### 2. Usarla al crear, con slug único

```ts title="towns.service.ts"
async create(dto: CreateTownDto) {
  const slug = await this.uniqueSlug(dto.slug ?? slugify(dto.officialName));
  return this.prisma.town.create({ data: { ...dto, slug }, select: TOWN_SUMMARY });
}

private async uniqueSlug(base: string): Promise<string> {
  const taken = await this.prisma.town.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  const used = new Set(taken.map((t) => t.slug));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
```

Y en el DTO, `slug` pasa a ser opcional (`@IsOptional()`).

Por qué en el servicio:

- **Es explícito**: leyendo `create` ves todo lo que pasa.
- **Se prueba fácil**.
- Las reglas de negocio quedan en la capa de negocio, no escondidas en la base de datos.

Como siempre, la restricción `@unique` en la base sigue siendo la garantía
final ante dos creaciones simultáneas (el filtro devuelve 409).

## Opción 2: Prisma Client Extensions

Las **extensions** (`$extends`) permiten modificar el cliente: agregar
métodos a un modelo, campos calculados al resultado o **interceptar
consultas**. Son lo más parecido a un hook:

```ts title="prisma.service.ts (ejemplo)"
const extended = new PrismaClient({ adapter }).$extends({
  query: {
    town: {
      async create({ args, query }) {
        args.data.officialName = args.data.officialName.trim();
        return query(args);
      },
    },
  },
  result: {
    town: {
      // campo calculado, no se guarda
      url: {
        needs: { slug: true },
        compute: (town) => `/pueblos/${town.slug}`,
      },
    },
  },
});
```

Cuándo sí usarlas: cosas **transversales y técnicas** que tienen que pasar
siempre, se use el servicio que se use: auditoría, borrado lógico (sección
3), filtros por municipio (multi-tenancy, sección 15) o métricas.

:::warning Extensions y `extends PrismaClient`
Una extension devuelve un **cliente nuevo** con otro tipo, así que no encaja
directo con `class PrismaService extends PrismaClient`. El patrón en Nest es
un provider con `useFactory` que devuelve el cliente extendido y un token
propio. Lo armamos cuando haga falta de verdad (multi-tenancy).
:::

<Alternativa title="Hooks de TypeORM y middleware de Mongoose">

TypeORM tiene `@BeforeInsert`, `@BeforeUpdate`, `@AfterLoad` en la entidad y
*subscribers* globales. Mongoose tiene `schema.pre('save')`. Son cómodos,
pero esconden lógica de negocio dentro del modelo, y en TypeORM solo corren
con `save()`, no con `update()` ni con el QueryBuilder: una fuente clásica
de bugs. Prisma eligió no tenerlos (los *middlewares* `$use` de versiones
viejas se eliminaron en favor de las extensions).

</Alternativa>

<Resumen>

- La lógica de negocio antes de guardar va en el servicio.
- Funciones puras (como `slugify`) se prueban solas.
- Client Extensions para lo transversal: auditoría, borrado lógico, tenant.
- La base sigue garantizando la unicidad.

</Resumen>

## Preguntas de entrevista

**1. ¿Dónde pondrías la generación de un slug?**
En el servicio, con una función pura probada, y una restricción única en la base como garantía final.

**2. ¿Qué son las Prisma Client Extensions?**
Una forma de extender el cliente: agregar métodos, campos calculados o interceptar consultas de un modelo.

**3. ¿Qué problema tienen los hooks de entidad de TypeORM?**
Esconden lógica y no se ejecutan en todas las operaciones (por ejemplo, `update` o el QueryBuilder no disparan `@BeforeUpdate`).

**4. ¿Qué hace `normalize('NFD')`?**
Descompone los caracteres acentuados en letra base más marca diacrítica, para poder borrar las tildes.
