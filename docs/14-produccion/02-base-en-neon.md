---
title: PostgreSQL con PostGIS en Neon
sidebar_label: Base en Neon
sidebar_position: 2
description: Crear la base gestionada en Neon con PostGIS, conexión directa contra pooler, migraciones con migrate deploy, ramas de base y backups.
---

# PostgreSQL con PostGIS en Neon

<Tech ids={['neon', 'postgresql', 'prisma']} />

<Estado tipo="construye">La base de producción de ripopola: PostgreSQL gestionado en Neon, con PostGIS y las migraciones aplicadas de forma controlada.</Estado>

## Concepto

Una **base gestionada** te saca de encima instalar, actualizar, hacer
backups y monitorear el servidor. **Neon** es PostgreSQL *serverless*:
separa almacenamiento y cómputo, escala el cómputo a cero cuando no hay uso
(barato para empezar) y permite **ramas** de la base como si fuera Git.

Es la candidata de la decisión de infraestructura de ripopola (junto con
Cloud Run): barata, estándar (es PostgreSQL de verdad) y con PostGIS.

## Conexión directa y pooler

PostgreSQL crea **un proceso por conexión**, y cada una consume memoria.
Con Cloud Run escalando a varias instancias, cada una con su pool de Prisma,
las conexiones se multiplican rápido.

```mermaid
flowchart LR
  subgraph Cloud Run
    I1[API 1<br/>pool 10] 
    I2[API 2<br/>pool 10]
    I3[API 3<br/>pool 10]
  end
  I1 & I2 & I3 --> P[PgBouncer de Neon<br/>-pooler]
  P --> DB[(PostgreSQL)]
  M[prisma migrate deploy] -->|conexión directa| DB
```

Neon da dos cadenas de conexión:

| | Host | Para |
| --- | --- | --- |
| **Pooled** | `…-pooler.…neon.tech` | La app: muchas conexiones cortas pasan por PgBouncer |
| **Directa** | `….neon.tech` | Migraciones y tareas administrativas |

El pooler trabaja en modo *transaction*: cada transacción puede ir por una
conexión distinta del servidor. Por eso las **migraciones** (que usan locks
y comandos de sesión) van por la directa.

### En ripopola

Dos variables, validadas en la configuración (sección 5):

```bash
# La app (PrismaPg) usa el pooler
DATABASE_URL="postgresql://app:***@ep-xxx-pooler.eu-central-1.aws.neon.tech/ripopola?sslmode=require"
# El CLI de Prisma (migraciones) usa la directa
DIRECT_DATABASE_URL="postgresql://app:***@ep-xxx.eu-central-1.aws.neon.tech/ripopola?sslmode=require"
```

```ts title="prisma.config.ts"
export default defineConfig({
  schema: 'apps/api/prisma/schema.prisma',
  migrations: { path: 'apps/api/prisma/migrations', seed: 'tsx apps/api/prisma/seed.ts' },
  datasource: {
    // El CLI usa la directa; en local, si no está definida, la misma de siempre
    url: env('DIRECT_DATABASE_URL') ?? env('DATABASE_URL'),
  },
});
```

La app sigue creando `PrismaPg` con `DATABASE_URL`, como en la sección 5.
Elegí la **región de Neon cerca de la de Cloud Run** (las dos en Europa,
para España e Italia): cada consulta cruza la red, y unos milisegundos por
consulta se notan en el SSR.

:::warning Revisá la sintaxis de tu versión
`env()` y el bloque `datasource` de `prisma.config.ts` siguen la forma de
Prisma 7. Antes de copiar, confirmalo en la documentación de la versión
fijada en el repo (regla D-04).
:::

## PostGIS en Neon

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Va en la **primera migración** (ya la tenés desde la sección 4), así
cualquier base nueva, incluidas las ramas, queda igual. Verificalo con
`SELECT postgis_full_version();`.

## Migraciones en producción

| Comando | Dónde | Qué hace |
| --- | --- | --- |
| `prisma migrate dev` | Solo local | Crea migraciones nuevas comparando el schema |
| `prisma migrate deploy` | Producción y CI | **Solo aplica** las pendientes, en orden; nunca crea ni resetea |
| `prisma migrate reset` | Nunca en producción | Borra todo y vuelve a aplicar |

Reglas que un senior cuida:

- **Migrar antes de desplegar el código nuevo**: la versión vieja de la API
  tiene que seguir funcionando con el schema nuevo durante el despliegue.
- **Cambios compatibles hacia atrás** (*expand and contract*): para renombrar
  una columna, primero se agrega la nueva, se escribe en las dos, se migra el
  dato, el código lee la nueva y recién en otro despliegue se borra la vieja.
- **Nunca editar una migración ya aplicada** en producción.
- Índices sobre tablas grandes con `CREATE INDEX CONCURRENTLY` (editando el
  SQL de la migración), para no bloquear escrituras.

## Ramas de base

Una **rama** de Neon es una copia instantánea (*copy-on-write*) de la base.
Sirve para:

- **Previews**: cada pull request con su propia base, con datos reales o de seed.
- **Probar una migración riesgosa** contra una copia de producción antes de aplicarla.
- **Recuperar** un estado anterior (*point-in-time restore*) dentro de la
  ventana de historial de tu plan.

## Backups y seguridad

- Neon guarda historial para restaurar a un momento dado; el tamaño de la
  ventana depende del plan. Además, un `pg_dump` periódico a Cloud Storage
  es barato y te deja independiente del proveedor.
- Usuario de la app **sin permisos de superusuario**: solo sobre su schema.
- `sslmode=require` siempre.
- Las cadenas de conexión van a **Secret Manager** (tema 3), nunca al repo.

<Alternativa title="Cloud SQL, Supabase, RDS">

**Cloud SQL** (Google) y **RDS/Aurora** (AWS) son las opciones clásicas: más
control y más caras, no escalan a cero. **Supabase** es PostgreSQL con
extras (auth, storage, realtime) y también trae PostGIS. Todas son
PostgreSQL, así que Prisma y el SQL de ripopola funcionan igual: cambiar de
proveedor es un `pg_dump` y una variable de entorno.

</Alternativa>

<Resumen>

- Neon: PostgreSQL serverless, escala a cero, ramas, PostGIS.
- La app por el pooler; migraciones por la conexión directa.
- `migrate deploy` en producción, antes del código nuevo y con cambios compatibles.
- Región cerca de Cloud Run, SSL, usuario sin privilegios, secretos fuera del repo.

</Resumen>

## Preguntas de entrevista

**1. ¿Qué es un connection pooler y por qué hace falta con serverless?**
Un intermediario (como PgBouncer) que reparte pocas conexiones reales de PostgreSQL entre muchos clientes. Con muchas instancias efímeras, sin pooler se agotan las conexiones de la base.

**2. ¿Diferencia entre `migrate dev` y `migrate deploy`?**
`dev` genera migraciones nuevas y puede resetear la base; es solo para desarrollo. `deploy` aplica las migraciones pendientes ya versionadas, sin generar ni borrar nada.

**3. ¿Cómo renombrás una columna sin tiempo de caída?**
Con *expand and contract*: agregar la columna nueva, escribir en las dos, copiar los datos, pasar las lecturas a la nueva y recién después eliminar la vieja, en despliegues separados.

**4. ¿Por qué las migraciones no van por el pooler?**
Porque en modo transacción el pooler puede cambiar de conexión entre sentencias, y las migraciones usan locks y configuraciones de sesión que necesitan una conexión estable.
