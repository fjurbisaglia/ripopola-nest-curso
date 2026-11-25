---
title: Seed y carga masiva
sidebar_label: Seed y carga masiva
sidebar_position: 6
description: Cargar datos de prueba con prisma db seed, inserción masiva con createMany, idempotencia y cómo importar municipios reales.
---

# Seed y carga masiva

<Tech ids={['prisma', 'postgresql', 'typescript']} />

<Estado tipo="construye">Un seed idempotente con pueblos, fotos, un ayuntamiento y usuarios de prueba, y un script para importar municipios en lote.</Estado>

## Concepto

Un **seed** carga datos iniciales: para desarrollar con algo en pantalla,
para las pruebas e2e y para demos. Reglas:

- **Idempotente**: correrlo dos veces no duplica nada (usa `upsert`).
- **Nunca en producción** con datos falsos.
- **Versionado** en el repo, como el resto del código.

El curso de referencia arma un endpoint `GET /seed` que borra y recarga
todo. **No lo hagas así**: un endpoint que borra la base es un riesgo si
llega a producción. En Prisma el seed es un **script** que corre la CLI.

## En ripopola

### 1. Configurar el comando

En `prisma.config.ts` (raíz del repo):

```ts
export default defineConfig({
  schema: 'apps/api/prisma/schema.prisma',
  migrations: {
    path: 'apps/api/prisma/migrations',
    seed: 'tsx apps/api/prisma/seed.ts',
  },
  // ...
});
```

```bash
pnpm add -D -E tsx
```

### 2. El script

```ts title="apps/api/prisma/seed.ts"
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, TownStatus } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL']! }),
});

const towns = [
  { slug: 'albarracin', officialName: 'Albarracín', country: 'ES', region: 'Aragón', province: 'Teruel', population: 1000, tags: ['montaña', 'patrimonio'] },
  { slug: 'santo-stefano-di-sessanio', officialName: 'Santo Stefano di Sessanio', country: 'IT', region: 'Abruzzo', province: "L'Aquila", population: 115, tags: ['montaña'] },
  { slug: 'alcala-del-jucar', officialName: 'Alcalá del Júcar', country: 'ES', region: 'Castilla-La Mancha', province: 'Albacete', population: 1200, tags: ['río', 'teletrabajo'] },
];

async function main() {
  for (const t of towns) {
    await prisma.town.upsert({
      where: { slug: t.slug },
      create: { ...t, status: TownStatus.PUBLISHED },
      update: t,
    });
  }

  const superadmin = await prisma.user.upsert({
    where: { email: 'admin@ripopola.test' },
    create: { email: 'admin@ripopola.test', name: 'Superadmin', platformRole: 'SUPERADMIN' },
    update: {},
  });

  console.log(`Seed listo: ${towns.length} pueblos, superadmin ${superadmin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

```bash
pnpm exec prisma db seed      # corre el seed
pnpm exec prisma migrate reset # borra, migra y corre el seed
```

:::tip Usuarios del seed con contraseña
Cuando llegues a la sección 6 (Better Auth), el superadmin necesita poder
loguearse. Se le agrega el correo verificado y una cuenta `credential` con la
contraseña hasheada por la misma función que usa Better Auth:

```ts
import { hashPassword } from 'better-auth/crypto';

const admin = await prisma.user.upsert({
  where: { email: 'admin@ripopola.test' },
  create: { email: 'admin@ripopola.test', name: 'Superadmin', emailVerified: true, platformRole: 'SUPERADMIN' },
  update: {},
});
await prisma.account.upsert({
  where: { id: admin.id }, // el id de la cuenta reutiliza el del usuario: el seed es idempotente
  create: { id: admin.id, userId: admin.id, accountId: admin.id, providerId: 'credential', password: await hashPassword('clave-de-desarrollo') },
  update: {},
});
```

Solo en local: el seed nunca crea usuarios con contraseñas conocidas en producción.
:::

### 3. Carga masiva: municipios reales

Para miles de filas, `upsert` uno por uno es lento. `createMany` inserta en
lote con un solo `INSERT`:

```ts
await prisma.town.createMany({
  data: municipios.map((m) => ({ slug: slugify(m.nombre), officialName: m.nombre, country: 'ES', population: m.habitantes })),
  skipDuplicates: true, // ON CONFLICT DO NOTHING: idempotente
});
```

Con decenas de miles, partí en lotes de ~1.000 para no armar una consulta gigante:

```ts
for (let i = 0; i < data.length; i += 1000) {
  await prisma.town.createMany({ data: data.slice(i, i + 1000), skipDuplicates: true });
}
```

Para cargas realmente grandes (millones), PostgreSQL tiene `COPY`, mucho más
rápido que cualquier `INSERT`.

:::info Fuentes de datos reales
El INE (España) e ISTAT (Italia) publican el listado oficial de municipios
con sus códigos. Antes de importarlos, revisá la licencia de cada fuente
(es una pregunta abierta de ripopola) y guardá la procedencia del dato.
:::

<Resumen>

- Seed como script (`prisma db seed`), nunca como endpoint.
- Idempotente con `upsert` o `skipDuplicates`.
- `createMany` en lotes para volumen; `COPY` para millones.

</Resumen>

## Preguntas de entrevista

**1. ¿Qué es un seed y qué características debe tener?**
Un script que carga datos iniciales; debe ser idempotente, versionado y no correr con datos falsos en producción.

**2. ¿Por qué no exponer un endpoint para resembrar la base?**
Porque si llega a producción (o alguien lo llama) borra datos reales. Es una operación de desarrollo.

**3. ¿Cómo insertás 50.000 filas de forma eficiente?**
En lotes con inserción múltiple (`createMany`), o con `COPY` si son muchísimas; nunca una por una.
