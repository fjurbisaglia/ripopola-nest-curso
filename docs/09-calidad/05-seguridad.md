---
title: Seguridad de la API
sidebar_label: Seguridad y rate limiting
sidebar_position: 5
description: OWASP API Security Top 10 aplicado a ripopola, CORS, Helmet, límites de tamaño, rate limiting con @nestjs/throttler y Redis, dependencias y secretos.
---

# Seguridad de la API

<Tech ids={['nestjs', 'redis', 'githubactions']} />

<Estado tipo="construye">CORS restringido, límites de tamaño, rate limiting con almacenamiento en Redis y revisión de dependencias en CI. Más una lista de control con el OWASP API Top 10.</Estado>

## OWASP API Security Top 10 (2023) en ripopola

| # | Riesgo | Cómo lo cubrimos | Dónde |
| --- | --- | --- | --- |
| API1 | Autorización por objeto rota (BOLA) | `TownPolicy` + pruebas de "otro dueño" | Sección 6 |
| API2 | Autenticación rota | Better Auth: sesiones revocables, rate limiting, 2FA para admins | Sección 6 |
| API3 | Autorización por propiedad rota (asignación masiva, exponer campos) | `whitelist`, DTOs y `select` | Secciones 1 y 2 |
| API4 | Consumo de recursos sin límite | `pageSize` máximo, límites de archivos, rate limiting, timeouts | Varias + este tema |
| API5 | Autorización por función rota | `@SuperadminOnly()`, guards globales | Sección 6 |
| API6 | Abuso de flujos de negocio | Rate limiting en contacto y registro | Este tema |
| API7 | SSRF | No pedir URLs que manda el usuario; si hace falta, lista permitida | Sección 5 |
| API8 | Mala configuración | Helmet, CORS, sin stack traces, sin docs en producción | Este tema |
| API9 | Inventario descontrolado | OpenAPI generado, versiones explícitas | Sección 8 |
| API10 | Consumo inseguro de APIs de terceros | Validar respuestas, timeouts | Sección 5 |

## En ripopola

### 1. CORS

**CORS** es la regla del navegador que impide que una página de otro origen
lea respuestas de tu API, salvo que la API lo permita. **No es una medida de
seguridad del servidor** (curl ignora CORS), pero configurarlo mal abre la
puerta a que cualquier sitio use la sesión de tus usuarios.

```ts title="main.ts"
app.enableCors({
  origin: config.get<string>('CORS_ORIGINS').split(','), // nunca '*' con credenciales
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
  maxAge: 600, // cachea el preflight 10 minutos
});
```

<Angular>

En Angular, la alternativa a CORS en desarrollo era el **proxy** de la CLI
(`proxy.conf.json`). En el Next de ripopola es lo mismo con `rewrites`
(sección 12): el navegador ve todo en el mismo origen. En producción, si web
y API comparten origen (`ripopola.com/api`), ni siquiera hace falta CORS.

</Angular>

### 2. Límites de tamaño

```ts title="configure-app.ts"
// Con Better Auth el body parser se agrega a mano después de montar su handler (sección 6)
app.use(json({ limit: '200kb' }), urlencoded({ extended: true, limit: '200kb' })); // una ficha de pueblo no pesa más
```

### 3. Rate limiting con `@nestjs/throttler`

Limita cuántas peticiones puede hacer un cliente en una ventana de tiempo.
Protege contra fuerza bruta, scraping y abusos (por ejemplo, alguien
mandando 10.000 solicitudes de contacto a un ayuntamiento).

```bash
pnpm add -E @nestjs/throttler @nest-lab/throttler-storage-redis ioredis
```

```ts title="app.module.ts"
ThrottlerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    throttlers: [
      { name: 'short', ttl: 1_000, limit: 10 },   // 10 por segundo
      { name: 'long', ttl: 60_000, limit: 300 },  // 300 por minuto
    ],
    // Redis: el contador se comparte entre todas las instancias de Cloud Run
    storage: new ThrottlerStorageRedisService(config.getOrThrow('REDIS_URL')),
  }),
}),

providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
```

Ajustes por endpoint:

```ts
@Throttle({ long: { limit: 5, ttl: 3_600_000 } }) // 5 contactos por hora
@Post(':id/contact')
contact() { ... }

@SkipThrottle()
@Get('health/live')
live() { ... }
```

:::warning La IP detrás de un proxy
En Cloud Run la API está detrás de un balanceador: la IP de la petición es la
del balanceador. Hay que activar `app.set('trust proxy', 1)` para usar la de
`X-Forwarded-For`, o todos los usuarios comparten el mismo límite. Para
usuarios autenticados, mejor limitar **por usuario** (sobrescribiendo `getTracker` del guard).
:::

Sin Redis, el contador vive en la memoria de cada instancia: con 3
instancias, el límite real es el triple. Por eso Redis.

### 4. Dependencias y secretos

- `pnpm audit` y **Dependabot** o **Renovate** en GitHub para actualizar dependencias con vulnerabilidades.
- **Secret scanning** de GitHub activado en el repo.
- Nunca secretos en el código, en los logs ni en la imagen de Docker.

### 5. Lista de control antes de producción

- [ ] Todos los endpoints privados detrás del guard global (probado).
- [ ] Pruebas de BOLA para cada recurso con dueño.
- [ ] `whitelist` + `forbidNonWhitelisted` activos.
- [ ] Sin documentación OpenAPI pública ni stack traces.
- [ ] CORS con orígenes explícitos.
- [ ] Rate limiting en login, contacto y escrituras.
- [ ] Logs sin datos personales.
- [ ] Dependencias sin vulnerabilidades críticas.

<Resumen>

- El OWASP API Top 10 es la lista de control de cualquier API.
- CORS con orígenes explícitos; límites de tamaño en todo.
- Rate limiting con Redis para que valga entre instancias, con `trust proxy`.
- Dependencias y secretos vigilados en CI.

</Resumen>

## Preguntas de entrevista

**1. ¿Qué es CORS y protege al servidor?**
Es una política del navegador para lecturas entre orígenes. No protege al servidor de clientes que no son navegadores; protege a los usuarios de sitios maliciosos.

**2. ¿Cómo implementás rate limiting en una API con varias instancias?**
Con un almacenamiento compartido del contador (Redis), identificando al cliente por usuario o por IP real detrás del proxy.

**3. Nombrá tres riesgos del OWASP API Top 10.**
BOLA, autenticación rota, consumo de recursos sin límite (o cualquier otro de la tabla, con un ejemplo concreto).

**4. ¿Qué es SSRF?**
Hacer que el servidor haga peticiones a destinos que elige el atacante (por ejemplo, la red interna). Se evita no pidiendo URLs del usuario o validándolas contra una lista permitida.
