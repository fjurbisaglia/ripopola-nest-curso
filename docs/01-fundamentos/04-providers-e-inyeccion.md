---
title: Providers e inyección de dependencias
sidebar_label: Providers e inyección
sidebar_position: 4
description: Servicios, el contenedor de Nest, providers personalizados con tokens, scopes y pruebas con dobles, con el TownsService y el proveedor de traducción de ripopola.
---

# Providers e inyección de dependencias

<Tech ids={['nestjs','prisma','vitest']} />

<Estado tipo="construye">El `TownsService` con Prisma, el proveedor de traducción con token y sus pruebas.</Estado>

## Concepto

### Qué es un provider

Un **provider** es cualquier cosa que Nest puede **crear e inyectar**. Lo más
común es una clase con `@Injectable()`, a la que llamamos **servicio**. Ahí va
la lógica de negocio y el acceso a datos.

### Inyección de dependencias (DI)

Una clase **no crea** lo que necesita: lo **pide en el constructor** y alguien
se lo da. Ese alguien es el **contenedor de dependencias** de Nest (también
llamado *injector* o *IoC container*).

```ts
// Sin DI: la clase crea su dependencia y queda atada a ella
class TownsService {
  private prisma = new PrismaClient(); // una conexión nueva por cada servicio
}

// Con DI: la recibe y no le importa de dónde viene
@Injectable()
class TownsService {
  constructor(private readonly prisma: PrismaService) {}
}
```

Ventajas:

- **Bajo acoplamiento**: `TownsService` depende de "algo que se comporta como
  PrismaService", no de cómo se crea.
- **Una sola instancia compartida** (singleton): un solo pool de conexiones.
- **Pruebas fáciles**: en un test le pasás un doble en vez de la base real.

Esto es la **inversión de control** (IoC): el control de crear objetos pasa
de tu código al framework.

### Cómo sabe Nest qué inyectar

Cuando escribís `constructor(private readonly prisma: PrismaService)`,
TypeScript (con `emitDecoratorMetadata`) guarda en los metadatos de la clase
que el primer parámetro es de tipo `PrismaService`. Nest lee esos metadatos
(con `reflect-metadata`), busca un provider registrado con ese **token**
(la clase misma) y lo pasa.

Por eso funciona con **clases** pero no con **interfaces**: las interfaces de
TypeScript desaparecen al compilar, no hay nada que leer en tiempo de ejecución.
Para eso existen los tokens (abajo).

### Formas de registrar un provider

La forma corta `providers: [TownsService]` es un atajo de:

```ts
providers: [{ provide: TownsService, useClass: TownsService }]
```

Las cuatro formas:

| Forma | Cuándo | Ejemplo |
| --- | --- | --- |
| `useClass` | Elegir qué clase implementa un token. | Traductor real o falso. |
| `useValue` | Un valor ya hecho (constantes, dobles en tests). | `{ provide: PrismaService, useValue: prismaFalso }` |
| `useFactory` | Crear el valor con una función, con dependencias. | Elegir el proveedor de IA según la configuración. |
| `useExisting` | Un alias de otro provider. | Dos tokens, una misma instancia. |

### Tokens para interfaces

Como las interfaces no existen en runtime, se usa un **token** (un `Symbol` o
un string) y `@Inject(token)`.

### Scopes

| Scope | Instancias | Uso |
| --- | --- | --- |
| `DEFAULT` | Una para toda la app (singleton). | Casi siempre. |
| `REQUEST` | Una por petición. | Datos por petición (por ejemplo el tenant). Costoso: se propaga a quien lo inyecta. |
| `TRANSIENT` | Una por cada clase que lo inyecta. | Loggers con contexto propio. |

Regla práctica: quedate con el singleton. Para datos de la petición (como el
usuario), es mejor leerlos del `request` en un guard o un decorador.

<Angular>

Es el mismo concepto que `@Injectable` en Angular, con `useClass`,
`useValue`, `useFactory`, `useExisting` e `InjectionToken`. La diferencia es
que Angular tiene un árbol jerárquico de injectors por componente, y en Nest
la jerarquía es por módulo, con todo singleton por defecto.

</Angular>


## En ripopola

### 1. El `TownsService`

