/** Comunidad: grupos privados, resumen compartido, reacciones y desafíos. */
import type { Virtud } from './habitos.js';
import { limpiarNombre } from './validaciones.js';
import { diferenciaDias, sumarDias } from './fechas.js';

export const MAX_MIEMBROS = 20;
export const MAX_GRUPOS_POR_USUARIO = 10;

export const REACCIONES = [
  { id: 'laurel', simbolo: '🌿', texto: 'Laurel' },
  { id: 'fuerza', simbolo: '💪', texto: 'Fuerza' },
  { id: 'bien', simbolo: '👏', texto: 'Bien hecho' },
  { id: 'animo', simbolo: '🔥', texto: 'Ánimo' },
  { id: 'calma', simbolo: '🕊️', texto: 'Serenidad' },
] as const;
export type TipoReaccion = (typeof REACCIONES)[number]['id'];
export const IDS_REACCION = REACCIONES.map((r) => r.id) as string[];

/** groups/{id} (lo escribe solo el servidor) */
export interface Grupo {
  id: string;
  nombre: string;
  creador: string;
  codigo: string;
  miembros: string[];
  creado: number;
  /** Plan con fotos y chat (lo escribe el servidor al canjear un código). */
  premiumHasta?: number;
  /** Marcas de avisos ya enviados para este vencimiento (servidor). */
  avisoPorVencer?: number;
  avisoVencido?: number;
  avisoBorrado?: number;
  premiumBorrado?: number;
}

/** Lo que cada uno comparte de un hábito. Nunca valores reales de medición ni el examen. */
export interface Compartido {
  habitId: string;
  nombre: string;
  icono: string;
  virtud: Virtud;
  hoy: boolean;
  racha: number;
  porcentaje: number;
  /** Últimos 7 días (del más viejo a `fecha` del resumen): solo cumplió / no cumplió. */
  semana?: boolean[];
}

/**
 * Corre la semana compartida al día de hoy: si el resumen es de hace N días, los últimos N quedan
 * sin dato (null) porque esa persona todavía no abrió la app.
 */
export function semanaAlDia(semana: boolean[] | undefined, fecha: string, hoy: string): Array<boolean | null> {
  const base = semana && semana.length === 7 ? semana : Array<boolean | null>(7).fill(null);
  const n = Math.max(0, Math.min(7, diferenciaDias(fecha, hoy)));
  return [...base.slice(n), ...Array<boolean | null>(n).fill(null)];
}

/** groups/{id}/members/{uid} */
export interface Miembro {
  nombre: string;
  compartidos: Compartido[];
  fecha: string; // día del resumen
  actualizado: number;
  actualizadoPor: string;
}

/** groups/{id}/reactions/{día}_{de}_{para} */
export interface Reaccion {
  de: string;
  para: string;
  dia: string;
  tipo: TipoReaccion;
  nombreDe: string;
  actualizado: number;
  actualizadoPor: string;
}

export const idReaccion = (dia: string, de: string, para: string) => `${dia}_${de}_${para}`;

/** groups/{id}/challenges/{cid} */
export interface Desafio {
  id: string;
  titulo: string;
  virtud: Virtud;
  duracion: number; // días
  meta: number; // días cumplidos para lograrlo
  inicio: string;
  creador: string;
  actualizado: number;
  actualizadoPor: string;
}

/** groups/{id}/challenges/{cid}/progress/{uid} */
export interface Progreso {
  nombre: string;
  habitId: string;
  cumplidos: number;
  actualizado: number;
  actualizadoPor: string;
}

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generarCodigo(aleatorio: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += ALFABETO[Math.floor(aleatorio() * ALFABETO.length)];
  return s;
}

export function normalizarCodigo(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

export function esCodigo(s: string): boolean {
  return /^[A-HJ-NP-Z2-9]{8}$/.test(s);
}

export function validarNombreGrupo(s: string): string | null {
  const n = limpiarNombre(s);
  if (!n) return 'Ponele un nombre al grupo.';
  if (n.length > 40) return 'El nombre puede tener hasta 40 letras.';
  return null;
}

export function validarDesafio(d: Partial<Desafio>): string | null {
  const t = limpiarNombre(d.titulo ?? '');
  if (!t) return 'Ponele un nombre al desafío.';
  if (t.length > 60) return 'El nombre puede tener hasta 60 letras.';
  if (!Number.isInteger(d.duracion) || (d.duracion ?? 0) < 3 || (d.duracion ?? 0) > 365) return 'La duración va de 3 a 365 días.';
  if (!Number.isInteger(d.meta) || (d.meta ?? 0) < 1 || (d.meta ?? 0) > (d.duracion ?? 0)) return 'La meta tiene que estar entre 1 y la duración.';
  return null;
}

export function finDesafio(d: Pick<Desafio, 'inicio' | 'duracion'>): string {
  return sumarDias(d.inicio, d.duracion - 1);
}

export function estadoDesafio(d: Pick<Desafio, 'inicio' | 'duracion'>, hoy: string): { estado: 'proximo' | 'activo' | 'terminado'; dia: number; quedan: number } {
  const fin = finDesafio(d);
  if (hoy < d.inicio) return { estado: 'proximo', dia: 0, quedan: diferenciaDias(hoy, d.inicio) };
  if (hoy > fin) return { estado: 'terminado', dia: d.duracion, quedan: 0 };
  return { estado: 'activo', dia: diferenciaDias(d.inicio, hoy) + 1, quedan: diferenciaDias(hoy, fin) };
}
