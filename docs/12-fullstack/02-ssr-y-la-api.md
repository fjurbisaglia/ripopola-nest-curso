---
title: Renderizado en el servidor, caché y la API
sidebar_label: SSR, caché y la API
sidebar_position: 2
description: La ficha pública del pueblo con Server Components, 'use cache' y cacheTag, revalidación a demanda disparada por Nest, metadatos SEO y 404 real, timeouts, y cómo proteger el panel con proxy.ts y la sesión de Better Auth.
---

# Renderizado en el servidor, caché y la API

<Tech ids={['nextdotjs', 'nestjs', 'redis', 'betterauth']} />

<Estado tipo="construye">La ficha pública de cada pueblo se renderiza en el servidor con los datos de la API, queda cacheada, y se actualiza sola cuando el ayuntamiento publica un cambio. El panel solo se muestra con sesión.</Estado>

## Qué pasa cuando alguien abre una ficha

```mermaid
sequenceDiagram
  participant B as Navegador
  participant W as Servidor Next (web)
  participant A as API Nest
  B->>W: GET /pueblos/albarracin
  alt en caché
    W-->>B: HTML (sin llamar a la API)
  else no está o se invalidó
    W->>A: GET /api/v1/towns/albarracin
    A-->>W: JSON
    W-->>B: HTML completo + payload de React
  end
  Note over B: hidrata; los datos ya vienen en la respuesta
```

Dos diferencias con el SSR de Angular que conviene tener claras:

- **No hay "transfer state"**: los Server Components no se ejecutan en el
  navegador. Sus datos viajan ya renderizados (HTML y el *payload* de
  React), así que no existe la doble petición que en Angular evitaba
  `withHttpTransferCacheOptions`.
- **La caché es del servidor de Next**: una ficha cacheada no toca la API.
  El desafío pasa a ser **invalidarla** cuando cambia el pueblo.

## En ripopola

### 1. Leer la ficha, cacheada y etiquetada

```ts title="apps/web/app/pueblos/[slug]/data.ts"
import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';

export async function getTown(slug: string, lang: string) {
  'use cache';
  cacheTag(`town:${slug}`, 'towns');        // para invalidarla después
  cacheLife('hours');                        // y por las dudas, que no viva para siempre

  const res = await fetch(`${process.env.API_INTERNAL_URL}/api/v1/towns/${slug}?lang=${lang}`, {
    signal: AbortSignal.timeout(3000),       // si la API no responde, no colgar la página
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status}`);
  return (await res.json()) as TownDetail;
}
```

Qué mirar:

- **`'use cache'`** (con `cacheComponents: true` en `next.config.ts`):
  el resultado se guarda según los argumentos (`slug`, `lang`).
- **Sin cookies**: la ficha pública es igual para todos. Dentro de una
  función con `'use cache'` no se puede leer `cookies()`, y está bien: los
  datos de un usuario nunca se cachean para todos.
- **Timeout**: la API está en el camino crítico de la página. Sin
  `AbortSignal.timeout`, una API lenta deja la página colgada.

### 2. La página, el SEO y el 404 real

```tsx title="apps/web/app/pueblos/[slug]/page.tsx"
import { notFound } from 'next/navigation';

export async function generateMetadata({ params }: PageProps<'/pueblos/[slug]'>) {
  const { slug } = await params;
  const town = await getTown(slug, 'es');                 // misma función: no hay segunda llamada
  if (!town) return {};
  return {
    title: `${town.name} | ripopola`,
    description: town.summary,
    openGraph: { images: town.photos.slice(0, 1).map((p) => p.url) },
    alternates: { canonical: `/pueblos/${slug}`, languages: { it: `/it/paesi/${slug}` } },
  };
}

export default async function TownPage({ params }: PageProps<'/pueblos/[slug]'>) {
  const { slug } = await params;
  const town = await getTown(slug, 'es');
  if (!town) notFound();                                   // 404 de verdad, no un 200 con "no encontrado"
  return <TownDetailView town={town} />;
}
```

Los borradores nunca llegan a la web: la API da 404 (sección 2) y Next
responde 404. Si respondiera 200 con un mensaje, Google lo indexaría como
una página válida (*soft 404*).

### 3. Revalidar cuando el ayuntamiento publica

La ficha cacheada tiene que cambiar **cuando cambia el pueblo**, no a los
diez minutos. Nest ya emite `town.published` (sección 10); ahora también
avisa a la web:

```ts title="apps/web/app/internal/revalidate/route.ts"
import { revalidateTag } from 'next/cache';

export async function POST(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.REVALIDATE_SECRET}`) {
    return new Response(null, { status: 401 });
  }
  const { tags } = (await request.json()) as { tags: string[] };
  for (const tag of tags) revalidateTag(tag, 'max');   // la próxima visita trae datos frescos
  return Response.json({ revalidated: tags });
}
```

