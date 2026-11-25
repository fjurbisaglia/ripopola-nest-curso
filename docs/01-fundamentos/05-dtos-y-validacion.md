---
title: DTOs y validación
sidebar_position: 5
description: Qué es un DTO, cómo validar la entrada con class-validator y ValidationPipe, whitelist y transformación, con los DTOs de pueblos de ripopola.
---

# DTOs y validación

<Tech ids={['nestjs','typescript']} />

<Estado tipo="construye">Validación global y los DTOs de pueblos.</Estado>

## Concepto

### Nunca confíes en lo que llega

Todo lo que llega a la API (body, query, parámetros) lo puede mandar
**cualquiera**, no solo tu frontend. Alguien puede mandar un `population`
negativo, un `country` inventado o un campo `published: true` para publicar
un pueblo sin permiso. La validación del frontend es para la experiencia de
usuario; **la que protege es la del backend**.

### Qué es un DTO

Un **DTO** (*Data Transfer Object*) es una clase que describe **la forma de
los datos que entran o salen** de un endpoint. En Nest se usan clases (no
interfaces) porque las clases existen en runtime y se les pueden poner
decoradores de validación.

Separar el DTO del modelo de la base es clave:

- El modelo de Prisma tiene `id`, `createdAt`, `published`… que el cliente **no** debe mandar al crear.
- Cada operación tiene su DTO: crear, editar y filtrar piden cosas distintas.
- Si cambiás la base, el contrato de la API no tiene por qué cambiar.

### Las piezas

- **`class-validator`**: decoradores como `@IsString()`, `@IsInt()`, `@Min(0)`.
- **`class-transformer`**: convierte el JSON plano en una instancia de la clase
  (y tipos, por ejemplo el texto `"2"` de la query al número `2`).
- **`ValidationPipe`**: el pipe de Nest que junta las dos. Valida cada
  `@Body()`, `@Query()` y `@Param()` tipado con una clase, y si algo falla
  responde **400** con la lista de errores.

### Las opciones de `ValidationPipe` que tenés que saber

| Opción | Qué hace | Por qué importa |
| --- | --- | --- |
| `whitelist: true` | Borra las propiedades que no tienen decoradores en el DTO. | Evita la **asignación masiva** (mandar `published: true` o `id`). |
| `forbidNonWhitelisted: true` | En vez de borrarlas, responde 400. | El cliente se entera de que mandó algo de más. |
| `transform: true` | Devuelve una instancia del DTO y convierte tipos de parámetros. | `page` llega como número y no como texto. |

<Angular>

Es como las validaciones de Reactive Forms (`Validators.required`,
`Validators.min`), pero declaradas con decoradores en una clase y ejecutadas
en el servidor.

</Angular>


## En ripopola: validar los pueblos

### 1. Instalar

```bash
pnpm add -E class-validator class-transformer
```

`-E` fija la versión exacta (regla del proyecto: versiones exactas con lockfile).

### 2. Activar `ValidationPipe` para toda la API

Hay dos formas. La recomendada es registrarlo como provider global en
`AppModule`, porque así participa de la inyección de dependencias:

```ts
import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';

@Module({
  imports: [PrismaModule, TownsModule],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule {}
```

La otra es en `main.ts` con `app.useGlobalPipes(new ValidationPipe({...}))`.
Funciona igual, pero queda fuera del contenedor (y fuera de los tests e2e que
crean la app sin `main.ts`).

### 3. DTO para crear un pueblo

`apps/api/src/app/towns/dto/create-town.dto.ts`:

```ts
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export const SUPPORTED_COUNTRIES = ['ES', 'IT'] as const;

export class CreateTownDto {
  // "albarracin", "santo-stefano-di-sessanio"
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug: solo minúsculas, números y guiones',
  })
  @MaxLength(80)
  slug!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  officialName!: string;

  @IsIn(SUPPORTED_COUNTRIES)
  country!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  population?: number;
}
```

Qué mirar:

- El `!` le dice a TypeScript "esto lo completa otro" (class-transformer).
  Sin él, el modo estricto se queja de que la propiedad no se inicializa.
- `@IsOptional()` deja pasar `undefined` y `null`; si viene, se aplican las demás reglas.
- No están `id`, `published`, `createdAt`: el cliente no los manda. Con
  `whitelist` + `forbidNonWhitelisted`, si los manda recibe 400.
- `SUPPORTED_COUNTRIES` refleja el piloto (España e Italia).

### 4. DTO para editar: `PartialType`

Editar acepta los mismos campos, pero todos opcionales. En vez de copiar la clase:

```bash
pnpm add -E @nestjs/mapped-types
```

```ts
import { IsBoolean, IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateTownDto } from './create-town.dto';

export class UpdateTownDto extends PartialType(CreateTownDto) {
  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
```

