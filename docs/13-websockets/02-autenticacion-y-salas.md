---
title: Autenticar el socket y salas por municipio
sidebar_label: Autenticación y salas
sidebar_position: 2
description: Validar la sesión de Better Auth en el handshake, enlazar el socket con el usuario, salas por organización y usuario, y desconectar sesiones duplicadas o sin permiso.
---

# Autenticar el socket y salas por municipio

<Tech ids={['socketdotio', 'betterauth', 'nestjs']} />

<Estado tipo="construye">Solo usuarios con sesión válida se conectan; cada socket entra a la sala de su usuario y a la de cada ayuntamiento al que pertenece.</Estado>

## El handshake

La conexión de Socket.IO empieza con un **handshake** HTTP. Ahí se valida
la identidad **una vez**; después, todos los eventos de esa conexión son de
ese usuario.

Como la sesión de ripopola es una **cookie** (sección 6), el handshake la
lleva sola: es una petición HTTP más hacia la API. Del lado del cliente
alcanza con pedir que mande credenciales:

```ts title="libs/frontend/realtime/src/socket.ts (tema 1)"
export const socket = io(`${process.env.NEXT_PUBLIC_API_URL}/realtime`, {
  autoConnect: false,
  withCredentials: true,   // manda la cookie de sesión aunque la API esté en otro origen
});
```

Nada de tokens en el JavaScript ni de renovarlos antes de reconectar: en
cada reconexión viaja la cookie vigente.

:::info Si la sesión fuera un token
Con un proveedor que entrega JWT (Firebase, Auth0; sección 6, tema 7), el
cliente lo manda en `auth: async (cb) => cb({ token: await getToken() })`,
con una función para que cada reconexión lleve un token vigente, y el
servidor lo lee de `socket.handshake.auth.token`.
:::

## En ripopola

### 1. Middleware de Socket.IO para autenticar

```ts title="realtime/notifications.gateway.ts"
@WebSocketGateway({ namespace: '/realtime', cors: { ... } })
export class NotificationsGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer() server!: Namespace;

  constructor(@Inject(BETTER_AUTH) private readonly auth: Auth, private readonly users: UsersService) {}

  afterInit(server: Namespace) {
    // Corre una vez por conexión, ANTES de handleConnection
    server.use(async (socket, next) => {
      try {
        // Las cabeceras del handshake traen la cookie, igual que en HTTP
        const result = await this.auth.api.getSession({ headers: fromNodeHeaders(socket.handshake.headers) });
        if (!result) return next(new Error('unauthorized'));
        socket.data.user = await this.users.load(result.user.id, result.session.id);
        next();
      } catch {
        next(new Error('unauthorized')); // el cliente recibe 'connect_error'
      }
    });
  }

  async handleConnection(socket: Socket) {
    const user = socket.data.user as AuthUser;
    await socket.join(`user:${user.id}`);
    for (const m of user.memberships) {
      await socket.join(`org:${m.organizationId}`);
    }
  }
}
```

Qué mirar:

- `server.use(...)` es un **middleware de Socket.IO**: rechaza antes de conectar.
- Reutilizamos `auth.api.getSession` y `UsersService` de la sección 6: misma
  identidad y mismos roles que en HTTP.
- `socket.data` guarda el usuario para toda la vida de la conexión.
- **Salas** `user:<id>` y `org:<id>`: así se avisa a una persona (en
  todas sus pestañas) o a todo un ayuntamiento.

### 2. Guards en eventos

Para eventos que requieren algo más (por ejemplo, un rol), los guards
funcionan igual que en HTTP, con `context.switchToWs()`:

```ts
@Injectable()
export class WsMemberGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const client = context.switchToWs().getClient<Socket>();
    const data = context.switchToWs().getData<{ organizationId: string }>();
    const user = client.data.user as AuthUser;
    if (!user.memberships.some((m) => m.organizationId === data.organizationId)) {
      throw new WsException('forbidden');
    }
    return true;
  }
}
```

### 3. Validar los mensajes

El `ValidationPipe` también funciona en gateways, pero tira `BadRequestException`,
que en WebSockets no se traduce sola. Se usa `@UsePipes(new ValidationPipe({ exceptionFactory: (e) => new WsException(e) }))`
en el gateway, y un filtro (`BaseWsExceptionFilter`) para responder un evento de error.

### 4. Cuando cambian los permisos

Si un admin quita a un editor del ayuntamiento, su socket sigue en la sala
`org:…`. Al cambiar membresías, se emite un evento interno y el gateway
saca al usuario de la sala:

```ts
@OnEvent('membership.removed')
async onRemoved(e: { userId: string; organizationId: string }) {
  this.server.in(`user:${e.userId}`).socketsLeave(`org:${e.organizationId}`);
}
```

Y si la sesión se cierra (logout, "cerrar todas las sesiones", contraseña
reseteada), el socket abierto sigue vivo hasta que se corte: al reconectar,
el middleware lo rechaza. Para cortarlo en el momento, se escucha el evento
de cierre de sesión y se hace `this.server.in('user:'+id).disconnectSockets()`.

### 5. ¿Desconectar sesiones duplicadas?

El curso de referencia desconecta la conexión anterior si el mismo usuario
se conecta dos veces. En ripopola **no**: una persona del ayuntamiento puede
tener el panel abierto en dos pestañas o en el teléfono, y la sala `user:<id>`
ya resuelve que les llegue a todas. Si hiciera falta, `this.server.in('user:'+id).fetchSockets()` lista sus conexiones.

<Resumen>

- Autenticar una vez en el handshake (`server.use`), con el mismo verificador que HTTP.
- `socket.data.user` y salas por usuario y por organización.
- Guards con `switchToWs()`; errores con `WsException`.
- Sacar de las salas cuando cambian los permisos.

</Resumen>

## Preguntas de entrevista

**1. ¿Cómo autenticás un WebSocket?**
Validando la identidad en el handshake con un middleware: la cookie de sesión (que viaja sola con `withCredentials`) o un token enviado en `auth`. La identidad queda guardada en el socket para toda la conexión.

**2. ¿Qué pasa si la sesión vence o se cierra con la conexión abierta?**
La conexión sigue siendo válida hasta que se corte; al reconectar se vuelve a validar. Para revocar al instante, el servidor desconecta los sockets del usuario.

**3. ¿Cómo mandás un mensaje a todos los dispositivos de un usuario?**
Uniendo cada socket a una sala por usuario y emitiendo a esa sala.
