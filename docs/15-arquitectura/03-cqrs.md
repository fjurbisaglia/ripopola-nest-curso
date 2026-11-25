---
title: CQRS y eventos con @nestjs/cqrs
sidebar_label: CQRS
sidebar_position: 3
description: Separar comandos y consultas, CommandBus, QueryBus y EventBus de @nestjs/cqrs, sagas, read models, event sourcing como concepto y cuándo no usarlo.
---

# CQRS y eventos con @nestjs/cqrs

<Tech ids={['nestjs', 'prisma', 'postgresql']} />

<Estado tipo="concepto">Ripopola no usa @nestjs/cqrs. Ya aplica la idea de separar lecturas (búsqueda geográfica, caché) de escrituras; acá está el patrón completo para la entrevista.</Estado>

## Concepto

**CQRS** (*Command Query Responsibility Segregation*): las operaciones que
**cambian** estado (comandos) y las que **leen** (consultas) se modelan por
separado.

- **Comando**: `PublishTown`, `ClaimTown`. Intención en imperativo, puede fallar, no devuelve datos (o solo un id).
- **Consulta**: `SearchTownsNear`, `GetTownBySlug`. No cambia nada, se puede cachear.

Por qué: en muchos sistemas leer y escribir tienen necesidades opuestas.
En ripopola, la búsqueda pública de pueblos es **muchísimo** más frecuente
que editar un pueblo, usa PostGIS y caché; la edición necesita permisos,
validaciones y transacciones.

### Niveles de CQRS

1. **Separar en el código**: servicios o handlers distintos para leer y escribir, misma base. (Ripopola, en espíritu.)
2. **Modelos de lectura propios**: tablas o vistas desnormalizadas para leer rápido (por ejemplo, una vista materializada `town_search`), actualizadas por eventos.
3. **Bases distintas**: escribir en PostgreSQL y leer de un buscador (Elasticsearch, Typesense). Consistencia eventual.

## @nestjs/cqrs

```bash
pnpm add -E @nestjs/cqrs
```

```ts title="Concepto: publicar un pueblo con CQRS"
// El comando: datos de la intención
export class PublishTownCommand {
  constructor(readonly townId: string, readonly user: AuthUser) {}
}

// Su handler: un caso de uso
@CommandHandler(PublishTownCommand)
export class PublishTownHandler implements ICommandHandler<PublishTownCommand> {
  constructor(private readonly prisma: PrismaService, private readonly policy: TownPolicy,
              private readonly events: EventBus) {}

  async execute({ townId, user }: PublishTownCommand) {
    await this.policy.assert(user, 'publish', townId);
    const town = await this.prisma.town.update({ where: { id: townId }, data: { status: 'PUBLISHED' } });
    this.events.publish(new TownPublishedEvent(town.id, town.slug));
  }
}

// La consulta y su handler
export class GetTownBySlugQuery { constructor(readonly slug: string, readonly lang: string) {} }

@QueryHandler(GetTownBySlugQuery)
export class GetTownBySlugHandler implements IQueryHandler<GetTownBySlugQuery> {
  execute({ slug, lang }: GetTownBySlugQuery) { /* lectura optimizada, con caché */ }
}

// El controlador solo despacha
@Post(':id/publish')
publish(@Param('id') id: string, @CurrentUser() user: AuthUser) {
  return this.commandBus.execute(new PublishTownCommand(id, user));
}
```

- **CommandBus / QueryBus**: despachan al handler registrado para esa clase.
- **EventBus** + `@EventsHandler`: varios handlers reaccionan a un evento.
- **Sagas**: flujos que escuchan eventos (como Observables de RxJS) y
  disparan nuevos comandos. Por ejemplo: `TownPublished` → `RequestTranslations`.

<Angular>

Si usaste **NgRx**, ya conocés el patrón: las *actions* son comandos y
eventos, los *reducers* cambian estado, los *selectors* son consultas y los
*effects* son las sagas (también son Observables). `@nestjs/cqrs` es el
mismo espíritu del lado del servidor.

</Angular>

## Event sourcing (concepto)

En vez de guardar el **estado actual** de un pueblo, se guarda la
**secuencia de eventos** que lo produjo (`TownCreated`, `DescriptionChanged`,
`TownPublished`) y el estado se reconstruye reproduciéndolos. Da auditoría
total y "viajar en el tiempo", a cambio de mucha complejidad (versionar
eventos, proyecciones, *snapshots*). Se usa en finanzas, logística, sistemas
donde el historial **es** el producto. Ripopola no lo necesita: para
auditoría alcanza una tabla de historial de cambios.

## ¿Cuándo usar CQRS?

| Sí | No |
| --- | --- |
| Lecturas y escrituras con cargas o modelos muy distintos | CRUD simple |
| Dominio con muchos casos de uso y reglas | Equipo chico con poco dominio |
| Varios equipos sobre el mismo módulo | Cuando un servicio con métodos claros alcanza |

<Alternativa title="Lo que ya hace ripopola">

`@nestjs/event-emitter` (sección 10) para eventos internos, servicios con
métodos de comando y de consulta separados, caché en las lecturas y una
cola para los efectos lentos. Es "CQRS liviano" sin el bus. Si un módulo
crece (por ejemplo, la mensajería), se puede introducir `@nestjs/cqrs` solo ahí.

</Alternativa>

<Resumen>

- CQRS separa comandos (cambian estado) de consultas (leen).
- Niveles: separar código, modelos de lectura, bases distintas.
- `@nestjs/cqrs`: CommandBus, QueryBus, EventBus y sagas con RxJS.
- Event sourcing guarda eventos en vez de estado: potente y caro.

</Resumen>

## Preguntas de entrevista

**1. ¿Qué es CQRS?**
Separar el modelo de escritura (comandos) del de lectura (consultas), para optimizar cada uno por su lado, desde handlers distintos hasta bases distintas.

**2. ¿CQRS implica event sourcing?**
No. Se combinan a menudo, pero se puede tener CQRS con una base relacional normal y sin guardar eventos.

**3. ¿Qué es una saga en @nestjs/cqrs?**
Un flujo que escucha eventos como un Observable y emite nuevos comandos, para coordinar procesos de varios pasos.

**4. ¿Qué es la consistencia eventual?**
Que después de una escritura, las lecturas pueden tardar un poco en reflejarla (por ejemplo, un modelo de lectura actualizado por eventos), pero terminan siendo consistentes.
