---
title: Transacciones
sidebar_position: 4
description: Transacciones en lote e interactivas con Prisma, niveles de aislamiento, bloqueo optimista y cómo llevar transacciones entre servicios de Nest.
---

# Transacciones

<Tech ids={['prisma', 'postgresql', 'nestjs']} />

<Estado tipo="construye">El alta de un ayuntamiento (organización + vínculo con el pueblo + membresía del primer admin) en una sola transacción, y edición concurrente segura con bloqueo optimista.</Estado>

## Concepto

Una transacción agrupa operaciones que se confirman **todas o ninguna**
(atomicidad, viste ACID en la sección 2). En Prisma hay tres formas:

| Forma | Ejemplo | Cuándo |
| --- | --- | --- |
| Escrituras anidadas | `create` con `photos: { create: [...] }` | Un registro y sus hijos. Ya son transaccionales. |
| En lote | `$transaction([op1, op2])` | Operaciones independientes que tienen que ir juntas. |
| Interactiva | `$transaction(async (tx) => { ... })` | Cuando una operación depende del resultado de otra, con lógica en el medio. |

## En ripopola: dar de alta un ayuntamiento

Cuando un ayuntamiento reclama su pueblo (*claim*), hay que hacer tres cosas
que no pueden quedar a medias:

1. Crear la organización.
2. Vincularla al pueblo (si el pueblo no tiene ya otra).
3. Crear la membresía `ADMIN` para quien lo pidió.

```ts title="organizations/organizations.service.ts"
import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  claimTown(userId: string, townId: string, name: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Bloqueo de lectura: nadie más reclama el mismo pueblo a la vez
      const [town] = await tx.$queryRaw<{ organization_id: string | null }[]>`
        SELECT organization_id FROM towns WHERE id = ${townId}::uuid FOR UPDATE
      `;
      if (!town) throw new ConflictException('El pueblo no existe');
      if (town.organization_id) throw new ConflictException('El pueblo ya tiene un ayuntamiento');

      // 2. Crear todo con el cliente de la transacción (tx, no this.prisma)
      const org = await tx.organization.create({ data: { name } });
      await tx.town.update({ where: { id: townId }, data: { organizationId: org.id } });
      await tx.membership.create({ data: { userId, organizationId: org.id, role: 'ADMIN' } });

      return org;
    });
  }
}
```

Qué mirar:

- **Todo con `tx`**. Si usás `this.prisma` adentro, esa operación queda **fuera** de la transacción.
- Si cualquier paso tira una excepción, Prisma hace **rollback** de todo.
- `SELECT ... FOR UPDATE` bloquea la fila del pueblo hasta el final de la
  transacción: si dos ayuntamientos reclaman el mismo pueblo a la vez, el
  segundo espera y después ve que ya tiene dueño.
- **No hagas llamadas lentas adentro** (HTTP, IA, correo): la transacción
  mantiene bloqueos y una conexión del pool. Prisma corta a los 5 segundos
  por defecto (`timeout`). El correo de bienvenida va **después**, con un evento (sección 10).

## Niveles de aislamiento

```ts
prisma.$transaction(fn, { isolationLevel: 'Serializable', timeout: 10_000 });
```

| Nivel | Evita | Costo |
| --- | --- | --- |
| Read Committed (por defecto en PostgreSQL) | Leer datos no confirmados | Bajo |
| Repeatable Read | Que una fila cambie entre dos lecturas de tu transacción | Medio |
| Serializable | Cualquier anomalía: es como si las transacciones fueran en fila | Alto: hay que reintentar ante conflictos |

En la mayoría de los casos alcanza con Read Committed más bloqueos puntuales
(`FOR UPDATE`) o restricciones únicas.

## Bloqueo optimista: dos editores, un pueblo

Dos personas del ayuntamiento abren la ficha y guardan cambios. Sin control,
**el último pisa al primero** sin que nadie se entere (*lost update*).

El bloqueo optimista agrega una versión:

```prisma
model Town {
  // ...
  version Int @default(0)
}
```

```ts
async update(id: string, dto: UpdateTownDto & { version: number }) {
  const { version, ...data } = dto;
  const result = await this.prisma.town.updateMany({
    where: { id, version },                  // solo si nadie lo cambió
    data: { ...data, version: { increment: 1 } },
  });
  if (result.count === 0) {
    throw new ConflictException('Otra persona modificó este pueblo. Recargá y volvé a intentar.');
  }
}
```

El panel manda la `version` que leyó. Si no coincide, 409 y el usuario recarga.
En HTTP esto también se hace con las cabeceras `ETag` e `If-Match`.

## Transacciones entre servicios

Si `OrganizationsService` y `MembershipsService` tienen que participar en la
misma transacción, una opción es pasar `tx` como parámetro. Otra, más
limpia, es **`@nestjs-cls/transactional`**, que guarda la transacción en el
contexto de la petición (AsyncLocalStorage) y permite un decorador `@Transactional()`.
Se usa mucho en proyectos grandes; para ripopola, pasar `tx` alcanza por ahora.

<Alternativa title="QueryRunner de TypeORM">

En TypeORM las transacciones manuales usan un `QueryRunner`
(`connect`, `startTransaction`, `commitTransaction`, `rollbackTransaction`,
`release`) o `dataSource.transaction(async (manager) => ...)`. El curso de
referencia usa QueryRunner para actualizar un producto y sus imágenes. La
interactiva de Prisma equivale a `dataSource.transaction`.

</Alternativa>

<Resumen>

- Anidadas, en lote o interactivas: elegí la más simple que alcance.
- Dentro de la interactiva, todo con `tx`, y nada lento.
- `FOR UPDATE` para serializar el acceso a una fila.
- Bloqueo optimista con `version` contra las actualizaciones perdidas.

</Resumen>

## Preguntas de entrevista

**1. ¿Qué es una transacción y cuándo la usás?**
Un grupo de operaciones atómico. Cuando varias escrituras tienen que quedar todas o ninguna.

**2. ¿Por qué no llamar a una API externa dentro de una transacción?**
Porque la transacción mantiene bloqueos y una conexión ocupadas mientras espera, y si falla no podés deshacer la llamada externa.

**3. ¿Qué es el bloqueo optimista y cuándo lo preferís al pesimista?**
Detectar conflictos al guardar comparando una versión, sin bloquear al leer.
Es mejor cuando los conflictos son raros, como en la edición de fichas.

**4. ¿Qué nivel de aislamiento usa PostgreSQL por defecto?**
Read Committed.

**5. ¿Qué es un lost update?**
Cuando dos transacciones leen el mismo dato, lo modifican y la segunda pisa los cambios de la primera.
