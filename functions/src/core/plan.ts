/**
 * Plan de pago por grupo: fotos y chat dentro de cada desafío.
 * Se activa con un código que genera el admin. Al vencer hay unos días de espera (configurables)
 * en los que todo se ve pero no se puede agregar nada; después se borra definitivamente.
 */
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

/** groups/{gid}/challenges/{cid}/posts/{pid}: mensaje o foto. */
export interface Publicacion {
  de: string;
  nombre: string;
  tipo: 'texto' | 'foto';
  texto: string;
  dia: string;
  /** Fotos: direcciones de descarga y rutas en Storage (las escribe el servidor). */
  fotoUrl?: string;
  miniUrl?: string;
  rutas?: string[];
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

/** Id de la foto del día: una por persona, por desafío y por día (si sube otra, reemplaza). */
export const idFoto = (uid: string, dia: string) => `foto_${uid}_${dia}`;

export function textoMeses(m: number): string {
  return m === 1 ? '1 mes' : `${m} meses`;
}
