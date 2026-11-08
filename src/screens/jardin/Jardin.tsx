import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useSesion } from '@/app/sesion';
import { DIAS_PARA_MARCHITAR, ETAPAS_PLANTA, estadoPlanta, estadoPorDias, estadoSimulado, faltanParaCrecer, MARCHITA, PLANTA_DE_VIRTUD, UMBRALES, type EstadoPlanta } from '@core/jardin';
import { cumplido, esDiaActivo, NOMBRE_VIRTUD, VIRTUDES, type Habito, type Virtud } from '@core/habitos';
import { alternarSiNo, registrosDe, useDatos, useHabitosActivos, useHoy } from '@/app/datos';
import { FONDOS, MACETEROS, SPRITES } from './disposicion';
import { Noche } from './Noche';
import { crearSonido, type SonidoJardin } from './sonido';

const MAX = 15;
/** Ancho máximo de cada planta (su etapa más grande), para que la adulta ocupe el ancho del macetero. */
const ANCHO_MAX: Record<string, number> = Object.fromEntries(Object.entries(SPRITES).map(([k, v]) => [k, Math.max(...v.map((s) => s.w))]));
/** Dónde está la regadera dibujada en cada fondo (en %). */
const REGADERA = { vertical: { x: 12, y: 90, w: 20, h: 10 }, horizontal: { x: 8, y: 82, w: 13, h: 18 } } as const;

type ModoRiego = 'auto' | 'manual';
interface Guardado {
  modo: ModoRiego;
  /** habitId → días regados (clave de día). */
  riegos: Record<string, string[]>;
}

interface Lugar {
  id: string;
  nombre: string;
  virtud: Virtud;
  estado: EstadoPlanta;
  habito: Habito | null;
  /** Riego manual: cumplió hoy y todavía no la regó. */
  pideAgua: boolean;
  /** Cumplió hoy (o, en modo prueba, el último día). */
  hechoHoy: boolean;
}

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

function leerGuardado(uid: string): Guardado {
  try {
    const crudo = localStorage.getItem(`stoica.jardin.${uid}`);
    if (crudo) return { modo: 'auto', riegos: {}, ...(JSON.parse(crudo) as Partial<Guardado>) };
  } catch {
    /* sin almacenamiento */
  }
  return { modo: 'auto', riegos: {} };
}

/** El Jardín estoico: cada hábito es una planta de su virtud que crece con la racha. */
export function Jardin() {
  const perfil = useSesion((s) => s.perfil);
  if (perfil?.rol !== 'admin') return <Navigate to="/" replace />;
  return <JardinAdmin />;
}

