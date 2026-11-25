---
title: Decidir y documentar la arquitectura
sidebar_label: Decisiones y ADRs
sidebar_position: 6
description: Qué es un ADR, cómo escribir uno, cómo justificar decisiones técnicas con criterios, trade-offs, y cómo presentar la arquitectura de ripopola en una entrevista o en el trabajo final.
---

# Decidir y documentar la arquitectura

<Tech ids={['nestjs', 'postgresql', 'googlecloud']} />

<Estado tipo="construye">Las decisiones de ripopola (D-01, D-02…) escritas de forma que cualquiera, incluido un tribunal o un entrevistador, entienda por qué se tomaron.</Estado>

## Lo que separa a un senior

Un senior no es quien conoce más librerías, sino quien puede decir **por
qué** eligió algo, **qué resignó** y **cuándo lo cambiaría**. Toda decisión
técnica es un *trade-off*: no existe "la mejor herramienta", existe la más
adecuada para un contexto.

## ADR: Architecture Decision Record

Un **ADR** es un documento corto, uno por decisión, que queda en el repo
junto al código. El formato clásico (Michael Nygard), con un ejemplo de
ripopola (usá el número que siga en el registro de decisiones del repo):

```markdown title="docs/decisiones/D-XX-redis-y-bullmq.md"
# D-XX. Redis con BullMQ para colas, caché y tiempo real

- Estado: aceptada
- Fecha: 2026-11-20

## Contexto
Las traducciones con IA tardan varios segundos y fallan a veces.
Necesitamos además caché de fichas públicas y que las notificaciones
lleguen con varias instancias de la API.

## Opciones
1. Redis + BullMQ (y el mismo Redis para caché y Socket.IO)
2. Cloud Tasks + Memorystore
3. Tabla de trabajos en PostgreSQL (pg-boss)

## Decisión
Opción 1. Una sola pieza de infraestructura cubre tres necesidades,
es el estándar con Nest (@nestjs/bullmq, cache-manager, redis-adapter)
y funciona igual en local con Docker.

## Consecuencias
- Un servicio más que operar; proveedor a elegir al desplegar.
- Redis con `noeviction` y persistencia.
- El worker necesita CPU siempre asignada en Cloud Run.
- Si el volumen es muy bajo, revisar pg-boss para ahorrar el costo fijo.
```

Reglas:

- **Inmutables**: si la decisión cambia, se escribe un ADR nuevo que
  *reemplaza* al anterior (y el viejo pasa a "reemplazada por D-20").
- **Cortos**: una página. Si hace falta más, es un documento de diseño.
- **Opciones reales**: si solo hay una opción, no es una decisión.
- **Consecuencias honestas**: incluir lo malo.

## Criterios para decidir

Ripopola tiene su regla (D-12): **barato, con soporte, usado en el mercado,
estándar**. Otros ejes habituales:

| Eje | Pregunta |
| --- | --- |
| Costo | ¿Cuánto cuesta con 10 municipios? ¿Y con 5.000? |
| Operación | ¿Quién lo mantiene, actualiza y monitorea? |
| Equipo | ¿Lo sabe usar quien lo va a mantener? |
| Reversibilidad | ¿Es una puerta de una vía o de dos? |
| Madurez | ¿Lo usa el mercado? ¿Hay soporte y comunidad? |
| Encaje | ¿Resuelve el problema real o uno imaginario? |

La **reversibilidad** es clave: elegir la base de datos es difícil de
deshacer (decidir con cuidado); elegir una librería de logging es fácil
(decidir rápido y seguir).

## Presentar la arquitectura

Para la entrevista y para el trabajo final, un orden que funciona:

1. **El problema y los usuarios**: municipios que publican, personas que buscan.
2. **Requisitos que mandan**: SEO de las fichas, búsqueda geográfica, multi-idioma, costo bajo al empezar.
3. **Diagrama de contexto**: los sistemas y quién habla con quién (el mapa de la sección 14).
4. **Decisiones clave con sus ADRs**: monolito modular, PostgreSQL + PostGIS, Better Auth, Cloud Run + Neon, Redis.
5. **Cómo escala y qué cambiaría**: el worker aparte, la caché, la primera señal para separar un servicio.
6. **Calidad**: tests, CI, observabilidad, seguridad (OWASP).

El **modelo C4** (Contexto, Contenedores, Componentes, Código) es una forma
estándar de dibujar arquitectura en niveles; los dos primeros niveles
alcanzan para casi cualquier presentación.

<Ejercicio title="Tu primer ADR">

Escribí el ADR de la elección de ORM (Prisma frente a TypeORM y Drizzle) con
las notas de la sección 2. Después, el de autenticación: Better Auth
frente a Firebase Auth, Auth.js y Passport con JWT propio (sección 6, temas
6 y 7). Es un caso real: ripopola empezó con
Firebase y cambió, así que el ADR nuevo *reemplaza* al anterior. Son dos
capítulos listos para el trabajo final.

</Ejercicio>

<Resumen>

- Toda decisión es un trade-off: qué se gana, qué se resigna, cuándo se revisa.
- ADR: contexto, opciones, decisión, consecuencias; corto e inmutable.
- Criterios explícitos (D-12) y atención a la reversibilidad.
- Presentar: problema, requisitos, contexto, decisiones, escala, calidad.

</Resumen>

## Preguntas de entrevista

**1. Contame una decisión técnica que hayas tomado y por qué.**
Respondé con estructura de ADR: contexto, opciones que evaluaste, qué elegiste, qué resignaste y qué señal te haría cambiarla. Ripopola te da varias (Prisma, el cambio de Firebase Auth a Better Auth, Redis).

**2. ¿Qué es un ADR?**
Un registro breve de una decisión de arquitectura con su contexto, alternativas y consecuencias, versionado junto al código para que se entienda en el futuro por qué el sistema es como es.

**3. ¿Cómo evaluás una tecnología nueva para el equipo?**
Por el problema que resuelve, costo, madurez y soporte, curva de aprendizaje del equipo, operación y qué tan reversible es adoptarla. Idealmente con una prueba acotada antes de comprometerse.
