---
title: Tareas programadas
sidebar_position: 2
description: Cron en Nest con @nestjs/schedule, por qué no sirve tal cual en Cloud Run, y la alternativa con Cloud Scheduler o trabajos repetibles de BullMQ.
---

# Tareas programadas

<Tech ids={['nestjs', 'googlecloud', 'redis']} />

<Estado tipo="construye">Tareas periódicas de ripopola: vencer ofertas pasadas de fecha cada noche y reintentar traducciones atascadas. Programadas con trabajos repetibles de BullMQ (tema siguiente) o Cloud Scheduler.</Estado>

## `@nestjs/schedule`

```bash
pnpm add -E @nestjs/schedule
```

```ts
@Module({ imports: [ScheduleModule.forRoot()] })
export class AppModule {}

@Injectable()
export class ListingsMaintenance {
  private readonly logger = new Logger(ListingsMaintenance.name);
  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 3 * * *', { timeZone: 'Europe/Madrid' }) // todos los días a las 3:00
  async expireListings() {
    const { count } = await this.prisma.housingListing.updateMany({
      where: { expiresAt: { lt: new Date() }, deletedAt: null, status: 'ACTIVE' },
      data: { status: 'EXPIRED' }, // enum ListingStatus (ACTIVE, EXPIRED, ARCHIVED), sección 3
    });
    this.logger.log(`Ofertas vencidas: ${count}`);
  }
}
```

La expresión cron: `minuto hora día-del-mes mes día-de-la-semana`. También
hay `@Interval(ms)` y `@Timeout(ms)`, y `SchedulerRegistry` para crear o
parar tareas en tiempo de ejecución.

## El problema en producción

`@Cron` corre **dentro de cada instancia** de la API:

- Con **3 instancias**, la tarea corre **3 veces** a las 3:00.
- Con Cloud Run escalando a **cero** (sin tráfico de noche), corre **0 veces**.
- Con CPU asignada solo durante las peticiones, el proceso está "congelado" fuera de ellas.

Es una pregunta típica de entrevista: "¿qué pasa con un cron cuando escalás horizontalmente?".

## Soluciones

| Opción | Cómo | Cuándo |
| --- | --- | --- |
| **Cloud Scheduler** → endpoint interno | Google llama a `POST /api/internal/jobs/expire-listings` con una clave (el `InternalApiKeyGuard` de la sección 1) o un token OIDC | Tareas simples y poco frecuentes. Escala a cero. |
| **Trabajos repetibles de BullMQ** | Redis garantiza que se ejecute **una vez**, en un solo worker | Cuando ya tenés BullMQ (ripopola). |
| **Cloud Run Jobs** | Un contenedor que corre, termina y se cobra solo ese tiempo | Tareas largas (importar municipios). |
| **Bloqueo en la base** | `pg_try_advisory_lock` para que solo una instancia la ejecute | Si no hay otra cosa. |

### En ripopola

Con BullMQ, un trabajo repetible:

```ts
await this.maintenanceQueue.upsertJobScheduler(
  'expire-listings',                                   // id único: no se duplica
  { pattern: '0 3 * * *', tz: 'Europe/Madrid' },
  { name: 'expire-listings' },
);
```

Y el worker de la cola de mantenimiento ejecuta la misma lógica de arriba.
`@nestjs/schedule` queda para cosas locales de cada instancia (refrescar un
caché en memoria, por ejemplo).

:::tip Que la tarea sea idempotente
Aunque la plataforma prometa "una vez", diseñá cada tarea para que correrla
dos veces no haga daño: `updateMany` con un `where` que ya excluye lo
procesado lo cumple.
:::

<Resumen>

- `@Cron` es simple, pero corre en cada instancia (o en ninguna si escala a cero).
- En producción: Cloud Scheduler, trabajos repetibles de BullMQ o Cloud Run Jobs.
- Tareas idempotentes siempre.

</Resumen>

## Preguntas de entrevista

**1. ¿Qué problema tiene un cron dentro de la aplicación con varias instancias?**
Se ejecuta una vez por instancia; y si la plataforma escala a cero, no se ejecuta.

**2. ¿Cómo garantizás que una tarea programada corra una sola vez?**
Con un programador externo que llama una vez, una cola con trabajos repetibles, o un bloqueo distribuido.

**3. ¿Por qué las tareas programadas deben ser idempotentes?**
Porque puede haber reintentos o ejecuciones dobles, y el resultado debe ser el mismo.
