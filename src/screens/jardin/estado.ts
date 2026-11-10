/**
 * Cálculo del jardín (compartido entre el jardín y la pantalla de cada planta):
 * plantas de los hábitos, medallas, retoños, plagas, modo difícil y lo guardado en el dispositivo.
 */
import { useEffect, useRef, useState } from 'react';
import { programarResumenGrupos } from '@/app/datos';
import { obtenerDriver } from '@/data';
import type { PlantaCompartida } from '@core/comunidad';
import { sumarDias } from '@core/fechas';
import { cumplido, esDiaActivo, VIRTUDES, type Habito, type Registro, type Virtud } from '@core/habitos';
import { analizar, buenosDesde, etapaPlanta, nivelRiesgo, rachaRetono, retonos, type Analisis, type Dia } from '@core/jardin';

export const VENTANA = 120;
export const MAX_MACETEROS = 15;

export type ModoRiego = 'auto' | 'manual';
/** id (hábito, retoño o adorno) → celda, por forma de jardín. -1 = guardado en el depósito. */
export interface Acomodo {
  vertical: Record<string, number>;
  horizontal: Record<string, number>;
}
export interface Guardado {
  modo: ModoRiego;
  dificil: boolean;
  /** habitId → días regados (clave de día). */
  riegos: Record<string, string[]>;
  /** Cuántos retoños tenía cada hábito la última vez (para avisar si se perdieron). */
  retonosPrevios: Record<string, number>;
  /** Visita del filósofo ya leída: fecha. */
  fortunaEspantada: string;
  /** Dónde puso la persona sus macetas y sus adornos. */
  pos: Acomodo;
  adornos: Acomodo;
  /** Medallas ganadas (la mayor cantidad vista: los adornos desbloqueados no se pierden). */
  logros: number;
  /** Noche (fecha) en que el filósofo ya encendió el fuego. */
  fuego: string;
  /** Última etapa vista de cada planta (para festejar cuando crece). */
  vistas: Record<string, number>;
}

const DEFECTO: Guardado = {
  modo: 'auto',
  dificil: false,
  riegos: {},
  retonosPrevios: {},
  fortunaEspantada: '',
  pos: { vertical: {}, horizontal: {} },
  adornos: { vertical: {}, horizontal: {} },
  logros: 0,
  fuego: '',
  vistas: {},
};

const completar = (x: Partial<Guardado>): Guardado => ({
  ...DEFECTO,
  ...x,
  pos: { ...DEFECTO.pos, ...(x.pos ?? {}) },
  adornos: { ...DEFECTO.adornos, ...(x.adornos ?? {}) },
});

/** Campos que se guardan en la nube (users/{uid}/jardin/config). */
const CAMPOS: Array<keyof Guardado> = ['modo', 'dificil', 'riegos', 'retonosPrevios', 'fortunaEspantada', 'pos', 'adornos', 'logros', 'fuego', 'vistas'];
const soloCampos = (g: Guardado) => Object.fromEntries(CAMPOS.map((k) => [k, g[k]])) as unknown as Guardado;

/** Lo guardado del jardín en este dispositivo (sin hook): copia de lo que está en la nube. */
export function leerGuardado(uid: string): Guardado {
  try {
    const crudo = localStorage.getItem(`stoica.jardin.${uid}`);
    if (crudo) return completar(JSON.parse(crudo) as Partial<Guardado>);
  } catch {
    /* sin almacenamiento */
  }
  return DEFECTO;
}

/**
 * El jardín de la persona: se guarda en la nube (así sigue igual en otro celular y el grupo ve lo mismo)
 * y queda una copia en el dispositivo para abrir al instante y sin conexión.
 */
export function useGuardado(uid: string): [Guardado, (f: (g: Guardado) => Guardado) => void] {
  const clave = `stoica.jardin.${uid}`;
  const ruta = `users/${uid}/jardin/config`;
  const [g, setG] = useState<Guardado>(() => leerGuardado(uid));
  const local = useRef(false); // el último cambio lo hizo la persona (hay que subirlo)
  const subido = useRef('');
  const nubeVista = useRef(false);

  // Escuchar la nube
  useEffect(() => {
    if (!uid) return;
    let cancelar: (() => void) | undefined;
    let vivo = true;
    void obtenerDriver().then((d) => {
      if (!vivo) return;
      cancelar = d.observarDoc<Partial<Guardado>>(
        ruta,
        (doc) => {
          nubeVista.current = true;
          if (!doc) {
            // Primera vez: se sube lo que había en este dispositivo
            local.current = true;
            setG((x) => ({ ...x }));
            return;
          }
          const nuevo = completar(doc);
          const json = JSON.stringify(soloCampos(nuevo));
          if (json === subido.current) return; // es lo que acabo de subir
          subido.current = json;
          local.current = false;
          setG(nuevo);
        },
        () => undefined,
      );
    });
    return () => {
      vivo = false;
      cancelar?.();
    };
  }, [uid, ruta]);

  // Copia local + subir a la nube (agrupando cambios seguidos)
  const primera = useRef(true);
  useEffect(() => {
    try {
      localStorage.setItem(clave, JSON.stringify(g));
    } catch {
      /* sin almacenamiento */
    }
    if (primera.current) {
      primera.current = false;
      return;
    }
    // Regar o cambiar el riego/la dificultad cambia las plantas que ven tus grupos.
    programarResumenGrupos();
    if (!local.current || !uid) return;
    const t = setTimeout(() => {
      const datos = soloCampos(g);
      const json = JSON.stringify(datos);
      if (json === subido.current) return;
      subido.current = json;
      void obtenerDriver()
        .then((d) => d.guardar(ruta, { ...datos, actualizado: Date.now(), actualizadoPor: uid }))
        .catch(() => undefined);
    }, 1200);
    return () => clearTimeout(t);
  }, [g, clave, ruta, uid]);

  return [
    g,
    (f) => {
      local.current = true;
      setG((x) => f(x));
    },
  ];
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
  /** (sin uso: los que no entran se calculan al acomodar) */
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
  // Cuántos entran en el jardín lo decide el terreno (ver terreno.ts → ubicar).
  return { plantas, retonos: todos, enVivero: 0 };
}

/** Plantas reales de tus hábitos, para compartirlas en los grupos (hábito → planta). */
export function plantasParaCompartir(entrada: Omit<Entrada, 'prueba'>): Map<string, PlantaCompartida> {
  const { plantas } = calcularJardin({ ...entrada, prueba: null });
  return new Map(
    plantas.map((p) => [
      p.id,
      { etapa: p.a.etapa, ciclo: p.ciclo, retonos: Array.from({ length: p.retonos }, (_, k) => etapaPlanta(rachaRetono(p.ciclo, k), p.a.sinCumplir)) },
    ]),
  );
}

/** Medallas ganadas: cada 30 días seguidos sin marchitarse (el mejor ciclo de cada planta) es una medalla. */
export function medallasGanadas(plantas: Array<Pick<PlantaCalc, 'mejor' | 'ciclo'>>): number {
  return plantas.reduce((s, p) => s + Math.floor(Math.max(p.mejor, p.ciclo) / 30), 0);
}
