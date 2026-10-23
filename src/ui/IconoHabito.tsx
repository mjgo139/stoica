import type { Virtud } from '@core/habitos';

/** 30 íconos de hábitos (los mismos dibujos de la versión anterior). [trazos, círculos] */
const ICONOS: Record<string, [string[], Array<[number, number, number]>]> = {
  run: [['M7 21l3.5-6 3 2.5V22M5 11.5l3.5-3 4.5 1 2 3.5 3.5 1M10.5 15l1-5.5'], [[14.5, 4.5, 2]]],
  walk: [['M10 21l2-6 3 3v3M8.5 12.5l2.5-4.5 3 1 2 3M11 8l-3 2-.5 3'], [[13, 4, 2]]],
  bike: [['M5.5 17l4-7h5l4 7M9.5 10l3 7M12 7.5l2.5 2.5'], [[5.5, 17, 3.5], [18.5, 17, 3.5], [15, 4.5, 1.6]]],
  swim: [['M2 18c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5M5 14l4-4 3 2 3-3'], [[17.5, 6.5, 2]]],
  weights: [['M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11'], []],
  yoga: [['M12 7v6M6 9l6 2 6-2M8 20l4-7 4 7M5 20h14'], [[12, 4, 2]]],
  scale: [['M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8 11a4 4 0 0 1 8 0zM12 11l1.6-2.6'], []],
  ruler: [['M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2'], []],
  heart: [['M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10zM5 12h3l1.5-2.5 2 5 1.5-2.5h6'], []],
  pill: [['M4.5 13.5l9-9a4.24 4.24 0 0 1 6 6l-9 9a4.24 4.24 0 0 1-6-6zM9 9l6 6'], []],
  tooth: [['M7.5 3C5.5 3 4 4.6 4 7c0 3 1 5 1.8 8 .7 2.7 1 6 2.7 6 1.6 0 1.7-5.5 3.5-5.5s1.9 5.5 3.5 5.5c1.7 0 2-3.3 2.7-6 .8-3 1.8-5 1.8-8 0-2.4-1.5-4-3.5-4-2 0-2.8 1-4.5 1S9.5 3 7.5 3z'], []],
  cold: [['M12 2v20M4 7l16 10M20 7L4 17M9 3l3 2 3-2M9 21l3-2 3 2'], []],
  food: [['M12 7.5c-2-2-7-1.2-7 4.8s4 9 7 7.9c3 1.1 7-1.9 7-7.9s-5-6.8-7-4.8zM12 7.5c0-2 1-3.6 3-4.5'], []],
  water: [['M7 3h10l-1.5 17a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1zM7.6 10h8.8'], []],
  coffee: [['M5 8h11v6a5 5 0 0 1-10 0zM16 10h1.5a2 2 0 0 1 0 4H16M8 3v2M11 3v2M14 3v2'], []],
  nosugar: [['M8.5 8.5h7v7h-7zM5.6 5.6l12.8 12.8'], [[12, 12, 9]]],
  plant: [['M12 21v-9M12 12C12 7 8 5 4 5c0 4 3 7 8 7zM12 14c0-4 3-6 8-6 0 4-3 6-8 6z'], []],
  home: [['M3 11l9-7 9 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM9 21v-6h6v6'], []],
  med: [['M12 8.5v5M6.5 12c2 .8 3.6 1.3 5.5 1.3s3.5-.5 5.5-1.3M4 19.5c3-2.3 5.3-3.3 8-3.3s5 1 8 3.3'], [[12, 5, 2]]],
  read: [['M6 3h11v18H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM4 17a2 2 0 0 1 2-2h11M9 7h5'], []],
  write: [['M4 20l4-1 11-11-3-3L5 16zM14 6l3 3M4 20h7'], []],
  lang: [['M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18'], [[12, 12, 9]]],
  music: [['M9 18V5l11-2v13'], [[6, 18, 3], [17, 16, 3]]],
  code: [['M4 5h16v11H4zM2 19h20M10 8.5l-2 2 2 2M14 8.5l2 2-2 2'], []],
  sleep: [['M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z'], []],
  sun: [['M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8'], [[12, 12, 4]]],
  nophone: [['M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM4 4l16 16'], []],
  nosmoke: [['M3 14h13v3H3zM19 14v3M19 8c0-2-2-2-2-4M3 3l18 18'], []],
  money: [['M15 9c-.5-1-1.5-1.5-3-1.5-2 0-3 1-3 2.2 0 3 6 1.6 6 4.6 0 1.2-1.2 2.2-3 2.2-1.6 0-2.7-.6-3.2-1.6M12 6v1.5M12 16.5V18'], [[12, 12, 9]]],
  family: [['M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M15.5 14.5c3 0 5.5 2 5.5 5.5'], [[9, 7.5, 3], [17, 8.5, 2.5]]],
};

export function Glifo({ icono, tam = 20 }: { icono: string; tam?: number }) {
  const [trazos, circulos] = ICONOS[icono] ?? ICONOS.med;
  return (
    <svg className="glifo" width={tam} height={tam} viewBox="0 0 24 24" aria-hidden="true">
      {trazos.map((d, i) => (
        <path key={i} d={d} />
      ))}
      {circulos.map(([cx, cy, r], i) => (
        <circle key={`c${i}`} cx={cx} cy={cy} r={r} />
      ))}
    </svg>
  );
}

export function IconoHabito({ icono, virtud, grande = false, tam }: { icono: string; virtud: Virtud; grande?: boolean; tam?: number }) {
  const s = tam ?? (grande ? 48 : 44);
  return (
    <span className={`hic v-${virtud}`} style={{ width: s, height: s }}>
      <Glifo icono={icono} tam={Math.round(s * 0.46)} />
    </span>
  );
}

/** Íconos de interfaz chicos (más, menos, check, cruz). */
export function Trazo({ d, tam = 18, grosor }: { d: 'mas' | 'menos' | 'check' | 'x'; tam?: number; grosor?: number }) {
  const p = { mas: 'M12 5v14M5 12h14', menos: 'M5 12h14', check: 'M5 12l4 4 10-10', x: 'M7 7l10 10M17 7L7 17' }[d];
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" aria-hidden="true" style={grosor ? { strokeWidth: grosor } : undefined}>
      <path d={p} />
    </svg>
  );
}
