import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useSesion } from '@/app/sesion';
import { alCien, consejo, DIAS_PARA_MARCHITAR, DIAS_POR_RETONO, ETAPAS_PLANTA, faltanParaCrecer, hashTexto, MARCHITA, MAX_RETONOS, PLANTA_DE_VIRTUD, UMBRALES, visitaDelDia, type Consejo } from '@core/jardin';
import { NOMBRE_VIRTUD, VIRTUDES, type Habito, type Virtud } from '@core/habitos';
import { useAvisos } from '@/ui/avisos';
import { alternarSiNo, useDatos, useHabitosActivos, useHoy } from '@/app/datos';
import { FONDOS, MACETEROS, SPRITES } from './disposicion';
import { Noche } from './Noche';
import { crearSonido, type SonidoJardin } from './sonido';
import { ESTILOS_GRAFICOS, Medalla } from './Graficos';
import { VistaPlanta } from './Planta';
import { calcularJardin, MAX_MACETEROS, useGuardado, type ModoRiego, type PlantaCalc } from './estado';

/** Ancho máximo de cada planta (su etapa más grande), para que la adulta ocupe el ancho del macetero. */
const ANCHO_MAX: Record<string, number> = Object.fromEntries(Object.entries(SPRITES).map(([k, v]) => [k, Math.max(...v.map((s) => s.w))]));
/** Dónde está la regadera dibujada en cada fondo (en %). */
const REGADERA = { vertical: { x: 12, y: 90, w: 20, h: 10 }, horizontal: { x: 8, y: 82, w: 13, h: 18 } } as const;

function fuerzaNoche(h: number): number {
  if (h >= 20 || h < 6) return 1;
  if (h >= 18) return 0.6;
  if (h < 7) return 0.4;
  return 0;
}
/** Tinte según la hora: amanecer, día, atardecer, noche. */
function tinte(h: number): { color: string; opacidad: number } {
  if (h >= 20 || h < 6) return { color: '#101b45', opacidad: 0.64 };
  if (h < 8) return { color: '#ffb27a', opacidad: 0.16 };
  if (h >= 17) return { color: '#ff9a4a', opacidad: 0.2 };
  return { color: '#fff', opacidad: 0 };
}

const azar = (semilla: number) => {
  let s = semilla % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
};

