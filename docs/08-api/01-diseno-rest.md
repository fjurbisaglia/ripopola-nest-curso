---
title: Diseño de una API REST profesional
sidebar_label: Diseño REST y versionado
sidebar_position: 1
description: Convenciones de rutas, códigos de estado, formato de errores con Problem Details (RFC 9457), versionado con Nest, idempotencia y compatibilidad.
---

# Diseño de una API REST profesional

<Tech ids={['nestjs', 'openapiinitiative']} />

<Estado tipo="construye">Las convenciones de la API de ripopola: rutas, errores con un formato estándar y versionado `/api/v1`.</Estado>

## Convenciones de ripopola

| Tema | Regla | Ejemplo |
| --- | --- | --- |
| Recursos | Sustantivos en plural, en inglés, kebab-case | `/towns`, `/housing-listings` |
| Jerarquía | Solo cuando el hijo no existe sin el padre | `/towns/:id/photos` |
| Acciones | `POST` a un sub-recurso verbal | `/towns/:id/publish` |
| Filtros | Query string | `?country=ES&tags=montaña` |
| Paginación | `page`/`pageSize` (offset) o `after`/`limit` (cursor) | |
| Fechas | ISO 8601 en UTC | `2026-11-24T14:00:00.000Z` |
| JSON | camelCase | `officialName` |
| Dinero | Entero en céntimos + moneda | `{ "priceCents": 45000, "currency": "EUR" }` |

## Códigos de estado que usamos

| Código | Cuándo |
| --- | --- |
| 200 OK | Lectura o edición con cuerpo |
| 201 Created | Creación (con el recurso creado) |
| 202 Accepted | Aceptado para procesar en segundo plano (traducciones) |
| 204 No Content | Éxito sin cuerpo (borrar, `PUT` de ubicación) |
| 400 Bad Request | Datos inválidos |
| 401 / 403 | Sin autenticar / sin permiso |
| 404 Not Found | No existe (o no lo podés ver) |
| 409 Conflict | Duplicado o versión desactualizada |
| 422 Unprocessable Content | Bien formado pero viola una regla de negocio |
| 429 Too Many Requests | Rate limit |
| 500 / 503 | Error nuestro / dependencia caída |

## Errores con un formato estándar: Problem Details

Hasta ahora devolvemos el formato por defecto de Nest
(`statusCode`, `message`, `error`). Existe un estándar, **RFC 9457 Problem
Details** (`application/problem+json`), que entienden muchas herramientas:

```json
{
  "type": "https://ripopola.com/errors/validation",
  "title": "Datos inválidos",
  "status": 400,
  "detail": "Hay 2 campos con errores",
  "instance": "/api/v1/towns",
  "requestId": "9b1d0c…",
  "errors": [{ "field": "country", "message": "country must be one of: ES, IT" }]
}
```

### Un filtro global que lo arma

```ts title="common/problem-details.filter.ts"
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const body = exception instanceof HttpException ? exception.getResponse() : null;
    const messages = typeof body === 'object' && body && 'message' in body ? (body as { message: unknown }).message : undefined;

    if (status >= 500) this.logger.error(exception);

    res.status(status).type('application/problem+json').json({
      type: 'about:blank',
      title: HttpStatus[status] ?? 'Error',
      status,
      detail: status >= 500 ? 'Error interno' : Array.isArray(messages) ? undefined : messages,
      errors: Array.isArray(messages) ? messages : undefined,
      instance: req.originalUrl,
      requestId: req.headers['x-request-id'],
    });
  }
}
```

Con `@Catch()` vacío atrapa **todo**, así que maneja tanto las
`HttpException` como los errores inesperados. El filtro de Prisma, más
específico, sigue convirtiendo P2002/P2025 antes.

:::tip Contrato con el frontend
Lo importante no es el formato exacto sino que **todos los errores tengan la
misma forma**. Así el panel tiene un solo lugar que los muestra (una clase `ApiError` en Next, sección 12).
:::

## Versionado

Algún día vas a necesitar cambiar algo de forma incompatible (renombrar un
campo, cambiar una respuesta). Con versionado, la v1 sigue funcionando
mientras los clientes migran a la v2. Nest lo trae:

```ts title="main.ts"
import { VersioningType } from '@nestjs/common';

app.setGlobalPrefix('api');
app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
// Rutas: /api/v1/towns
```

```ts
@Controller({ path: 'towns', version: '2' })
export class TownsV2Controller { ... }

// O por método
@Version('2')
@Get(':slug')
findOneV2() { ... }
```

Tipos: `URI` (`/v1/`, el más común y visible), `HEADER`, `MEDIA_TYPE`
(`Accept: application/json;v=2`) y `CUSTOM`.

:::warning Excluir el health check
`/api/health` no necesita versión. Con `VERSION_NEUTRAL` en ese controlador sigue funcionando sin `/v1`.
:::

### Qué cambios rompen y cuáles no

| Compatible (no hace falta versión nueva) | Incompatible (versión nueva) |
| --- | --- |
| Agregar un campo a la respuesta | Quitar o renombrar un campo |
| Agregar un endpoint | Cambiar el tipo de un campo |
| Agregar un parámetro opcional | Hacer obligatorio un parámetro |
| Agregar un valor a un enum (con cuidado) | Cambiar el significado de un código |

En un monorepo donde vos controlás web, panel y API, se despliegan juntos y
muchas veces no hace falta una v2. El versionado importa cuando hay
**clientes que no controlás** (apps móviles viejas, integraciones de terceros).

## Idempotencia en `POST`

Si el panel manda un `POST` y se corta la conexión, ¿se creó o no? Reintentar
podría duplicar. La técnica estándar (la usa Stripe): el cliente manda una
cabecera `Idempotency-Key` con un UUID; el servidor guarda la respuesta de
esa clave y, si la recibe de nuevo, devuelve la misma sin volver a crear.
Útil para pagos (la suscripción premium de los municipios).

<Resumen>

- Rutas con sustantivos, acciones como sub-recursos, códigos precisos.
- Un solo formato de error para toda la API (Problem Details).
- Versionado por URI; solo cambios incompatibles requieren versión nueva.
- `Idempotency-Key` para `POST` reintentables.

</Resumen>

## Preguntas de entrevista

**1. ¿Qué es RFC 9457?**
El estándar Problem Details para devolver errores HTTP en JSON con `type`, `title`, `status`, `detail` e `instance`.

**2. ¿Cómo versionás una API en Nest?**
`app.enableVersioning` con tipo URI, header o media type, y `version` en controladores o `@Version()` en métodos.

**3. ¿Qué cambios son compatibles hacia atrás?**
Agregar campos, endpoints o parámetros opcionales. Quitar, renombrar o cambiar tipos no.

**4. ¿Cómo hacés idempotente un `POST`?**
Con una clave de idempotencia enviada por el cliente; el servidor guarda el resultado por clave y lo repite ante reintentos.

**5. ¿Cuándo usarías 422 en vez de 400?**
400 para datos mal formados o que no pasan la validación; 422 cuando son válidos en forma pero violan una regla de negocio.
