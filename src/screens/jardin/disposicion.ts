/**
 * Jardín estoico: dónde está cada macetero en los fondos (en % del ancho y alto de la imagen) y medidas de cada planta.
 * Los maceteros se midieron detectando la tierra en las imágenes (ver herramientas/jardin/LEEME.md).
 */
export interface Macetero {
  /** Centro de la tierra (en % del fondo). */
  x: number;
  y: number;
  /** Ancho y alto de la tierra (en %). */
  w: number;
  h: number;
}

/** Terraza sin maceteros (las macetas se acomodan encima, ver terreno.ts). */
export const FONDOS = {
  vertical: { archivo: '/jardin/terraza-vertical.webp', ancho: 941, alto: 1672 },
  horizontal: { archivo: '/jardin/terraza-horizontal.webp', ancho: 1671, alto: 941 },
} as const;

/** La maceta (public/jardin/maceta.webp) y dónde está su tierra (en % de la imagen). */
export const MACETA = { archivo: '/jardin/maceta.webp', w: 416, h: 320, tierra: { x: 48.6, y: 35.0, w: 71.0, h: 59.0 } } as const;

/** Fuego animado (public/jardin/fuego.webp) que va sobre el brasero apagado. */
export const FUEGO = { archivo: '/jardin/fuego.webp', w: 184, h: 276, sobre: { x: 50, y: 37.3, w: 43.9 } } as const;

export interface Adorno {
  id: string;
  nombre: string;
  w: number;
  h: number;
  /** Medallas que hacen falta para desbloquearlo. */
  medallas: number;
  /** Da luz de noche. */
  luz?: boolean;
}

/** El brasero (4 fijos en las esquinas) y su medida. */
export const BRASERO = { apagado: '/jardin/adorno-brasero-apagado.webp', w: 244, h: 260 } as const;

/** Regadera que aparece al regar. */
export const REGADERA = { archivo: '/jardin/regadera-v1.webp', w: 360, h: 250 } as const;

/**
 * Repisa de logros (public/jardin/repisa-v1.webp, 2 filas × 9 nichos) apoyada contra la baranda.
 * `nichos`: centro de cada nicho y su piso, en % de la imagen de la repisa.
 */
export const REPISA = {
  archivo: '/jardin/repisa-v1.webp',
  w: 1400,
  h: 458,
  /** Dónde va en cada terraza (en % del fondo): borde izquierdo, ancho y piso. */
  lugar: { vertical: { x: 18, ancho: 63, piso: 28.5 }, horizontal: { x: 33, ancho: 34, piso: 34.5 } },
  columnas: [8.7, 19, 29.4, 39.9, 50.5, 61, 71.5, 81.8, 92.2],
  filas: [
    { piso: 53, alto: 21 },
    { piso: 77, alto: 18.5 },
  ],
  anchoNicho: 8.6,
} as const;

/** Orden en que se llenan los nichos: del centro hacia los costados, primero arriba. */
export const ORDEN_NICHOS: Array<[number, number]> = [0, 1].flatMap((f) => [4, 3, 5, 2, 6, 1, 7, 0, 8].map((c) => [f, c] as [number, number]));

/** Adornos (public/jardin/adorno-<id>.webp), en el orden en que se desbloquean con las medallas (van en la repisa). */
export const ADORNOS: Adorno[] = [
  { id: 'farol', nombre: 'Farol', w: 183, h: 260, medallas: 1, luz: true },
  { id: 'flores', nombre: 'Cántaro con flores', w: 260, h: 248, medallas: 2 },
  { id: 'reloj-sol', nombre: 'Reloj de sol', w: 259, h: 260, medallas: 3 },
  { id: 'lira', nombre: 'Lira', w: 246, h: 260, medallas: 4 },
  { id: 'reloj-arena', nombre: 'Reloj de arena', w: 228, h: 260, medallas: 5 },
  { id: 'pergamino', nombre: 'Pergamino sellado', w: 260, h: 188, medallas: 6 },
  { id: 'libros', nombre: 'Libros de los estoicos', w: 260, h: 216, medallas: 7 },
  { id: 'pergaminos', nombre: 'Pergaminos y pluma', w: 259, h: 260, medallas: 8 },
  { id: 'esfera', nombre: 'Esfera armilar', w: 225, h: 260, medallas: 9 },
  { id: 'cojin-laurel', nombre: 'Corona sobre cojín', w: 260, h: 230, medallas: 10 },
  { id: 'corona', nombre: 'Corona de laurel', w: 231, h: 260, medallas: 11 },
];

