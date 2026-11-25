---
title: Manejo de errores y filtros de excepciones
sidebar_label: Manejo de errores
sidebar_position: 7
description: Excepciones HTTP de Nest, el formato de la respuesta de error, filtros de excepciones y cómo convertir los errores de Prisma en 404 y 409 en ripopola.
---

# Manejo de errores y filtros de excepciones

<Tech ids={['nestjs','prisma']} />

<Estado tipo="construye">Un filtro global que convierte los errores de Prisma en 404 y 409.</Estado>

## Concepto

### La capa de excepciones de Nest

Nest tiene una **capa de excepciones** que atrapa todo error que no manejaste
y lo convierte en una respuesta HTTP:

- Si es una **`HttpException`** (o una hija, como `NotFoundException`), responde
  con su código y su mensaje.
- Si es **cualquier otra cosa** (un `TypeError`, un error de Prisma), responde
  **500** con un mensaje genérico, **sin detalles internos**:

```json
{ "statusCode": 500, "message": "Internal server error" }
```

Eso es bueno: nunca hay que mandarle al cliente un stack trace ni el SQL que falló.

### Excepciones HTTP incorporadas

| Excepción | Código | En ripopola |
| --- | --- | --- |
| `BadRequestException` | 400 | Datos inválidos (lo tira `ValidationPipe`). |
| `UnauthorizedException` | 401 | No hay sesión o el token no sirve. |
| `ForbiddenException` | 403 | Hay sesión pero no permiso (un municipio editando otro pueblo). |
| `NotFoundException` | 404 | El pueblo no existe o no está publicado. |
| `ConflictException` | 409 | Ya existe un pueblo con ese slug. |
| `UnprocessableEntityException` | 422 | Datos bien formados pero que no tienen sentido para el negocio. |
| `ServiceUnavailableException` | 503 | La base no responde (el health check). |

Se usan así:

```ts
throw new NotFoundException(`No existe el pueblo "${slug}"`);
```

Y responden con este formato:

```json
{ "message": "No existe el pueblo \"tornavacas\"", "error": "Not Found", "statusCode": 404 }
```

:::tip 401 contra 403
**401** es "no sé quién sos" (falta autenticarse). **403** es "sé quién sos y
no podés". Es una pregunta clásica de entrevista.
:::

### Filtros de excepciones

Un **filtro de excepciones** (`ExceptionFilter`) te deja tomar el control de
cómo se responde a un tipo de error. Se marca con `@Catch(TipoDeError)` y
recibe la excepción y un `ArgumentsHost`, que da acceso al request y al response.

Sirve para:

- Traducir errores de librerías (Prisma) a errores HTTP con sentido.
- Unificar el formato de los errores de toda la API.
- Registrar (loguear) los errores inesperados en un solo lugar.

### Dónde va cada cosa

- El **servicio** tira la excepción que corresponde cuando conoce la regla de
  negocio ("no está publicado" es 404).
- El **filtro** traduce errores **técnicos** que no querés manejar en cada
  servicio (violación de unicidad, registro inexistente).

## En ripopola

### 1. El problema

Creá dos pueblos con el mismo slug. El segundo `POST` responde **500**. Lo
que pasó: Prisma tiró un `PrismaClientKnownRequestError` con código `P2002`
(violación de restricción única) y Nest, como no es una `HttpException`, lo
convirtió en un error genérico.

Lo mismo con `PATCH /api/towns/:id` de un id que no existe: Prisma tira `P2025`
(registro no encontrado) y el cliente recibe 500 cuando debería recibir 404.

Los códigos de Prisma que más vas a ver:

| Código | Significa | HTTP |
| --- | --- | --- |
| `P2002` | Ya existe un valor en un campo único. | 409 |
| `P2025` | El registro a editar o borrar no existe. | 404 |
| `P2003` | Falla una clave foránea (el pueblo de una vivienda no existe). | 409 o 400 |

### 2. El filtro de Prisma

```bash
pnpm exec nx g @nx/nest:filter apps/api/src/app/prisma/prisma-exception --dry-run
```

`apps/api/src/app/prisma/prisma-exception.filter.ts`:

```ts
import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const http = this.toHttp(exception);

    if (http.getStatus() >= 500) {
      // Solo en el log del servidor, nunca en la respuesta
      this.logger.error(`Prisma ${exception.code}: ${exception.message}`);
    }

    response.status(http.getStatus()).json(http.getResponse());
  }

  private toHttp(exception: Prisma.PrismaClientKnownRequestError): HttpException {
    switch (exception.code) {
      case 'P2002':
        return new ConflictException('Ya existe un registro con ese valor único');
      case 'P2025':
        return new NotFoundException('El registro no existe');
      default:
        return new InternalServerErrorException();
    }
  }
}
```

