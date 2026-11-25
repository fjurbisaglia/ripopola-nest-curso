---
title: El adaptador de IA para traducciones
sidebar_label: Adaptador de IA
sidebar_position: 3
description: Cómo integrar un proveedor de IA sin atarse a él - interfaz propia, adaptador, salida validada, hash de campos, cuotas y presupuesto, siguiendo la decisión D-05 de ripopola.
---

# El adaptador de IA para traducciones

<Tech ids={['nestjs', 'postgresql']} />

<Estado tipo="construye">El `TranslationProvider` real: traduce los textos que escribe el municipio, valida el resultado y respeta un presupuesto diario. Lo ejecuta la cola de la sección 10.</Estado>

## Las reglas de ripopola para la IA

La arquitectura de ripopola fija reglas claras (D-05 y D-11):

1. **Una interfaz propia por capacidad** (`TranslationProvider`), un adaptador por proveedor. El SDK no sale del adaptador.
2. **Nunca en la petición del usuario**: trabajos en segundo plano, persistentes, idempotentes y con reintentos acotados.
3. **Solo se retraduce lo que cambió** (hash del original).
4. **Validar la salida**: idioma, números y nombres propios intactos.
5. **Cuotas y presupuesto**, con botón de parada.
6. Las correcciones humanas no se pisan.

## En ripopola

### 1. La interfaz

```ts title="ai/translation.provider.ts"
export interface TranslateRequest {
  text: string;
  from: string; // 'es'
  to: string;   // 'it'
  /** Ayuda al modelo: "descripción de un pueblo", "título de una vivienda" */
  context?: string;
}

export interface TranslationProvider {
  translate(req: TranslateRequest): Promise<{ text: string; inputTokens: number; outputTokens: number }>;
}

export const TRANSLATION_PROVIDER = Symbol('TRANSLATION_PROVIDER');
```

### 2. Un adaptador "compatible con OpenAI"

Muchos proveedores (y modelos baratos) exponen una API con el formato de
*chat completions*. Un solo adaptador configurable por URL sirve para varios:

```ts title="ai/openai-compatible-translation.provider.ts"
import { Injectable } from '@nestjs/common';
import { TranslateRequest, TranslationProvider } from './translation.provider';

interface Options { baseUrl: string; apiKey: string; model: string }

@Injectable()
export class OpenAiCompatibleTranslationProvider implements TranslationProvider {
  constructor(private readonly options: Options) {}

  async translate({ text, from, to, context }: TranslateRequest) {
    const res = await fetch(`${this.options.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.options.apiKey}` },
      body: JSON.stringify({
        model: this.options.model,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content:
              `Traducí del idioma "${from}" al "${to}" un texto de ${context ?? 'un sitio de turismo rural'}. ` +
              'Devolvé solo la traducción. No agregues información. Mantené nombres propios, cifras y URLs.',
          },
          { role: 'user', content: text },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Proveedor de IA: HTTP ${res.status}`);
    const json = await res.json();
    return {
      text: json.choices[0].message.content.trim(),
      inputTokens: json.usage?.prompt_tokens ?? 0,
      outputTokens: json.usage?.completion_tokens ?? 0,
    };
  }
}
```

Elegir el proveedor y el modelo concreto es una decisión de producto (costo
contra calidad) que se toma cuando toque; el código no cambia.

### 3. Validar la salida

Un modelo puede "mejorar" el texto, cambiar un número o dejarlo en el idioma original. Validaciones baratas:

```ts title="ai/translation-guard.ts"
export function checkTranslation(original: string, translated: string): string[] {
  const problems: string[] = [];
  const numbers = (s: string) => (s.match(/\d+([.,]\d+)?/g) ?? []).sort().join('|');
  if (numbers(original) !== numbers(translated)) problems.push('Los números no coinciden');
  if (translated.length > original.length * 2 + 50) problems.push('La traducción es sospechosamente larga');
  if (translated.trim() === original.trim()) problems.push('No se tradujo');
  return problems;
}
```

Si hay problemas, la traducción **no se publica**: queda marcada para revisión y se muestra el original.

### 4. Solo lo que cambió: hash por campo

```prisma
model Translation {
  id          String   @id @default(uuid(7)) @db.Uuid
  entityType  String   @map("entity_type")   // 'town'
  entityId    String   @map("entity_id") @db.Uuid
  field       String                          // 'description'
  locale      String   @db.VarChar(5)         // 'it'
  sourceHash  String   @map("source_hash")    // sha256 del original
  text        String
  status      String                          // 'machine' | 'human' | 'needs_review'
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@unique([entityType, entityId, field, locale])
  @@map("translations")
}
```

```ts
import { createHash } from 'node:crypto';

const hash = createHash('sha256').update(original).digest('hex');
const existing = await prisma.translation.findUnique({ where: { entityType_entityId_field_locale: key } });

if (existing?.status === 'human') return;          // no pisar correcciones humanas
if (existing?.sourceHash === hash) return;         // no cambió: no gastar
// ...traducir y hacer upsert con el nuevo hash
```

### 5. Presupuesto

Guardá el consumo (tokens y costo estimado) por día en una tabla, y antes de
cada trabajo comprobá el límite (`AI_DAILY_BUDGET_EUR`). Superado, los
trabajos **esperan al día siguiente** en vez de fallar. Y una variable
`AI_ENABLED=false` funciona como botón de parada.

<Entrevista>

"¿Cómo integrarías un LLM en un backend?" es una pregunta cada vez más común.
Lo que suma puntos: interfaz propia y adaptadores (no atarse al proveedor),
trabajos asíncronos con cola, idempotencia, validación de la salida,
observabilidad del costo, límites de gasto y un humano en el circuito para lo sensible.

</Entrevista>

<Resumen>

- Interfaz por capacidad, adaptador por proveedor.
- Validar lo que devuelve el modelo; si falla, original y revisión humana.
- Hash del original para no retraducir; nunca pisar correcciones humanas.
- Presupuesto diario y botón de parada.

</Resumen>

## Preguntas de entrevista

**1. ¿Cómo evitás quedar atado a un proveedor de IA?**
Con una interfaz propia por capacidad y un adaptador por proveedor elegido por configuración.

**2. ¿Por qué no traducir en la misma petición en que el municipio guarda?**
Porque es lento, puede fallar y tiene costo; se encola y se procesa en segundo plano con reintentos.

**3. ¿Cómo evitás traducir dos veces lo mismo?**
Guardando un hash del texto original con cada traducción y comparándolo antes de llamar al modelo.

**4. ¿Cómo controlás el gasto?**
Registrando consumo por trabajo, con un límite diario que pausa la cola y un interruptor para apagar la IA.
