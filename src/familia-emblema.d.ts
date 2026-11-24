/** Tipos del dibujo del emblema de la familia (familia/emblema.mjs, sin tipos propios). */
declare module '*/familia/emblema.mjs' {
  export const COLORES_ICONO: { fondo: string; laurel: string; figura: string };
  export const FIGURAS: Record<string, string>;
  export function emblema(figura: string): string;
  export function svgEmblemaSolo(figura: string, ancho: number): string;
  export function svgIcono(figura: string, op?: { forma?: 'cuadrado' | 'circulo' | 'lleno'; titulo?: string }): string;
}
