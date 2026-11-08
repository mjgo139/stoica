import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sumarDias } from '@core/fechas';
import { CAMINOS, calcularAvance, DIAS_DE_GRACIA, DIAS_POR_ETAPA, diasDesde, simularDias, type Camino, type ConfigProgreso, type ResultadoDia } from '@core/progreso';
import { useSesion } from '@/app/sesion';
import { useDatos, useHabitosActivos, useHoy } from '@/app/datos';
import { crearViva, ETAPAS_MUSCULO, ETAPAS_PESO, FORMA_INICIAL, nombreDe, PESO_ATLETICO, type EscenaViva, type Forma } from './viva';

const claveForma = (uid: string) => `stoica.viva.${uid}`;
const claveProgreso = (uid: string) => `stoica.progreso.${uid}`;

function leerJson<T>(k: string, defecto: T): T {
  try {
    const crudo = localStorage.getItem(k);
    return crudo ? ({ ...defecto, ...(JSON.parse(crudo) as Partial<T>) } as T) : defecto;
  } catch {
    return defecto;
  }
}
function guardarJson(k: string, v: unknown) {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* sin almacenamiento */
  }
}

/** Posición en un camino → forma de la estatua. */
function formaDe(camino: Camino, posicion: number): Forma {
  return camino === 'cuerpo' ? { peso: posicion / (ETAPAS_PESO.length - 1), musculo: 0 } : { peso: PESO_ATLETICO, musculo: posicion / (ETAPAS_MUSCULO.length - 1) };
}

