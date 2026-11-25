---
title: 'Observabilidad: logs, trazas y métricas'
sidebar_label: Observabilidad
sidebar_position: 3
description: Logs estructurados en JSON con nestjs-pino, correlación por request id, trazas distribuidas con OpenTelemetry y métricas, con Google Cloud Logging y Cloud Trace.
---

# Observabilidad: logs, trazas y métricas

<Tech ids={['nestjs', 'googlecloud']} />

<Estado tipo="construye">Logs en JSON con request id (Pino) que Google Cloud Logging entiende. Las trazas con OpenTelemetry se suman cuando haya tráfico real.</Estado>

## Los tres pilares

| Pilar | Responde | Ejemplo en ripopola |
| --- | --- | --- |
| **Logs** | ¿Qué pasó? | "Error al traducir la ficha de Albarracín: HTTP 429" |
| **Métricas** | ¿Cuánto y qué tan seguido? | Peticiones por minuto, p95 de latencia, trabajos en cola |
| **Trazas** | ¿Dónde se fue el tiempo de esta petición? | 12 ms en la API, 80 ms en PostgreSQL, 900 ms en la IA |

**Monitoreo** te avisa de que algo anda mal; **observabilidad** te deja
entender por qué, sin desplegar código nuevo para investigar.

## Logs estructurados

Un log de texto (`GET /towns 200 12ms`) es fácil de leer para una persona y
difícil de buscar para una máquina. Un **log estructurado** es JSON:

```json
{"level":"info","time":"2026-11-24T14:00:00Z","req":{"id":"9b1d","method":"GET","url":"/api/v1/towns"},"res":{"statusCode":200},"responseTime":12,"msg":"request completed"}
```

Con eso, en Cloud Logging filtrás por `req.id`, `res.statusCode >= 500` o `responseTime > 1000`.

### En ripopola: Pino

**Pino** es el logger JSON más rápido de Node, y `nestjs-pino` lo integra con Nest:

```bash
pnpm add -E nestjs-pino pino-http
pnpm add -D -E pino-pretty
```

```ts title="app.module.ts"
import { LoggerModule } from 'nestjs-pino';

LoggerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    pinoHttp: {
      level: config.get('LOG_LEVEL') ?? 'info',
      // Reusar el request id del middleware (o el de Cloud Run)
      genReqId: (req) => (req.headers['x-request-id'] as string) ?? randomUUID(),
      // Nunca loguear secretos ni datos personales
      redact: ['req.headers.authorization', 'req.headers.cookie', '*.email', '*.password'],
      // En local, legible; en producción, JSON
      transport: config.get('NODE_ENV') === 'development' ? { target: 'pino-pretty' } : undefined,
      // Cloud Logging usa "severity" en vez de "level"
      formatters: { level: (label) => ({ severity: label.toUpperCase() }) },
    },
  }),
}),
```

```ts title="main.ts"
const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(Logger)); // el Logger de nestjs-pino
```

Con esto:

- Cada petición se loguea sola (ya no hace falta el `LoggingInterceptor` de los fundamentos).
- `new Logger(MiClase.name)` de Nest sigue funcionando y sale en JSON.
- Cada log de una petición lleva su `req.id`.

:::warning Datos personales en los logs
Los logs se guardan semanas y los ve más gente que la base. Correos,
nombres, tokens y cuerpos de petición **no** van a los logs (`redact`). Es
una exigencia del RGPD y de la arquitectura de ripopola ("logs sin datos personales").
:::

## Trazas distribuidas con OpenTelemetry

Una **traza** sigue una petición por todas las piezas: la API, PostgreSQL,
Redis, la cola, la IA. Cada tramo es un *span* con su duración.

**OpenTelemetry (OTel)** es el estándar abierto para instrumentar: un
SDK que se configura **antes** de arrancar Nest y que instrumenta solo
HTTP, Express, `pg`, Redis, etc. Los datos se envían a cualquier backend
compatible (Google Cloud Trace, Grafana Tempo, Jaeger, Datadog).

```ts title="apps/api/src/tracing.ts (se importa primero en main.ts)"
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

new NodeSDK({
  serviceName: 'ripopola-api',
  instrumentations: [getNodeAutoInstrumentations()],
  // exporter de Google Cloud Trace u OTLP según el entorno
}).start();
```

Prisma tiene instrumentación propia para OTel (`@prisma/instrumentation`),
que muestra cada consulta como un span.

:::info Cuándo sumarlo
Con una sola API y poco tráfico, los logs con request id alcanzan. Las
trazas pagan cuando hay colas, varios servicios o latencias raras que
investigar. En ripopola: cuando arranquen las traducciones con BullMQ.
:::

## Métricas y alertas

Lo mínimo para una API en producción (las "señales doradas" de Google SRE):

- **Latencia** (p50, p95, p99).
- **Tráfico** (peticiones por segundo).
- **Errores** (tasa de 5xx).
- **Saturación** (CPU, memoria, conexiones a la base, largo de la cola).

Cloud Run ya entrega latencia, tráfico, errores, CPU y memoria sin código.
Las métricas de negocio (traducciones por día, costo de IA) se pueden sacar
de los logs estructurados con *log-based metrics*. Las alertas (por correo)
para: tasa de 5xx alta, cola atascada, presupuesto de IA superado.

<Resumen>

- Logs en JSON con request id y sin datos personales (Pino + redact).
- Trazas con OpenTelemetry cuando haya colas o varios servicios.
- Señales doradas: latencia, tráfico, errores, saturación.

</Resumen>

## Preguntas de entrevista

**1. ¿Qué es un log estructurado y por qué conviene?**
Un log en formato clave-valor (JSON) que se puede filtrar y agregar automáticamente.

**2. ¿Qué es una traza distribuida?**
El registro del recorrido de una petición por todos los componentes, con la duración de cada tramo (spans), unidos por un id de traza.

**3. ¿Qué es OpenTelemetry?**
El estándar abierto para generar y exportar trazas, métricas y logs, independiente del proveedor.

**4. ¿Qué no debería ir nunca en los logs?**
Secretos, tokens, contraseñas y datos personales.

**5. ¿Qué métricas mirarías primero en una API?**
Latencia por percentiles, tráfico, tasa de errores y saturación.
