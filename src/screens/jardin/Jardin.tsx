import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useSesion } from '@/app/sesion';
import { DIAS_PARA_MARCHITAR, DIAS_POR_RETONO, ETAPAS_PLANTA, faltanParaCrecer, MARCHITA, MAX_RETONOS, MEDALLAS, PASIONES, PLANTA_DE_VIRTUD, plagaDeFortuna, UMBRALES } from '@core/jardin';
import { NOMBRE_VIRTUD, VIRTUDES, type Habito, type Virtud } from '@core/habitos';
import { useAvisos } from '@/ui/avisos';
import { alternarSiNo, useDatos, useHabitosActivos, useHoy } from '@/app/datos';
import { FONDOS, MACETEROS, SPRITES } from './disposicion';
import { Noche } from './Noche';
import { crearSonido, type SonidoJardin } from './sonido';
import { Bicho, ESTILOS_GRAFICOS, Medalla } from './Graficos';
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

/** Ancho en px de un elemento (para dibujar medallas y bichos a escala). */
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
  plaga: number;
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
  const navegar = useNavigate();
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
  const [espantando, setEspantando] = useState(false);
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
      ...jardin.plantas.map((p) => ({ id: p.id, nombre: p.nombre, virtud: p.virtud, etapa: p.a.etapa, plaga: p.plaga, planta: p, retonoDe: null })),
      ...jardin.retonos.map((r) => ({ id: r.id, nombre: `Retoño de ${r.madre.nombre}`, virtud: r.madre.virtud, etapa: r.etapa, plaga: r.plaga, planta: null, retonoDe: r.madre })),
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

  // Plaga de la Fortuna: algunos días aparece en una planta sana; se espanta tocándola.
  const diaFortuna = prueba ? `prueba-${Object.values(prueba)[0]?.length ?? 0}` : hoy;
  const fortuna = useMemo(() => {
    const f = plagaDeFortuna(diaFortuna, jardin.plantas.length);
    if (!f) return null;
    const p = jardin.plantas[f.planta];
    if (!p || p.plaga > 0 || p.a.etapa === MARCHITA || p.a.etapa === 0) return null;
    if (g.fortunaEspantada === diaFortuna) return null;
    return { id: p.id, pasion: PASIONES[f.pasion] };
  }, [diaFortuna, jardin, g.fortunaEspantada]);
  const espantar = () => {
    if (!fortuna) return;
    setEspantando(true);
    sonido.current?.lira();
    avisar(`Espantaste la ${fortuna.pasion.nombre.toLowerCase()}. «${fortuna.pasion.frase}»`);
    window.setTimeout(() => {
      setG((x) => ({ ...x, fortunaEspantada: diaFortuna }));
      setEspantando(false);
    }, 700);
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
        .fortuna { position: absolute; transform: translate(-50%, -50%); background: none; border: 0; padding: 6px; cursor: pointer; animation: vaiven 1.4s ease-in-out infinite; }
        .fortuna.chau { animation: espantar .7s ease-in forwards; }
        @media (prefers-reduced-motion: reduce) { .jardin-planta img, .pide-agua, .orbita > span, .medalla-pie, .fortuna { animation: none } }
      `}</style>
      <div className="cap gold">Jardín estoico · prueba</div>
      <h1 className="titulo">Tu jardín</h1>
      <p className="mu" style={{ marginTop: 4 }}>
        Cada hábito es una planta de su virtud. Crece con tu racha, da medallas y retoños, y se marchita si lo dejás.
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
            const centroY = piso - altoPct * 0.55;
            const tamBicho = Math.max(18, m.w * pxPorPct * 0.32);
            const radio = Math.max(16, m.w * pxPorPct * 0.38);
            const esFortuna = fortuna?.id === it.id;
            return (
              <div key={it.id}>
                <div
                  className={`jardin-planta${it.etapa === MARCHITA ? ' seca' : ''}${regando.has(it.id) ? ' regando' : ''}${elegido === it.id ? ' elegida' : ''}${it.retonoDe ? ' retono' : ''}`}
                  style={{ left: `${m.x - (s.ax / s.w) * anchoPct}%`, top: `${piso - altoPct}%`, width: `${anchoPct}%`, zIndex: 2 + Math.round(m.y) }}
                >
                  <img key={`${planta}-${it.etapa}`} src={`/jardin/${planta}-${it.etapa}.webp`} alt="" draggable={false} style={{ animationDelay: `0s, ${-(i * 0.7) % 4.5}s` }} />
                </div>
                {/* Plaga por descuido: bichos dando vueltas (1 o 3) */}
                {it.plaga > 0 && (
                  <div className="orbita" style={{ left: `${m.x}%`, top: `${centroY}%`, zIndex: 63 }} aria-hidden>
                    {Array.from({ length: it.plaga === 1 ? 1 : 3 }, (_, k) => (
                      <span key={k} style={{ ['--radio' as string]: `${radio}px`, ['--t' as string]: `${3.2 + k * 0.6}s`, ['--d' as string]: `${-k * 1.1}s` }}>
                        <span>
                          <Bicho pasion={PASIONES[(i + k) % PASIONES.length].id} tam={tamBicho} />
                        </span>
                      </span>
                    ))}
                  </div>
                )}
                {/* Medalla al pie del macetero */}
                {it.planta?.medalla && (
                  <button
                    type="button"
                    className="medalla-pie"
                    aria-label={`Medalla de ${it.planta.medalla.nombre} de ${it.nombre}: ver su planta`}
                    onClick={() => !prueba && it.planta?.habito && navegar(`/jardin/${it.id}`)}
                    style={{ left: `${m.x + m.w * 0.36}%`, top: `${m.y + m.h * 0.75}%`, zIndex: 66, animationDelay: `${-i * 0.4}s` }}
                  >
                    <Medalla tipo={it.planta.medalla.nombre} dias={it.planta.medalla.dias} tam={Math.max(26, m.w * pxPorPct * 0.4)} />
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
                {esFortuna && fortuna && (
                  <button type="button" className={`fortuna${espantando ? ' chau' : ''}`} aria-label={`Espantar la ${fortuna.pasion.nombre.toLowerCase()} de ${it.nombre}`} onClick={espantar} style={{ left: `${m.x + m.w * 0.25}%`, top: `${centroY}%`, zIndex: 75 }}>
                    <Bicho pasion={fortuna.pasion.id} tam={tamBicho * 1.25} />
                  </button>
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

      {sel ? (
        <Ficha item={sel} prueba={!!prueba} modo={modo} dificil={g.dificil} alCerrar={() => setElegido(null)} alMarcar={marcarHoy} alRegar={() => regar([sel.id])} />
      ) : (
        <p className="mu2" style={{ fontSize: 13, marginTop: 10 }}>
          {items.length ? 'Tocá una planta para ver su hábito. Las medallas al pie de los maceteros abren la página de esa planta.' : 'Todavía no tenés hábitos: creá uno y aparece su semilla en el jardín (o probá el modo prueba).'}
          {habitos.length > MAX_MACETEROS && ` Tenés ${habitos.length} hábitos; el jardín muestra los primeros ${MAX_MACETEROS}.`}
        </p>
      )}

      <div className="card" style={{ marginTop: 14, padding: '12px 16px' }}>
        <div className="cap gold">Tu jardín hoy</div>
        <Resumen items={items} enVivero={jardin.enVivero} medallas={jardin.plantas.filter((p) => p.medalla).length} />
        <details style={{ marginTop: 10, fontSize: 13 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>¿Cómo funciona el jardín?</summary>
          <ul style={{ paddingLeft: 18, margin: '6px 0 0', lineHeight: 1.6 }}>
            <li>
              <b>Crece con los días cumplidos sin marchitarse:</b> semilla · {UMBRALES[1]}–{UMBRALES[2] - 1} días: brote · {UMBRALES[2]}–{UMBRALES[3] - 1}: chica · {UMBRALES[3]}–{UMBRALES[4] - 1}: grande · {UMBRALES[4]}+: florecida.
            </li>
            <li>
              <b>Medallas</b> (no se pierden): {MEDALLAS.map((x) => `${x.nombre} a los ${x.dias} días`).join(' · ')} seguidos sin marchitarse. Aparecen al pie del macetero y abren la página de la planta.
            </li>
            <li>
              <b>Retoños:</b> cada {DIAS_POR_RETONO} días cumplidos sin marchitarse, la planta da un retoño (hasta {MAX_RETONOS}) que ocupa un macetero libre y también crece.
            </li>
            <li>
              <b>Plagas:</b> si pasás 1 o 2 días sin cumplir, las pasiones (ira, miedo, envidia, deseo) rondan la planta (no la achican). A los {DIAS_PARA_MARCHITAR} días se marchita y perdés sus retoños (en difícil, todos los del jardín).
            </li>
            <li>
              <b>La Fortuna:</b> algunos días aparece una plaga en una planta sana, aunque hayas cumplido: lo que no depende de vos. Tocala para espantarla.
            </li>
            <li>
              Cada virtud tiene su planta: {VIRTUDES.map((v) => `${NOMBRE_VIRTUD[v]} → ${PLANTA_DE_VIRTUD[v].nombre}`).join(' · ')}.
            </li>
          </ul>
        </details>
      </div>

      <Prueba activa={!!prueba} total={jardin.plantas.length || MAX_MACETEROS} modo={modo} pasarDias={pasarDias} salir={() => setPrueba(null)} reiniciar={() => setPrueba({})} hora={horaPrueba} setHora={setHoraPrueba} />
    </div>
  );
}

const sumar = (dia: string, n: number) => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

function Resumen({ items, enVivero, medallas }: { items: Item[]; enVivero: number; medallas: number }) {
  const flor = items.filter((l) => l.etapa === 4).length;
  const secas = items.filter((l) => l.etapa === MARCHITA).length;
  const retonos = items.filter((l) => l.retonoDe).length + enVivero;
  return (
    <div style={{ display: 'flex', gap: 18, marginTop: 8, flexWrap: 'wrap' }}>
      {[
        [items.length - items.filter((l) => l.retonoDe).length, 'plantas'],
        [retonos, 'retoños'],
        [medallas, 'medallas'],
        [flor, 'florecidas'],
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

function Ficha({ item, prueba, modo, dificil, alCerrar, alMarcar, alRegar }: { item: Item; prueba: boolean; modo: ModoRiego; dificil: boolean; alCerrar: () => void; alMarcar: (h: Habito) => void; alRegar: () => void }) {
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
        : p.plaga > 0
          ? `Las pasiones rondan tu planta: ${p.a.sinCumplir} ${p.a.sinCumplir === 1 ? 'día' : 'días'} sin cumplir. A los ${DIAS_PARA_MARCHITAR} se marchita${p.retonos ? ` y perdés ${p.retonos === 1 ? 'su retoño' : `sus ${p.retonos} retoños`}` : ''}.`
          : falta === null
            ? `¡Florecida! ${p.retonos < MAX_RETONOS ? `Próximo retoño en ${DIAS_POR_RETONO - (p.ciclo % DIAS_POR_RETONO)} días.` : 'Ya dio todos sus retoños.'}`
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
          {p?.medalla && ` · medalla de ${p.medalla.nombre.toLowerCase()}`}
          {p && p.retonos > 0 && ` · ${p.retonos} ${p.retonos === 1 ? 'retoño' : 'retoños'}`}
        </div>
        <div style={{ fontSize: 13, marginTop: 4 }}>{texto}</div>
        {p?.habito && !prueba && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {p.habito.tipo === 'sino' && (
              <button type="button" className="ghost" onClick={() => alMarcar(p.habito!)}>
                {p.hechoHoy ? 'Desmarcar hoy' : 'Marcar hoy'}
              </button>
            )}
            {p.pideAgua && (
              <button type="button" className="ghost" onClick={alRegar}>
                💧 Regar
              </button>
            )}
            <Link to={`/jardin/${p.id}`} className="ghost">
              Ver su página
            </Link>
          </div>
        )}
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
            Hacé pasar días inventados y mirá cómo crecen, dan medallas y retoños, o se llenan de plagas. No toca tus hábitos reales. Si no tenés hábitos, llena el jardín con plantas de ejemplo.
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
