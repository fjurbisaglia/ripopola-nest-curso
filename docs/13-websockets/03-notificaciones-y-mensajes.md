---
title: Notificaciones y mensajes en ripopola
sidebar_label: Notificaciones y mensajes
sidebar_position: 3
description: Conectar eventos de dominio y colas con el gateway, notificaciones persistentes, y mensajería entre personas y municipios con historial en PostgreSQL.
---

# Notificaciones y mensajes en ripopola

<Tech ids={['socketdotio', 'nestjs', 'prisma', 'nextdotjs']} />

<Estado tipo="construye">Dos funciones reales: avisos en vivo al panel ("alguien se interesó en Albarracín", "traducciones listas") y conversaciones entre una persona y un ayuntamiento.</Estado>

## Regla de oro: el socket no es la fuente de verdad

Un WebSocket **no garantiza entrega**: si el panel está cerrado, el aviso se
pierde. Por eso:

1. **Primero se guarda** en PostgreSQL (la notificación o el mensaje).
2. **Después se avisa** por el socket, como "llegó algo nuevo".
3. Al abrir el panel, se **leen las pendientes por HTTP**.

El socket es una optimización de latencia, no el almacenamiento.

## Notificaciones al municipio

### 1. Modelo

```prisma
model Notification {
  id             String    @id @default(uuid(7)) @db.Uuid
  organizationId String    @map("organization_id") @db.Uuid
  type           String    // 'contact.received', 'translations.done'
  payload        Json
  readAt         DateTime? @map("read_at") @db.Timestamptz(3)
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)

  @@index([organizationId, readAt, createdAt])
  @@map("notifications")
}
```

### 2. De un evento de dominio a la sala del ayuntamiento

```ts title="realtime/notifications.service.ts"
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService, private readonly gateway: NotificationsGateway) {}

  @OnEvent('contact.received')
  async onContact(e: { organizationId: string; townSlug: string; listingTitle?: string }) {
    const n = await this.prisma.notification.create({
      data: { organizationId: e.organizationId, type: 'contact.received', payload: e },
    });
    this.gateway.server.to(`org:${e.organizationId}`).emit('notification', n);
  }
}
```

El mismo patrón sirve para el worker de traducciones: cuando termina el
último trabajo de un pueblo, emite `translations.done`.

:::warning Desde el worker
Si el worker de BullMQ corre en **otro proceso** (sección 10), no tiene los
sockets. Para emitir a clientes conectados a la API desde otro proceso, se
usa el **emitter de Redis** (`@socket.io/redis-emitter`) o el adaptador de
Redis del tema siguiente. Es la razón principal para escalar con Redis.
:::

### 3. En el panel

```tsx title="apps/panel: notifications-bell.tsx"
'use client';

export function NotificationsBell() {
  const queryClient = useQueryClient();

  // Lo pendiente al abrir, por HTTP
  const { data = [] } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: async () => (await browserApi.GET('/api/v1/panel/notifications', { params: { query: { unread: true } } })).data ?? [],
  });

  // Lo nuevo, en vivo: se suma a la misma caché de TanStack Query
  const onNotification = useCallback((n: Notification) => {
    queryClient.setQueryData<Notification[]>(['notifications', 'unread'], (list = []) => [n, ...list]);
  }, [queryClient]);
  useSocketEvent('notification', onNotification);

  return <Bell count={data.length} items={data} />;
}
```

El socket no tiene su propio estado: escribe en la **misma caché** que la
petición HTTP. Si el socket se corta y vuelve, alcanza con
`invalidateQueries(['notifications'])` al reconectar para no perder nada.

## Mensajes entre persona y ayuntamiento

```prisma
model Conversation {
  id             String    @id @default(uuid(7)) @db.Uuid
  organizationId String    @map("organization_id") @db.Uuid
  personId       String    @map("person_id") @db.Uuid   // el User que escribe
  subject        String?
  messages       Message[]
  @@unique([organizationId, personId, subject])
  @@map("conversations")
}

model Message {
  id             String       @id @default(uuid(7)) @db.Uuid
  conversationId String       @map("conversation_id") @db.Uuid
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  senderId       String       @map("sender_id") @db.Uuid
  body           String       @db.VarChar(4000)
  createdAt      DateTime     @default(now()) @map("created_at") @db.Timestamptz(3)
  @@index([conversationId, createdAt])
  @@map("messages")
}
```

```ts title="realtime/messages.gateway.ts (resumen)"
@SubscribeMessage('message.send')
async send(@ConnectedSocket() client: Socket, @MessageBody() dto: SendMessageDto) {
  const user = client.data.user as AuthUser;
  await this.conversations.assertParticipant(user, dto.conversationId); // ¡autorización!
  const msg = await this.messages.create(user.id, dto);                  // primero guardar
  this.server.to(`conversation:${dto.conversationId}`).emit('message.new', msg);
  return { id: msg.id };                                                 // ack al que envió
}
```

- **Autorización por recurso** también en sockets: ¿participa de esta conversación?
- **El ack** confirma al emisor que se guardó (para pasar de "enviando…" a "enviado").
- El historial se lee por HTTP con **paginación por cursor** (sección 2): `?before=<id>`.
- **Rate limiting** de mensajes (sección 9) contra spam a los ayuntamientos.
- Si el ayuntamiento no está conectado, un trabajo en la cola le manda un **correo** de resumen.

<Resumen>

- Guardar primero, emitir después; leer pendientes por HTTP al abrir.
- Eventos de dominio → servicio de notificaciones → sala del ayuntamiento.
- Mensajes con autorización por conversación, ack y paginación por cursor.
- Emitir desde otro proceso requiere Redis.

</Resumen>

## Preguntas de entrevista

**1. ¿Un WebSocket garantiza la entrega de un mensaje?**
No. Por eso se persiste primero y el cliente sincroniza lo pendiente al reconectar.

**2. ¿Cómo diseñarías un chat con historial?**
Mensajes en la base, socket para entregar en vivo a una sala por conversación, ack al emisor, historial por HTTP paginado por cursor y notificación diferida si el destinatario no está conectado.

**3. ¿Cómo emitís a clientes de Socket.IO desde un worker en otro proceso?**
Con el emitter o el adaptador de Redis, que publica el evento para que lo entreguen las instancias que tienen esos sockets.
