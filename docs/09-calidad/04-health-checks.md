---
title: Health checks con Terminus
sidebar_label: Health checks
sidebar_position: 4
description: Liveness contra readiness, @nestjs/terminus con indicadores para PostgreSQL y Redis, y cómo los usa Cloud Run.
---

# Health checks con Terminus

<Tech ids={['nestjs', 'postgresql', 'redis', 'googlecloud']} />

<Estado tipo="construye">El `/api/health` de ripopola pasa a Terminus, con un chequeo de vida y otro de preparación que mira PostgreSQL y Redis.</Estado>

## Liveness contra readiness

| | Liveness (`/health/live`) | Readiness (`/health/ready`) |
| --- | --- | --- |
| Pregunta | ¿El proceso está vivo? | ¿Puede atender tráfico ahora? |
| Mira dependencias | **No** | Sí (base, Redis) |
| Si falla | La plataforma **reinicia** el contenedor | La plataforma **deja de mandarle** tráfico |

El error clásico: un liveness que consulta la base. Si PostgreSQL tiene un
problema, la plataforma reinicia todas las instancias de la API… que no
arreglan nada y empeoran la situación.

## En ripopola

```bash
pnpm add -E @nestjs/terminus
```

```ts title="health/prisma.health.ts"
import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';

@Injectable()
export class PrismaHealthIndicator {
  constructor(private readonly prisma: PrismaService, private readonly health: HealthIndicatorService) {}

  async isHealthy(key = 'database') {
    const indicator = this.health.check(key);
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return indicator.up();
    } catch (e) {
      return indicator.down({ message: 'sin conexión' });
    }
  }
}
```

(Terminus trae `PrismaHealthIndicator` propio, pero espera el cliente clásico;
con el adaptador de Prisma 7 es más simple y claro el nuestro.)

```ts title="health/health.controller.ts"
@Public()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: PrismaHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([() => this.memory.checkHeap('heap', 400 * 1024 * 1024)]);
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([() => this.db.isHealthy()]);
    // + Redis cuando esté (sección 10)
  }
}
```

Respuesta si todo está bien (200), o 503 con el detalle si algo falla:

```json
{ "status": "ok", "info": { "database": { "status": "up" } }, "error": {}, "details": { "database": { "status": "up" } } }
```

Cloud Run usa una *startup probe* y una *liveness probe* configurables; en
la sección 14 las apuntamos a estos endpoints.

:::tip Sin datos sensibles
El health check es público: no muestres versiones exactas, hosts ni
mensajes de error internos. (La versión de PostGIS que devolvía el primero
está bien para desarrollo, no para producción.)
:::

<Resumen>

- Liveness: solo el proceso; readiness: también las dependencias.
- Terminus con indicadores propios o incluidos.
- Públicos, sin versión de API y sin información sensible.

</Resumen>

## Preguntas de entrevista

**1. ¿Diferencia entre liveness y readiness?**
Liveness indica si el proceso está vivo (si falla, se reinicia); readiness si puede recibir tráfico (si falla, se lo saca del balanceo).

**2. ¿Por qué no chequear la base en el liveness?**
Porque una caída de la base haría reiniciar todas las instancias sin resolver nada.

**3. ¿Qué es Terminus?**
El módulo de health checks de Nest, con indicadores para bases, HTTP, memoria, disco, etc.
