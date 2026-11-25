---
title: Build con Nx e imagen de Docker
sidebar_label: Build y Docker
sidebar_position: 1
description: Compilar la API con Nx, generar el package.json de producción, Dockerfile multi-stage con usuario no root, .dockerignore, Prisma en la imagen y señales de apagado.
---

# Build con Nx e imagen de Docker

<Tech ids={['nx', 'nestjs', 'docker', 'prisma']} />

<Estado tipo="construye">La imagen de Docker de la API de ripopola: chica, sin dependencias de desarrollo y corriendo con un usuario sin privilegios.</Estado>

## Concepto

En desarrollo, `nx serve api` compila y vigila archivos. En producción se
necesita otra cosa: **un artefacto inmutable** que se pueda correr igual en
cualquier lado. Ese artefacto es una **imagen de contenedor**.

| | Desarrollo | Producción |
| --- | --- | --- |
| Código | TypeScript, con *watch* | JavaScript compilado en `dist/` |
| Dependencias | Todas (`devDependencies` incluidas) | Solo las de runtime |
| Configuración | `.env` local | Variables de entorno y Secret Manager |
| Proceso | `nx serve` | `node main.js` dentro de un contenedor |

<Angular>

Es lo mismo que hacés con `ng build`: no subís el `src/`, subís `dist/`. La
diferencia es que la API **necesita `node_modules` en runtime** (Nest,
Prisma, etc.), mientras que el bundle de Angular trae todo adentro. Por eso
en backend importa tanto qué dependencias entran a la imagen.

</Angular>

## En ripopola

### 1. El build de Nx

```bash
pnpm nx build api --configuration=production
```

El executor de Node de Nx (con webpack o esbuild, según cómo se generó la
app) deja el resultado en `dist/apps/api/`. Revisá en `apps/api/project.json`
(o en el `webpack.config.js` de la app) que esté activado
**`generatePackageJson: true`**: Nx genera un `package.json` con **solo las
dependencias que la API importa de verdad**, con las versiones exactas del
lockfile. Esa es la lista que se instala en la imagen.

:::info Por qué no instalar el package.json de la raíz
En un monorepo Nx, la raíz tiene las dependencias de **todas** las apps:
Next.js, React, MapLibre, herramientas de test… Instalar eso en la imagen de la API
la haría pesada y con más superficie de ataque.
:::

### 2. Prisma dentro de la imagen

Prisma 7 genera el cliente como **código TypeScript** en la carpeta que
indica `output` del generador; el build de la API lo compila junto con el
resto. En la imagen hacen falta:

- El adaptador (`@prisma/adapter-pg`) y `pg`, que ya están en el
  `package.json` generado porque la API los importa.
- Para correr migraciones desde la imagen: el CLI `prisma`, `prisma.config.ts`
  y la carpeta `migrations/`. Se puede usar la misma imagen con otro comando
  (tema 3) o una imagen aparte solo para migrar.

### 3. Dockerfile multi-stage

```dockerfile title="apps/api/Dockerfile"
# ---- 1. Build: todo el monorepo, con dependencias de desarrollo ----
FROM node:26-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
RUN pnpm fetch
COPY . .
RUN pnpm install --offline --frozen-lockfile
RUN pnpm prisma generate && pnpm nx build api --configuration=production

# ---- 2. Dependencias de runtime: solo lo que pide dist/apps/api/package.json ----
FROM node:26-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY --from=build /repo/dist/apps/api/package.json ./
COPY --from=build /repo/pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# ---- 3. Runtime: imagen final chica y sin root ----
FROM node:26-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /repo/dist/apps/api ./
USER node
EXPOSE 8080
CMD ["node", "main.js"]
```

Qué mirar:

- **Multi-stage**: cada `FROM` es una etapa. La final solo copia lo
  necesario; compiladores, código fuente y `devDependencies` quedan atrás.
- **Caché de capas**: copiar primero el lockfile y hacer `pnpm fetch` hace
  que, si solo cambia el código, Docker reutilice la capa de dependencias.
- **`USER node`**: la imagen oficial de Node trae ese usuario. Correr como
  root dentro del contenedor es un riesgo innecesario.
