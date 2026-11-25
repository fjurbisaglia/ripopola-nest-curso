---
title: Cómo usar esta guía
sidebar_label: Introducción
sidebar_position: 1
slug: /
description: Para qué sirve esta guía, cómo está armada y el ejemplo de ripopola que recorre todos los temas.
---

# Cómo usar esta guía

Esta guía es para aprender NestJS y backend **construyendo ripopola**, y para
que te quede como material de repaso antes de una entrevista. No reemplaza a
la documentación oficial: la sigue, la ordena y la aterriza en un proyecto real.

## Cómo está armado cada tema

1. **Concepto**: qué es, qué problema resuelve y cómo encaja en Nest.
2. **Si venís de Angular**: muchas ideas de Nest salen de Angular. Cuando
   ayuda, se compara con lo que ya conocés. Y cuando el tema toca el
   frontend de ripopola, un bloque **En el frontend (Next.js)** muestra cómo
   se usa del otro lado.
3. **En ripopola**: paso a paso, con el código y qué hace cada parte.
4. **Errores comunes**: lo que suele fallar y cómo darte cuenta.
5. **Preguntas de entrevista**: con respuestas cortas, para decirlas en voz alta.
6. **Glosario**: los términos nuevos del tema.

:::tip Cómo estudiarlo
Leé el concepto, escribí vos el código en ripopola (sin copiar y pegar si
podés), rompelo a propósito para ver el error, y al final tapá las respuestas
de las preguntas de entrevista e intentá contestarlas.
:::

## El punto de partida

Lo que ya existe en ripopola (ver la guía *Conectar la API con PostgreSQL y Prisma*
en el repo de ripopola):

- Monorepo **Nx 24** con la API **NestJS 11** en `apps/api`. Las apps `web` y
  `panel` se generaron en Angular al inicio, pero el frontend de ripopola va
  a ser **Next.js**: se rehacen con `@nx/next` cuando termines el backend
  (ver la sección 12).
- **PostgreSQL 18 + PostGIS** en Docker y **Prisma 7.10.1** con `PrismaService` y `PrismaModule` (global).
- Un endpoint `GET /api/health` que consulta la base.
- La librería de interfaces `@ripopola/town` (`libs/shared/town`), que describe un pueblo.

## El ejemplo que recorre la guía: el módulo de pueblos

Para que todos los temas se conecten, vamos a ir armando de a poco un
**módulo de pueblos** (`TownsModule`) en la API. Al final de los fundamentos va a tener:

| Método | Ruta | Qué hace | Quién puede |
| --- | --- | --- | --- |
| `GET` | `/api/towns` | Lista pueblos publicados, con filtros y paginación | Cualquiera |
| `GET` | `/api/towns/:slug` | Ficha de un pueblo | Cualquiera |
| `POST` | `/api/towns` | Crea un pueblo | Superadmin |
| `PATCH` | `/api/towns/:id` | Edita datos del pueblo | Superadmin o su municipio |
| `DELETE` | `/api/towns/:id` | Borra un pueblo | Superadmin |

Cada tema le agrega una pieza: el módulo, el controlador, el servicio, la
validación de los datos de entrada, los errores, la autorización, etc.

### El modelo de práctica en Prisma

El modelo real del pueblo (con todo lo de `@ripopola/town`, traducciones y
PostGIS) se diseña aparte. Para estudiar alcanza con uno mínimo. Si lo querés
probar, agregalo a `apps/api/prisma/schema.prisma` en una rama de práctica:

```prisma
model Town {
  id           String   @id @default(uuid()) @db.Uuid
  slug         String   @unique
  officialName String
  country      String   @db.Char(2) // código ISO: "ES", "IT"
  population   Int?
  published    Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("towns")
}
```

Y después:

```bash
pnpm exec prisma migrate dev --name practice_towns
pnpm exec prisma generate
```

:::warning Rama de práctica
Hacé los ejercicios en una rama aparte (por ejemplo `estudio/nest-fundamentos`).
Así no mezclás el modelo de práctica con el diseño real del pueblo.
:::

## Fuentes

- Documentación oficial de NestJS: https://docs.nestjs.com
- Documentación de Prisma: https://www.prisma.io/docs
- Los temas siguen el orden de un curso de NestJS, pero el contenido es propio.
