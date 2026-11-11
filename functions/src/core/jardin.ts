/**
 * Jardín estoico: cada hábito es una planta que crece con la racha y se marchita si lo dejás.
 *
 * Reglas (las mismas que se explican en la pantalla):
 * - Días buenos sin marchitarse: 0 → semilla · 1 a 3 → brote · 4 a 10 → planta chica · 11 a 29 → planta grande · 30 o más → florecida.
 * - 3 días activos seguidos sin cumplir → se marchita. Al volver a cumplir, revive como brote y vuelve a crecer.
 */
import { sumarDias } from './fechas.js';
import { cumplido, esDiaActivo, racha as rachaDe, type Habito, type MapaRegistros, type Virtud } from './habitos.js';

export const ETAPAS_PLANTA = ['Semilla', 'Brote', 'Planta chica', 'Planta grande', 'Florecida', 'Marchita'] as const;
export const MARCHITA = 5;
/** Días seguidos sin cumplir para que se marchite. */
export const DIAS_PARA_MARCHITAR = 3;
/** Desde cuántos días de racha empieza cada etapa (semilla, brote, chica, grande, florecida). */
export const UMBRALES = [0, 1, 4, 11, 30] as const;

export const PLANTA_DE_VIRTUD: Record<Virtud, { id: string; nombre: string }> = {
  sabiduria: { id: 'olivo', nombre: 'Olivo' },
  coraje: { id: 'laurel', nombre: 'Laurel' },
  justicia: { id: 'granado', nombre: 'Granado' },
  templanza: { id: 'lavanda', nombre: 'Lavanda' },
};

/** Etapa de la planta según la racha y los días seguidos sin cumplir. */
export function etapaPlanta(racha: number, sinCumplir: number): number {
  if (sinCumplir >= DIAS_PARA_MARCHITAR) return MARCHITA;
  let e = 0;
  UMBRALES.forEach((u, i) => {
    if (racha >= u) e = i;
  });
  return e;
}

/** Días que faltan para la próxima etapa (null si ya está florecida o marchita). */
export function faltanParaCrecer(racha: number, etapa: number): number | null {
  if (etapa >= 4) return null;
  return UMBRALES[etapa + 1] - racha;
}

/** Días activos seguidos sin cumplir, contando hacia atrás desde ayer (hoy todavía se puede cumplir). */
export function diasSinCumplir(h: Habito, registros: MapaRegistros, hoy: string, ventana = 60): number {
  const leer = (d: string) => (registros instanceof Map ? registros.get(d) : registros[d]);
  if (esDiaActivo(h, hoy) && cumplido(h, leer(hoy))) return 0;
  let n = 0;
  let dia = sumarDias(hoy, -1);
  for (let i = 0; i < ventana; i++, dia = sumarDias(dia, -1)) {
    if (dia < h.inicio) break;
    if (!esDiaActivo(h, dia)) continue;
    if (cumplido(h, leer(dia))) break;
    n++;
  }
  return n;
}

export interface EstadoPlanta {
  racha: number;
  sinCumplir: number;
  etapa: number;
}

export function estadoPlanta(h: Habito, registros: MapaRegistros, hoy: string, ventana = 120): EstadoPlanta {
  const r = rachaDe(h, registros, hoy, ventana);
  const s = diasSinCumplir(h, registros, hoy);
  return { racha: r, sinCumplir: s, etapa: etapaPlanta(r, s) };
}

/**
 * Estado según una regla propia de "día bueno" (por ejemplo, riego manual: cumplir el hábito Y regar la planta).
 * Hoy, si todavía no es bueno, no corta nada (se cuenta desde ayer). Los días en que el hábito no toca se saltean.
 */
export function estadoPorDias(h: Pick<Habito, 'dias' | 'inicio'>, hoy: string, bueno: (dia: string) => boolean, ventana = 120): EstadoPlanta {
  let dia = hoy;
  if (!esDiaActivo(h, hoy) || !bueno(hoy)) dia = sumarDias(hoy, -1);
  // Racha
  let racha = 0;
  let d = dia;
  for (let i = 0; i < ventana && d >= h.inicio; i++, d = sumarDias(d, -1)) {
    if (!esDiaActivo(h, d)) continue;
    if (bueno(d)) racha++;
    else break;
  }
  // Días seguidos sin día bueno (desde ayer)
  let sinCumplir = 0;
  if (!(esDiaActivo(h, hoy) && bueno(hoy))) {
    d = sumarDias(hoy, -1);
    for (let i = 0; i < ventana && d >= h.inicio; i++, d = sumarDias(d, -1)) {
      if (!esDiaActivo(h, d)) continue;
      if (bueno(d)) break;
      sinCumplir++;
    }
  }
  return { racha, sinCumplir, etapa: etapaPlanta(racha, sinCumplir) };
}

