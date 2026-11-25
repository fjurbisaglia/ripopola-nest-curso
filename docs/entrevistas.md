---
title: Repaso para entrevistas
sidebar_label: Repaso para entrevistas
sidebar_position: 99
slug: /entrevistas
description: Todas las preguntas de entrevista del curso en un solo lugar, por sección, con la respuesta escondida para practicar.
---

# Repaso para entrevistas

Todas las preguntas del curso, en orden. Leé la pregunta, respondé en voz
alta como si estuvieras en la entrevista y recién después abrí la
respuesta. El enlace de cada tema lleva a la explicación completa.

:::tip Cómo practicar
Respondé con un ejemplo de ripopola siempre que puedas: "en mi proyecto,
la búsqueda de pueblos cercanos usa…". Un ejemplo real vale más que una
definición de memoria.
:::

## 1. Fundamentos de NestJS

### [Qué es NestJS y cómo arranca la API](./01-fundamentos/01-que-es-nest.md)

<details>
<summary>¿Qué es NestJS y qué agrega sobre Express?</summary>

Un framework de Node con TypeScript que da una arquitectura: módulos,
controladores, providers con inyección de dependencias y un ciclo de la
petición con middleware, guards, interceptors, pipes y filtros. Usa Express
(o Fastify) por debajo.

</details>

<details>
<summary>¿Qué es la plataforma en Nest? ¿Por qué elegirías Fastify?</summary>

La librería HTTP que Nest usa por debajo. Express es la opción por defecto y
la más compatible. Fastify es más rápido y tiene validación de esquemas
propia, pero algunos middleware de Express no funcionan con él.

</details>

<details>
<summary>¿Qué hace `NestFactory.create`?</summary>

Crea la aplicación a partir del módulo raíz: recorre los módulos, arma el
contenedor de dependencias, instancia los providers y registra las rutas.

</details>

<details>
<summary>¿Para qué sirve `enableShutdownHooks`?</summary>

Para que Nest reaccione a señales de apagado (`SIGTERM`) y llame a los hooks
como `onModuleDestroy`, así se cierran conexiones a la base antes de morir el proceso.

</details>

<details>
<summary>¿En qué se parece Nest a Angular?</summary>

En la organización con módulos, la inyección de dependencias con
`@Injectable`, los decoradores, los guards y los interceptors con RxJS.
Los pipes cambian de rol: en Nest validan y transforman la entrada.

</details>

### [Módulos](./01-fundamentos/02-modulos.md)

<details>
<summary>¿Qué es un módulo en Nest y para qué sirve?</summary>

Una clase con `@Module()` que agrupa controladores y providers de un mismo
dominio. Define qué usa de otros módulos (`imports`) y qué comparte (`exports`).
Sirve para organizar y encapsular.

</details>

<details>
<summary>Si un servicio de un módulo necesita un servicio de otro, ¿qué hacés?</summary>

El módulo dueño lo exporta y el módulo que lo usa importa ese módulo.
Después se inyecta en el constructor.

</details>

<details>
<summary>¿Qué hace `@Global()` y cuándo lo usarías?</summary>

Hace que los exports del módulo estén disponibles en toda la app sin
importarlo. Solo para infraestructura transversal como base de datos o
configuración, porque esconde las dependencias.

</details>

<details>
<summary>¿Qué es un módulo dinámico? ¿Diferencia entre `forRoot` y `forFeature`?</summary>

Un módulo que se configura al importarlo, devolviendo un `DynamicModule`
desde un método estático. `forRoot` configura una vez para toda la app;
`forFeature` agrega configuración de cada módulo de negocio sobre esa base.

</details>

<details>
<summary>¿Los providers son singletons?</summary>

Por defecto sí: una instancia por aplicación, compartida por todos los
módulos que importan el módulo que los exporta.

</details>

<details>
<summary>¿Qué es un monolito modular y cómo lo ayuda Nest?</summary>

Una sola aplicación desplegable dividida en módulos con fronteras claras.
Nest lo facilita porque cada módulo encapsula sus providers y solo comparte
lo que exporta. Si un módulo necesita escalar aparte, se puede extraer.

</details>

### [Controladores](./01-fundamentos/03-controladores.md)

<details>
<summary>¿Qué responsabilidad tiene un controlador?</summary>

Recibir la petición, extraer los datos de entrada, delegar en un servicio y
devolver la respuesta. No tiene lógica de negocio ni acceso directo a la base.

</details>

<details>
<summary>¿Diferencia entre `@Param`, `@Query` y `@Body`?</summary>

`@Param` lee la ruta (`/towns/:slug`), `@Query` lee la query string
(`?country=ES`) y `@Body` lee el cuerpo de la petición.

</details>

<details>
<summary>¿Qué códigos de estado devuelve Nest por defecto?</summary>

200 para todo salvo `POST`, que devuelve 201. Se cambia con `@HttpCode()`.

</details>

<details>
<summary>¿Por qué evitar `@Res()`?</summary>

Porque Nest deja de manejar la respuesta: no se aplican interceptors ni
serialización y tenés que responder a mano. Si hace falta, usar `passthrough: true`.

</details>

<details>
<summary>¿Diferencia entre `PUT` y `PATCH`?</summary>

`PUT` reemplaza el recurso entero; `PATCH` modifica solo los campos enviados.

</details>

<details>
<summary>¿Qué significa que un método sea idempotente?</summary>

Que repetir la misma petición deja el sistema en el mismo estado. `GET`,
`PUT` y `DELETE` lo son; `POST` no.

</details>

<details>
<summary>¿Por qué importa el orden de las rutas?</summary>

Porque Nest (Express) las evalúa en orden, y una ruta con parámetro como
`:slug` atrapa cualquier valor, incluso `nearby`.

</details>

### [Providers e inyección de dependencias](./01-fundamentos/04-providers-e-inyeccion.md)

<details>
<summary>¿Qué es la inyección de dependencias y qué ventajas tiene?</summary>

Recibir las dependencias desde afuera (en el constructor) en vez de crearlas.
Bajo acoplamiento, instancias compartidas y pruebas con dobles.

</details>

<details>
<summary>¿Qué es la inversión de control?</summary>

Que el framework, y no tu código, controla la creación y el ciclo de vida de
los objetos. La DI es una forma de aplicarla.

</details>

<details>
<summary>¿Cómo sabe Nest qué inyectar?</summary>

Por los metadatos de tipos que emite TypeScript (`emitDecoratorMetadata`) y
lee `reflect-metadata`. El tipo del parámetro funciona como token.

</details>

<details>
<summary>¿Por qué no podés inyectar una interfaz directamente?</summary>

Porque las interfaces no existen en JavaScript. Se usa un token (`Symbol` o
string) con `@Inject(token)`.

</details>

<details>
<summary>Explicá `useClass`, `useValue`, `useFactory` y `useExisting`.</summary>

`useClass` elige la clase que implementa un token; `useValue` entrega un
valor hecho; `useFactory` crea el valor con una función que puede recibir
otras dependencias; `useExisting` es un alias de otro provider.

</details>

<details>
<summary>¿Qué scopes hay y cuál usarías?</summary>

`DEFAULT` (singleton), `REQUEST` (uno por petición) y `TRANSIENT` (uno por
consumidor). Singleton salvo un motivo claro: `REQUEST` se contagia a todo lo
que lo inyecta y cuesta rendimiento.

</details>

<details>
<summary>¿Cómo probás un servicio que usa la base de datos?</summary>

En pruebas unitarias, con `Test.createTestingModule` y un doble del cliente
de base (`useValue`). Para probar las consultas reales, pruebas de
integración contra un PostgreSQL de verdad (en ripopola, con PostGIS).

</details>

<details>
<summary>¿Cómo diseñarías la integración con un proveedor de IA para poder cambiarlo?</summary>

Una interfaz propia (`TranslationProvider`), un token, un adaptador por
proveedor y el módulo eligiendo la implementación (con `useFactory` según la
configuración). El SDK del proveedor no sale del adaptador.

</details>

### [DTOs y validación](./01-fundamentos/05-dtos-y-validacion.md)

<details>
<summary>¿Qué es un DTO y por qué no usar directamente el modelo de la base?</summary>

Una clase que define la forma de los datos de un endpoint. Separa el contrato
de la API del modelo de la base, evita exponer o recibir campos internos y
permite validar cada operación por separado.

</details>

<details>
<summary>¿Por qué en Nest los DTOs son clases y no interfaces?</summary>

Porque las interfaces desaparecen al compilar y los decoradores de validación
necesitan algo que exista en runtime.

</details>

<details>
<summary>¿Qué es la asignación masiva y cómo la evitás en Nest?</summary>

Que el cliente mande campos que no debería (`published`, `role`, `id`) y se
guarden. Se evita con `whitelist: true` (y `forbidNonWhitelisted` para
rechazarlos) y con DTOs que solo tengan lo permitido.

</details>

<details>
<summary>¿Qué hace `transform: true`?</summary>

Convierte el objeto plano en una instancia del DTO y transforma los tipos
primitivos de parámetros y query (por ejemplo, de texto a número).

</details>

<details>
<summary>¿Para qué sirve `PartialType`?</summary>

Para crear un DTO con las mismas propiedades y validaciones que otro, pero
opcionales. Típico para `UpdateDto` a partir de `CreateDto`.

</details>

<details>
<summary>Si ya validás en el frontend, ¿por qué validar en el backend?</summary>

Porque cualquiera puede llamar a la API sin pasar por el frontend. La
validación del frontend es experiencia de usuario; la del backend es seguridad e integridad.

</details>

<details>
<summary>¿Cómo compartís tipos entre un frontend (Next o Angular) y una API Nest en un monorepo?</summary>

Con interfaces en una librería compartida que los DTOs del backend
implementan. Los DTOs con decoradores se quedan en el backend.

</details>

<details>
<summary>¿Alternativas a class-validator?</summary>

Zod o Valibot con un pipe propio (o librerías como `nestjs-zod`). Ventaja:
el esquema sirve para validar y para inferir el tipo. Desventaja: no es lo
que trae Nest por defecto.

</details>

### [Pipes](./01-fundamentos/06-pipes.md)

<details>
<summary>¿Qué es un pipe en Nest?</summary>

Una clase que transforma o valida un valor de entrada antes de que llegue al
controlador. Si la validación falla, tira una excepción y el controlador no se ejecuta.

</details>

