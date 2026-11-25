---
title: Sesiones, Redis, límites y 2FA
sidebar_label: Sesiones y 2FA
sidebar_position: 5
description: Duración y renovación de sesiones, cerrar sesiones, caché en cookie y Redis como almacenamiento secundario, rate limiting de las rutas de auth, vincular cuentas, recuperar contraseña y 2FA con TOTP.
---

# Sesiones, Redis, límites y 2FA

<Tech ids={['betterauth', 'redis', 'nestjs', 'nextdotjs']} />

<Estado tipo="construye">Lo que convierte un login que funciona en uno seguro para un panel de ayuntamientos: sesiones que se pueden cerrar, límites contra fuerza bruta, recuperación de contraseña y segundo factor obligatorio para los administradores.</Estado>

## 1. El ciclo de vida de una sesión

```ts title="auth.config.ts (dentro de betterAuth)"
session: {
  expiresIn: 60 * 60 * 24 * 7,   // 7 días
  updateAge: 60 * 60 * 24,       // si se usa, se extiende como mucho una vez por día
  freshAge: 60 * 10,             // "sesión fresca": 10 minutos desde el login
},
```

- **Expiración deslizante**: mientras la persona use el panel, la sesión se
  renueva; si no entra en 7 días, tiene que volver a loguearse.
- **Sesión fresca**: para acciones delicadas (cambiar el correo, borrar la
  cuenta, desactivar 2FA), Better Auth exige un login reciente. Es la
  "reautenticación" que ves en Google o GitHub.

### Cerrar sesiones

Una ventaja de las sesiones sobre los JWT (tema 1) es poder cerrarlas:

```ts title="panel: pantalla 'Mis dispositivos'"
const { data: sessions } = await authClient.listSessions();   // IP, navegador, fecha
await authClient.revokeSession({ token: session.token });     // cerrar una
await authClient.revokeOtherSessions();                       // "cerrar todas menos esta"
```

Del lado del servidor, si un superadmin bloquea a alguien, se borran sus
filas en `sessions` y la próxima petición da 401. Al resetear la
contraseña se cierran todas (`revokeSessionsOnPasswordReset`, tema 2).

:::info Quitar a un editor no requiere cerrar su sesión
Las membresías se leen de la base en **cada petición** (tema 3): si un
admin quita a un editor, pierde el acceso al instante aunque su sesión siga
abierta. Lo único que hay que limpiar es su socket en tiempo real (sección 13).
:::

## 2. No leer la sesión de la base en cada petición

Dos herramientas, con un trade-off que conviene saber explicar:

### Caché de sesión en cookie

```ts
session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
```

Better Auth guarda una copia firmada de la sesión en una segunda cookie,
válida 5 minutos. Mientras sea válida, `getSession` **no consulta nada**.
El precio: una sesión revocada puede seguir funcionando **hasta 5
minutos**. Es el mismo trade-off que un JWT corto, acotado.

### Redis como almacenamiento secundario

Ya tenemos Redis (sección 10), y Better Auth sabe usarlo:

```bash
pnpm add -E @better-auth/redis-storage
```

```ts title="auth.config.ts"
import { redisStorage } from '@better-auth/redis-storage';

// en createAuth, recibiendo el cliente ioredis por AuthDeps
secondaryStorage: redisStorage({ client: redis, keyPrefix: 'auth:' }),
session: {
  storeSessionInDatabase: true,   // además en PostgreSQL: listar, auditar, sobrevivir a un reinicio de Redis
  // ...
},
```

Las sesiones se leen de Redis (submilisegundo) y los contadores de rate
limiting también quedan ahí, **compartidos entre instancias**.

:::warning Redis con noeviction
Es el mismo Redis de BullMQ, configurado con `noeviction` (sección 10). Si
se llenara, las escrituras de sesión fallarían en vez de borrar trabajos.
Vigilá la memoria, y en producción considerá un prefijo o una base lógica distinta.
:::

## 3. Rate limiting de las rutas de auth

Las rutas `/api/auth/*` están **fuera de Nest**: el `ThrottlerGuard` de la
sección 9 no las ve. Better Auth trae su propio limitador:

```ts title="auth.config.ts"
rateLimit: {
  enabled: true,                       // por defecto solo en producción
  storage: 'secondary-storage',        // Redis: compartido entre instancias
  window: 60, max: 100,                // general: 100 por minuto por IP
  customRules: {
    '/sign-in/email': { window: 60, max: 5 },
    '/sign-up/email': { window: 60, max: 3 },
    '/request-password-reset': { window: 300, max: 3 },
  },
},
```

- En memoria (el valor por defecto) **no sirve con varias instancias** en
  Cloud Run: cada una contaría por separado.
- El límite es **por IP**, así que detrás del balanceador de Cloud Run hay
  que decirle de qué cabecera sacar la IP real: revisá
  `advanced.ipAddress.ipAddressHeaders` y `trustedProxies` en la
  documentación de tu versión (es el mismo problema que `trust proxy` en la sección 9).

## 4. Recuperar la contraseña

```ts title="panel"
await authClient.requestPasswordReset({ email, redirectTo: `${location.origin}/nueva-clave` });
// en /nueva-clave?token=…
await authClient.resetPassword({ token, newPassword });
```

