---
title: Subir y validar archivos en Nest
sidebar_label: Subir archivos
sidebar_position: 1
description: multipart/form-data, FileInterceptor con Multer, ParseFilePipe, validación real del tipo de archivo y límites, con las fotos de los pueblos de ripopola.
---

# Subir y validar archivos en Nest

<Tech ids={['nestjs', 'express']} />

<Estado tipo="construye">Un endpoint para que el municipio suba fotos de su pueblo, con validación de tamaño y tipo real de imagen.</Estado>

## Concepto

Los archivos no viajan en JSON: se mandan como **`multipart/form-data`**, un
formato que divide el cuerpo en partes (archivos y campos de texto). Nest usa
**Multer** (un middleware de Express) para leerlo.

- `FileInterceptor('file')`: un archivo en el campo `file`.
- `FilesInterceptor('files', 10)`: varios en el mismo campo.
- `@UploadedFile()` / `@UploadedFiles()`: lo inyectan en el método.
- `ParseFilePipe`: valida tamaño, tipo y obligatoriedad.

Por defecto Multer guarda el archivo **en memoria** (`file.buffer`). Para
archivos chicos como fotos está bien; para videos o archivos enormes se usa
*streaming* o, mejor, la subida directa a la nube (tema 3).

## En ripopola: fotos del pueblo

### 1. Tipos

```bash
pnpm add -D -E @types/multer
```

### 2. El endpoint

```ts title="towns/media/town-media.controller.ts"
import {
  Controller, FileTypeValidator, MaxFileSizeValidator, Param, ParseFilePipe,
  ParseUUIDPipe, Post, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

@Controller('towns/:townId/photos')
export class TownMediaController {
  constructor(private readonly media: TownMediaService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES, files: 1 } }))
  upload(
    @CurrentUser() user: AuthUser,
    @Param('townId', ParseUUIDPipe) townId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_BYTES }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.media.upload(user, townId, file);
  }
}
```

Qué mirar:

- `limits` en Multer corta la subida **mientras llega** si supera el tamaño:
  no llega a memoria un archivo de 2 GB.
- `ParseFilePipe` es un pipe como cualquier otro: si falla, 400 (o 422 con `errorHttpStatusCode`).
- La autorización (¿es de este pueblo?) va en el servicio con `TownPolicy`, como siempre.

### 3. No confíes en el tipo que dice el cliente

`file.mimetype` lo manda el navegador: se puede falsificar (un `.exe`
renombrado a `.jpg`). En versiones recientes de Nest, `FileTypeValidator`
mira los **magic numbers** (los primeros bytes del archivo), que es lo
correcto. Para ir más lejos, se **reprocesa la imagen**: abrirla y volver a
codificarla elimina cualquier contenido extraño y los metadatos.

```bash
pnpm add -E sharp
```

```ts title="towns/media/image-processing.ts"
import sharp from 'sharp';

export async function normalizeImage(input: Buffer) {
  const image = sharp(input, { limitInputPixels: 40_000_000 }); // evita "bombas" de píxeles
  const meta = await image.metadata();
  if (!meta.width || !meta.height) throw new Error('No es una imagen válida');

  const output = await image
    .rotate()                       // respeta la orientación de la cámara
    .resize({ width: 2000, withoutEnlargement: true })
    .webp({ quality: 82 })          // un solo formato, liviano
    .toBuffer();                    // sin metadatos EXIF (GPS del teléfono incluido)

  return { buffer: output, contentType: 'image/webp', width: meta.width, height: meta.height };
}
```

:::warning EXIF y privacidad
Las fotos de los teléfonos guardan las coordenadas GPS de donde se tomaron.
Reprocesar con `sharp` sin `withMetadata()` las borra. Es un detalle de
privacidad que suma puntos en una entrevista.
:::

:::info sharp en pnpm
`sharp` usa binarios nativos y tiene script de instalación: pnpm te va a
pedir aprobarlo en `allowBuilds`, como pasó con Prisma.
:::

### 4. Probar con curl

```bash
curl -i -X POST http://localhost:3000/api/towns/$TOWN_ID/photos \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./albarracin.jpg"
```

`-F` arma el `multipart/form-data`.

<Next>

En el panel se arma con `FormData`, desde un Client Component:

```ts
const body = new FormData();
body.append('file', file); // el File del <input type="file">
await fetch(`${apiUrl}/api/v1/towns/${id}/photos`, { method: 'POST', body, credentials: 'include' });
```

No pongas `Content-Type` a mano: el navegador lo completa con el *boundary*.
`fetch` no informa el progreso de subida; para una barra de progreso, usá
`XMLHttpRequest` (lo que hacía `reportProgress` en el `HttpClient` de Angular)
o la subida directa al bucket del tema 3.

</Next>

<Resumen>

- Archivos por `multipart/form-data`; Multer los lee con `FileInterceptor`.
- Límites en Multer (corta en el acto) + `ParseFilePipe`.
- No confiar en el mimetype: magic numbers y reprocesar con sharp.
- Borrar EXIF por privacidad.

</Resumen>

## Preguntas de entrevista

**1. ¿Cómo se envía un archivo por HTTP?**
Con `multipart/form-data`, que permite mezclar archivos y campos en partes separadas del cuerpo.

**2. ¿Cómo validás que un archivo es realmente una imagen?**
Leyendo sus magic numbers, no la extensión ni el mimetype del cliente, e idealmente reprocesándola.

**3. ¿Qué riesgos tiene permitir subidas?**
Archivos enormes (DoS), contenido malicioso disfrazado, bombas de descompresión, metadatos con datos personales y llenar el disco.

**4. ¿Memoria o disco para los archivos subidos?**
Memoria para archivos chicos y limitados; para grandes, streaming o subida directa al almacenamiento.