<details>
<summary>¿Qué diferencia hay entre los pipes de Nest y los de Angular?</summary>

En Angular formatean datos para mostrar en la plantilla. En Nest procesan la
entrada del controlador: transforman o validan.

</details>

<details>
<summary>¿En qué niveles se puede aplicar un pipe?</summary>

Parámetro, método, controlador y global (con `APP_PIPE` o `useGlobalPipes`).

</details>

<details>
<summary>¿Cómo harías un pipe propio?</summary>

Una clase con `@Injectable()` que implementa `PipeTransform` y su método
`transform`. Devuelve el valor transformado o tira `BadRequestException`.

</details>

<details>
<summary>¿Cuándo se ejecutan los pipes en el ciclo de la petición?</summary>

Después de los guards y de la parte "antes" de los interceptors, justo antes del controlador.

</details>

<details>
<summary>¿Validarías que un pueblo existe en un pipe?</summary>

No. El pipe se ocupa de la forma del dato; si existe o no es lógica de
negocio y va en el servicio, que responde 404.

</details>

### [Manejo de errores y filtros de excepciones](./01-fundamentos/07-manejo-de-errores.md)

<details>
<summary>¿Qué pasa en Nest si un error no es una `HttpException`?</summary>

La capa de excepciones lo atrapa y responde 500 con un mensaje genérico, sin
detalles internos.

</details>

<details>
<summary>¿Qué es un exception filter y para qué lo usarías?</summary>

Una clase con `@Catch()` que controla la respuesta para ciertos errores. Para
traducir errores de librerías a HTTP, unificar el formato y loguear en un solo lugar.

</details>

<details>
<summary>¿Diferencia entre 401 y 403?</summary>

401: no autenticado (no sé quién sos). 403: autenticado pero sin permiso.

</details>

<details>
<summary>¿Qué código devolvés si se intenta crear un recurso con un campo único repetido?</summary>

409 Conflict.

</details>

<details>
<summary>¿Alcanza con buscar antes de insertar para evitar duplicados?</summary>

No: entre la búsqueda y la inserción otra petición puede insertar el mismo
valor (condición de carrera). Hace falta una restricción única en la base;
la búsqueda previa solo mejora el mensaje.

</details>

<details>
<summary>¿Qué es `ArgumentsHost`?</summary>

Un objeto que da acceso a los argumentos del contexto actual. Con
`switchToHttp()` obtenés el request y el response; también existe para
WebSockets y microservicios.

</details>

<details>
<summary>¿Qué información nunca devolverías en un error?</summary>

Stack traces, SQL, nombres de tablas, rutas del servidor, secretos. Eso va al log.

</details>

### [Middleware](./01-fundamentos/08-middleware.md)

<details>
<summary>¿Qué es un middleware en Nest?</summary>

Una función que se ejecuta antes del ruteo, con acceso a request, response y
`next()`. Puede modificar la petición, responder o pasar al siguiente.

</details>

<details>
<summary>¿Diferencia entre middleware y guard?</summary>

El middleware no sabe qué controlador ni método se va a ejecutar; el guard
sí (tiene el `ExecutionContext`). Por eso la autorización va en guards.

</details>

<details>
<summary>¿Cómo registrás un middleware?</summary>

En un módulo que implementa `NestModule`, con `consumer.apply(...).forRoutes(...)`,
o global con `app.use()` en `main.ts`.

</details>

<details>
<summary>¿Qué es un request id y para qué sirve?</summary>

Un identificador único por petición que se propaga a los logs y a la
respuesta, para rastrear todo lo que pasó en una petición concreta.

</details>

<details>
<summary>¿Qué middleware de seguridad pondrías en una API?</summary>

Helmet para cabeceras de seguridad, CORS restringido a los orígenes propios y,
según el caso, límite de tamaño del body y rate limiting.

</details>

### [Guards](./01-fundamentos/09-guards.md)

<details>
<summary>¿Qué es un guard y qué devuelve?</summary>

Una clase que implementa `CanActivate` y decide si la petición sigue.
Devuelve un booleano (o Promise u Observable); `false` produce 403. También
puede tirar una excepción propia.

</details>

<details>
<summary>¿Por qué la autorización va en un guard y no en un middleware?</summary>

Porque el guard tiene `ExecutionContext` y sabe qué handler se ejecuta, así
puede leer metadatos como roles o `@Public()`. El middleware no lo sabe.

</details>

<details>
<summary>¿Qué es mejor: proteger endpoint por endpoint o un guard global con excepciones?</summary>

Global con `@Public()` para las excepciones: si te olvidás de algo, queda cerrado.

</details>

<details>
<summary>¿Por qué usar `timingSafeEqual` para comparar claves?</summary>

Porque `===` corta en el primer carácter distinto y el tiempo de respuesta
filtra información. La comparación en tiempo constante evita ese ataque.

</details>

<details>
<summary>¿En qué se diferencia un guard de Angular de uno de Nest?</summary>

El de Angular protege la navegación del lado del cliente y es evitable. El
de Nest protege los datos en el servidor: es el control de seguridad real.

</details>

### [Interceptors](./01-fundamentos/10-interceptors.md)

<details>
<summary>¿Qué es un interceptor y qué puede hacer que un guard no?</summary>

Envuelve la ejecución del handler: puede actuar después de la respuesta,
transformarla, convertir errores o devolver otra cosa sin llamar al
controlador. El guard solo decide si se entra.

</details>

<details>
<summary>¿Por qué los interceptors usan RxJS?</summary>

Porque `next.handle()` devuelve un Observable, lo que permite componer
operadores sobre la respuesta (o el stream, si el handler emite varios valores).

</details>

<details>
<summary>Dá tres usos típicos.</summary>

Logging y métricas de tiempo, caché, timeouts, transformación o
serialización de respuestas, mapeo de errores.

</details>

<details>
<summary>¿Qué es AOP?</summary>

Programación orientada a aspectos: separar preocupaciones transversales
(logs, seguridad, caché) del código de negocio y aplicarlas de forma declarativa.

</details>

### [El ciclo completo de una petición](./01-fundamentos/11-ciclo-de-una-peticion.md)

<details>
<summary>¿En qué orden se ejecutan middleware, guards, interceptors, pipes y filtros?</summary>

Middleware, guards, interceptors (antes), pipes, handler, interceptors
(después). Los filtros entran cuando hay una excepción.

</details>

<details>
<summary>Si un guard rechaza la petición, ¿se ejecutan los pipes?</summary>

No. Los pipes van después de los guards, así que un 401/403 sale antes de validar el body.

</details>

<details>
<summary>¿En qué orden se aplican un interceptor global y uno de método?</summary>

A la ida, primero el global y después el de método. A la vuelta, al revés.

</details>

<details>
<summary>¿Qué filtro maneja una excepción si hay uno de método y uno global?</summary>

El más específico (el del método), si coincide con el tipo de error.

</details>

### [Decoradores propios y metadata](./01-fundamentos/12-decoradores-propios.md)

<details>
<summary>¿Qué es un decorador y cuándo se ejecuta?</summary>

Una función que se aplica a una clase o sus miembros al definirlos (al
cargar el módulo), no en cada llamada. En Nest se usan para declarar metadata.

</details>

<details>
<summary>¿Cómo leerías un rol requerido desde un guard?</summary>

Con `Reflector`: `getAllAndOverride(Roles, [context.getHandler(), context.getClass()])`.

</details>

<details>
<summary>¿Para qué sirve `createParamDecorator`?</summary>

Para crear decoradores de parámetro que extraen algo del contexto, como el
usuario autenticado, sin acoplar el controlador al request de Express.

</details>

<details>
<summary>¿Qué hace `applyDecorators`?</summary>

Junta varios decoradores en uno, para no repetirlos y para que la intención quede clara.

</details>

<details>
<summary>¿Qué diferencia hay entre `getAllAndOverride` y `getAllAndMerge`?</summary>

El primero devuelve el primer valor encontrado (el método pisa al
controlador). El segundo junta los valores de los dos (por ejemplo, roles del controlador más roles del método).

</details>

### [Ciclo de vida, scopes y módulos dinámicos](./01-fundamentos/13-ciclo-de-vida-y-modulos-dinamicos.md)

<details>
<summary>Nombrá los hooks de ciclo de vida de Nest y cuándo corren.</summary>

`onModuleInit` (al resolver el módulo), `onApplicationBootstrap` (todo
listo), y al apagar `onModuleDestroy`, `beforeApplicationShutdown` y
`onApplicationShutdown`. Los de apagado requieren `enableShutdownHooks()`.

</details>

<details>
<summary>¿Qué problema tiene `Scope.REQUEST`?</summary>

Se propaga a todo lo que lo inyecta, crea instancias por petición y baja el
rendimiento. Para datos por petición conviene `AsyncLocalStorage`.

</details>

<details>
<summary>¿Qué es un módulo dinámico y cómo lo armarías?</summary>

Un módulo que recibe configuración al importarse y devuelve un
`DynamicModule`. Con `ConfigurableModuleBuilder` se generan `forRoot` y
`forRootAsync` con un token de opciones inyectable.

</details>

<details>
<summary>¿Para qué sirve `forRootAsync`?</summary>

Para configurar el módulo con valores que dependen de otros providers (como
`ConfigService`) usando `useFactory` e `inject`.

</details>

<details>
<summary>¿Cómo resolvés una dependencia circular?</summary>

Primero rediseñando: extraer lo común a otro módulo o desacoplar con eventos.
Si no hay otra, `forwardRef()` en los dos lados.

</details>

## 2. Base de datos con Prisma

### [Bases relacionales y el SQL que tenés que saber](./02-prisma/01-bases-relacionales.md)

<details>
<summary>¿Diferencia entre clave primaria, única y foránea?</summary>

La primaria identifica la fila y no cambia; la única impide repetidos en otra
columna; la foránea apunta a otra tabla y garantiza integridad referencial.

</details>

<details>
<summary>¿Cómo modelás una relación muchos a muchos?</summary>

Con una tabla intermedia con las dos FK, que puede guardar datos propios de la relación (rol, fecha).

</details>

<details>
<summary>¿Qué es ACID?</summary>

Atomicidad, consistencia, aislamiento y durabilidad: las garantías de una transacción.

</details>

<details>
<summary>¿Diferencia entre `INNER JOIN` y `LEFT JOIN`?</summary>

