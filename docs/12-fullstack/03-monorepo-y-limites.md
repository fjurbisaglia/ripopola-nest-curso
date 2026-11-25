---
title: Contratos compartidos y límites en el monorepo Nx
sidebar_label: Monorepo y límites
sidebar_position: 3
description: Cómo organizar libs de backend, frontend y compartidas en Nx, tags y la regla enforce-module-boundaries, y nx affected en CI.
---

# Contratos compartidos y límites en el monorepo Nx

<Tech ids={['nx', 'nextdotjs', 'nestjs', 'typescript']} />

<Estado tipo="construye">El paso 7 de la inicialización de ripopola: libs por dominio con tags y reglas que impiden, por ejemplo, que Next importe código de Nest.</Estado>

## La estructura objetivo

```text
apps/
  api/                    main.ts + AppModule: solo arma las piezas
  web/  panel/            Next.js (@nx/next)
libs/
  backend/
    database/             PrismaModule      tags: scope:backend, type:data-access
    towns/                TownsModule       tags: scope:backend, type:feature
    auth/                 AuthModule        tags: scope:backend, type:feature
  frontend/
    ui/                   componentes React tags: scope:frontend, type:ui
    api/                  cliente de la API tags: scope:frontend, type:data-access
  shared/
    town/                 @ripopola/town    tags: scope:shared, type:model
    contracts/            DTOs de contrato  tags: scope:shared, type:model
    api-client/           tipos de OpenAPI  tags: scope:shared, type:model
```

Regla de la arquitectura de ripopola: **crear cada lib solo cuando tenga
contenido**. Durante el curso, el código vivió en `apps/api/src/app/...`;
cuando un dominio está estable, se mueve a su lib con
`nx g @nx/workspace:move` (o el generador de librerías de Nest).

## Las reglas: `enforce-module-boundaries`

```js title="eslint.config.mjs (raíz)"
'@nx/enforce-module-boundaries': ['error', {
  depConstraints: [
    { sourceTag: 'scope:frontend', onlyDependOnLibsWithTags: ['scope:frontend', 'scope:shared'] },
    { sourceTag: 'scope:backend',  onlyDependOnLibsWithTags: ['scope:backend', 'scope:shared'] },
    { sourceTag: 'scope:shared',   onlyDependOnLibsWithTags: ['scope:shared'] },
    { sourceTag: 'type:model',     onlyDependOnLibsWithTags: ['type:model'] },
  ],
}],
```

Con esto, `pnpm exec nx lint` falla si:

- El panel importa algo de `libs/backend` (traería Prisma al navegador).
- Una lib compartida importa React, Next o Nest.
- Hay dependencias circulares entre libs.
- Alguien importa un archivo interno de otra lib en vez de su `index.ts` (su API pública).

Es **el encapsulamiento de los módulos de Nest, llevado al nivel del repositorio**.

## Qué va en `shared`

| Sí | No |
| --- | --- |
| Interfaces y tipos (`Town`, `Paginated`, `TownDetail`) | DTOs con decoradores de class-validator |
| Enums y constantes de negocio (`SUPPORTED_COUNTRIES`) | Código de React, Next o Nest |
| Funciones puras sin dependencias (`slugify`) | Acceso a datos |

## Servidor y cliente dentro del frontend

Con Next aparece un límite más, **dentro** de `scope:frontend`: código que
solo puede correr en el servidor de Next (lee cookies, conoce
`API_INTERNAL_URL`) y código que va al navegador. Nx no lo distingue; lo
hacen dos paquetes:

- **`server-only`**: importado en `libs/frontend/api/src/server.ts`, hace
  fallar el build si un Client Component lo importa.
- **`client-only`**: lo inverso, para código que usa `window` o el
  cliente de Socket.IO.

Exportá los dos mundos por **puntos de entrada separados**
(`@ripopola/frontend-api/server` y `@ripopola/frontend-api/browser`) para
que importar uno no arrastre el otro.

## `nx affected`

En un monorepo, no hace falta probar todo en cada cambio. Nx sabe qué
proyectos dependen de qué (el **grafo**, `pnpm exec nx graph`):

```bash
pnpm exec nx affected -t lint test build --base=origin/main
```

Si cambiaste solo `libs/backend/towns`, corre las pruebas de esa lib y de la
API, no las de web ni panel. Con la caché de Nx, lo que no cambió ni se reejecuta.

<Resumen>

- Libs por scope (backend, frontend, shared) y tipo, con tags.
- `enforce-module-boundaries` impide importaciones prohibidas y ciclos.
- En `shared` solo tipos y funciones puras.
- `nx affected` + caché para CI rápido.

</Resumen>

## Preguntas de entrevista

**1. ¿Qué ventajas tiene un monorepo para un full stack?**
Contratos y tipos compartidos, cambios atómicos entre frontend y backend, herramientas comunes y CI que solo construye lo afectado.

**2. ¿Cómo evitás que el frontend importe código del backend en un monorepo?**
Con tags en los proyectos y reglas de límites (`enforce-module-boundaries` de Nx) verificadas en el lint.

**3. ¿Qué es `nx affected`?**
Ejecutar tareas solo en los proyectos afectados por los cambios, según el grafo de dependencias.
