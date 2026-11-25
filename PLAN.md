# Índice del curso

**NestJS y backend full stack construyendo ripopola.** Sigue el orden general
del curso de referencia, pero con las tecnologías de ripopola y con lo que
hace falta para llegar a senior.

Tecnologías: Nx · NestJS 11 · Prisma 7 · PostgreSQL + PostGIS · Next.js
(web y panel; las comparaciones son con Angular, de donde venís) · Better Auth
(sesiones, Google, 2FA) · Redis (BullMQ, caché, Socket.IO, sesiones) · Docker ·
Google Cloud Run + Neon · Cloud Storage · GitHub Actions.

Leyenda: 🔨 se construye en ripopola · 💡 concepto (para entender y para la entrevista)

- Introducción: cómo usar esta guía (`docs/intro.md`)
- Repaso para entrevistas: todas las preguntas juntas (`docs/entrevistas.md`, se regenera con `python3 scripts/gen-entrevistas.py`)

## 1. Fundamentos de NestJS

Las piezas de Nest aplicadas a la API de ripopola: módulos, controladores, inyección de dependencias, validación, errores, middleware, guards, interceptors y decoradores.

- 💡 Qué es NestJS y cómo arranca la API
- 🔨 Módulos
- 🔨 Controladores
- 🔨 Providers e inyección de dependencias
- 🔨 DTOs y validación
- 🔨 Pipes
- 🔨 Manejo de errores y filtros de excepciones
- 🔨 Middleware
- 🔨 Guards
- 🔨 Interceptors
- 💡 El ciclo completo de una petición
- 🔨 Decoradores propios y metadata
- 🔨 Ciclo de vida, scopes y módulos dinámicos

## 2. Base de datos con Prisma

PostgreSQL y Prisma desde cero: modelado, migraciones, CRUD, búsquedas, paginación, SQL crudo e índices.

- 💡 Bases relacionales y el SQL que tenés que saber
- 🔨 Modelar con Prisma
- 🔨 Migraciones en el día a día
- 🔨 CRUD completo de pueblos con Prisma
- 🔨 Búsquedas y filtros
- 🔨 'Paginación: offset contra cursor'
- 🔨 Lógica antes de guardar y Client Extensions
- 🔨 SQL crudo y TypedSQL
- 🔨 Índices y rendimiento de consultas
- 💡 Prisma, TypeORM, Drizzle y Mongoose

## 3. Relaciones y transacciones

Cómo se relacionan pueblos, viviendas, usuarios y municipios, y cómo escribir varias cosas de forma segura.

- 🔨 Uno a muchos y uno a uno
- 🔨 Muchos a muchos con datos propios
- 🔨 Consultas y escrituras con relaciones
- 🔨 Transacciones
- 🔨 Borrado en cascada y borrado lógico
- 🔨 Seed y carga masiva

## 4. Datos geográficos con PostGIS

Coordenadas, GeoJSON y búsquedas por cercanía: lo que hace distinto a ripopola.

- 🔨 Coordenadas, SRID y GeoJSON
- 🔨 Leer y escribir datos geográficos con Prisma
- 🔨 Pueblos cerca de un punto y dentro del mapa

## 5. Configuración y servicios externos

Variables de entorno validadas, llamadas a otras APIs y adaptadores de IA.

- 🔨 Configuración validada con @nestjs/config
- 🔨 Llamar a APIs externas desde Nest
- 🔨 El adaptador de IA para traducciones

## 6. Autenticación y autorización

Better Auth dentro de Nest: usuarios y sesiones en PostgreSQL, login con correo y Google, 2FA, guards, roles y permisos por municipio.

- 💡 Autenticación y autorización - conceptos
- 🔨 Better Auth dentro de Nest
- 🔨 La sesión, el usuario y el guard global
- 🔨 Roles, permisos por recurso y decoradores compuestos
- 🔨 Sesiones, Redis, límites y 2FA
- 💡 Passport y JWT propio (lo que no usamos)
- 💡 Firebase Auth, Auth.js y otros proveedores

## 7. Archivos e imágenes

Subir, validar y guardar fotos de pueblos en Cloud Storage.

- 🔨 Subir y validar archivos en Nest
- 🔨 Guardar en Cloud Storage y servir con URLs firmadas
- 💡 Subida directa desde el navegador

## 8. Diseño y documentación de la API

REST bien hecho, versionado, OpenAPI y un cliente tipado para el frontend.

- 🔨 Diseño de una API REST profesional
- 🔨 Documentar la API con OpenAPI
- 🔨 Cliente tipado desde OpenAPI

## 9. Pruebas, observabilidad y seguridad

Lo que separa a un senior: pruebas en todos los niveles, logs y trazas, health checks y seguridad.

- 🔨 Pruebas unitarias
- 🔨 Pruebas de integración y e2e con PostGIS real
- 🔨 'Observabilidad: logs, trazas y métricas'
- 🔨 Health checks con Terminus
- 🔨 Seguridad de la API

## 10. Eventos y trabajos en segundo plano

Eventos internos, tareas programadas y colas: el motor de las traducciones de ripopola.

- 🔨 Eventos internos con EventEmitter
- 🔨 Tareas programadas
- 🔨 Colas con BullMQ y Redis

## 11. Rendimiento y caché

Medir antes de optimizar, caché con Redis y cuellos de botella típicos.

- 🔨 Medir y optimizar una API Nest
- 🔨 Caché con Redis

## 12. Full stack: Next.js y la API

Conectar la web y el panel en Next.js con la API de Nest: Server Components, cookies de sesión, caché y revalidación, y contratos compartidos en Nx.

- 🔨 Next.js consumiendo la API de Nest
- 🔨 Renderizado en el servidor, caché y la API
- 🔨 Contratos compartidos y límites en el monorepo Nx

## 13. Tiempo real con WebSockets

Socket.IO en Nest: notificaciones al municipio y mensajes con las personas.

- 🔨 WebSockets y gateways de Nest
- 🔨 Autenticar el socket y salas por municipio
- 🔨 Notificaciones y mensajes en ripopola
- 🔨 Escalar WebSockets con el adaptador de Redis

## 14. Producción

Del código a la nube: Docker, Neon, Cloud Run, migraciones y CI.

- 🔨 Build con Nx e imagen de Docker
- 🔨 PostgreSQL con PostGIS en Neon
- 🔨 Desplegar en Cloud Run
- 🔨 Integración continua con GitHub Actions

## 15. Arquitectura

Monolito modular, capas y DDD, CQRS, multi-tenancy, microservicios y GraphQL.

- 🔨 Monolito modular y microservicios
- 💡 Capas, arquitectura hexagonal y DDD
- 💡 CQRS y eventos con @nestjs/cqrs
- 🔨 Multi-tenancy por municipio
- 💡 GraphQL en Nest
- 🔨 Decidir y documentar la arquitectura
