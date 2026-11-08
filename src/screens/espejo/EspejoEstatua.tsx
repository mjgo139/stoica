import { useEffect, useRef, useState } from 'react';
import { useSesion } from '@/app/sesion';
import { crearEstatua, ESTATUA_INICIAL, ETAPAS_PESO, type Estatua, type EscenaEstatua } from './estatua';

const clave = (uid: string) => `stoica.estatua.${uid}`;
const NOMBRES_ETAPA = ['Atlético', 'En forma', 'Fuerte', 'Normal', 'Rellenito', 'Con sobrepeso', 'Obeso'];

function leer(uid: string): Estatua {
  try {
    const crudo = localStorage.getItem(clave(uid));
    return crudo ? { ...ESTATUA_INICIAL, ...(JSON.parse(crudo) as Partial<Estatua>) } : ESTATUA_INICIAL;
  } catch {
    return ESTATUA_INICIAL;
  }
}

/** El Espejo · Estatua: un mismo personaje (escultura griega de mármol) que cambia con el peso. */
export function EspejoEstatua() {
  const uid = useSesion((s) => s.usuario?.uid ?? '');
  const lienzo = useRef<HTMLCanvasElement>(null);
  const escena = useRef<EscenaEstatua | null>(null);
  const [e, setE] = useState<Estatua>(() => leer(uid));
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [vista, setVista] = useState<'cuerpo' | 'cara'>('cuerpo');
  const [tira, setTira] = useState<string[]>([]);

  useEffect(() => {
    if (!lienzo.current) return;
    let vivo = true;
    crearEstatua(lienzo.current, e)
      .then((s) => {
        if (!vivo) return s.destruir();
        escena.current = s;
        setCargando(false);
      })
      .catch(() => vivo && setError('No se pudo mostrar la estatua en este dispositivo (hace falta 3D/WebGL y conexión la primera vez).'));
    return () => {
      vivo = false;
      escena.current?.destruir();
      escena.current = null;
    };
    // La escena se crea una vez; los cambios llegan por actualizar().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    escena.current?.actualizar(e);
    try {
      localStorage.setItem(clave(uid), JSON.stringify(e));
    } catch {
      /* sin almacenamiento */
    }
  }, [e, uid, cargando]);

  useEffect(() => {
    escena.current?.enfocar(vista);
  }, [vista, cargando]);

  // Tira de las 7 etapas (fotos sacadas de la misma estatua).
  useEffect(() => {
    if (cargando || !escena.current) return;
    const t = setTimeout(() => {
      if (!escena.current) return;
      setTira(escena.current.fotos(ETAPAS_PESO.map((peso) => ({ ...e, peso })), 180, 330));
    }, 300);
    return () => clearTimeout(t);
  }, [cargando, e.barba, e.laurel]); // eslint-disable-line react-hooks/exhaustive-deps

  const etapaActual = Math.round(e.peso * 6);

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: '1 1 340px', minWidth: 0, overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #3a352f 0%, #1d1a17 80%)', border: 'none' }}>
          {error ? (
            <p style={{ padding: 24, color: '#e9e2d6' }}>{error}</p>
          ) : (
            <div style={{ position: 'relative' }}>
              <canvas ref={lienzo} style={{ width: '100%', height: 'min(64vh, 560px)', display: 'block', touchAction: 'pan-y' }} aria-label={`Tu estatua: ${NOMBRES_ETAPA[etapaActual]}`} />
              {cargando && (
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 14, color: '#d8cfc2' }}>Esculpiendo tu estatua…</div>
              )}
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

        <div className="card" style={{ flex: '1 1 280px', minWidth: 0, padding: '14px 16px 18px' }}>
          <label style={{ display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="cap gold">Peso</span>
              <span className="mu2" style={{ fontSize: 12, fontWeight: 700 }}>
                {NOMBRES_ETAPA[etapaActual]}
              </span>
            </div>
            <input type="range" min={0} max={100} value={Math.round(e.peso * 100)} onChange={(ev) => setE((a) => ({ ...a, peso: Number(ev.target.value) / 100 }))} style={{ width: '100%', marginTop: 8, accentColor: 'var(--gold)' }} aria-label="Peso" />
            <div className="mu2" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
              <span>Atlético</span>
              <span>Obeso</span>
            </div>
          </label>
          <div className="seg3" role="radiogroup" aria-label="Barba" style={{ marginTop: 16 }}>
            {(
              [
                [true, 'Con barba'],
                [false, 'Sin barba'],
              ] as const
            ).map(([v, t]) => (
              <button key={t} type="button" role="radio" aria-checked={e.barba === v} className={e.barba === v ? 'on' : ''} onClick={() => setE((a) => ({ ...a, barba: v }))}>
                {t}
              </button>
            ))}
          </div>
          <div className="seg3" role="radiogroup" aria-label="Laurel" style={{ marginTop: 10 }}>
            {(
              [
                [false, 'Sin laurel'],
                [true, 'Con laurel'],
              ] as const
            ).map(([v, t]) => (
              <button key={t} type="button" role="radio" aria-checked={e.laurel === v} className={e.laurel === v ? 'on' : ''} onClick={() => setE((a) => ({ ...a, laurel: v }))}>
                {t}
              </button>
            ))}
          </div>
          <p className="mu2" style={{ fontSize: 12.5, marginTop: 14 }}>
            Es un mismo personaje para todos: con tus hábitos se va a mover entre estas etapas.
          </p>
        </div>
      </div>

      {/* Tira de evolución: tocá una etapa para verla grande */}
      <div className="card" style={{ marginTop: 16, padding: '12px 10px', background: '#1d1a17', border: 'none' }}>
        <div className="cap" style={{ color: '#c9a24a', marginLeft: 6 }}>
          Evolución
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, marginTop: 8 }} role="radiogroup" aria-label="Etapas de peso">
          {ETAPAS_PESO.map((peso, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={etapaActual === i}
              aria-label={NOMBRES_ETAPA[i]}
              onClick={() => setE((a) => ({ ...a, peso }))}
              style={{ padding: 0, borderRadius: 10, border: etapaActual === i ? '2px solid #c9a24a' : '2px solid transparent', background: 'transparent', overflow: 'hidden' }}
            >
              {tira[i] ? <img src={tira[i]} alt="" style={{ width: '100%', display: 'block', aspectRatio: '180 / 330', objectFit: 'cover' }} /> : <div style={{ aspectRatio: '180 / 330' }} />}
              <div style={{ fontSize: 10, color: '#d8cfc2', padding: '2px 0 4px', fontWeight: 700 }}>{i + 1}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
