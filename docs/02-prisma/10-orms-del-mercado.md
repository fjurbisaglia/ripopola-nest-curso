---
title: Prisma, TypeORM, Drizzle y Mongoose
sidebar_label: ORMs del mercado
sidebar_position: 10
description: Comparación de los ORM y ODM más usados con NestJS, para saber explicar por qué ripopola eligió Prisma.
---

# Prisma, TypeORM, Drizzle y Mongoose

<Tech ids={['prisma', 'nestjs']} />

<Estado tipo="concepto">Comparación para entrevistas. El curso de referencia usa TypeORM y MongoDB; ripopola usa Prisma con PostgreSQL.</Estado>

## La tabla

| | Prisma | TypeORM | Drizzle | Mongoose |
| --- | --- | --- | --- | --- |
| Base | SQL (y MongoDB) | SQL | SQL | MongoDB |
| Fuente de verdad | `schema.prisma` | Clases con decoradores | Esquema en TypeScript | `Schema` de Mongoose |
| Tipos | Generados, muy precisos | Parciales (las relaciones pueden ser `undefined` sin avisar) | Inferidos, muy precisos | Buenos con TS |
| Migraciones | SQL generado y editable | TS generado; `synchronize` peligroso | SQL generado (drizzle-kit) | No aplica (sin esquema en la base) |
| SQL a mano | `$queryRaw`, TypedSQL | QueryBuilder, `query()` | Es casi SQL | Aggregation pipeline |
| Integración con Nest | Provider propio (`PrismaService`) | `@nestjs/typeorm` oficial | Provider propio | `@nestjs/mongoose` oficial |
| Popularidad con Nest | Muy alta | Muy alta (el clásico) | Creciendo rápido | Alta |

## Por qué Prisma en ripopola

- **Tipos generados** que siguen al schema: si cambia una columna, el compilador avisa.
- **Migraciones en SQL** revisables y editables (necesarias para PostGIS).
- **Un solo archivo** para entender el modelo.
- Muy usado, mantenido por una empresa y con buena documentación (criterio D-12).
- Contra: PostGIS y algunas funciones del motor requieren SQL crudo.

## Lo que tenés que saber de TypeORM (lo va a preguntar alguien)

```ts
@Entity('towns')
export class Town {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) slug: string;
  @Column('text', { array: true, default: [] }) tags: string[];
  @OneToMany(() => Media, (m) => m.town, { cascade: true }) photos: Media[];
  @BeforeInsert() makeSlug() { this.slug ??= slugify(this.officialName); }
}

// En el módulo
imports: [TypeOrmModule.forFeature([Town])]

// En el servicio
constructor(@InjectRepository(Town) private readonly repo: Repository<Town>) {}
```

Conceptos propios de TypeORM: **Active Record vs Data Mapper**, `Repository`,
`QueryRunner` para transacciones manuales, relaciones `eager`/`lazy`,
`cascade`, y `synchronize` (nunca en producción).

## Lo que tenés que saber de MongoDB con Nest

```ts
@Schema()
export class Town {
  @Prop({ unique: true, index: true }) slug: string;
}
export const TownSchema = SchemaFactory.createForClass(Town);

imports: [MongooseModule.forFeature([{ name: Town.name, schema: TownSchema }])]
constructor(@InjectModel(Town.name) private readonly model: Model<Town>) {}
```

Ids `ObjectId` (se validan con un pipe propio, el `ParseMongoIdPipe` del
curso), documentos embebidos en vez de joins, y sin integridad referencial.

<Resumen>

- Prisma: schema-first, tipos generados, migraciones SQL.
- TypeORM: entidades con decoradores, repositorios, el más clásico con Nest.
- Drizzle: liviano y cercano al SQL.
- Mongoose: documentos, para datos poco relacionales.

</Resumen>

## Preguntas de entrevista

**1. ¿Por qué elegiste Prisma y no TypeORM?**
Por los tipos generados que siguen al schema, las migraciones en SQL
editables y la claridad de un único schema. TypeORM es más flexible con
patrones como Active Record, pero sus tipos son menos estrictos.

**2. ¿Qué es `synchronize` en TypeORM y por qué es peligroso?**
Sincroniza el esquema con las entidades al arrancar, sin migraciones; en
producción puede borrar columnas con datos.

**3. ¿Active Record o Data Mapper?**
Active Record: la entidad se guarda sola (`town.save()`). Data Mapper: un
repositorio separado guarda entidades planas. Data Mapper separa mejor
dominio y persistencia y se prueba más fácil.