function useAncho(): boolean {
  const consulta = '(min-width: 760px)';
  const [ancho, setAncho] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(consulta).matches);
  useEffect(() => {
    const m = window.matchMedia?.(consulta);
    if (!m) return;
    const f = () => setAncho(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return !!ancho;
}

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

/** Lo que se dibuja en cada macetero: la planta de un hábito o un retoño. */
interface Item {
  id: string;
  nombre: string;
  virtud: Virtud;
  etapa: number;
  planta: PlantaCalc | null;
  retonoDe: PlantaCalc | null;
}

/** El Jardín estoico: cada hábito es una planta de su virtud que crece con la racha. */
export function Jardin() {
  const perfil = useSesion((s) => s.perfil);
  if (perfil?.rol !== 'admin') return <Navigate to="/" replace />;
  return <JardinAdmin />;
}

function JardinAdmin() {
  const uid = useSesion((s) => s.usuario?.uid ?? '');
  const avisar = useAvisos((s) => s.mostrar);
  const hoy = useHoy();
  const habitos = useHabitosActivos();
  const registros = useDatos((s) => s.registros);
  const ancho = useAncho();
  const forma = ancho ? 'horizontal' : 'vertical';
  const fondo = FONDOS[forma];
  // Se llenan de adelante (los más grandes y visibles) hacia atrás.
  const maceteros = useMemo(() => [...MACETEROS[forma]].sort((a, b) => b.y - a.y || a.x - b.x), [forma]);
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
  const [verConsejo, setVerConsejo] = useState(false);
  const [conSonido, setConSonido] = useState(false);
  const sonido = useRef<SonidoJardin | null>(null);
  const [refJardin, anchoPx] = useAnchoPx<HTMLDivElement>();
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
  const items: Item[] = useMemo(
    () => [
      ...jardin.plantas.map((p) => ({ id: p.id, nombre: p.nombre, virtud: p.virtud, etapa: p.a.etapa, planta: p, retonoDe: null })),
      ...jardin.retonos.map((r) => ({ id: r.id, nombre: `Retoño de ${r.madre.nombre}`, virtud: r.madre.virtud, etapa: r.etapa, planta: null, retonoDe: r.madre })),
    ],
    [jardin],
  );

  // Aviso si se perdieron retoños (y nota de lira si alguna planta creció)
  const etapasAntes = useRef<Map<string, number>>(new Map());
  const previosPrueba = useRef<Record<string, number>>({});
  useEffect(() => {
    let crecio = false;
    for (const it of items) {
      const a = etapasAntes.current.get(it.id);
      if (a !== undefined && it.etapa !== MARCHITA && it.etapa > a) crecio = true;
      etapasAntes.current.set(it.id, it.etapa);
    }
    if (crecio) sonido.current?.lira();
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
    window.setTimeout(() => setRegando(new Set()), 1400);
  }, []);

  /** Riego manual: regar las plantas cuyo hábito ya está cumplido hoy. */
  const regar = (ids: string[]) => {
    const validos = ids.filter((id) => jardin.plantas.find((p) => p.id === id)?.pideAgua);
    if (!validos.length) return;
    setG((x) => {
      const riegos = { ...x.riegos };
      for (const id of validos) riegos[id] = [...(riegos[id] ?? []).filter((d) => d >= sumar(hoy, -150) && d !== hoy), hoy];
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
    if (cumplidosPorDia > 0) animarRiego(ids.filter((id) => nuevo[id][nuevo[id].length - 1]));
  };

  // El filósofo: viene a la planta con más días sin cumplir; si ninguna está en riesgo, algunos días pasea igual.
  const diaVisita = prueba ? `prueba-${Object.values(prueba)[0]?.length ?? 0}` : hoy;
  const filosofo = useMemo((): { id: string; c: Consejo; aviso: boolean } | null => {
    const enRiesgo = [...jardin.plantas].filter((p) => p.riesgo > 0).sort((a, b) => b.riesgo - a.riesgo)[0];
    if (enRiesgo) return { id: enRiesgo.id, c: consejo(enRiesgo.riesgo, enRiesgo.nombre, hashTexto(`${diaVisita}-${enRiesgo.id}`)), aviso: true };
    const v = visitaDelDia(diaVisita, jardin.plantas.length);
    if (!v || g.fortunaEspantada === diaVisita) return null;
    const p = jardin.plantas[v.planta];
    if (!p || p.a.etapa === MARCHITA) return null;
    return { id: p.id, c: consejo(0, p.nombre, v.semilla), aviso: false };
  }, [diaVisita, jardin, g.fortunaEspantada]);
  const despedirFilosofo = () => {
    setVerConsejo(false);
    if (filosofo && !filosofo.aviso) setG((x) => ({ ...x, fortunaEspantada: diaVisita }));
  };

  const sel = items.find((l) => l.id === elegido) ?? null;
  const t = tinte(horaVista);
  const relacion = fondo.ancho / fondo.alto;
  const sedientas = jardin.plantas.filter((p) => p.pideAgua).map((p) => p.id);
  const rg = REGADERA[forma];
  const pxPorPct = anchoPx / 100;

  return (
    <div className="entra" style={{ maxWidth: 1100, marginInline: 'auto' }}>
      <style>{`
        ${ESTILOS_GRAFICOS}
        @keyframes mecer { 0%,100% { transform: rotate(-1.2deg) } 50% { transform: rotate(1.2deg) } }
        @keyframes revivir { from { transform: scale(.6); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes saltito { 0%,100% { transform: scale(1) } 40% { transform: scale(1.06, .95) } 70% { transform: scale(.98, 1.03) } }
        @keyframes latir { 0%,100% { transform: translate(-50%, -100%) scale(1); opacity: .9 } 50% { transform: translate(-50%, -100%) scale(1.15); opacity: 1 } }
        .jardin-planta { position: absolute; transform-origin: 50% 100%; pointer-events: none; }
        .jardin-planta img { width: 100%; display: block; transform-origin: 50% 100%; animation: revivir .5s ease-out, mecer 4.5s ease-in-out .5s infinite; transition: filter .4s; }
        .jardin-planta.seca img { animation: revivir .5s ease-out; }
        .jardin-planta.elegida img { filter: drop-shadow(0 0 6px rgba(255,214,120,.95)) drop-shadow(0 0 14px rgba(255,190,80,.6)); }
        .jardin-planta.regando { animation: saltito .9s ease-out; }
        .jardin-planta.regando img { filter: drop-shadow(0 0 8px rgba(150,215,255,.95)) brightness(1.08); }
        .jardin-planta.retono img { filter: saturate(1.05); }
        .jardin-nombre { position: absolute; transform: translate(-50%, -100%); white-space: nowrap; background: rgba(30,24,16,.78); color: #f3e6c8; font-size: 11.5px; font-weight: 700; padding: 3px 9px; border-radius: 10px; pointer-events: none; }
        .pide-agua { position: absolute; font-size: 15px; animation: latir 1.4s ease-in-out infinite; filter: drop-shadow(0 1px 2px rgba(0,0,0,.4)); pointer-events: none; }
        .orbita { position: absolute; width: 0; height: 0; pointer-events: none; }
        .orbita > span { position: absolute; display: block; animation: orbita var(--t) linear infinite; animation-delay: var(--d); }
        .orbita > span > span { display: block; transform: translate(-50%, -50%); animation: vaiven 1.1s ease-in-out infinite; }
        .medalla-pie { position: absolute; transform: translate(-50%, -30%); animation: brillo-medalla 3s ease-in-out infinite; background: none; border: 0; padding: 0; cursor: pointer; }
        @keyframes llegar { from { opacity: 0; transform: translate(-50%, -96%) } to { opacity: 1; transform: translate(-50%, -100%) } }
        @keyframes globo { 0%,100% { transform: translate(-50%, -100%) } 50% { transform: translate(-50%, -104%) } }
        .filosofo { position: absolute; transform: translate(-50%, -100%); background: none; border: 0; padding: 0; cursor: pointer; animation: llegar .8s ease-out; filter: drop-shadow(2px 4px 3px rgba(60,40,10,.45)); }
        .filosofo img { width: 100%; display: block; }
        .globo { position: absolute; transform: translate(-50%, -100%); background: #fffaf0; color: #3b2a12; border: 1.5px solid #c9a24a; border-radius: 12px; padding: 5px 9px; font-size: 11.5px; font-weight: 700; line-height: 1.25; max-width: 170px; text-align: center; box-shadow: 0 3px 8px rgba(0,0,0,.25); animation: globo 2.6s ease-in-out infinite; cursor: pointer; }
        .globo::after { content: ''; position: absolute; left: 50%; bottom: -7px; margin-left: -6px; border: 6px solid transparent; border-top-color: #c9a24a; border-bottom: 0; }
        .hoja-planta { position: fixed; inset: 0; z-index: 200; background: rgba(20,14,6,.55); display: flex; justify-content: center; align-items: flex-end; }
        .hoja-planta > div { background: var(--bg, #f4ede1); width: min(760px, 100%); max-height: 92vh; overflow: auto; border-radius: 22px 22px 0 0; padding: 14px 16px 28px; }
        @media (min-width: 760px) { .hoja-planta { align-items: center } .hoja-planta > div { border-radius: 22px } }
        @media (prefers-reduced-motion: reduce) { .jardin-planta img, .pide-agua, .medalla-pie, .filosofo, .globo { animation: none } }
      `}</style>
      <div className="cap gold">Jardín estoico · prueba</div>
      <h1 className="titulo">Tu jardín</h1>
      <p className="mu" style={{ marginTop: 4 }}>
        Cada hábito es una planta de su virtud. Crece con tu constancia, llega al 100 % (medalla de laurel), da retoños y se marchita si lo dejás.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
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
          {conSonido ? '🔊 Sonido activado' : '🔈 Activar sonido'}
        </button>
      </div>
      <p className="mu2" style={{ fontSize: 12.5, marginTop: 6 }}>
        {modo === 'auto' ? 'Riego automático: cumplir el hábito ya riega su planta.' : 'Riego manual: además de cumplir el hábito, entrá y regá su planta ese mismo día; si no, el día no cuenta.'}{' '}
        {g.dificil ? 'Difícil: si cualquier planta se marchita, perdés TODOS los retoños del jardín.' : 'Normal: si una planta se marchita, perdés solo sus retoños.'}
      </p>

      <div className="card" style={{ marginTop: 10, padding: 0, overflow: 'hidden', border: 'none' }}>
        <div ref={refJardin} style={{ position: 'relative', width: '100%', aspectRatio: `${fondo.ancho} / ${fondo.alto}`, background: `#d9c7a5 url(${fondo.archivo}) center / cover no-repeat` }} aria-label={`Jardín con ${items.length} plantas`} role="img">
          {items.map((it, i) => {
            const m = maceteros[i];
            const planta = PLANTA_DE_VIRTUD[it.virtud].id;
            const s = SPRITES[planta][it.etapa];
            const escala = it.retonoDe ? 0.85 : 1.1;
            const anchoPct = (s.w / ANCHO_MAX[planta]) * m.w * escala;
            const altoPct = anchoPct * relacion * (s.h / s.w);
            const piso = m.y + m.h * 0.45;
            const conFilosofo = filosofo?.id === it.id;
            return (
              <div key={it.id}>
                <div
                  className={`jardin-planta${it.etapa === MARCHITA ? ' seca' : ''}${regando.has(it.id) ? ' regando' : ''}${elegido === it.id ? ' elegida' : ''}${it.retonoDe ? ' retono' : ''}`}
                  style={{ left: `${m.x - (s.ax / s.w) * anchoPct}%`, top: `${piso - altoPct}%`, width: `${anchoPct}%`, zIndex: 2 + Math.round(m.y) }}
                >
                  <img key={`${planta}-${it.etapa}`} src={`/jardin/${planta}-${it.etapa}.webp`} alt="" draggable={false} style={{ animationDelay: `0s, ${-(i * 0.7) % 4.5}s` }} />
                </div>
                {/* Medalla al pie del macetero: la planta (o el retoño) está al 100 % */}
                {alCien(it.etapa) && (
                  <button
                    type="button"
                    className="medalla-pie"
                    aria-label={`${it.nombre} está al 100 %: ver su página`}
                    onClick={() => setPagina(it.planta?.id ?? it.retonoDe?.id ?? null)}
                    style={{ left: `${m.x + m.w * 0.36}%`, top: `${m.y + m.h * 0.75}%`, zIndex: 66, animationDelay: `${-i * 0.4}s` }}
                  >
                    <Medalla tipo="Oro" dias={100} tam={Math.max(24, m.w * pxPorPct * (it.retonoDe ? 0.3 : 0.38))} />
                  </button>
                )}
                {elegido === it.id && (
                  <span className="jardin-nombre" style={{ left: `${m.x}%`, top: `${piso - altoPct - 0.8}%`, zIndex: 62 }}>
                    {it.nombre}
                  </span>
                )}
                {it.planta?.pideAgua && elegido !== it.id && (
                  <span className="pide-agua" style={{ left: `${m.x}%`, top: `${piso - altoPct - 0.5}%`, zIndex: 61 }} aria-hidden>
                    💧
                  </span>
                )}
                {conFilosofo && filosofo && (
                  <>
                    <button
                      type="button"
                      className="filosofo"
                      aria-label={`${filosofo.c.filosofo.nombre}: ${filosofo.c.titulo}`}
                      onClick={() => setVerConsejo(true)}
                      style={{ left: `${m.x + m.w * 0.66}%`, top: `${m.y + m.h * 0.95}%`, width: Math.max(44, m.w * pxPorPct * 0.55), zIndex: 85 }}
                    >
                      <img src={`/jardin/filosofo-${filosofo.c.filosofo.id}.webp`} alt="" draggable={false} />
                    </button>
                    <span className="globo" role="button" tabIndex={0} onClick={() => setVerConsejo(true)} onKeyDown={(e) => e.key === 'Enter' && setVerConsejo(true)} style={{ left: `${m.x + m.w * 0.66}%`, top: `calc(${m.y + m.h * 0.95}% - ${(Math.max(44, m.w * pxPorPct * 0.55) * 420) / 174 + 8}px)`, zIndex: 90 }}>
                      {filosofo.aviso ? filosofo.c.titulo : `${filosofo.c.filosofo.nombre} te dejó un consejo`}
                    </span>
                  </>
                )}
              </div>
            );
          })}
          {/* Zonas tocables sobre cada macetero */}
          {items.map((it, i) => {
            const m = maceteros[i];
            return (
              <button
                key={`b-${it.id}`}
                type="button"
                aria-label={`${it.nombre}: ${PLANTA_DE_VIRTUD[it.virtud].nombre}, ${ETAPAS_PLANTA[it.etapa]}${it.planta ? `, racha ${it.planta.a.racha}` : ''}${it.planta?.pideAgua ? ', pide agua' : ''}`}
                aria-pressed={elegido === it.id}
                onClick={() => setElegido(elegido === it.id ? null : it.id)}
                style={{ position: 'absolute', left: `${m.x - m.w * 0.55}%`, top: `${m.y - m.h * 2.4}%`, width: `${m.w * 1.1}%`, height: `${m.h * 3}%`, zIndex: 70, borderRadius: 12, background: 'transparent', WebkitTapHighlightColor: 'transparent', outline: 'none' }}
              />
            );
          })}
          {/* La regadera del dibujo: en riego manual, riega todas las que piden agua */}
          {modo === 'manual' && !prueba && (
            <button
              type="button"
              aria-label={sedientas.length ? `Regar ${sedientas.length} plantas` : 'Regadera: no hay plantas para regar'}
              onClick={() => regar(sedientas)}
              style={{ position: 'absolute', left: `${rg.x - rg.w / 2}%`, top: `${rg.y - rg.h / 2}%`, width: `${rg.w}%`, height: `${rg.h}%`, zIndex: 72, borderRadius: 16, background: sedientas.length ? 'radial-gradient(circle, rgba(120,200,255,.35), rgba(120,200,255,0) 70%)' : 'transparent' }}
            />
          )}
          <div style={{ position: 'absolute', inset: 0, background: t.color, opacity: t.opacidad, mixBlendMode: 'multiply', pointerEvents: 'none', zIndex: 50, transition: 'opacity 1s' }} />
          <Noche forma={forma} fuerza={fuerza} />
          {prueba && <div style={{ position: 'absolute', left: 10, top: 10, zIndex: 80, background: '#5a3d0c', color: '#ffe7b0', borderRadius: 10, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>MODO PRUEBA</div>}
        </div>
      </div>

      {modo === 'manual' && !prueba && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn" style={{ width: 'auto', flex: '1 1 220px' }} disabled={!sedientas.length} onClick={() => regar(sedientas)}>
            💧 {sedientas.length ? `Regar ${sedientas.length === 1 ? '1 planta' : `${sedientas.length} plantas`}` : 'Nada para regar'}
          </button>
          <span className="mu2" style={{ fontSize: 12.5, flex: '1 1 220px' }}>
            {sedientas.length ? 'Cumpliste estos hábitos hoy: regá sus plantas para que el día cuente (o tocá la regadera).' : 'Solo se pueden regar las plantas de los hábitos que ya cumpliste hoy.'}
          </span>
        </div>
      )}

      {verConsejo && filosofo && (
        <div className="card" style={{ marginTop: 12, padding: '12px 16px', display: 'flex', gap: 14, alignItems: 'flex-start', border: '1.5px solid #c9a24a' }}>
          <img src={`/jardin/filosofo-${filosofo.c.filosofo.id}.webp`} alt="" style={{ width: 46, flex: 'none' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="cap gold">{filosofo.c.filosofo.nombre}</div>
            <div style={{ fontWeight: 800, fontSize: 15, marginTop: 2 }}>{filosofo.c.titulo}</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>{filosofo.c.texto}</div>
            <blockquote style={{ margin: '8px 0 0', paddingLeft: 10, borderLeft: '3px solid #c9a24a', fontStyle: 'italic', fontSize: 13.5 }}>«{filosofo.c.frase}»</blockquote>
            <button type="button" className="ghost" style={{ marginTop: 10 }} onClick={despedirFilosofo}>
              {filosofo.aviso ? 'Entendido' : 'Gracias, maestro'}
            </button>
          </div>
        </div>
      )}

      {sel ? (
        <Ficha item={sel} prueba={!!prueba} modo={modo} dificil={g.dificil} alCerrar={() => setElegido(null)} alMarcar={marcarHoy} alRegar={() => regar([sel.id])} alAbrir={(id) => setPagina(id)} />
      ) : (
        <p className="mu2" style={{ fontSize: 13, marginTop: 10 }}>
          {items.length ? 'Tocá una planta para ver su hábito y abrir su página. La medalla de laurel al pie del macetero marca las plantas al 100 %.' : 'Todavía no tenés hábitos: creá uno y aparece su semilla en el jardín (o probá el modo prueba).'}
          {habitos.length > MAX_MACETEROS && ` Tenés ${habitos.length} hábitos; el jardín muestra los primeros ${MAX_MACETEROS}.`}
        </p>
      )}

      <div className="card" style={{ marginTop: 14, padding: '12px 16px' }}>
        <div className="cap gold">Tu jardín hoy</div>
        <Resumen items={items} enVivero={jardin.enVivero} />
        <details style={{ marginTop: 10, fontSize: 13 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>¿Cómo funciona el jardín?</summary>
          <ul style={{ paddingLeft: 18, margin: '6px 0 0', lineHeight: 1.6 }}>
            <li>
              <b>Crece con los días cumplidos sin marchitarse:</b> semilla · {UMBRALES[1]}–{UMBRALES[2] - 1} días: brote · {UMBRALES[2]}–{UMBRALES[3] - 1}: chica · {UMBRALES[3]}–{UMBRALES[4] - 1}: grande · {UMBRALES[4]}+: florecida.
            </li>
            <li>
              <b>Medalla de laurel:</b> cuando una planta (o un retoño) llega al 100 % —florecida, {UMBRALES[4]} días sin marchitarse— aparece al pie de su macetero. Si baja, la pierde.
            </li>
            <li>
              <b>Retoños:</b> cada {DIAS_POR_RETONO} días cumplidos sin marchitarse, la planta da un retoño (hasta {MAX_RETONOS}) que ocupa un macetero libre y también crece.
            </li>
            <li>
              <b>El filósofo:</b> si pasás 1 o 2 días sin cumplir un hábito, Marco Aurelio, Séneca o Epicteto se para junto a su planta y te da un consejo. A los {DIAS_PARA_MARCHITAR} días se marchita y perdés sus retoños (en difícil, todos los del jardín).
            </li>
            <li>
              <b>Visitas:</b> algunos días, aunque todo esté bien, un filósofo pasea por el jardín y te deja un pensamiento.
            </li>
            <li>
              Cada virtud tiene su planta: {VIRTUDES.map((v) => `${NOMBRE_VIRTUD[v]} → ${PLANTA_DE_VIRTUD[v].nombre}`).join(' · ')}.
            </li>
          </ul>
        </details>
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

      <Prueba activa={!!prueba} total={jardin.plantas.length || MAX_MACETEROS} modo={modo} pasarDias={pasarDias} salir={() => setPrueba(null)} reiniciar={() => setPrueba({})} hora={horaPrueba} setHora={setHoraPrueba} />
    </div>
  );
}

const sumar = (dia: string, n: number) => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

function Resumen({ items, enVivero }: { items: Item[]; enVivero: number }) {
  const flor = items.filter((l) => l.etapa === 4).length;
  const secas = items.filter((l) => l.etapa === MARCHITA).length;
  const retonos = items.filter((l) => l.retonoDe).length + enVivero;
  return (
    <div style={{ display: 'flex', gap: 18, marginTop: 8, flexWrap: 'wrap' }}>
      {[
        [items.length - items.filter((l) => l.retonoDe).length, 'plantas'],
        [retonos, 'retoños'],
        [flor, 'al 100 %'],
        [secas, 'marchitas'],
      ].map(([n, t]) => (
        <div key={t as string}>
          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{n}</div>
          <div className="mu2" style={{ fontSize: 11 }}>
            {t}
          </div>
        </div>
      ))}
      {enVivero > 0 && <div className="mu2" style={{ fontSize: 12, alignSelf: 'center' }}>(+{enVivero} en el vivero: no entran en los maceteros)</div>}
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
              💧 Regar
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
      <button type="button" className="mu2" style={{ fontSize: 13, fontWeight: 700 }} onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
        🧪 Modo prueba {abierto ? '▲' : '▼'}
      </button>
      {abierto && (
        <div style={{ marginTop: 8 }}>
          <p className="mu2" style={{ fontSize: 12.5, margin: '0 0 8px' }}>
            Hacé pasar días inventados y mirá cómo crecen, llegan al 100 %, dan retoños, o reciben la visita del filósofo. No toca tus hábitos reales. Si no tenés hábitos, llena el jardín con plantas de ejemplo.
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
