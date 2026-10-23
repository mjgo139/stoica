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
  creado: number;
  actualizado: number;
  actualizadoPor: string;
  rol?: Rol;
}

export type CambiosPerfil = Partial<Pick<Perfil, 'nombre' | 'tema' | 'mementoMori' | 'zonaHoraria'>>;

/** Campos que la app puede escribir en users/{uid}. Debe coincidir con firestore.rules. */
export const CAMPOS_PERFIL = ['nombre', 'correo', 'tema', 'mementoMori', 'zonaHoraria', 'creado', 'actualizado', 'actualizadoPor'] as const;

export function perfilInicial(uid: string, nombre: string, correo: string, zona: string, ahora: number): Perfil {
  return {
    nombre: limpiarNombre(nombre).slice(0, 40) || 'Estoico',
    correo: correo.trim().toLowerCase(),
    tema: 'sistema',
    mementoMori: true,
    zonaHoraria: zonaValida(zona) ? zona : ZONA_POR_DEFECTO,
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
