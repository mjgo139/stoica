import { useEffect, useRef, useState } from 'react';
import { useSesion } from '@/app/sesion';
import { crearViva, ETAPAS_MUSCULO, ETAPAS_PESO, FORMA_INICIAL, nombreDe, PESO_ATLETICO, type EscenaViva, type Forma } from './viva';

const clave = (uid: string) => `stoica.viva.${uid}`;

function leer(uid: string): Forma {
  try {
    const crudo = localStorage.getItem(clave(uid));
    return crudo ? { ...FORMA_INICIAL, ...(JSON.parse(crudo) as Partial<Forma>) } : FORMA_INICIAL;
  } catch {
    return FORMA_INICIAL;
  }
}

/** El Espejo · Estatua viva: una sola estatua de Meshy que cambia suave con el peso y el músculo. */
export function EspejoViva() {
  const uid = useSesion((s) => s.usuario?.uid ?? '');
  const lienzo = useRef<HTMLCanvasElement>(null);
  const escena = useRef<EscenaViva | null>(null);
  const [f, setF] = useState<Forma>(() => leer(uid));
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [vista, setVista] = useState<'cuerpo' | 'cara'>('cuerpo');

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
    try {
      localStorage.setItem(clave(uid), JSON.stringify(f));
    } catch {
      /* sin almacenamiento */
    }
  }, [f, uid, cargando]);

  useEffect(() => {
    escena.current?.enfocar(vista);
  }, [vista, cargando]);

  const nombrePeso = f.musculo > 0.001 ? nombreDe(ETAPAS_MUSCULO, f.musculo) : nombreDe(ETAPAS_PESO, f.peso);
  const nombreMusculo = nombreDe(ETAPAS_MUSCULO, f.musculo);

  const deslizante = (titulo: string, valor: number, texto: string, extremos: [string, string], cambiar: (v: number) => void) => (
    <label style={{ display: 'block', marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="cap gold">{titulo}</span>
        <span className="mu2" style={{ fontSize: 12, fontWeight: 700 }}>
          {texto}
        </span>
      </div>
      <input type="range" min={0} max={100} value={Math.round(valor * 100)} onChange={(ev) => cambiar(Number(ev.target.value) / 100)} style={{ width: '100%', marginTop: 6, accentColor: 'var(--gold)' }} aria-label={titulo} />
      <div className="mu2" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
        <span>{extremos[0]}</span>
        <span>{extremos[1]}</span>
      </div>
    </label>
  );

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: '1 1 340px', minWidth: 0, overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #3a352f 0%, #1d1a17 80%)', border: 'none' }}>
          {error ? (
            <p style={{ padding: 24, color: '#e9e2d6' }}>{error}</p>
          ) : (
            <div style={{ position: 'relative' }}>
              <canvas ref={lienzo} style={{ width: '100%', height: 'min(66vh, 580px)', display: 'block', touchAction: 'none' }} aria-label={`Estatua viva: ${nombrePeso}`} />
              {cargando && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 14, color: '#d8cfc2' }}>Trayendo tu estatua…</div>}
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
        <div className="card" style={{ flex: '1 1 280px', minWidth: 0, padding: '14px 16px 18px' }}>
          {deslizante('Peso', f.peso, f.musculo > 0.001 ? 'Atlético' : nombrePeso, ['Delgado', 'Muy obeso'], (v) => setF({ peso: v, musculo: 0 }))}
          {deslizante('Músculo', f.musculo, nombreMusculo, ['Normal', 'Fisicoculturista'], (v) => setF({ peso: PESO_ATLETICO, musculo: v }))}
          <p className="mu2" style={{ fontSize: 11.5, marginTop: 14 }}>
            Tus 8 estatuas de Meshy unidas: en cada etapa ves la estatua real y entre etapas se transforma de una a otra. El músculo sale desde Atlético (si movés el peso, vuelve a Normal). Por ahora se mueve a mano.
          </p>
        </div>
      </div>
    </div>
  );
}
