/**
 * Límites contra el abuso. Una persona normal crea unos pocos documentos por día;
 * estos topes están muy por encima del uso real y solo frenan programas que escriben en masa.
 */
export const LIMITES_ABUSO = {
  /** Documentos nuevos por día y por persona (hábitos, tareas, sesiones, hitos, dispositivos, desafíos). */
  creacionesPorDia: 300,
  habitosMax: 40,
  tareasMax: 500,
  dispositivosMax: 10,
  desafiosPorGrupo: 30,
} as const;

/** Colecciones privadas con ID libre que el vigilante cuenta (las demás tienen ID fijo por día). */
export const COLECCIONES_CONTADAS = ['habits', 'tasks', 'focus', 'milestones', 'devices', 'borrados'] as const;

export interface Cuota {
  dia: string;
  n: number;
}

/** Suma una creación al contador del día (se reinicia cada día) y dice si se pasó del tope. */
export function sumarCreacion(previa: Cuota | undefined, hoy: string, tope: number = LIMITES_ABUSO.creacionesPorDia): Cuota & { excedido: boolean } {
  const n = previa && previa.dia === hoy ? previa.n + 1 : 1;
  return { dia: hoy, n, excedido: n > tope };
}

/** Tope de documentos por colección (o null si no tiene). */
export function topeDeColeccion(col: string): number | null {
  if (col === 'habits') return LIMITES_ABUSO.habitosMax;
  if (col === 'tasks') return LIMITES_ABUSO.tareasMax;
  if (col === 'devices') return LIMITES_ABUSO.dispositivosMax;
  return null;
}
