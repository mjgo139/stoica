/** Cálculos de dibujo compartidos entre tu jardín y el jardín de otra persona del grupo. */
import { useEffect, useState } from 'react';
import { ADORNOS, FONDOS, MACETA, SPRITES } from './disposicion';
import { celdas, perspectiva, TERRENOS, type Forma } from './terreno';

export type { Forma };

/** Ancho máximo de cada planta (su etapa más grande), para que la adulta ocupe el ancho de la tierra. */
export const ANCHO_MAX: Record<string, number> = Object.fromEntries(Object.entries(SPRITES).map(([k, v]) => [k, Math.max(...v.map((s) => s.w))]));

/** Ancho de una maceta (en % del ancho del fondo) a la profundidad y: se achica hacia el fondo como el piso. */
export function anchoMaceta(forma: Forma, y: number): number {
  const f = FONDOS[forma];
  // Tamaño de un lugar para macetas en la fila de adelante
  const d = TERRENOS[forma];
  const c = celdas(forma).find((x) => x.tipo === 'libre')!;
  const cw = ((c.w / perspectiva(forma, c.y)) / 100) * f.ancho;
  const ch = (c.h / 100) * f.alto;
  const px = Math.min(cw * 0.92, ch * 1.15 * (MACETA.w / MACETA.h)) * perspectiva(forma, Math.min(y, d.y1));
  return (px / f.ancho) * 100;
}

/** Inclinación (tangente) de las líneas del piso en un punto: para que la maceta quede alineada con las baldosas. */
export function inclinacion(forma: Forma, x: number, y: number): number {
  const f = FONDOS[forma];
  const [vx, vy] = TERRENOS[forma].fuga;
  return ((x - vx) * f.ancho) / ((y - vy) * f.alto);
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
  const [vx, vy] = TERRENOS[forma].fuga;
  // Al inclinar la maceta como el piso, lo de arriba se corre hacia el punto de fuga
  const corre = (alturaSobrePiso: number) => -alturaSobrePiso * ((c.x - vx) / (piso - vy));
  const alturaTierra = h * (1 - (MACETA.tierra.y + 8) / 100);
  return {
    left,
    top,
    w,
    h,
    piso,
    inclina: inclinacion(forma, c.x, piso),
    corre,
    // Donde va la base de la planta: en la tierra, un poco detrás del centro
    plantaX: left + (w * MACETA.tierra.x) / 100 + corre(alturaTierra),
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
  if (h >= 20 || h < 6) return { color: '#101b45' /* familia-ok: ilustración del jardín */, opacidad: 0.64 };
  if (h < 8) return { color: '#ffb27a' /* familia-ok: ilustración del jardín */, opacidad: 0.16 };
  if (h >= 17) return { color: '#ff9a4a' /* familia-ok: ilustración del jardín */, opacidad: 0.2 };
  return { color: '#fff' /* familia-ok: ilustración del jardín */, opacidad: 0 };
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
