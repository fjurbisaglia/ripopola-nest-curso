---
title: Guardar en Cloud Storage y servir con URLs firmadas
sidebar_label: Cloud Storage
sidebar_position: 2
description: Por qué no guardar archivos en el disco del servidor, Google Cloud Storage desde Nest, claves de objeto, URLs públicas contra firmadas y un adaptador de almacenamiento.
---

# Guardar en Cloud Storage y servir con URLs firmadas

<Tech ids={['googlecloud', 'nestjs', 'docker']} />

<Estado tipo="construye">Un `StorageService` (interfaz + adaptador de Google Cloud Storage) donde van las fotos de los pueblos, y la URL de cada foto en la ficha.</Estado>

## ¿Por qué no en el disco del servidor?

El curso de referencia guarda las imágenes en una carpeta del servidor y las
sirve con un endpoint. En ripopola **no**, porque:

- **Cloud Run es efímero**: el disco se pierde al reiniciar o escalar.
- **Varias instancias**: la foto subida a una instancia no existe en las otras.
- **Rendimiento**: servir archivos ocupa a la API; un almacenamiento de objetos con CDN lo hace mejor y más barato.

La solución estándar es un **almacenamiento de objetos**: Google Cloud
Storage (GCS), AWS S3, Azure Blob o Cloudflare R2. Guardás en la base solo
la **clave** del objeto (`towns/<id>/<uuid>.webp`), nunca el archivo.

## Público o privado

| | Bucket público + CDN | Bucket privado + URL firmada |
| --- | --- | --- |
| URL | Fija y cacheable | Temporal (minutos u horas) |
| Para | Fotos de pueblos publicados | Documentos privados, borradores |
| Costo y velocidad | Lo mejor | Hay que generarla en cada respuesta |

Las fotos de los pueblos son públicas: bucket público (o detrás de Cloud CDN).
Para documentos que sube un municipio (por ejemplo, un convenio), privado con URL firmada.

## En ripopola

### 1. La interfaz

```ts title="storage/storage.service.ts"
export abstract class StorageService {
  abstract put(key: string, data: Buffer, contentType: string): Promise<void>;
  abstract delete(key: string): Promise<void>;
  abstract publicUrl(key: string): string;
  abstract signedUrl(key: string, expiresInSeconds: number): Promise<string>;
}
```

### 2. El adaptador de GCS

```bash
pnpm add -E @google-cloud/storage
```

```ts title="storage/gcs-storage.service.ts"
import { Storage } from '@google-cloud/storage';

@Injectable()
export class GcsStorageService extends StorageService {
  private readonly bucket;

  constructor(config: ConfigService) {
    super();
    // En Cloud Run usa la cuenta de servicio; en local, `gcloud auth application-default login`
    this.bucket = new Storage().bucket(config.getOrThrow('GCS_BUCKET'));
  }

  async put(key: string, data: Buffer, contentType: string) {
    await this.bucket.file(key).save(data, {
      contentType,
      resumable: false,
      metadata: { cacheControl: 'public, max-age=31536000, immutable' },
    });
  }

  async delete(key: string) {
    await this.bucket.file(key).delete({ ignoreNotFound: true });
  }

  publicUrl(key: string) {
    return `https://storage.googleapis.com/${this.bucket.name}/${encodeURI(key)}`;
  }

  async signedUrl(key: string, expiresInSeconds: number) {
    const [url] = await this.bucket.file(key).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresInSeconds * 1000,
    });
    return url;
  }
}
```

Qué mirar:

- `cacheControl ... immutable`: como cada foto tiene una clave nueva (un UUID),
  nunca cambia, y el navegador y la CDN la cachean para siempre.
- `ignoreNotFound`: borrar es idempotente.

### 3. Un adaptador local para desarrollo

Para no depender de Google en local, un adaptador que guarda en una carpeta
y sirve con `@nestjs/serve-static`, o mejor, un emulador de GCS en Docker
(`fake-gcs-server`). El código de negocio no cambia: solo el provider.

```ts
{
  provide: StorageService,
  inject: [ConfigService],
  useFactory: (config: ConfigService) =>
    config.get('STORAGE_DRIVER') === 'local' ? new LocalStorageService(config) : new GcsStorageService(config),
}
```

### 4. El servicio de fotos

```ts title="towns/media/town-media.service.ts"
async upload(user: AuthUser, townId: string, file: Express.Multer.File) {
  await this.policy.assert(user, 'edit', townId);
  const image = await normalizeImage(file.buffer);
  const key = `towns/${townId}/${randomUUID()}.webp`;

  await this.storage.put(key, image.buffer, image.contentType);
  try {
    const count = await this.prisma.media.count({ where: { townId } });
    return await this.prisma.media.create({ data: { townId, storageKey: key, position: count } });
  } catch (err) {
    await this.storage.delete(key); // no dejar archivos huérfanos
    throw err;
  }
}
```

Fijate en el orden: primero el archivo, después la fila. Si falla la base,
se borra el archivo. No hay transacción entre GCS y PostgreSQL, así que hay
que compensar a mano. (Para borrar al revés, un evento de "foto borrada" lo
hace en segundo plano: sección 10.)

### 5. Las URLs en la respuesta

En el tema de consultas con relaciones dejamos `toTownDetail(row, mediaUrl)`.
Ahora `mediaUrl` es `(key) => this.storage.publicUrl(key)`.

<Alternativa title="S3, Cloudinary y el filesystem">

**AWS S3** es el estándar de facto (R2 de Cloudflare y MinIO usan su misma
API). **Cloudinary** o **imgix** además transforman imágenes al vuelo
(tamaños, formatos) a cambio de un costo. Guardar en el **filesystem** con
`@nestjs/serve-static`, como en el curso, solo sirve con un único servidor
con disco persistente.

</Alternativa>

<Resumen>

- Nunca archivos en el disco de un contenedor: almacenamiento de objetos.
- En la base, solo la clave del objeto.
- Públicas con caché larga para fotos; firmadas para lo privado.
- Sin transacción entre servicios: compensar si falla un paso.

</Resumen>

## Preguntas de entrevista

**1. ¿Por qué no guardar archivos subidos en el servidor?**
Porque los contenedores son efímeros y escalan horizontalmente: el archivo se pierde o no está en las otras instancias.

**2. ¿Qué es una URL firmada?**
Una URL temporal que incluye una firma criptográfica y da acceso a un objeto privado sin credenciales, hasta que expira.

**3. ¿Cómo mantenés consistentes la base y el almacenamiento si no hay transacción?**
Con un orden de operaciones y acciones compensatorias (borrar el archivo si falla la base), o con procesos que limpian huérfanos.
