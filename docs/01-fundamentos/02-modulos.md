---
title: Módulos
sidebar_position: 2
description: Cómo Nest organiza la aplicación en módulos, qué es imports, exports y providers, módulos globales y dinámicos, con el TownsModule de ripopola.
---

# Módulos

<Tech ids={['nestjs','nx']} />

<Estado tipo="construye">Se crea el `TownsModule`, el primer módulo de negocio de ripopola.</Estado>

## Concepto

Un **módulo** es una clase con el decorador `@Module()` que agrupa todo lo de
un mismo dominio. En ripopola va a haber un módulo para pueblos, otro para
viviendas, otro para usuarios, etc. Es la base del **monolito modular** que
eligió ripopola: una sola API, pero con fronteras claras entre dominios.

`@Module()` recibe cuatro listas:

| Propiedad | Qué va | Ejemplo en ripopola |
| --- | --- | --- |
| `controllers` | Los controladores del módulo (reciben HTTP). | `TownsController` |
| `providers` | Los servicios y demás clases que Nest crea e inyecta. | `TownsService` |
| `imports` | Otros módulos cuyos providers exportados necesitás. | `ConfigModule` |
| `exports` | Los providers que este módulo comparte con quien lo importe. | `TownsService` |

La regla más importante: **los providers son privados del módulo por
defecto**. Si `HousingModule` necesita `TownsService`, tienen que pasar dos cosas:

1. `TownsModule` lo pone en `exports`.
2. `HousingModule` pone `TownsModule` en `imports`.

Eso es el **encapsulamiento**: cada módulo decide qué es su interfaz pública,
y el resto queda adentro. Es lo que pide la arquitectura de ripopola: *un
dominio no entra en las rutas internas de otro*.

### El árbol de módulos

Nest arma un grafo empezando por `AppModule`:

```
AppModule
 ├─ ConfigModule (global)
 ├─ PrismaModule (global)
 ├─ HealthModule
 └─ TownsModule
     └─ (más adelante) HousingModule importa TownsModule
```

### Módulos compartidos y singletons

Los providers son **singletons por defecto**: si dos módulos importan
`TownsModule`, los dos reciben **la misma instancia** de `TownsService`. Esto
es importante para cosas como el pool de conexiones de Prisma: una sola
instancia en toda la app.

### Módulos globales (`@Global`)

`PrismaModule` es `@Global()`: sus exports están disponibles en todos los
módulos sin importarlo. Se usa solo para infraestructura transversal (base de
datos, configuración, logger). Si hacés global un módulo de negocio,
perdés la visibilidad de quién depende de quién.

### Módulos dinámicos (`forRoot`, `forFeature`, `register`)

Algunos módulos necesitan configuración al importarse. Para eso devuelven un
**módulo dinámico** desde un método estático:

```ts
ConfigModule.forRoot({ isGlobal: true })
```

La convención de nombres:

- `forRoot()`: se configura **una vez** para toda la app (conexión, configuración).
- `forFeature()`: cada módulo de negocio agrega lo suyo usando lo configurado en `forRoot` (por ejemplo, las entidades de TypeORM).
- `register()`: una configuración propia en cada lugar donde se importa.

Si alguna vez armás un módulo propio así (por ejemplo un `AiModule` con el
proveedor de traducción), Nest tiene `ConfigurableModuleBuilder` para
generarlo sin escribir todo a mano.

<Angular>

Es la misma idea que los `NgModule`: `imports`, `exports`, `providers` y
`declarations` (acá son `controllers`). La diferencia es que en Nest no hay
componentes standalone: los módulos siguen siendo la forma de organizar.

</Angular>


## En ripopola: crear el `TownsModule`

### 1. Generar el módulo

```bash
pnpm exec nx g @nx/nest:module apps/api/src/app/towns/towns --dry-run
```

Si las rutas del `--dry-run` te convencen, corrélo sin `--dry-run`. Crea
`apps/api/src/app/towns/towns.module.ts`:

```ts
import { Module } from '@nestjs/common';

@Module({})
export class TownsModule {}
```

Y lo agrega solo a los `imports` de `AppModule`. Si no lo hizo, agregalo vos:

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { TownsModule } from './towns/towns.module';

@Module({
  imports: [PrismaModule, TownsModule],
  controllers: [HealthController],
})
export class AppModule {}
```

### 2. Cómo va a quedar cuando tenga contenido

En los próximos temas le agregamos el controlador y el servicio:

```ts
import { Module } from '@nestjs/common';
import { TownsController } from './towns.controller';
import { TownsService } from './towns.service';

@Module({
  controllers: [TownsController],
  providers: [TownsService],
  exports: [TownsService], // lo van a usar viviendas, empleos, incentivos
})
export class TownsModule {}
```

No importa `PrismaModule` porque es global.

### 3. Dónde vive cada módulo en el monorepo

Para aprender, el módulo vive en `apps/api/src/app/towns`. En la arquitectura
objetivo de ripopola, cada dominio del backend va a una librería Nx:

```
libs/backend/towns     → TownsModule, controller, service, DTOs
libs/backend/database  → PrismaModule
apps/api               → solo main.ts y AppModule, que importa las librerías
```

Así Nx puede **verificar las fronteras** (que un dominio no importe archivos
internos de otro) con las reglas de límites de módulos. Ese paso se hace
cuando haya más de un dominio.

## Errores comunes

- **`Nest can't resolve dependencies of the HousingService (?)`**: usás un
  provider de otro módulo y falta el `exports` en ese módulo o el `imports`
  en el tuyo. El mensaje te dice en qué módulo está buscando.
- **Dependencia circular entre módulos** (`A` importa `B` y `B` importa `A`):
  casi siempre es una señal de diseño. Sacá lo común a un tercer módulo. Si
  no hay otra, existe `forwardRef(() => TownsModule)`, pero es un parche.
- **Declarar el mismo provider en dos módulos**: crea **dos instancias**
  distintas. Declaralo en uno y exportalo.

## Preguntas de entrevista

**1. ¿Qué es un módulo en Nest y para qué sirve?**
Una clase con `@Module()` que agrupa controladores y providers de un mismo
dominio. Define qué usa de otros módulos (`imports`) y qué comparte (`exports`).
Sirve para organizar y encapsular.

**2. Si un servicio de un módulo necesita un servicio de otro, ¿qué hacés?**
El módulo dueño lo exporta y el módulo que lo usa importa ese módulo.
Después se inyecta en el constructor.

**3. ¿Qué hace `@Global()` y cuándo lo usarías?**
Hace que los exports del módulo estén disponibles en toda la app sin
importarlo. Solo para infraestructura transversal como base de datos o
configuración, porque esconde las dependencias.

**4. ¿Qué es un módulo dinámico? ¿Diferencia entre `forRoot` y `forFeature`?**
Un módulo que se configura al importarlo, devolviendo un `DynamicModule`
desde un método estático. `forRoot` configura una vez para toda la app;
`forFeature` agrega configuración de cada módulo de negocio sobre esa base.

**5. ¿Los providers son singletons?**
Por defecto sí: una instancia por aplicación, compartida por todos los
módulos que importan el módulo que los exporta.

**6. ¿Qué es un monolito modular y cómo lo ayuda Nest?**
Una sola aplicación desplegable dividida en módulos con fronteras claras.
Nest lo facilita porque cada módulo encapsula sus providers y solo comparte
lo que exporta. Si un módulo necesita escalar aparte, se puede extraer.

## Glosario

| Término | Qué es |
| --- | --- |
| Módulo | Clase con `@Module()` que agrupa un dominio. |
| Encapsulamiento | Los providers son privados salvo que se exporten. |
| Módulo global | Módulo cuyos exports están disponibles en toda la app. |
| Módulo dinámico | Módulo configurable al importarlo (`forRoot`, `register`). |
| Monolito modular | Una app desplegable con módulos de fronteras claras. |
