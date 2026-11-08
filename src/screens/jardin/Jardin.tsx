import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useSesion } from '@/app/sesion';
import { DIAS_PARA_MARCHITAR, ETAPAS_PLANTA, estadoPlanta, estadoSimulado, faltanParaCrecer, MARCHITA, PLANTA_DE_VIRTUD, UMBRALES, type EstadoPlanta } from '@core/jardin';
import { NOMBRE_VIRTUD, VIRTUDES, type Habito, type Virtud } from '@core/habitos';
import { alternarSiNo, registrosDe, useDatos, useHabitosActivos, useHoy } from '@/app/datos';
import { FONDOS, MACETEROS, SPRITES } from './disposicion';

/** Ancho (px) de la tierra de una planta adulta en las hojas de etapas: se usa para escalarla al macetero. */
const UNIDAD = 125;
const MAX = 15;

interface Lugar {
  id: string;
  nombre: string;
  virtud: Virtud;
  estado: EstadoPlanta;
  habito: Habito | null;
}

/** Tinte según la hora: amanecer, día, atardecer, noche. */
function luz(h: number): { color: string; opacidad: number; nombre: string } {
  if (h >= 20 || h < 6) return { color: '#1b2a5a', opacidad: 0.42, nombre: 'noche' };
  if (h < 8) return { color: '#ffb27a', opacidad: 0.16, nombre: 'amanecer' };
  if (h >= 17) return { color: '#ff9a4a', opacidad: 0.18, nombre: 'atardecer' };
  return { color: '#fff', opacidad: 0, nombre: 'día' };
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

/** El Jardín estoico: cada hábito es una planta de su virtud que crece con la racha. */
export function Jardin() {
  const perfil = useSesion((s) => s.perfil);
  if (perfil?.rol !== 'admin') return <Navigate to="/" replace />;
  return <JardinAdmin />;
}

function JardinAdmin() {
  const hoy = useHoy();
  const habitos = useHabitosActivos();
  const registros = useDatos((s) => s.registros);
  const ancho = useAncho();
  const forma = ancho ? 'horizontal' : 'vertical';
  const fondo = FONDOS[forma];
  // Se llenan de adelante (los más grandes y visibles) hacia atrás.
  const maceteros = useMemo(() => [...MACETEROS[forma]].sort((a, b) => b.y - a.y || a.x - b.x), [forma]);
  const [elegido, setElegido] = useState<string | null>(null);
  /** Modo prueba: días inventados por planta (true = cumplido). */
  const [prueba, setPrueba] = useState<Record<string, boolean[]> | null>(null);
  const [hora, setHora] = useState(() => new Date().getHours());
  const [horaPrueba, setHoraPrueba] = useState<number | null>(null);
  useEffect(() => {
    const t = setInterval(() => setHora(new Date().getHours()), 60_000);
    return () => clearInterval(t);
  }, []);

  const ordenados = useMemo(() => [...habitos].sort((a, b) => a.orden - b.orden), [habitos]);
  const lugares = useMemo<Lugar[]>(() => {
    if (prueba && !ordenados.length) {
      // Sin hábitos: plantas de ejemplo para ver el jardín lleno.
      return Array.from({ length: MAX }, (_, i) => {
        const id = `ejemplo-${i}`;
        const virtud = VIRTUDES[i % 4];
        return { id, nombre: `Ejemplo ${i + 1}`, virtud, estado: estadoSimulado(prueba[id] ?? []), habito: null };
      });
    }
    return ordenados.slice(0, MAX).map((h) => ({
      id: h.id,
      nombre: h.nombre,
      virtud: h.virtud,
      estado: prueba ? estadoSimulado(prueba[h.id] ?? []) : estadoPlanta(h, registrosDe(registros, h.id), hoy),
      habito: h,
    }));
  }, [ordenados, registros, hoy, prueba]);

  const pasarDias = (n: number, porcentaje: number) => {
    const base = prueba ?? {};
    const nuevo: Record<string, boolean[]> = {};
    const ids = lugares.length ? lugares.map((l) => l.id) : Array.from({ length: MAX }, (_, i) => `ejemplo-${i}`);
    ids.forEach((id, i) => {
      const previo = base[id] ?? [];
      const r = azar(previo.length * 31 + i * 7 + 3);
      // Cada planta con su propia constancia, alrededor del porcentaje elegido.
      const p = Math.min(100, Math.max(0, porcentaje + (i % 5) * 6 - 12));
      nuevo[id] = [...previo, ...Array.from({ length: n }, () => r() * 100 < p)];
    });
    setPrueba(nuevo);
  };

  const sel = lugares.find((l) => l.id === elegido) ?? null;
  const tinte = luz(horaPrueba ?? hora);
  const relacion = fondo.ancho / fondo.alto;

  return (
    <div className="entra" style={{ maxWidth: 1100, marginInline: 'auto' }}>
      <style>{`
        @keyframes mecer { 0%,100% { transform: rotate(-1.2deg) } 50% { transform: rotate(1.2deg) } }
        @keyframes revivir { from { transform: scale(.6); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        .jardin-planta { position: absolute; transform-origin: 50% 100%; pointer-events: none; animation: revivir .5s ease-out; }
        .jardin-planta img { width: 100%; display: block; transform-origin: 50% 100%; animation: mecer 4.5s ease-in-out infinite; }
        .jardin-planta.seca img { animation: none; filter: saturate(.9); }
        @media (prefers-reduced-motion: reduce) { .jardin-planta img { animation: none } }
      `}</style>
      <div className="cap gold">Jardín estoico · prueba</div>
      <h1 className="titulo">Tu jardín</h1>
      <p className="mu" style={{ marginTop: 4 }}>
        Cada hábito es una planta de su virtud. Crece con tu racha y se marchita si lo dejás.
      </p>

      <div className="card" style={{ marginTop: 14, padding: 0, overflow: 'hidden', border: 'none' }}>
        <div style={{ position: 'relative', width: '100%', aspectRatio: `${fondo.ancho} / ${fondo.alto}`, background: `#d9c7a5 url(${fondo.archivo}) center / cover no-repeat` }} aria-label={`Jardín con ${lugares.length} plantas`} role="img">
          {lugares.map((l, i) => {
            const m = maceteros[i];
            const planta = PLANTA_DE_VIRTUD[l.virtud].id;
            const s = SPRITES[planta][l.estado.etapa];
            const anchoPct = (s.w / UNIDAD) * m.w * 1.15;
            const altoPct = anchoPct * relacion * (s.h / s.w);
            const piso = m.y + m.h * 0.45;
            return (
              <div
                key={l.id}
                className={`jardin-planta${l.estado.etapa === MARCHITA ? ' seca' : ''}`}
                style={{ left: `${m.x - (s.ax / s.w) * anchoPct}%`, top: `${piso - altoPct}%`, width: `${anchoPct}%`, zIndex: 2 + Math.round(m.y) }}
              >
                <img key={`${planta}-${l.estado.etapa}`} src={`/jardin/${planta}-${l.estado.etapa}.webp`} alt="" draggable={false} style={{ animationDelay: `${-(i * 0.7) % 4.5}s` }} />
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
                aria-label={`${l.nombre}: ${PLANTA_DE_VIRTUD[l.virtud].nombre}, ${ETAPAS_PLANTA[l.estado.etapa]}, racha ${l.estado.racha}`}
                aria-pressed={elegido === l.id}
                onClick={() => setElegido(elegido === l.id ? null : l.id)}
                style={{ position: 'absolute', left: `${m.x - m.w * 0.6}%`, top: `${m.y - m.h * 2.6}%`, width: `${m.w * 1.2}%`, height: `${m.h * 3.4}%`, zIndex: 40, borderRadius: 12, outline: elegido === l.id ? '3px solid rgba(201,162,74,.9)' : 'none', background: 'transparent' }}
              />
            );
          })}
          <div style={{ position: 'absolute', inset: 0, background: tinte.color, opacity: tinte.opacidad, mixBlendMode: 'multiply', pointerEvents: 'none', zIndex: 50, transition: 'opacity 1s' }} />
          {prueba && (
            <div style={{ position: 'absolute', left: 10, top: 10, zIndex: 60, background: '#5a3d0c', color: '#ffe7b0', borderRadius: 10, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>MODO PRUEBA</div>
          )}
        </div>
      </div>

      {sel ? (
        <FichaPlanta lugar={sel} hoy={hoy} prueba={!!prueba} alCerrar={() => setElegido(null)} />
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
            <li>
              Cada virtud tiene su planta:{' '}
              {VIRTUDES.map((v) => `${NOMBRE_VIRTUD[v]} → ${PLANTA_DE_VIRTUD[v].nombre}`).join(' · ')}.
            </li>
            <li>La luz cambia con la hora del día.</li>
          </ul>
        </details>
      </div>

      <Prueba activa={!!prueba} pasarDias={pasarDias} salir={() => setPrueba(null)} reiniciar={() => setPrueba({})} hora={horaPrueba} setHora={setHoraPrueba} />
    </div>
  );
}

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

function FichaPlanta({ lugar, hoy, prueba, alCerrar }: { lugar: Lugar; hoy: string; prueba: boolean; alCerrar: () => void }) {
  const { estado, habito } = lugar;
  const planta = PLANTA_DE_VIRTUD[lugar.virtud];
  const falta = faltanParaCrecer(estado.racha, estado.etapa);
  const registro = useDatos((s) => (habito ? s.registros.get(habito.id)?.get(hoy) : undefined));
  return (
    <div className="card" style={{ marginTop: 12, padding: '12px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
      <img src={`/jardin/${planta.id}-${estado.etapa}.webp`} alt="" style={{ width: 64, height: 64, objectFit: 'contain', flex: 'none' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{lugar.nombre}</div>
        <div className="mu2" style={{ fontSize: 12.5 }}>
          {planta.nombre} ({NOMBRE_VIRTUD[lugar.virtud]}) · {ETAPAS_PLANTA[estado.etapa]} · racha {estado.racha}
        </div>
        <div style={{ fontSize: 13, marginTop: 4 }}>
          {estado.etapa === MARCHITA
            ? `Lleva ${estado.sinCumplir} días sin cumplir. Cumplilo hoy y revive.`
            : falta === null
              ? '¡Florecida! Mantené la racha para que siga así.'
              : estado.sinCumplir > 0
                ? `Ojo: ${estado.sinCumplir} ${estado.sinCumplir === 1 ? 'día' : 'días'} sin cumplir. A los ${DIAS_PARA_MARCHITAR} se marchita.`
                : `Te ${falta === 1 ? 'falta 1 día' : `faltan ${falta} días`} para que sea ${ETAPAS_PLANTA[estado.etapa + 1].toLowerCase()}.`}
        </div>
        {habito && !prueba && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {habito.tipo === 'sino' && (
              <button type="button" className="ghost" onClick={() => void alternarSiNo(habito, hoy)}>
                {registro?.hecho ? 'Desmarcar hoy' : 'Marcar hoy'}
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

function Prueba({ activa, pasarDias, salir, reiniciar, hora, setHora }: { activa: boolean; pasarDias: (n: number, p: number) => void; salir: () => void; reiniciar: () => void; hora: number | null; setHora: (h: number | null) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [porcentaje, setPorcentaje] = useState(80);
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
          <label style={{ display: 'block', fontSize: 12.5 }}>
            Cumpliendo más o menos el {porcentaje} % de los días
            <input type="range" min={0} max={100} step={10} value={porcentaje} onChange={(e) => setPorcentaje(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--gold)' }} aria-label="Porcentaje de cumplimiento" />
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" className="ghost" onClick={() => pasarDias(1, porcentaje)}>
              +1 día
            </button>
            <button type="button" className="ghost" onClick={() => pasarDias(7, porcentaje)}>
              +7 días
            </button>
            <button type="button" className="ghost" onClick={() => pasarDias(30, porcentaje)}>
              +30 días
            </button>
            <button type="button" className="ghost" onClick={() => pasarDias(3, 0)}>
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
