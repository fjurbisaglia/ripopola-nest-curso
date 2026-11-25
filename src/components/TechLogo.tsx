import React from 'react';
import { TECHS, TechId } from '@site/src/data/tech';
import styles from './Tech.module.css';

export function TechLogo({ id, size = 28 }: { id: TechId; size?: number }) {
  const tech = TECHS[id];
  if (!tech) return null; // id desconocido: no romper el build
  return (
    <svg
      role="img"
      aria-label={tech.title}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={tech.color ? undefined : styles.adaptive}
      style={tech.color ? { fill: tech.color } : undefined}
    >
      <title>{tech.title}</title>
      <path d={tech.path} />
    </svg>
  );
}

/** Fila de insignias con las tecnologías de un tema: <Tech ids={['prisma', 'postgresql']} /> */
export default function Tech({ ids }: { ids: TechId[] }) {
  return (
    <div className={styles.row}>
      {ids.filter((id) => TECHS[id]).map((id) => (
        <span key={id} className={styles.badge} title={TECHS[id].role}>
          <TechLogo id={id} size={18} />
          {TECHS[id].title}
        </span>
      ))}
    </div>
  );
}
