import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as PE } from 'react';
import { useSesion } from '@/app/sesion';
import { alCien, consejo, DIAS_PARA_MARCHITAR, DIAS_POR_RETONO, ETAPAS_PLANTA, faltanParaCrecer, hashTexto, MARCHITA, MAX_RETONOS, PLANTA_DE_VIRTUD, UMBRALES, visitaDelDia, type Consejo } from '@core/jardin';
import { NOMBRE_VIRTUD, VIRTUDES, type Habito, type Virtud } from '@core/habitos';
import { sumarDias } from '@core/fechas';
import { useAvisos } from '@/ui/avisos';
import { Icono } from '@/ui/Iconos';
import { alternarSiNo, useDatos, useHabitosActivos, useHoy } from '@/app/datos';
import { useComunidad } from '@/app/comunidad';
import { obtenerDriver } from '@/data';
import type { Reaccion } from '@core/comunidad';
import { ADORNOS, FONDOS } from './disposicion';
import { anchoMaceta, esNocheDeFuego, fuerzaNoche, useAncho } from './escena';
import { Escena, ESTILOS_ESCENA, type PlantaEnEscena } from './Escena';
import { crearSonido, type SonidoJardin } from './sonido';
import { ESTILOS_GRAFICOS } from './Graficos';
import { VistaPlanta } from './Planta';
import { PaginaRepisa } from './Repisa';
import { Filosofo, type Parada } from './Filosofo';
import { EPICTETO, MARCO } from './filosofos';
import { caminoDeSalida, caminoHasta, celdaDePunto, celdas, rondaDeBraseros, ubicar, type Forma } from './terreno';
import { calcularJardin, MAX_MACETEROS, medallasGanadas, useGuardado, type ModoRiego, type PlantaCalc } from './estado';

const azar = (semilla: number) => {
  let s = semilla % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
};

/** Ancho en px de un elemento (para dibujar medallas y filósofos a escala). */
function useAnchoPx<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const o = new ResizeObserver(([e]) => setW(e.contentRect.width));
    o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  return [ref, w];
}

/** Lo que se dibuja en cada maceta: la planta de un hábito o un retoño. */
interface Item {
  id: string;
  nombre: string;
  virtud: Virtud;
  etapa: number;
  planta: PlantaCalc | null;
  retonoDe: PlantaCalc | null;
}

/** Laureles que te dejaron hoy en tus grupos (una consulta chica por grupo, solo al abrir el jardín). */
function useLaurelesDeHoy(uid: string, hoy: string): string[] {
  const grupos = useComunidad((s) => [...s.grupos.keys()].sort().join(','));
  const [nombres, setNombres] = useState<string[]>([]);
  useEffect(() => {
    if (!uid || !grupos) return;
    let vivo = true;
    void obtenerDriver().then(async (d) => {
      const listas = await Promise.all(
        grupos.split(',').map((gid) => d.leerLista<Reaccion>({ ruta: `groups/${gid}/reactions`, filtros: [['para', '==', uid], ['dia', '==', hoy]] }).catch(() => [] as Reaccion[])),
      );
      if (vivo) setNombres([...new Set(listas.flat().filter((r) => r.tipo === 'laurel').map((r) => r.nombreDe || 'Alguien'))]);
    });
    return () => {
      vivo = false;
    };
  }, [uid, hoy, grupos]);
  return nombres;
}

/** La noche del fuego: de 0 a 6 h todavía cuenta como la noche del día anterior. */
const nocheDe = (hoy: string, hora: number) => (hora < 6 ? sumarDias(hoy, -1) : hoy);

/** Mantener apretado para mover (ms). */
const PULSACION = 420;

type Visita = { tipo: 'fuego'; clave: string } | { tipo: 'consejo'; celda: number; id: string; c: Consejo; aviso: boolean; clave: string; epicteto: boolean };

/**
 * El Jardín estoico: cada hábito es una planta de su virtud que crece con la racha.
 * Es la misma terraza en el celular y en la computadora (en la computadora, con el panel al costado).
 */
