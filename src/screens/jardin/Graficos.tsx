/**
 * Gráficos del jardín dibujados en código (SVG): medallas de laurel y plagas de las pasiones.
 * Más adelante se pueden cambiar por imágenes pintadas sin tocar la lógica.
 */
import { useId } from 'react';

const METAL: Record<string, [string, string, string]> = {
  Bronce: ['#f0b98a', '#b87333', '#6e3f17'],
  Plata: ['#ffffff', '#c3c9cf', '#6f7780'],
  Oro: ['#fff2b0', '#e1b12c', '#8a6110'],
};

/** Medalla con corona de laurel, cinta y el número de días en romano. */
export function Medalla({ tipo, tam = 34, dias }: { tipo: 'Bronce' | 'Plata' | 'Oro'; tam?: number; dias: number }) {
  const id = useId().replace(/:/g, '');
  const [c1, c2, c3] = METAL[tipo];
  const romano = dias >= 100 ? 'C' : dias >= 66 ? 'LXVI' : 'XXX';
  /** Hoja de laurel en el ángulo `ang` (grados, 0 = derecha, 90 = abajo), inclinada hacia arriba. */
  const hoja = (ang: number, i: number) => {
    const r = 15.8;
    const a = (ang * Math.PI) / 180;
    const x = 24 + Math.cos(a) * r;
    const y = 30 + Math.sin(a) * r;
    const izquierda = Math.cos(a) < 0;
    const rot = ang + 90 + (izquierda ? 28 : -28);
    return <ellipse key={i} cx={x} cy={y} rx={2.2} ry={4.6} transform={`rotate(${rot} ${x} ${y})`} fill={`url(#h${id})`} stroke="#3c5a1c" strokeWidth={0.4} />;
  };
  return (
    <svg width={tam} height={tam * 1.25} viewBox="0 0 48 60" aria-hidden style={{ overflow: 'visible', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.45))' }}>
      <defs>
        <radialGradient id={`m${id}`} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor={c1} />
          <stop offset=".55" stopColor={c2} />
          <stop offset="1" stopColor={c3} />
        </radialGradient>
        <linearGradient id={`h${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9cc25a" />
          <stop offset="1" stopColor="#4d7a22" />
        </linearGradient>
      </defs>
      {/* Cinta */}
      <path d="M17 0 L24 13 L31 0 Z" fill="#8f1f1f" />
      <path d="M17 0 L21 0 L26 11 L24 13 Z" fill="#c23a2c" />
      <path d="M27 0 L31 0 L24 13 L22 11 Z" fill="#b12f25" />
      {/* Laurel */}
      {[100, 122, 144, 166, 188, 210, 232].map((a, i) => hoja(a, i))}
      {[80, 58, 36, 14, -8, -30, -52].map((a, i) => hoja(a, 10 + i))}
      {/* Disco */}
      <circle cx="24" cy="30" r="12.5" fill={`url(#m${id})`} stroke={c3} strokeWidth="1" />
      <circle cx="24" cy="30" r="10" fill="none" stroke={c1} strokeOpacity=".7" strokeWidth=".8" />
      <text x="24" y="33.4" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="700" fontSize={romano.length > 2 ? 7 : 10} fill={c3}>
        {romano}
      </text>
    </svg>
  );
}

/** Un bichito de una pasión. `aleteo` en segundos. */
export function Bicho({ pasion, tam = 22 }: { pasion: 'ira' | 'miedo' | 'envidia' | 'deseo'; tam?: number }) {
  const id = useId().replace(/:/g, '');
  const ala = (d: string, fill: string, lado: 'izq' | 'der') => (
    <path d={d} fill={fill} className={`bicho-ala bicho-${lado}`} style={{ transformOrigin: '12px 12px' }} />
  );
  if (pasion === 'ira')
    // Avispa: cuerpo a rayas amarillo y rojo, alas transparentes
    return (
      <svg width={tam} height={tam} viewBox="0 0 24 24" aria-hidden style={{ overflow: 'visible' }}>
        {ala('M12 11 C 6 3, 1 6, 4 10 C 6 12, 10 12, 12 11 Z', 'rgba(230,240,255,.75)', 'izq')}
        {ala('M12 11 C 18 3, 23 6, 20 10 C 18 12, 14 12, 12 11 Z', 'rgba(230,240,255,.75)', 'der')}
        <defs>
          <linearGradient id={`a${id}`} x1="0" y1="0" x2="0" y2="1">
            {[0, 0.2, 0.2, 0.4, 0.4, 0.6, 0.6, 0.8, 0.8, 1].map((o, i) => (
              <stop key={i} offset={o} stopColor={Math.floor(i / 2) % 2 ? '#2a1208' : '#f2b21b'} />
            ))}
          </linearGradient>
        </defs>
        <ellipse cx="12" cy="16" rx="3.6" ry="6" fill={`url(#a${id})`} stroke="#5a1a0a" strokeWidth=".5" />
        <circle cx="12" cy="9" r="2.8" fill="#c8412f" />
        <circle cx="11" cy="8.5" r=".7" fill="#fff" />
        <circle cx="13" cy="8.5" r=".7" fill="#fff" />
        <path d="M12 22 L12 23.6" stroke="#2a1208" strokeWidth=".8" />
      </svg>
    );
  if (pasion === 'miedo')
    // Polilla gris con ojos en las alas
    return (
      <svg width={tam} height={tam} viewBox="0 0 24 24" aria-hidden style={{ overflow: 'visible' }}>
        {ala('M12 12 C 5 2, -1 8, 3 15 C 6 19, 10 16, 12 13 Z', '#8d8f96', 'izq')}
        {ala('M12 12 C 19 2, 25 8, 21 15 C 18 19, 14 16, 12 13 Z', '#8d8f96', 'der')}
        <circle cx="6.5" cy="10.5" r="2" fill="#3b3d44" className="bicho-ala bicho-izq" style={{ transformOrigin: '12px 12px' }} />
        <circle cx="17.5" cy="10.5" r="2" fill="#3b3d44" className="bicho-ala bicho-der" style={{ transformOrigin: '12px 12px' }} />
        <ellipse cx="12" cy="13" rx="1.6" ry="5.5" fill="#55575e" />
        <path d="M11.3 8 Q 9 4 8 4.5 M12.7 8 Q 15 4 16 4.5" stroke="#55575e" strokeWidth=".6" fill="none" />
      </svg>
    );
  if (pasion === 'envidia')
    // Escarabajo verde brillante
    return (
      <svg width={tam} height={tam} viewBox="0 0 24 24" aria-hidden style={{ overflow: 'visible' }}>
        <defs>
          <radialGradient id={`e${id}`} cx="35%" cy="30%" r="80%">
            <stop offset="0" stopColor="#d6ff7a" />
            <stop offset=".5" stopColor="#6f9a2d" />
            <stop offset="1" stopColor="#2d4410" />
          </radialGradient>
        </defs>
        {[7, 11, 15].map((y) => (
          <path key={y} d={`M7 ${y} L3 ${y + 2} M17 ${y} L21 ${y + 2}`} stroke="#2d4410" strokeWidth=".8" className="bicho-pata" />
        ))}
        <ellipse cx="12" cy="13" rx="6" ry="7.5" fill={`url(#e${id})`} stroke="#2d4410" strokeWidth=".6" />
        <path d="M12 6 L12 20.5" stroke="#2d4410" strokeWidth=".6" />
        <circle cx="12" cy="5" r="2.6" fill="#3d5a14" />
      </svg>
    );
  // Deseo: mariposa violeta
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" aria-hidden style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`d${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e7a6dc" />
          <stop offset="1" stopColor="#7c2f6d" />
        </linearGradient>
      </defs>
      {ala('M12 12 C 6 1, -1 4, 3 11 C 1 16, 7 19, 12 13 Z', `url(#d${id})`, 'izq')}
      {ala('M12 12 C 18 1, 25 4, 21 11 C 23 16, 17 19, 12 13 Z', `url(#d${id})`, 'der')}
      <ellipse cx="12" cy="12.5" rx="1" ry="5" fill="#3a1533" />
      <path d="M11.5 8 Q 10 4.5 9 4 M12.5 8 Q 14 4.5 15 4" stroke="#3a1533" strokeWidth=".6" fill="none" />
    </svg>
  );
}

/** Estilos de las animaciones de los gráficos. */
export const ESTILOS_GRAFICOS = `
  @keyframes aleteo-izq { 0%,100% { transform: scaleX(1) } 50% { transform: scaleX(.35) } }
  @keyframes aleteo-der { 0%,100% { transform: scaleX(1) } 50% { transform: scaleX(.35) } }
  @keyframes patitas { 0%,100% { transform: translateY(0) } 50% { transform: translateY(.6px) } }
  .bicho-izq { animation: aleteo-izq .18s linear infinite; }
  .bicho-der { animation: aleteo-der .18s linear infinite; }
  .bicho-pata { animation: patitas .25s linear infinite; }
  @keyframes orbita { from { transform: rotate(0deg) translateX(var(--radio)) rotate(0deg) } to { transform: rotate(360deg) translateX(var(--radio)) rotate(-360deg) } }
  @keyframes vaiven { 0%,100% { transform: translate(0,0) } 50% { transform: translate(3px,-4px) } }
  @keyframes espantar { to { transform: translate(60px,-90px) scale(.3); opacity: 0 } }
  @keyframes brillo-medalla { 0%,100% { filter: drop-shadow(0 0 0 rgba(255,220,120,0)) } 50% { filter: drop-shadow(0 0 6px rgba(255,220,120,.9)) } }
  @media (prefers-reduced-motion: reduce) { .bicho-izq, .bicho-der, .bicho-pata { animation: none } }
`;