```ts title="apps/api: towns/web-revalidation.listener.ts"
@Injectable()
export class WebRevalidationListener {
  constructor(@InjectQueue('web-revalidation') private readonly queue: Queue) {}

  @OnEvent(TownPublishedEvent.event)
  @OnEvent(TownUpdatedEvent.event)
  async onTownChanged(e: { slug: string }) {
    // Por una cola: si la web no responde, BullMQ reintenta (sección 10)
    await this.queue.add('revalidate', { tags: [`town:${e.slug}`, 'towns'] }, { attempts: 5 });
  }
}
```

El *processor* de esa cola hace el `POST` a `${WEB_INTERNAL_URL}/internal/revalidate`
con el secreto. Con `'max'`, la siguiente visita recibe la versión vieja
mientras se regenera en segundo plano (*stale-while-revalidate*); si
hiciera falta que desaparezca ya, `{ expire: 0 }`.

:::warning Varias instancias de Next
La caché de `'use cache'` vive **en la memoria de cada instancia**. Con dos
instancias de la web en Cloud Run, el `POST` de revalidación llega solo a
una. Para producción hace falta un **cache handler compartido**
(`cacheHandlers` en `next.config.ts`, con Redis) o una plataforma que lo
resuelva (Vercel). Lo vemos en la sección 14.
:::

### 4. Proteger el panel

Dos capas, como en el backend:

**Capa optimista en `proxy.ts`** (el antiguo `middleware.ts`): si no hay
cookie de sesión, redirigir al login sin llegar a renderizar.

```ts title="apps/panel/proxy.ts"
import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL(`/login?next=${request.nextUrl.pathname}`, request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!login|registro|api|_next|favicon.ico).*)'] };
```

`getSessionCookie` solo mira que **exista** la cookie; no la valida (no
consulta la base). Es una optimización de experiencia, no seguridad.

**Capa real en el layout**: pedirle a la API quién es.

```tsx title="apps/panel/app/(privado)/layout.tsx"
export default async function PrivateLayout({ children }: LayoutProps<'/'>) {
  const api = await serverApi();
  const { data: me, response } = await api.GET('/api/v1/me');
  if (response.status === 401) redirect('/login');
  return <SessionProvider me={me!}>{children}</SessionProvider>;   // membresías para el menú
}
```

Y la autoridad final sigue siendo **Nest**: cada endpoint pasa por el
`AuthGuard` y `TownPolicy`. Si el front se equivoca, la API dice 401 o 403.

<Angular>

`proxy.ts` cumple el papel de un `CanActivateFn`, con una diferencia
importante: corre **en el servidor**, antes de mandar nada al navegador.
Igual que un guard de Angular, no reemplaza la autorización de la API.

</Angular>

<Resumen>

- Server Components: los datos llegan renderizados; no hay transfer state.
- `'use cache'` + `cacheTag` + `cacheLife` para la ficha pública; nunca datos de usuario.
- Nest dispara la revalidación (evento → cola → `POST` → `revalidateTag`).
- `generateMetadata` para SEO y `notFound()` para un 404 real; timeouts siempre.
- Panel: `proxy.ts` optimista, layout que consulta `/api/v1/me`, y la API como autoridad.

</Resumen>

## Preguntas de entrevista

**1. ¿Qué impacto tiene el SSR sobre el backend?**
La API queda en el camino de renderizado: su latencia suma al tiempo de la página. Por eso hace falta caché, timeouts y revalidación a demanda.

**2. ¿Cómo invalidás una página cacheada cuando cambian los datos en otra API?**
Etiquetando los datos cacheados (`cacheTag`) y haciendo que el backend, al cambiar el dato, llame a un endpoint protegido de Next que ejecuta `revalidateTag`, idealmente desde una cola con reintentos.

**3. ¿Qué es stale-while-revalidate?**
Servir la versión cacheada aunque esté vencida mientras se genera la nueva en segundo plano. El usuario nunca espera, a cambio de ver datos viejos una vez.

**4. ¿Por qué devolver un 404 real en SSR?**
Para que los buscadores no indexen páginas inexistentes como si fueran válidas (soft 404).

**5. ¿Alcanza con proteger rutas en `proxy.ts` (o middleware)?**
No. Es una capa de experiencia: solo ve si hay cookie. La validación real está en el servidor (layout que consulta la sesión) y, sobre todo, en la API, que valida cada petición.

**6. ¿Qué problema trae la caché del servidor con varias instancias?**
Cada instancia tiene su propia caché: una revalidación llega a una sola. Se resuelve con un almacenamiento de caché compartido (Redis) o con la infraestructura de la plataforma.
