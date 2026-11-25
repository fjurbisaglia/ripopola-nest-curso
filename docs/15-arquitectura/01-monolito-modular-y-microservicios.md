---
title: Monolito modular y microservicios
sidebar_label: Monolito modular y microservicios
sidebar_position: 1
description: Por qué ripopola es un monolito modular, cómo se marcan los límites entre módulos, cuándo separar un servicio, @nestjs/microservices y sus transportes.
---

# Monolito modular y microservicios

<Tech ids={['nestjs', 'nx', 'redis']} />

<Estado tipo="construye">La forma de ripopola: una sola API desplegable, dividida en módulos de dominio con límites claros. Los microservicios quedan como concepto.</Estado>

## Concepto

| | Monolito "bola de barro" | **Monolito modular** | Microservicios |
| --- | --- | --- | --- |
| Despliegue | Uno | Uno | Uno por servicio |
| Límites internos | Ninguno: todo importa todo | Módulos con API pública y reglas | Red entre servicios |
| Base de datos | Compartida sin orden | Compartida, cada módulo dueño de sus tablas | Una por servicio |
| Complejidad operativa | Baja | Baja | Alta (red, versiones, trazas, consistencia eventual) |
| Equipos | Uno chico | Uno o varios | Muchos, independientes |

La frase que conviene saber decir en una entrevista: **los microservicios
resuelven un problema de organización (muchos equipos desplegando
independientemente), no de rendimiento**. Para un equipo de una persona,
un monolito modular bien hecho es la opción correcta, y deja la puerta
abierta para separar después.

## En ripopola

### 1. Módulos de dominio con API pública

Cada módulo de Nest es un **contexto** del negocio: `towns`, `housing`,
`organizations`, `auth`, `media`, `notifications`, `translations`. La regla:

- Un módulo **exporta** solo lo que otros pueden usar (un servicio de
  fachada, no su repositorio ni sus helpers).
- Otro módulo **no consulta las tablas ajenas** con Prisma directamente:
  le pide al módulo dueño.

```ts title="towns/towns.module.ts"
@Module({
  imports: [DatabaseModule],
  controllers: [TownsController],
  providers: [TownsService, TownGeoRepository, TownPolicy],
  exports: [TownsService], // la "API pública" del módulo
})
export class TownsModule {}
```

### 2. Límites que el compilador hace cumplir

En la sección 12 vimos los *tags* de Nx (`scope:backend`, `type:feature`) y
la regla `enforce-module-boundaries`. Es la herramienta que convierte
"módulos ordenados" en **límites reales**: si `housing` importa algo
interno de `towns`, el lint falla.

### 3. Comunicación entre módulos

- **Llamada directa** a un servicio exportado: cuando necesitás la respuesta.
- **Evento de dominio** (`town.published`, sección 10): cuando el otro
  módulo reacciona y al emisor no le importa cómo. Así `translations` y
  `notifications` no son dependencias de `towns`.

Esos eventos internos son exactamente lo que, el día de mañana, se
publicaría en un broker si un módulo se separara como servicio.

## Cuándo separar un servicio

Señales reales (no "porque está de moda"):

- Necesita **escalar distinto**: el worker de traducciones ya corre como
  proceso aparte (sección 14), y es el primer candidato.
- Otro **equipo** lo mantiene y quiere desplegar a su ritmo.
- Tiene requisitos técnicos distintos (otro lenguaje, GPU, aislamiento).
- Su fallo no debe tumbar al resto.

Patrón para migrar: **strangler fig**. Se pone el nuevo servicio al lado,
se le van pasando responsabilidades y el monolito se achica, sin una
reescritura de una sola vez.

## Microservicios en Nest

`@nestjs/microservices` permite crear apps que **no hablan HTTP**, sino un
*transporte*: TCP, Redis, NATS, RabbitMQ, Kafka, gRPC, MQTT.

```ts title="Concepto: un servicio de traducciones aparte"
// En el microservicio
@Controller()
export class TranslationsController {
  @MessagePattern('translate')            // petición-respuesta
  translate(@Payload() dto: TranslateDto) { /* ... */ }

  @EventPattern('town.published')          // evento, sin respuesta
  onPublished(@Payload() e: TownPublishedEvent) { /* ... */ }
}

// En la API
@Inject('TRANSLATIONS') private readonly client: ClientProxy;
this.client.send('translate', dto);        // Observable con la respuesta
this.client.emit('town.published', event); // dispara y sigue
```

- **`@MessagePattern`** = petición y respuesta (como una llamada).
- **`@EventPattern`** = evento sin respuesta (como un `@OnEvent`, pero entre procesos).
- Los mismos guards, pipes, interceptors y filtros funcionan (con
  `RpcException`).
- Una **app híbrida** (`app.connectMicroservice(...)`) atiende HTTP y un
  transporte a la vez.

:::info Por qué ripopola usa BullMQ y no esto
Para el trabajo en segundo plano, una cola con reintentos y persistencia
(BullMQ) da más garantías que un `emit` por Redis Pub/Sub, que se pierde si
nadie escucha. `@nestjs/microservices` tiene sentido cuando hay servicios
de verdad que se llaman entre sí.
:::

<Alternativa title="Transportes del mercado">

**Kafka** para flujos de eventos grandes y con historial (reprocesar),
**RabbitMQ** para colas y enrutamiento clásicos, **NATS** liviano y rápido,
**gRPC** para llamadas síncronas tipadas entre servicios (contratos en
Protobuf), y en Google Cloud, **Pub/Sub** gestionado. Saber cuándo usar cada
uno es una pregunta clásica de entrevista senior.

</Alternativa>

<Resumen>

- Monolito modular: un despliegue, módulos con API pública y tablas propias.
- Límites forzados con tags de Nx; comunicación por servicios exportados o eventos.
- Separar por escala, equipos o aislamiento; migrar con strangler fig.
- `@nestjs/microservices`: transportes, `@MessagePattern`, `@EventPattern`, `ClientProxy`.

</Resumen>

## Preguntas de entrevista

**1. ¿Monolito o microservicios para un producto nuevo?**
Monolito modular: menos complejidad operativa y velocidad para cambiar el dominio mientras se descubre. Se separan servicios cuando aparece una razón concreta de escala, equipos o aislamiento.

**2. ¿Qué problemas trae pasar a microservicios?**
Latencia y fallos de red, consistencia eventual, transacciones distribuidas (sagas), versionado de contratos, observabilidad distribuida y más infraestructura.

**3. ¿Diferencia entre `@MessagePattern` y `@EventPattern`?**
El primero es petición-respuesta: el cliente espera un resultado. El segundo es un evento sin respuesta: el emisor no espera a nadie.

**4. ¿Qué es el patrón strangler fig?**
Reemplazar un sistema de a partes, desviando funcionalidades al nuevo poco a poco hasta que el viejo puede apagarse.
