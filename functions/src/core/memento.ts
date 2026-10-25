/** Memento mori: cuánto viviste, cuánto queda probablemente y contadores propios. Todo se calcula en el celular. */
import { diferenciaDias, esClaveDia, partesDeClave } from './fechas.js';
import { limpiarNombre } from './validaciones.js';

/** Esperanza de vida al nacer en Paraguay: 73,4 años (INE, 2020). Cada persona puede cambiarla. */
export const ESPERANZA_DEFECTO = 73;
export const MAX_CONTADORES = 5;
export const SEMANAS_POR_ANIO = 52;

export interface ContadorPropio {
  id: string;
  nombre: string;
  fecha: string;
}

const dos = (n: number) => String(n).padStart(2, '0');
const clave = (a: number, m: number, d: number) => `${a}-${dos(m)}-${dos(d)}`;

/** Misma fecha N años después (29 de febrero → 28 si el año no es bisiesto). */
export function sumarAnios(fecha: string, n: number): string {
  const { anio, mes, dia } = partesDeClave(fecha);
  const a = anio + n;
  const ultimo = new Date(Date.UTC(a, mes, 0)).getUTCDate();
  return clave(a, mes, Math.min(dia, ultimo));
}

export interface Vida {
  anios: number;
  meses: number;
  dias: number;
  diasVividos: number;
  semanasVividas: number;
  semanasTotales: number;
  diasRestantes: number;
  aniosRestantes: number;
  porcentaje: number;
}

export function calcularVida(nacimiento: string, hoy: string, esperanza: number = ESPERANZA_DEFECTO): Vida {
  const n = partesDeClave(nacimiento);
  const h = partesDeClave(hoy);
  let anios = h.anio - n.anio;
  let meses = h.mes - n.mes;
  let dias = h.dia - n.dia;
  if (dias < 0) {
    meses--;
    dias += new Date(Date.UTC(h.anio, h.mes - 1, 0)).getUTCDate();
  }
  if (meses < 0) {
    anios--;
    meses += 12;
  }
  const diasVividos = Math.max(0, diferenciaDias(nacimiento, hoy));
  const fin = sumarAnios(nacimiento, esperanza);
  const diasRestantes = Math.max(0, diferenciaDias(hoy, fin));
  const total = Math.max(1, diferenciaDias(nacimiento, fin));
  return {
    anios,
    meses,
    dias,
    diasVividos,
    semanasVividas: Math.floor(diasVividos / 7),
    semanasTotales: esperanza * SEMANAS_POR_ANIO,
    diasRestantes,
    aniosRestantes: Math.round((diasRestantes / 365.25) * 10) / 10,
    porcentaje: Math.min(100, Math.round((diasVividos / total) * 1000) / 10),
  };
}

/** Días hasta una fecha (negativo si ya pasó). */
export const diasHasta = (fecha: string, hoy: string) => diferenciaDias(hoy, fecha);

export function proximoCumple(nacimiento: string, hoy: string): { fecha: string; dias: number; cumple: number } {
  const n = partesDeClave(nacimiento);
  const h = partesDeClave(hoy);
  let fecha = sumarAnios(nacimiento, h.anio - n.anio);
  if (fecha < hoy) fecha = sumarAnios(nacimiento, h.anio - n.anio + 1);
  return { fecha, dias: diferenciaDias(hoy, fecha), cumple: partesDeClave(fecha).anio - n.anio };
}

export function finDeAnio(hoy: string): { fecha: string; dias: number; anio: number } {
  const anio = partesDeClave(hoy).anio + 1;
  const fecha = clave(anio, 1, 1);
  return { fecha, dias: diferenciaDias(hoy, fecha), anio };
}

export function validarNacimiento(fecha: string, hoy: string): string | null {
  if (!esClaveDia(fecha)) return 'Elegí tu fecha de nacimiento.';
  if (fecha > hoy) return 'La fecha no puede ser futura.';
  if (partesDeClave(fecha).anio < 1900) return 'Revisá el año.';
  return null;
}

export function validarEsperanza(n: number): string | null {
  return Number.isInteger(n) && n >= 40 && n <= 120 ? null : 'La esperanza de vida va de 40 a 120 años.';
}

export function validarContador(c: Partial<ContadorPropio>): string | null {
  const nombre = limpiarNombre(c.nombre ?? '');
  if (!nombre) return 'Ponele un nombre.';
  if (nombre.length > 40) return 'El nombre puede tener hasta 40 letras.';
  if (!c.fecha || !esClaveDia(c.fecha)) return 'Elegí una fecha.';
  return null;
}
