import { useMemo } from 'react';

/** Puntos de luz de cada fondo (en %). */
const LUCES = {
  vertical: {
    cielo: { x0: 22, x1: 98, y0: 0, y1: 9 },
    luna: { x: 86, y: 4 },
    templo: { x: 65, y: 8, w: 30, h: 10 },
    fuente: { x: 92, y: 30, w: 26, h: 9 },
    braseros: [
      { x: 27, y: 17.6 },
      { x: 84, y: 17.6 },
    ],
    zona: { x0: 12, x1: 92, y0: 26, y1: 82 },
  },
  horizontal: {
    cielo: { x0: 30, x1: 82, y0: 0, y1: 11 },
    luna: { x: 74, y: 5 },
    templo: { x: 59, y: 8, w: 18, h: 14 },
    fuente: { x: 92, y: 38, w: 16, h: 14 },
    braseros: [
      { x: 29, y: 16.5 },
      { x: 82.3, y: 16.5 },
    ],
    zona: { x0: 15, x1: 90, y0: 30, y1: 92 },
  },
} as const;

const azar = (semilla: number) => {
  let s = semilla;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
};

/** Luces de noche dibujadas encima del jardín. `fuerza`: 0 de día, ~0,5 al atardecer, 1 de noche. */
export function Noche({ forma, fuerza }: { forma: keyof typeof LUCES; fuerza: number }) {
  const L = LUCES[forma];
  const estrellas = useMemo(() => {
    const r = azar(7);
    return Array.from({ length: 34 }, () => ({ x: L.cielo.x0 + r() * (L.cielo.x1 - L.cielo.x0), y: L.cielo.y0 + r() * (L.cielo.y1 - L.cielo.y0), t: 1.5 + r() * 3, d: -r() * 4, s: 1 + r() * 1.6 }));
  }, [L]);
  const luciernagas = useMemo(() => {
    const r = azar(13);
    return Array.from({ length: 16 }, () => ({ x: L.zona.x0 + r() * (L.zona.x1 - L.zona.x0), y: L.zona.y0 + r() * (L.zona.y1 - L.zona.y0), t: 6 + r() * 8, d: -r() * 10, dx: (r() - 0.5) * 60, dy: (r() - 0.5) * 40 }));
  }, [L]);
  if (fuerza <= 0) return null;
  const noche = fuerza >= 1;
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 55, opacity: Math.min(1, fuerza) }}>
      <style>{`
        @keyframes titilar { 0%,100% { opacity: .25 } 50% { opacity: 1 } }
        @keyframes llama { 0%,100% { transform: scaleY(1) scaleX(1) } 25% { transform: scaleY(1.12) scaleX(.94) } 50% { transform: scaleY(.92) scaleX(1.04) } 75% { transform: scaleY(1.08) scaleX(.97) } }
        @keyframes resplandor { 0%,100% { opacity: .85 } 50% { opacity: 1 } }
        @keyframes volar { 0% { transform: translate(0,0); opacity: 0 } 15% { opacity: 1 } 50% { transform: translate(var(--dx), var(--dy)) } 85% { opacity: 1 } 100% { transform: translate(0,0); opacity: 0 } }
        @media (prefers-reduced-motion: reduce) { .noche-anim { animation: none !important } }
      `}</style>
      {/* Estrellas y luna (solo de noche) */}
      {noche &&
        estrellas.map((e, i) => (
          <span key={i} className="noche-anim" style={{ position: 'absolute', left: `${e.x}%`, top: `${e.y}%`, width: e.s, height: e.s, borderRadius: '50%', background: '#fff', boxShadow: '0 0 4px #fff', animation: `titilar ${e.t}s ${e.d}s ease-in-out infinite` }} />
        ))}
      {noche && <span style={{ position: 'absolute', left: `${L.luna.x}%`, top: `${L.luna.y}%`, width: 22, height: 22, marginLeft: -11, marginTop: -11, borderRadius: '50%', background: 'radial-gradient(circle at 40% 40%, #fffbe8, #e8dfc0)', boxShadow: '0 0 18px 6px rgba(255,248,220,.55)' }} />}
      {/* Luz cálida del templo */}
      <span
        className="noche-anim"
        style={{ position: 'absolute', left: `${L.templo.x - L.templo.w / 2}%`, top: `${L.templo.y - L.templo.h / 2}%`, width: `${L.templo.w}%`, height: `${L.templo.h}%`, background: 'radial-gradient(ellipse, rgba(255,190,90,.75), rgba(255,150,60,0) 70%)', mixBlendMode: 'screen', animation: 'resplandor 4s ease-in-out infinite' }}
      />
      {/* Fuente iluminada desde abajo */}
      <span style={{ position: 'absolute', left: `${L.fuente.x - L.fuente.w / 2}%`, top: `${L.fuente.y - L.fuente.h / 2}%`, width: `${L.fuente.w}%`, height: `${L.fuente.h}%`, background: 'radial-gradient(ellipse, rgba(120,210,255,.8), rgba(80,170,255,0) 70%)', mixBlendMode: 'screen' }} />
      {/* Braseros sobre las ánforas: llama dibujada + resplandor */}
      {L.braseros.map((b, i) => (
        <div key={i} style={{ position: 'absolute', left: `${b.x}%`, top: `${b.y}%` }}>
          <span className="noche-anim" style={{ position: 'absolute', left: -90, top: -90, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,170,70,.65), rgba(255,120,30,.18) 45%, rgba(255,120,30,0) 70%)', mixBlendMode: 'screen', animation: `resplandor ${1.6 + i * 0.3}s ease-in-out infinite` }} />
          <svg width="22" height="30" viewBox="0 0 22 30" style={{ position: 'absolute', left: -11, top: -28, overflow: 'visible' }}>
            <g className="noche-anim" style={{ transformOrigin: '11px 29px', animation: `llama ${0.45 + i * 0.1}s ease-in-out infinite` }}>
              <path d="M11 1 C 15 9, 21 13, 19 21 C 17.5 27, 14 29, 11 29 C 8 29, 4.5 27, 3 21 C 1 13, 7 9, 11 1 Z" fill="#ff8a1e" />
              <path d="M11 9 C 13.5 14, 16 17, 15 22 C 14 26, 12.5 27, 11 27 C 9.5 27, 8 26, 7 22 C 6 17, 8.5 14, 11 9 Z" fill="#ffd34d" />
              <path d="M11 16 C 12.3 19, 13 21, 12.6 23.5 C 12.2 25.5, 11.6 26, 11 26 C 10.4 26, 9.8 25.5, 9.4 23.5 C 9 21, 9.7 19, 11 16 Z" fill="#fff6c8" />
            </g>
          </svg>
        </div>
      ))}
      {/* Luciérnagas */}
      {noche &&
        luciernagas.map((l, i) => (
          <span
            key={i}
            className="noche-anim"
            style={{ position: 'absolute', left: `${l.x}%`, top: `${l.y}%`, width: 5, height: 5, borderRadius: '50%', background: '#f6ff9a', boxShadow: '0 0 8px 3px rgba(230,255,120,.75)', ['--dx' as string]: `${l.dx}px`, ['--dy' as string]: `${l.dy}px`, animation: `volar ${l.t}s ${l.d}s ease-in-out infinite` }}
          />
        ))}
    </div>
  );
}
