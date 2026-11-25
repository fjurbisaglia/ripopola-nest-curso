# NestJS con ripopola

Curso propio de **NestJS y backend full stack**, construyendo
ripopola (un marketplace para mudarse a un pueblo) tema por tema.
Pensado para pasar de senior de Angular a senior de backend y para preparar entrevistas.

Hecho con [Docusaurus](https://docusaurus.io/) 3.

## Levantarlo

Requisitos: Node 20 o superior (el repo usa la 26, ver `.nvmrc`) y pnpm.

```bash
pnpm install
pnpm start        # http://localhost:3000, se recarga al guardar
```

Otros comandos:

```bash
pnpm build        # genera el sitio estático en build/
pnpm serve        # sirve lo que generó build
pnpm typecheck    # revisa los tipos de los componentes
```

## Estructura

```
docs/                     El curso: una carpeta por sección, un .md por tema
  intro.md                Cómo usar el curso
  01-fundamentos/         Cada carpeta tiene _category_.json (nombre y orden)
  ...
  15-arquitectura/
  entrevistas.md          Repaso: todas las preguntas de entrevista (generado)
src/
  pages/index.tsx         Página de inicio
  components/             Logos del stack y bloques de estudio
  theme/MDXComponents.tsx Componentes disponibles en todos los .md sin importarlos
  data/tech.ts            Logos (Simple Icons, CC0) y rol de cada tecnología
  css/custom.css          Tema con los colores de NestJS
static/img/               Favicon
PLAN.md                   Índice del curso y estado de cada tema
scripts/gen-entrevistas.py Regenera docs/entrevistas.md
```

Si agregás o cambiás preguntas de entrevista en algún tema, corré
`python3 scripts/gen-entrevistas.py` para actualizar el repaso.

## Componentes para escribir temas

Se usan directamente en cualquier `.md`:

| Componente | Para qué |
| --- | --- |
| `<Tech ids={['nestjs', 'prisma']} />` | Insignias con las tecnologías del tema |
| `<Estado tipo="construye">…</Estado>` | Si el tema se construye en ripopola o es solo concepto |
| `<Angular>…</Angular>` | Comparación con Angular (de donde venís) |
| `<Next>…</Next>` | Cómo se usa del lado del frontend de ripopola (Next.js) |
| `<Entrevista>…</Entrevista>` | Lo que tenés que poder decir en una entrevista |
| `<Alternativa title="TypeORM">…</Alternativa>` | Otras opciones del mercado |
| `<Ejercicio title="…">…</Ejercicio>` | Ejercicio, con la solución en `<details>` |
| `<Resumen>…</Resumen>` | Puntos clave para repasar |
| `:::tip`, `:::info`, `:::warning`, `:::danger` | Avisos de Docusaurus |
| Bloques ` ```mermaid ` | Diagramas |

Ojo con MDX: fuera de los bloques de código, `<` y las llaves se interpretan
como JSX. Ponelos entre comillas invertidas.

## Fuentes

La documentación oficial de [NestJS](https://docs.nestjs.com),
[Prisma](https://www.prisma.io/docs), [PostGIS](https://postgis.net/documentation/)
y [Better Auth](https://www.better-auth.com/docs). Los logos son de
[Simple Icons](https://simpleicons.org) (CC0); las marcas son de sus dueños.