Qué mirar:

- `@Catch(Prisma.PrismaClientKnownRequestError)`: solo atrapa ese tipo. El
  resto de los errores sigue el camino normal.
- `host.switchToHttp()`: Nest también sirve para WebSockets y microservicios;
  acá decimos que estamos en HTTP y pedimos el `Response` de Express.
- `http.getResponse()` devuelve el mismo formato `message`/`error`/`statusCode`
  que el resto de la API. Así el frontend maneja todos los errores igual.
- Los detalles técnicos van al **log**, no al cliente.

### 3. Registrarlo para toda la API

En `AppModule`, igual que el pipe global:

```ts
import { APP_FILTER } from '@nestjs/core';
import { PrismaExceptionFilter } from './prisma/prisma-exception.filter';

providers: [
  { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  // ...el APP_PIPE del tema anterior
],
```

También se puede aplicar a un controlador o a un método con `@UseFilters(PrismaExceptionFilter)`.

### 4. Un mensaje más claro donde importa

El filtro da un mensaje genérico. Donde el usuario necesita algo concreto, el
servicio puede atrapar el caso y tirar su propia excepción:

```ts
async create(dto: CreateTownDto) {
  const exists = await this.prisma.town.findUnique({ where: { slug: dto.slug } });
  if (exists) {
    throw new ConflictException(`Ya existe un pueblo con el slug "${dto.slug}"`);
  }
  return this.prisma.town.create({ data: dto });
}
```

Ojo: entre el `findUnique` y el `create` otra petición puede crear el mismo
slug (una **condición de carrera**). Por eso igual hace falta la restricción
`@unique` en la base y el filtro como red de seguridad: **la base es la que
garantiza la unicidad**, el chequeo previo solo mejora el mensaje.

### 5. Probarlo

```bash
# Dos veces el mismo POST: el segundo responde 409
curl -i -X POST http://localhost:3000/api/towns \
  -H 'Content-Type: application/json' \
  -d '{"slug":"albarracin","officialName":"Albarracín","country":"ES"}'

# Un id que no existe: 404
curl -i -X PATCH http://localhost:3000/api/towns/00000000-0000-4000-8000-000000000000 \
  -H 'Content-Type: application/json' -d '{"population":1000}'
```

## Errores comunes

- **El filtro no atrapa nada**: no está registrado, o el tipo en `@Catch()` no
  coincide (por ejemplo, importaste `Prisma` de otro lugar que el cliente generado).
- **Un filtro con `@Catch()` vacío** atrapa **todo**, incluidas las
  `HttpException`. Si lo hacés, manejá también esas o vas a romper los 404 y 400.
- **Mandar `exception.message` de Prisma al cliente**: filtra nombres de
  tablas y columnas. Al log, no a la respuesta.
- **`try/catch` en cada método del controlador**: duplica lógica. Para eso están los filtros.

## Preguntas de entrevista

**1. ¿Qué pasa en Nest si un error no es una `HttpException`?**
La capa de excepciones lo atrapa y responde 500 con un mensaje genérico, sin
detalles internos.

**2. ¿Qué es un exception filter y para qué lo usarías?**
Una clase con `@Catch()` que controla la respuesta para ciertos errores. Para
traducir errores de librerías a HTTP, unificar el formato y loguear en un solo lugar.

**3. ¿Diferencia entre 401 y 403?**
401: no autenticado (no sé quién sos). 403: autenticado pero sin permiso.

**4. ¿Qué código devolvés si se intenta crear un recurso con un campo único repetido?**
409 Conflict.

**5. ¿Alcanza con buscar antes de insertar para evitar duplicados?**
No: entre la búsqueda y la inserción otra petición puede insertar el mismo
valor (condición de carrera). Hace falta una restricción única en la base;
la búsqueda previa solo mejora el mensaje.

**6. ¿Qué es `ArgumentsHost`?**
Un objeto que da acceso a los argumentos del contexto actual. Con
`switchToHttp()` obtenés el request y el response; también existe para
WebSockets y microservicios.

**7. ¿Qué información nunca devolverías en un error?**
Stack traces, SQL, nombres de tablas, rutas del servidor, secretos. Eso va al log.

## Glosario

| Término | Qué es |
| --- | --- |
| `HttpException` | Excepción de Nest que se convierte en una respuesta HTTP. |
| Exception filter | Clase que decide cómo responder a ciertos errores. |
| `ArgumentsHost` | Acceso al request y response del contexto actual. |
| `P2002` / `P2025` | Códigos de Prisma: valor único repetido / registro inexistente. |
| Condición de carrera | Dos operaciones concurrentes que se pisan. |
