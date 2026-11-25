---
title: Integración continua con GitHub Actions
sidebar_label: CI con GitHub Actions
sidebar_position: 4
description: Pipeline de CI para el monorepo con nx affected, caché de pnpm, lint, tests unitarios, integración con Testcontainers, build de la imagen y despliegue con Workload Identity Federation.
---

# Integración continua con GitHub Actions

<Tech ids={['githubactions', 'nx', 'docker', 'googlecloud']} />

<Estado tipo="construye">El pipeline de ripopola: cada pull request se valida solo en lo que cambió, y cada merge a main despliega la API.</Estado>

## Concepto

- **CI (integración continua)**: cada cambio se compila y se prueba
  automáticamente antes de entrar a la rama principal.
- **CD (entrega o despliegue continuo)**: lo que entra a la rama principal
  se publica solo (o con un botón).

En un monorepo, probar **todo** en cada cambio es lento. Nx sabe qué
proyectos dependen de qué (el grafo de la sección 12), así que
**`nx affected`** corre las tareas solo de los proyectos tocados por el cambio
y de los que dependen de ellos. Si cambiás `@ripopola/town`, se prueban la
API, la web y el panel; si cambiás solo el panel, solo el panel.

## En ripopola

### 1. Pipeline de pull requests

```yaml title=".github/workflows/ci.yml"
name: CI
on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0               # nx affected necesita el historial
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v5
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - uses: nrwl/nx-set-shas@v4      # calcula la base de comparación
      - run: pnpm prisma generate
      - run: pnpm nx affected -t lint typecheck test build --parallel=3
```

Qué mirar:

- **`fetch-depth: 0`** y `nx-set-shas`: Nx compara el commit actual contra
  el último commit exitoso de `main` para saber qué cambió.
- **`cache: pnpm`** reutiliza el almacén de pnpm entre ejecuciones.
- **`permissions: contents: read`**: el token del workflow con lo mínimo.
- Las versiones de las *actions* son las vigentes al escribir esto: fijalas
  a la última estable al configurar (regla D-04), o mejor, por SHA.

### 2. Tests de integración con Testcontainers

Los tests de integración de la sección 9 levantan PostgreSQL con PostGIS
en Docker. Los runners de GitHub (`ubuntu-latest`) **ya traen Docker**, así
que funcionan sin cambios:

```yaml
      - run: pnpm nx affected -t test-integration
```

Se separa en otro *target* (`test-integration`) porque tarda más; se puede
correr en un job aparte, en paralelo con el de lint y unitarios.

:::tip Que el CI sea el mismo que tu máquina
Mismo Node (`.nvmrc`), mismo pnpm (`packageManager` en `package.json`),
misma imagen de PostGIS en Testcontainers que en `compose.yaml`. Si el CI
falla y tu máquina no, casi siempre es una de esas tres.
:::

### 3. Despliegue al hacer merge en main

Para que GitHub despliegue en Google Cloud **sin guardar una clave JSON**
como secreto, se usa **Workload Identity Federation**: GitHub emite un token
OIDC por ejecución y Google lo cambia por credenciales temporales de una
cuenta de servicio de despliegue.

```yaml title=".github/workflows/deploy.yml"
name: Deploy API
on:
  push:
    branches: [main]

permissions:
  contents: read
  id-token: write                      # para pedir el token OIDC

concurrency: deploy-api                # nunca dos despliegues a la vez

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v5
      - uses: google-github-actions/auth@v3
        with:
          workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}
          service_account: ${{ vars.GCP_DEPLOY_SA }}
      - uses: google-github-actions/setup-gcloud@v3
      - run: gcloud auth configure-docker europe-southwest1-docker.pkg.dev
      - name: Build y push
        run: |
          IMAGE=europe-southwest1-docker.pkg.dev/ripopola-prod/ripopola/api:${GITHUB_SHA::7}
          docker build -f apps/api/Dockerfile -t $IMAGE . && docker push $IMAGE
          echo "IMAGE=$IMAGE" >> $GITHUB_ENV
      - name: Migrar
        run: gcloud run jobs execute migrate --region=europe-southwest1 --wait
      - name: Desplegar
        run: gcloud run deploy api --image=$IMAGE --region=europe-southwest1
```

- **`concurrency`**: si entran dos merges seguidos, el segundo espera.
- **`environment: production`**: en GitHub se le pueden poner reglas
  (aprobación manual, solo desde `main`).
- El job `migrate` tiene que usar la imagen nueva (con las migraciones
  nuevas): actualizalo con `gcloud run jobs update migrate --image=…` antes
  de ejecutarlo.
- En un monorepo, el despliegue también puede depender de `nx affected`:
  si el cambio no toca la API, no se despliega la API.

### 4. Protección de la rama main

En GitHub, *Settings → Branches*: exigir que el check `CI` pase y al menos
una revisión antes de hacer merge. Aunque trabajes solo, te obliga a pasar
por el pipeline.

<Alternativa title="Cloud Build, GitLab CI, Nx Cloud">

**Cloud Build** es el CI de Google: se integra directo con Cloud Run, pero
la configuración queda fuera de GitHub. **GitLab CI** y **CircleCI** son muy
usados en empresas. **Nx Cloud** agrega caché remota de tareas y
distribución entre máquinas: si un build ya se hizo con las mismas
entradas, lo reutiliza. Con un monorepo chico no hace falta; cuando el CI
pase de 10 minutos, vale la pena.

</Alternativa>

<Ejercicio title="Romper el CI a propósito">

Abrí una rama, cambiá un tipo en `@ripopola/town` para que el panel no
compile y abrí un pull request. Revisá en el log qué proyectos marcó `nx
affected` y que el check bloquee el merge.

</Ejercicio>

<Resumen>

- CI en cada PR: lint, tipos, tests y build solo de lo afectado (`nx affected`).
- Testcontainers funciona directo en los runners de GitHub.
- CD en `main`: build, push, migrar y desplegar, con `concurrency`.
- Workload Identity Federation: sin claves JSON en GitHub.
- Rama `main` protegida por el check de CI.

</Resumen>

## Preguntas de entrevista

**1. ¿Qué es `nx affected` y por qué importa en un monorepo?**
Corre tareas solo en los proyectos afectados por un cambio, usando el grafo de dependencias. Mantiene el CI rápido a medida que crece el monorepo.

**2. ¿Cómo autenticás el CI contra la nube sin guardar claves?**
Con federación de identidad (OIDC): el proveedor de CI emite un token por ejecución que la nube intercambia por credenciales temporales con permisos acotados.

**3. ¿Qué debería pasar en un pipeline antes de desplegar?**
Lint, chequeo de tipos, tests unitarios y de integración, build de la imagen y migraciones de la base; si algo falla, se corta y no se despliega.

**4. ¿Diferencia entre entrega continua y despliegue continuo?**
En entrega continua cada cambio queda listo para publicar y alguien decide cuándo; en despliegue continuo se publica automáticamente.
