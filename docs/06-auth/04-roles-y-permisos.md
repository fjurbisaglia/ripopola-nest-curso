---
title: Roles, permisos por recurso y decoradores compuestos
sidebar_label: Roles y permisos
sidebar_position: 4
description: RolesGuard con Reflector, el decorador @Auth, y autorización por recurso para que cada municipio edite solo su pueblo, con políticas y CASL como alternativa.
---

# Roles, permisos por recurso y decoradores compuestos

<Tech ids={['nestjs', 'prisma']} />

<Estado tipo="construye">El superadmin puede todo; el admin de un ayuntamiento edita y publica su pueblo; un editor solo edita. Ningún municipio puede tocar el pueblo de otro.</Estado>

## Dos niveles de autorización

1. **Por rol** (*RBAC*): "¿este tipo de usuario puede hacer esta acción?".
   Se decide con lo que hay en el usuario. Ej.: solo superadmin crea pueblos.
2. **Por recurso** (*ownership* / *ABAC*): "¿este usuario puede hacer esto
   **con este pueblo concreto**?". Hace falta mirar el recurso. Ej.: el
   ayuntamiento de Albarracín no edita Teruel.

El segundo es el que más se olvida, y su ausencia es la vulnerabilidad n.º 1
del **OWASP API Top 10**: *Broken Object Level Authorization* (BOLA).
Probás `PATCH /towns/{id de otro}` y funciona.

## La matriz de ripopola

| Acción | Superadmin | Admin del ayuntamiento | Editor del ayuntamiento | Persona |
| --- | --- | --- | --- | --- |
| Crear pueblo | ✅ | ❌ | ❌ | ❌ |
| Editar su pueblo | ✅ | ✅ | ✅ | ❌ |
| Publicar su pueblo | ✅ | ✅ | ❌ | ❌ |
| Gestionar miembros | ✅ | ✅ | ❌ | ❌ |
| Borrar pueblo | ✅ | ❌ | ❌ | ❌ |

## En ripopola

### 1. Roles: `RolesGuard`

En el tema de decoradores armamos un `@Roles()` de ejemplo. Con el modelo
real hay dos niveles de rol, así que el de plataforma tiene su propio decorador:

```ts title="auth/platform-roles.decorator.ts"
import { Reflector } from '@nestjs/core';
import type { PlatformRole } from '../../generated/prisma/client';

export const PlatformRoles = Reflector.createDecorator<PlatformRole[]>();
```

```ts title="auth/platform-roles.guard.ts"
@Injectable()
export class PlatformRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride(PlatformRoles, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const user = context.switchToHttp().getRequest().user as AuthUser;
    if (!required.includes(user.platformRole)) throw new ForbiddenException();
    return true;
  }
}
```

Se registra como segundo `APP_GUARD` (los guards globales corren en el orden
en que se registran: primero autenticación, después roles).

### 2. Componer: `@Auth()`

```ts title="auth/auth.decorator.ts"
export function SuperadminOnly() {
  return applyDecorators(PlatformRoles(['SUPERADMIN']), ApiForbiddenResponse({ description: 'Solo superadmin' }));
}
```

```ts
@SuperadminOnly()
@Post()
create(@Body() dto: CreateTownDto) { ... }
```

### 3. Por recurso: un servicio de políticas

La pregunta "¿puede editar este pueblo?" necesita la base (¿el pueblo
pertenece a una organización de la que es miembro?). Se resuelve en un
servicio dedicado, y se llama **desde el servicio de negocio**:

```ts title="auth/town-policy.service.ts"
export type TownAction = 'edit' | 'publish' | 'manageMembers';

const ALLOWED: Record<TownAction, MembershipRole[]> = {
  edit: ['ADMIN', 'EDITOR'],
  publish: ['ADMIN'],
  manageMembers: ['ADMIN'],
};

@Injectable()
export class TownPolicy {
  constructor(private readonly prisma: PrismaService) {}

  async assert(user: AuthUser, action: TownAction, townId: string): Promise<void> {
    if (user.platformRole === 'SUPERADMIN') return;

    const town = await this.prisma.town.findUnique({ where: { id: townId }, select: { organizationId: true } });
    if (!town) throw new NotFoundException();

    const membership = user.memberships.find((m) => m.organizationId === town.organizationId);
    if (!membership || !ALLOWED[action].includes(membership.role)) {
      throw new ForbiddenException();
    }
  }
}
```

