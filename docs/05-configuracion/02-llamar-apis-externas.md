---
title: Llamar a APIs externas desde Nest
sidebar_label: APIs externas
sidebar_position: 2
description: fetch nativo contra HttpModule, timeouts, reintentos con backoff, circuit breaker y un adaptador para traer el clima de cada pueblo desde Open-Meteo.
---

# Llamar a APIs externas desde Nest

<Tech ids={['nestjs', 'nodedotjs']} />

<Estado tipo="construye">Un `ClimateClient` que trae el clima medio de cada pueblo desde Open-Meteo (gratis, sin clave) para completar la sección de clima de la ficha.</Estado>

## Concepto

Un backend real habla con otros servicios: mapas, IA, correo, datos
oficiales. Toda llamada por red **puede fallar o tardar**, así que hay que
diseñarla para eso:

| Problema | Solución |
| --- | --- |
| El servicio no responde | **Timeout** siempre |
| Falla a veces (red, 503) | **Reintentos** con espera creciente (*backoff*) |
| Está caído un buen rato | **Circuit breaker**: dejar de llamar un tiempo |
| Responde algo inesperado | **Validar** la respuesta |
| Cambia de proveedor | **Adaptador** con interfaz propia |

### ¿`fetch` o `HttpModule`?

- **`fetch` nativo** (Node 18+): sin dependencias, con `AbortSignal.timeout()`. Es lo que usamos.
- **`@nestjs/axios` (`HttpModule`)**: envuelve Axios y devuelve Observables.
  Lo usa el curso de referencia y mucho código existente. Útil si querés
  interceptors de Axios o usar operadores de RxJS (`retry`, `timeout`).

<Angular>

`HttpModule` de Nest se parece mucho a `HttpClient` de Angular: devuelve
Observables y se pueden encadenar `retry`, `timeout` y `catchError`. Si te
sentís cómodo con RxJS, es una opción perfectamente válida.

</Angular>

## En ripopola: el clima de cada pueblo

### 1. La interfaz (lo que la app necesita)

```ts title="climate/climate.client.ts"
export interface MonthlyClimate {
  month: number;          // 1-12
  avgTempC: number;
  precipitationMm: number;
}

export abstract class ClimateClient {
  abstract monthlyNormals(lng: number, lat: number): Promise<MonthlyClimate[]>;
}
```

Usar una **clase abstracta** como token es un truco útil en Nest: a
diferencia de una interfaz, existe en runtime, así que sirve como token sin `@Inject()`.

### 2. El adaptador de Open-Meteo

```ts title="climate/open-meteo.client.ts"
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ClimateClient, MonthlyClimate } from './climate.client';

@Injectable()
export class OpenMeteoClimateClient extends ClimateClient {
  private readonly logger = new Logger(OpenMeteoClimateClient.name);

  async monthlyNormals(lng: number, lat: number): Promise<MonthlyClimate[]> {
    const url = new URL('https://archive-api.open-meteo.com/v1/archive');
    url.search = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      start_date: '2015-01-01',
      end_date: '2024-12-31',
      daily: 'temperature_2m_mean,precipitation_sum',
      timezone: 'UTC',
    }).toString();

    const data = await this.getJson<OpenMeteoDaily>(url);
    return aggregateByMonth(data); // función pura, probada aparte
  }

  private async getJson<T>(url: URL, attempts = 3): Promise<T> {
    for (let i = 1; i <= attempts; i++) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
        if (res.status >= 500 || res.status === 429) throw new Error(`HTTP ${res.status}`);
        if (!res.ok) throw new ServiceUnavailableException(`Open-Meteo respondió ${res.status}`);
        return (await res.json()) as T;
      } catch (err) {
        if (i === attempts || err instanceof ServiceUnavailableException) throw err;
        const wait = 2 ** i * 250 + Math.random() * 250; // backoff exponencial con jitter
        this.logger.warn(`Reintento ${i} en ${Math.round(wait)}ms: ${(err as Error).message}`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
    throw new Error('inalcanzable');
  }
}
```

Qué mirar:

- **Timeout** con `AbortSignal.timeout`: sin él, una llamada colgada retiene la petición para siempre.
- **Se reintenta solo lo que tiene sentido**: errores de red, 5xx y 429. Un 400 no va a cambiar.
- **Backoff exponencial con jitter**: esperar 0,5 s, 1 s, 2 s… con algo de
  azar, para no saturar al servicio cuando se recupera (todos los clientes reintentando a la vez).
- La transformación a lo que necesita ripopola (`aggregateByMonth`) es una
  función pura: se prueba con un JSON de ejemplo, sin red.

### 3. Registrar

```ts
@Module({
  providers: [{ provide: ClimateClient, useClass: OpenMeteoClimateClient }],
  exports: [ClimateClient],
})
export class ClimateModule {}
```

```ts
constructor(private readonly climate: ClimateClient) {} // sin @Inject: la clase abstracta es el token
```

### 4. ¿Cuándo se llama?

**Nunca durante la petición del usuario**. El clima medio no cambia: se
calcula una vez al cargar el pueblo (o al cambiar su ubicación), en segundo
plano (sección 10), y se guarda en `details.climate`. La ficha solo lee de la base.

:::tip Regla general
Si un dato externo no cambia en cada petición, **traelo una vez y guardalo**.
Tu API es más rápida, no depende de que el otro servicio esté arriba y no
gastás cuota.
:::

### 5. Circuit breaker (concepto)

Si Open-Meteo está caído, reintentar en cada trabajo empeora todo. Un
**circuit breaker** cuenta los fallos y, superado un umbral, "abre el
circuito": falla de inmediato durante un tiempo sin llamar, y después prueba
de nuevo. La librería estándar en Node es **opossum**.

<Resumen>

- Toda llamada externa: timeout, reintentos con backoff y validación.
- Reintentar solo errores transitorios (red, 5xx, 429).
- Interfaz propia + adaptador; la clase abstracta sirve como token.
- Datos que no cambian: traerlos en segundo plano y guardarlos.

</Resumen>

## Preguntas de entrevista

**1. ¿Qué cuidados tenés al llamar a un servicio externo?**
Timeout, reintentos con backoff solo para errores transitorios, validar la
respuesta, circuit breaker y aislarlo detrás de una interfaz.

**2. ¿Qué es backoff exponencial con jitter?**
Esperas que se duplican entre reintentos, con un componente aleatorio para
que muchos clientes no reintenten al mismo tiempo.

**3. ¿Qué es un circuit breaker?**
Un mecanismo que deja de llamar a un servicio que falla repetidamente durante
un tiempo, para no empeorar su caída y fallar rápido.

**4. ¿Por qué usar una clase abstracta como token en Nest?**
Porque existe en runtime (a diferencia de una interfaz), así sirve como
token de inyección sin `@Inject()` y define el contrato.
