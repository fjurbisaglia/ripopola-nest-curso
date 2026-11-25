import React, { ReactNode } from 'react';
import styles from './Callouts.module.css';
import { TechLogo } from './TechLogo';

/** Bloque "Si venís de Angular": compara el concepto con lo que ya sabés. */
export function Angular({ children, title = 'Si venís de Angular' }: { children: ReactNode; title?: string }) {
  return (
    <div className={`${styles.callout} ${styles.angular}`}>
      <div className={styles.title}>
        <TechLogo id="angular" size={18} /> {title}
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}

/** Bloque "En el frontend (Next.js)": cómo se usa esto del lado de la web o el panel de ripopola. */
export function Next({ children, title = 'En el frontend (Next.js)' }: { children: ReactNode; title?: string }) {
  return (
    <div className={`${styles.callout} ${styles.next}`}>
      <div className={styles.title}>
        <TechLogo id="nextdotjs" size={18} /> {title}
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}

/** Bloque "Para la entrevista": lo que tenés que poder decir en voz alta. */
export function Entrevista({ children, title = 'Para la entrevista' }: { children: ReactNode; title?: string }) {
  return (
    <div className={`${styles.callout} ${styles.interview}`}>
      <div className={styles.title}>🎤 {title}</div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}

/** Bloque "Alternativa del mercado": lo que usa el curso u otros equipos y por qué acá no. */
export function Alternativa({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className={`${styles.callout} ${styles.alt}`}>
      <div className={styles.title}>🔁 Alternativa del mercado: {title}</div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}

/** Ejercicio con solución desplegable. */
export function Ejercicio({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className={`${styles.callout} ${styles.exercise}`}>
      <div className={styles.title}>🏋️ Ejercicio: {title}</div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}

/** Resumen del tema: los puntos clave para repasar. */
export function Resumen({ children }: { children: ReactNode }) {
  return (
    <div className={`${styles.callout} ${styles.summary}`}>
      <div className={styles.title}>📌 Resumen</div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}

/**
 * Marca si el tema se construye de verdad en ripopola o queda como concepto.
 * <Estado tipo="construye">Qué queda hecho</Estado>
 */
export function Estado({ tipo, children }: { tipo: 'construye' | 'concepto'; children: ReactNode }) {
  const construye = tipo === 'construye';
  return (
    <div className={`${styles.estado} ${construye ? styles.construye : styles.concepto}`}>
      <strong>{construye ? '🏗️ Se construye en ripopola' : '📘 Solo concepto'}</strong>
      <span>{children}</span>
    </div>
  );
}
