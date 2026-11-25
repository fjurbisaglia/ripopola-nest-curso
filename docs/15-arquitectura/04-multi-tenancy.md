---
title: Multi-tenancy por municipio
sidebar_label: Multi-tenancy
sidebar_position: 4
description: Modelos de multi-tenancy, el tenant en el contexto de la petición con AsyncLocalStorage y nestjs-cls, filtrar automáticamente con una extensión de Prisma y Row-Level Security en PostgreSQL.
---

# Multi-tenancy por municipio

<Tech ids={['nestjs', 'prisma', 'postgresql']} />

<Estado tipo="construye">Que un editor de Albarracín nunca pueda ver ni tocar datos de otro ayuntamiento, aunque un desarrollador se olvide de un filtro.</Estado>

## Concepto

Un sistema **multi-tenant** atiende a varios clientes (*tenants*) con la
misma aplicación, manteniendo sus datos aislados. En ripopola el tenant es
la **organización** (el ayuntamiento): sus pueblos, anuncios, mensajes,
notificaciones y suscripción.

| Modelo | Cómo | Aislamiento | Costo |
| --- | --- | --- | --- |
| Base por tenant | Una base para cada municipio | Máximo | Alto, migraciones × N |
| Schema por tenant | Un schema de PostgreSQL por municipio | Alto | Medio, migraciones × N |
| **Columna `organization_id`** | Tablas compartidas, filtradas | Depende de la disciplina | Bajo |

Ripopola usa **columna compartida**: miles de municipios chicos con pocos
datos cada uno. El riesgo es uno solo y grave: **olvidarse un filtro** y
mostrar datos de otro tenant (es el BOLA de OWASP, sección 9). Las capas de
abajo existen para que olvidarse no alcance para filtrar datos.

## Capa 1: autorización por recurso (ya la tenés)

`TownPolicy` (sección 6) verifica la membresía antes de cada acción. Es
obligatoria, pero depende de que cada servicio la llame.

## Capa 2: el tenant en el contexto de la petición

Pasar `organizationId` por parámetro a cada método es tedioso y fácil de
olvidar. **AsyncLocalStorage** (de Node) guarda datos que viven durante
toda una cadena asíncrona, como una petición. `nestjs-cls` lo integra con Nest:

```bash
pnpm add -E nestjs-cls
```

```ts title="app.module.ts"
ClsModule.forRoot({
  global: true,
  middleware: { mount: true },
}),
```

```ts title="panel/tenant.guard.ts"
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly cls: ClsService) {}

  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser;
    const orgId = req.headers['x-organization-id'] as string | undefined; // el panel elige el ayuntamiento activo
    if (!orgId || !user.memberships.some((m) => m.organizationId === orgId)) {
      throw new ForbiddenException();
    }
    this.cls.set('organizationId', orgId);
    return true;
  }
}
```

Desde cualquier servicio: `this.cls.get('organizationId')`, sin pasarlo
por parámetro. Funciona también en logs (Pino puede agregar el tenant a
cada línea) y en el *request id*.

<Angular>

Pensalo como un servicio con `providedIn` por petición, pero sin el costo
de los providers `REQUEST`-scoped (sección 1), que recrean toda la cadena
de dependencias en cada petición. AsyncLocalStorage no recrea nada.

</Angular>

## Capa 3: filtrar automáticamente con una extensión de Prisma

Una **Client Extension** (sección 2) puede agregar el filtro a todas las
consultas de los modelos del tenant:

```ts title="database/tenant.extension.ts"
const TENANT_MODELS = new Set(['HousingListing', 'Notification', 'Conversation']);

export const tenantExtension = (cls: ClsService) =>
  Prisma.defineExtension({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const orgId = cls.get<string | undefined>('organizationId');
          if (!orgId || !TENANT_MODELS.has(model)) return query(args);
          if (['findMany', 'findFirst', 'count', 'updateMany', 'deleteMany'].includes(operation)) {
            args.where = { ...args.where, organizationId: orgId };
          }
          return query(args);
        },
      },
    },
  });
```

:::warning Límites de la extensión
No cubre `findUnique`/`update`/`delete` por id (el `where` tiene que ser
único), ni `$queryRaw`, ni relaciones anidadas. Es una **red de seguridad**,
no un reemplazo de la política. Para algo que no se pueda saltear, está la
capa 4.
:::

## Capa 4: Row-Level Security en PostgreSQL

**RLS** hace que la propia base filtre filas según una política. Ni un
`$queryRaw` olvidado se la saltea:

```sql title="Migración"
ALTER TABLE housing_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON housing_listings
  USING (organization_id = current_setting('app.organization_id', true)::uuid);
```

La app fija el tenant **dentro de cada transacción**:

```ts
await this.prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT set_config('app.organization_id', ${orgId}, true)`; // true = solo esta transacción
  return tx.housingListing.findMany();
});
```

Detalles que hacen la diferencia:

- `set_config(..., true)` es **local a la transacción**, lo que la hace
  segura con el pooler de Neon en modo transacción (sección 14).
- El usuario de la app **no puede ser dueño de la tabla ni superusuario**:
  los dueños se saltean RLS (salvo con `FORCE ROW LEVEL SECURITY`).
- La web pública (pueblos publicados) necesita otra política o un rol
  distinto para leer sin tenant.

<Alternativa title="¿Hasta dónde llegar en ripopola?">

Para empezar: capa 1 siempre + capa 2 (contexto con `nestjs-cls`). La
extensión y RLS se suman para las tablas sensibles (mensajes, datos de
contacto) cuando el panel tenga varios ayuntamientos reales. Es una buena
decisión para documentar en un ADR, y un tema muy fuerte para el trabajo
final de la universidad.

</Alternativa>

<Resumen>

- Ripopola: tenant = organización, con columna compartida `organization_id`.
- Defensa en capas: política por recurso, contexto con AsyncLocalStorage, extensión de Prisma, RLS.
- `nestjs-cls` evita pasar el tenant por parámetro y los providers por petición.
- RLS con `set_config` local a la transacción, compatible con el pooler.

</Resumen>

## Preguntas de entrevista

**1. ¿Qué modelos de multi-tenancy conocés y cuándo usarías cada uno?**
Base por tenant (aislamiento máximo, clientes grandes o regulados), schema por tenant (intermedio) y tablas compartidas con columna de tenant (muchos tenants chicos, más barato). La elección depende del aislamiento exigido y la cantidad de tenants.

**2. ¿Qué es AsyncLocalStorage?**
Una API de Node que mantiene datos asociados a una cadena de operaciones asíncronas, útil para guardar el contexto de una petición (usuario, tenant, request id) sin pasarlo por parámetro.

**3. ¿Qué es Row-Level Security?**
Una función de PostgreSQL que filtra las filas visibles o modificables según políticas evaluadas por la base, independientemente de la consulta que haga la app.

**4. ¿Por qué no usar providers `REQUEST`-scoped para el tenant?**
Porque Nest recrea el provider y toda su cadena de dependencias en cada petición, con costo de rendimiento. AsyncLocalStorage da el mismo resultado sin recrear nada.