`INNER` devuelve solo filas con coincidencia en ambas tablas; `LEFT`
devuelve todas las de la izquierda, con `NULL` donde no hay coincidencia.

</details>

<details>
<summary>¿`WHERE` o `HAVING`?</summary>

`WHERE` filtra filas antes de agrupar; `HAVING` filtra grupos después de `GROUP BY`.

</details>

<details>
<summary>¿Cuándo elegirías MongoDB en vez de PostgreSQL?</summary>

Con datos de forma muy variable, sin relaciones fuertes y mucho volumen de
escritura. Para datos relacionados con reglas de integridad, PostgreSQL.

</details>

<details>
<summary>¿UUID o autoincremental?</summary>

UUID si los ids se exponen o se generan fuera de la base; mejor v7 por
rendimiento de índices. Autoincremental es más chico y rápido, pero revela volumen y es adivinable.

</details>

### [Modelar con Prisma](./02-prisma/02-modelar-con-prisma.md)

<details>
<summary>¿Cuándo usarías una columna JSONB en vez de columnas o tablas?</summary>

Para datos semiestructurados que se leen enteros y rara vez se filtran. Lo
que se filtra, ordena o relaciona va en columnas o tablas.

</details>

<details>
<summary>¿Por qué un enum y no un booleano para el estado?</summary>

Porque hay más de dos estados posibles y el enum documenta y restringe los valores válidos.

</details>

<details>
<summary>¿Cómo guardarías precios?</summary>

`Decimal` o enteros en la unidad menor, con la moneda en otra columna. Nunca `float`.

</details>

<details>
<summary>¿Qué hacen `@map` y `@@map`?</summary>

Mapean el nombre del campo o del modelo a otro nombre de columna o tabla en la base.

</details>

<details>
<summary>¿Qué es schema-first?</summary>

Que el schema es la fuente de verdad y de él se generan la base y los tipos (Prisma), frente a code-first, donde son las clases (TypeORM).

</details>

### [Migraciones en el día a día](./02-prisma/03-migraciones.md)

<details>
<summary>¿Qué diferencia hay entre `migrate dev` y `migrate deploy`?</summary>

`dev` genera y aplica migraciones, y puede resetear la base; es para
desarrollo. `deploy` solo aplica las pendientes; es para CI y producción.

</details>

<details>
<summary>¿Cómo renombrás una columna con datos sin perderlos ni cortar el servicio?</summary>

Expand and contract: agregar la nueva, copiar los datos, desplegar el código
que la usa y borrar la vieja en una migración posterior.

</details>

<details>
<summary>¿Por qué no usar `synchronize` o `db push` en producción?</summary>

Porque aplican cambios sin historial ni revisión, y pueden borrar columnas con datos.

</details>

<details>
<summary>Si hacés rollback del código, ¿qué pasa con la base?</summary>

Nada: la migración sigue aplicada. Por eso los cambios de esquema deben ser
compatibles con la versión anterior del código.

</details>

<details>
<summary>¿Qué es el drift?</summary>

Diferencia entre el estado real de la base y lo que dicen las migraciones, normalmente por cambios manuales.

</details>

### [CRUD completo de pueblos con Prisma](./02-prisma/04-crud-completo.md)

<details>
<summary>¿Diferencia entre `findUnique` y `findFirst`?</summary>

`findUnique` busca por un campo único y usa su índice; `findFirst` acepta cualquier filtro y devuelve el primero según el orden.

</details>

<details>
<summary>¿Por qué usar `select` en vez de devolver la entidad completa?</summary>

Menos datos desde la base y por la red, y ningún riesgo de exponer campos internos.

</details>

<details>
<summary>¿Cómo devolvés una lista paginada con el total?</summary>

Dos consultas (`findMany` con `skip`/`take` y `count`) en una transacción, y una respuesta con `items`, `total`, `page` y `pageSize`.

</details>

<details>
<summary>¿Qué es un upsert?</summary>

Insertar si no existe y actualizar si existe, en una sola operación atómica.

</details>

<details>
<summary>¿Cómo modelarías "publicar un pueblo" en una API REST?</summary>

Como acción propia (`POST /towns/:id/publish`) para darle su permiso, validación y evento, en vez de un `PATCH` de un campo.

</details>

### [Búsquedas y filtros](./02-prisma/05-busquedas-y-filtros.md)

<details>
<summary>¿Cómo armás un filtro con parámetros opcionales en Prisma?</summary>

Pasando `undefined` en los que no vienen: Prisma los ignora. `null` en cambio filtra por `IS NULL`.

</details>

<details>
<summary>¿Cómo harías una búsqueda que ignore tildes en PostgreSQL?</summary>

Con la extensión `unaccent` aplicada a la columna y al término, idealmente con un índice de expresión.

</details>

<details>
<summary>¿`ILIKE '%x%'` usa índices?</summary>

Un índice B-tree normal no. Hace falta un índice trigram (`pg_trgm`, GIN) o full-text search.

</details>

<details>
<summary>¿Cuándo pasarías a un motor de búsqueda externo?</summary>

Cuando necesitás relevancia avanzada, tolerancia a errores de tipeo, facetas a gran escala o el volumen supera lo razonable para PostgreSQL. Antes, full-text search y pg_trgm suelen alcanzar.

</details>

### ['Paginación: offset contra cursor'](./02-prisma/06-paginacion.md)

<details>
<summary>¿Por qué el `OFFSET` es lento con valores grandes?</summary>

Porque la base tiene que recorrer y descartar todas las filas anteriores antes de devolver las que pediste.

</details>

<details>
<summary>¿Qué es la paginación por cursor?</summary>

Pedir los registros posteriores a uno dado según un orden indexado. Es estable y de costo constante.

</details>

<details>
<summary>¿Por qué el orden tiene que ser único?</summary>

Porque si hay empates, el orden entre consultas no está garantizado y aparecen repetidos o faltantes.

</details>

<details>
<summary>¿Cuándo usarías cada una?</summary>

Offset para tablas con número de página y volumen moderado; cursor para feeds, scroll infinito y listas grandes.

</details>

### [Lógica antes de guardar y Client Extensions](./02-prisma/07-logica-antes-de-guardar.md)

<details>
<summary>¿Dónde pondrías la generación de un slug?</summary>

En el servicio, con una función pura probada, y una restricción única en la base como garantía final.

</details>

<details>
<summary>¿Qué son las Prisma Client Extensions?</summary>

Una forma de extender el cliente: agregar métodos, campos calculados o interceptar consultas de un modelo.

</details>

<details>
<summary>¿Qué problema tienen los hooks de entidad de TypeORM?</summary>

Esconden lógica y no se ejecutan en todas las operaciones (por ejemplo, `update` o el QueryBuilder no disparan `@BeforeUpdate`).

</details>

<details>
<summary>¿Qué hace `normalize('NFD')`?</summary>

Descompone los caracteres acentuados en letra base más marca diacrítica, para poder borrar las tildes.

</details>

### [SQL crudo y TypedSQL](./02-prisma/08-sql-crudo-y-typedsql.md)

<details>
<summary>¿Qué es la inyección SQL y cómo se previene?</summary>

Meter SQL dentro de un dato para alterar la consulta. Se previene con
consultas parametrizadas, nunca concatenando valores en el texto del SQL.

</details>

<details>
<summary>¿Por qué `$queryRaw` es seguro y `$queryRawUnsafe` no?</summary>

El primero usa un template literal que envía cada valor como parámetro; el segundo recibe un string ya armado.

</details>

<details>
<summary>¿Cómo parametrizás un nombre de columna?</summary>

No se puede: se valida contra una lista cerrada de valores permitidos.

</details>

<details>
<summary>¿Qué aporta TypedSQL?</summary>

Tipos generados a partir de la consulta real, validados contra la base, en vez de un tipo genérico que el desarrollador "promete".

</details>

### [Índices y rendimiento de consultas](./02-prisma/09-indices-y-rendimiento.md)

<details>
<summary>¿Qué es un índice y qué costo tiene?</summary>

Una estructura ordenada que acelera búsquedas; cuesta espacio y hace más lentas las escrituras.

</details>

<details>
<summary>Tengo un índice en `(country, status)`. ¿Sirve para filtrar solo por `status`?</summary>

No en general: un índice compuesto se usa desde la columna de la izquierda.

</details>

<details>
<summary>¿Qué es el problema N+1?</summary>

Hacer una consulta para una lista y otra por cada elemento para traer sus
relaciones. Se resuelve trayendo las relaciones en lote (`include`, joins).

</details>

<details>
<summary>¿Para qué sirve `EXPLAIN ANALYZE`?</summary>

Para ver el plan real de ejecución: si usa índices, cuántas filas lee y cuánto tarda cada paso.

</details>

<details>
<summary>¿Qué índice usarías para una columna array o JSONB?</summary>

GIN.

</details>

### [Prisma, TypeORM, Drizzle y Mongoose](./02-prisma/10-orms-del-mercado.md)

<details>
<summary>¿Por qué elegiste Prisma y no TypeORM?</summary>

Por los tipos generados que siguen al schema, las migraciones en SQL
editables y la claridad de un único schema. TypeORM es más flexible con
patrones como Active Record, pero sus tipos son menos estrictos.

</details>

<details>
<summary>¿Qué es `synchronize` en TypeORM y por qué es peligroso?</summary>

Sincroniza el esquema con las entidades al arrancar, sin migraciones; en
producción puede borrar columnas con datos.

</details>

<details>
<summary>¿Active Record o Data Mapper?</summary>

Active Record: la entidad se guarda sola (`town.save()`). Data Mapper: un
repositorio separado guarda entidades planas. Data Mapper separa mejor
dominio y persistencia y se prueba más fácil.

</details>

## 3. Relaciones y transacciones

### [Uno a muchos y uno a uno](./03-relaciones/01-uno-a-muchos.md)

<details>
<summary>En una relación uno a muchos, ¿dónde va la clave foránea?</summary>

En la tabla del lado "muchos" (cada foto apunta a su pueblo).

</details>

<details>
<summary>¿Cómo hacés una relación uno a uno?</summary>

Con una FK con restricción única en una de las dos tablas.

</details>

<details>
<summary>¿Las claves foráneas tienen índice automático en PostgreSQL?</summary>

No. La PK sí, pero la FK no: conviene crearlo para joins y borrados.

</details>

<details>
<summary>¿Qué diferencia hay entre `Cascade` y `Restrict`?</summary>