```bash
pnpm exec nx g @nx/nest:service apps/api/src/app/towns/towns --dry-run
```

`apps/api/src/app/towns/towns.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTownDto } from './dto/create-town.dto';
import { UpdateTownDto } from './dto/update-town.dto';
import { ListTownsQueryDto } from './dto/list-towns-query.dto';

@Injectable()
export class TownsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ListTownsQueryDto) {
    const { country, page = 1, pageSize = 20 } = query;
    return this.prisma.town.findMany({
      where: { published: true, country }, // si country es undefined, Prisma lo ignora
      orderBy: [{ officialName: 'asc' }, { id: 'asc' }], // orden estable para paginar
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async findBySlug(slug: string) {
    const town = await this.prisma.town.findUnique({ where: { slug } });
    if (!town || !town.published) {
      throw new NotFoundException(`No existe el pueblo "${slug}"`);
    }
    return town;
  }

  create(dto: CreateTownDto) {
    return this.prisma.town.create({ data: dto });
  }

  update(id: string, dto: UpdateTownDto) {
    return this.prisma.town.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.town.delete({ where: { id } });
  }
}
```

Qué mirar:

- `PrismaService` llega por el constructor. Como `PrismaModule` es global, no
  hace falta importarlo en `TownsModule`.
- `NotFoundException` corta el flujo y Nest responde **404**. Lo vemos a fondo en el tema de errores.
- El orden incluye `id` como desempate: sin un orden único, la paginación
  puede repetir o saltear filas.
- `update` y `remove` tiran un error de Prisma si el id no existe. Lo
  convertimos en un 404 prolijo en el tema de errores.

### 2. Un provider con token: el traductor (decisión D-05)

Ripopola decidió que la IA pasa por **interfaces propias con un adaptador
por proveedor**. Eso es exactamente un provider con token.

`apps/api/src/app/ai/translation.provider.ts`:

```ts
export interface TranslationProvider {
  translate(text: string, from: string, to: string): Promise<string>;
}

// Token: lo que Nest usa para encontrar la implementación
export const TRANSLATION_PROVIDER = Symbol('TRANSLATION_PROVIDER');
```

Un adaptador falso, útil para desarrollo y pruebas:

```ts
import { Injectable } from '@nestjs/common';
import { TranslationProvider } from './translation.provider';

@Injectable()
export class FakeTranslationProvider implements TranslationProvider {
  async translate(text: string, _from: string, to: string) {
    return `[${to}] ${text}`;
  }
}
```

El módulo elige la implementación:

```ts
import { Module } from '@nestjs/common';
import { FakeTranslationProvider } from './fake-translation.provider';
import { TRANSLATION_PROVIDER } from './translation.provider';

@Module({
  providers: [{ provide: TRANSLATION_PROVIDER, useClass: FakeTranslationProvider }],
  exports: [TRANSLATION_PROVIDER],
})
export class AiModule {}
```

Y quien lo usa pide el **token**, no la clase:

```ts
import { Inject, Injectable } from '@nestjs/common';
import { TRANSLATION_PROVIDER, TranslationProvider } from '../ai/translation.provider';

@Injectable()
export class TownTranslationsService {
  constructor(
    @Inject(TRANSLATION_PROVIDER) private readonly translator: TranslationProvider,
  ) {}
}
```

Cambiar de proveedor (de uno falso a uno real, o entre empresas de IA) es
cambiar **una línea en el módulo**. El resto del código no se entera.

Con `useFactory` podés elegir según la configuración (lo vemos en el tema de configuración):

```ts
{
  provide: TRANSLATION_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService) =>
    config.get('AI_PROVIDER') === 'fake'
      ? new FakeTranslationProvider()
      : new RealTranslationProvider(config.getOrThrow('AI_API_KEY')),
}
```

### 3. Probar el servicio con un doble

Como `TownsService` recibe `PrismaService`, en el test le damos uno falso con `useValue`:

```ts
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { TownsService } from './towns.service';

describe('TownsService', () => {
  let service: TownsService;
  const prisma = { town: { findUnique: vi.fn() } };

  beforeEach(async () => {
    prisma.town.findUnique.mockReset();
    const module = await Test.createTestingModule({
      providers: [TownsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(TownsService);
  });

  it('devuelve el pueblo publicado', async () => {
    prisma.town.findUnique.mockResolvedValue({ slug: 'albarracin', published: true });
    await expect(service.findBySlug('albarracin')).resolves.toMatchObject({ slug: 'albarracin' });
  });

  it('da 404 si el pueblo no está publicado', async () => {
    prisma.town.findUnique.mockResolvedValue({ slug: 'albarracin', published: false });
    await expect(service.findBySlug('albarracin')).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

`Test.createTestingModule` arma un mini contenedor de Nest solo con lo que le
pasás. Es la DI trabajando a tu favor.

### Comparación con TypeORM (para entrevistas)

Con TypeORM, en vez de un servicio global de Prisma, cada módulo registra sus
entidades y se inyecta un **repositorio por entidad**:

```ts
// towns.module.ts
imports: [TypeOrmModule.forFeature([Town])]

// towns.service.ts
constructor(@InjectRepository(Town) private readonly towns: Repository<Town>) {}
```

Con Prisma no hace falta: el cliente generado ya tiene `prisma.town`, `prisma.user`, etc.

## Errores comunes

- **`Nest can't resolve dependencies of the TownsService (?). Please make sure
  that the argument PrismaService at index [0] is available in the TownsModule context`**:
  el provider no está registrado en el módulo, ni importado de otro, ni es global.
- **Inyectar una interfaz sin token**: compila, pero Nest recibe `Object` y
  falla. Usá un token y `@Inject()`.
- **Importar con `import type`**: borra la clase en runtime y Nest no la
  encuentra. Las dependencias inyectadas se importan normal.
- **Dependencia circular entre servicios**: rediseñá; si no hay otra, `forwardRef`.

## Preguntas de entrevista

**1. ¿Qué es la inyección de dependencias y qué ventajas tiene?**
Recibir las dependencias desde afuera (en el constructor) en vez de crearlas.
Bajo acoplamiento, instancias compartidas y pruebas con dobles.

**2. ¿Qué es la inversión de control?**
Que el framework, y no tu código, controla la creación y el ciclo de vida de
los objetos. La DI es una forma de aplicarla.

**3. ¿Cómo sabe Nest qué inyectar?**
Por los metadatos de tipos que emite TypeScript (`emitDecoratorMetadata`) y
lee `reflect-metadata`. El tipo del parámetro funciona como token.

**4. ¿Por qué no podés inyectar una interfaz directamente?**
Porque las interfaces no existen en JavaScript. Se usa un token (`Symbol` o
string) con `@Inject(token)`.

**5. Explicá `useClass`, `useValue`, `useFactory` y `useExisting`.**
`useClass` elige la clase que implementa un token; `useValue` entrega un
valor hecho; `useFactory` crea el valor con una función que puede recibir
otras dependencias; `useExisting` es un alias de otro provider.

**6. ¿Qué scopes hay y cuál usarías?**
`DEFAULT` (singleton), `REQUEST` (uno por petición) y `TRANSIENT` (uno por
consumidor). Singleton salvo un motivo claro: `REQUEST` se contagia a todo lo
que lo inyecta y cuesta rendimiento.

**7. ¿Cómo probás un servicio que usa la base de datos?**
En pruebas unitarias, con `Test.createTestingModule` y un doble del cliente
de base (`useValue`). Para probar las consultas reales, pruebas de
integración contra un PostgreSQL de verdad (en ripopola, con PostGIS).

**8. ¿Cómo diseñarías la integración con un proveedor de IA para poder cambiarlo?**
Una interfaz propia (`TranslationProvider`), un token, un adaptador por
proveedor y el módulo eligiendo la implementación (con `useFactory` según la
configuración). El SDK del proveedor no sale del adaptador.

## Glosario

| Término | Qué es |
| --- | --- |
| Provider | Algo que Nest puede crear e inyectar. |
| Servicio | Provider con lógica de negocio (`@Injectable()`). |
| Contenedor / injector | Parte de Nest que crea y entrega las dependencias. |
| Token | Identificador de un provider (una clase, un `Symbol` o un string). |
| Inversión de control | El framework controla la creación de objetos. |
| Scope | Cuántas instancias se crean de un provider. |
| Doble de prueba | Objeto falso que reemplaza una dependencia en un test. |