/** Modo prueba: estado a partir de una secuencia de días inventados (true = cumplido). */
export function estadoSimulado(dias: boolean[]): EstadoPlanta {
  let racha = 0;
  let sinCumplir = 0;
  for (const ok of dias) {
    if (ok) {
      racha++;
      sinCumplir = 0;
    } else {
      racha = 0;
      sinCumplir++;
    }
  }
  return { racha, sinCumplir, etapa: etapaPlanta(racha, sinCumplir) };
}

// ───────────────────────── Medallas, retoños, modo difícil y plagas ─────────────────────────

/**
 * Un día de la historia de una planta: true = día bueno (cumplido, y regado si el riego es manual),
 * false = no, null = ese día el hábito no tocaba.
 */
export type Dia = boolean | null;

export interface Analisis {
  racha: number;
  sinCumplir: number;
  etapa: number;
  /** Mejor racha dentro de la historia mirada. */
  mejor: number;
  /** El ciclo más largo (días buenos sin marchitarse): da las medallas. */
  mejorCiclo: number;
  /** Días buenos desde la última vez que se marchitó (o desde el principio). Es lo que cría retoños. */
  ciclo: number;
  /** Índice del día en que se marchitó por última vez (-1 si nunca). */
  marchitaEn: number;
}

/**
 * Analiza la historia (del día más viejo al de hoy). Si `hoyPendiente`, el último día es hoy y, si todavía
 * no es bueno, no cuenta como fallado.
 */
export function analizar(dias: Dia[], hoyPendiente = true): Analisis {
  const n = dias.length;
  const fin = hoyPendiente && n && dias[n - 1] !== true ? n - 1 : n;
  let racha = 0;
  let mejor = 0;
  let seguidos = 0;
  let ciclo = 0;
  let mejorCiclo = 0;
  let marchitaEn = -1;
  for (let i = 0; i < fin; i++) {
    const d = dias[i];
    if (d === null) continue;
    if (d) {
      racha++;
      mejor = Math.max(mejor, racha);
      seguidos = 0;
      ciclo++;
      mejorCiclo = Math.max(mejorCiclo, ciclo);
    } else {
      racha = 0;
      seguidos++;
      if (seguidos === DIAS_PARA_MARCHITAR) {
        marchitaEn = i;
        ciclo = 0;
      }
    }
  }
  // El tamaño de la planta depende de los días buenos sin marchitarse: fallar 1 o 2 días trae plagas, pero no la achica.
  return { racha, sinCumplir: seguidos, etapa: etapaPlanta(ciclo, seguidos), mejor, mejorCiclo, ciclo, marchitaEn };
}

/** Días buenos a partir de un índice (para el modo difícil, donde cualquier planta marchita reinicia todo). */
export function buenosDesde(dias: Dia[], desde: number, hoyPendiente = true): number {
  const n = dias.length;
  const fin = hoyPendiente && n && dias[n - 1] !== true ? n - 1 : n;
  let c = 0;
  for (let i = Math.max(0, desde + 1); i < fin; i++) if (dias[i] === true) c++;
  return c;
}

/** La planta está al 100 % (florecida): lleva la medalla de laurel. Si baja de etapa, la pierde. */
export const AL_CIEN = 4;
export const alCien = (etapa: number) => etapa === AL_CIEN;

/** Cada 30 días buenos en el ciclo la planta da un retoño, mientras haya lugar en el jardín (16 lugares: la planta y hasta 15 retoños). */
export const DIAS_POR_RETONO = 30;
export const MAX_RETONOS = 15;
export function retonos(ciclo: number): number {
  return Math.min(MAX_RETONOS, Math.floor(ciclo / DIAS_POR_RETONO));
}
/** Racha propia del retoño número k (desde 0): crece con los días buenos que siguieron a su nacimiento. */
export function rachaRetono(ciclo: number, k: number): number {
  return Math.max(0, ciclo - DIAS_POR_RETONO * (k + 1));
}

/** Filósofos que pasean por el jardín (estatuas de mármol) y sus frases. */
export const FILOSOFOS = [
  {
    id: 'marco',
    nombre: 'Marco Aurelio',
    frases: ['Dejá de discutir cómo debe ser un buen hombre. Sé uno.', 'Al amanecer, decite: hoy me toca hacer el trabajo de un ser humano.', 'Lo que no es bueno para la colmena no es bueno para la abeja.'],
  },
  {
    id: 'seneca',
    nombre: 'Séneca',
    frases: ['No es que tengamos poco tiempo, es que perdemos mucho.', 'Mientras se posterga, la vida pasa de largo.', 'Empezá ya a vivir, y contá cada día como una vida aparte.'],
  },
  {
    id: 'epicteto',
    nombre: 'Epicteto',
    frases: ['No expliques tu filosofía: encarnala.', 'Ninguna gran cosa nace de golpe, ni siquiera la uva o el higo.', 'Primero decite qué querés ser; después hacé lo que tengas que hacer.'],
  },
] as const;

