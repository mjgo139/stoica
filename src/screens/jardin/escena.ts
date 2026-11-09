/** Cálculos de dibujo compartidos entre tu jardín y el jardín de otra persona del grupo. */
import { useEffect, useState } from 'react';
import { MACETEROS, SPRITES } from './disposicion';

/** Ancho máximo de cada planta (su etapa más grande), para que la adulta ocupe el ancho del macetero. */
export const ANCHO_MAX: Record<string, number> = Object.fromEntries(Object.entries(SPRITES).map(([k, v]) => [k, Math.max(...v.map((s) => s.w))]));

export type Forma = 'vertical' | 'horizontal';

/** Maceteros ordenados de adelante (más grandes y visibles) hacia atrás. */
export function maceterosOrdenados(forma: Forma) {
  return [...MACETEROS[forma]].sort((a, b) => b.y - a.y || a.x - b.x);
}

/** Dónde y de qué tamaño va una planta dentro de su macetero (todo en % del jardín). */
export function ubicarPlanta(planta: string, etapa: number, m: { x: number; y: number; w: number; h: number }, relacion: number, retono: boolean) {
  const s = SPRITES[planta][etapa];
  const anchoPct = (s.w / ANCHO_MAX[planta]) * m.w * (retono ? 0.85 : 1.1);
  const altoPct = anchoPct * relacion * (s.h / s.w);
  const piso = m.y + m.h * 0.45;
  return { left: m.x - (s.ax / s.w) * anchoPct, top: piso - altoPct, ancho: anchoPct, piso, altoPct };
}

export function fuerzaNoche(h: number): number {
  if (h >= 20 || h < 6) return 1;
  if (h >= 18) return 0.6;
  if (h < 7) return 0.4;
  return 0;
}
/** Tinte según la hora: amanecer, día, atardecer, noche. */
export function tinte(h: number): { color: string; opacidad: number } {
  if (h >= 20 || h < 6) return { color: '#101b45', opacidad: 0.64 };
  if (h < 8) return { color: '#ffb27a', opacidad: 0.16 };
  if (h >= 17) return { color: '#ff9a4a', opacidad: 0.2 };
  return { color: '#fff', opacidad: 0 };
}

/** Pantalla ancha: jardín horizontal. */
export function useAncho(): boolean {
  const consulta = '(min-width: 760px)';
  const [ancho, setAncho] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(consulta).matches);
  useEffect(() => {
    const m = window.matchMedia?.(consulta);
    if (!m) return;
    const f = () => setAncho(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return !!ancho;
}
