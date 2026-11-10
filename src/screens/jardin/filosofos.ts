/**
 * Hojas de animación de los filósofos (armadas con herramientas/jardin/armar_filosofos.py):
 * cada fila es una secuencia (caminar en 4 direcciones, hablar, antorcha), todas a la misma escala y
 * con los pies en la misma línea.
 */
export type Dir = 'abajo' | 'izquierda' | 'derecha' | 'arriba';

export interface Atlas {
  archivo: string;
  celda: [number, number];
  ancho: number;
  alto: number;
  /** nombre de la secuencia → fila y cuántos cuadros tiene. */
  filas: Record<string, { fila: number; cuadros: number }>;
  /** Orden de los cuadros al caminar. */
  pasos: number[];
  /** Pasos por segundo. */
  ritmo: number;
}

export const MARCO: Atlas = {
  archivo: '/jardin/marco-v2.webp',
  celda: [235, 237],
  ancho: 705,
  alto: 2133,
  filas: {
    caminar_abajo: { fila: 0, cuadros: 3 },
    caminar_izquierda: { fila: 1, cuadros: 3 },
    caminar_derecha: { fila: 2, cuadros: 3 },
    caminar_arriba: { fila: 3, cuadros: 3 },
    hablar_abajo: { fila: 4, cuadros: 2 },
    hablar_izquierda: { fila: 5, cuadros: 2 },
    hablar_derecha: { fila: 6, cuadros: 2 },
    hablar_arriba: { fila: 7, cuadros: 2 },
    antorcha: { fila: 8, cuadros: 3 },
  },
  pasos: [0, 1, 2, 1],
  ritmo: 7,
};

export const EPICTETO: Atlas = {
  archivo: '/jardin/epicteto-v1.webp',
  celda: [187, 220],
  ancho: 1122,
  alto: 1100,
  filas: {
    caminar_abajo: { fila: 0, cuadros: 6 },
    caminar_izquierda: { fila: 1, cuadros: 6 },
    caminar_derecha: { fila: 2, cuadros: 6 },
    caminar_arriba: { fila: 3, cuadros: 6 },
    hablar_abajo: { fila: 4, cuadros: 5 },
  },
  pasos: [0, 1, 2, 3, 4, 5],
  ritmo: 9,
};

/** Cuadro (columna, fila) para caminar en una dirección. */
export function cuadroCaminar(a: Atlas, dir: Dir, ciclo: number): [number, number] {
  const f = a.filas[`caminar_${dir}`];
  return [a.pasos[Math.floor(ciclo) % a.pasos.length] % f.cuadros, f.fila];
}

/** Cuadro para hablar (si no tiene esa dirección, habla de frente). */
export function cuadroHablar(a: Atlas, dir: Dir, t: number): { cuadro: [number, number]; dir: Dir } {
  const f = a.filas[`hablar_${dir}`];
  if (f) return { cuadro: [Math.floor(t / 0.9) % f.cuadros, f.fila], dir };
  const frente = a.filas.hablar_abajo;
  return { cuadro: [Math.floor(t / 0.9) % frente.cuadros, frente.fila], dir: 'abajo' };
}

/** Cuadro con la antorcha: la levanta, se agacha a encender y se vuelve a erguir. */
export function cuadroAntorcha(a: Atlas, t: number): [number, number] | null {
  const f = a.filas.antorcha;
  if (!f) return null;
  return [t < 0.45 ? 0 : t < 1.5 ? 1 : 2, f.fila];
}
