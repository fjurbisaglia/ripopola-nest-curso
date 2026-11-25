---
title: La sesión, el usuario y el guard global
sidebar_label: Usuarios y guard global
sidebar_position: 3
description: Un AuthGuard global que lee la sesión de Better Auth, el usuario con sus membresías en request.user, @Public y @CurrentUser, y cómo probarlo.
---

# La sesión, el usuario y el guard global

<Tech ids={['betterauth', 'nestjs', 'prisma']} />

<Estado tipo="construye">Toda la API queda protegida por defecto. El guard lee la sesión de Better Auth, carga al usuario con sus membresías y lo deja disponible con `@CurrentUser()`. Lo público se marca con `@Public()`.</Estado>

## Concepto: identidad y datos del producto, en la misma base

Better Auth sabe **quién es** (la sesión y el usuario). Ripopola necesita
además **sus propios datos** del usuario: rol de plataforma y membresías
por ayuntamiento. Como todo vive en PostgreSQL, el usuario de Better Auth
**es** el usuario de ripopola: la fila se crea al registrarse, y las
membresías apuntan a `users.id` con una clave foránea real.

:::info Comparado con un proveedor externo
Con Firebase o Auth0, la identidad vive afuera y hace falta una tabla
espejo con el `uid` del proveedor, creada en la primera petición
(*just-in-time provisioning*). Con Better Auth ese problema desaparece. Si
algún día te toca un proveedor externo, el patrón está en el tema 7.
:::

## En ripopola

### 1. El tipo del usuario autenticado

```ts title="auth/auth-user.ts"
import type { MembershipRole, PlatformRole } from '../../generated/prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  platformRole: PlatformRole;
  memberships: { organizationId: string; role: MembershipRole }[];
  sessionId: string;            // para "cerrar esta sesión" o auditar
}
```

### 2. El servicio que arma el usuario

```ts title="auth/users.service.ts"
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lo que la sesión no trae: rol de plataforma y membresías, frescos de la base. */
  async load(userId: string, sessionId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, platformRole: true,
        memberships: { select: { organizationId: true, role: true } },
      },
    });
    return { ...user, sessionId };
  }
}
```

### 3. El guard global

```ts title="auth/auth.guard.ts"
import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { BETTER_AUTH } from './auth.module';
import type { Auth } from './auth.config';
import { Public } from './public.decorator';
import { UsersService } from './users.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(BETTER_AUTH) private readonly auth: Auth,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride(Public, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const result = await this.auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!result) throw new UnauthorizedException();

    request.user = await this.users.load(result.user.id, result.session.id);
    return true;
  }
}
```

Qué mirar:

- **`auth.api.getSession`** es la API de servidor de Better Auth: la misma
  lógica que atiende `/api/auth/get-session`, pero llamada como función, sin
  HTTP. Lee la cookie de las cabeceras, valida su firma, busca la sesión y
  comprueba que no haya vencido.
- `fromNodeHeaders` convierte las cabeceras de Node al objeto `Headers`
  estándar que espera Better Auth.
- Como la sesión no se crea sin correo verificado (`requireEmailVerification`),
  el guard no tiene que comprobarlo.
- El `Public` es el decorador creado con `Reflector.createDecorator` en la sección 1.

### 4. El módulo

Ya lo viste en el tema 2: `{ provide: APP_GUARD, useClass: AuthGuard }`
dentro de `AuthModule`. Con eso, **toda la API queda cerrada por defecto**.

### 5. Marcar lo público

```ts title="towns.controller.ts"
@Public()
@Get()
findAll(@Query() query: ListTownsQueryDto) { ... }

@Public()
@Get(':slug')
findOne(@Param('slug', SlugPipe) slug: string) { ... }

// POST, PATCH, DELETE quedan protegidos sin hacer nada
```

Y `HealthController` entero con `@Public()` en la clase. Las rutas de
Better Auth (`/api/auth/*`) no pasan por el guard: están montadas fuera de Nest.

### 6. "¿Quién soy?"

```ts title="auth/me.controller.ts"
@Controller('me')
export class MeController {
  @Get()
  me(@CurrentUser() user: AuthUser) {
    return user; // el panel lo usa para saber qué ayuntamientos y acciones mostrar
  }
}
```

El cliente de Better Auth ya sabe quién es la persona (`getSession`), pero
no sabe de membresías: eso lo da `/api/v1/me`.

### 7. Probar el guard

```ts title="auth.guard.spec.ts"
describe('AuthGuard', () => {
  const reflector = { getAllAndOverride: vi.fn() };
  const auth = { api: { getSession: vi.fn() } };
  const users = { load: vi.fn() };
  const guard = new AuthGuard(reflector as any, auth as any, users as any);

  const ctx = (headers = {}) => {
    const req: any = { headers };
    return { req, context: { getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => req }) } as any };
  };

  it('deja pasar lo público sin sesión', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    await expect(guard.canActivate(ctx().context)).resolves.toBe(true);
    expect(auth.api.getSession).not.toHaveBeenCalled();
  });

  it('responde 401 sin sesión', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    auth.api.getSession.mockResolvedValue(null);
    await expect(guard.canActivate(ctx().context)).rejects.toThrow(UnauthorizedException);
  });

  it('pone el usuario en la petición', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    auth.api.getSession.mockResolvedValue({ user: { id: 'u1' }, session: { id: 's1' } });
    users.load.mockResolvedValue({ id: 'u1' });
    const { req, context } = ctx({ cookie: 'x' });
    await guard.canActivate(context);
    expect(users.load).toHaveBeenCalledWith('u1', 's1');
    expect(req.user).toEqual({ id: 'u1' });
  });
});
```

Gracias al token `BETTER_AUTH`, el guard se prueba con un objeto falso
`{ api: { getSession } }`, sin base ni cookies. La prueba de punta a punta,
con sesiones reales, está en la sección 9.

:::tip Rendimiento
Cada petición autenticada lee la sesión y el usuario: dos consultas por
clave primaria, rapidísimas. Si molestara, la **caché de sesión en cookie**
o **Redis** como almacenamiento secundario (tema 5) sacan la lectura de la
sesión de PostgreSQL, y las membresías se pueden cachear unos segundos
(sección 11).
:::

<Resumen>

- El usuario de Better Auth es el usuario de ripopola: misma tabla, claves foráneas reales.
- Guard global con `APP_GUARD` + `auth.api.getSession()`; `@Public()` para abrir.
- `UsersService.load` suma rol de plataforma y membresías.
- `request.user` + `@CurrentUser()` en los controladores.

</Resumen>

## Preguntas de entrevista

**1. ¿Por qué un guard global con `@Public()` y no `@UseGuards` en cada endpoint?**
Porque un olvido deja el endpoint cerrado, no abierto: es denegar por defecto.

**2. ¿Qué hace el servidor para validar una sesión basada en cookie?**
Lee la cookie, verifica su firma, busca la sesión por el token en el almacenamiento (base o Redis), comprueba que no esté vencida y carga al usuario.

**3. ¿Roles en la sesión o en la base?**
En la sesión (o en un token) es más rápido pero puede quedar desactualizado; en la base cambian al instante. Para permisos que cambian (membresías de un ayuntamiento), base, con caché corta si hace falta.

**4. ¿Qué es el just-in-time provisioning y cuándo lo necesitás?**
Crear el registro local del usuario la primera vez que se autentica. Hace falta cuando la identidad vive en un proveedor externo; con una librería que guarda los usuarios en tu base, el registro ya existe.