`Cascade` borra los hijos con el padre; `Restrict` impide borrar el padre si tiene hijos.

</details>

### [Muchos a muchos con datos propios](./03-relaciones/02-muchos-a-muchos.md)

<details>
<summary>¿Cuándo usarías una tabla intermedia explícita?</summary>

Cuando la relación tiene atributos propios (rol, fechas) o necesito controlar sus índices y nombres.

</details>

<details>
<summary>¿Cómo evitás membresías duplicadas?</summary>

Con una clave primaria o única compuesta sobre las dos FK.

</details>

<details>
<summary>¿Por qué separar rol de plataforma y rol por organización?</summary>

Porque responden preguntas distintas: qué puede hacer alguien en todo el
sistema y qué puede hacer dentro de una organización concreta.

</details>

### [Consultas y escrituras con relaciones](./03-relaciones/03-consultas-con-relaciones.md)

<details>
<summary>¿`include` o `select`?</summary>

`select` cuando sabés qué campos necesitás: menos datos y sin exponer campos internos.

</details>

<details>
<summary>¿Cómo traés pueblos que tengan al menos una vivienda en alquiler?</summary>

`where: { housing: { some: { operation: 'RENT' } } }`.

</details>

<details>
<summary>¿Qué son las escrituras anidadas y qué garantía dan?</summary>

Crear, conectar o borrar relaciones en la misma operación; Prisma las ejecuta en una transacción.

</details>

<details>
<summary>¿Por qué no devolver directamente lo que da la base?</summary>

Porque el contrato de la API debe ser estable y cómodo para el cliente, independiente de cómo se guardan los datos.

</details>

### [Transacciones](./03-relaciones/04-transacciones.md)

<details>
<summary>¿Qué es una transacción y cuándo la usás?</summary>

Un grupo de operaciones atómico. Cuando varias escrituras tienen que quedar todas o ninguna.

</details>

<details>
<summary>¿Por qué no llamar a una API externa dentro de una transacción?</summary>

Porque la transacción mantiene bloqueos y una conexión ocupadas mientras espera, y si falla no podés deshacer la llamada externa.

</details>

<details>
<summary>¿Qué es el bloqueo optimista y cuándo lo preferís al pesimista?</summary>

Detectar conflictos al guardar comparando una versión, sin bloquear al leer.
Es mejor cuando los conflictos son raros, como en la edición de fichas.

</details>

<details>
<summary>¿Qué nivel de aislamiento usa PostgreSQL por defecto?</summary>

Read Committed.

</details>

<details>
<summary>¿Qué es un lost update?</summary>

Cuando dos transacciones leen el mismo dato, lo modifican y la segunda pisa los cambios de la primera.

</details>

### [Borrado en cascada y borrado lógico](./03-relaciones/05-borrado.md)

<details>
<summary>¿Qué es el soft delete y qué problemas trae?</summary>

Marcar como borrado en vez de borrar. Problemas: filtrar en todas las
consultas, conflictos con únicos, crecimiento y cumplimiento legal.

</details>

<details>
<summary>¿Cómo garantizás unicidad solo entre registros activos?</summary>

Con un índice único parcial (`WHERE deleted_at IS NULL`).

</details>

<details>
<summary>¿Cómo conciliás soft delete con el RGPD?</summary>

Los datos personales se borran o anonimizan de verdad cuando se pide; el soft delete se usa para datos de negocio.

</details>

### [Seed y carga masiva](./03-relaciones/06-seed.md)

<details>
<summary>¿Qué es un seed y qué características debe tener?</summary>

Un script que carga datos iniciales; debe ser idempotente, versionado y no correr con datos falsos en producción.

</details>

<details>
<summary>¿Por qué no exponer un endpoint para resembrar la base?</summary>

Porque si llega a producción (o alguien lo llama) borra datos reales. Es una operación de desarrollo.

</details>

<details>
<summary>¿Cómo insertás 50.000 filas de forma eficiente?</summary>

En lotes con inserción múltiple (`createMany`), o con `COPY` si son muchísimas; nunca una por una.

</details>

## 4. Datos geográficos con PostGIS

### [Coordenadas, SRID y GeoJSON](./04-postgis/01-coordenadas-y-geojson.md)

<details>
<summary>¿Qué es un SRID y cuál usa el GPS?</summary>

El identificador del sistema de referencia de las coordenadas. El GPS usa WGS84, SRID 4326.

</details>

<details>
<summary>¿Diferencia entre `geometry` y `geography` en PostGIS?</summary>

`geometry` calcula en un plano; `geography` sobre la esfera y devuelve distancias en metros.

</details>

<details>
<summary>¿Qué índice usás para datos espaciales?</summary>

GiST.

</details>

<details>
<summary>¿En qué orden van las coordenadas en GeoJSON?</summary>

Longitud, latitud.

</details>

### [Leer y escribir datos geográficos con Prisma](./04-postgis/02-leer-y-escribir-geografia.md)

<details>
<summary>¿Cómo integrás una función que tu ORM no soporta?</summary>

Con SQL parametrizado encapsulado en un repositorio o adaptador, para que el resto del código no dependa de ese detalle.

</details>

<details>
<summary>¿Qué es el patrón repositorio?</summary>

Una clase que abstrae el acceso a datos de un agregado, ofreciendo métodos de dominio en vez de consultas.

</details>

<details>
<summary>¿Por qué `PUT` y no `PATCH` para la ubicación?</summary>

Porque se reemplaza el recurso completo (el punto) y la operación es idempotente.

</details>

### [Pueblos cerca de un punto y dentro del mapa](./04-postgis/03-busquedas-geograficas.md)

<details>
<summary>¿Cómo buscás los puntos a menos de X km de forma eficiente en PostGIS?</summary>

Con `ST_DWithin` sobre `geography`, que usa el índice GiST. No con `ST_Distance` en el `WHERE`.

</details>

<details>
<summary>¿Qué es una búsqueda KNN?</summary>

Los K vecinos más cercanos; en PostGIS se ordena con el operador `<->`, que usa el índice.

</details>

<details>
<summary>¿Cómo cargarías en un mapa solo lo visible?</summary>

El cliente manda el bounding box y el backend filtra con `&&` y `ST_MakeEnvelope`, con un límite y clustering en el cliente.

</details>

<details>
<summary>¿Qué harías si son cientos de miles de puntos?</summary>

Vector tiles (`ST_AsMVT`) servidos por teselas, con caché.

</details>

## 5. Configuración y servicios externos

### [Configuración validada con @nestjs/config](./05-configuracion/01-configuracion-validada.md)

<details>
<summary>¿Por qué la configuración va en variables de entorno?</summary>

Para usar la misma build en todos los entornos y no guardar secretos en el
código (Twelve-Factor App).

</details>

<details>
<summary>¿Qué ganás validando la configuración al arrancar?</summary>

Fallar rápido y con un mensaje claro, en vez de errores en runtime o comportamientos silenciosos.

</details>

<details>
<summary>¿Dónde guardarías secretos en producción?</summary>

En un gestor de secretos (Secret Manager, Vault, AWS Secrets Manager), inyectados como variables de entorno.

</details>

<details>
<summary>¿Por qué no poner secretos en variables `NEXT_PUBLIC_*` de Next (o en `environment.ts` de Angular)?</summary>

Porque se compilan dentro del bundle que descarga cualquier navegador.

</details>

### [Llamar a APIs externas desde Nest](./05-configuracion/02-llamar-apis-externas.md)

<details>
<summary>¿Qué cuidados tenés al llamar a un servicio externo?</summary>

Timeout, reintentos con backoff solo para errores transitorios, validar la
respuesta, circuit breaker y aislarlo detrás de una interfaz.

</details>

<details>
<summary>¿Qué es backoff exponencial con jitter?</summary>

Esperas que se duplican entre reintentos, con un componente aleatorio para
que muchos clientes no reintenten al mismo tiempo.

</details>

<details>
<summary>¿Qué es un circuit breaker?</summary>

Un mecanismo que deja de llamar a un servicio que falla repetidamente durante
un tiempo, para no empeorar su caída y fallar rápido.

</details>

<details>
<summary>¿Por qué usar una clase abstracta como token en Nest?</summary>

Porque existe en runtime (a diferencia de una interfaz), así sirve como
token de inyección sin `@Inject()` y define el contrato.

</details>

### [El adaptador de IA para traducciones](./05-configuracion/03-adaptador-de-ia.md)

<details>
<summary>¿Cómo evitás quedar atado a un proveedor de IA?</summary>

Con una interfaz propia por capacidad y un adaptador por proveedor elegido por configuración.

</details>

<details>
<summary>¿Por qué no traducir en la misma petición en que el municipio guarda?</summary>

Porque es lento, puede fallar y tiene costo; se encola y se procesa en segundo plano con reintentos.

</details>

<details>
<summary>¿Cómo evitás traducir dos veces lo mismo?</summary>

Guardando un hash del texto original con cada traducción y comparándolo antes de llamar al modelo.

</details>

<details>
<summary>¿Cómo controlás el gasto?</summary>

Registrando consumo por trabajo, con un límite diario que pausa la cola y un interruptor para apagar la IA.

</details>

## 6. Autenticación y autorización

### [Autenticación y autorización - conceptos](./06-auth/01-conceptos.md)

<details>
<summary>¿Diferencia entre autenticación y autorización?</summary>

Autenticación verifica identidad (401 si falla); autorización verifica permisos (403 si falla).

</details>

<details>
<summary>¿Cómo guardarías contraseñas?</summary>

Con un algoritmo lento y con sal por usuario (Argon2id, scrypt o bcrypt). Nunca texto plano, cifrado reversible ni hashes rápidos.

</details>

<details>
<summary>¿Sesiones o JWT?</summary>

Sesiones cuando importa revocar al instante y hay un almacenamiento compartido (base o Redis); JWT cuando muchos servicios tienen que verificar la identidad sin consultar a nadie. Muchos sistemas combinan sesión en el navegador y JWT cortos entre servicios.

</details>

<details>
<summary>¿Qué es un JWT y qué garantiza?</summary>

Un token con header, payload y firma. Garantiza integridad y origen, no confidencialidad: el payload se puede leer.

</details>

<details>
<summary>¿Cómo revocás un JWT?</summary>

No se puede directamente: se usan expiraciones cortas, refresh tokens revocables y, si hace falta, una lista de revocación.

</details>

<details>
<summary>¿Diferencia entre OAuth 2.0 y OpenID Connect?</summary>

