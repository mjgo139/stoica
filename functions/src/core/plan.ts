/**
 * Plan de pago por grupo: foto del día en cada hábito compartido, con comentarios en cada foto.
 * Se activa con un código que genera el admin. Al vencer hay unos días de espera (configurables)
 * en los que todo se ve pero no se puede agregar nada; después se borra definitivamente.
 */
import { diferenciaDias } from './fechas.js';
import { limpiarNombre } from './validaciones.js';

export const MESES_PLAN = [1, 3, 6, 12] as const;
export type MesesPlan = (typeof MESES_PLAN)[number];
export const DIAS_GRACIA_DEFECTO = 7;
export const DIAS_GRACIA_MAX = 60;
export const MENSAJE_MAX = 280;
/** Tamaños máximos de las fotos que llegan ya reducidas desde el celular. */
export const FOTO_MAX_BYTES = 600 * 1024;
export const MINI_MAX_BYTES = 80 * 1024;
export const FOTO_LADO = 1080;
export const MINI_LADO = 320;
export const CODIGOS_POR_VEZ = 20;
/** Intentos fallidos de código por persona por hora (contra adivinar códigos). */
export const INTENTOS_CODIGO_HORA = 5;

const DIA = 864e5;

/** codigos/{codigo} (solo servidor y admin). */
export interface CodigoPlan {
  meses: MesesPlan;
  nota: string;
  creado: number;
  usado: boolean;
  usadoPor: string | null;
  grupoId: string | null;
  grupoNombre: string | null;
  usadoEn: number | null;
}

/** config/plan (lo edita el admin). */
export interface ConfigPlan {
  diasGracia: number;
}

/**
 * groups/{gid}/fotos/{uid}_{habitId}_{dia}: la foto de hoy de un hábito compartido, ligada a si se cumplió.
 * Una por persona, hábito y día; si sube otra, reemplaza. La escribe solo el servidor.
 */
export interface FotoHabito {
  de: string;
  nombre: string;
  habitId: string;
  habito: string;
  dia: string;
  /** Cómo estaba el hábito al subirla (lo actual se toma del resumen del integrante). */
  cumplido: boolean;
  texto: string;
  fotoUrl: string;
  miniUrl: string;
  rutas: string[];
  /** Cuántos comentarios tiene (lo lleva el servidor). */
  comentarios?: number;
  creado: number;
  actualizado: number;
  actualizadoPor: string;
}

/** groups/{gid}/fotos/{fotoId}/comentarios/{id}: comentarios de una foto. */
export interface ComentarioFoto {
  de: string;
  nombre: string;
  texto: string;
  dia: string;
  creado: number;
  actualizado: number;
  actualizadoPor: string;
}

export type EstadoPlan =
  | { estado: 'sin' }
  | { estado: 'activo'; hasta: number; diasRestantes: number }
  | { estado: 'gracia'; hasta: number; borraEn: number; diasParaBorrar: number }
  | { estado: 'borrado'; hasta: number };

export function diasGraciaValidos(n: unknown): number {
  const v = Math.round(Number(n));
  return Number.isFinite(v) && v >= 0 && v <= DIAS_GRACIA_MAX ? v : DIAS_GRACIA_DEFECTO;
}

export function estadoPlan(hasta: number | null | undefined, ahora: number, diasGracia: number = DIAS_GRACIA_DEFECTO): EstadoPlan {
  if (!hasta) return { estado: 'sin' };
  if (ahora < hasta) return { estado: 'activo', hasta, diasRestantes: Math.ceil((hasta - ahora) / DIA) };
  const borraEn = hasta + diasGracia * DIA;
  if (ahora < borraEn) return { estado: 'gracia', hasta, borraEn, diasParaBorrar: Math.ceil((borraEn - ahora) / DIA) };
  return { estado: 'borrado', hasta };
}

/** Nuevo vencimiento: suma meses calendario desde hoy, o desde el vencimiento si todavía está activo. */
export function extenderPlan(hasta: number | null | undefined, ahora: number, meses: number): number {
  const base = new Date(Math.max(ahora, hasta ?? 0));
  const d = new Date(base);
  d.setUTCMonth(d.getUTCMonth() + meses);
  // 31 de enero + 1 mes → último día de febrero (no 3 de marzo).
  if (d.getUTCDate() !== base.getUTCDate()) d.setUTCDate(0);
  return d.getTime();
}

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Código de 8 caracteres en dos bloques: STOA-XXXX-XXXX (32^8 ≈ 1 billón de combinaciones). */
export function generarCodigoPlan(aleatorio: () => number): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += ALFABETO[Math.floor(aleatorio() * ALFABETO.length)];
  return `STOA-${s.slice(0, 4)}-${s.slice(4)}`;
}

export function normalizarCodigoPlan(s: string): string {
  const limpio = s.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^STOA/, '');
  return limpio.length === 8 ? `STOA-${limpio.slice(0, 4)}-${limpio.slice(4)}` : '';
}

export function esCodigoPlan(s: string): boolean {
  return /^STOA-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(s);
}

export function validarMensaje(texto: string): string | null {
  const t = limpiarNombre(texto);
  if (!t) return 'Escribí algo.';
  if (t.length > MENSAJE_MAX) return `El mensaje puede tener hasta ${MENSAJE_MAX} letras.`;
  return null;
}

/** Id de la foto: una por persona, por hábito y por día (si sube otra, reemplaza). */
export const idFotoHabito = (uid: string, habitId: string, dia: string) => `${uid}_${habitId}_${dia}`;

/**
 * ¿La foto es de un día cumplido? Si el día está dentro de la semana del resumen del integrante, manda el
 * resumen (por si marcó o desmarcó después de subirla); si no, lo que valía al subirla.
 */
export function fotoCumplida(foto: Pick<FotoHabito, 'habitId' | 'dia' | 'cumplido'>, resumen?: { fecha: string; compartidos: Array<{ habitId: string; hoy: boolean; semana?: boolean[] }> } | null): boolean {
  const c = resumen?.compartidos.find((x) => x.habitId === foto.habitId);
  if (!resumen || !c) return foto.cumplido;
  const atras = diferenciaDias(foto.dia, resumen.fecha);
  if (atras === 0) return c.hoy;
  if (c.semana && atras > 0 && atras < c.semana.length) return c.semana[c.semana.length - 1 - atras];
  return foto.cumplido;
}

export function textoMeses(m: number): string {
  return m === 1 ? '1 mes' : `${m} meses`;
}
