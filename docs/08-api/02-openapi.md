---
title: Documentar la API con OpenAPI
sidebar_label: OpenAPI con Swagger
sidebar_position: 2
description: '@nestjs/swagger, el plugin de la CLI que lee los DTOs, tags, ApiProperty, respuestas, autenticación Bearer y exportar el documento OpenAPI.'
---

# Documentar la API con OpenAPI

<Tech ids={['openapiinitiative', 'nestjs']} />

<Estado tipo="construye">La documentación interactiva en `/api/docs` y el archivo `openapi.json` que usa el panel para generar su cliente tipado.</Estado>

## Concepto

**OpenAPI** es un estándar (antes llamado Swagger) para describir una API
REST en un archivo JSON/YAML: rutas, parámetros, cuerpos, respuestas y
seguridad. Con ese archivo se generan:

- **Documentación interactiva** (Swagger UI, Redoc, Scalar).
- **Clientes tipados** para el frontend (tema siguiente).
- **Pruebas de contrato** y mocks.

En Nest, `@nestjs/swagger` genera el documento **a partir del código**
(controladores, DTOs y decoradores). Es la regla de la arquitectura de
ripopola: "OpenAPI generado desde el backend".

## En ripopola

### 1. Instalar

```bash
pnpm add -E @nestjs/swagger
```

### 2. Montar la documentación

```ts title="main.ts"
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

if (config.get('NODE_ENV') !== 'production') {
  const doc = new DocumentBuilder()
    .setTitle('API de ripopola')
    .setDescription('Pueblos, viviendas y oportunidades para empezar una nueva vida')
    .setVersion('1')
    .addCookieAuth('better-auth.session_token') // la cookie de sesión (sección 6)
    .build();
  const document = SwaggerModule.createDocument(app, doc);
  SwaggerModule.setup('api/docs', app, document, { jsonDocumentUrl: 'api/docs/openapi.json' });
}
```

Abrí `http://localhost:3000/api/docs`: ya aparecen todas las rutas.

:::info ¿Documentación pública en producción?
En ripopola la API es para nuestras propias apps, así que se publica solo
fuera de producción. Si algún día hay integraciones de terceros, se publica.
:::

### 3. El plugin de la CLI: menos decoradores

Sin ayuda, hay que poner `@ApiProperty()` en cada campo de cada DTO. El
**plugin de Swagger** lo hace solo en tiempo de compilación, leyendo los
tipos de TypeScript y los comentarios. En Nx, en el `project.json` de la API
(target `build`, opciones del webpack de Nest):

```json
"transformers": [
  { "name": "@nestjs/swagger/plugin", "options": { "introspectComments": true, "classValidatorShim": true } }
]
```

Con `introspectComments`, los comentarios JSDoc se vuelven la descripción:

```ts
export class CreateTownDto {
  /** Identificador para la URL. Si no se envía, se genera desde el nombre. @example "albarracin" */
  @IsOptional() @Matches(SLUG)
  slug?: string;
}
```

### 4. Lo que el plugin no adivina

```ts title="towns.controller.ts"
import { ApiConflictResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('towns')
@Controller('towns')
export class TownsController {
  @Public()
  @Get(':slug')
  @ApiOkResponse({ type: TownDetailDto })
  @ApiNotFoundResponse({ description: 'No existe o no está publicado' })
  findOne(@Param('slug', SlugPipe) slug: string) { ... }

  @SuperadminOnly()
  @Post()
  @ApiConflictResponse({ description: 'Slug repetido' })
  create(@Body() dto: CreateTownDto) { ... }
}
```

- Las respuestas necesitan una **clase** (no una interfaz) para documentarse.
  Por eso los tipos de respuesta importantes tienen su DTO de salida.
- Recordá: los mapped types (`PartialType`, etc.) se importan desde
  `@nestjs/swagger` para que hereden la documentación.
- `@ApiBearerAuth()` lo pusimos dentro de `@Auth()` (decoradores compuestos).

### 5. Exportar `openapi.json` al repo

Para generar el cliente del frontend sin levantar la API, un script escribe
el documento a un archivo:

```ts title="apps/api/src/openapi.ts"
async function main() {
  const app = await NestFactory.create(AppModule, { logger: false, preview: true });
  const document = SwaggerModule.createDocument(app, buildDocConfig());
  writeFileSync('libs/shared/api-client/openapi.json', JSON.stringify(document, null, 2));
  await app.close();
}
main();
```

`preview: true` arma el grafo de módulos **sin instanciar los providers**
(no se conecta a la base). En CI se puede comprobar que el archivo esté al día.

<Alternativa title="Postman, Bruno e Insomnia">

El curso de referencia también documenta con **Postman** (colecciones de
peticiones). Son herramientas para **probar a mano**, complementarias a
OpenAPI. **Bruno** es una alternativa open source que guarda las colecciones
como archivos en el repo. Postman e Insomnia pueden importar el `openapi.json`.

</Alternativa>

<Resumen>

- OpenAPI describe la API; se genera desde el código con `@nestjs/swagger`.
- El plugin de la CLI documenta los DTOs solo.
- Decoradores para respuestas y errores que no se pueden inferir.
- El `openapi.json` versionado alimenta el cliente del frontend.

</Resumen>

## Preguntas de entrevista

**1. ¿Qué es OpenAPI y para qué sirve además de documentar?**
Una especificación estándar de APIs REST. Sirve para generar clientes, mocks, pruebas de contrato y validaciones.

**2. ¿Code-first o design-first?**
Code-first genera la especificación desde el código (simple, siempre sincronizado). Design-first escribe la especificación antes y genera código; mejor cuando varios equipos acuerdan el contrato primero.

**3. ¿Qué hace el plugin de Swagger de Nest?**
Agrega en compilación la metadata de OpenAPI de los DTOs y respuestas leyendo los tipos y comentarios, evitando repetir `@ApiProperty`.