OAuth autoriza acceso delegado a recursos (access token); OIDC agrega identidad con un ID token para autenticar.

</details>

<details>
<summary>Explicá el flujo Authorization Code con PKCE.</summary>

El cliente redirige al proveedor con un `state` y un `code_challenge`; el proveedor devuelve un `code` a la redirect URI; el cliente verifica el `state` y cambia el `code` por tokens enviando el `code_verifier` (y su secreto, si es confidencial); valida el ID token y crea la sesión.

</details>

<details>
<summary>¿Para qué sirven `state`, PKCE y `nonce`?</summary>

`state` evita el CSRF del login; PKCE evita que un `code` interceptado sirva; `nonce` evita reutilizar un ID token viejo.

</details>

<details>
<summary>¿Qué es CSRF y cómo lo evitás con cookies?</summary>

Un sitio ajeno dispara peticiones con las cookies del usuario. Se evita con `SameSite`, verificando el `Origin` y con tokens anti-CSRF, y no cambiando estado con `GET`.

</details>

<details>
<summary>¿RS256 o HS256?</summary>

RS256 (asimétrico) cuando quien verifica no debe poder firmar, por ejemplo con un proveedor externo que publica sus claves en JWKS. HS256 usa un secreto compartido entre quien firma y quien verifica.

</details>

<details>
<summary>¿Qué es el patrón BFF?</summary>

Que el backend sea el cliente OAuth y le dé al navegador solo una cookie de sesión `HttpOnly`, para que ningún token quede expuesto en el JavaScript.

</details>

### [Better Auth dentro de Nest](./06-auth/02-better-auth.md)

<details>
<summary>¿Librería de auth propia o proveedor externo?</summary>

Una librería que corre en tu API (Better Auth, Passport) deja los usuarios en tu base y no cobra por usuario, a cambio de operarla vos. Un proveedor (Firebase, Auth0) te saca la operación pero ata la identidad a un tercero y puede costar al crecer.

</details>

<details>
<summary>¿Por qué el handler de Better Auth se monta antes del body parser?</summary>

Porque necesita leer el cuerpo crudo de la petición; si el parser de Nest lo consume antes, el handler no puede leerlo.

</details>

<details>
<summary>¿Qué tablas necesita un sistema de autenticación con login social?</summary>

Usuarios, sesiones, cuentas (una por método: contraseña, Google…) y verificaciones (códigos de un solo uso, reseteo de contraseña, `state` de OAuth).

</details>

<details>
<summary>¿Por qué no esperar el envío del correo en el registro?</summary>

Para responder rápido y para no revelar, por diferencias de tiempo, si un correo ya existe (*timing attack*).

</details>

<details>
<summary>¿Qué cambia en CORS cuando la autenticación va en cookies?</summary>

Hay que permitir credenciales (`credentials: true`) con una lista explícita de orígenes; no se puede usar el comodín `*`.

</details>

### [La sesión, el usuario y el guard global](./06-auth/03-usuarios-y-guard.md)

<details>
<summary>¿Por qué un guard global con `@Public()` y no `@UseGuards` en cada endpoint?</summary>

Porque un olvido deja el endpoint cerrado, no abierto: es denegar por defecto.

</details>

<details>
<summary>¿Qué hace el servidor para validar una sesión basada en cookie?</summary>

Lee la cookie, verifica su firma, busca la sesión por el token en el almacenamiento (base o Redis), comprueba que no esté vencida y carga al usuario.

</details>

<details>
<summary>¿Roles en la sesión o en la base?</summary>

En la sesión (o en un token) es más rápido pero puede quedar desactualizado; en la base cambian al instante. Para permisos que cambian (membresías de un ayuntamiento), base, con caché corta si hace falta.

</details>

<details>
<summary>¿Qué es el just-in-time provisioning y cuándo lo necesitás?</summary>

Crear el registro local del usuario la primera vez que se autentica. Hace falta cuando la identidad vive en un proveedor externo; con una librería que guarda los usuarios en tu base, el registro ya existe.

</details>

### [Roles, permisos por recurso y decoradores compuestos](./06-auth/04-roles-y-permisos.md)

<details>
<summary>¿Qué es BOLA/IDOR?</summary>

Que un usuario acceda a objetos de otro cambiando el id en la petición, porque la API verifica la autenticación pero no la propiedad del recurso.

</details>

<details>
<summary>¿RBAC o ABAC?</summary>

RBAC decide por rol; ABAC por atributos del usuario, del recurso y del contexto. En la práctica se combinan: roles para acciones, atributos para la propiedad.

</details>

<details>
<summary>¿Dónde pondrías la verificación de que un usuario es dueño del recurso?</summary>

En un servicio de políticas llamado desde la capa de negocio, porque necesita datos del recurso. Un guard sirve si se puede decidir con la ruta y el usuario.

</details>

<details>
<summary>¿Cómo devolvés solo los registros que el usuario puede ver?</summary>

Incluyendo la condición de permiso en la consulta, nunca filtrando en memoria.

</details>

### [Sesiones, Redis, límites y 2FA](./06-auth/05-sesiones-y-2fa.md)

<details>
<summary>¿Qué es una expiración deslizante?</summary>

Una sesión que se extiende mientras se usa y vence tras un período de inactividad, en vez de vencer a una hora fija.

</details>

<details>
<summary>¿Qué trade-off tiene cachear la sesión en una cookie firmada?</summary>

Ahorra una consulta por petición, pero una sesión revocada sigue valiendo hasta que vence la copia en caché.

</details>

<details>
<summary>¿Por qué el rate limiting en memoria no sirve con varias instancias?</summary>

Porque cada instancia cuenta por su lado: el atacante reparte los intentos entre instancias. Hace falta un contador compartido, como Redis.

</details>

<details>
<summary>¿Cómo evitás la enumeración de usuarios?</summary>

Respondiendo igual (y en un tiempo similar) exista o no el correo, en el login, el registro y la recuperación de contraseña.

</details>

<details>
<summary>¿Cómo funciona TOTP?</summary>

Servidor y app comparten un secreto; ambos calculan un código a partir del secreto y la hora actual en ventanas de 30 segundos. El servidor acepta el código si coincide con la ventana actual (o una contigua).

</details>

<details>
<summary>¿Qué riesgo tiene vincular cuentas por correo automáticamente?</summary>

Que un proveedor que no verifica correos permita a un atacante registrar el correo de otra persona y quedarse con su cuenta. Solo se vincula con proveedores que verifican el correo.

</details>

### [Passport y JWT propio (lo que no usamos)](./06-auth/06-passport-y-jwt-propio.md)

<details>
<summary>¿Qué es Passport y cómo se integra con Nest?</summary>

Una librería de estrategias de autenticación. `@nestjs/passport` las expone como guards (`AuthGuard('jwt')`); el `validate()` de la estrategia devuelve el usuario que queda en `request.user`.

</details>

<details>
<summary>¿Qué ponés en el payload de un JWT?</summary>

Lo mínimo: el id del usuario (`sub`), expiración y quizá roles. Nada sensible, porque se puede leer.

</details>

<details>
<summary>¿Por qué el login devuelve el mismo error si el usuario no existe o la contraseña es incorrecta?</summary>

Para no permitir enumerar qué correos están registrados.

</details>

<details>
<summary>¿Harías tu propio sistema de login?</summary>

Solo con requisitos que ni una librería ni un proveedor cubran. Si no, una librería madura (Better Auth) o un proveedor resuelven recuperación, MFA, login social y seguridad con mucho menos riesgo.

</details>

### [Firebase Auth, Auth.js y otros proveedores](./06-auth/07-otros-proveedores.md)

<details>
<summary>¿Qué verifica el backend en un ID token de un proveedor?</summary>

La firma con la clave pública del proveedor (JWKS), el emisor (`iss`), la audiencia (`aud`) y la expiración (`exp`).

</details>

<details>
<summary>¿Verificar un JWT requiere una llamada de red?</summary>

No en cada petición: las claves públicas se descargan y cachean. Comprobar si fue revocado sí requiere consultar al proveedor.

</details>

<details>
<summary>¿Qué es JWKS?</summary>

Un documento JSON publicado por el emisor con sus claves públicas, identificadas por `kid`, para que cualquiera pueda verificar sus firmas y para rotar claves sin cortar el servicio.

</details>

<details>
<summary>¿Qué ventajas y desventajas tiene un proveedor de identidad externo?</summary>

Ventajas: no operar el login y tener resueltos verificación, recuperación, MFA y login social. Desventajas: costo por usuario, dependencia de un tercero, usuarios fuera de tu base y revocación más difícil.

</details>

<details>
<summary>¿Firebase Auth, Auth0 o Better Auth para un producto nuevo?</summary>

Depende de dónde deban vivir los usuarios, del costo esperado, de si hace falta SSO empresarial y de quién va a operar el sistema. Contá qué elegiste en un proyecto real y por qué.

</details>

## 7. Archivos e imágenes

### [Subir y validar archivos en Nest](./07-archivos/01-subir-archivos.md)

<details>
<summary>¿Cómo se envía un archivo por HTTP?</summary>

Con `multipart/form-data`, que permite mezclar archivos y campos en partes separadas del cuerpo.

</details>

<details>
<summary>¿Cómo validás que un archivo es realmente una imagen?</summary>

Leyendo sus magic numbers, no la extensión ni el mimetype del cliente, e idealmente reprocesándola.

</details>

<details>
<summary>¿Qué riesgos tiene permitir subidas?</summary>

Archivos enormes (DoS), contenido malicioso disfrazado, bombas de descompresión, metadatos con datos personales y llenar el disco.

</details>

<details>
<summary>¿Memoria o disco para los archivos subidos?</summary>

Memoria para archivos chicos y limitados; para grandes, streaming o subida directa al almacenamiento.

</details>

### [Guardar en Cloud Storage y servir con URLs firmadas](./07-archivos/02-cloud-storage.md)

<details>
<summary>¿Por qué no guardar archivos subidos en el servidor?</summary>

Porque los contenedores son efímeros y escalan horizontalmente: el archivo se pierde o no está en las otras instancias.

</details>

<details>
<summary>¿Qué es una URL firmada?</summary>

Una URL temporal que incluye una firma criptográfica y da acceso a un objeto privado sin credenciales, hasta que expira.

</details>

<details>
<summary>¿Cómo mantenés consistentes la base y el almacenamiento si no hay transacción?</summary>

