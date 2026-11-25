---
title: Medir y optimizar una API Nest
sidebar_label: Medir y optimizar
sidebar_position: 1
description: Cómo encontrar cuellos de botella, el event loop de Node, pool de conexiones, statement_timeout, compresión, Fastify y pruebas de carga.
---

# Medir y optimizar una API Nest

<Tech ids={['nestjs', 'nodedotjs', 'postgresql']} />

<Estado tipo="construye">Ajustes concretos para ripopola: tamaño del pool de conexiones, `statement_timeout` en PostgreSQL, compresión y una prueba de carga del listado de pueblos.</Estado>

## La regla: medir primero

"La optimización prematura es la raíz de todos los males". El orden:

1. **Medir** (logs de tiempos, trazas, `EXPLAIN ANALYZE`, prueba de carga).
2. **Encontrar el cuello de botella** (casi siempre la base o una llamada externa).
3. **Arreglarlo** donde está (índice, consulta, N+1).
4. **Recién después**, caché.

## El event loop de Node

Node ejecuta tu JavaScript en **un solo hilo**. Las esperas de I/O (base,
red) no lo bloquean, pero el **trabajo de CPU sí**: mientras calcula, no
atiende a nadie más.

| Bloquea el event loop | No lo bloquea |
| --- | --- |
| `JSON.parse` de un JSON enorme, bucles sobre miles de elementos, `bcrypt.hashSync`, procesar imágenes en JS puro, regex catastróficas | `await prisma...`, `await fetch(...)`, leer archivos con APIs async |

En ripopola: procesar imágenes con **sharp** está bien (usa hilos nativos
aparte). Trabajos de CPU pesados van a la **cola** o a `worker_threads`.

## Ajustes en ripopola

### 1. Pool de conexiones

Cada instancia de la API abre un pool de conexiones a PostgreSQL. Si hay
muchas instancias, se suman: **instancias × tamaño del pool** no puede
superar el `max_connections` de la base (Neon y Cloud SQL tienen límites).

```ts
new PrismaPg({ connectionString, max: 10 }) // conexiones por instancia
```

En serverless se pone un **pooler** delante (PgBouncer o el pooler de Neon,
con la URL `-pooler`) para que cientos de conexiones cortas compartan unas pocas reales.

### 2. `statement_timeout`: cortar consultas desbocadas

Una consulta que tarda 2 minutos retiene una conexión y CPU de la base.
Mejor cortarla:

```sql
ALTER ROLE ripopola_app SET statement_timeout = '5s';
```

O en la URL de conexión: `?options=-c%20statement_timeout%3D5000`. Es el
complemento del `TimeoutInterceptor` de los fundamentos, que dejaba de
esperar pero no cancelaba la consulta.

### 3. Compresión

Las respuestas JSON se comprimen muy bien (un listado de 50 KB queda en ~8 KB):

```ts
import compression from 'compression';
app.use(compression());
```

En Cloud Run, si hay un balanceador o CDN delante, puede comprimir él.

### 4. Pedir menos

Lo que más rinde casi siempre: **traer menos datos**. `select` en vez de
modelos completos, paginación con máximo, nada de N+1, y no mandar al
frontend lo que no muestra.

### 5. ¿Fastify?

Nest puede usar **Fastify** en vez de Express (`@nestjs/platform-fastify`):
en *benchmarks* atiende bastante más peticiones por segundo. En una API como
ripopola, donde el tiempo se va en la base, la diferencia real es chica, y
hay que cambiar los middleware de Express y Multer. Buena respuesta de
entrevista: "lo consideraría si el perfil muestra que el framework es el cuello de botella".

## Prueba de carga

**k6** (de Grafana) escribe pruebas de carga en JavaScript:

```js title="load/towns.js"
import http from 'k6/http';
import { check } from 'k6';

export const options = { vus: 50, duration: '30s' }; // 50 usuarios virtuales

export default function () {
  const res = http.get('http://localhost:3000/api/v1/towns?country=ES');
  check(res, { 'status 200': (r) => r.status === 200 });
}
```

```bash
k6 run load/towns.js
```

Mirá **p95** (el 95 % de las peticiones tardó menos que esto) y la tasa de
errores. El promedio engaña: unos pocos usuarios muy lentos no se ven.

<Resumen>

- Medir, encontrar el cuello, arreglarlo; caché al final.
- No bloquear el event loop con CPU: colas o worker threads.
- Pool por instancia × instancias ≤ conexiones de la base; pooler en serverless.
- `statement_timeout`, compresión, traer menos datos.
- k6 para carga; mirar p95, no el promedio.

</Resumen>

## Preguntas de entrevista

**1. ¿Qué bloquea el event loop de Node y cómo lo evitás?**
El trabajo de CPU sincrónico. Se evita moviéndolo a colas, `worker_threads` o librerías nativas.

**2. Tu API en serverless agota las conexiones de PostgreSQL. ¿Qué hacés?**
Reducir el pool por instancia, poner un pooler (PgBouncer) y limitar el número máximo de instancias.

**3. ¿Por qué mirar p95 y no el promedio?**
Porque el promedio esconde la cola de peticiones lentas que sufren algunos usuarios.

**4. ¿Cambiarías Express por Fastify?**
Si las mediciones muestran que el framework HTTP es el cuello de botella. Normalmente lo es la base o servicios externos.
