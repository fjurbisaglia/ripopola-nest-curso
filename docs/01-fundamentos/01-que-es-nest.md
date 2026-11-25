---
title: Qué es NestJS y cómo arranca la API
sidebar_label: Qué es NestJS
sidebar_position: 1
description: Qué resuelve Nest sobre Node y Express, su arquitectura y cómo arranca la API de ripopola desde main.ts.
---

# Qué es NestJS y cómo arranca la API

<Tech ids={['nestjs','nodedotjs','express','nx']} />

<Estado tipo="concepto">Explica cómo arranca la API que ya existe en ripopola (main.ts, prefijo global, comandos de Nx).</Estado>

## Concepto

**Node.js** ejecuta JavaScript fuera del navegador. Con Node solo podés
levantar un servidor HTTP, pero tenés que resolver vos todo lo demás: rutas,
validación, errores, estructura de carpetas. **Express** agrega rutas y
middleware, pero sigue sin decirte *cómo organizar* una aplicación grande.

**NestJS** es un framework que se monta encima de Express (o de Fastify) y
aporta lo que falta: una **arquitectura**. Te da:

- **Módulos** para dividir la aplicación por dominio (pueblos, usuarios, viviendas).
- **Controladores** para recibir peticiones HTTP.
- **Providers** (servicios) con **inyección de dependencias** para la lógica.
- Un **ciclo de la petición** con puntos de extensión claros: middleware,
  guards, interceptors, pipes y filtros de excepciones.
- TypeScript y decoradores en todos lados.

Nest no reemplaza a Express: lo usa por debajo. A eso se le llama
**plataforma** (`@nestjs/platform-express` por defecto, o `@nestjs/platform-fastify`).
Tu código habla con Nest, y Nest habla con la plataforma.

```
Petición HTTP ─▶ Express (plataforma) ─▶ Nest (ciclo de la petición)
                                           ├─ middleware
                                           ├─ guards
                                           ├─ interceptors
                                           ├─ pipes
                                           └─ controlador ─▶ servicio ─▶ Prisma ─▶ PostgreSQL
```

<Angular>

Nest se inspiró directamente en Angular, así que mucho te va a sonar:

| Angular | NestJS | Diferencia |
| --- | --- | --- |
| `@NgModule` / standalone | `@Module` | En Nest los módulos siguen siendo la forma principal de organizar. |
| `@Injectable` + DI | `@Injectable` + DI | Igual idea. En Nest casi todo es singleton. |
| `@Component` | `@Controller` | El controlador no tiene vista: devuelve datos (JSON). |
| Route guards | Guards | Deciden si una petición sigue o no. |
| `HttpInterceptor` | Interceptors | Envuelven la petición con RxJS, antes y después. |
| Pipes (`date`, `currency`) | Pipes | En Nest **validan y transforman la entrada**, no formatean la salida. |

</Angular>


## Cómo arranca la API de ripopola

Todo empieza en `apps/api/src/main.ts`. Nx lo generó parecido a esto:

```ts
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(`API en http://localhost:${port}/${globalPrefix}`);
}

bootstrap();
```

Qué hace cada línea:

- `NestFactory.create(AppModule)`: crea la aplicación a partir del **módulo
  raíz**. Nest recorre ese módulo y todos los que importa, arma el
  **contenedor de dependencias** y registra las rutas de cada controlador.
- `setGlobalPrefix('api')`: todas las rutas empiezan con `/api`. Por eso el
  health check es `/api/health` y no `/health`.
- `app.listen(port)`: levanta el servidor HTTP (Express) en ese puerto.
- `Logger.log(...)`: el logger de Nest, que escribe con formato y contexto.

Más adelante vamos a agregar acá cosas globales:

```ts
app.enableShutdownHooks(); // cerrar conexiones al apagar (Cloud Run, Docker)
app.enableCors({ origin: ['http://localhost:4000', 'http://localhost:4300'] }); // dejar entrar a web y panel
```

`enableShutdownHooks()` hace que Nest escuche señales como `SIGTERM` y llame
a `onModuleDestroy`, que es donde `PrismaService` cierra la conexión.

## Cómo se ejecuta en Nx

```bash
pnpm exec nx serve api   # desarrollo, se recarga al guardar
pnpm exec nx build api   # compila a dist/apps/api
pnpm exec nx test api    # pruebas unitarias
```

Nx también tiene generadores para Nest, el equivalente al `nest g` de la CLI
de Nest. Por ejemplo, para crear un módulo:

```bash
pnpm exec nx g @nx/nest:module apps/api/src/app/towns/towns --dry-run
```

:::tip Siempre con --dry-run primero
`--dry-run` muestra qué archivos crearía sin tocar nada. Usalo para confirmar
las rutas antes de generar de verdad.
:::

## Errores comunes

- **`Cannot GET /health`**: falta el prefijo. La ruta es `/api/health`.
- **El puerto ya está en uso** (`EADDRINUSE`): quedó otra API corriendo. Cortala o cambiá `PORT`.
- **Nest no encuentra una dependencia al arrancar**: lo vemos en el tema de providers.

## Preguntas de entrevista

**1. ¿Qué es NestJS y qué agrega sobre Express?**
Un framework de Node con TypeScript que da una arquitectura: módulos,
controladores, providers con inyección de dependencias y un ciclo de la
petición con middleware, guards, interceptors, pipes y filtros. Usa Express
(o Fastify) por debajo.

**2. ¿Qué es la plataforma en Nest? ¿Por qué elegirías Fastify?**
La librería HTTP que Nest usa por debajo. Express es la opción por defecto y
la más compatible. Fastify es más rápido y tiene validación de esquemas
propia, pero algunos middleware de Express no funcionan con él.

**3. ¿Qué hace `NestFactory.create`?**
Crea la aplicación a partir del módulo raíz: recorre los módulos, arma el
contenedor de dependencias, instancia los providers y registra las rutas.

**4. ¿Para qué sirve `enableShutdownHooks`?**
Para que Nest reaccione a señales de apagado (`SIGTERM`) y llame a los hooks
como `onModuleDestroy`, así se cierran conexiones a la base antes de morir el proceso.

**5. ¿En qué se parece Nest a Angular?**
En la organización con módulos, la inyección de dependencias con
`@Injectable`, los decoradores, los guards y los interceptors con RxJS.
Los pipes cambian de rol: en Nest validan y transforman la entrada.

## Glosario

| Término | Qué es |
| --- | --- |
| Plataforma | Librería HTTP que usa Nest por debajo (Express o Fastify). |
| Módulo raíz | `AppModule`, el primer módulo que carga Nest. |
| Bootstrap | La función que crea y arranca la aplicación. |
| Prefijo global | Parte de la ruta que comparten todos los endpoints (`/api`). |
| Shutdown hooks | Hooks que Nest llama al apagarse la aplicación. |
