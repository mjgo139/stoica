/**
 * El Espejo · Progreso: la estatua avanza hacia tu meta con la constancia en los hábitos que elegiste.
 *
 * Reglas (pensadas para que se entiendan en una frase cada una):
 * 1. Un día cuenta como CUMPLIDO si hiciste todos los hábitos elegidos que tocaban ese día.
 *    (Días en que no tocaba ninguno no cuentan ni a favor ni en contra; hoy cuenta recién cuando lo cumplís.)
 * 2. Cada día cumplido suma 1 punto de constancia.
 * 3. Cada DIAS_POR_ETAPA puntos la estatua avanza una etapa hacia la meta (de a poco, no de golpe).
 * 4. Fallar un día corta la racha pero no te hace retroceder. Desde el 3.er día seguido sin cumplir,
 *    cada día más resta 1 punto (la estatua vuelve un poco para atrás). Nunca baja de tu etapa inicial.
 */
import { sumarDias } from './fechas.js';
import { cumplido, esDiaActivo, type Habito, type MapaRegistros } from './habitos.js';

export const DIAS_POR_ETAPA = 10;
/** Días seguidos sin cumplir que se perdonan antes de empezar a retroceder. */
export const DIAS_DE_GRACIA = 2;

export type ResultadoDia = 'cumplido' | 'fallado' | 'libre' | 'pendiente';

export const CAMINOS = {
  cuerpo: {
    nombre: 'Mejorar tu cuerpo',
    etapas: [
      { id: 'lean', nombre: 'Delgado' },
      { id: 'athletic', nombre: 'Atlético' },
      { id: 'normal', nombre: 'Normal' },
      { id: 'rellenito', nombre: 'Rellenito' },
      { id: 'sobrepeso', nombre: 'Con sobrepeso' },
      { id: 'obeso', nombre: 'Obeso' },
      { id: 'muy_obeso', nombre: 'Muy obeso' },
    ],
    /** La meta del camino del cuerpo es siempre el Atlético. */
    meta: 1,
  },
  musculo: {
    nombre: 'Ganar músculo',
    etapas: [
      { id: 'athletic', nombre: 'Atlético' },
      { id: 'musculoso', nombre: 'Musculoso' },
      { id: 'bodybuilder', nombre: 'Fisicoculturista' },
    ],
    meta: 2,
  },
} as const;
export type Camino = keyof typeof CAMINOS;

export interface ConfigProgreso {
  camino: Camino;
  /** Índice de la etapa en la que estás hoy (dentro del camino). */
  desde: number;
  /** Índice de la etapa meta. */
  meta: number;
  habitos: string[];
  /** Fecha (clave de día) en que empezaste. */
  inicio: string;
}

/** Resultado de cada día desde `inicio` hasta `hoy` (inclusive). */
export function diasDesde(habitos: Habito[], registros: Map<string, MapaRegistros>, inicio: string, hoy: string): ResultadoDia[] {
  const out: ResultadoDia[] = [];
  for (let dia = inicio; dia <= hoy; dia = sumarDias(dia, 1)) {
    const activos = habitos.filter((h) => !h.archivado && dia >= h.inicio && esDiaActivo(h, dia));
    if (!activos.length) {
      out.push('libre');
      continue;
    }
    const todos = activos.every((h) => {
      const m = registros.get(h.id);
      const r = m ? (m instanceof Map ? m.get(dia) : m[dia]) : undefined;
      return cumplido(h, r);
    });
    out.push(todos ? 'cumplido' : dia === hoy ? 'pendiente' : 'fallado');
  }
  return out;
}

export interface Avance {
  puntos: number;
  racha: number;
  cumplidos: number;
  fallados: number;
  /** Posición continua en el camino (índice con decimales). */
  posicion: number;
  /** Etapa entera alcanzada (la última completada). */
  etapa: number;
  /** Próxima etapa (o null si ya llegaste a la meta). */
  siguiente: number | null;
  /** Puntos dentro de la etapa actual (0..DIAS_POR_ETAPA). */
  enEtapa: number;
  /** Días cumplidos que faltan para la próxima etapa y para la meta. */
  faltanEtapa: number;
  faltanMeta: number;
  /** Cuántos días seguidos lleva sin cumplir (para avisar antes de que empiece a retroceder). */
  sinCumplir: number;
  llegaste: boolean;
}

export function calcularAvance(c: Pick<ConfigProgreso, 'desde' | 'meta'>, dias: ResultadoDia[], diasPorEtapa = DIAS_POR_ETAPA): Avance {
  let puntos = 0;
  let sinCumplir = 0;
  let cumplidos = 0;
  let fallados = 0;
  const tramos = Math.abs(c.meta - c.desde);
  const tope = tramos * diasPorEtapa;
  for (const d of dias) {
    if (d === 'cumplido') {
      puntos = Math.min(tope, puntos + 1);
      sinCumplir = 0;
      cumplidos++;
    } else if (d === 'fallado') {
      sinCumplir++;
      fallados++;
      if (sinCumplir > DIAS_DE_GRACIA) puntos = Math.max(0, puntos - 1);
    }
  }
  // Racha: días cumplidos seguidos contando desde el final (los libres y el de hoy pendiente no cortan).
  let racha = 0;
  for (let i = dias.length - 1; i >= 0; i--) {
    const d = dias[i];
    if (d === 'cumplido') racha++;
    else if (d === 'fallado') break;
  }
  const signo = Math.sign(c.meta - c.desde);
  const avanzado = tramos === 0 ? 0 : puntos / diasPorEtapa;
  const etapasHechas = Math.floor(avanzado + 1e-9);
  const llegaste = puntos >= tope;
  const enEtapa = llegaste ? diasPorEtapa : puntos - etapasHechas * diasPorEtapa;
  return {
    puntos,
    racha,
    cumplidos,
    fallados,
    posicion: c.desde + signo * avanzado,
    etapa: c.desde + signo * etapasHechas,
    siguiente: llegaste ? null : c.desde + signo * (etapasHechas + 1),
    enEtapa,
    faltanEtapa: llegaste ? 0 : diasPorEtapa - enEtapa,
    faltanMeta: tope - puntos,
    sinCumplir,
    llegaste,
  };
}

/** Días simulados para el modo de prueba: n días con cierto porcentaje de cumplimiento (determinista). */
export function simularDias(n: number, porcentaje: number, semilla = 1): ResultadoDia[] {
  let s = semilla;
  const azar = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: n }, () => (azar() * 100 < porcentaje ? 'cumplido' : 'fallado'));
}