/** 15 maceteros, de atrás hacia adelante y de izquierda a derecha. */
export const MACETEROS: Record<keyof typeof FONDOS, Macetero[]> = {
  vertical: [
    { x: 30.13, y: 29.96, w: 12.01, h: 3.71 },
    { x: 49.68, y: 29.93, w: 11.37, h: 3.65 },
    { x: 69.08, y: 29.96, w: 12.11, h: 3.71 },
    { x: 28.43, y: 38.13, w: 13.07, h: 4.25 },
    { x: 50.05, y: 38.13, w: 12.54, h: 4.25 },
    { x: 71.52, y: 38.16, w: 13.82, h: 4.19 },
    { x: 26.62, y: 47.55, w: 13.71, h: 5.14 },
    { x: 50.64, y: 47.49, w: 13.92, h: 5.14 },
    { x: 74.07, y: 47.52, w: 14.45, h: 5.08 },
    { x: 25.35, y: 58.58, w: 14.77, h: 6.04 },
    { x: 51.28, y: 58.58, w: 14.77, h: 6.04 },
    { x: 77.15, y: 58.58, w: 16.15, h: 6.04 },
    { x: 23.49, y: 71.56, w: 16.37, h: 7.24 },
    { x: 52.13, y: 71.56, w: 16.26, h: 7.24 },
    { x: 80.92, y: 71.56, w: 17.75, h: 7.24 },
  ],
  horizontal: [
    { x: 27.44, y: 38.95, w: 8.68, h: 7.33 },
    { x: 39.41, y: 39.0, w: 7.72, h: 7.23 },
    { x: 51.26, y: 39.0, w: 7.72, h: 7.23 },
    { x: 63.11, y: 39.0, w: 8.32, h: 7.23 },
    { x: 75.16, y: 39.0, w: 8.98, h: 7.23 },
    { x: 25.04, y: 56.16, w: 9.28, h: 8.18 },
    { x: 38.57, y: 56.16, w: 8.68, h: 8.18 },
    { x: 51.56, y: 56.16, w: 8.56, h: 8.18 },
    { x: 64.72, y: 56.16, w: 9.28, h: 8.18 },
    { x: 78.28, y: 56.16, w: 10.41, h: 8.18 },
    { x: 22.59, y: 76.35, w: 10.71, h: 10.95 },
    { x: 37.37, y: 76.35, w: 9.99, h: 10.95 },
    { x: 51.94, y: 76.35, w: 9.46, h: 10.95 },
    { x: 66.4, y: 76.35, w: 10.11, h: 10.95 },
    { x: 81.42, y: 76.35, w: 11.31, h: 10.95 },
  ],
};

export interface Sprite {
  w: number;
  h: number;
  /** Centro de la tierra de la planta, en px desde la izquierda. */
  ax: number;
  /** Ancho de la tierra en la base. */
  base: number;
}

/** Medidas de las 6 etapas de cada planta (public/jardin/<planta>-<etapa>.webp). */
export const SPRITES: Record<string, Sprite[]> = {
  olivo: [
    { w: 95, h: 39, ax: 46.5, base: 93.0 },
    { w: 105, h: 108, ax: 51.0, base: 96.0 },
    { w: 137, h: 163, ax: 72.5, base: 113.0 },
    { w: 219, h: 240, ax: 103.0, base: 120.0 },
    { w: 231, h: 245, ax: 98.0, base: 124.0 },
    { w: 196, h: 222, ax: 87.5, base: 137.0 },
  ],
  laurel: [
    { w: 93, h: 47, ax: 46.0, base: 92.0 },
    { w: 105, h: 120, ax: 53.0, base: 100.0 },
    { w: 146, h: 176, ax: 75.0, base: 112.0 },
    { w: 232, h: 242, ax: 121.5, base: 129.0 },
    { w: 249, h: 264, ax: 123.5, base: 127.0 },
    { w: 175, h: 204, ax: 86.5, base: 123.0 },
  ],
  lavanda: [
    { w: 88, h: 44, ax: 43.5, base: 79.0 },
    { w: 97, h: 110, ax: 48.0, base: 86.0 },
    { w: 142, h: 162, ax: 71.5, base: 107.0 },
    { w: 222, h: 228, ax: 110.5, base: 131.0 },
    { w: 256, h: 267, ax: 121.0, base: 134.0 },
    { w: 191, h: 210, ax: 90.5, base: 125.0 },
  ],
  granado: [
    { w: 95, h: 49, ax: 48.0, base: 58.0 },
    { w: 102, h: 117, ax: 50.5, base: 93.0 },
    { w: 148, h: 169, ax: 77.5, base: 121.0 },
    { w: 235, h: 245, ax: 122.5, base: 139.0 },
    { w: 256, h: 262, ax: 117.0, base: 148.0 },
    { w: 194, h: 213, ax: 97.5, base: 141.0 },
  ],
  lirio: [
    { w: 60, h: 40, ax: 29.5, base: 59.0 },
    { w: 119, h: 103, ax: 63.0, base: 78.0 },
    { w: 176, h: 150, ax: 94.0, base: 96.0 },
    { w: 216, h: 213, ax: 109.0, base: 118.0 },
    { w: 226, h: 236, ax: 112.0, base: 130.0 },
    { w: 148, h: 174, ax: 79.0, base: 112.0 },
  ],
};