function JardinAdmin() {
  const uid = useSesion((s) => s.usuario?.uid ?? '');
  const hoy = useHoy();
  const habitos = useHabitosActivos();
  const registros = useDatos((s) => s.registros);
  const ancho = useAncho();
  const forma = ancho ? 'horizontal' : 'vertical';
  const fondo = FONDOS[forma];
  // Se llenan de adelante (los más grandes y visibles) hacia atrás.
  const maceteros = useMemo(() => [...MACETEROS[forma]].sort((a, b) => b.y - a.y || a.x - b.x), [forma]);
  const [guardado, setGuardado] = useState<Guardado>(() => leerGuardado(uid));
  useEffect(() => {
    try {
      localStorage.setItem(`stoica.jardin.${uid}`, JSON.stringify(guardado));
    } catch {
      /* sin almacenamiento */
    }
  }, [guardado, uid]);
  const modo = guardado.modo;
  const [elegido, setElegido] = useState<string | null>(null);
  /** Modo prueba: días inventados por planta (true = día bueno). */
  const [prueba, setPrueba] = useState<Record<string, boolean[]> | null>(null);
  const [hora, setHora] = useState(() => new Date().getHours());
  const [horaPrueba, setHoraPrueba] = useState<number | null>(null);
  const [regando, setRegando] = useState<Set<string>>(new Set());
  const [conSonido, setConSonido] = useState(false);
  const sonido = useRef<SonidoJardin | null>(null);
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

  const ordenados = useMemo(() => [...habitos].sort((a, b) => a.orden - b.orden), [habitos]);
  const lugares = useMemo<Lugar[]>(() => {
    if (prueba && !ordenados.length) {
      // Sin hábitos: plantas de ejemplo para ver el jardín lleno.
      return Array.from({ length: MAX }, (_, i) => {
        const id = `ejemplo-${i}`;
        const dias = prueba[id] ?? [];
        return { id, nombre: `Ejemplo ${i + 1}`, virtud: VIRTUDES[i % 4], estado: estadoSimulado(dias), habito: null, pideAgua: false, hechoHoy: !!dias[dias.length - 1] };
      });
    }
    return ordenados.slice(0, MAX).map((h) => {
      const regs = registrosDe(registros, h.id);
      const hechoHoy = esDiaActivo(h, hoy) && cumplido(h, regs.get(hoy));
      const regados = new Set(guardado.riegos[h.id] ?? []);
      let estado: EstadoPlanta;
      if (prueba) estado = estadoSimulado(prueba[h.id] ?? []);
      else if (modo === 'manual') estado = estadoPorDias(h, hoy, (d) => cumplido(h, regs.get(d)) && regados.has(d));
      else estado = estadoPlanta(h, regs, hoy);
      return { id: h.id, nombre: h.nombre, virtud: h.virtud, estado, habito: h, hechoHoy, pideAgua: !prueba && modo === 'manual' && hechoHoy && !regados.has(hoy) };
    });
  }, [ordenados, registros, hoy, prueba, modo, guardado.riegos]);

  // Nota de lira cuando alguna planta sube de etapa
  const etapasAntes = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    let crecio = false;
    for (const l of lugares) {
      const a = etapasAntes.current.get(l.id);
      if (a !== undefined && l.estado.etapa !== MARCHITA && l.estado.etapa > a) crecio = true;
      etapasAntes.current.set(l.id, l.estado.etapa);
    }
    if (crecio) sonido.current?.lira();
  }, [lugares]);

  const animarRiego = useCallback((ids: string[]) => {
    if (!ids.length) return;
    sonido.current?.regar();
    setRegando(new Set(ids));
    window.setTimeout(() => setRegando(new Set()), 1400);
  }, []);

  /** Riego manual: regar las plantas cuyo hábito ya está cumplido hoy. */
  const regar = (ids: string[]) => {
    const validos = ids.filter((id) => lugares.find((l) => l.id === id)?.pideAgua);
    if (!validos.length) return;
    setGuardado((g) => {
      const riegos = { ...g.riegos };
      // Se guardan los últimos 150 días de riego.
      for (const id of validos) riegos[id] = [...(riegos[id] ?? []).filter((d) => d >= sumar(hoy, -150) && d !== hoy), hoy];
      return { ...g, riegos };
    });
    animarRiego(validos);
  };

  const marcarHoy = async (h: Habito) => {
    const antes = lugares.find((l) => l.id === h.id)?.hechoHoy;
    await alternarSiNo(h, hoy);
    // Automático: cumplir el hábito ya riega la planta.
    if (!antes && modo === 'auto') animarRiego([h.id]);
  };

  const pasarDias = (n: number, cumplidosPorDia: number, regaste: boolean) => {
    const base = prueba ?? {};
    const ids = lugares.length ? lugares.map((l) => l.id) : Array.from({ length: MAX }, (_, i) => `ejemplo-${i}`);
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

  const sel = lugares.find((l) => l.id === elegido) ?? null;
  const t = tinte(horaVista);
  const relacion = fondo.ancho / fondo.alto;
  const sedientas = lugares.filter((l) => l.pideAgua).map((l) => l.id);
  const rg = REGADERA[forma];

  return (
    <div className="entra" style={{ maxWidth: 1100, marginInline: 'auto' }}>
      <style>{`
        @keyframes mecer { 0%,100% { transform: rotate(-1.2deg) } 50% { transform: rotate(1.2deg) } }
        @keyframes revivir { from { transform: scale(.6); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes saltito { 0%,100% { transform: scale(1) } 40% { transform: scale(1.06, .95) } 70% { transform: scale(.98, 1.03) } }
        @keyframes latir { 0%,100% { transform: scale(1); opacity: .9 } 50% { transform: scale(1.15); opacity: 1 } }
        .jardin-planta { position: absolute; transform-origin: 50% 100%; pointer-events: none; }
        .jardin-planta img { width: 100%; display: block; transform-origin: 50% 100%; animation: revivir .5s ease-out, mecer 4.5s ease-in-out .5s infinite; transition: filter .4s; }
        .jardin-planta.seca img { animation: revivir .5s ease-out; }
        .jardin-planta.elegida img { filter: drop-shadow(0 0 6px rgba(255,214,120,.95)) drop-shadow(0 0 14px rgba(255,190,80,.6)); }
        .jardin-planta.regando img { filter: drop-shadow(0 0 8px rgba(150,215,255,.95)) brightness(1.08); }
        .jardin-nombre { position: absolute; transform: translate(-50%, -100%); white-space: nowrap; background: rgba(30,24,16,.78); color: #f3e6c8; font-size: 11.5px; font-weight: 700; padding: 3px 9px; border-radius: 10px; pointer-events: none; }
        .jardin-planta.regando { animation: saltito .9s ease-out; }
        .pide-agua { position: absolute; transform: translate(-50%, -100%); font-size: 15px; animation: latir 1.4s ease-in-out infinite; filter: drop-shadow(0 1px 2px rgba(0,0,0,.4)); }
        @media (prefers-reduced-motion: reduce) { .jardin-planta img, .pide-agua { animation: none } }
      `}</style>
      <div className="cap gold">Jardín estoico · prueba</div>
      <h1 className="titulo">Tu jardín</h1>
      <p className="mu" style={{ marginTop: 4 }}>
        Cada hábito es una planta de su virtud. Crece con tu racha y se marchita si lo dejás.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
        <div className="seg3" role="radiogroup" aria-label="Riego" style={{ flex: '1 1 280px', maxWidth: 420 }}>
          {(
            [
              ['auto', 'Riego automático'],
              ['manual', 'Riego manual'],
            ] as const
          ).map(([v, txt]) => (
            <button key={v} type="button" role="radio" aria-checked={modo === v} className={modo === v ? 'on' : ''} onClick={() => setGuardado((g) => ({ ...g, modo: v }))}>
              {txt}
            </button>
          ))}
        </div>
        <button type="button" className="ghost" aria-pressed={conSonido} onClick={() => setConSonido(!conSonido)}>
          {conSonido ? '🔊 Sonido activado' : '🔈 Activar sonido'}
        </button>
      </div>
      <p className="mu2" style={{ fontSize: 12.5, marginTop: 6 }}>
        {modo === 'auto'
          ? 'Automático: cumplir el hábito ya riega su planta.'
          : 'Manual: además de cumplir el hábito, tenés que entrar al jardín y regar su planta ese mismo día. Si no la regás, ese día no cuenta.'}
      </p>

      <div className="card" style={{ marginTop: 10, padding: 0, overflow: 'hidden', border: 'none' }}>
        <div style={{ position: 'relative', width: '100%', aspectRatio: `${fondo.ancho} / ${fondo.alto}`, background: `#d9c7a5 url(${fondo.archivo}) center / cover no-repeat` }} aria-label={`Jardín con ${lugares.length} plantas`} role="img">
          {lugares.map((l, i) => {
            const m = maceteros[i];
            const planta = PLANTA_DE_VIRTUD[l.virtud].id;
            const s = SPRITES[planta][l.estado.etapa];
            const anchoPct = (s.w / ANCHO_MAX[planta]) * m.w * 1.1;
            const altoPct = anchoPct * relacion * (s.h / s.w);
            const piso = m.y + m.h * 0.45;
            const riega = regando.has(l.id);
            return (
              <div key={l.id}>
                <div className={`jardin-planta${l.estado.etapa === MARCHITA ? ' seca' : ''}${riega ? ' regando' : ''}${elegido === l.id ? ' elegida' : ''}`} style={{ left: `${m.x - (s.ax / s.w) * anchoPct}%`, top: `${piso - altoPct}%`, width: `${anchoPct}%`, zIndex: 2 + Math.round(m.y) }}>
                  <img key={`${planta}-${l.estado.etapa}`} src={`/jardin/${planta}-${l.estado.etapa}.webp`} alt="" draggable={false} style={{ animationDelay: `${-(i * 0.7) % 4.5}s` }} />
                </div>
                {elegido === l.id && (
                  <span className="jardin-nombre" style={{ left: `${m.x}%`, top: `${piso - altoPct - 0.8}%`, zIndex: 62 }}>
                    {l.nombre}
                  </span>
                )}
                {l.pideAgua && elegido !== l.id && (
                  <span className="pide-agua" style={{ left: `${m.x}%`, top: `${piso - altoPct - 0.5}%`, zIndex: 61 }} aria-hidden>
                    💧
                  </span>
                )}
              </div>
            );
          })}
          {/* Zonas tocables sobre cada macetero */}
          {lugares.map((l, i) => {
            const m = maceteros[i];
            return (
              <button
                key={`b-${l.id}`}
                type="button"
                aria-label={`${l.nombre}: ${PLANTA_DE_VIRTUD[l.virtud].nombre}, ${ETAPAS_PLANTA[l.estado.etapa]}, racha ${l.estado.racha}${l.pideAgua ? ', pide agua' : ''}`}
                aria-pressed={elegido === l.id}
                onClick={() => setElegido(elegido === l.id ? null : l.id)}
                style={{ position: 'absolute', left: `${m.x - m.w * 0.6}%`, top: `${m.y - m.h * 2.6}%`, width: `${m.w * 1.2}%`, height: `${m.h * 3.4}%`, zIndex: 70, borderRadius: 12, background: 'transparent', WebkitTapHighlightColor: 'transparent', outline: 'none' }}
              />
            );
          })}
          {/* La regadera del dibujo: en riego manual, riega todas las que piden agua */}
          {modo === 'manual' && !prueba && (
            <button
              type="button"
              aria-label={sedientas.length ? `Regar ${sedientas.length} plantas` : 'Regadera: no hay plantas para regar'}
              onClick={() => regar(sedientas)}
              style={{ position: 'absolute', left: `${rg.x - rg.w / 2}%`, top: `${rg.y - rg.h / 2}%`, width: `${rg.w}%`, height: `${rg.h}%`, zIndex: 72, borderRadius: 16, background: sedientas.length ? 'radial-gradient(circle, rgba(120,200,255,.35), rgba(120,200,255,0) 70%)' : 'transparent', outline: sedientas.length ? '2px dashed rgba(90,170,230,.8)' : 'none' }}
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
        <FichaPlanta lugar={sel} prueba={!!prueba} modo={modo} alCerrar={() => setElegido(null)} alMarcar={marcarHoy} alRegar={() => regar([sel.id])} />
      ) : (
        <p className="mu2" style={{ fontSize: 13, marginTop: 10 }}>
          {lugares.length ? 'Tocá una planta para ver su hábito.' : 'Todavía no tenés hábitos: creá uno y aparece su semilla en el jardín (o probá el modo prueba).'}
          {ordenados.length > MAX && ` Tenés ${ordenados.length} hábitos; el jardín muestra los primeros ${MAX}.`}
        </p>
      )}

      <div className="card" style={{ marginTop: 14, padding: '12px 16px' }}>
        <div className="cap gold">Tu jardín hoy</div>
        <Resumen lugares={lugares} />
        <details style={{ marginTop: 10, fontSize: 13 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>¿Cómo crecen las plantas?</summary>
          <ul style={{ paddingLeft: 18, margin: '6px 0 0', lineHeight: 1.6 }}>
            <li>
              Racha 0: semilla · {UMBRALES[1]}–{UMBRALES[2] - 1} días: brote · {UMBRALES[2]}–{UMBRALES[3] - 1}: planta chica · {UMBRALES[3]}–{UMBRALES[4] - 1}: planta grande · {UMBRALES[4]} o más: florecida.
            </li>
            <li>Si pasás {DIAS_PARA_MARCHITAR} días seguidos sin cumplir, se marchita. Cumplilo de nuevo y revive como brote.</li>
            <li>Riego automático: cumplir el hábito riega la planta. Riego manual: además tenés que regarla ese día (💧 te avisa cuáles).</li>
            <li>
              Cada virtud tiene su planta: {VIRTUDES.map((v) => `${NOMBRE_VIRTUD[v]} → ${PLANTA_DE_VIRTUD[v].nombre}`).join(' · ')}.
            </li>
            <li>La luz cambia con la hora: de noche se prenden los braseros, el templo y la fuente, y salen las luciérnagas.</li>
          </ul>
        </details>
      </div>

      <Prueba activa={!!prueba} total={lugares.length || MAX} modo={modo} pasarDias={pasarDias} salir={() => setPrueba(null)} reiniciar={() => setPrueba({})} hora={horaPrueba} setHora={setHoraPrueba} />
    </div>
  );
}

const sumar = (dia: string, n: number) => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

function Resumen({ lugares }: { lugares: Lugar[] }) {
  const cuenta = (e: number) => lugares.filter((l) => l.estado.etapa === e).length;
  const flor = cuenta(4);
  const secas = cuenta(MARCHITA);
  return (
    <div style={{ display: 'flex', gap: 18, marginTop: 8, flexWrap: 'wrap' }}>
      {[
        [lugares.length, 'plantas'],
        [flor, 'florecidas'],
        [lugares.length - flor - secas, 'creciendo'],
        [secas, 'marchitas'],
      ].map(([n, t]) => (
        <div key={t as string}>
          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{n}</div>
          <div className="mu2" style={{ fontSize: 11 }}>
            {t}
          </div>
        </div>
      ))}
    </div>
  );
}

function FichaPlanta({ lugar, prueba, modo, alCerrar, alMarcar, alRegar }: { lugar: Lugar; prueba: boolean; modo: ModoRiego; alCerrar: () => void; alMarcar: (h: Habito) => void; alRegar: () => void }) {
  const { estado, habito } = lugar;
  const planta = PLANTA_DE_VIRTUD[lugar.virtud];
  const falta = faltanParaCrecer(estado.racha, estado.etapa);
  return (
    <div className="card" style={{ marginTop: 12, padding: '12px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
      <img src={`/jardin/${planta.id}-${estado.etapa}.webp`} alt="" style={{ width: 64, height: 64, objectFit: 'contain', flex: 'none' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{lugar.nombre}</div>
        <div className="mu2" style={{ fontSize: 12.5 }}>
          {planta.nombre} ({NOMBRE_VIRTUD[lugar.virtud]}) · {ETAPAS_PLANTA[estado.etapa]} · racha {estado.racha}
        </div>
        <div style={{ fontSize: 13, marginTop: 4 }}>
          {lugar.pideAgua
            ? 'Cumpliste el hábito hoy: regala para que el día cuente.'
            : estado.etapa === MARCHITA
              ? `Lleva ${estado.sinCumplir} días sin ${modo === 'manual' ? 'cumplir y regar' : 'cumplir'}. Hacelo hoy y revive.`
              : falta === null
                ? '¡Florecida! Mantené la racha para que siga así.'
                : estado.sinCumplir > 0
                  ? `Ojo: ${estado.sinCumplir} ${estado.sinCumplir === 1 ? 'día' : 'días'} sin ${modo === 'manual' ? 'regar' : 'cumplir'}. A los ${DIAS_PARA_MARCHITAR} se marchita.`
                  : `Te ${falta === 1 ? 'falta 1 día' : `faltan ${falta} días`} para que sea ${ETAPAS_PLANTA[estado.etapa + 1].toLowerCase()}.`}
        </div>
        {habito && !prueba && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {habito.tipo === 'sino' && (
              <button type="button" className="ghost" onClick={() => alMarcar(habito)}>
                {lugar.hechoHoy ? 'Desmarcar hoy' : 'Marcar hoy'}
              </button>
            )}
            {lugar.pideAgua && (
              <button type="button" className="ghost" onClick={alRegar}>
                💧 Regar
              </button>
            )}
            <Link to={`/habitos/${habito.id}`} className="ghost">
              Ver hábito
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
            Hacé pasar días inventados y mirá cómo crece o se marchita cada planta. No toca tus hábitos reales. Si no tenés hábitos, llena el jardín con plantas de ejemplo.
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
