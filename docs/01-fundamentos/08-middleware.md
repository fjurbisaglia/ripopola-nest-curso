---
title: Middleware
sidebar_position: 8
description: Qué es un middleware en Nest, cuándo usarlo en vez de un guard o un interceptor, y un middleware de request id para la API de ripopola.
---

# Middleware

<Tech ids={['nestjs','express']} />

<Estado tipo="construye">Helmet y el middleware de request id.</Estado>

## Concepto

Un **middleware** es una función que se ejecuta **antes** de que Nest decida
qué controlador atiende la petición. Recibe `req`, `res` y `next`, y puede:

- Leer o modificar el request y el response.
- Cortar la petición respondiendo él mismo.
- Llamar a `next()` para pasar al siguiente paso.

Es el mismo concepto que el middleware de Express (de hecho, en Nest con
Express, los middleware de Express funcionan tal cual).

```
Petición ─▶ middleware 1 ─▶ middleware 2 ─▶ (guards, interceptors, pipes) ─▶ controlador
```

### Middleware contra el resto

El middleware es el primero en ejecutarse, pero **no sabe qué controlador ni
qué método** va a atender la petición. Eso define para qué sirve:

| Necesito… | Uso |
| --- | --- |
| Algo general de HTTP (cabeceras, CORS, seguridad, request id, logs de acceso) | Middleware |
| Decidir si la petición puede seguir según el usuario y la ruta | Guard |
| Hacer algo antes **y después** del controlador, o cambiar la respuesta | Interceptor |
| Validar o transformar un parámetro | Pipe |

### Dos formas de escribirlo

- **Clase** con `@Injectable()` que implementa `NestMiddleware`: puede recibir dependencias.
- **Función** común `(req, res, next) => ...`: más simple, sin dependencias.

Los middleware se registran en un módulo que implementa `NestModule`, con
`configure(consumer)`, o globalmente con `app.use()` en `main.ts`.

<Angular>

No hay un equivalente exacto. Lo más parecido es un `HttpInterceptor` que
solo actúa a la ida, pero del lado del servidor.

</Angular>


## En ripopola

### 1. Middleware de seguridad listos: Helmet

[Helmet](https://helmetjs.github.io/) agrega cabeceras HTTP de seguridad
(contra clickjacking, sniffing de tipos, etc.). Es un middleware de Express
que se usa directo:

```bash
pnpm add -E helmet
```

En `main.ts`:

```ts
import helmet from 'helmet';

const app = await NestFactory.create(AppModule);
app.use(helmet());
```

### 2. Un middleware propio: request id

Cuando algo falla en producción, querés encontrar **todas las líneas de log
de una misma petición**. Para eso cada petición lleva un identificador: si el
cliente (o el balanceador de Cloud Run) ya manda uno en la cabecera
`x-request-id`, se usa ese; si no, se genera.

```bash
pnpm exec nx g @nx/nest:middleware apps/api/src/app/common/request-id --dry-run
```

`apps/api/src/app/common/request-id.middleware.ts`:

```ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.header(REQUEST_ID_HEADER);
    const id = incoming && incoming.length <= 100 ? incoming : randomUUID();

    req.headers[REQUEST_ID_HEADER] = id; // para leerlo después en logs
    res.setHeader(REQUEST_ID_HEADER, id); // el cliente lo ve en la respuesta
    next();
  }
}
```

Qué mirar:

- Si no llamás a `next()` (ni respondés), la petición **queda colgada**.
- El largo se limita: un valor que viene del cliente nunca se usa sin revisar.
- `node:crypto` ya viene con Node; no hace falta instalar nada.

### 3. Registrarlo

En `AppModule`:

```ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { RequestIdMiddleware } from './common/request-id.middleware';

@Module({ /* imports, controllers, providers como antes */ })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
```

`forRoutes` acepta rutas (`'towns'`), controladores (`TownsController`) o
`'*'` para todas. Con `.exclude('health')` podés dejar afuera alguna.

### 4. Probarlo

```bash
curl -i http://localhost:3000/api/towns
# x-request-id: 9b1d... (generado)

curl -i -H 'x-request-id: prueba-123' http://localhost:3000/api/towns
# x-request-id: prueba-123
```

En el tema de interceptors lo usamos para loguear cada petición con su id y su duración.

## Errores comunes

- **La petición nunca responde**: falta `next()`.
- **El middleware no corre**: el módulo no implementa `NestModule`, o la ruta de `forRoutes` no coincide.
- **Querés saber el usuario o el método del controlador en un middleware**:
  todavía no lo sabe. Usá un guard o un interceptor.
- **Middleware de Express con Fastify**: no todos son compatibles. Ripopola usa Express.

## Preguntas de entrevista

**1. ¿Qué es un middleware en Nest?**
Una función que se ejecuta antes del ruteo, con acceso a request, response y
`next()`. Puede modificar la petición, responder o pasar al siguiente.

**2. ¿Diferencia entre middleware y guard?**
El middleware no sabe qué controlador ni método se va a ejecutar; el guard
sí (tiene el `ExecutionContext`). Por eso la autorización va en guards.

**3. ¿Cómo registrás un middleware?**
En un módulo que implementa `NestModule`, con `consumer.apply(...).forRoutes(...)`,
o global con `app.use()` en `main.ts`.

**4. ¿Qué es un request id y para qué sirve?**
Un identificador único por petición que se propaga a los logs y a la
respuesta, para rastrear todo lo que pasó en una petición concreta.

**5. ¿Qué middleware de seguridad pondrías en una API?**
Helmet para cabeceras de seguridad, CORS restringido a los orígenes propios y,
según el caso, límite de tamaño del body y rate limiting.

## Glosario

| Término | Qué es |
| --- | --- |
| Middleware | Función que corre antes del ruteo, con `req`, `res` y `next`. |
| `next()` | Pasa la petición al siguiente paso. |
| Request id | Identificador único de cada petición, para rastrearla en los logs. |
| Helmet | Middleware que agrega cabeceras de seguridad HTTP. |
