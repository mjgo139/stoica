/**
 * Jardín estoico: cada hábito es una planta que crece con la racha y se marchita si lo dejás.
 *
 * Reglas (las mismas que se explican en la pantalla):
 * - Racha 0 → semilla · 1 a 3 días → brote · 4 a 10 → planta chica · 11 a 29 → planta grande · 30 o más → florecida.
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
  // Por ahora el lirio; cuando esté el granado se cambia acá.
  justicia: { id: 'lirio', nombre: 'Lirio' },
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
