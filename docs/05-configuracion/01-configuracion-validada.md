---
title: Configuración validada con @nestjs/config
sidebar_label: Configuración y .env
sidebar_position: 1
description: Variables de entorno, ConfigModule, validación al arrancar, configuración tipada por namespaces y secretos, aplicado a la API de ripopola.
---

# Configuración validada con `@nestjs/config`

<Tech ids={['nestjs', 'googlecloud']} />

<Estado tipo="construye">Toda la configuración de la API pasa por `ConfigService`, validada al arrancar: si falta `DATABASE_URL` o una clave, la API no levanta y dice qué falta.</Estado>

## Concepto

### Por qué variables de entorno

La regla de **The Twelve-Factor App**: la configuración que cambia entre
entornos (local, pruebas, producción) **no va en el código**, va en el
entorno. Así la misma imagen de Docker corre en todos lados, y los secretos
no terminan en Git.

| Va en variables de entorno | Va en el código |
| --- | --- |
| URL de la base, claves de APIs, puerto, nivel de log, orígenes CORS | Reglas de negocio, límites fijos del producto |

### Validar al arrancar (*fail fast*)

Si falta una variable, es mucho mejor que la API **no arranque** con un
mensaje claro, a que arranque y explote en la primera petición que la usa (o
peor, que funcione mal en silencio).

<Angular>

Es lo que en Angular hacés con `environment.ts`, con una diferencia
importante: en Angular esos valores **terminan en el bundle del navegador**,
así que nunca pueden ser secretos. En el backend sí podés tener secretos,
porque el código no sale del servidor.

</Angular>

## En ripopola

### 1. Instalar

```bash
pnpm add -E @nestjs/config
```

### 2. El esquema de variables, validado con class-validator

```ts title="apps/api/src/app/config/env.validation.ts"
import { plainToInstance, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUrl, Max, Min, MinLength, validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @Type(() => Number) @IsInt() @Min(1) @Max(65535)
  PORT = 3000;

  @IsUrl({ protocols: ['postgresql', 'postgres'], require_tld: false })
  DATABASE_URL!: string;

  @IsString() @MinLength(32)
  INTERNAL_API_KEY!: string;

  /** Orígenes permitidos por CORS, separados por coma */
  @IsString()
  CORS_ORIGINS = 'http://localhost:4200,http://localhost:4300';

  @IsIn(['fake', 'openai-compatible'])
  AI_PROVIDER: 'fake' | 'openai-compatible' = 'fake';

  @IsOptional() @IsString()
  AI_API_KEY?: string;

  @IsOptional() @IsUrl({ require_tld: false })
  REDIS_URL?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const env = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length) {
    const detail = errors.map((e) => `- ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`);
    throw new Error(`Configuración inválida:\n${detail.join('\n')}`);
  }
  return env;
}
```

### 3. Registrar el módulo

```ts title="app.module.ts"
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,          // ConfigService disponible en todos los módulos
      cache: true,             // no relee process.env en cada get
      validate: validateEnv,   // falla al arrancar si algo está mal
    }),
    PrismaModule,
    TownsModule,
  ],
})
export class AppModule {}
```

Por defecto lee el archivo `.env` de la carpeta desde donde se ejecuta la
app (la raíz del monorepo). Con `envFilePath` podés indicar otros.

### 4. Usarla con tipos

```ts
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';

constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

const url = this.config.get('DATABASE_URL', { infer: true }); // string, tipado
```

- El segundo genérico `true` dice "ya está validado": `get` no devuelve `undefined`.
- `infer: true` toma el tipo de la propiedad.
- `getOrThrow('X')` es la alternativa cuando no usás los genéricos.

### 5. `PrismaService` con `ConfigService`

```ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super({ adapter: new PrismaPg({ connectionString: config.get('DATABASE_URL', { infer: true }) }) });
  }
  // ...
}
```

Lo mismo con el guard de clave interna y el CORS en `main.ts`:

```ts
const config = app.get(ConfigService);
app.enableCors({ origin: config.get<string>('CORS_ORIGINS').split(',') });
await app.listen(config.get<number>('PORT'));
```

### 6. Configuración por dominio con `registerAs`

Cuando crece, se agrupa por namespace:

```ts title="config/ai.config.ts"
import { registerAs } from '@nestjs/config';

export const aiConfig = registerAs('ai', () => ({
  provider: process.env['AI_PROVIDER'] ?? 'fake',
  apiKey: process.env['AI_API_KEY'],
  dailyBudgetEur: Number(process.env['AI_DAILY_BUDGET_EUR'] ?? 2),
}));

// En el módulo de IA
imports: [ConfigModule.forFeature(aiConfig)]
constructor(@Inject(aiConfig.KEY) private readonly ai: ConfigType<typeof aiConfig>) {}
```

### 7. `.env.example` siempre al día

```bash title=".env.example"
# Copiar como .env. Nunca commitear el .env real.
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://ripopola:ripopola@localhost:5432/ripopola?schema=public"
INTERNAL_API_KEY=
CORS_ORIGINS=http://localhost:4200,http://localhost:4300
AI_PROVIDER=fake
AI_API_KEY=
REDIS_URL=redis://localhost:6379
```

### 8. Secretos en producción

En Cloud Run, los secretos **no** van como texto en la configuración del
servicio: van en **Secret Manager** y Cloud Run los inyecta como variables
de entorno (sección 14). El código no cambia.

<Alternativa title="Joi y Zod">

El curso de referencia valida con **Joi** (`validationSchema: Joi.object({...})`),
que Nest soporta directamente. **Zod** es otra opción muy usada hoy (también
infiere el tipo del esquema). En ripopola usamos class-validator para no
sumar otra librería de validación: ya la usan los DTOs.

</Alternativa>

<Resumen>

- Configuración por entorno, secretos fuera de Git.
- Validar al arrancar con `validate`: fail fast.
- `ConfigService` tipado con `infer: true`.
- `registerAs` para agrupar por dominio; Secret Manager en producción.

</Resumen>

## Preguntas de entrevista

**1. ¿Por qué la configuración va en variables de entorno?**
Para usar la misma build en todos los entornos y no guardar secretos en el
código (Twelve-Factor App).

**2. ¿Qué ganás validando la configuración al arrancar?**
Fallar rápido y con un mensaje claro, en vez de errores en runtime o comportamientos silenciosos.

**3. ¿Dónde guardarías secretos en producción?**
En un gestor de secretos (Secret Manager, Vault, AWS Secrets Manager), inyectados como variables de entorno.

**4. ¿Por qué no poner secretos en variables `NEXT_PUBLIC_*` de Next (o en `environment.ts` de Angular)?**
Porque se compilan dentro del bundle que descarga cualquier navegador.
