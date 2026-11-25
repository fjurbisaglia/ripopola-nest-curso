---
title: Pipes
sidebar_position: 6
description: Pipes de Nest para transformar y validar parámetros, los Parse*Pipe incorporados, dónde se aplican y un pipe propio para los slugs de ripopola.
---

# Pipes

<Tech ids={['nestjs']} />

<Estado tipo="construye">`ParseUUIDPipe` en los ids y un `SlugPipe` propio.</Estado>

## Concepto

Un **pipe** recibe un valor de entrada **justo antes** de que llegue al
método del controlador, y hace una de dos cosas:

- **Transformar**: convertir el valor (de `"2"` a `2`, de texto a minúsculas).
- **Validar**: comprobar que es correcto y, si no, tirar una excepción
  (normalmente `BadRequestException`, que da 400). El controlador ni se entera.

El `ValidationPipe` del tema anterior es un pipe. Nest trae otros listos.

### Pipes incorporados

| Pipe | Qué hace | Ejemplo en ripopola |
| --- | --- | --- |
| `ParseIntPipe` | Texto a entero, o 400. | `/municipalities/:ineCode` si fuera numérico |
| `ParseFloatPipe` | Texto a decimal. | `?lat=40.4&lng=-1.44` |
| `ParseBoolPipe` | `"true"`/`"false"` a booleano. | `?onlyWithHousing=true` |
| `ParseUUIDPipe` | Comprueba que sea un UUID. | `PATCH /towns/:id` |
| `ParseEnumPipe` | Que sea un valor de un enum. | `?sort=population` |
| `ParseArrayPipe` | Texto separado por comas a array. | `?countries=ES,IT` |
| `DefaultValuePipe` | Pone un valor si no vino. | `?page` por defecto 1 |
| `ParseFilePipe` | Valida archivos subidos (tamaño, tipo). | Fotos del pueblo |

### Dónde se aplica un pipe

```ts
@Param('id', ParseUUIDPipe) id: string          // a un parámetro
@UsePipes(MiPipe)                                // a un método o a todo el controlador
{ provide: APP_PIPE, useClass: ValidationPipe }  // global
```

Si pasás la **clase** (`ParseUUIDPipe`), Nest la instancia y puede
inyectarle dependencias. Si pasás una **instancia** (`new ParseUUIDPipe({ version: '4' })`),
podés configurarla.

<Angular>

Mismo nombre, otro trabajo. En Angular un pipe **formatea para mostrar**
(`{{ precio | currency }}`). En Nest un pipe **prepara la entrada** del
controlador. Lo más parecido en Angular sería un validador de formulario más
un `transform` en un `@Input`.

</Angular>


## En ripopola

### 1. Validar el id con `ParseUUIDPipe`

Los ids de los pueblos son UUID. Si alguien llama `PATCH /api/towns/hola`,
sin el pipe la consulta llega a PostgreSQL y explota con un error de tipo.
Con el pipe, responde 400 antes:

```ts
import { ParseUUIDPipe } from '@nestjs/common';

@Patch(':id')
update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTownDto) {
  return this.townsService.update(id, dto);
}

@Delete(':id')
@HttpCode(HttpStatus.NO_CONTENT)
async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
  await this.townsService.remove(id);
}
```

### 2. Un pipe propio: normalizar el slug

Queremos que `/api/towns/Albarracin` y `/api/towns/albarracin` encuentren el
mismo pueblo, y que un slug con caracteres raros dé 400 sin consultar la base.

```bash
pnpm exec nx g @nx/nest:pipe apps/api/src/app/towns/slug --dry-run
```

`apps/api/src/app/towns/slug.pipe.ts`:

```ts
import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

@Injectable()
export class SlugPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const slug = value.trim().toLowerCase();
    if (!SLUG.test(slug) || slug.length > 80) {
      throw new BadRequestException(`"${value}" no es un slug válido`);
    }
    return slug;
  }
}
```

Qué mirar:

- `PipeTransform<Entrada, Salida>` obliga a implementar `transform(value, metadata)`.
- Lo que devuelve `transform` es lo que recibe el controlador.
- Si tira una excepción, el controlador no se ejecuta.

Usarlo:

```ts
@Get(':slug')
findOne(@Param('slug', SlugPipe) slug: string) {
  return this.townsService.findBySlug(slug);
}
```

Y su prueba, que no necesita Nest porque el pipe es una clase común:

```ts
import { BadRequestException } from '@nestjs/common';
import { SlugPipe } from './slug.pipe';

describe('SlugPipe', () => {
  const pipe = new SlugPipe();

  it('pasa a minúsculas', () => {
    expect(pipe.transform(' Albarracin ')).toBe('albarracin');
  });

  it('rechaza caracteres raros', () => {
    expect(() => pipe.transform('albarracín!')).toThrow(BadRequestException);
  });
});
```

### 3. Varios pipes en un parámetro

Se ejecutan en orden, de izquierda a derecha:

```ts
@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number
```

Primero pone 1 si no vino y después lo convierte a número. En ripopola
preferimos el DTO de query del tema anterior, que junta todo en un lugar,
pero esto es útil para un parámetro suelto.

## Errores comunes

- **El pipe no se ejecuta**: lo pusiste en `@Param()` pero el parámetro se
  llama distinto en la ruta (`:id` contra `@Param('townId')`).
- **`ParseIntPipe` da 400 con un parámetro opcional**: si no vino, es
  `undefined`. Poné antes `DefaultValuePipe` o usá `new ParseIntPipe({ optional: true })`.
- **Lógica de negocio en un pipe** (por ejemplo, buscar el pueblo en la
  base): los pipes son para la forma del dato. Que exista o no es del servicio.

## Preguntas de entrevista

**1. ¿Qué es un pipe en Nest?**
Una clase que transforma o valida un valor de entrada antes de que llegue al
controlador. Si la validación falla, tira una excepción y el controlador no se ejecuta.

**2. ¿Qué diferencia hay entre los pipes de Nest y los de Angular?**
En Angular formatean datos para mostrar en la plantilla. En Nest procesan la
entrada del controlador: transforman o validan.

**3. ¿En qué niveles se puede aplicar un pipe?**
Parámetro, método, controlador y global (con `APP_PIPE` o `useGlobalPipes`).

**4. ¿Cómo harías un pipe propio?**
Una clase con `@Injectable()` que implementa `PipeTransform` y su método
`transform`. Devuelve el valor transformado o tira `BadRequestException`.

**5. ¿Cuándo se ejecutan los pipes en el ciclo de la petición?**
Después de los guards y de la parte "antes" de los interceptors, justo antes del controlador.

**6. ¿Validarías que un pueblo existe en un pipe?**
No. El pipe se ocupa de la forma del dato; si existe o no es lógica de
negocio y va en el servicio, que responde 404.

## Glosario

| Término | Qué es |
| --- | --- |
| Pipe | Transforma o valida un valor antes del controlador. |
| `PipeTransform` | Interfaz que implementa un pipe propio. |
| Slug | Identificador legible para URLs (`albarracin`). |
| UUID | Identificador único de 128 bits, el formato de los ids de ripopola. |