Con un orden de operaciones y acciones compensatorias (borrar el archivo si falla la base), o con procesos que limpian huérfanos.

</details>

### [Subida directa desde el navegador](./07-archivos/03-subida-directa.md)

<details>
<summary>¿Cómo permitirías subir archivos de varios GB sin saturar la API?</summary>

Con URLs firmadas de escritura (o subidas reanudables) para que el cliente suba directo al almacenamiento, y la API solo autoriza y registra.

</details>

<details>
<summary>¿Qué validás después de una subida directa?</summary>

Que el objeto exista en la clave asignada, su tamaño y tipo, y que pertenezca a una solicitud autorizada y vigente.

</details>

## 8. Diseño y documentación de la API

### [Diseño de una API REST profesional](./08-api/01-diseno-rest.md)

<details>
<summary>¿Qué es RFC 9457?</summary>

El estándar Problem Details para devolver errores HTTP en JSON con `type`, `title`, `status`, `detail` e `instance`.

</details>

<details>
<summary>¿Cómo versionás una API en Nest?</summary>

`app.enableVersioning` con tipo URI, header o media type, y `version` en controladores o `@Version()` en métodos.

</details>

<details>
<summary>¿Qué cambios son compatibles hacia atrás?</summary>

Agregar campos, endpoints o parámetros opcionales. Quitar, renombrar o cambiar tipos no.

</details>

<details>
<summary>¿Cómo hacés idempotente un `POST`?</summary>

Con una clave de idempotencia enviada por el cliente; el servidor guarda el resultado por clave y lo repite ante reintentos.

</details>

<details>
<summary>¿Cuándo usarías 422 en vez de 400?</summary>

400 para datos mal formados o que no pasan la validación; 422 cuando son válidos en forma pero violan una regla de negocio.

</details>

### [Documentar la API con OpenAPI](./08-api/02-openapi.md)

<details>
<summary>¿Qué es OpenAPI y para qué sirve además de documentar?</summary>

Una especificación estándar de APIs REST. Sirve para generar clientes, mocks, pruebas de contrato y validaciones.

</details>

<details>
<summary>¿Code-first o design-first?</summary>

Code-first genera la especificación desde el código (simple, siempre sincronizado). Design-first escribe la especificación antes y genera código; mejor cuando varios equipos acuerdan el contrato primero.

</details>

<details>
<summary>¿Qué hace el plugin de Swagger de Nest?</summary>

Agrega en compilación la metadata de OpenAPI de los DTOs y respuestas leyendo los tipos y comentarios, evitando repetir `@ApiProperty`.

</details>

### [Cliente tipado desde OpenAPI](./08-api/03-cliente-tipado.md)

<details>
<summary>¿Cómo mantenés sincronizados los tipos del frontend con el backend?</summary>

Generándolos desde la especificación OpenAPI que produce el backend, con una tarea automática y verificación en CI.

</details>

<details>
<summary>En un monorepo, ¿para qué generar tipos si podés compartir interfaces?</summary>

Porque la interfaz compartida puede no coincidir con lo que la API realmente devuelve; lo generado refleja la implementación.

</details>

## 9. Pruebas, observabilidad y seguridad

### [Pruebas unitarias](./09-calidad/01-pruebas-unitarias.md)

<details>
<summary>¿Qué es la pirámide de pruebas?</summary>

Muchas unitarias rápidas, algunas de integración y pocas e2e, porque cuanto más alto, más lentas y frágiles.

</details>

<details>
<summary>¿Mockearías la base de datos?</summary>

En unitarias de lógica, sí. Pero las consultas se prueban con integración contra una base real, porque un mock no detecta errores de SQL.

</details>

<details>
<summary>¿Cómo reemplazás un provider en una prueba de Nest?</summary>

Con `useValue`/`useClass` en `createTestingModule` o con `overrideProvider().useValue()`.

</details>

<details>
<summary>¿Qué significa "probar comportamiento y no implementación"?</summary>

Que la prueba verifica entradas y salidas observables, no cómo se calcula por dentro, para que sobreviva a refactorizaciones.

</details>

### [Pruebas de integración y e2e con PostGIS real](./09-calidad/02-integracion-y-e2e.md)

<details>
<summary>¿Por qué no usar SQLite en memoria para las pruebas?</summary>

Porque no es el mismo motor: tipos, funciones y extensiones distintas. Las pruebas pasan y producción falla.

</details>

<details>
<summary>¿Qué es Testcontainers?</summary>

Una librería que levanta dependencias reales en contenedores de Docker desde las pruebas y las destruye al terminar.

</details>

<details>
<summary>¿Cómo aislás las pruebas que usan base de datos?</summary>

Base dedicada por ejecución, y limpieza entre pruebas con `TRUNCATE` o transacciones que se revierten.

</details>

<details>
<summary>¿Cómo probás endpoints protegidos sin el proveedor de identidad real?</summary>

Si la autenticación vive en tu API (Better Auth), creando usuarios y sesiones reales en la base de prueba. Si es un proveedor externo, reemplazando el verificador de tokens por uno falso o usando el emulador del proveedor.

</details>

### ['Observabilidad: logs, trazas y métricas'](./09-calidad/03-observabilidad.md)

<details>
<summary>¿Qué es un log estructurado y por qué conviene?</summary>

Un log en formato clave-valor (JSON) que se puede filtrar y agregar automáticamente.

</details>

<details>
<summary>¿Qué es una traza distribuida?</summary>

El registro del recorrido de una petición por todos los componentes, con la duración de cada tramo (spans), unidos por un id de traza.

</details>

<details>
<summary>¿Qué es OpenTelemetry?</summary>

El estándar abierto para generar y exportar trazas, métricas y logs, independiente del proveedor.

</details>

<details>
<summary>¿Qué no debería ir nunca en los logs?</summary>

Secretos, tokens, contraseñas y datos personales.

</details>

<details>
<summary>¿Qué métricas mirarías primero en una API?</summary>

Latencia por percentiles, tráfico, tasa de errores y saturación.

</details>

### [Health checks con Terminus](./09-calidad/04-health-checks.md)

<details>
<summary>¿Diferencia entre liveness y readiness?</summary>

Liveness indica si el proceso está vivo (si falla, se reinicia); readiness si puede recibir tráfico (si falla, se lo saca del balanceo).

</details>

<details>
<summary>¿Por qué no chequear la base en el liveness?</summary>

Porque una caída de la base haría reiniciar todas las instancias sin resolver nada.

</details>

<details>
<summary>¿Qué es Terminus?</summary>

El módulo de health checks de Nest, con indicadores para bases, HTTP, memoria, disco, etc.

</details>

### [Seguridad de la API](./09-calidad/05-seguridad.md)

<details>
<summary>¿Qué es CORS y protege al servidor?</summary>

Es una política del navegador para lecturas entre orígenes. No protege al servidor de clientes que no son navegadores; protege a los usuarios de sitios maliciosos.

</details>

<details>
<summary>¿Cómo implementás rate limiting en una API con varias instancias?</summary>

Con un almacenamiento compartido del contador (Redis), identificando al cliente por usuario o por IP real detrás del proxy.

</details>

<details>
<summary>Nombrá tres riesgos del OWASP API Top 10.</summary>

BOLA, autenticación rota, consumo de recursos sin límite (o cualquier otro de la tabla, con un ejemplo concreto).

</details>

<details>
<summary>¿Qué es SSRF?</summary>

Hacer que el servidor haga peticiones a destinos que elige el atacante (por ejemplo, la red interna). Se evita no pidiendo URLs del usuario o validándolas contra una lista permitida.

</details>

## 10. Eventos y trabajos en segundo plano

### [Eventos internos con EventEmitter](./10-segundo-plano/01-eventos.md)

<details>
<summary>¿Cuándo usarías un evento en vez de llamar a otro servicio?</summary>

Cuando es una consecuencia que no necesita respuesta y cuyo fallo no debe hacer fallar la operación principal, o para romper dependencias entre módulos.

</details>

<details>
<summary>¿Qué problema tienen los eventos en memoria?</summary>

Se pierden si el proceso muere, no llegan a otras instancias y no se reintentan.

</details>

<details>
<summary>¿Qué es el patrón outbox?</summary>

Guardar el evento en una tabla dentro de la misma transacción que el cambio de datos, y publicarlo después desde esa tabla, para garantizar consistencia entre datos y eventos.

</details>

### [Tareas programadas](./10-segundo-plano/02-tareas-programadas.md)

<details>
<summary>¿Qué problema tiene un cron dentro de la aplicación con varias instancias?</summary>

Se ejecuta una vez por instancia; y si la plataforma escala a cero, no se ejecuta.

</details>

<details>
<summary>¿Cómo garantizás que una tarea programada corra una sola vez?</summary>

Con un programador externo que llama una vez, una cola con trabajos repetibles, o un bloqueo distribuido.

</details>

<details>
<summary>¿Por qué las tareas programadas deben ser idempotentes?</summary>

Porque puede haber reintentos o ejecuciones dobles, y el resultado debe ser el mismo.

</details>

### [Colas con BullMQ y Redis](./10-segundo-plano/03-colas-bullmq.md)

<details>
<summary>¿Para qué sirve una cola de trabajos?</summary>

Para sacar de la petición el trabajo lento o poco confiable, procesarlo en segundo plano con reintentos y absorber picos.

</details>

<details>
<summary>¿Cómo hacés idempotente un trabajo?</summary>

Con ids de trabajo determinísticos para no duplicar, y lógica que detecta si ya se hizo (hash, estado) antes de actuar.

</details>

<details>
<summary>¿Qué es un trabajo "envenenado" y cómo lo tratás?</summary>

Uno que falla siempre. Se limita el número de intentos, se marca como fallido (dead letter) y se investiga; los errores permanentes no se reintentan.

</details>

<details>
<summary>¿Qué cuidado tenés al correr workers en una plataforma serverless?</summary>

Que tengan CPU fuera de las peticiones (CPU siempre asignada o servicio dedicado) o usar un modelo push como Cloud Tasks.

</details>

<details>
<summary>¿Por qué BullMQ exige `noeviction` en Redis?</summary>

Porque si Redis expulsa claves para liberar memoria, se pierden trabajos sin aviso.

</details>

## 11. Rendimiento y caché

### [Medir y optimizar una API Nest](./11-rendimiento/01-medir-y-optimizar.md)