Siempre responde lo mismo exista o no el correo: no se puede usar para
averiguar quién está registrado (enumeración de usuarios).

## 5. Vincular cuentas

Si Ana se registró con `ana@ayto.es` y contraseña, y después toca "Entrar
con Google" con el mismo correo, ¿es la misma persona?

```ts
account: {
  accountLinking: { enabled: true, trustedProviders: ['google'] },
},
```

Con Google como proveedor confiable (verifica el correo), Better Auth
agrega una fila en `accounts` con `providerId: 'google'` al **mismo**
usuario. Sin esa confianza, un atacante podría crear una cuenta en un
proveedor que no verifica correos y quedarse con la de Ana.

## 6. Segundo factor (2FA) con TOTP

**TOTP** (*Time-based One-Time Password*) son los códigos de 6 dígitos de
Google Authenticator o 1Password: un secreto compartido + la hora actual.

### Servidor

```ts title="auth.config.ts"
import { twoFactor } from 'better-auth/plugins';

plugins: [twoFactor({ issuer: 'ripopola' })],
```

El plugin agrega el campo `twoFactorEnabled` al usuario y una tabla
`twoFactor` (secreto cifrado y códigos de respaldo). Corré `pnpm dlx auth
generate`, copiá lo nuevo al schema y `prisma migrate dev --name two-factor`.

### Panel

```ts title="libs/frontend/auth/src/auth-client.ts"
import { twoFactorClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  // ...
  plugins: [twoFactorClient({ onTwoFactorRedirect: () => { window.location.href = '/login/codigo'; } })],
});

// Activar: pide la contraseña, devuelve el URI para el QR y los códigos de respaldo
const { data } = await authClient.twoFactor.enable({ password });
// mostrar data.totpURI como QR y data.backupCodes para guardar
await authClient.twoFactor.verifyTotp({ code });          // confirma que el QR se escaneó bien

// En el login: si la cuenta tiene 2FA, signIn no crea la sesión y llama a onTwoFactorRedirect
await authClient.twoFactor.verifyTotp({ code, trustDevice: true });   // "confiar en este dispositivo 30 días"
```

### Obligatorio para administradores de ayuntamiento

Better Auth deja el 2FA **opcional**. La regla de negocio ("un ADMIN de un
ayuntamiento tiene que tenerlo") es nuestra, y va en la autorización:

```ts title="auth/require-2fa.guard.ts"
@Injectable()
export class RequireTwoFactorGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const user = context.switchToHttp().getRequest().user as AuthUser;
    const isAdmin = user.memberships.some((m) => m.role === 'ADMIN') || user.platformRole === 'SUPERADMIN';
    if (isAdmin && !user.twoFactorEnabled) {
      throw new ForbiddenException({ type: 'two-factor-required' }); // el panel redirige a activarlo
    }
    return true;
  }
}
```

Sumá `twoFactorEnabled` al `select` de `UsersService.load` y al tipo
`AuthUser`, y aplicá el guard a las acciones de administración (gestionar
editores, suscripción, borrar).

<Alternativa title="Passkeys y magic links">

Better Auth tiene plugins para **passkeys** (WebAuthn: login con huella o
Face ID, resistente a phishing, el futuro del login) y **magic links**
(login con un enlace al correo, sin contraseña). Para personas que buscan
mudarse, un magic link puede ser más simple que una contraseña; para los
ayuntamientos, passkey + contraseña. Buenas candidatas para una segunda etapa.

</Alternativa>

<Resumen>

- Sesiones de 7 días con renovación deslizante y "sesión fresca" para lo delicado.
- Listar y cerrar sesiones; las membresías se validan en cada petición.
- Caché en cookie (revocación con demora) o Redis como almacenamiento secundario.
- Rate limiting propio de Better Auth en Redis, con la IP real detrás del proxy.
- Recuperación sin enumeración, vinculación solo con proveedores confiables.
- 2FA TOTP con el plugin; obligatorio para admins con un guard nuestro.

</Resumen>

## Preguntas de entrevista

**1. ¿Qué es una expiración deslizante?**
Una sesión que se extiende mientras se usa y vence tras un período de inactividad, en vez de vencer a una hora fija.

**2. ¿Qué trade-off tiene cachear la sesión en una cookie firmada?**
Ahorra una consulta por petición, pero una sesión revocada sigue valiendo hasta que vence la copia en caché.

**3. ¿Por qué el rate limiting en memoria no sirve con varias instancias?**
Porque cada instancia cuenta por su lado: el atacante reparte los intentos entre instancias. Hace falta un contador compartido, como Redis.

**4. ¿Cómo evitás la enumeración de usuarios?**
Respondiendo igual (y en un tiempo similar) exista o no el correo, en el login, el registro y la recuperación de contraseña.

**5. ¿Cómo funciona TOTP?**
Servidor y app comparten un secreto; ambos calculan un código a partir del secreto y la hora actual en ventanas de 30 segundos. El servidor acepta el código si coincide con la ventana actual (o una contigua).

**6. ¿Qué riesgo tiene vincular cuentas por correo automáticamente?**
Que un proveedor que no verifica correos permita a un atacante registrar el correo de otra persona y quedarse con su cuenta. Solo se vincula con proveedores que verifican el correo.