```ts title="towns.service.ts"
async update(user: AuthUser, id: string, dto: UpdateTownDto) {
  await this.policy.assert(user, 'edit', id);
  return this.prisma.town.update({ where: { id }, data: dto, select: TOWN_SUMMARY });
}

async publish(user: AuthUser, id: string) {
  await this.policy.assert(user, 'publish', id);
  // ...
}
```

Y el controlador pasa el usuario:

```ts
@Patch(':id')
update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTownDto) {
  return this.townsService.update(user, id, dto);
}
```

:::tip ¿404 o 403?
Si el usuario no debería ni saber que el recurso existe (por ejemplo,
borradores de otro municipio), responder **404** en vez de 403 evita filtrar
información. En ripopola, los pueblos son públicos, así que 403 está bien.
:::

### 4. Filtrar listas por permiso

Para listados del panel ("mis pueblos"), la autorización va **en el `where`**:

```ts
myTowns(user: AuthUser) {
  return this.prisma.town.findMany({
    where: user.platformRole === 'SUPERADMIN'
      ? {}
      : { organizationId: { in: user.memberships.map((m) => m.organizationId) } },
  });
}
```

Nunca traigas todo y filtres en memoria.

### 5. Probar la autorización

Las pruebas de autorización son de las más valiosas. Como mínimo, para cada
acción: superadmin pasa, miembro con rol correcto pasa, miembro con rol
insuficiente da 403, **miembro de otro ayuntamiento da 403**. En la sección 9
las hacemos e2e contra la base real.

<Alternativa title="CASL y Passport">

**CASL** (`@casl/ability`) es la librería más usada para permisos complejos
en Nest: definís *abilities* (`can('update', 'Town', { organizationId })`)
y la documentación oficial de Nest tiene un capítulo sobre ella. Conviene
cuando hay muchas reglas y condiciones. Para la matriz de ripopola, un
servicio de políticas propio es más simple y explícito. Otras opciones del
mercado: OPA, Cerbos, Oso, OpenFGA (autorización como servicio).

</Alternativa>

<Alternativa title="Los plugins organization y admin de Better Auth">

Better Auth trae un plugin **`organization`** (organizaciones, miembros,
roles, invitaciones por correo y "organización activa" en la sesión) y uno
**`admin`** (rol de plataforma, banear usuarios, suplantar para soporte).
Cubren gran parte de lo que ripopola modela a mano. Nos quedamos con
nuestras tablas `Organization` y `Membership` porque son **dominio** de
ripopola (un ayuntamiento reclama un pueblo, tiene suscripción premium,
recibe mensajes) y porque `TownPolicy` decide por recurso, no solo por rol.
El plugin de invitaciones sí es candidato para cuando los ayuntamientos
inviten a sus editores: anotalo como posible ADR.

</Alternativa>

<Resumen>

- RBAC con `@Roles` + guard; por recurso con un servicio de políticas.
- BOLA es la vulnerabilidad más común de las APIs: probá siempre "otro dueño".
- En listas, la autorización va en el `where`.
- `applyDecorators` para que la intención quede en un decorador.

</Resumen>

## Preguntas de entrevista

**1. ¿Qué es BOLA/IDOR?**
Que un usuario acceda a objetos de otro cambiando el id en la petición, porque la API verifica la autenticación pero no la propiedad del recurso.

**2. ¿RBAC o ABAC?**
RBAC decide por rol; ABAC por atributos del usuario, del recurso y del contexto. En la práctica se combinan: roles para acciones, atributos para la propiedad.

**3. ¿Dónde pondrías la verificación de que un usuario es dueño del recurso?**
En un servicio de políticas llamado desde la capa de negocio, porque necesita datos del recurso. Un guard sirve si se puede decidir con la ruta y el usuario.

**4. ¿Cómo devolvés solo los registros que el usuario puede ver?**
Incluyendo la condición de permiso en la consulta, nunca filtrando en memoria.
