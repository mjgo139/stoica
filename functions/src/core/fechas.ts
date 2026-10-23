/**
 * Fechas con zona horaria. Todo el día "lógico" del usuario se calcula
 * en su zona (por defecto America/Asuncion), nunca en UTC.
 */
export const ZONA_POR_DEFECTO = 'America/Asuncion';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export interface PartesFecha {
  anio: number;
  mes: number; // 1-12
  dia: number;
  hora: number;
  diaSemana: number; // 0 = domingo
}

export function zonaValida(zona: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zona });
    return true;
  } catch {
    return false;
  }
}

export function partesEnZona(fecha: Date, zona: string = ZONA_POR_DEFECTO): PartesFecha {
  const z = zonaValida(zona) ? zona : ZONA_POR_DEFECTO;
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: z,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(fecha)) p[x.type] = x.value;
  const semana = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { anio: +p.year, mes: +p.month, dia: +p.day, hora: +p.hour % 24, diaSemana: semana };
}

const dos = (n: number) => String(n).padStart(2, '0');

/** Clave del día en formato AAAA-MM-DD, en la zona del usuario. */
export function claveDia(fecha: Date, zona: string = ZONA_POR_DEFECTO): string {
  const p = partesEnZona(fecha, zona);
  return `${p.anio}-${dos(p.mes)}-${dos(p.dia)}`;
}

export function esClaveDia(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [a, m, d] = s.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

/** Días que faltan para terminar el año (incluye el día de hoy como vivido). */
export function diasRestantesDelAnio(fecha: Date, zona: string = ZONA_POR_DEFECTO): number {
  const p = partesEnZona(fecha, zona);
  const hoy = Date.UTC(p.anio, p.mes - 1, p.dia);
  const fin = Date.UTC(p.anio, 11, 31);
  return Math.round((fin - hoy) / 864e5);
}

export function saludo(hora: number): string {
  if (hora >= 5 && hora < 12) return 'Buenos días';
  if (hora >= 12 && hora < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

/** "Jueves 22 de octubre" */
export function fechaLarga(fecha: Date, zona: string = ZONA_POR_DEFECTO): string {
  const p = partesEnZona(fecha, zona);
  const dia = DIAS[p.diaSemana];
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${p.dia} de ${MESES[p.mes - 1]}`;
}

/** Momento del día según la hora: I · Al amanecer, II · Durante el día, III · Al anochecer. */
export function momentoDelDia(hora: number): 0 | 1 | 2 {
  if (hora < 5) return 2; // de madrugada todavía es "la noche" del día anterior
  if (hora < 12) return 0;
  if (hora >= 19) return 2;
  return 1;
}

export const MOMENTOS = ['I · Al amanecer', 'II · Durante el día', 'III · Al anochecer'] as const;

// ---------- Aritmética con claves de día (AAAA-MM-DD), sin zona horaria ----------
const aUTC = (clave: string) => {
  const [a, m, d] = clave.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
};
const deUTC = (ms: number) => {
  const f = new Date(ms);
  return `${f.getUTCFullYear()}-${dos(f.getUTCMonth() + 1)}-${dos(f.getUTCDate())}`;
};

export function sumarDias(clave: string, n: number): string {
  return deUTC(aUTC(clave) + n * 864e5);
}

/** b - a en días. */
export function diferenciaDias(a: string, b: string): number {
  return Math.round((aUTC(b) - aUTC(a)) / 864e5);
}

/** 0 = domingo. */
export function diaSemanaDeClave(clave: string): number {
  return new Date(aUTC(clave)).getUTCDay();
}

export function partesDeClave(clave: string): { anio: number; mes: number; dia: number } {
  const [anio, mes, dia] = clave.split('-').map(Number);
  return { anio, mes, dia };
}

/** Claves desde `desde` hasta `hasta` inclusive. */
export function rangoDias(desde: string, hasta: string): string[] {
  const n = diferenciaDias(desde, hasta);
  const out: string[] = [];
  for (let i = 0; i <= n; i++) out.push(sumarDias(desde, i));
  return out;
}

export const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;
export const DIAS_LETRA = ['D', 'L', 'M', 'M', 'J', 'V', 'S'] as const;
export const MESES_NOMBRE = MESES;

/** "22 oct" */
export function fechaCorta(clave: string): string {
  const { mes, dia } = partesDeClave(clave);
  return `${dia} ${MESES[mes - 1].slice(0, 3)}`;
}

/** "Jueves 22 de octubre" a partir de una clave. */
export function fechaLargaDeClave(clave: string): string {
  const { mes, dia } = partesDeClave(clave);
  const d = DIAS[diaSemanaDeClave(clave)];
  return `${d.charAt(0).toUpperCase()}${d.slice(1)} ${dia} de ${MESES[mes - 1]}`;
}

// ---------- Horas y recordatorios ----------
export function esHora(s: unknown): s is string {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

/** Minutos de diferencia entre la zona y UTC en una fecha (Asunción = -180). */
export function desfaseMinutos(zona: string, fecha: Date = new Date()): number {
  const z = zonaValida(zona) ? zona : ZONA_POR_DEFECTO;
  const f = new Intl.DateTimeFormat('en-US', { timeZone: z, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
  const p: Record<string, number> = {};
  for (const x of f.formatToParts(fecha)) if (x.type !== 'literal') p[x.type] = Number(x.value);
  const local = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute);
  const utc = Math.floor(fecha.getTime() / 60000) * 60000;
  return Math.round((local - utc) / 60000);
}

/**
 * Franja UTC de 15 minutos (0..95) para una hora local. La función programada corre
 * cada 15 minutos y busca los recordatorios de su franja.
 */
export function franjaUTC(hora: string, zona: string, fecha: Date = new Date()): number {
  const [h, m] = hora.split(':').map(Number);
  const min = (((h * 60 + m - desfaseMinutos(zona, fecha)) % 1440) + 1440) % 1440;
  return Math.floor(min / 15);
}

export function franjaActual(fecha: Date = new Date()): number {
  return Math.floor((fecha.getUTCHours() * 60 + fecha.getUTCMinutes()) / 15);
}

/** Horas cada 15 minutos para elegir recordatorios. */
export const HORAS_15: string[] = Array.from({ length: 96 }, (_, i) => `${dos(Math.floor(i / 4))}:${dos((i % 4) * 15)}`);
