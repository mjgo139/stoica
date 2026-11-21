import { useEffect, useRef, useState } from 'react';
import { cargarIndice, crearMarmol, type EscenaMarmol, type EtapaMarmol } from './marmol';

/** Las 9 etapas planeadas (las que todavía no tienen estatua se muestran apagadas). */
const PLAN = ['Muy flaco', 'Delgado', 'Atlético', 'Musculoso', 'Fuerte', 'Normal', 'Rellenito', 'Con sobrepeso', 'Obeso'];

/** El Espejo · Mármol: estatuas de Meshy, una por etapa física. */
export function EspejoMarmol() {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const escena = useRef<EscenaMarmol | null>(null);
  const [etapas, setEtapas] = useState<EtapaMarmol[]>([]);
  const [actual, setActual] = useState<string>('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [vista, setVista] = useState<'cuerpo' | 'cara'>('cuerpo');

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const lista = await cargarIndice();
        if (!vivo || !lista.length || !lienzo.current) return;
        setEtapas(lista);
        setActual(lista[0].archivo);
        const e = await crearMarmol(lienzo.current, lista[0].archivo);
        if (!vivo) return e.destruir();
        escena.current = e;
        setCargando(false);
      } catch {
        if (vivo) setError('No se pudo mostrar la estatua (hace falta 3D/WebGL y conexión la primera vez).');
      }
    })();
    return () => {
      vivo = false;
      escena.current?.destruir();
      escena.current = null;
    };
  }, []);

  useEffect(() => {
    escena.current?.enfocar(vista);
  }, [vista, cargando]);

  const elegir = (archivo: string) => {
    setActual(archivo);
    void escena.current?.mostrar(archivo);
  };
  const nombreActual = etapas.find((e) => e.archivo === actual)?.nombre ?? '';

  return (
    <div style={{ marginTop: 14 }}>
      <div className="card" style={{ overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #3a352f 0%, #1d1a17 80%)' /* familia-ok: ilustración de El Espejo */, border: 'none' }}>
        {error ? (
          <p style={{ padding: 24, color: '#e9e2d6' /* familia-ok: ilustración de El Espejo */ }}>{error}</p>
        ) : (
          <div style={{ position: 'relative' }}>
            <canvas ref={lienzo} style={{ width: '100%', height: 'min(68vh, 600px)', display: 'block', touchAction: 'none' }} aria-label={`Estatua: ${nombreActual}`} />
            {cargando && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 13.5, color: '#d8cfc2' /* familia-ok: ilustración de El Espejo */ }}>Trayendo tu estatua…</div>}
            <div className="cap" style={{ position: 'absolute', left: 16, top: 14, color: '#c9a24a' /* familia-ok: ilustración de El Espejo */ }}>
              {nombreActual}
            </div>
            <div style={{ position: 'absolute', right: 14, top: 14, fontSize: 11.5, color: '#bdb3a5' /* familia-ok: ilustración de El Espejo */ }}>Arrastrá para girar · pellizcá para acercar</div>
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
      <div className="card" style={{ marginTop: 14, padding: '12px 14px' }}>
        <div className="cap gold">Etapas</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }} role="radiogroup" aria-label="Etapas">
          {PLAN.map((nombre) => {
            const e = etapas.find((x) => x.nombre === nombre);
            return (
              <button key={nombre} type="button" role="radio" aria-checked={!!e && e.archivo === actual} className={`pill ${e && e.archivo === actual ? 'ok' : ''}`} disabled={!e || cargando} onClick={() => e && elegir(e.archivo)} style={{ opacity: e ? 1 : 0.4 }}>
                {nombre}
              </button>
            );
          })}
        </div>
        <p className="mu2" style={{ fontSize: 12.5, marginTop: 10 }}>
          Por ahora está solo “Atlético”. Las demás se encienden a medida que generes sus estatuas en Meshy.
        </p>
      </div>
    </div>
  );
}
