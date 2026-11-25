---
title: CRUD completo de pueblos con Prisma
sidebar_label: CRUD con Prisma
sidebar_position: 4
description: Las operaciones del cliente de Prisma (create, find, update, upsert, delete, count) con select, omit y DTOs de respuesta, completando el módulo de pueblos.
---

# CRUD completo de pueblos con Prisma

<Tech ids={['prisma', 'nestjs']} />

<Estado tipo="construye">El `TownsService` queda completo: listado paginado con total, ficha por slug, alta, edición, publicación y borrado, devolviendo solo los campos que corresponden.</Estado>

## Las operaciones del cliente

| Operación | Devuelve | Si no existe |
| --- | --- | --- |
| `findUnique({ where })` | el registro o `null` | `null` |
| `findUniqueOrThrow({ where })` | el registro | error P2025 |
| `findFirst({ where, orderBy })` | el primero o `null` | `null` |
| `findMany({ where, orderBy, skip, take })` | array | `[]` |
| `count({ where })` | número | 0 |
| `create({ data })` | el creado | — |
| `createMany({ data: [...] })` | `{ count }` | — |
| `update({ where, data })` | el actualizado | error P2025 |
| `updateMany({ where, data })` | `{ count }` | `{ count: 0 }` |
| `upsert({ where, create, update })` | el creado o actualizado | crea |
| `delete({ where })` | el borrado | error P2025 |
| `deleteMany({ where })` | `{ count }` | `{ count: 0 }` |

`findUnique`, `update`, `upsert` y `delete` solo aceptan en `where` campos
**únicos** (`id`, `slug`). Para filtrar por otra cosa se usan las versiones `Many` o `findFirst`.

## Elegir qué se devuelve: `select` y `omit`

```ts
// Solo estos campos (y el tipo de retorno se ajusta solo)
prisma.town.findMany({ select: { id: true, slug: true, officialName: true } });

// Todo menos estos
prisma.town.findUnique({ where: { slug }, omit: { details: true } });
```

Elegir campos en la consulta es mejor que borrarlos después: viaja menos
información desde la base y no hay riesgo de filtrar un campo interno.

## En ripopola

### 1. Una forma común para las listas

```ts title="apps/api/src/app/common/paginated.ts"
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

Esta interfaz va a la librería de contratos compartidos, para que el panel la use igual.

### 2. El servicio completo

```ts title="apps/api/src/app/towns/towns.service.ts"
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TownStatus } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Paginated } from '../common/paginated';
import { CreateTownDto } from './dto/create-town.dto';
import { ListTownsQueryDto } from './dto/list-towns-query.dto';
import { UpdateTownDto } from './dto/update-town.dto';

// Lo que muestra el listado: liviano
const TOWN_SUMMARY = {
  id: true,
  slug: true,
  officialName: true,
  country: true,
  region: true,
  population: true,
  tags: true,
} satisfies Prisma.TownSelect;

export type TownSummary = Prisma.TownGetPayload<{ select: typeof TOWN_SUMMARY }>;

@Injectable()
export class TownsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListTownsQueryDto): Promise<Paginated<TownSummary>> {
    const { country, page = 1, pageSize = 20 } = query;
    const where: Prisma.TownWhereInput = { status: TownStatus.PUBLISHED, country };

    // Dos consultas en una transacción: misma foto de los datos
    const [items, total] = await this.prisma.$transaction([
      this.prisma.town.findMany({
        where,
        select: TOWN_SUMMARY,
        orderBy: [{ officialName: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.town.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findBySlug(slug: string) {
    const town = await this.prisma.town.findFirst({
      where: { slug, status: TownStatus.PUBLISHED },
    });
    if (!town) throw new NotFoundException(`No existe el pueblo "${slug}"`);
    return town;
  }

  create(dto: CreateTownDto) {
    return this.prisma.town.create({ data: dto, select: TOWN_SUMMARY });
  }

  update(id: string, dto: UpdateTownDto) {
    return this.prisma.town.update({ where: { id }, data: dto, select: TOWN_SUMMARY });
  }

  publish(id: string) {
    return this.prisma.town.update({
      where: { id },
      data: { status: TownStatus.PUBLISHED },
      select: TOWN_SUMMARY,
    });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.town.delete({ where: { id } });
  }
}
```

Qué mirar:

- **`satisfies Prisma.TownSelect`**: TypeScript comprueba que el objeto es un
  `select` válido, pero conserva el tipo exacto para que `TownGetPayload`
  calcule el tipo de retorno.
- **`$transaction([...])`** con un array corre las dos consultas en la misma
  transacción: el `total` corresponde a la misma foto que los `items`.
- **`findFirst` con `status`**: un pueblo en borrador da 404 al público, sin revelar que existe.
- **`publish`** es una acción con nombre propio, no un `PATCH` genérico: en
  la sección 6 solo ciertos roles van a poder publicar.
- `update` y `remove` dejan que el filtro de Prisma convierta P2025 en 404.

### 3. El endpoint de publicar

```ts
@Post(':id/publish')
publish(@Param('id', ParseUUIDPipe) id: string) {
  return this.townsService.publish(id);
}
```

:::tip Acciones en REST
Cuando una operación es una **acción de negocio** (publicar, archivar,
aprobar) y no un simple cambio de campos, es común modelarla como
`POST /recurso/:id/accion`. Así cada acción tiene su permiso, su validación y su evento.
:::

### 4. Upsert: cargar sin duplicar

Útil para importar datos oficiales (por ejemplo, la lista de municipios del INE):

```ts
await this.prisma.town.upsert({
  where: { slug: 'albarracin' },
  create: { slug: 'albarracin', officialName: 'Albarracín', country: 'ES', population: 1000 },
  update: { population: 1000 },
});
```

<Alternativa title="TypeORM">

TypeORM usa un repositorio por entidad: `repo.find({ where, order, skip, take })`,
`repo.findOneBy({ slug })`, `repo.save(entity)` (crea o actualiza),
`repo.preload({ id, ...dto })` para editar y `repo.remove(entity)`. Para
contar con paginación, `findAndCount`. Los conceptos son los mismos.

</Alternativa>

<Resumen>

- `findUnique` / `update` / `delete` solo por campos únicos.
- `select` y `omit` deciden qué sale de la base; `Prisma.XGetPayload` calcula el tipo.
- `$transaction([...])` para leer lista y total consistentes.
- Acciones de negocio como endpoints propios (`/publish`).

</Resumen>

## Preguntas de entrevista

**1. ¿Diferencia entre `findUnique` y `findFirst`?**
`findUnique` busca por un campo único y usa su índice; `findFirst` acepta cualquier filtro y devuelve el primero según el orden.

**2. ¿Por qué usar `select` en vez de devolver la entidad completa?**
Menos datos desde la base y por la red, y ningún riesgo de exponer campos internos.

**3. ¿Cómo devolvés una lista paginada con el total?**
Dos consultas (`findMany` con `skip`/`take` y `count`) en una transacción, y una respuesta con `items`, `total`, `page` y `pageSize`.

**4. ¿Qué es un upsert?**
Insertar si no existe y actualizar si existe, en una sola operación atómica.

**5. ¿Cómo modelarías "publicar un pueblo" en una API REST?**
Como acción propia (`POST /towns/:id/publish`) para darle su permiso, validación y evento, en vez de un `PATCH` de un campo.
