import { ESPERANZA_DEFECTO, type ContadorPropio } from './memento.js';
import { ZONA_POR_DEFECTO, zonaValida } from './fechas.js';
import { limpiarNombre, type Rol, type Tema } from './validaciones.js';

/**
 * users/{uid}. El campo `rol` lo escribe solo el servidor (función alCrearUsuario / asignarRol).
 * Las fechas se guardan como milisegundos para que el driver en memoria y Firestore se comporten igual.
 */
export interface Perfil {
  nombre: string;
  correo: string;
  tema: Tema;
  mementoMori: boolean;
  zonaHoraria: string;
  /** Notificaciones push (v0.5). */
  notificaciones: boolean;
  examenHora: string | null; // "HH:MM" para el aviso del examen nocturno
  examenSlot: number | null; // franja UTC de 15 min (versiones anteriores)
  examenMin?: number | null; // minuto UTC del aviso del examen (cualquier minuto)
  notifReacciones: boolean;
  /** Avisos de la actividad de los grupos (si no están, cuentan como activados). */
  notifCumplidos?: boolean;
  notifFotos?: boolean;
  notifMensajes?: boolean;
  /** Memento mori (privado: nunca va a accounts ni a los grupos). */
  nacimiento?: string | null;
  esperanzaVida?: number;
  contadores?: ContadorPropio[];
  creado: number;
  actualizado: number;
  actualizadoPor: string;
  rol?: Rol;
}

export type CambiosPerfil = Partial<Pick<Perfil, 'nombre' | 'tema' | 'mementoMori' | 'zonaHoraria' | 'notificaciones' | 'examenHora' | 'examenSlot' | 'examenMin' | 'notifReacciones' | 'notifCumplidos' | 'notifFotos' | 'notifMensajes' | 'nacimiento' | 'esperanzaVida' | 'contadores'>>;

/** Campos que la app puede escribir en users/{uid}. Debe coincidir con firestore.rules. */
export const CAMPOS_PERFIL = ['nombre', 'correo', 'tema', 'mementoMori', 'zonaHoraria', 'notificaciones', 'examenHora', 'examenSlot', 'examenMin', 'notifReacciones', 'notifCumplidos', 'notifFotos', 'notifMensajes', 'nacimiento', 'esperanzaVida', 'contadores', 'creado', 'actualizado', 'actualizadoPor'] as const;

export function perfilInicial(uid: string, nombre: string, correo: string, zona: string, ahora: number): Perfil {
  return {
    nombre: limpiarNombre(nombre).slice(0, 40) || 'Estoico',
    correo: correo.trim().toLowerCase(),
    tema: 'oscuro',
    mementoMori: true,
    zonaHoraria: zonaValida(zona) ? zona : ZONA_POR_DEFECTO,
    notificaciones: false,
    examenHora: '22:00',
    examenSlot: null,
    notifReacciones: true,
    creado: ahora,
    actualizado: ahora,
    actualizadoPor: uid,
  };
}

export function inicial(nombre: string): string {
  return (limpiarNombre(nombre).charAt(0) || 'S').toUpperCase();
}

export function primerNombre(nombre: string): string {
  return limpiarNombre(nombre).split(' ')[0] ?? '';
}

/** Plataforma aproximada para accounts/{uid} (sin guardar el user agent completo). */
export function plataformaDe(ua: string, instalada: boolean): string {
  const s = ua.toLowerCase();
  const so = /iphone|ipad|ipod/.test(s) ? 'iOS' : /android/.test(s) ? 'Android' : /windows/.test(s) ? 'Windows' : /mac os/.test(s) ? 'macOS' : /linux/.test(s) ? 'Linux' : 'Otro';
  return `${so} · ${instalada ? 'app' : 'web'}`;
}

/** Completa con valores por defecto los campos que no existían en versiones anteriores. */
export function completarPerfil(p: Partial<Perfil>): Perfil {
  return {
    nombre: p.nombre ?? 'Estoico',
    correo: p.correo ?? '',
    tema: p.tema ?? 'oscuro',
    mementoMori: p.mementoMori ?? true,
    zonaHoraria: p.zonaHoraria ?? ZONA_POR_DEFECTO,
    notificaciones: p.notificaciones ?? false,
    examenHora: p.examenHora === undefined ? '22:00' : p.examenHora,
    examenSlot: p.examenSlot ?? null,
    notifReacciones: p.notifReacciones ?? true,
    ...(p.notifCumplidos !== undefined ? { notifCumplidos: p.notifCumplidos } : {}),
    ...(p.notifFotos !== undefined ? { notifFotos: p.notifFotos } : {}),
    ...(p.notifMensajes !== undefined ? { notifMensajes: p.notifMensajes } : {}),
    ...(p.examenMin !== undefined ? { examenMin: p.examenMin } : {}),
    nacimiento: p.nacimiento ?? null,
    esperanzaVida: p.esperanzaVida ?? ESPERANZA_DEFECTO,
    contadores: p.contadores ?? [],
    creado: p.creado ?? 0,
    actualizado: p.actualizado ?? 0,
    actualizadoPor: p.actualizadoPor ?? '',
    ...(p.rol ? { rol: p.rol } : {}),
  };
}

/**
 * Rango y nivel (familia estoica, como TITANUS): se ganan con medallas del jardín
 * (cada 30 días seguidos de un hábito es una medalla). Nivel = medallas + 1.
 */
export const RANGOS: ReadonlyArray<{ nombre: string; desde: number }> = [
  { nombre: 'Aprendiz', desde: 0 },
  { nombre: 'Discípulo', desde: 1 },
  { nombre: 'Practicante', desde: 3 },
  { nombre: 'Filósofo', desde: 6 },
  { nombre: 'Sabio', desde: 12 },
  { nombre: 'Maestro', desde: 24 },
  { nombre: 'Estoico', desde: 48 },
];

export function rangoDe(medallas: number): { nombre: string; nivel: number; siguiente: { nombre: string; faltan: number } | null } {
  const m = Math.max(0, Math.floor(medallas));
  let i = 0;
  while (i + 1 < RANGOS.length && m >= RANGOS[i + 1].desde) i++;
  const sig = RANGOS[i + 1];
  return { nombre: RANGOS[i].nombre, nivel: m + 1, siguiente: sig ? { nombre: sig.nombre, faltan: sig.desde - m } : null };
}
