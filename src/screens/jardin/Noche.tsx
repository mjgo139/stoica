import { useMemo } from 'react';

/** Puntos de luz de cada terraza (en %). */
const LUCES = {
  vertical: {
    cielo: { x0: 26, x1: 96, y0: 0, y1: 11 },
    luna: { x: 82, y: 5 },
    templo: { x: 66, y: 7.5, w: 34, h: 10 },
    fuente: { x: 91, y: 32, w: 26, h: 12 },
    zona: { x0: 14, x1: 92, y0: 30, y1: 92 },
  },
  horizontal: {
    cielo: { x0: 30, x1: 84, y0: 0, y1: 13 },
    luna: { x: 78, y: 5 },
    templo: { x: 60, y: 8, w: 20, h: 14 },
    fuente: { x: 92, y: 32, w: 18, h: 20 },
    zona: { x0: 18, x1: 86, y0: 34, y1: 94 },
  },
} as const;

export interface Luz {
  x: number;
  y: number;
  /** Tamaño del resplandor en px. */
  r: number;
}

const azar = (semilla: number) => {
  let s = semilla;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
};

/** Luces de noche dibujadas encima del jardín. `fuerza`: 0 de día, ~0,5 al atardecer, 1 de noche. */
export function Noche({ forma, fuerza, luces = [] }: { forma: keyof typeof LUCES; fuerza: number; luces?: Luz[] }) {
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
          <span key={i} className="noche-anim" style={{ position: 'absolute', left: `${e.x}%`, top: `${e.y}%`, width: e.s, height: e.s, borderRadius: '50%', background: '#fff' /* familia-ok: ilustración del jardín */, boxShadow: '0 0 4px #fff', animation: `titilar ${e.t}s ${e.d}s ease-in-out infinite` }} />
        ))}
      {noche && <span style={{ position: 'absolute', left: `${L.luna.x}%`, top: `${L.luna.y}%`, width: 22, height: 22, marginLeft: -11, marginTop: -11, borderRadius: '50%', background: 'radial-gradient(circle at 40% 40%, #fffbe8, #e8dfc0)' /* familia-ok: ilustración del jardín */, boxShadow: '0 0 18px 6px rgba(255,248,220,.55)' }} />}
      {/* Luz cálida del templo */}
      <span
        className="noche-anim"
        style={{ position: 'absolute', left: `${L.templo.x - L.templo.w / 2}%`, top: `${L.templo.y - L.templo.h / 2}%`, width: `${L.templo.w}%`, height: `${L.templo.h}%`, background: 'radial-gradient(ellipse, rgba(255,190,90,.75), rgba(255,150,60,0) 70%)' /* familia-ok: ilustración del jardín */, mixBlendMode: 'screen', animation: 'resplandor 4s ease-in-out infinite' }}
      />
      {/* Fuente iluminada desde abajo */}
      <span style={{ position: 'absolute', left: `${L.fuente.x - L.fuente.w / 2}%`, top: `${L.fuente.y - L.fuente.h / 2}%`, width: `${L.fuente.w}%`, height: `${L.fuente.h}%`, background: 'radial-gradient(ellipse, rgba(120,210,255,.8), rgba(80,170,255,0) 70%)' /* familia-ok: ilustración del jardín */, mixBlendMode: 'screen' }} />
      {/* Luz cálida del fuego y de los faroles */}
      {luces.map((b, i) => (
        <div key={i} style={{ position: 'absolute', left: `${b.x}%`, top: `${b.y}%` }}>
          <span className="noche-anim" style={{ position: 'absolute', left: -b.r, top: -b.r, width: b.r * 2, height: b.r * 2, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,175,80,.55), rgba(255,130,40,.16) 45%, rgba(255,120,30,0) 70%)' /* familia-ok: ilustración del jardín */, mixBlendMode: 'screen', animation: `resplandor ${1.6 + i * 0.3}s ease-in-out infinite` }} />
        </div>
      ))}
      {/* Luciérnagas */}
      {noche &&
        luciernagas.map((l, i) => (
          <span
            key={i}
            className="noche-anim"
            style={{ position: 'absolute', left: `${l.x}%`, top: `${l.y}%`, width: 5, height: 5, borderRadius: '50%', background: '#f6ff9a' /* familia-ok: ilustración del jardín */, boxShadow: '0 0 8px 3px rgba(230,255,120,.75)', ['--dx' as string]: `${l.dx}px`, ['--dy' as string]: `${l.dy}px`, animation: `volar ${l.t}s ${l.d}s ease-in-out infinite` }}
          />
        ))}
    </div>
  );
}
