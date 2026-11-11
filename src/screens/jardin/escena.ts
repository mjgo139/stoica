/** Cálculos de dibujo compartidos entre tu jardín y el jardín de otra persona del grupo. */
import { useEffect, useState } from 'react';
import { ADORNOS, FONDOS, MACETA, SPRITES } from './disposicion';
import { celdas, TERRENOS, type Forma } from './terreno';

export type { Forma };

/** Ancho máximo de cada planta (su etapa más grande), para que la adulta ocupe el ancho de la tierra. */
export const ANCHO_MAX: Record<string, number> = Object.fromEntries(Object.entries(SPRITES).map(([k, v]) => [k, Math.max(...v.map((s) => s.w))]));

/** Perspectiva: lo del fondo se ve un poco más chico que lo de adelante. */
function escala(forma: Forma, y: number) {
  const d = TERRENOS[forma];
  const t = Math.min(1, Math.max(0, (y - d.y0) / (d.y1 - d.y0)));
  return 0.86 + 0.22 * t;
}

/** Ancho de una maceta (en % del ancho del fondo) a la profundidad y. */
export function anchoMaceta(forma: Forma, y: number): number {
  const f = FONDOS[forma];
  // Tamaño de un lugar para macetas (no de un pasillo)
  const c = celdas(forma).find((x) => x.tipo === 'libre')!;
  const cw = (c.w / 100) * f.ancho;
  const ch = (c.h / 100) * f.alto;
  const px = Math.min(cw * 0.9, ch * 1.0 * (MACETA.w / MACETA.h)) * escala(forma, y);
  return (px / f.ancho) * 100;
}

/** Rectángulos (en %) de la maceta de una celda y el punto donde se apoya la planta. */
export function lugarMaceta(forma: Forma, celda: number) {
  const f = FONDOS[forma];
  const c = celdas(forma)[celda];
  const w = anchoMaceta(forma, c.y);
  const h = ((w / 100) * f.ancho * (MACETA.h / MACETA.w) * 100) / f.alto;
  const piso = c.y + c.h * 0.42;
  const top = piso - h;
  const left = c.x - w / 2;
  return {
    left,
    top,
    w,
    h,
    piso,
    // Donde va la base de la planta: en la tierra, un poco detrás del centro
    plantaX: left + (w * MACETA.tierra.x) / 100,
    plantaY: top + (h * (MACETA.tierra.y + 8)) / 100,
    anchoTierra: (w * MACETA.tierra.w) / 100,
  };
}

/** Dónde y de qué tamaño va una planta sobre su maceta (todo en %). */
export function ubicarPlanta(forma: Forma, planta: string, etapa: number, celda: number, retono: boolean) {
  const f = FONDOS[forma];
  const relacion = f.ancho / f.alto;
  const m = lugarMaceta(forma, celda);
  const s = SPRITES[planta][etapa];
  const ancho = (s.w / ANCHO_MAX[planta]) * m.anchoTierra * (retono ? 1.2 : 1.5);
  const alto = ancho * relacion * (s.h / s.w);
  return { left: m.plantaX - (s.ax / s.w) * ancho, top: m.plantaY - alto, ancho, alto, maceta: m };
}

/** Dónde va un adorno (apoyado en el piso de su celda). */
export function ubicarAdorno(forma: Forma, id: string, celda: number) {
  const f = FONDOS[forma];
  const relacion = f.ancho / f.alto;
  const c = celdas(forma)[celda];
  const a = ADORNOS.find((x) => x.id === id)!;
  const ancho = anchoMaceta(forma, c.y) * 1.05 * (a.w / 260);
  const alto = ancho * relacion * (a.h / a.w);
  const piso = c.y + c.h * 0.42;
  return { left: c.x - ancho / 2, top: piso - alto, ancho, alto, piso };
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
/** Es de noche para encender el fuego (desde las 18 h hasta las 6 h). */
export const esNocheDeFuego = (h: number) => h >= 18 || h < 6;

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