<details>
<summary>¿Qué bloquea el event loop de Node y cómo lo evitás?</summary>

El trabajo de CPU sincrónico. Se evita moviéndolo a colas, `worker_threads` o librerías nativas.

</details>

<details>
<summary>Tu API en serverless agota las conexiones de PostgreSQL. ¿Qué hacés?</summary>

Reducir el pool por instancia, poner un pooler (PgBouncer) y limitar el número máximo de instancias.

</details>

<details>
<summary>¿Por qué mirar p95 y no el promedio?</summary>

Porque el promedio esconde la cola de peticiones lentas que sufren algunos usuarios.

</details>

<details>
<summary>¿Cambiarías Express por Fastify?</summary>

Si las mediciones muestran que el framework HTTP es el cuello de botella. Normalmente lo es la base o servicios externos.

</details>

### [Caché con Redis](./11-rendimiento/02-cache.md)

<details>
<summary>¿Qué es cache-aside?</summary>

La aplicación busca en la caché y, si no está, lee de la base y la guarda. La caché no sabe nada de la base.

</details>

<details>
<summary>¿Cómo invalidás una caché?</summary>

Con TTL (expira sola), borrando la clave al cambiar el dato (por eventos), o versionando las claves.

</details>

<details>
<summary>¿Caché en memoria o Redis?</summary>

En memoria es más rápida pero por instancia: con varias instancias quedan inconsistentes. Redis es compartida.

</details>

<details>
<summary>¿Qué significan `max-age` y `s-maxage`?</summary>

Cuánto puede reusar la respuesta el navegador y cuánto una caché compartida (CDN).

</details>

<details>
<summary>¿Qué es un cache stampede y cómo lo evitás?</summary>

Muchas peticiones que no encuentran la clave a la vez y golpean la base juntas. Se evita con un bloqueo para que solo una recalcule, TTL con variación aleatoria o `stale-while-revalidate`.

</details>

## 12. Full stack: Next.js y la API

### [Next.js consumiendo la API de Nest](./12-fullstack/01-next-consume-la-api.md)

<details>
<summary>¿Cómo hace un Server Component para llamar a una API protegida con la sesión del usuario?</summary>

Lee las cookies de la petición entrante (`cookies()`) y las reenvía en el `fetch` a la API. La API valida la sesión como con cualquier otra petición.

</details>

<details>
<summary>¿Qué diferencia hay entre llamar a la API desde un Server Component y desde un Client Component?</summary>

El Server Component corre en el servidor de Next: puede usar URLs internas y secretos, no tiene CORS y su resultado llega como HTML. El Client Component corre en el navegador: depende de CORS, de que la cookie viaje con `credentials: 'include'` y de no exponer secretos.

</details>

<details>
<summary>¿Qué es `server-only` y para qué sirve?</summary>

Un paquete que hace fallar el build si un módulo pensado para el servidor se importa en código del cliente. Evita filtrar secretos o lógica de servidor al navegador.

</details>

<details>
<summary>¿Por qué no hacer el login con una Server Action que llama a otra API?</summary>

Porque el `Set-Cookie` de esa API le llega al servidor de Next y no al navegador; habría que copiarlo a mano. Es más simple y seguro que el navegador hable con el servicio de auth.

</details>

<details>
<summary>¿Cuándo usarías Next como backend y cuándo una API aparte?</summary>

Next alcanza para un producto con un solo frontend y lógica simple. Una API aparte conviene cuando hay varios clientes, procesos en segundo plano, tiempo real o un dominio con reglas que no deben vivir en el frontend.

</details>

### [Renderizado en el servidor, caché y la API](./12-fullstack/02-ssr-y-la-api.md)

<details>
<summary>¿Qué impacto tiene el SSR sobre el backend?</summary>

La API queda en el camino de renderizado: su latencia suma al tiempo de la página. Por eso hace falta caché, timeouts y revalidación a demanda.

</details>

<details>
<summary>¿Cómo invalidás una página cacheada cuando cambian los datos en otra API?</summary>

Etiquetando los datos cacheados (`cacheTag`) y haciendo que el backend, al cambiar el dato, llame a un endpoint protegido de Next que ejecuta `revalidateTag`, idealmente desde una cola con reintentos.

</details>

<details>
<summary>¿Qué es stale-while-revalidate?</summary>

Servir la versión cacheada aunque esté vencida mientras se genera la nueva en segundo plano. El usuario nunca espera, a cambio de ver datos viejos una vez.

</details>

<details>
<summary>¿Por qué devolver un 404 real en SSR?</summary>

Para que los buscadores no indexen páginas inexistentes como si fueran válidas (soft 404).

</details>

<details>
<summary>¿Alcanza con proteger rutas en `proxy.ts` (o middleware)?</summary>

No. Es una capa de experiencia: solo ve si hay cookie. La validación real está en el servidor (layout que consulta la sesión) y, sobre todo, en la API, que valida cada petición.

</details>

<details>
<summary>¿Qué problema trae la caché del servidor con varias instancias?</summary>

Cada instancia tiene su propia caché: una revalidación llega a una sola. Se resuelve con un almacenamiento de caché compartido (Redis) o con la infraestructura de la plataforma.

</details>

### [Contratos compartidos y límites en el monorepo Nx](./12-fullstack/03-monorepo-y-limites.md)

<details>
<summary>¿Qué ventajas tiene un monorepo para un full stack?</summary>

Contratos y tipos compartidos, cambios atómicos entre frontend y backend, herramientas comunes y CI que solo construye lo afectado.

</details>

<details>
<summary>¿Cómo evitás que el frontend importe código del backend en un monorepo?</summary>

Con tags en los proyectos y reglas de límites (`enforce-module-boundaries` de Nx) verificadas en el lint.

</details>

<details>
<summary>¿Qué es `nx affected`?</summary>

Ejecutar tareas solo en los proyectos afectados por los cambios, según el grafo de dependencias.

</details>

## 13. Tiempo real con WebSockets

### [WebSockets y gateways de Nest](./13-websockets/01-conceptos-y-gateways.md)

<details>
<summary>¿Cuándo usarías WebSockets, SSE o polling?</summary>

WebSockets para comunicación bidireccional en tiempo real; SSE si solo el servidor envía eventos; polling si la frecuencia es baja y la simplicidad importa más.

</details>

<details>
<summary>¿Qué agrega Socket.IO sobre WebSocket nativo?</summary>

Reconexión, fallback a long-polling, eventos con nombre, acknowledgements, salas, namespaces y adaptadores para escalar.

</details>

<details>
<summary>¿Qué es un gateway en Nest?</summary>

Una clase que maneja conexiones y mensajes de WebSocket, equivalente a un controlador, con soporte de DI, guards, pipes e interceptors.

</details>

<details>
<summary>¿Diferencia entre namespace y room?</summary>

El namespace es un canal lógico al que el cliente se conecta explícitamente; las rooms son grupos que el servidor arma dentro de un namespace para emitir a varios.

</details>

### [Autenticar el socket y salas por municipio](./13-websockets/02-autenticacion-y-salas.md)

<details>
<summary>¿Cómo autenticás un WebSocket?</summary>

Validando la identidad en el handshake con un middleware: la cookie de sesión (que viaja sola con `withCredentials`) o un token enviado en `auth`. La identidad queda guardada en el socket para toda la conexión.

</details>

<details>
<summary>¿Qué pasa si la sesión vence o se cierra con la conexión abierta?</summary>

La conexión sigue siendo válida hasta que se corte; al reconectar se vuelve a validar. Para revocar al instante, el servidor desconecta los sockets del usuario.

</details>

<details>
<summary>¿Cómo mandás un mensaje a todos los dispositivos de un usuario?</summary>

Uniendo cada socket a una sala por usuario y emitiendo a esa sala.

</details>

### [Notificaciones y mensajes en ripopola](./13-websockets/03-notificaciones-y-mensajes.md)

<details>
<summary>¿Un WebSocket garantiza la entrega de un mensaje?</summary>

No. Por eso se persiste primero y el cliente sincroniza lo pendiente al reconectar.

</details>

<details>
<summary>¿Cómo diseñarías un chat con historial?</summary>

Mensajes en la base, socket para entregar en vivo a una sala por conversación, ack al emisor, historial por HTTP paginado por cursor y notificación diferida si el destinatario no está conectado.

</details>

<details>
<summary>¿Cómo emitís a clientes de Socket.IO desde un worker en otro proceso?</summary>

Con el emitter o el adaptador de Redis, que publica el evento para que lo entreguen las instancias que tienen esos sockets.

</details>

### [Escalar WebSockets con el adaptador de Redis](./13-websockets/04-escalar-con-redis.md)

<details>
<summary>¿Por qué los WebSockets no escalan horizontalmente "solos"?</summary>

Porque cada conexión vive en una instancia, y un mensaje emitido en otra no llega. Hace falta un bus compartido (Redis Pub/Sub) entre instancias.

</details>

<details>
<summary>¿Qué son las sticky sessions y cuándo las necesitás?</summary>

Que todas las peticiones de un cliente vayan a la misma instancia. Socket.IO las necesita con transporte long-polling.

</details>

<details>
<summary>¿Socket.IO o `ws`?</summary>

Socket.IO por funcionalidad (salas, reconexión, acks, escalado). `ws` por rendimiento y compatibilidad con clientes WebSocket estándar.

</details>

## 14. Producción

### [Build con Nx e imagen de Docker](./14-produccion/01-build-y-docker.md)

<details>
<summary>¿Para qué sirve un Dockerfile multi-stage?</summary>

Para compilar en una etapa con todas las herramientas y copiar a la imagen final solo el resultado y las dependencias de runtime. La imagen queda más chica y con menos superficie de ataque.

</details>

<details>
<summary>¿Por qué no correr el contenedor como root?</summary>

Si alguien explota una vulnerabilidad de la app, tendría privilegios de root dentro del contenedor, lo que facilita escapar o dañar más. Un usuario sin privilegios limita el daño.

</details>

<details>
<summary>¿Por qué `CMD ["node", "main.js"]` y no `npm start`?</summary>

Porque npm se queda como proceso 1 y no siempre reenvía `SIGTERM` a Node: la app no se entera del apagado y se corta sin cerrar conexiones.

</details>

<details>
<summary>¿Cómo aprovechás la caché de capas de Docker?</summary>

Copiando primero los archivos que cambian poco (lockfile) e instalando dependencias antes de copiar el código, así un cambio de código no reinstala todo.

