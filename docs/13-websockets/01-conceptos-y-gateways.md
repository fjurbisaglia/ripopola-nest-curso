---
title: WebSockets y gateways de Nest
sidebar_label: Conceptos y gateways
sidebar_position: 1
description: HTTP contra WebSockets, SSE y polling, Socket.IO, gateways en Nest, eventos, conexión y desconexión, y formas de emitir.
---

# WebSockets y gateways de Nest

<Tech ids={['socketdotio', 'nestjs', 'nextdotjs']} />

<Estado tipo="construye">El `NotificationsGateway` de ripopola: el canal en tiempo real entre la API y el panel de los municipios.</Estado>

## Concepto

HTTP es **pedido y respuesta**: el servidor no puede hablarle al cliente si
el cliente no pregunta. Para que el panel se entere **al instante** de que
alguien se interesó en su pueblo, hay opciones:

| Técnica | Cómo | Para |
| --- | --- | --- |
| Polling | El cliente pregunta cada X segundos | Simple, pero desperdicia y llega tarde |
| Server-Sent Events (SSE) | Una respuesta HTTP que no se cierra; el servidor manda eventos | Solo servidor → cliente. Nest lo soporta con `@Sse()` |
| **WebSocket** | Conexión permanente y **bidireccional** | Chats, notificaciones, colaboración |

Ripopola quiere **notificaciones** (servidor → panel) **y mensajes** entre
personas y municipios (en los dos sentidos): WebSockets.

### Socket.IO

**Socket.IO** es la librería de tiempo real más usada en Node, sobre
WebSockets, y agrega lo que un WebSocket "pelado" no trae:

- **Reconexión automática** y *fallback* a HTTP long-polling si un proxy bloquea WebSockets.
- **Eventos con nombre** (`socket.emit('message', data)`) y **acknowledgements** (respuesta a un evento).
- **Salas** (*rooms*): mandar a un grupo (todos los usuarios de un ayuntamiento).
- **Adaptadores** para escalar entre varias instancias (Redis, tema 4).

Nest lo integra con `@nestjs/websockets` + `@nestjs/platform-socket.io`.
Es la opción estándar del mercado con Nest.

### Gateways

Un **gateway** es a WebSockets lo que un controlador es a HTTP: una clase con
`@WebSocketGateway()` que maneja eventos. Usa la misma DI, y admite **guards,
pipes, interceptors y filtros** (con `WsException` en vez de `HttpException`).

<Angular>

En Angular envolverías `socket.io-client` en un servicio que expone los
eventos como **Observables** (`fromEvent(socket, 'notification')`). En el
panel de Next, el equivalente es un hook de React que se suscribe en un
`useEffect` y se desuscribe al desmontar.

</Angular>

## En ripopola

### 1. Instalar

```bash
pnpm add -E @nestjs/websockets @nestjs/platform-socket.io socket.io
```

### 2. El gateway

```ts title="apps/api/src/app/realtime/notifications.gateway.ts"
import { Logger } from '@nestjs/common';
import {
  ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect,
  SubscribeMessage, WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: process.env['CORS_ORIGINS']?.split(','), credentials: true },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    this.logger.log(`Conectado ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Desconectado ${client.id}`);
  }

  // El cliente manda 'ping' y recibe la respuesta como acknowledgement
  @SubscribeMessage('ping')
  ping(@MessageBody() data: { at: number }, @ConnectedSocket() client: Socket) {
    return { pong: Date.now(), latency: Date.now() - data.at, id: client.id };
  }
}
```

Y se registra como provider en un `RealtimeModule`.

Qué mirar:

- **`namespace`**: separa canales lógicos en la misma conexión (`/realtime`).
- **`@WebSocketServer()`**: el servidor de Socket.IO, para emitir desde cualquier método.
- `handleConnection` / `handleDisconnect`: el ciclo de vida de cada cliente.
- Lo que devuelve un `@SubscribeMessage` vuelve al cliente como *ack*.

### 3. Formas de emitir

```ts
client.emit('x', data);                       // solo a este cliente
client.broadcast.emit('x', data);             // a todos menos este
this.server.emit('x', data);                  // a todos
this.server.to('org:123').emit('x', data);    // a una sala
this.server.to('org:123').except(client.id).emit('x', data);
```

### 4. El cliente en el panel

```bash
pnpm add -E socket.io-client
```

```ts title="libs/frontend/realtime/src/socket.ts"
'use client';
import { io } from 'socket.io-client';

// Una sola conexión para toda la pestaña. Directo a la API: los rewrites de
// Next no son un buen proxy de WebSockets.
export const socket = io(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/realtime`, {
  autoConnect: false,
  withCredentials: true,   // la cookie de sesión (tema 2)
});
```

```ts title="libs/frontend/realtime/src/use-socket-event.ts"
'use client';
import { useEffect } from 'react';
import { socket } from './socket';

export function useSocketEvent<T>(event: string, handler: (data: T) => void) {
  useEffect(() => {
    if (!socket.connected) socket.connect();
    socket.on(event, handler);
    return () => { socket.off(event, handler); };   // limpiar al desmontar
  }, [event, handler]);
}
```

En desarrollo, el socket va directo a `localhost:3000`. Las cookies se
asocian al host y no al puerto, así que la cookie de sesión de
`localhost:4300` también viaja a `localhost:3000`; el `cors` del gateway
tiene que aceptar `http://localhost:4300` con `credentials: true`.

## Errores comunes

- **CORS**: el gateway tiene su propia configuración de CORS, separada de `app.enableCors`.
- **El cliente se conecta pero no recibe**: emite a un namespace distinto del que escucha.
- **Versiones**: cliente y servidor de Socket.IO con la misma versión mayor.

<Resumen>

- WebSocket: conexión bidireccional permanente. SSE si solo habla el servidor.
- Socket.IO suma reconexión, eventos, acks, salas y adaptadores.
- Gateway = controlador de WebSockets, con DI, guards y pipes.
- `client.emit`, `server.to(sala).emit`, `broadcast`.

</Resumen>

## Preguntas de entrevista

**1. ¿Cuándo usarías WebSockets, SSE o polling?**
WebSockets para comunicación bidireccional en tiempo real; SSE si solo el servidor envía eventos; polling si la frecuencia es baja y la simplicidad importa más.

**2. ¿Qué agrega Socket.IO sobre WebSocket nativo?**
Reconexión, fallback a long-polling, eventos con nombre, acknowledgements, salas, namespaces y adaptadores para escalar.

**3. ¿Qué es un gateway en Nest?**
Una clase que maneja conexiones y mensajes de WebSocket, equivalente a un controlador, con soporte de DI, guards, pipes e interceptors.

**4. ¿Diferencia entre namespace y room?**
El namespace es un canal lógico al que el cliente se conecta explícitamente; las rooms son grupos que el servidor arma dentro de un namespace para emitir a varios.