- **`CMD ["node", "main.js"]`** en forma de array, sin `npm start` ni
  `pnpm start`: así Node es el proceso 1 y recibe `SIGTERM` directamente.
- La versión de Node la fija la regla del proyecto: la LTS vigente al
  construir, igual en `.nvmrc`, CI y Dockerfile.

:::tip Lockfile en la etapa deps
Si `pnpm install --frozen-lockfile` falla porque el `package.json` generado
no coincide con el lockfile de la raíz, Nx también puede generar un lockfile
podado (`generateLockfile: true`). Copiá ese en vez del de la raíz.
:::

### 4. `.dockerignore`

```text title=".dockerignore"
node_modules
dist
.nx
.next
.git
**/.env*
coverage
```

Sin esto, `COPY . .` manda al *build context* cientos de MB y, peor,
**secretos** de `.env`.

### 5. Escuchar en el puerto correcto y apagarse bien

```ts title="apps/api/src/main.ts"
const port = Number(process.env['PORT'] ?? 3000); // Cloud Run inyecta PORT=8080
app.enableShutdownHooks();                         // onModuleDestroy al recibir SIGTERM
await app.listen(port, '0.0.0.0');
```

- Cloud Run define `PORT`; la app **tiene** que escuchar ahí.
- `0.0.0.0` y no `localhost`: dentro del contenedor, `localhost` no es
  accesible desde afuera.
- `enableShutdownHooks()` hace que, al recibir `SIGTERM` (Cloud Run lo manda
  antes de apagar una instancia), Nest cierre Prisma, Redis y los workers de
  BullMQ ordenadamente. Lo vimos en el ciclo de vida (sección 1).

### 6. Probarla en local

```bash
docker build -f apps/api/Dockerfile -t ripopola-api .
docker run --rm -p 8080:8080 --env-file apps/api/.env -e PORT=8080 \
  --add-host=host.docker.internal:host-gateway ripopola-api
```

Dentro del contenedor, la base del `compose.yaml` no está en `localhost`
sino en `host.docker.internal` (o en el nombre del servicio, si la API
también corre en Compose).

<Alternativa title="Buildpacks de Google Cloud">

`gcloud run deploy --source .` detecta Node y arma la imagen sin
Dockerfile. Es cómodo para proyectos simples, pero en un monorepo Nx con
Prisma no controlás qué entra a la imagen. Escribir el Dockerfile es lo que
se espera de un senior, y te sirve igual en cualquier nube.

</Alternativa>

<Ejercicio title="Medí la imagen">

Construí la imagen y corré `docker images ripopola-api`. Después probá
construir sin la etapa `deps` (instalando todo el monorepo) y compará el
tamaño. Anotá ambas cifras en el ADR de despliegue (sección 15).

</Ejercicio>

<Resumen>

- Producción corre JavaScript compilado y solo dependencias de runtime.
- Nx `generatePackageJson` arma la lista mínima de dependencias de la API.
- Dockerfile multi-stage, caché de capas, `USER node`, `CMD` con `node` directo.
- Escuchar en `PORT` y `0.0.0.0`; `enableShutdownHooks()` para apagar bien.

</Resumen>

## Preguntas de entrevista

**1. ¿Para qué sirve un Dockerfile multi-stage?**
Para compilar en una etapa con todas las herramientas y copiar a la imagen final solo el resultado y las dependencias de runtime. La imagen queda más chica y con menos superficie de ataque.

**2. ¿Por qué no correr el contenedor como root?**
Si alguien explota una vulnerabilidad de la app, tendría privilegios de root dentro del contenedor, lo que facilita escapar o dañar más. Un usuario sin privilegios limita el daño.

**3. ¿Por qué `CMD ["node", "main.js"]` y no `npm start`?**
Porque npm se queda como proceso 1 y no siempre reenvía `SIGTERM` a Node: la app no se entera del apagado y se corta sin cerrar conexiones.

**4. ¿Cómo aprovechás la caché de capas de Docker?**
Copiando primero los archivos que cambian poco (lockfile) e instalando dependencias antes de copiar el código, así un cambio de código no reinstala todo.
