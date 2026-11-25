---
title: GraphQL en Nest
sidebar_label: GraphQL
sidebar_position: 5
description: Qué es GraphQL frente a REST, code first con @nestjs/graphql y Apollo, resolvers, el problema N+1 y DataLoader, y por qué ripopola sigue con REST y OpenAPI.
---

# GraphQL en Nest

<Tech ids={['nestjs', 'typescript', 'nextdotjs']} />

<Estado tipo="concepto">Ripopola usa REST con OpenAPI. GraphQL aparece mucho en ofertas de trabajo con Nest, así que conviene entenderlo y saber compararlo.</Estado>

## Concepto

**GraphQL** es un lenguaje de consultas para APIs: hay **un solo endpoint**
y el cliente pide **exactamente los campos** que necesita, incluso de
varias entidades relacionadas, en una sola petición.

```graphql
query {
  town(slug: "albarracin") {
    name
    population
    housingListings(first: 3) { title price }
  }
}
```

| | REST + OpenAPI | GraphQL |
| --- | --- | --- |
| Endpoints | Muchos, por recurso | Uno |
| Forma de la respuesta | La decide el servidor | La decide el cliente |
| Sobre y sub-obtención | Frecuentes | Se evitan |
| Caché HTTP / CDN | Natural (GET + URL) | Difícil (casi todo es POST) |
| Tipos para el cliente | OpenAPI → tipos (sección 8) | El schema es el contrato |
| Errores | Códigos HTTP + Problem Details | Casi siempre 200 con `errors` |
| Riesgos | BOLA, paginación | Consultas muy profundas o costosas |

## En Nest: code first

`@nestjs/graphql` con el driver de **Apollo** (o Mercurius). En **code
first**, el schema se genera desde clases TypeScript con decoradores, muy
parecido a los DTOs:

```ts title="Concepto: el pueblo en GraphQL"
@ObjectType()
export class TownModel {
  @Field(() => ID) id!: string;
  @Field() name!: string;
  @Field(() => Int, { nullable: true }) population?: number;
}

@Resolver(() => TownModel)
export class TownsResolver {
  constructor(private readonly towns: TownsService, private readonly listingsLoader: ListingsLoader) {}

  @Query(() => TownModel, { nullable: true })
  town(@Args('slug') slug: string) {
    return this.towns.findBySlug(slug);
  }

  // Campo relacionado: se resuelve solo si el cliente lo pide
  @ResolveField(() => [HousingListingModel])
  housingListings(@Parent() town: TownModel) {
    return this.listingsLoader.byTown.load(town.id);
  }
}
```

- **Resolver** es el equivalente al controlador.
- `@Query` lee, `@Mutation` escribe, `@Subscription` es tiempo real (sobre WebSockets).
- Guards, pipes e interceptors funcionan con `GqlExecutionContext`.

### El N+1 de GraphQL y DataLoader

Si una consulta pide 20 pueblos con sus anuncios, `housingListings` se
ejecuta 20 veces: 1 consulta de pueblos + 20 de anuncios (el N+1 de la
sección 2, ahora provocado por el cliente). **DataLoader** junta todas las
llamadas `load(id)` de un mismo ciclo y hace **una** consulta con `IN (...)`.
Se crea uno **por petición**, para no mezclar caché entre usuarios.

### Proteger el servidor

El cliente puede pedir consultas enormes o anidadas sin fin. Se limitan con
**profundidad máxima**, **complejidad** por campo, paginación obligatoria y,
en APIs privadas, **consultas persistidas** (solo se aceptan consultas
conocidas).

<Angular>

En Angular, **Apollo Angular** es el cliente habitual (consultas como
Observables); en React y Next, **Apollo Client**, **urql** o **Relay**, con
caché normalizada y tipos de GraphQL Code Generator. Es un cambio grande
frente a `openapi-fetch` + TanStack Query, que es lo que usa ripopola (sección 12).

</Angular>

## ¿Por qué ripopola sigue con REST?

- La web pública con SSR vive de **caché HTTP y CDN** en las fichas de pueblos.
- Hay **dos clientes propios** (web y panel) que se diseñan junto con la API: no hay muchos consumidores con necesidades distintas.
- OpenAPI ya da tipos al front y documentación para integraciones futuras (por ejemplo, municipios que conecten sus sistemas).

GraphQL brilla cuando hay **muchos clientes distintos** (apps móviles,
terceros) consultando un grafo de datos muy relacionado, o como capa que
agrega varios microservicios (*federation*).

<Resumen>

- GraphQL: un endpoint, el cliente elige los campos.
- Nest code first: `@ObjectType`, `@Resolver`, `@Query`, `@Mutation`, `@ResolveField`.
- DataLoader por petición contra el N+1; límites de profundidad y complejidad.
- REST + OpenAPI para ripopola por caché HTTP, SSR y pocos clientes propios.

</Resumen>

## Preguntas de entrevista

**1. ¿REST o GraphQL?**
REST cuando importan la caché HTTP, la simplicidad y los recursos están bien definidos. GraphQL cuando hay muchos clientes con necesidades distintas sobre datos muy relacionados y se quiere evitar la sobre y sub-obtención.

**2. ¿Qué es DataLoader?**
Una utilidad que agrupa y cachea, dentro de una misma petición, las cargas por id que hacen los resolvers, convirtiendo N consultas en una.

**3. ¿Code first o schema first?**
Code first genera el schema desde clases y decoradores (cómodo en TypeScript, una sola fuente). Schema first escribe el SDL y genera los tipos (el schema como contrato acordado entre equipos).

**4. ¿Qué riesgos de seguridad tiene GraphQL?**
Consultas costosas o muy profundas (denegación de servicio), introspección expuesta en producción y autorización por campo que se olvida. Se mitigan con límites de complejidad, consultas persistidas y guards.
