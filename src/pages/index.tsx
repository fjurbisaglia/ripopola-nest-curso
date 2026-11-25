import React from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import { TECHS, TechId } from '@site/src/data/tech';
import { TechLogo } from '@site/src/components/TechLogo';
import styles from './index.module.css';

const STACK: TechId[] = [
  'nestjs', 'typescript', 'nodedotjs', 'prisma', 'postgresql', 'betterauth',
  'socketdotio', 'nextdotjs', 'nx', 'docker', 'googlecloud', 'neon',
  'openapiinitiative', 'vitest', 'githubactions', 'maplibre',
];

const SECTIONS = [
  { n: 1, title: 'Fundamentos de NestJS', text: 'Módulos, controladores, inyección de dependencias, validación, errores, guards e interceptors.', to: '/curso/fundamentos' },
  { n: 2, title: 'Prisma y PostgreSQL', text: 'Modelado, migraciones, CRUD, paginación, SQL crudo e índices.', to: '/curso/prisma' },
  { n: 3, title: 'Relaciones y transacciones', text: 'Uno a muchos, muchos a muchos, transacciones, cascadas y seed.', to: '/curso/relaciones' },
  { n: 4, title: 'Datos geográficos con PostGIS', text: 'Coordenadas, GeoJSON y pueblos cerca de un punto.', to: '/curso/postgis' },
  { n: 5, title: 'Configuración y servicios externos', text: 'Variables validadas, llamadas HTTP y adaptadores de IA.', to: '/curso/configuracion' },
  { n: 6, title: 'Autenticación y autorización', text: 'Better Auth: sesiones, Google, 2FA, roles y permisos por municipio.', to: '/curso/auth' },
  { n: 7, title: 'Archivos e imágenes', text: 'Subidas validadas, Cloud Storage y URLs firmadas.', to: '/curso/archivos' },
  { n: 8, title: 'Diseño y documentación de la API', text: 'REST, versionado, errores estándar, OpenAPI y cliente tipado.', to: '/curso/api' },
  { n: 9, title: 'Pruebas, observabilidad y seguridad', text: 'Unitarias, integración y e2e, logs, trazas, health checks y OWASP.', to: '/curso/calidad' },
  { n: 10, title: 'Eventos y segundo plano', text: 'Eventos, tareas programadas, cola en PostgreSQL y BullMQ.', to: '/curso/segundo-plano' },
  { n: 11, title: 'Rendimiento y caché', text: 'Medir, cachear con Redis y evitar los cuellos de botella típicos.', to: '/curso/rendimiento' },
  { n: 12, title: 'Full stack con Next.js', text: 'Server Components contra la API, cookies de sesión, caché y contratos compartidos.', to: '/curso/fullstack' },
  { n: 13, title: 'Tiempo real con WebSockets', text: 'Socket.IO, salas por municipio, notificaciones y mensajes.', to: '/curso/websockets' },
  { n: 14, title: 'Producción', text: 'Docker, Neon, Cloud Run, migraciones y CI.', to: '/curso/produccion' },
  { n: 15, title: 'Arquitectura', text: 'Monolito modular, DDD, CQRS, microservicios y GraphQL.', to: '/curso/arquitectura' },
];

export default function Home() {
  return (
    <Layout title="Inicio" description="Curso de NestJS y backend full stack construyendo ripopola">
      <header className={styles.hero}>
        <div className="container">
          <div className={styles.heroLogo}>
            <TechLogo id="nestjs" size={72} />
          </div>
          <h1 className={styles.heroTitle}>NestJS con ripopola</h1>
          <p className={styles.heroSubtitle}>
            De senior de Angular a senior de backend, construyendo un producto real:
            un marketplace para mudarse a un pueblo.
          </p>
          <div className={styles.buttons}>
            <Link className="button button--secondary button--lg" to="/curso/">
              Empezar el curso
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className={styles.section}>
          <div className="container">
            <h2>El stack que vas a usar</h2>
            <div className={styles.stack}>
              {STACK.map((id) => (
                <div key={id} className={styles.tech}>
                  <TechLogo id={id} size={40} />
                  <strong>{TECHS[id].title}</strong>
                  <span>{TECHS[id].role}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.alt}`}>
          <div className="container">
            <h2>Cómo está armado cada tema</h2>
            <div className={styles.how}>
              <div><h3>🧠 Concepto</h3><p>Qué es y qué problema resuelve, siguiendo la documentación oficial.</p></div>
              <div><h3>🅰️ Desde Angular</h3><p>Lo comparamos con lo que ya sabés: módulos, DI, guards, interceptors, RxJS.</p></div>
              <div><h3>🛠️ En ripopola</h3><p>Paso a paso con el código real del proyecto.</p></div>
              <div><h3>🎤 Entrevista</h3><p>Preguntas con respuestas cortas para decir en voz alta.</p></div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className="container">
            <h2>Temario</h2>
            <div className={styles.sections}>
              {SECTIONS.map((s) => (
                <Link key={s.n} to={s.to} className={styles.card}>
                  <span className={styles.num}>{s.n}</span>
                  <div>
                    <strong>{s.title}</strong>
                    <p>{s.text}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
