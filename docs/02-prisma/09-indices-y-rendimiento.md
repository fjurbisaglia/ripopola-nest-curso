---
title: Índices y rendimiento de consultas
sidebar_label: Índices y rendimiento
sidebar_position: 9
description: Qué es un índice, tipos de índices en PostgreSQL, EXPLAIN ANALYZE, el problema N+1 y cómo ver las consultas que genera Prisma.
---

# Índices y rendimiento de consultas

<Tech ids={['prisma', 'postgresql']} />

<Estado tipo="construye">Los índices del listado de pueblos y el log de consultas lentas de Prisma en desarrollo.</Estado>

## Qué es un índice

Sin índice, para encontrar los pueblos de España PostgreSQL lee **toda la
tabla** (*sequential scan*). Un **índice** es una estructura aparte, ordenada,
que permite ir directo a las filas (como el índice de un libro).

- ✅ Lecturas mucho más rápidas en los filtros y órdenes que cubre.
- ❌ Cada escritura tiene que actualizar también el índice, y ocupa espacio.

Por eso no se indexa "todo": se indexa **lo que las consultas reales usan**.

### Tipos en PostgreSQL

| Tipo | Sirve para | En ripopola |
| --- | --- | --- |
| B-tree (por defecto) | `=`, `<`, `>`, `ORDER BY`, `LIKE 'abc%'` | `country, status`, `slug` |
| GIN | Arrays, JSONB, full-text, trigram | `tags`, búsqueda por nombre con `pg_trgm` |
| GiST | Datos geográficos y rangos | Coordenadas con PostGIS (sección 4) |
| BRIN | Tablas enormes ordenadas físicamente (logs por fecha) | Eventos de auditoría, a futuro |

### Índices compuestos: el orden importa

`@@index([country, status])` sirve para `WHERE country = 'ES'` y para
`WHERE country = 'ES' AND status = 'PUBLISHED'`, pero **no** para
`WHERE status = 'PUBLISHED'` solo. La regla: el índice se usa de izquierda a derecha.

## En ripopola: índices del listado

```prisma
model Town {
  // ...
  @@index([country, status, officialName])   // listado filtrado y ordenado por nombre
  @@index([tags], type: Gin)                 // filtro por etiquetas
  @@map("towns")
}
```

`slug` ya tiene índice por ser `@unique`. Generá la migración y mirá el SQL:
`CREATE INDEX ... USING GIN (tags)`.

## Medir: `EXPLAIN ANALYZE`

```sql
EXPLAIN ANALYZE
SELECT id, slug FROM towns
WHERE country = 'ES' AND status = 'PUBLISHED'
ORDER BY official_name LIMIT 20;
```

Qué mirar en la salida:

- `Seq Scan` en una tabla grande: falta un índice (con pocas filas es normal: leer todo es más barato).
- `Index Scan` / `Index Only Scan`: usa el índice.
- `actual time` y `rows`: cuánto tardó y cuántas filas procesó realmente.

:::tip Con pocos datos todo es rápido
Para ver diferencias reales cargá miles de pueblos con el seed (sección 3).
España tiene ~8.100 municipios e Italia ~7.900: es un volumen real para practicar.
:::

## Ver las consultas de Prisma

```ts title="prisma.service.ts (solo desarrollo)"
super({
  adapter,
  log: process.env['NODE_ENV'] === 'development'
    ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
    : ['warn', 'error'],
});

// en onModuleInit
this.$on('query', (e) => {
  if (e.duration > 100) this.logger.warn(`Consulta lenta (${e.duration}ms): ${e.query}`);
});
```

## El problema N+1

```ts
// ❌ 1 consulta para los pueblos + 1 por cada pueblo = N+1
const towns = await prisma.town.findMany({ take: 20 });
for (const t of towns) {
  t.photos = await prisma.media.findMany({ where: { townId: t.id } });
}

// ✅ 2 consultas en total
const towns = await prisma.town.findMany({ take: 20, include: { photos: true } });
```

Con 20 pueblos son 21 consultas contra 2. En un listado de 100, la diferencia
se nota. Prisma resuelve `include` con una consulta por relación (o con un
`JOIN` usando `relationLoadStrategy: 'join'`).

<Entrevista>

Si te preguntan "una pantalla está lenta, ¿qué hacés?": **medir primero**.
Logs de consultas lentas, `EXPLAIN ANALYZE` sobre la sospechosa, buscar N+1 y
scans completos, agregar el índice que falta, y recién después pensar en caché.

</Entrevista>

<Resumen>

- Índices para lo que filtrás y ordenás; cada uno cuesta en escrituras.
- B-tree por defecto, GIN para arrays/JSON/texto, GiST para geografía.
- En los compuestos importa el orden de las columnas.
- `EXPLAIN ANALYZE` para medir; `include` para evitar N+1.

</Resumen>

## Preguntas de entrevista

**1. ¿Qué es un índice y qué costo tiene?**
Una estructura ordenada que acelera búsquedas; cuesta espacio y hace más lentas las escrituras.

**2. Tengo un índice en `(country, status)`. ¿Sirve para filtrar solo por `status`?**
No en general: un índice compuesto se usa desde la columna de la izquierda.

**3. ¿Qué es el problema N+1?**
Hacer una consulta para una lista y otra por cada elemento para traer sus
relaciones. Se resuelve trayendo las relaciones en lote (`include`, joins).

**4. ¿Para qué sirve `EXPLAIN ANALYZE`?**
Para ver el plan real de ejecución: si usa índices, cuántas filas lee y cuánto tarda cada paso.

**5. ¿Qué índice usarías para una columna array o JSONB?**
GIN.
