---
title: Borrado en cascada y borrado lógico
sidebar_label: Borrado físico y lógico
sidebar_position: 5
description: Qué pasa con los registros relacionados al borrar, borrado lógico con deletedAt y cómo aplicarlo a las ofertas de ripopola.
---

# Borrado en cascada y borrado lógico

<Tech ids={['prisma', 'postgresql']} />

<Estado tipo="construye">Las viviendas se archivan en vez de borrarse (borrado lógico), y las fotos se borran en cascada con su pueblo.</Estado>

## Borrado físico y `onDelete`

Ya definiste `onDelete` en las relaciones. Resumen de las decisiones de ripopola:

| Hijo | Si se borra el pueblo | Por qué |
| --- | --- | --- |
| `Media` | `Cascade` | Una foto no tiene sentido sola. (Además hay que borrar el archivo en Cloud Storage: lo hace un evento.) |
| `HousingListing` | `Restrict` | Evita perder ofertas por un borrado accidental. Primero hay que archivarlas. |
| `Membership` (de la organización) | `Cascade` | Sin organización no hay membresía. |

:::warning La cascada es silenciosa
Un `DELETE` de un pueblo puede borrar cientos de filas sin avisar. Usá
`Cascade` solo cuando el hijo realmente no tiene valor sin el padre.
:::

## Borrado lógico (soft delete)

En vez de borrar, se **marca** el registro como borrado:

```prisma
model HousingListing {
  // ...
  deletedAt DateTime? @map("deleted_at") @db.Timestamptz(3)
  @@index([townId, deletedAt])
}
```

```ts
// "Borrar"
prisma.housingListing.update({ where: { id }, data: { deletedAt: new Date() } });

// Listar solo las vigentes
prisma.housingListing.findMany({ where: { townId, deletedAt: null } });
```

| Ventajas | Desventajas |
| --- | --- |
| Se puede recuperar | Hay que acordarse de filtrar `deletedAt: null` **en todas** las consultas |
| Historial y auditoría | Los `@unique` chocan con registros "borrados" |
| Las FK no se rompen | La tabla crece; hay que purgar algún día |
| | Puede chocar con el derecho al olvido (RGPD): los datos personales se tienen que borrar de verdad |

### Que no se te olvide el filtro

Es el problema principal. Opciones:

1. **Un método del servicio** que siempre agrega el filtro (`activeWhere()`).
2. **Una Client Extension** que agrega `deletedAt: null` a todas las lecturas del modelo.
3. **Una vista** en PostgreSQL (`active_housing_listings`).

Para ripopola: opción 1 al principio. Si aparecen más modelos con borrado
lógico, la 2.

### Índices únicos parciales

Si quisieras que el slug de una vivienda sea único **solo entre las no
borradas**, PostgreSQL lo permite con un índice parcial (en una migración SQL):

```sql
CREATE UNIQUE INDEX housing_slug_active ON housing_listings (slug) WHERE deleted_at IS NULL;
```

## Archivado contra borrado lógico

Para las ofertas de ripopola, en realidad lo natural es un **estado de
negocio** (`ARCHIVED`, `EXPIRED`), como hicimos con `TownStatus`: "archivada"
es algo que el municipio entiende y puede filtrar. `deletedAt` queda para lo
que el usuario quiso eliminar.

<Alternativa title="TypeORM y Mongoose">

TypeORM trae borrado lógico de serie: `@DeleteDateColumn` y `softDelete()`
filtran automáticamente. Mongoose lo resuelve con plugins
(`mongoose-delete`). En Prisma se implementa a mano o con una extensión.

</Alternativa>

<Resumen>

- `Cascade` solo si el hijo no vale nada sin el padre; `Restrict` para lo valioso.
- Borrado lógico: recuperable, pero hay que filtrar siempre.
- Estados de negocio (`ARCHIVED`) suelen ser mejor que `deletedAt`.
- Datos personales: borrado real (RGPD).

</Resumen>

## Preguntas de entrevista

**1. ¿Qué es el soft delete y qué problemas trae?**
Marcar como borrado en vez de borrar. Problemas: filtrar en todas las
consultas, conflictos con únicos, crecimiento y cumplimiento legal.

**2. ¿Cómo garantizás unicidad solo entre registros activos?**
Con un índice único parcial (`WHERE deleted_at IS NULL`).

**3. ¿Cómo conciliás soft delete con el RGPD?**
Los datos personales se borran o anonimizan de verdad cuando se pide; el soft delete se usa para datos de negocio.