/** El Espejo · Estatua viva: tus estatuas de Meshy unidas. "Mi progreso" la mueve con tus hábitos; "Explorar" a mano. */
export function EspejoViva() {
  const uid = useSesion((s) => s.usuario?.uid ?? '');
  const lienzo = useRef<HTMLCanvasElement>(null);
  const escena = useRef<EscenaViva | null>(null);
  const [modo, setModo] = useState<'progreso' | 'explorar'>('progreso');
  const [manual, setManual] = useState<Forma>(() => leerJson(claveForma(uid), FORMA_INICIAL));
  /** Forma que manda el panel de progreso (o la animación). */
  const [deProgreso, setDeProgreso] = useState<Forma | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [vista, setVista] = useState<'cuerpo' | 'cara'>('cuerpo');
  const f = modo === 'progreso' && deProgreso ? deProgreso : manual;

  useEffect(() => {
    if (!lienzo.current) return;
    let vivo = true;
    crearViva(lienzo.current, f)
      .then((s) => {
        if (!vivo) return s.destruir();
        escena.current = s;
        setCargando(false);
      })
      .catch(() => vivo && setError('No se pudo mostrar la estatua (hace falta 3D/WebGL y conexión la primera vez).'));
    return () => {
      vivo = false;
      escena.current?.destruir();
      escena.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void escena.current?.actualizar(f);
  }, [f, cargando]);
  useEffect(() => guardarJson(claveForma(uid), manual), [manual, uid]);
  useEffect(() => {
    escena.current?.enfocar(vista);
  }, [vista, cargando]);

  const nombre = f.musculo > 0.001 ? nombreDe(ETAPAS_MUSCULO, f.musculo) : nombreDe(ETAPAS_PESO, f.peso);

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: '1 1 340px', minWidth: 0, overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #3a352f 0%, #1d1a17 80%)', border: 'none' }}>
          {error ? (
            <p style={{ padding: 24, color: '#e9e2d6' }}>{error}</p>
          ) : (
            <div style={{ position: 'relative' }}>
              <canvas ref={lienzo} style={{ width: '100%', height: 'min(66vh, 580px)', display: 'block', touchAction: 'none' }} aria-label={`Estatua viva: ${nombre}`} />
              {cargando && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 14, color: '#d8cfc2' }}>Trayendo tu estatua…</div>}
              <div className="cap" style={{ position: 'absolute', left: 16, top: 14, color: '#c9a24a' }}>
                {nombre}
              </div>
              <div style={{ position: 'absolute', right: 14, top: 14, fontSize: 11.5, color: '#bdb3a5' }}>Arrastrá para girar · pellizcá para acercar</div>
              <div className="seg3" role="radiogroup" aria-label="Vista" style={{ position: 'absolute', left: 12, right: 12, bottom: 12, maxWidth: 260, marginInline: 'auto', background: 'var(--sf)' }}>
                {(
                  [
                    ['cuerpo', 'Cuerpo'],
                    ['cara', 'Cara'],
                  ] as const
                ).map(([v, t]) => (
                  <button key={v} type="button" role="radio" aria-checked={vista === v} className={vista === v ? 'on' : ''} onClick={() => setVista(v)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="card" style={{ flex: '1 1 300px', minWidth: 0, padding: '14px 16px 18px' }}>
          <div className="seg3" role="radiogroup" aria-label="Modo de la estatua">
            {(
              [
                ['progreso', 'Mi progreso'],
                ['explorar', 'Explorar etapas'],
              ] as const
            ).map(([v, t]) => (
              <button key={v} type="button" role="radio" aria-checked={modo === v} className={modo === v ? 'on' : ''} onClick={() => setModo(v)}>
                {t}
              </button>
            ))}
          </div>
          {modo === 'progreso' ? <PanelProgreso uid={uid} alMover={setDeProgreso} /> : <PanelExplorar f={manual} setF={setManual} />}
        </div>
      </div>
    </div>
  );
}

function Deslizante({ titulo, valor, texto, extremos, alCambiar }: { titulo: string; valor: number; texto: string; extremos: [string, string]; alCambiar: (v: number) => void }) {
  return (
    <label style={{ display: 'block', marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="cap gold">{titulo}</span>
        <span className="mu2" style={{ fontSize: 12, fontWeight: 700 }}>
          {texto}
        </span>
      </div>
      <input type="range" min={0} max={100} value={Math.round(valor * 100)} onChange={(ev) => alCambiar(Number(ev.target.value) / 100)} style={{ width: '100%', marginTop: 6, accentColor: 'var(--gold)' }} aria-label={titulo} />
      <div className="mu2" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
        <span>{extremos[0]}</span>
        <span>{extremos[1]}</span>
      </div>
    </label>
  );
}

function PanelExplorar({ f, setF }: { f: Forma; setF: (f: Forma) => void }) {
  return (
    <>
      <Deslizante titulo="Peso" valor={f.peso} texto={f.musculo > 0.001 ? 'Atlético' : nombreDe(ETAPAS_PESO, f.peso)} extremos={['Delgado', 'Muy obeso']} alCambiar={(v) => setF({ peso: v, musculo: 0 })} />
      <Deslizante titulo="Músculo" valor={f.musculo} texto={nombreDe(ETAPAS_MUSCULO, f.musculo)} extremos={['Atlético', 'Fisicoculturista']} alCambiar={(v) => setF({ peso: PESO_ATLETICO, musculo: v })} />
      <p className="mu2" style={{ fontSize: 11.5, marginTop: 14 }}>
        Mirá todas las etapas a mano. En cada etapa ves la estatua real y entre etapas se transforma de una a otra. El músculo sale desde Atlético.
      </p>
    </>
  );
}

const COLOR_DIA: Record<ResultadoDia, string> = { cumplido: 'var(--gold)', fallado: '#b5473a', libre: 'var(--ln3)', pendiente: 'transparent' };
const TEXTO_DIA: Record<ResultadoDia, string> = { cumplido: 'cumplido', fallado: 'sin cumplir', libre: 'libre', pendiente: 'hoy, pendiente' };

function PanelProgreso({ uid, alMover }: { uid: string; alMover: (f: Forma | null) => void }) {
  const hoy = useHoy();
  const habitos = useHabitosActivos();
  const registros = useDatos((s) => s.registros);
  const [config, setConfig] = useState<ConfigProgreso | null>(() => leerJson<ConfigProgreso | null>(claveProgreso(uid), null));
  const [editando, setEditando] = useState(!config);
  /** Modo de prueba: días inventados en lugar de los reales. */
  const [prueba, setPrueba] = useState<ResultadoDia[] | null>(null);
  const [animando, setAnimando] = useState(false);

  useEffect(() => guardarJson(claveProgreso(uid), config), [config, uid]);

  const elegidos = useMemo(() => habitos.filter((h) => config?.habitos.includes(h.id)), [habitos, config]);
  const dias = useMemo<ResultadoDia[]>(() => {
    if (!config) return [];
    if (prueba) return prueba;
    return diasDesde(elegidos, registros, config.inicio, hoy);
  }, [config, prueba, elegidos, registros, hoy]);
  const avance = useMemo(() => (config ? calcularAvance(config, dias) : null), [config, dias]);

  // La estatua muestra tu posición actual (salvo mientras se configura o se anima).
  useEffect(() => {
    if (editando || animando) return;
    alMover(config && avance ? formaDe(config.camino, avance.posicion) : null);
  }, [config, avance, editando, animando, alMover]);
  useEffect(() => () => alMover(null), [alMover]);
  const previsualizar = useCallback((c: Camino, pos: number) => alMover(formaDe(c, pos)), [alMover]);

  /** Película: de tu etapa inicial hasta donde estás hoy, en 3 segundos. */
  const verEvolucion = () => {
    if (!config || !avance) return;
    setAnimando(true);
    const t0 = performance.now();
    const paso = () => {
      const t = Math.min(1, (performance.now() - t0) / 3000);
      const e = t * t * (3 - 2 * t);
      alMover(formaDe(config.camino, config.desde + (avance.posicion - config.desde) * e));
      if (t < 1) requestAnimationFrame(paso);
      else setAnimando(false);
    };
    requestAnimationFrame(paso);
  };

  if (editando || !config) {
    return (
      <Configurar
        inicial={config}
        hoy={hoy}
        habitos={habitos}
        alPrevisualizar={previsualizar}
        alGuardar={(c) => {
          setConfig(c);
          setPrueba(null);
          setEditando(false);
        }}
        alCancelar={config ? () => setEditando(false) : undefined}
      />
    );
  }

  const camino = CAMINOS[config.camino];
  const etapa = (i: number | null) => (i === null ? '' : camino.etapas[i].nombre);
  const ultimos = dias.slice(-14);
  const riesgo = avance && avance.sinCumplir >= 1 && avance.puntos > 0;

  return (
    <div style={{ marginTop: 14 }}>
      {prueba && (
        <div style={{ background: '#5a3d0c', color: '#ffe7b0', borderRadius: 10, padding: '6px 10px', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
          MODO PRUEBA · días inventados, no tus hábitos reales
        </div>
      )}
      <div className="cap gold">{camino.nombre}</div>
      <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>
        {avance?.llegaste ? `¡Llegaste a ${etapa(config.meta)}!` : `${etapa(avance?.etapa ?? config.desde)} → ${etapa(avance?.siguiente ?? null)}`}
      </div>
      {avance && !avance.llegaste && (
        <>
          <div style={{ height: 10, borderRadius: 6, background: 'var(--ln)', marginTop: 10, overflow: 'hidden' }} role="progressbar" aria-label="Avance a la próxima etapa" aria-valuenow={avance.enEtapa} aria-valuemax={DIAS_POR_ETAPA}>
            <div style={{ width: `${(avance.enEtapa / DIAS_POR_ETAPA) * 100}%`, height: '100%', background: 'var(--gold)', transition: 'width .4s' }} />
          </div>
          <p className="mu2" style={{ fontSize: 12.5, marginTop: 6 }}>
            {avance.enEtapa} de {DIAS_POR_ETAPA} días cumplidos · te {avance.faltanEtapa === 1 ? 'falta 1 día' : `faltan ${avance.faltanEtapa} días`} para <b>{etapa(avance.siguiente)}</b> y {avance.faltanMeta} para tu meta (<b>{etapa(config.meta)}</b>).
          </p>
        </>
      )}

      <div style={{ display: 'flex', gap: 14, marginTop: 12 }}>
        <Dato n={avance?.racha ?? 0} t="días de racha" />
        <Dato n={avance?.cumplidos ?? 0} t="días cumplidos" />
        <Dato n={avance?.puntos ?? 0} t="puntos de constancia" />
      </div>

      {riesgo && (
        <p style={{ fontSize: 12.5, marginTop: 10, color: avance.sinCumplir > DIAS_DE_GRACIA ? '#d0644f' : 'var(--tx2)' }}>
          {avance.sinCumplir > DIAS_DE_GRACIA
            ? `Llevás ${avance.sinCumplir} días sin cumplir: tu estatua está retrocediendo. Cumplí hoy para frenarlo.`
            : `Llevás ${avance.sinCumplir} ${avance.sinCumplir === 1 ? 'día' : 'días'} sin cumplir. Si llegás a ${DIAS_DE_GRACIA + 1}, tu estatua empieza a retroceder.`}
        </p>
      )}

      <div className="cap" style={{ marginTop: 14 }}>
        Últimos días
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }} aria-label="Últimos días">
        {ultimos.length === 0 && <span className="mu2" style={{ fontSize: 12 }}>Empezaste hoy.</span>}
        {ultimos.map((d, i) => (
          <span key={i} title={TEXTO_DIA[d]} aria-label={TEXTO_DIA[d]} style={{ width: 16, height: 16, borderRadius: 5, background: COLOR_DIA[d], border: d === 'pendiente' ? '2px dashed var(--gold)' : 'none' }} />
        ))}
      </div>

      <div className="cap" style={{ marginTop: 14 }}>
        Tus hábitos para esta meta
      </div>
      <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
        {elegidos.map((h) => (
          <li key={h.id}>{h.nombre}</li>
        ))}
        {elegidos.length === 0 && <li className="mu2">Los hábitos elegidos ya no existen: tocá Cambiar.</li>}
      </ul>

      <details style={{ marginTop: 12, fontSize: 12.5 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>¿Cómo avanza mi estatua?</summary>
        <ol style={{ paddingLeft: 18, margin: '6px 0 0', lineHeight: 1.5 }}>
          <li>Un día cuenta si hiciste <b>todos</b> los hábitos elegidos que tocaban ese día.</li>
          <li>Cada día cumplido suma 1 punto. Cada {DIAS_POR_ETAPA} puntos tu estatua sube una etapa hacia tu meta (se transforma de a poco).</li>
          <li>Fallar {DIAS_DE_GRACIA} días seguidos no te hace retroceder. Desde el {DIAS_DE_GRACIA + 1}.º, cada día sin cumplir resta 1 punto.</li>
          <li>Nunca bajás de la etapa en la que empezaste.</li>
        </ol>
      </details>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        <button type="button" className="btn" style={{ width: 'auto', flex: '1 1 180px' }} onClick={verEvolucion} disabled={animando}>
          ▶ Ver mi evolución
        </button>
        <button type="button" className="ghost" onClick={() => setEditando(true)}>
          Cambiar meta o hábitos
        </button>
      </div>

      <Prueba prueba={prueba} setPrueba={setPrueba} />
    </div>
  );
}

function Dato({ n, t }: { n: number; t: string }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{n}</div>
      <div className="mu2" style={{ fontSize: 11 }}>
        {t}
      </div>
    </div>
  );
}

/** Modo de prueba (solo admin): agrega días inventados para ver cómo reacciona la estatua. */
function Prueba({ prueba, setPrueba }: { prueba: ResultadoDia[] | null; setPrueba: (d: ResultadoDia[] | null) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [porcentaje, setPorcentaje] = useState(80);
  const sumar = (d: ResultadoDia[]) => setPrueba([...(prueba ?? []), ...d]);
  const veces = (d: ResultadoDia, n: number) => Array.from({ length: n }, () => d);
  return (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--ln)', paddingTop: 10 }}>
      <button type="button" className="mu2" style={{ fontSize: 12.5, fontWeight: 700 }} onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
        🧪 Modo prueba {abierto ? '▲' : '▼'}
      </button>
      {abierto && (
        <div style={{ marginTop: 8 }}>
          <p className="mu2" style={{ fontSize: 12, margin: '0 0 8px' }}>
            Inventá días para ver cómo reacciona la estatua. No toca tus hábitos reales.
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" className="ghost" onClick={() => sumar(['cumplido'])}>
              +1 día cumplido
            </button>
            <button type="button" className="ghost" onClick={() => sumar(veces('cumplido', 10))}>
              +10 cumplidos
            </button>
            <button type="button" className="ghost" onClick={() => sumar(['fallado'])}>
              +1 día sin cumplir
            </button>
          </div>
          <label style={{ display: 'block', marginTop: 10, fontSize: 12.5 }}>
            Simular 30 días cumpliendo el {porcentaje} %
            <input type="range" min={0} max={100} step={10} value={porcentaje} onChange={(e) => setPorcentaje(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--gold)' }} aria-label="Porcentaje simulado" />
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" className="ghost" onClick={() => sumar(simularDias(30, porcentaje, (prueba?.length ?? 0) + 7))}>
              Simular 30 días
            </button>
            <button type="button" className="ghost" onClick={() => setPrueba([])}>
              Empezar de cero
            </button>
            {prueba && (
              <button type="button" className="ghost" onClick={() => setPrueba(null)}>
                Volver a mis días reales
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Configurar({
  inicial,
  hoy,
  habitos,
  alPrevisualizar,
  alGuardar,
  alCancelar,
}: {
  inicial: ConfigProgreso | null;
  hoy: string;
  habitos: Array<{ id: string; nombre: string }>;
  alPrevisualizar: (c: Camino, posicion: number) => void;
  alGuardar: (c: ConfigProgreso) => void;
  alCancelar?: () => void;
}) {
  const [camino, setCamino] = useState<Camino>(inicial?.camino ?? 'cuerpo');
  const [desde, setDesde] = useState<number>(inicial?.desde ?? 4);
  const [elegidos, setElegidos] = useState<string[]>(inicial?.habitos ?? []);
  const [contar, setContar] = useState<0 | 30 | 90>(0);
  const meta = CAMINOS[camino].meta;
  const opciones = CAMINOS[camino].etapas.map((e, i) => ({ ...e, i })).filter((e) => e.i !== meta);

  useEffect(() => {
    alPrevisualizar(camino, desde);
  }, [camino, desde, alPrevisualizar]);

  const elegirCamino = (c: Camino) => {
    setCamino(c);
    setDesde(c === 'cuerpo' ? 4 : 0);
  };

  return (
    <div style={{ marginTop: 14 }}>
      <div className="cap gold">1 · ¿Qué querés lograr?</div>
      <div className="seg3" role="radiogroup" aria-label="Camino" style={{ marginTop: 6 }}>
        {(Object.keys(CAMINOS) as Camino[]).map((c) => (
          <button key={c} type="button" role="radio" aria-checked={camino === c} className={camino === c ? 'on' : ''} onClick={() => elegirCamino(c)}>
            {CAMINOS[c].nombre}
          </button>
        ))}
      </div>
      <p className="mu2" style={{ fontSize: 12, marginTop: 6 }}>
        Meta: <b>{CAMINOS[camino].etapas[meta].nombre}</b>.
      </p>

      <div className="cap gold" style={{ marginTop: 12 }}>
        2 · ¿Dónde estás hoy?
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }} role="radiogroup" aria-label="Etapa de hoy">
        {opciones.map((e) => (
          <button key={e.id} type="button" role="radio" aria-checked={desde === e.i} className={desde === e.i ? 'pill ok' : 'pill'} onClick={() => setDesde(e.i)}>
            {e.nombre}
          </button>
        ))}
      </div>
      <p className="mu2" style={{ fontSize: 12, marginTop: 6 }}>
        Elegí la estatua que más se parece a vos hoy (la ves a la izquierda). Es solo un punto de partida.
      </p>

      <div className="cap gold" style={{ marginTop: 12 }}>
        3 · ¿Qué hábitos te acercan a tu meta?
      </div>
      {habitos.length === 0 ? (
        <p className="mu2" style={{ fontSize: 12.5 }}>
          Todavía no tenés hábitos. Creá alguno primero (por ejemplo: caminar, comer bien, entrenar).
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
          {habitos.map((h) => (
            <label key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
              <input type="checkbox" checked={elegidos.includes(h.id)} onChange={(e) => setElegidos((a) => (e.target.checked ? [...a, h.id] : a.filter((x) => x !== h.id)))} style={{ accentColor: 'var(--gold)' }} />
              {h.nombre}
            </label>
          ))}
        </div>
      )}

      {!inicial && (
        <>
          <div className="cap gold" style={{ marginTop: 12 }}>
            4 · ¿Desde cuándo contar?
          </div>
          <div className="seg3" role="radiogroup" aria-label="Desde cuándo contar" style={{ marginTop: 6 }}>
            {(
              [
                [0, 'Desde hoy'],
                [30, 'Últimos 30 días'],
                [90, 'Últimos 90 días'],
              ] as const
            ).map(([v, t]) => (
              <button key={v} type="button" role="radio" aria-checked={contar === v} className={contar === v ? 'on' : ''} onClick={() => setContar(v)}>
                {t}
              </button>
            ))}
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button
          type="button"
          className="btn"
          disabled={!elegidos.length}
          onClick={() => alGuardar({ camino, desde, meta, habitos: elegidos, inicio: inicial && inicial.camino === camino && inicial.desde === desde ? inicial.inicio : sumarDias(hoy, -contar) })}
        >
          {inicial ? 'Guardar' : 'Empezar'}
        </button>
        {alCancelar && (
          <button type="button" className="ghost" onClick={alCancelar}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
