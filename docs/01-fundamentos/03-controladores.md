---
title: Controladores
sidebar_position: 3
description: Rutas, métodos HTTP, parámetros, query, body y códigos de estado en Nest, armando el TownsController de ripopola.
---

# Controladores

<Tech ids={['nestjs','express']} />

<Estado tipo="construye">El `TownsController` con las rutas de pueblos.</Estado>

## Concepto

Un **controlador** recibe las peticiones HTTP y devuelve la respuesta. Su
trabajo es solo de **entrada y salida**: leer lo que llega (ruta, query,
body), llamar al servicio que corresponde y devolver el resultado. La lógica
de negocio **no va en el controlador**, va en los servicios.

```
GET /api/towns/albarracin
     │    │       └─ parámetro de ruta (:slug)
     │    └─ ruta del controlador (@Controller('towns'))
     └─ prefijo global (main.ts)
```

### Decoradores principales

| Decorador | Para qué |
| --- | --- |
| `@Controller('towns')` | Marca la clase y fija la ruta base. |
| `@Get()`, `@Post()`, `@Patch()`, `@Put()`, `@Delete()` | Método HTTP y subruta. |
| `@Param('slug')` | Un parámetro de la ruta (`/towns/:slug`). |
| `@Query('country')` | Un parámetro de la query (`?country=ES`). |
| `@Body()` | El cuerpo de la petición (JSON). |
| `@Headers('accept-language')` | Una cabecera. |
| `@HttpCode(204)` | Cambia el código de estado de la respuesta. |
| `@Header('Cache-Control', '...')` | Agrega una cabecera a la respuesta. |

### Qué devuelve un controlador

- Si devolvés un objeto o un array, Nest lo convierte a **JSON** solo.
- Si devolvés una **Promise** o un **Observable**, Nest espera el resultado.
- Código de estado por defecto: **200**, salvo `POST`, que es **201**.

### ¿Y `@Req()` y `@Res()`?

Existen y te dan el objeto de Express. Pero si inyectás `@Res()`, **Nest deja
de manejar la respuesta**: tenés que llamar vos a `res.json()`, y se pierden
los interceptors y la serialización automática. Evitalo. Si de verdad
necesitás tocar la respuesta (por ejemplo una cookie), usá
`@Res({ passthrough: true })`, que te da el objeto pero deja que Nest siga
mandando lo que devolvés.

### REST en dos minutos

Un endpoint REST usa **sustantivos** en la ruta y el **método** dice la acción:

| Acción | Método | Ruta | Código si sale bien |
| --- | --- | --- | --- |
| Listar | `GET` | `/towns` | 200 |
| Ver uno | `GET` | `/towns/:slug` | 200 |
| Crear | `POST` | `/towns` | 201 |
| Editar una parte | `PATCH` | `/towns/:id` | 200 |
| Reemplazar entero | `PUT` | `/towns/:id` | 200 |
| Borrar | `DELETE` | `/towns/:id` | 204 (sin cuerpo) |

`GET`, `PUT` y `DELETE` son **idempotentes**: repetirlos deja el mismo
resultado. `POST` no (dos `POST` crean dos pueblos).

<Angular>

Un controlador es como un componente **sin plantilla**: recibe entradas (en
vez de `@Input`, `@Param`/`@Query`/`@Body`), delega en servicios inyectados,
y "renderiza" JSON.

</Angular>


## En ripopola: el `TownsController`

### 1. Generarlo

```bash
pnpm exec nx g @nx/nest:controller apps/api/src/app/towns/towns --dry-run
```

El generador lo agrega solo a `controllers` en `TownsModule`. Revisalo.

### 2. Escribir las rutas

`apps/api/src/app/towns/towns.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { TownsService } from './towns.service';
import { CreateTownDto } from './dto/create-town.dto';
import { UpdateTownDto } from './dto/update-town.dto';
import { ListTownsQueryDto } from './dto/list-towns-query.dto';

@Controller('towns')
export class TownsController {
  constructor(private readonly townsService: TownsService) {}

  // GET /api/towns?country=ES&page=1
  @Get()
  findAll(@Query() query: ListTownsQueryDto) {
    return this.townsService.findAll(query);
  }

  // GET /api/towns/albarracin
  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.townsService.findBySlug(slug);
  }

  // POST /api/towns  → 201
  @Post()
  create(@Body() dto: CreateTownDto) {
    return this.townsService.create(dto);
  }

  // PATCH /api/towns/3f1c...  → 200
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTownDto) {
    return this.townsService.update(id, dto);
  }

  // DELETE /api/towns/3f1c...  → 204 sin cuerpo
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.townsService.remove(id);
  }
}
```

