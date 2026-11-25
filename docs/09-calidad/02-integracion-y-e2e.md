---
title: Pruebas de integración y e2e con PostGIS real
sidebar_label: Integración y e2e
sidebar_position: 2
description: Testcontainers para levantar PostgreSQL + PostGIS en las pruebas, migraciones y limpieza entre pruebas, y pruebas e2e de la API con supertest y usuarios simulados.
---

# Pruebas de integración y e2e con PostGIS real

<Tech ids={['vitest', 'postgresql', 'docker', 'nestjs']} />

<Estado tipo="construye">Pruebas e2e que levantan la API completa contra un PostgreSQL + PostGIS en Docker, creado y destruido por las propias pruebas.</Estado>

## Por qué con una base real

La arquitectura de ripopola lo dice: "probar sobre PostgreSQL/PostGIS real
(no SQLite)". SQLite no tiene PostGIS, ni arrays, ni `unaccent`, ni los
mismos tipos. Una prueba que pasa en SQLite puede fallar en producción.

## Testcontainers

**Testcontainers** levanta contenedores de Docker desde el código de la
prueba y los destruye al terminar. Cada ejecución tiene una base limpia, sin
tocar la de desarrollo.

```bash
pnpm add -D -E testcontainers @testcontainers/postgresql supertest @types/supertest
```

### 1. Arranque global: base + migraciones

```ts title="apps/api/test/global-setup.ts"
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';

let container: StartedPostgreSqlContainer;

export async function setup() {
  container = await new PostgreSqlContainer('imresamu/postgis:18-3.6.1-alpine3.23') // la misma imagen que en local
    .withDatabase('ripopola_test')
    .start();

  process.env['DATABASE_URL'] = container.getConnectionUri();
  execSync('pnpm exec prisma migrate deploy', { stdio: 'inherit', env: process.env });
}

export async function teardown() {
  await container?.stop();
}
```

En la configuración de Vitest de las e2e: `globalSetup: ['./test/global-setup.ts']`.
`migrate deploy` aplica las mismas migraciones que producción: también estás
probando las migraciones.

### 2. Limpiar entre pruebas

```ts title="apps/api/test/db.ts"
export async function resetDb(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(
    'TRUNCATE towns, organizations, users, sessions, accounts, verifications, memberships, media, housing_listings RESTART IDENTITY CASCADE',
  );
}
```

(Acá `Unsafe` está bien: el texto es fijo, no viene de ningún usuario.)

### 3. La app de prueba, con sesiones reales

Con Better Auth (sección 6) no hace falta simular la autenticación: la
sesión es una fila en la base de prueba. Lo único que se reemplaza es el
envío de correos.

```ts title="apps/api/test/app.ts"
export async function createTestApp() {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue({ send: async () => undefined })      // ningún correo sale de las pruebas
    .compile();

  const app = module.createNestApplication<NestExpressApplication>({ bodyParser: false });
  configureApp(app);   // lo mismo que main.ts: Better Auth, prefijo, versionado, pipes…
  await app.init();
  return app;
}

/** Crea un usuario verificado, inicia sesión y devuelve la cookie para supertest. */
export async function loginAs(app: INestApplication, email: string, data: Partial<{ platformRole: PlatformRole }> = {}) {
  const auth = app.get<Auth>(BETTER_AUTH);
  const prisma = app.get(PrismaService);
  const password = 'clave-de-prueba-larga';

  await auth.api.signUpEmail({ body: { email, password, name: email } });
  await prisma.user.update({ where: { email }, data: { emailVerified: true, ...data } });

  const res = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
  return res.headers.getSetCookie().map((c) => c.split(';')[0]); // solo "nombre=valor"
}
```

`auth.api` es la misma API de servidor que usa el guard: registro y login
reales, sin pasar por HTTP. La cookie que devuelve es la que mandaría un
navegador.

### 4. Las pruebas

```ts title="apps/api/test/towns.e2e-spec.ts"
import request from 'supertest';

describe('Towns (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(() => resetDb(prisma));
  afterAll(() => app.close());

  it('lista solo los publicados', async () => {
    await prisma.town.createMany({ data: [
      { slug: 'a', officialName: 'A', country: 'ES', status: 'PUBLISHED' },
      { slug: 'b', officialName: 'B', country: 'ES', status: 'DRAFT' },
    ] });

    const res = await request(app.getHttpServer()).get('/api/v1/towns').expect(200);
    expect(res.body.items.map((t: { slug: string }) => t.slug)).toEqual(['a']);
  });

  it('crear pueblo requiere superadmin', async () => {
    const cookie = await loginAs(app, 'ana@test.dev');
    await request(app.getHttpServer())
      .post('/api/v1/towns')
      .set('Cookie', cookie)
      .send({ officialName: 'Teruel', country: 'ES' })
      .expect(403);
  });

  it('encuentra pueblos cercanos con PostGIS', async () => {
    const town = await prisma.town.create({ data: { slug: 'albarracin', officialName: 'Albarracín', country: 'ES', status: 'PUBLISHED' } });
    await prisma.$executeRaw`UPDATE towns SET location = ST_MakePoint(-1.4436, 40.4078)::geography WHERE id = ${town.id}::uuid`;

    const res = await request(app.getHttpServer()).get('/api/v1/towns/nearby?lng=-1.106&lat=40.345&radiusKm=40').expect(200);
    expect(res.body[0].slug).toBe('albarracin');
  });
});
```

## En CI

GitHub Actions tiene Docker, así que Testcontainers funciona igual (sección 14).
Las e2e van en un target aparte (`nx e2e api` o `nx test api --config e2e`)
porque tardan más que las unitarias.

<Resumen>

- Integración y e2e contra PostgreSQL + PostGIS real, con Testcontainers.
- Migraciones con `migrate deploy` antes de las pruebas.
- Base limpia entre pruebas (`TRUNCATE`).
- Sesiones reales con `auth.api`; solo el correo se reemplaza con `overrideProvider`.

</Resumen>

## Preguntas de entrevista

**1. ¿Por qué no usar SQLite en memoria para las pruebas?**
Porque no es el mismo motor: tipos, funciones y extensiones distintas. Las pruebas pasan y producción falla.

**2. ¿Qué es Testcontainers?**
Una librería que levanta dependencias reales en contenedores de Docker desde las pruebas y las destruye al terminar.

**3. ¿Cómo aislás las pruebas que usan base de datos?**
Base dedicada por ejecución, y limpieza entre pruebas con `TRUNCATE` o transacciones que se revierten.

**4. ¿Cómo probás endpoints protegidos sin el proveedor de identidad real?**
Si la autenticación vive en tu API (Better Auth), creando usuarios y sesiones reales en la base de prueba. Si es un proveedor externo, reemplazando el verificador de tokens por uno falso o usando el emulador del proveedor.
