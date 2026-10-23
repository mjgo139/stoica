/** Tareas, enfoque y examen nocturno. */
import { esClaveDia } from './fechas.js';
import { limpiarNombre } from './validaciones.js';
import type { Momento } from './habitos.js';

export interface Tarea {
  id: string;
  titulo: string;
  dependeDeTi: boolean;
  momento: Momento;
  fecha: string | null; // null = sin fecha
  repetir: 'no' | 'diaria';
  creado: number;
  actualizado: number;
  actualizadoPor: string;
}

/** taskDone/{taskId}_{fecha} */
export interface TareaHecha {
  taskId: string;
  fecha: string;
  /** false = se desmarcó (se guarda en vez de borrar, para la lectura incremental). */
  hecha?: boolean;
  actualizado: number;
  actualizadoPor: string;
}

export const idTareaHecha = (taskId: string, fecha: string) => `${taskId}_${fecha}`;

export function validarTarea(t: Partial<Tarea>): string | null {
  const titulo = limpiarNombre(t.titulo ?? '');
  if (!titulo) return 'Escribí la tarea.';
  if (titulo.length > 120) return 'La tarea puede tener hasta 120 letras.';
  if (typeof t.dependeDeTi !== 'boolean') return 'Contestá si depende de ti.';
  if (t.fecha !== null && t.fecha !== undefined && !esClaveDia(t.fecha)) return 'La fecha no es válida.';
  return null;
}

/** ¿La tarea corresponde a este día? Las diarias, siempre desde su fecha; las demás, su fecha; las sin fecha, siempre. */
export function tareaDelDia(t: Tarea, dia: string): boolean {
  if (t.repetir === 'diaria') return !t.fecha || t.fecha <= dia;
  if (!t.fecha) return true;
  return t.fecha === dia;
}

export function tareaVencida(t: Tarea, hecha: boolean, hoy: string): boolean {
  return !hecha && t.repetir === 'no' && !!t.fecha && t.fecha < hoy;
}

// ---------- Enfoque ----------
export const TIPOS_ENFOQUE = ['enfoque', 'descanso', 'meditacion'] as const;
export type TipoEnfoque = (typeof TIPOS_ENFOQUE)[number];
export const NOMBRE_ENFOQUE: Record<TipoEnfoque, string> = { enfoque: 'Enfoque', descanso: 'Descanso', meditacion: 'Meditación' };

export interface SesionEnfoque {
  id: string;
  tipo: TipoEnfoque;
  minutos: number;
  etiqueta: string;
  fecha: string;
  inicio: number;
  actualizado: number;
  actualizadoPor: string;
}

/** Restante en segundos de un temporizador que arrancó en `inicio` (ms) y dura `minutos`. */
export function restante(inicio: number, minutos: number, ahora: number, pausadoAcumulado = 0): number {
  return Math.max(0, Math.ceil((inicio + minutos * 60000 + pausadoAcumulado - ahora) / 1000));
}

export function mmss(seg: number): string {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ---------- Examen nocturno ----------
export const PREGUNTAS_EXAMEN = [
  { id: 'p1', texto: '¿Qué mal he corregido hoy?' },
  { id: 'p2', texto: '¿Qué impulso he resistido?' },
  { id: 'p3', texto: '¿En qué soy hoy mejor que ayer?' },
] as const;

/** journal/{fecha} */
export interface Examen {
  fecha: string;
  respuestas: { p1: string; p2: string; p3: string };
  libre: string;
  actualizado: number;
  actualizadoPor: string;
}

export const LIMITE_RESPUESTA = 1000;

export function examenVacio(fecha: string, uid: string): Examen {
  return { fecha, respuestas: { p1: '', p2: '', p3: '' }, libre: '', actualizado: Date.now(), actualizadoPor: uid };
}

export function examenCompleto(e: Examen | undefined | null): boolean {
  return !!e && PREGUNTAS_EXAMEN.some((p) => e.respuestas[p.id].trim().length > 0);
}