</details>

### [PostgreSQL con PostGIS en Neon](./14-produccion/02-base-en-neon.md)

<details>
<summary>¿Qué es un connection pooler y por qué hace falta con serverless?</summary>

Un intermediario (como PgBouncer) que reparte pocas conexiones reales de PostgreSQL entre muchos clientes. Con muchas instancias efímeras, sin pooler se agotan las conexiones de la base.

</details>

<details>
<summary>¿Diferencia entre `migrate dev` y `migrate deploy`?</summary>

`dev` genera migraciones nuevas y puede resetear la base; es solo para desarrollo. `deploy` aplica las migraciones pendientes ya versionadas, sin generar ni borrar nada.

</details>

<details>
<summary>¿Cómo renombrás una columna sin tiempo de caída?</summary>

Con *expand and contract*: agregar la columna nueva, escribir en las dos, copiar los datos, pasar las lecturas a la nueva y recién después eliminar la vieja, en despliegues separados.

</details>

<details>
<summary>¿Por qué las migraciones no van por el pooler?</summary>

Porque en modo transacción el pooler puede cambiar de conexión entre sentencias, y las migraciones usan locks y configuraciones de sesión que necesitan una conexión estable.

</details>

### [Desplegar en Cloud Run](./14-produccion/03-cloud-run.md)

<details>
<summary>¿Qué implica que un servicio sea *stateless*?</summary>

Que ninguna instancia guarda datos que otra necesite: archivos en un storage, sesiones y colas en Redis, datos en la base. Así se puede escalar, reiniciar o reemplazar cualquier instancia.

</details>

<details>
<summary>¿Cómo ejecutás migraciones en un despliegue?</summary>

Como un paso separado (un job) que corre antes de desplegar el código nuevo, con migraciones compatibles con la versión anterior, y que corta el despliegue si falla.

</details>

<details>
<summary>¿Cómo hacés un rollback en Cloud Run?</summary>

Mandando el tráfico a la revisión anterior, que sigue existiendo. Por eso las migraciones tienen que ser compatibles hacia atrás.

</details>

<details>
<summary>¿Qué es un arranque en frío y cómo lo mitigás?</summary>

La demora de la primera petición mientras arranca una instancia nueva. Se mitiga con instancias mínimas, imágenes chicas y un arranque rápido de la app.

</details>

<details>
<summary>¿Dónde guardás los secretos?</summary>

En un gestor de secretos (Secret Manager) inyectado como variables de entorno en runtime, con acceso solo para la cuenta de servicio que los necesita. Nunca en el repo ni en la imagen.

</details>

<details>
<summary>¿Qué cambia al desplegar Next.js en tu propia infraestructura en vez de en Vercel?</summary>

Tenés que resolver vos la caché compartida entre instancias (un cache handler con Redis), servir los estáticos (CDN), las previews y tener en cuenta que las variables `NEXT_PUBLIC_*` se fijan en el build. A cambio, todo queda en tu nube y con tus costos.

</details>

### [Integración continua con GitHub Actions](./14-produccion/04-ci-con-github-actions.md)

<details>
<summary>¿Qué es `nx affected` y por qué importa en un monorepo?</summary>

Corre tareas solo en los proyectos afectados por un cambio, usando el grafo de dependencias. Mantiene el CI rápido a medida que crece el monorepo.

</details>

<details>
<summary>¿Cómo autenticás el CI contra la nube sin guardar claves?</summary>

Con federación de identidad (OIDC): el proveedor de CI emite un token por ejecución que la nube intercambia por credenciales temporales con permisos acotados.

</details>

<details>
<summary>¿Qué debería pasar en un pipeline antes de desplegar?</summary>

Lint, chequeo de tipos, tests unitarios y de integración, build de la imagen y migraciones de la base; si algo falla, se corta y no se despliega.

</details>

<details>
<summary>¿Diferencia entre entrega continua y despliegue continuo?</summary>

En entrega continua cada cambio queda listo para publicar y alguien decide cuándo; en despliegue continuo se publica automáticamente.

</details>

## 15. Arquitectura

### [Monolito modular y microservicios](./15-arquitectura/01-monolito-modular-y-microservicios.md)

<details>
<summary>¿Monolito o microservicios para un producto nuevo?</summary>

Monolito modular: menos complejidad operativa y velocidad para cambiar el dominio mientras se descubre. Se separan servicios cuando aparece una razón concreta de escala, equipos o aislamiento.

</details>

<details>
<summary>¿Qué problemas trae pasar a microservicios?</summary>

Latencia y fallos de red, consistencia eventual, transacciones distribuidas (sagas), versionado de contratos, observabilidad distribuida y más infraestructura.

</details>

<details>
<summary>¿Diferencia entre `@MessagePattern` y `@EventPattern`?</summary>

El primero es petición-respuesta: el cliente espera un resultado. El segundo es un evento sin respuesta: el emisor no espera a nadie.

</details>

<details>
<summary>¿Qué es el patrón strangler fig?</summary>

Reemplazar un sistema de a partes, desviando funcionalidades al nuevo poco a poco hasta que el viejo puede apagarse.

</details>

### [Capas, arquitectura hexagonal y DDD](./15-arquitectura/02-capas-hexagonal-y-ddd.md)

<details>
<summary>¿Qué es la arquitectura hexagonal?</summary>

Separar el núcleo de la aplicación de los detalles externos mediante puertos (interfaces que define el núcleo) y adaptadores (implementaciones de infraestructura), de forma que las dependencias apunten hacia el núcleo.

</details>

<details>
<summary>¿Envolverías Prisma en repositorios?</summary>

Donde aporta: SQL complejo, un modelo que no coincide con las tablas o la necesidad de cambiar la persistencia. Envolver todo por defecto duplica la API de Prisma sin beneficio.

</details>

<details>
<summary>¿Qué es un bounded context?</summary>

Un límite dentro del cual un modelo y su lenguaje tienen un significado preciso. El mismo concepto puede modelarse distinto en contextos distintos.

</details>

<details>
<summary>¿Dónde ponés una regla de negocio en Nest?</summary>

En el dominio o en el servicio de aplicación, nunca en el controlador. Idealmente en una función o clase pura que se pueda probar sin el framework.

</details>

### [CQRS y eventos con @nestjs/cqrs](./15-arquitectura/03-cqrs.md)

<details>
<summary>¿Qué es CQRS?</summary>

Separar el modelo de escritura (comandos) del de lectura (consultas), para optimizar cada uno por su lado, desde handlers distintos hasta bases distintas.

</details>

<details>
<summary>¿CQRS implica event sourcing?</summary>

No. Se combinan a menudo, pero se puede tener CQRS con una base relacional normal y sin guardar eventos.

</details>

<details>
<summary>¿Qué es una saga en @nestjs/cqrs?</summary>

Un flujo que escucha eventos como un Observable y emite nuevos comandos, para coordinar procesos de varios pasos.

</details>

<details>
<summary>¿Qué es la consistencia eventual?</summary>

Que después de una escritura, las lecturas pueden tardar un poco en reflejarla (por ejemplo, un modelo de lectura actualizado por eventos), pero terminan siendo consistentes.

</details>

### [Multi-tenancy por municipio](./15-arquitectura/04-multi-tenancy.md)

<details>
<summary>¿Qué modelos de multi-tenancy conocés y cuándo usarías cada uno?</summary>

Base por tenant (aislamiento máximo, clientes grandes o regulados), schema por tenant (intermedio) y tablas compartidas con columna de tenant (muchos tenants chicos, más barato). La elección depende del aislamiento exigido y la cantidad de tenants.

</details>

<details>
<summary>¿Qué es AsyncLocalStorage?</summary>

Una API de Node que mantiene datos asociados a una cadena de operaciones asíncronas, útil para guardar el contexto de una petición (usuario, tenant, request id) sin pasarlo por parámetro.

</details>

<details>
<summary>¿Qué es Row-Level Security?</summary>

Una función de PostgreSQL que filtra las filas visibles o modificables según políticas evaluadas por la base, independientemente de la consulta que haga la app.

</details>

<details>
<summary>¿Por qué no usar providers `REQUEST`-scoped para el tenant?</summary>

Porque Nest recrea el provider y toda su cadena de dependencias en cada petición, con costo de rendimiento. AsyncLocalStorage da el mismo resultado sin recrear nada.

</details>

### [GraphQL en Nest](./15-arquitectura/05-graphql.md)

<details>
<summary>¿REST o GraphQL?</summary>

REST cuando importan la caché HTTP, la simplicidad y los recursos están bien definidos. GraphQL cuando hay muchos clientes con necesidades distintas sobre datos muy relacionados y se quiere evitar la sobre y sub-obtención.

</details>

<details>
<summary>¿Qué es DataLoader?</summary>

Una utilidad que agrupa y cachea, dentro de una misma petición, las cargas por id que hacen los resolvers, convirtiendo N consultas en una.

</details>

<details>
<summary>¿Code first o schema first?</summary>

Code first genera el schema desde clases y decoradores (cómodo en TypeScript, una sola fuente). Schema first escribe el SDL y genera los tipos (el schema como contrato acordado entre equipos).

</details>

<details>
<summary>¿Qué riesgos de seguridad tiene GraphQL?</summary>

Consultas costosas o muy profundas (denegación de servicio), introspección expuesta en producción y autorización por campo que se olvida. Se mitigan con límites de complejidad, consultas persistidas y guards.

</details>

### [Decidir y documentar la arquitectura](./15-arquitectura/06-decisiones-y-adrs.md)

<details>
<summary>Contame una decisión técnica que hayas tomado y por qué.</summary>

Respondé con estructura de ADR: contexto, opciones que evaluaste, qué elegiste, qué resignaste y qué señal te haría cambiarla. Ripopola te da varias (Prisma, el cambio de Firebase Auth a Better Auth, Redis).

</details>

<details>
<summary>¿Qué es un ADR?</summary>

Un registro breve de una decisión de arquitectura con su contexto, alternativas y consecuencias, versionado junto al código para que se entienda en el futuro por qué el sistema es como es.

</details>

<details>
<summary>¿Cómo evaluás una tecnología nueva para el equipo?</summary>

Por el problema que resuelve, costo, madurez y soporte, curva de aprendizaje del equipo, operación y qué tan reversible es adoptarla. Idealmente con una prueba acotada antes de comprometerse.

</details>

---

332 preguntas en total.
