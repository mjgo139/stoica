/** Tareas, enfoque y examen nocturno. */
import { esClaveDia, esHora } from './fechas.js';
import { limpiarNombre } from './validaciones.js';
import type { Momento, Virtud } from './habitos.js';

export interface Tarea {
  id: string;
  titulo: string;
  dependeDeTi: boolean;
  momento: Momento;
  fecha: string | null; // null = sin fecha
  repetir: 'no' | 'diaria';
  /** Proyecto al que pertenece (v1.1). */
  proyectoId?: string | null;
  /** Hora local "HH:MM" del aviso (solo con fecha o diaria) y su minuto UTC para el servidor. */
  hora?: string | null;
  avisoMin?: number | null;
  /** Tareas que no se repiten: día en que se completó (null = pendiente). */
  completada?: string | null;
  creado: number;
  actualizado: number;
  actualizadoPor: string;
}

/** projects/{id}: un proyecto agrupa varias tareas. */
export interface Proyecto {
  id: string;
  nombre: string;
  virtud: Virtud;
  fechaLimite: string | null;
  archivado: boolean;
  creado: number;
  actualizado: number;
  actualizadoPor: string;
}

export function validarProyecto(p: Partial<Proyecto>): string | null {
  const nombre = limpiarNombre(p.nombre ?? '');
  if (!nombre) return 'Poné un nombre al proyecto.';
  if (nombre.length > 60) return 'El nombre puede tener hasta 60 letras.';
  if (p.fechaLimite !== null && p.fechaLimite !== undefined && !esClaveDia(p.fechaLimite)) return 'La fecha límite no es válida.';
  return null;
}

/**
 * ¿Está hecha la tarea ese día? Las diarias se marcan por día (taskDone); las demás, en la tarea misma
 * (`completada`). `hechas` son los ids taskId_fecha marcados (incluye marcas de versiones anteriores).
 */
export function tareaHecha(t: Tarea, dia: string, hechas: Set<string>): boolean {
  if (t.repetir === 'diaria') return hechas.has(idTareaHecha(t.id, dia));
  if (t.completada !== undefined && t.completada !== null) return true;
  if (t.completada === null) return false;
  // Versiones anteriores: la marca está en taskDone.
  if (t.fecha) return hechas.has(idTareaHecha(t.id, t.fecha));
  for (const k of hechas) if (k.startsWith(`${t.id}_`)) return true;
  return false;
}

/** Avance de un proyecto: tareas hechas sobre el total (las que no dependen de vos no cuentan). */
export function avanceProyecto(tareas: Tarea[], hoy: string, hechas: Set<string>): { hechas: number; total: number } {
  const cuentan = tareas.filter((t) => t.dependeDeTi);
  return { hechas: cuentan.filter((t) => tareaHecha(t, hoy, hechas)).length, total: cuentan.length };
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
  if (t.hora) {
    if (!esHora(t.hora)) return 'La hora del aviso no es válida.';
    if (!t.fecha && t.repetir !== 'diaria') return 'Para avisarte a una hora, la tarea necesita una fecha.';
  }
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