/** Riesgo de la planta: 1 o 2 días sin cumplir (antes de marchitarse). 0 = sin riesgo. */
export function nivelRiesgo(a: Pick<Analisis, 'sinCumplir' | 'etapa'>): number {
  if (a.etapa === MARCHITA) return 0;
  return Math.min(2, a.sinCumplir);
}

export interface Consejo {
  filosofo: (typeof FILOSOFOS)[number];
  titulo: string;
  texto: string;
  frase: string;
}

/** Lo que dice el filósofo: aviso de riesgo (nivel 1 o 2) o visita del día (nivel 0). */
export function consejo(nivel: number, habito: string, semilla: number): Consejo {
  const f = FILOSOFOS[semilla % FILOSOFOS.length];
  const frase = f.frases[Math.floor(semilla / FILOSOFOS.length) % f.frases.length];
  if (nivel >= 2)
    return { filosofo: f, titulo: `Dos días sin «${habito}»`, texto: 'Mañana tu planta se marchita. Hacelo hoy, aunque sea en su versión más chica: lo importante es no cortar.', frase };
  if (nivel === 1)
    return { filosofo: f, titulo: `Ayer no cumpliste «${habito}»`, texto: 'Un tropiezo no es una caída. Hacelo hoy y tu planta sigue creciendo como si nada.', frase };
  return { filosofo: f, titulo: `${f.nombre} pasea por tu jardín`, texto: `Se detuvo a mirar tu ${habito ? `planta de «${habito}»` : 'jardín'}. Te deja un pensamiento para hoy.`, frase };
}

/** Número entero estable a partir de un texto (para que el azar del día sea el mismo todo el día). */
export function hashTexto(t: string): number {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Algunos días (más o menos 1 de cada 3) un filósofo pasea por el jardín y se para junto a una planta sana. */
export function visitaDelDia(fecha: string, cantidadPlantas: number): { planta: number; semilla: number } | null {
  if (cantidadPlantas <= 0) return null;
  const h = hashTexto(`visita-${fecha}`);
  if (h % 3 !== 0) return null;
  return { planta: Math.floor(h / 3) % cantidadPlantas, semilla: Math.floor(h / 7) };
}

/**
 * Planta de un hábito que otra persona comparte en un grupo. Solo se conoce su racha y si cumplió
 * cada uno de los últimos 7 días (sin saber qué días le tocaban), así que es una versión aproximada:
 * crece con la racha, y se ve marchita solo si no cumplió ningún día de la última semana.
 */
export function plantaCompartida(c: { racha: number; semana?: boolean[] }): { etapa: number; retonos: number } {
  const semanaSinNada = !!c.semana && c.semana.length > 0 && c.semana.every((d) => !d);
  if (c.racha <= 0 && semanaSinNada) return { etapa: MARCHITA, retonos: 0 };
  return { etapa: etapaPlanta(c.racha, 0), retonos: retonos(c.racha) };
}

/**
 * Plantas que se marchitan mañana si hoy no se cumple su hábito (para el aviso de la noche).
 * Respeta el riego manual: en ese modo un día cuenta solo si se cumplió y se regó.
 * `registros`: hábito → (fecha → registro), con al menos los últimos días.
 */
export function plantasEnPeligro(
  habitos: Habito[],
  registros: Map<string, Map<string, import('./habitos.js').Registro>>,
  hoy: string,
  jardin?: { modo?: string; riegos?: Record<string, string[]> },
): Habito[] {
  const manual = jardin?.modo === 'manual';
  return habitos.filter((h) => {
    if (h.archivado || !esDiaActivo(h, hoy)) return false;
    const regs = registros.get(h.id) ?? new Map();
    const regados = new Set(jardin?.riegos?.[h.id] ?? []);
    const bueno = (d: string) => cumplido(h, regs.get(d)) && (!manual || regados.has(d));
    if (bueno(hoy)) return false;
    return estadoPorDias(h, hoy, bueno, 30).sinCumplir === DIAS_PARA_MARCHITAR - 1;
  });
}

/** Texto del aviso del jardín. */
export function avisoDelJardin(enPeligro: Array<Pick<Habito, 'nombre' | 'virtud'>>): { titulo: string; cuerpo: string } {
  if (enPeligro.length === 1) {
    const h = enPeligro[0];
    const planta = PLANTA_DE_VIRTUD[h.virtud].nombre.toLowerCase();
    return { titulo: `Tu ${planta} se marchita mañana`, cuerpo: `Cumplí «${h.nombre}» hoy y sigue creciendo. Lo que depende de ti, hacelo ahora.` };
  }
  return { titulo: `${enPeligro.length} plantas se marchitan mañana`, cuerpo: `Cumplí hoy: ${enPeligro.map((h) => h.nombre).join(' · ')}.` };
}