Qué mirar:

- El controlador **no sabe nada de Prisma**. Solo llama a `TownsService`.
- `@Query()` sin nombre trae **toda la query** como un objeto, que validamos
  con un DTO (`ListTownsQueryDto`). Con nombre (`@Query('country')`) trae un solo valor.
- `HttpStatus.NO_CONTENT` es 204. Usar el enum es más legible que el número.
- Todavía faltan el servicio y los DTOs. Los armamos en los próximos dos temas.
  Por ahora, si querés compilar, creá clases vacías para los DTOs.

### 3. El orden de las rutas importa

Si mañana agregás `GET /towns/nearby` (pueblos cerca de un punto), tiene que ir
**antes** de `@Get(':slug')`. Si no, Nest interpreta `nearby` como un slug.

```ts
@Get('nearby')      // primero las rutas fijas
nearby(...) {}

@Get(':slug')       // después las que tienen parámetros
findOne(...) {}
```

### 4. Probarlo a mano

```bash
pnpm exec nx serve api
curl -i http://localhost:3000/api/towns
curl -i -X POST http://localhost:3000/api/towns \
  -H 'Content-Type: application/json' \
  -d '{"slug":"albarracin","officialName":"Albarracín","country":"ES"}'
```

`-i` muestra el código de estado y las cabeceras: fijate que el `POST` da 201.

## Errores comunes

- **404 en una ruta que existe**: falta el prefijo `/api`, o el controlador no
  está en `controllers` de ningún módulo, o el módulo no está importado en `AppModule`.
- **Una ruta fija nunca se ejecuta**: está después de una con parámetro (`:slug`).
- **La petición queda colgada**: usaste `@Res()` y no respondiste.
- **El body llega `undefined`**: el cliente no mandó `Content-Type: application/json`.

## Preguntas de entrevista

**1. ¿Qué responsabilidad tiene un controlador?**
Recibir la petición, extraer los datos de entrada, delegar en un servicio y
devolver la respuesta. No tiene lógica de negocio ni acceso directo a la base.

**2. ¿Diferencia entre `@Param`, `@Query` y `@Body`?**
`@Param` lee la ruta (`/towns/:slug`), `@Query` lee la query string
(`?country=ES`) y `@Body` lee el cuerpo de la petición.

**3. ¿Qué códigos de estado devuelve Nest por defecto?**
200 para todo salvo `POST`, que devuelve 201. Se cambia con `@HttpCode()`.

**4. ¿Por qué evitar `@Res()`?**
Porque Nest deja de manejar la respuesta: no se aplican interceptors ni
serialización y tenés que responder a mano. Si hace falta, usar `passthrough: true`.

**5. ¿Diferencia entre `PUT` y `PATCH`?**
`PUT` reemplaza el recurso entero; `PATCH` modifica solo los campos enviados.

**6. ¿Qué significa que un método sea idempotente?**
Que repetir la misma petición deja el sistema en el mismo estado. `GET`,
`PUT` y `DELETE` lo son; `POST` no.

**7. ¿Por qué importa el orden de las rutas?**
Porque Nest (Express) las evalúa en orden, y una ruta con parámetro como
`:slug` atrapa cualquier valor, incluso `nearby`.

## Glosario

| Término | Qué es |
| --- | --- |
| Controlador | Clase que recibe peticiones HTTP y devuelve respuestas. |
| Parámetro de ruta | Parte variable de la ruta (`:slug`). |
| Query string | Lo que va después de `?` en la URL. |
| Body | Cuerpo de la petición, normalmente JSON. |
| Idempotente | Que repetirlo no cambia el resultado. |
| REST | Estilo de API con recursos como sustantivos y métodos HTTP como acciones. |