export function Jardin() {
  const esAdmin = useSesion((s) => s.perfil?.rol === 'admin');
  const uid = useSesion((s) => s.usuario?.uid ?? '');
  const avisar = useAvisos((s) => s.mostrar);
  const hoy = useHoy();
  const habitos = useHabitosActivos();
  const registros = useDatos((s) => s.registros);
  // Celular: terraza vertical; computadora: horizontal. Las dos usan la misma cuadrícula, así cada
  // maceta queda en el mismo lugar en las dos (se guarda una sola vez).
  const forma: Forma = useAncho() ? 'horizontal' : 'vertical';
  const fondo = FONDOS[forma];
  const [g, setG] = useGuardado(uid);
  const modo = g.modo;
  const [elegido, setElegido] = useState<string | null>(null);
  /** Modo prueba: días inventados por planta (true = día bueno). */
  const [prueba, setPrueba] = useState<Record<string, boolean[]> | null>(null);
  const [hora, setHora] = useState(() => new Date().getHours());
  const [horaPrueba, setHoraPrueba] = useState<number | null>(null);
  const [regando, setRegando] = useState<Set<string>>(new Set());
  /** Planta cuya página está abierta encima del jardín. */
  const [pagina, setPagina] = useState<string | null>(null);
  const [verRepisa, setVerRepisa] = useState(false);
  const [verConsejo, setVerConsejo] = useState(false);
  /** El filósofo: en qué parada está, hasta cuál puede seguir, si se va, visitas hechas. */
  const [parada, setParada] = useState(-1);
  const [seguir, setSeguir] = useState(0);
  const [filosofoIrse, setFilosofoIrse] = useState(false);
  const [hechas, setHechas] = useState<Set<string>>(new Set());
  const [filosofoPos, setFilosofoPos] = useState<{ x: number; y: number; alto: number; parado: boolean } | null>(null);
  /** Braseros que se encendieron en esta visita, y el que se está prendiendo. */
  const [encendidos, setEncendidos] = useState<Set<number>>(new Set());
  const [prendiendo, setPrendiendo] = useState<number | null>(null);
  /** En modo prueba el fuego no se guarda. */
  const [fuegoPrueba, setFuegoPrueba] = useState('');
  const [conSonido, setConSonido] = useState(false);
  const sonido = useRef<SonidoJardin | null>(null);
  const [refJardin, anchoPx] = useAnchoPx<HTMLDivElement>();
  const laureles = useLaurelesDeHoy(uid, hoy);
  const [festejos, setFestejos] = useState<Array<{ id: string; nombre: string; virtud: Virtud; etapa: number }>>([]);
  useEffect(() => {
    const t = setInterval(() => setHora(new Date().getHours()), 60_000);
    return () => clearInterval(t);
  }, []);

  const horaVista = horaPrueba ?? hora;
  const fuerza = fuerzaNoche(horaVista);

  // Sonido ambiente (solo si la persona lo activa: los navegadores no dejan sonar sin un toque)
  useEffect(() => {
    if (!conSonido) return;
    try {
      sonido.current = crearSonido();
    } catch {
      setConSonido(false);
    }
    return () => {
      sonido.current?.detener();
      sonido.current = null;
    };
  }, [conSonido]);
  useEffect(() => sonido.current?.noche(fuerza >= 1), [fuerza, conSonido]);

  const jardin = useMemo(() => calcularJardin({ habitos, registros, hoy, g, prueba }), [habitos, registros, hoy, g, prueba]);
  const todosItems: Item[] = useMemo(
    () => [
      ...jardin.plantas.map((p) => ({ id: p.id, nombre: p.nombre, virtud: p.virtud, etapa: p.a.etapa, planta: p, retonoDe: null })),
      ...jardin.retonos.map((r) => ({ id: r.id, nombre: `Retoño de ${r.madre.nombre}`, virtud: r.madre.virtud, etapa: r.etapa, planta: null, retonoDe: r.madre })),
    ],
    [jardin],
  );

  // Medallas: llenan la repisa (los adornos desbloqueados no se pierden)
  const medallas = useMemo(() => medallasGanadas(jardin.plantas), [jardin]);
  const logros = prueba ? medallas : Math.max(g.logros, medallas);
  useEffect(() => {
    if (prueba || medallas <= g.logros) return;
    const nuevos = ADORNOS.filter((a) => a.medallas > g.logros && a.medallas <= medallas).map((a) => a.nombre.toLowerCase());
    avisar(nuevos.length ? `¡Nueva medalla! En tu repisa: ${nuevos.join(', ')}.` : '¡Nueva medalla de laurel en tu repisa!');
    setG((x) => ({ ...x, logros: medallas }));
  }, [prueba, medallas, g.logros]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dónde va cada maceta
  const posGuardadas = g.pos.vertical;
  const acomodo = useMemo(() => ubicar(forma, todosItems.map((i) => i.id), [], posGuardadas, {}), [forma, todosItems, posGuardadas]);
  const items = todosItems.filter((i) => acomodo.lugar.has(i.id));
  const enVivero = todosItems.length - items.length;

  // Festejo cuando una planta crece (una sola vez, aunque abras el jardín en otro celular)
  const vistasPrueba = useRef<Record<string, number>>({});
  useEffect(() => {
    const vistas = prueba ? vistasPrueba.current : g.vistas;
    const nuevas: Record<string, number> = {};
    const crecieron: typeof festejos = [];
    for (const it of todosItems) {
      nuevas[it.id] = it.etapa;
      const antes = vistas[it.id];
      if (antes !== undefined && antes !== MARCHITA && it.etapa !== MARCHITA && it.etapa > antes) crecieron.push({ id: it.id, nombre: it.nombre, virtud: it.virtud, etapa: it.etapa });
      if (antes === MARCHITA && it.etapa !== MARCHITA) crecieron.push({ id: it.id, nombre: it.nombre, virtud: it.virtud, etapa: it.etapa });
    }
    if (crecieron.length) {
      sonido.current?.lira();
      // En modo prueba los días pasan de a muchos: solo un aviso corto, sin tapar el jardín
      if (prueba) avisar(crecieron.length === 1 ? `¡Creció ${crecieron[0].nombre}!` : `¡Crecieron ${crecieron.length} plantas!`);
      else setFestejos((f) => [...f, ...crecieron.filter((c) => !f.some((x) => x.id === c.id))]);
    }
    if (prueba) vistasPrueba.current = nuevas;
    else if (JSON.stringify(nuevas) !== JSON.stringify(g.vistas)) setG((x) => ({ ...x, vistas: nuevas }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todosItems]);
  useEffect(() => {
    vistasPrueba.current = {};
    setFestejos([]);
  }, [prueba === null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Aviso si se perdieron retoños
  const previosPrueba = useRef<Record<string, number>>({});
  useEffect(() => {
    const previos = prueba ? previosPrueba.current : g.retonosPrevios;
    const perdidos = jardin.plantas.filter((p) => (previos[p.id] ?? 0) > p.retonos);
    const nuevos = Object.fromEntries(jardin.plantas.map((p) => [p.id, p.retonos]));
    if (perdidos.length) {
      const n = perdidos.reduce((s, p) => s + (previos[p.id] ?? 0) - p.retonos, 0);
      avisar(g.dificil ? `Modo difícil: una planta se marchitó y perdiste ${n === 1 ? '1 retoño' : `${n} retoños`}.` : `Se marchitó ${perdidos[0].nombre}: perdiste ${n === 1 ? '1 retoño' : `${n} retoños`}.`);
    }
    if (prueba) previosPrueba.current = nuevos;
    else if (JSON.stringify(nuevos) !== JSON.stringify(g.retonosPrevios)) setG((x) => ({ ...x, retonosPrevios: nuevos }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jardin]);

  const animarRiego = useCallback((ids: string[]) => {
    if (!ids.length) return;
    sonido.current?.regar();
    setRegando(new Set(ids));
    window.setTimeout(() => setRegando(new Set()), 1700);
  }, []);

  /** Riego manual: regar las plantas cuyo hábito ya está cumplido hoy. */
  const regar = (ids: string[]) => {
    const validos = ids.filter((id) => jardin.plantas.find((p) => p.id === id)?.pideAgua);
    if (!validos.length) return;
    setG((x) => {
      const riegos = { ...x.riegos };
      for (const id of validos) riegos[id] = [...(riegos[id] ?? []).filter((d) => d >= sumarDias(hoy, -150) && d !== hoy), hoy];
      return { ...x, riegos };
    });
    animarRiego(validos);
  };

  const marcarHoy = async (h: Habito) => {
    const antes = jardin.plantas.find((p) => p.id === h.id)?.hechoHoy;
    await alternarSiNo(h, hoy);
    // Automático: cumplir el hábito ya riega la planta.
    if (!antes && modo === 'auto') animarRiego([h.id]);
  };

  const pasarDias = (n: number, cumplidosPorDia: number, regaste: boolean) => {
    const base = prueba ?? {};
    const ids = jardin.plantas.length ? jardin.plantas.map((p) => p.id) : Array.from({ length: MAX_MACETEROS }, (_, i) => `ejemplo-${i}`);
    const nuevo: Record<string, boolean[]> = Object.fromEntries(ids.map((id) => [id, [...(base[id] ?? [])]]));
    const largo = nuevo[ids[0]]?.length ?? 0;
    for (let d = 0; d < n; d++) {
      // Cada día se eligen al azar cuáles hábitos se cumplieron.
      const r = azar((largo + d) * 97 + 11);
      const mezcla = [...ids].sort(() => r() - 0.5);
      const hechos = new Set(mezcla.slice(0, cumplidosPorDia));
      for (const id of ids) nuevo[id].push(hechos.has(id) && (modo === 'auto' || regaste));
    }
    setPrueba(nuevo);
    if (cumplidosPorDia > 0) animarRiego(ids.filter((id) => nuevo[id][nuevo[id].length - 1]).slice(0, 4));
  };

  // ---------- Los filósofos ----------
  const diaVisita = prueba ? `prueba-${Object.values(prueba)[0]?.length ?? 0}` : hoy;
  const noche = esNocheDeFuego(horaVista);
  const claveFuego = prueba ? `prueba-${nocheDe(hoy, horaVista)}` : nocheDe(hoy, horaVista);
  const fuegoHecho = prueba ? fuegoPrueba === claveFuego : g.fuego === claveFuego;
  const fuegos = [0, 1, 2, 3].map((i) => noche && (fuegoHecho || encendidos.has(i)));

  /** Lo que el filósofo tiene para decir hoy (consejo si hay riesgo; si no, algunos días un pensamiento). Marco o Epicteto. */
  const consejoDeHoy = useMemo((): Extract<Visita, { tipo: 'consejo' }> | null => {
    const lugar = (id: string) => acomodo.lugar.get(id);
    const quien = (semilla: number) => semilla % 2 === 1; // impar: Epicteto
    const enRiesgo = [...jardin.plantas].filter((p) => p.riesgo > 0 && lugar(p.id) !== undefined).sort((a, b) => b.riesgo - a.riesgo)[0];
    if (enRiesgo) {
      const clave = `${diaVisita}-${enRiesgo.id}-${enRiesgo.riesgo}`;
      const semilla = hashTexto(`${diaVisita}-${enRiesgo.id}`);
      const epicteto = quien(semilla);
      return { tipo: 'consejo', celda: lugar(enRiesgo.id)!, id: enRiesgo.id, c: consejo(enRiesgo.riesgo, enRiesgo.nombre, semilla * 3 + (epicteto ? 2 : 0)), aviso: true, clave, epicteto };
    }
    const v = visitaDelDia(diaVisita, jardin.plantas.length);
    if (!v || g.fortunaEspantada === diaVisita) return null;
    const p = jardin.plantas[v.planta];
    if (!p || p.a.etapa === MARCHITA || lugar(p.id) === undefined) return null;
    const epicteto = quien(v.semilla);
    return { tipo: 'consejo', celda: lugar(p.id)!, id: p.id, c: consejo(0, p.nombre, v.semilla * 3 + (epicteto ? 2 : 0)), aviso: false, clave: `fortuna-${diaVisita}`, epicteto };
  }, [diaVisita, jardin, g.fortunaEspantada, acomodo]);

  /** Mover una maceta (mantener apretado): mientras tanto no hay visitas. */
  const [moviendo, setMoviendo] = useState<{ id: string; x: number; y: number } | null>(null);

  // Primero Marco enciende los braseros (de noche, una vez por noche); después, si hay, el consejo.
  const visita: Visita | null = moviendo
    ? null
    : noche && !fuegoHecho && !hechas.has(`fuego-${claveFuego}`)
      ? { tipo: 'fuego', clave: `fuego-${claveFuego}` }
      : consejoDeHoy && !hechas.has(consejoDeHoy.clave)
        ? consejoDeHoy
        : null;

  const recorrido = useMemo((): { paradas: Parada[]; salida: Array<[number, number]> } | null => {
    if (!visita) return null;
    if (visita.tipo === 'fuego') {
      const ronda = rondaDeBraseros(forma);
      if (!ronda.length) return null;
      const ultimo = ronda[ronda.length - 1].puntos.at(-1)!;
      return { paradas: ronda.map((r) => ({ puntos: r.puntos, mirar: r.mirar, accion: 'antorcha' as const })), salida: caminoDeSalida(forma, celdaDePunto(forma, ultimo[0], ultimo[1])!.i).slice(1) };
    }
    const c = caminoHasta(forma, visita.celda);
    if (!c) return null;
    return { paradas: [{ puntos: c.puntos, mirar: c.mirar, accion: 'hablar' }], salida: caminoDeSalida(forma, c.fin).slice(1) };
  }, [visita?.clave, visita?.tipo === 'consejo' ? visita.celda : -1, forma]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cada visita empieza de cero (si no, el que viene después del fuego heredaba el "irse")
  useEffect(() => {
    setParada(-1);
    setSeguir(0);
    setFilosofoIrse(false);
    setFilosofoPos(null);
    if (visita?.tipo !== 'fuego') setEncendidos(new Set());
  }, [visita?.clave]); // eslint-disable-line react-hooks/exhaustive-deps

  const pxPorPct = anchoPx / 100;
  const altoJardinPx = anchoPx / (fondo.ancho / fondo.alto);
  // Una persona mide como 1,8 macetas de ancho: siempre más alta que las plantas.
  const altoFilosofo = useCallback((y: number) => Math.max(56, anchoMaceta(forma, y) * pxPorPct * 1.8), [forma, pxPorPct]);

  // En cada brasero: baja la antorcha, se prende el fuego y sigue al próximo
  useEffect(() => {
    if (visita?.tipo !== 'fuego' || parada < 0 || !recorrido) return;
    const b = rondaDeBraseros(forma)[parada]?.brasero;
    if (b === undefined) return;
    const t1 = window.setTimeout(() => {
      setEncendidos((e) => new Set(e).add(b));
      setPrendiendo(b);
      sonido.current?.fuego(true);
    }, 800);
    const t2 = window.setTimeout(() => {
      setPrendiendo(null);
      if (parada + 1 < recorrido.paradas.length) setSeguir(parada + 1);
      else {
        // Los 4 encendidos: queda guardado para esta noche y se va
        if (prueba) setFuegoPrueba(claveFuego);
        else setG((x) => ({ ...x, fuego: claveFuego }));
        setFilosofoIrse(true);
      }
    }, 1900);
    return () => [t1, t2].forEach(clearTimeout);
  }, [parada, visita?.tipo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    sonido.current?.fuego(fuegos.some(Boolean));
  }, [fuegos.some(Boolean), conSonido]); // eslint-disable-line react-hooks/exhaustive-deps

  /** "Entendido": el filósofo se va caminando; recién cuando sale del jardín se guarda que ya lo leíste. */
  const despedirFilosofo = () => {
    setVerConsejo(false);
    setFilosofoIrse(true);
  };
  const filosofoSeFue = () => {
    if (visita) {
      setHechas((h) => new Set(h).add(visita.clave));
      if (visita.tipo === 'consejo' && !visita.aviso && !prueba) setG((x) => ({ ...x, fortunaEspantada: diaVisita }));
    }
    setFilosofoIrse(false);
    setParada(-1);
    setSeguir(0);
    setEncendidos(new Set());
    setFilosofoPos(null);
  };

  // ---------- Mover macetas: mantener apretado y arrastrar ----------
  const arrastre = useRef<{ id: string; x0: number; y0: number; activo: boolean; timer: number; movio: boolean } | null>(null);
  const puntoEnJardin = (e: { clientX: number; clientY: number }) => {
    const r = refJardin.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };
  // Mientras se arrastra, la pantalla no se desplaza
  useEffect(() => {
    if (!moviendo) return;
    const frenar = (e: TouchEvent) => e.preventDefault();
    document.addEventListener('touchmove', frenar, { passive: false });
    return () => document.removeEventListener('touchmove', frenar);
  }, [moviendo !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Pone `id` en la celda `destino` (si hay otra maceta ahí, intercambian lugares). */
  const mover = (id: string, destino: number) => {
    const c = celdas(forma)[destino];
    if (!c || c.tipo !== 'libre') {
      avisar(c?.tipo === 'pasillo' ? 'Ese es el camino del filósofo: tiene que quedar libre.' : 'Ahí no se puede poner una maceta.');
      return;
    }
    const otro = [...acomodo.lugar.entries()].find(([, i]) => i === destino)?.[0];
    const desde = acomodo.lugar.get(id);
    setG((x) => {
      const pos = { ...x.pos.vertical };
      pos[id] = destino;
      if (otro && otro !== id) {
        if (desde !== undefined) pos[otro] = desde;
        else delete pos[otro];
      }
      return { ...x, pos: { vertical: pos, horizontal: {} } };
    });
  };
  const alBajar = (id: string) => (e: PE<HTMLElement>) => {
    if (e.button !== undefined && e.button > 0) return;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const objetivo = e.currentTarget;
    const pid = e.pointerId;
    const a = {
      id,
      x0,
      y0,
      activo: false,
      movio: false,
      timer: window.setTimeout(() => {
        a.activo = true;
        objetivo.setPointerCapture?.(pid);
        navigator.vibrate?.(25);
        setElegido(null);
        setMoviendo({ id, ...puntoEnJardin({ clientX: x0, clientY: y0 }) });
      }, PULSACION),
    };
    arrastre.current = a;
  };
  const alMover = (e: PE<HTMLElement>) => {
    const a = arrastre.current;
    if (!a) return;
    if (!a.activo) {
      // Se movió antes de tiempo: era para desplazar la pantalla, no para mover
      if (Math.hypot(e.clientX - a.x0, e.clientY - a.y0) > 10) {
        clearTimeout(a.timer);
        a.movio = true;
      }
      return;
    }
    setMoviendo({ id: a.id, ...puntoEnJardin(e) });
  };
  const alSoltar = (e: PE<HTMLElement>) => {
    const a = arrastre.current;
    arrastre.current = null;
    if (!a) return;
    clearTimeout(a.timer);
    if (a.activo) {
      const p = puntoEnJardin(e);
      const c = celdaDePunto(forma, p.x, p.y);
      if (c && c.i !== acomodo.lugar.get(a.id)) mover(a.id, c.i);
      setMoviendo(null);
    } else if (!a.movio) setElegido(elegido === a.id ? null : a.id);
  };
  // Si se suelta fuera de una maceta (o el navegador no retuvo el puntero), igual se termina de mover
  const soltarRef = useRef(alSoltar);
  soltarRef.current = alSoltar;
  useEffect(() => {
    if (!moviendo) return;
    const fin = (e: PointerEvent) => {
      if (arrastre.current?.activo) soltarRef.current(e as unknown as PE<HTMLElement>);
    };
    const seguirDedo = (e: PointerEvent) => {
      const a = arrastre.current;
      if (a?.activo && refJardin.current) setMoviendo({ id: a.id, ...puntoEnJardin(e) });
    };
    window.addEventListener('pointermove', seguirDedo);
    window.addEventListener('pointerup', fin);
    window.addEventListener('pointercancel', fin);
    return () => {
      window.removeEventListener('pointermove', seguirDedo);
      window.removeEventListener('pointerup', fin);
      window.removeEventListener('pointercancel', fin);
    };
  }, [moviendo !== null]); // eslint-disable-line react-hooks/exhaustive-deps
  const cancelar = () => {
    if (arrastre.current) clearTimeout(arrastre.current.timer);
    arrastre.current = null;
    setMoviendo(null);
  };

  const sel = items.find((l) => l.id === elegido) ?? null;
  const sedientas = jardin.plantas.filter((p) => p.pideAgua).map((p) => p.id);
  const enEscena: PlantaEnEscena[] = items.map((it) => ({ id: it.id, nombre: it.nombre, virtud: it.virtud, etapa: it.etapa, retono: !!it.retonoDe, celda: acomodo.lugar.get(it.id)! }));
  const festejo = festejos[0];
  const ocupadas = new Set(acomodo.lugar.values());
  const destinoArrastre = moviendo ? celdaDePunto(forma, moviendo.x, moviendo.y) : null;
  const atlas = visita?.tipo === 'consejo' && visita.epicteto ? EPICTETO : MARCO;

  const controles = (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="seg3" role="radiogroup" aria-label="Riego" style={{ flex: '1 1 260px', maxWidth: 380 }}>
          {(
            [
              ['auto', 'Riego automático'],
              ['manual', 'Riego manual'],
            ] as const
          ).map(([v, txt]) => (
            <button key={v} type="button" role="radio" aria-checked={modo === v} className={modo === v ? 'on' : ''} onClick={() => setG((x) => ({ ...x, modo: v as ModoRiego }))}>
              {txt}
            </button>
          ))}
        </div>
        <div className="seg3" role="radiogroup" aria-label="Dificultad" style={{ flex: '1 1 200px', maxWidth: 280 }}>
          {(
            [
              [false, 'Normal'],
              [true, 'Difícil'],
            ] as const
          ).map(([v, txt]) => (
            <button key={txt} type="button" role="radio" aria-checked={g.dificil === v} className={g.dificil === v ? 'on' : ''} onClick={() => setG((x) => ({ ...x, dificil: v }))}>
              {txt}
            </button>
          ))}
        </div>
        <button type="button" className="ghost" aria-pressed={conSonido} onClick={() => setConSonido(!conSonido)}>
          <Icono nombre={conSonido ? 'lira' : 'liraMuda'} tam={20} />
          {conSonido ? 'Sonido activado' : 'Activar sonido'}
        </button>
        <button type="button" className="ghost" aria-pressed={g.repisa} onClick={() => setG((x) => ({ ...x, repisa: !x.repisa }))}>
          <Icono nombre="repisa" tam={18} />
          {g.repisa ? 'Guardar la repisa' : 'Sacar la repisa'}
        </button>
      </div>
      <p className="mu2" style={{ fontSize: 12.5, marginTop: 6 }}>
        {modo === 'auto' ? 'Riego automático: cumplir el hábito ya riega su planta.' : 'Riego manual: además de cumplir el hábito, entrá y regá su planta ese mismo día; si no, el día no cuenta.'}{' '}
        {g.dificil ? 'Difícil: si cualquier planta se marchita, perdés TODOS los retoños del jardín.' : 'Normal: si una planta se marchita, perdés solo sus retoños.'}
      </p>
    </>
  );

  return (
    <div className="entra jardin-pagina">
      <style>{`
        ${ESTILOS_GRAFICOS}
        ${ESTILOS_ESCENA}
        .jardin-pagina { max-width: 1100px; margin-inline: auto; }
        .jardin-cols { display: block; }
        .jardin-lienzo { max-width: 560px; margin-inline: auto; }
        .jardin-panel { max-width: 560px; margin-inline: auto; }
        @media (min-width: 760px) {
          .jardin-lienzo { max-width: 1000px; }
          .jardin-panel { max-width: 1000px; }
        }
        @keyframes latir { 0%,100% { transform: translate(-50%, -100%) scale(1); opacity: .9 } 50% { transform: translate(-50%, -100%) scale(1.15); opacity: 1 } }
        .jardin-nombre { position: absolute; transform: translate(-50%, -100%); white-space: nowrap; background: rgba(30,24,16,.78); color: #f3e6c8; font-size: 11.5px; font-weight: 700; padding: 3px 9px; border-radius: 10px; pointer-events: none; }
        .pide-agua { position: absolute; animation: latir 1.4s ease-in-out infinite; filter: drop-shadow(0 1px 2px rgba(0,0,0,.4)); pointer-events: none; }
        .pide-agua svg { fill: rgba(110,190,250,.9); stroke: #eaf7ff; display: block; }
        @keyframes globo { 0%,100% { transform: translate(-50%, -100%) } 50% { transform: translate(-50%, -104%) } }
        .globo, .nube { position: absolute; transform: translate(-50%, -100%); background: #fffaf0; color: #3b2a12; border: 1.5px solid #c9a24a; border-radius: 12px; padding: 5px 9px; font-size: 11.5px; font-weight: 700; line-height: 1.25; max-width: 170px; text-align: center; box-shadow: 0 3px 8px rgba(0,0,0,.25); animation: globo 2.6s ease-in-out infinite; cursor: pointer; }
        .globo::after, .nube::after { content: ''; position: absolute; left: 50%; bottom: -7px; margin-left: -6px; border: 6px solid transparent; border-top-color: #c9a24a; border-bottom: 0; }
        .zona-maceta { -webkit-touch-callout: none; user-select: none; -webkit-user-select: none; }
        .hoja-planta { position: fixed; inset: 0; z-index: 200; background: rgba(20,14,6,.55); display: flex; justify-content: center; align-items: flex-end; }
        .hoja-planta > div { background: var(--bg, #f4ede1); width: min(760px, 100%); max-height: 92vh; overflow: auto; border-radius: 22px 22px 0 0; padding: 14px 16px 28px; }
        @media (min-width: 760px) { .hoja-planta { align-items: center } .hoja-planta > div { border-radius: 22px } }
        .celda-libre { position: absolute; border: 1.5px dashed rgba(255,248,225,.9); border-radius: 10px; background: rgba(255,248,225,.14); pointer-events: none; }
        .celda-libre.destino { background: rgba(255,214,120,.4); border-color: #ffd678; border-style: solid; }
        .celda-pasillo { position: absolute; background: repeating-linear-gradient(45deg, rgba(95,62,20,.30) 0 6px, rgba(95,62,20,.18) 6px 12px); pointer-events: none; }
        .festejo { position: fixed; inset: 0; z-index: 210; display: flex; align-items: center; justify-content: center; background: rgba(20,14,6,.55); padding: 16px; }
        .festejo > div { position: relative; overflow: hidden; background: radial-gradient(ellipse at 50% 30%, #fff6de, #ecd9b2 70%); border: 2px solid #c9a24a; border-radius: 22px; padding: 22px 18px 18px; width: min(380px, 100%); text-align: center; color: #3b2a12; box-shadow: 0 12px 40px rgba(0,0,0,.35); }
        .festejo .rayos { position: absolute; left: 50%; top: 38%; width: 520px; height: 520px; background: repeating-conic-gradient(rgba(255,206,110,.35) 0 10deg, rgba(255,206,110,0) 10deg 20deg); border-radius: 50%; animation: rayos 18s linear infinite; pointer-events: none; }
        .festejo img { position: relative; width: 150px; height: 150px; object-fit: contain; animation: crecer 1.4s ease-out; }
        @media (prefers-reduced-motion: reduce) { .pide-agua, .globo, .nube, .festejo .rayos, .festejo img { animation: none } }
      `}</style>
      <div className="cap gold">Jardín estoico</div>
      <h1 className="titulo">Tu jardín</h1>
      <p className="mu" style={{ marginTop: 4 }}>
        Cada hábito es una planta de su virtud. Crece con tu constancia, llega al 100 % (medalla de laurel), da retoños y se marchita si lo dejás.
      </p>

      <div className="jardin-cols" style={{ marginTop: 10 }}>
        <div className="jardin-lienzo">
          {laureles.length > 0 && (
            <div className="card" role="status" style={{ marginBottom: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, border: '1.5px solid #c9a24a' }}>
              <img src="/jardin/adorno-corona.webp" alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
              <span style={{ fontSize: 13.5 }}>
                <b>{laureles.length === 1 ? laureles[0] : `${laureles.slice(0, -1).join(', ')} y ${laureles[laureles.length - 1]}`}</b> te {laureles.length === 1 ? 'dejó un laurel' : 'dejaron laureles'} hoy en tu jardín.
              </span>
            </div>
          )}
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: 'none' }}>
            <Escena
              forma={forma}
              plantas={enEscena}
              hora={horaVista}
              fuegos={fuegos}
              prendiendo={prendiendo}
              logros={logros}
              repisaVisible={g.repisa}
              alTocarRepisa={() => setVerRepisa(true)}
              anchoPx={anchoPx}
              refContenedor={refJardin}
              etiqueta={`Jardín con ${items.length} plantas`}
              elegido={elegido}
              regando={regando}
              creciendo={festejo?.id ?? null}
              levantada={moviendo?.id ?? null}
              alTocarMedalla={(id) => setPagina(jardin.plantas.find((p) => p.id === id)?.id ?? items.find((i) => i.id === id)?.retonoDe?.id ?? null)}
              sobrePlanta={(p, punta) => (
                <>
                  {elegido === p.id && (
                    <span className="jardin-nombre" style={{ left: `${punta.x}%`, top: `${punta.y - 0.6}%`, zIndex: 160 }}>
                      {p.nombre}
                    </span>
                  )}
                  {items.find((i) => i.id === p.id)?.planta?.pideAgua && elegido !== p.id && !regando.has(p.id) && (
                    <span className="pide-agua" style={{ left: `${punta.x}%`, top: `${punta.y - 0.4}%`, zIndex: 160 }} aria-hidden>
                      <Icono nombre="gota" tam={16} />
                    </span>
                  )}
                </>
              )}
            >
              {/* Mientras movés una maceta: lugares libres y el camino del filósofo */}
              {moviendo &&
                celdas(forma).map((c) =>
                  c.tipo === 'libre' && (!ocupadas.has(c.i) || c.i === destinoArrastre?.i) ? (
                    <span key={`c${c.i}`} className={`celda-libre${destinoArrastre?.i === c.i ? ' destino' : ''}`} style={{ left: `${c.x - c.w / 2 + 0.6}%`, top: `${c.y - c.h / 2 + 0.5}%`, width: `${c.w - 1.2}%`, height: `${c.h - 1}%`, zIndex: 157 }} />
                  ) : c.tipo === 'pasillo' ? (
                    <span key={`c${c.i}`} className="celda-pasillo" style={{ left: `${c.x - c.w / 2}%`, top: `${c.y - c.h / 2}%`, width: `${c.w}%`, height: `${c.h}%`, zIndex: 153 }} />
                  ) : null,
                )}
              {/* Zonas tocables sobre cada maceta: tocar = ver; mantener apretado = mover */}
              {[...items].sort((a, b) => acomodo.lugar.get(a.id)! - acomodo.lugar.get(b.id)!).map((it) => {
                const c = celdas(forma)[acomodo.lugar.get(it.id)!];
                return (
                  <button
                    key={`b-${it.id}`}
                    type="button"
                    className="zona-maceta"
                    aria-label={`${it.nombre}: ${PLANTA_DE_VIRTUD[it.virtud].nombre}, ${ETAPAS_PLANTA[it.etapa]}${it.planta ? `, racha ${it.planta.a.racha}` : ''}${it.planta?.pideAgua ? ', pide agua' : ''}`}
                    aria-pressed={elegido === it.id}
                    aria-describedby="ayuda-mover"
                    onPointerDown={alBajar(it.id)}
                    onPointerMove={alMover}
                    onPointerUp={alSoltar}
                    onPointerCancel={cancelar}
                    onContextMenu={(e) => e.preventDefault()}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setElegido(elegido === it.id ? null : it.id)}
                    style={{ position: 'absolute', left: `${c.x - c.w / 2}%`, top: `${c.y - c.h}%`, width: `${c.w}%`, height: `${c.h * 1.42}%`, zIndex: 158, borderRadius: 12, background: 'transparent', border: 0, WebkitTapHighlightColor: 'transparent', outline: 'none', touchAction: moviendo ? 'none' : 'pan-y', cursor: moviendo?.id === it.id ? 'grabbing' : 'pointer' }}
                  />
                );
              })}
              {/* La maceta que se arrastra */}
              {moviendo &&
                (() => {
                  const it = items.find((i) => i.id === moviendo.id);
                  if (!it) return null;
                  const w = anchoMaceta(forma, moviendo.y) * 1.1;
                  return <img src={`/jardin/${PLANTA_DE_VIRTUD[it.virtud].id}-${it.etapa}.webp`} alt="" style={{ position: 'absolute', left: `${moviendo.x}%`, top: `${moviendo.y}%`, width: `${w}%`, transform: 'translate(-50%, -85%)', opacity: 0.9, zIndex: 170, pointerEvents: 'none', filter: 'drop-shadow(0 8px 8px rgba(0,0,0,.45))' }} />;
                })()}
              {visita && recorrido && (
                <Filosofo
                  key={`${visita.clave}-${forma}`}
                  atlas={atlas}
                  paradas={recorrido.paradas}
                  salida={recorrido.salida}
                  seguir={seguir}
                  irse={filosofoIrse}
                  altoEn={altoFilosofo}
                  anchoPx={anchoPx}
                  altoPx={altoJardinPx}
                  etiqueta={visita.tipo === 'fuego' ? 'Marco Aurelio enciende los braseros' : `${visita.c.filosofo.nombre}: ${visita.c.titulo}`}
                  alTocar={() => visita.tipo === 'consejo' && setVerConsejo(true)}
                  alLlegar={(i) => setParada(i)}
                  alIrse={filosofoSeFue}
                  alMoverse={(x, y, alto, parado) => setFilosofoPos({ x, y, alto, parado })}
                />
              )}
              {visita?.tipo === 'consejo' && parada >= 0 && !filosofoIrse && filosofoPos?.parado && (
                <span className="globo" role="button" tabIndex={0} onClick={() => setVerConsejo(true)} onKeyDown={(e) => e.key === 'Enter' && setVerConsejo(true)} style={{ left: `${filosofoPos.x}%`, top: `calc(${filosofoPos.y}% - ${filosofoPos.alto + 6}px)`, zIndex: 165 }}>
                  {visita.aviso ? visita.c.titulo : `${visita.c.filosofo.nombre} te dejó un consejo`}
                </span>
              )}
              {visita?.tipo === 'fuego' && parada === 0 && filosofoPos?.parado && (
                <span className="nube" style={{ left: `${filosofoPos.x}%`, top: `calc(${filosofoPos.y}% - ${filosofoPos.alto + 6}px)`, zIndex: 165, cursor: 'default', pointerEvents: 'none' }}>
                  Que la llama acompañe tu noche
                </span>
              )}
              {prueba && <div style={{ position: 'absolute', left: 10, top: 10, zIndex: 170, background: '#5a3d0c', color: '#ffe7b0', borderRadius: 10, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>MODO PRUEBA</div>}
            </Escena>
          </div>
          <p id="ayuda-mover" className="mu2" style={{ fontSize: 12.5, marginTop: 8 }}>
            {moviendo
              ? 'Soltala en un lugar libre (o sobre otra maceta para intercambiarlas). Las franjas oscuras son el camino del filósofo: ahí no se puede poner nada.'
              : 'Tocá una planta para ver su hábito. Mantené apretada una maceta para moverla. Tocá la repisa para ver tus logros.'}
          </p>
        </div>

        <div className="jardin-panel" style={{ marginTop: 12 }}>
          {controles}

          {modo === 'manual' && !prueba && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <button type="button" className="btn" style={{ width: 'auto', flex: '1 1 220px' }} disabled={!sedientas.length} onClick={() => regar(sedientas)}>
                <Icono nombre="gota" tam={17} /> {sedientas.length ? `Regar ${sedientas.length === 1 ? '1 planta' : `${sedientas.length} plantas`}` : 'Nada para regar'}
              </button>
              <span className="mu2" style={{ fontSize: 12.5, flex: '1 1 220px' }}>
                {sedientas.length ? 'Cumpliste estos hábitos hoy: regá sus plantas para que el día cuente.' : 'Solo se pueden regar las plantas de los hábitos que ya cumpliste hoy.'}
              </span>
            </div>
          )}

          {verConsejo && visita?.tipo === 'consejo' && (
            <div className="card" style={{ marginTop: 12, padding: '12px 16px', display: 'flex', gap: 14, alignItems: 'flex-start', border: '1.5px solid #c9a24a' }}>
              <span
                aria-hidden
                style={{ width: 60, height: 76, flex: 'none', backgroundImage: `url(${atlas.archivo})`, backgroundSize: `${atlas.ancho * (76 / atlas.celda[1])}px ${atlas.alto * (76 / atlas.celda[1])}px`, backgroundPosition: `${-((atlas.celda[0] * 76) / atlas.celda[1] - 60) / 2}px ${-atlas.filas.hablar_abajo.fila * 76}px`, backgroundRepeat: 'no-repeat' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="cap gold">{visita.c.filosofo.nombre}</div>
                <div style={{ fontWeight: 800, fontSize: 15, marginTop: 2 }}>{visita.c.titulo}</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>{visita.c.texto}</div>
                <blockquote style={{ margin: '8px 0 0', paddingLeft: 10, borderLeft: '3px solid #c9a24a', fontStyle: 'italic', fontSize: 13.5 }}>«{visita.c.frase}»</blockquote>
                <button type="button" className="ghost" style={{ marginTop: 10 }} onClick={despedirFilosofo}>
                  {visita.aviso ? 'Entendido' : 'Gracias, maestro'}
                </button>
              </div>
            </div>
          )}

          {sel ? (
            <Ficha item={sel} prueba={!!prueba} modo={modo} dificil={g.dificil} alCerrar={() => setElegido(null)} alMarcar={marcarHoy} alRegar={() => regar([sel.id])} alAbrir={(id) => setPagina(id)} />
          ) : (
            <p className="mu2" style={{ fontSize: 13, marginTop: 10 }}>
              {items.length ? 'La medalla de laurel al pie de la maceta marca las plantas al 100 %.' : `Todavía no tenés hábitos: creá uno y aparece su semilla en el jardín${esAdmin ? ' (o probá el modo prueba)' : ''}.`}
              {habitos.length > MAX_MACETEROS && ` Tenés ${habitos.length} hábitos; el jardín muestra los primeros ${MAX_MACETEROS}.`}
            </p>
          )}

          <div className="card" style={{ marginTop: 14, padding: '12px 16px' }}>
            <div className="cap gold">Tu jardín hoy</div>
            <Resumen items={items} enVivero={enVivero} adornos={Math.min(logros, ADORNOS.length)} logros={logros} />
            <details style={{ marginTop: 10, fontSize: 13 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>¿Cómo funciona el jardín?</summary>
              <ul style={{ paddingLeft: 18, margin: '6px 0 0', lineHeight: 1.6 }}>
                <li>
                  <b>Crece con los días cumplidos sin marchitarse:</b> semilla · {UMBRALES[1]}–{UMBRALES[2] - 1} días: brote · {UMBRALES[2]}–{UMBRALES[3] - 1}: chica · {UMBRALES[3]}–{UMBRALES[4] - 1}: grande · {UMBRALES[4]}+: florecida.
                </li>
                <li>
                  <b>Medalla de laurel:</b> cuando una planta (o un retoño) llega al 100 % —florecida, {UMBRALES[4]} días sin marchitarse— aparece al pie de su maceta. Si baja, la pierde.
                </li>
                <li>
                  <b>Repisa de logros:</b> cada medalla que ganás (cada {UMBRALES[4]} días seguidos de una planta) pone un adorno en la repisa del fondo; tu grupo también la ve. Podés guardarla bajo el piso y volver a sacarla.
                </li>
                <li>
                  <b>Retoños:</b> cada {DIAS_POR_RETONO} días cumplidos sin marchitarse, la planta da un retoño (hasta {MAX_RETONOS}) que ocupa un lugar libre y también crece.
                </li>
                <li>
                  <b>Los filósofos:</b> si pasás 1 o 2 días sin cumplir un hábito, Marco Aurelio o Epicteto se paran junto a su planta y te dan un consejo. A los {DIAS_PARA_MARCHITAR} días se marchita y perdés sus retoños (en difícil, todos los del jardín). De noche, la primera vez que entrás, Marco enciende los 4 braseros.
                </li>
                <li>
                  <b>Mover:</b> mantené apretada una maceta y arrastrala a cualquier lugar libre; el camino del filósofo siempre queda despejado.{' '}
                  <button type="button" className="link" style={{ padding: 0, display: 'inline' }} onClick={() => setG((x) => ({ ...x, pos: { vertical: {}, horizontal: {} } }))}>
                    Volver a acomodar como al principio
                  </button>
                </li>
                <li>
                  Cada virtud tiene su planta: {VIRTUDES.map((v) => `${NOMBRE_VIRTUD[v]} → ${PLANTA_DE_VIRTUD[v].nombre}`).join(' · ')}.
                </li>
              </ul>
            </details>
          </div>

          {esAdmin && <Prueba activa={!!prueba} total={jardin.plantas.length || MAX_MACETEROS} modo={modo} pasarDias={pasarDias} salir={() => setPrueba(null)} reiniciar={() => setPrueba({})} hora={horaPrueba} setHora={setHoraPrueba} />}
        </div>
      </div>

      {pagina &&
        (() => {
          const pp = jardin.plantas.find((x) => x.id === pagina);
          if (!pp) return null;
          return (
            <div className="hoja-planta" role="dialog" aria-label={`Página de ${pp.nombre}`} onClick={(e) => e.target === e.currentTarget && setPagina(null)}>
              <div>
                <button type="button" className="link" style={{ paddingLeft: 0 }} onClick={() => setPagina(null)}>
                  ‹ Volver al jardín
                </button>
                <VistaPlanta p={pp} retonos={jardin.retonos.filter((r) => r.madre.id === pp.id)} dificil={g.dificil} prueba={!!prueba} alMarcar={marcarHoy} alRegar={() => regar([pp.id])} />
              </div>
            </div>
          );
        })()}

      {verRepisa && <PaginaRepisa titulo="Tu repisa" logros={logros} porHabito={jardin.plantas.map((p) => ({ nombre: p.nombre, medallas: Math.floor(Math.max(p.mejor, p.ciclo) / 30), ciclo: p.ciclo }))} alCerrar={() => setVerRepisa(false)} />}

      {festejo && (
        <div className="festejo" role="alertdialog" aria-label={`${festejo.nombre} creció`} onClick={(e) => e.target === e.currentTarget && setFestejos((f) => f.slice(1))}>
          <div>
            <span className="rayos" aria-hidden />
            <div className="cap gold" style={{ position: 'relative' }}>
              {PLANTA_DE_VIRTUD[festejo.virtud].nombre} · {NOMBRE_VIRTUD[festejo.virtud]}
            </div>
            <img src={`/jardin/${PLANTA_DE_VIRTUD[festejo.virtud].id}-${festejo.etapa}.webp`} alt="" />
            <div style={{ position: 'relative', fontWeight: 800, fontSize: 20, marginTop: 4 }}>{alCien(festejo.etapa) ? '¡Al 100 %!' : `¡Creció: ${ETAPAS_PLANTA[festejo.etapa].toLowerCase()}!`}</div>
            <div style={{ position: 'relative', fontSize: 14, marginTop: 4 }}>{festejo.nombre}</div>
            <blockquote style={{ position: 'relative', margin: '10px 0 0', fontStyle: 'italic', fontSize: 13.5 }}>
              {alCien(festejo.etapa) ? '«La perfección del carácter: vivir cada día como si fuera el último.» — Marco Aurelio' : '«Ningún gran fruto nace de golpe.» — Epicteto'}
            </blockquote>
            <button type="button" className="btn" style={{ position: 'relative', marginTop: 14 }} onClick={() => setFestejos((f) => f.slice(1))}>
              {festejos.length > 1 ? `Seguir (${festejos.length - 1} más)` : 'Seguir cuidándola'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Resumen({ items, enVivero, adornos, logros }: { items: Item[]; enVivero: number; adornos: number; logros: number }) {
  const flor = items.filter((l) => l.etapa === 4).length;
  const secas = items.filter((l) => l.etapa === MARCHITA).length;
  const retonos = items.filter((l) => l.retonoDe).length;
  return (
    <div style={{ display: 'flex', gap: 18, marginTop: 8, flexWrap: 'wrap' }}>
      {[
        [items.length - retonos, 'plantas'],
        [retonos, 'retoños'],
        [flor, 'al 100 %'],
        [secas, 'marchitas'],
        [logros, logros === 1 ? 'medalla' : 'medallas'],
        [adornos, 'adornos'],
      ].map(([n, t]) => (
        <div key={t as string}>
          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{n}</div>
          <div className="mu2" style={{ fontSize: 11 }}>
            {t}
          </div>
        </div>
      ))}
      {enVivero > 0 && <div className="mu2" style={{ fontSize: 12, alignSelf: 'center' }}>(+{enVivero} en el vivero: no entran en el jardín)</div>}
    </div>
  );
}

function Ficha({ item, prueba, modo, dificil, alCerrar, alMarcar, alRegar, alAbrir }: { item: Item; prueba: boolean; modo: ModoRiego; dificil: boolean; alCerrar: () => void; alMarcar: (h: Habito) => void; alRegar: () => void; alAbrir: (id: string) => void }) {
  const planta = PLANTA_DE_VIRTUD[item.virtud];
  const p = item.planta;
  let texto: string;
  if (item.retonoDe) {
    texto = `Retoño nacido de ${item.retonoDe.nombre}. Crece mientras su madre siga cumpliendo; si ella se marchita, se pierde${dificil ? ' (en difícil, se pierden todos los retoños si cualquier planta se marchita)' : ''}.`;
  } else if (p) {
    const falta = faltanParaCrecer(p.ciclo, p.a.etapa);
    texto = p.pideAgua
      ? 'Cumpliste el hábito hoy: regala para que el día cuente.'
      : p.a.etapa === MARCHITA
        ? `Lleva ${p.a.sinCumplir} días sin ${modo === 'manual' ? 'cumplir y regar' : 'cumplir'}. Hacelo hoy y revive.`
        : p.riesgo > 0
          ? `${p.a.sinCumplir} ${p.a.sinCumplir === 1 ? 'día' : 'días'} sin cumplir. A los ${DIAS_PARA_MARCHITAR} se marchita${p.retonos ? ` y perdés ${p.retonos === 1 ? 'su retoño' : `sus ${p.retonos} retoños`}` : ''}.`
          : falta === null
            ? `¡Al 100 %! ${p.retonos < MAX_RETONOS ? `Próximo retoño en ${DIAS_POR_RETONO - (p.ciclo % DIAS_POR_RETONO)} días.` : 'Ya dio todos sus retoños.'}`
            : `Te ${falta === 1 ? 'falta 1 día' : `faltan ${falta} días`} para que sea ${ETAPAS_PLANTA[p.a.etapa + 1].toLowerCase()}.`;
  } else texto = '';
  return (
    <div className="card" style={{ marginTop: 12, padding: '12px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
      <img src={`/jardin/${planta.id}-${item.etapa}.webp`} alt="" style={{ width: 64, height: 64, objectFit: 'contain', flex: 'none' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{item.nombre}</div>
        <div className="mu2" style={{ fontSize: 12.5 }}>
          {planta.nombre} ({NOMBRE_VIRTUD[item.virtud]}) · {ETAPAS_PLANTA[item.etapa]}
          {p && ` · racha ${p.a.racha}`}
          {alCien(item.etapa) && ' · 100 %'}
          {p && p.retonos > 0 && ` · ${p.retonos} ${p.retonos === 1 ? 'retoño' : 'retoños'}`}
        </div>
        <div style={{ fontSize: 13, marginTop: 4 }}>{texto}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {p?.habito && !prueba && p.habito.tipo === 'sino' && (
            <button type="button" className="ghost" onClick={() => alMarcar(p.habito!)}>
              {p.hechoHoy ? 'Desmarcar hoy' : 'Marcar hoy'}
            </button>
          )}
          {p?.pideAgua && !prueba && (
            <button type="button" className="ghost" onClick={alRegar}>
              <Icono nombre="gota" tam={16} /> Regar
            </button>
          )}
          <button type="button" className="ghost" onClick={() => alAbrir(p?.id ?? item.retonoDe!.id)}>
            {item.retonoDe ? 'Ver la planta madre' : 'Ver su página'}
          </button>
        </div>
      </div>
      <button type="button" className="ico" aria-label="Cerrar" onClick={alCerrar}>
        ✕
      </button>
    </div>
  );
}

function Prueba({
  activa,
  total,
  modo,
  pasarDias,
  salir,
  reiniciar,
  hora,
  setHora,
}: {
  activa: boolean;
  total: number;
  modo: ModoRiego;
  pasarDias: (n: number, cumplidos: number, regaste: boolean) => void;
  salir: () => void;
  reiniciar: () => void;
  hora: number | null;
  setHora: (h: number | null) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [cumplidos, setCumplidos] = useState(Math.max(1, Math.round(total * 0.7)));
  const [regaste, setRegaste] = useState(true);
  const n = Math.min(cumplidos, total);
  return (
    <div className="card" style={{ marginTop: 14, padding: '10px 16px' }}>
      <button type="button" className="mu2" style={{ fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
        <Icono nombre="enfoque" tam={15} /> Modo prueba {abierto ? '▲' : '▼'}
      </button>
      {abierto && (
        <div style={{ marginTop: 8 }}>
          <p className="mu2" style={{ fontSize: 12.5, margin: '0 0 8px' }}>
            Hacé pasar días inventados y mirá cómo crecen, llegan al 100 %, dan retoños, desbloquean adornos o reciben la visita del filósofo. No toca tus hábitos reales. Si no tenés hábitos, llena el jardín con plantas de ejemplo.
          </p>
          <label style={{ display: 'block', fontSize: 13 }}>
            Hábitos cumplidos por día: <b>{n}</b> de {total}
            <input type="range" min={0} max={total} value={n} onChange={(e) => setCumplidos(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--gold)' }} aria-label="Hábitos cumplidos por día" />
          </label>
          {modo === 'manual' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '4px 0 8px' }}>
              <input type="checkbox" checked={regaste} onChange={(e) => setRegaste(e.target.checked)} style={{ accentColor: 'var(--gold)' }} />
              Entré a regar esos días
            </label>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" className="ghost" onClick={() => pasarDias(1, n, regaste)}>
              +1 día
            </button>
            <button type="button" className="ghost" onClick={() => pasarDias(7, n, regaste)}>
              +7 días
            </button>
            <button type="button" className="ghost" onClick={() => pasarDias(30, n, regaste)}>
              +30 días
            </button>
            <button type="button" className="ghost" onClick={() => pasarDias(30, total, regaste)}>
              +30 días cumpliendo todo
            </button>
            <button type="button" className="ghost" onClick={() => pasarDias(1, 0, regaste)}>
              1 día sin cumplir
            </button>
            <button type="button" className="ghost" onClick={() => pasarDias(3, 0, regaste)}>
              3 días sin cumplir
            </button>
            {activa && (
              <>
                <button type="button" className="ghost" onClick={reiniciar}>
                  Empezar de cero
                </button>
                <button type="button" className="ghost" onClick={salir}>
                  Volver a lo real
                </button>
              </>
            )}
          </div>
          <label style={{ display: 'block', fontSize: 12.5, marginTop: 10 }}>
            Hora del jardín: {hora === null ? 'la real' : `${hora}:00`}
            <input type="range" min={-1} max={23} value={hora ?? -1} onChange={(e) => setHora(Number(e.target.value) < 0 ? null : Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--gold)' }} aria-label="Hora del jardín" />
          </label>
        </div>
      )}
    </div>
  );
}
