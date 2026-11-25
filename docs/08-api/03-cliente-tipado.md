---
title: Cliente tipado desde OpenAPI
sidebar_label: Cliente tipado
sidebar_position: 3
description: Generar tipos de TypeScript desde el openapi.json, usarlos en Next.js con openapi-fetch y comparación con compartir interfaces en el monorepo.
---

# Cliente tipado desde OpenAPI

<Tech ids={['openapiinitiative', 'nextdotjs', 'nx']} />

<Estado tipo="construye">Una librería `libs/shared/api-client` con los tipos generados de la API, que usan web y panel.</Estado>

## Dos formas de compartir el contrato

En el monorepo hay dos caminos para que el frontend sepa qué devuelve la API:

| | Interfaces compartidas en una lib | Tipos generados desde OpenAPI |
| --- | --- | --- |
| Cómo | `libs/shared/contracts` importada por api, web y panel | Se generan desde `openapi.json` |
| Fuente de verdad | La interfaz (el DTO la implementa) | Lo que realmente expone la API |
| Riesgo | Que el DTO y la respuesta real difieran | Ninguno si se regenera |
| Sirve fuera del monorepo | No | Sí (apps móviles, terceros) |

Ripopola usa **las dos**: interfaces compartidas para lo que se diseña junto
(como `Paginated` o `TownDetail`), y tipos generados como red de seguridad.
Si tuvieras que elegir una sola en una entrevista: **la generada**, porque
refleja lo que la API realmente hace.

## En ripopola

### 1. Generar los tipos

```bash
pnpm add -D -E openapi-typescript
pnpm exec openapi-typescript libs/shared/api-client/openapi.json -o libs/shared/api-client/src/schema.ts
```

Genera tipos (no código), así que no suma peso al JavaScript del navegador.

### 2. Usarlos en Next.js con openapi-fetch

```ts title="libs/shared/api-client/src/types.ts"
import type { components, paths } from './schema';

export type { paths };
export type TownDetail = components['schemas']['TownDetailDto'];
```

**openapi-fetch** es un `fetch` de 6 kB que usa esos tipos: conoce cada
ruta, sus parámetros y su respuesta, sin generar código.

```ts title="apps/web: un Server Component"
import createClient from 'openapi-fetch';
import type { paths } from '@ripopola/api-client';

const api = createClient<paths>({ baseUrl: process.env.API_INTERNAL_URL });

const { data, error } = await api.GET('/api/v1/towns/{slug}', {
  params: { path: { slug: 'albarracin' }, query: { lang: 'es' } },
});
// data: TownDetail | undefined; error: el Problem Details tipado
```

Una ruta mal escrita o un parámetro de más es un **error de compilación**.
En la sección 12 lo envolvemos para el servidor (con la cookie de sesión) y
para el navegador.

<Angular>

Es lo que hacías con `this.http.get<TownDetail>(...)`, con una diferencia:
ahí el genérico lo ponías vos y podía mentir. Acá el tipo sale de la ruta,
así que no se puede equivocar.

</Angular>

### 3. Automatizarlo con Nx

Un target en la lib:

```json title="libs/shared/api-client/project.json"
"targets": {
  "generate": {
    "command": "tsx apps/api/src/openapi.ts && openapi-typescript libs/shared/api-client/openapi.json -o libs/shared/api-client/src/schema.ts",
    "inputs": ["{workspaceRoot}/apps/api/src/**/*.ts"],
    "outputs": ["{projectRoot}/openapi.json", "{projectRoot}/src/schema.ts"]
  }
}
```

Con `inputs`/`outputs`, Nx lo cachea: solo se regenera si cambió la API.

<Alternativa title="Generadores de clientes completos">

`openapi-typescript` genera solo tipos. Otras herramientas generan también
el código de los servicios: **ng-openapi-gen** (servicios de Angular con
`HttpClient`, si algún día volvés a Angular), **openapi-generator** (el clásico, muchos lenguajes),
**Orval** y **@hey-api/openapi-ts**. Generan más, a cambio de un código menos
controlable. En equipos grandes es muy común.

</Alternativa>

<Resumen>

- El contrato se comparte con interfaces en el monorepo y con tipos generados.
- `openapi-typescript`: tipos sin peso en el bundle.
- Regenerar en CI o con un target de Nx cacheado.

</Resumen>

## Preguntas de entrevista

**1. ¿Cómo mantenés sincronizados los tipos del frontend con el backend?**
Generándolos desde la especificación OpenAPI que produce el backend, con una tarea automática y verificación en CI.

**2. En un monorepo, ¿para qué generar tipos si podés compartir interfaces?**
Porque la interfaz compartida puede no coincidir con lo que la API realmente devuelve; lo generado refleja la implementación.