`PartialType` copia las propiedades **y sus validaciones** y las hace
opcionales. También existen `PickType`, `OmitType` e `IntersectionType`.

:::info Cuando agreguemos OpenAPI
Si después se usa `@nestjs/swagger` para documentar la API, estos helpers se
importan desde `@nestjs/swagger` en vez de `@nestjs/mapped-types`, para que la
documentación también los entienda.
:::

### 5. DTO para la query: convertir tipos

Todo lo que viene en la query es **texto**. `?page=2` llega como `"2"`.
`@Type` de class-transformer lo convierte antes de validar:

```ts
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { SUPPORTED_COUNTRIES } from './create-town.dto';

export class ListTownsQueryDto {
  @IsOptional()
  @IsIn(SUPPORTED_COUNTRIES)
  country?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100) // nadie pide 10.000 pueblos de una
  pageSize?: number = 20;
}
```

### 6. Probarlo

```bash
curl -i -X POST http://localhost:3000/api/towns \
  -H 'Content-Type: application/json' \
  -d '{"slug":"Albarracín","officialName":"","country":"FR","published":true}'
```

Respuesta (400), con todos los errores juntos:

```json
{
  "message": [
    "property published should not exist",
    "slug: solo minúsculas, números y guiones",
    "officialName should not be empty",
    "country must be one of the following values: ES, IT"
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```

### 7. ¿Y el frontend? Contratos compartidos

El panel también necesita saber qué manda. Los DTOs **no** se comparten con
el frontend, porque arrastran `class-validator` al navegador. Lo que se comparte
es una **interfaz** en una librería de contratos, y el DTO la implementa:

```ts
// libs/shared/contracts (la puede importar web, panel y api)
export interface CreateTownRequest {
  slug: string;
  officialName: string;
  country: string;
  population?: number;
}

// apps/api: si la interfaz cambia, el DTO deja de compilar
export class CreateTownDto implements CreateTownRequest { ... }
```

## Errores comunes

- **No valida nada**: el parámetro está tipado con una interfaz o con `any`,
  o el `ValidationPipe` no está registrado. Tiene que ser una **clase**.
- **`page must be an integer`** aunque mandaste un número: falta `@Type(() => Number)` o `transform: true`.
- **Un objeto anidado no se valida**: hace falta `@ValidateNested()` y `@Type(() => LaClase)`.
- **`PartialType` pierde validaciones**: lo importaste de un paquete distinto al que esperás. Usá uno solo.

## Preguntas de entrevista

**1. ¿Qué es un DTO y por qué no usar directamente el modelo de la base?**
Una clase que define la forma de los datos de un endpoint. Separa el contrato
de la API del modelo de la base, evita exponer o recibir campos internos y
permite validar cada operación por separado.

**2. ¿Por qué en Nest los DTOs son clases y no interfaces?**
Porque las interfaces desaparecen al compilar y los decoradores de validación
necesitan algo que exista en runtime.

**3. ¿Qué es la asignación masiva y cómo la evitás en Nest?**
Que el cliente mande campos que no debería (`published`, `role`, `id`) y se
guarden. Se evita con `whitelist: true` (y `forbidNonWhitelisted` para
rechazarlos) y con DTOs que solo tengan lo permitido.

**4. ¿Qué hace `transform: true`?**
Convierte el objeto plano en una instancia del DTO y transforma los tipos
primitivos de parámetros y query (por ejemplo, de texto a número).

**5. ¿Para qué sirve `PartialType`?**
Para crear un DTO con las mismas propiedades y validaciones que otro, pero
opcionales. Típico para `UpdateDto` a partir de `CreateDto`.

**6. Si ya validás en el frontend, ¿por qué validar en el backend?**
Porque cualquiera puede llamar a la API sin pasar por el frontend. La
validación del frontend es experiencia de usuario; la del backend es seguridad e integridad.

**7. ¿Cómo compartís tipos entre un frontend (Next o Angular) y una API Nest en un monorepo?**
Con interfaces en una librería compartida que los DTOs del backend
implementan. Los DTOs con decoradores se quedan en el backend.

**8. ¿Alternativas a class-validator?**
Zod o Valibot con un pipe propio (o librerías como `nestjs-zod`). Ventaja:
el esquema sirve para validar y para inferir el tipo. Desventaja: no es lo
que trae Nest por defecto.

## Glosario

| Término | Qué es |
| --- | --- |
| DTO | Clase que define la forma de los datos de entrada o salida. |
| `ValidationPipe` | Pipe de Nest que valida con class-validator. |
| Whitelist | Dejar pasar solo las propiedades declaradas en el DTO. |
| Asignación masiva | Guardar campos que el cliente no debería poder mandar. |
| Mapped types | Helpers para derivar DTOs (`PartialType`, `PickType`, `OmitType`). |
| Contrato | La forma acordada de los datos entre frontend y backend. |
