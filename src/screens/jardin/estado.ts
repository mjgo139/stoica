/**
 * Cálculo del jardín (compartido entre el jardín y la pantalla de cada planta):
 * plantas de los hábitos, medallas, retoños, plagas, modo difícil y lo guardado en el dispositivo.
 */
import { useEffect, useState } from 'react';
import { sumarDias } from '@core/fechas';
import { cumplido, esDiaActivo, VIRTUDES, type Habito, type Registro, type Virtud } from '@core/habitos';
import { analizar, buenosDesde, etapaPlanta, nivelRiesgo, rachaRetono, retonos, type Analisis, type Dia } from '@core/jardin';

export const VENTANA = 120;
export const MAX_MACETEROS = 15;

export type ModoRiego = 'auto' | 'manual';
export interface Guardado {
  modo: ModoRiego;
  dificil: boolean;
  /** habitId → días regados (clave de día). */
  riegos: Record<string, string[]>;
  /** Cuántos retoños tenía cada hábito la última vez (para avisar si se perdieron). */
  retonosPrevios: Record<string, number>;
  /** Visita del filósofo ya leída: fecha. */
  fortunaEspantada: string;
}

const DEFECTO: Guardado = { modo: 'auto', dificil: false, riegos: {}, retonosPrevios: {}, fortunaEspantada: '' };

export function useGuardado(uid: string): [Guardado, (f: (g: Guardado) => Guardado) => void] {
  const clave = `stoica.jardin.${uid}`;
  const [g, setG] = useState<Guardado>(() => {
    try {
      const crudo = localStorage.getItem(clave);
      if (crudo) return { ...DEFECTO, ...(JSON.parse(crudo) as Partial<Guardado>) };
    } catch {
      /* sin almacenamiento */
    }
    return DEFECTO;
  });
  useEffect(() => {
    try {
      localStorage.setItem(clave, JSON.stringify(g));
    } catch {
      /* sin almacenamiento */
    }
  }, [g, clave]);
  return [g, (f) => setG((x) => f(x))];
}

export interface PlantaCalc {
  id: string;
  nombre: string;
  virtud: Virtud;
  habito: Habito | null;
  a: Analisis;
  /** Mejor ciclo conocido: días seguidos sin marchitarse (para medallas). */
  mejor: number;
  /** Días buenos que cuentan para los retoños (en modo difícil, desde la última marchitada de cualquier planta). */
  ciclo: number;
  retonos: number;
  /** 1 o 2 días sin cumplir: el filósofo viene a avisar. */
  riesgo: number;
  hechoHoy: boolean;
  pideAgua: boolean;
  /** Últimos días (para el calendario de la pantalla de la planta). */
  historia: Dia[];
}

export interface RetonoCalc {
  id: string;
  madre: PlantaCalc;
  k: number;
  racha: number;
  etapa: number;
}

export interface Jardin {
  plantas: PlantaCalc[];
  retonos: RetonoCalc[];
  /** Retoños que no entran en los 15 maceteros. */
  enVivero: number;
}

interface Entrada {
  habitos: Habito[];
  registros: Map<string, Map<string, Registro>>;
  hoy: string;
  g: Guardado;
  /** Modo prueba: días inventados por planta (true = día bueno). */
  prueba: Record<string, boolean[]> | null;
}

/** Arma el jardín completo. */
export function calcularJardin({ habitos, registros, hoy, g, prueba }: Entrada): Jardin {
  const ordenados = [...habitos].sort((a, b) => a.orden - b.orden).slice(0, MAX_MACETEROS);
  type Base = { id: string; nombre: string; virtud: Virtud; habito: Habito | null; dias: Dia[]; pendiente: boolean; hechoHoy: boolean; pideAgua: boolean; mejorGuardada: number };
  let bases: Base[];
  if (prueba) {
    const ids = ordenados.length ? ordenados.map((h) => h.id) : Array.from({ length: MAX_MACETEROS }, (_, i) => `ejemplo-${i}`);
    bases = ids.map((id, i) => {
      const h = ordenados.find((x) => x.id === id) ?? null;
      const dias = prueba[id] ?? [];
      return { id, nombre: h?.nombre ?? `Ejemplo ${i + 1}`, virtud: h?.virtud ?? VIRTUDES[i % 4], habito: h, dias, pendiente: false, hechoHoy: !!dias[dias.length - 1], pideAgua: false, mejorGuardada: 0 };
    });
  } else {
    const desde = sumarDias(hoy, -(VENTANA - 1));
    bases = ordenados.map((h) => {
      const regs = registros.get(h.id) ?? new Map<string, Registro>();
      const regados = new Set(g.riegos[h.id] ?? []);
      const dias: Dia[] = [];
      for (let d = desde; d <= hoy; d = sumarDias(d, 1)) {
        if (d < h.inicio || !esDiaActivo(h, d)) dias.push(null);
        else dias.push(cumplido(h, regs.get(d)) && (g.modo === 'auto' || regados.has(d)));
      }
      const hechoHoy = esDiaActivo(h, hoy) && cumplido(h, regs.get(hoy));
      return { id: h.id, nombre: h.nombre, virtud: h.virtud, habito: h, dias, pendiente: true, hechoHoy, pideAgua: g.modo === 'manual' && hechoHoy && !regados.has(hoy), mejorGuardada: g.modo === 'auto' ? h.mejorRacha : 0 };
    });
  }
  const analisis = bases.map((b) => analizar(b.dias, b.pendiente));
  // Modo difícil: la última marchitada de CUALQUIER planta reinicia los retoños de todas.
  const largo = Math.max(0, ...bases.map((b) => b.dias.length));
  const marchitaGlobal = g.dificil ? Math.max(-1, ...analisis.map((a, i) => (a.marchitaEn < 0 ? -1 : a.marchitaEn + (largo - bases[i].dias.length)))) : -1;
  const plantas: PlantaCalc[] = bases.map((b, i) => {
    const a = analisis[i];
    const mejor = Math.max(a.mejorCiclo, b.mejorGuardada);
    const desplaz = largo - b.dias.length;
    const ciclo = g.dificil ? buenosDesde(b.dias, Math.max(a.marchitaEn, marchitaGlobal - desplaz), b.pendiente) : a.ciclo;
    return { id: b.id, nombre: b.nombre, virtud: b.virtud, habito: b.habito, a, mejor, ciclo, retonos: retonos(ciclo), riesgo: nivelRiesgo(a), hechoHoy: b.hechoHoy, pideAgua: b.pideAgua, historia: b.dias.slice(-30) };
  });
  const todos: RetonoCalc[] = plantas.flatMap((p) =>
    Array.from({ length: p.retonos }, (_, k) => {
      const racha = rachaRetono(p.ciclo, k);
      return { id: `${p.id}-r${k}`, madre: p, k, racha, etapa: etapaPlanta(racha, p.a.sinCumplir) };
    }),
  );
  const libres = Math.max(0, MAX_MACETEROS - plantas.length);
  return { plantas, retonos: todos.slice(0, libres), enVivero: Math.max(0, todos.length - libres) };
}
