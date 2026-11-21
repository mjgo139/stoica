import { useEffect, useRef, useState } from 'react';
import { useSesion } from '@/app/sesion';
import { crearHumano, CUERPO_INICIAL, type Cuerpo, type EscenaHumano } from './humano';

interface Estado {
  hoy: Cuerpo;
  meta: Cuerpo;
  comparar: boolean;
}

const INICIAL: Estado = { hoy: { ...CUERPO_INICIAL, peso: 0.65 }, meta: { ...CUERPO_INICIAL, peso: 0.45, musculo: 0.7 }, comparar: true };
const clave = (uid: string) => `stoica.cuerpo.${uid}`;

function leer(uid: string): Estado {
  try {
    const crudo = localStorage.getItem(clave(uid));
    return crudo ? { ...INICIAL, ...(JSON.parse(crudo) as Partial<Estado>) } : INICIAL;
  } catch {
    return INICIAL;
  }
}

const nombrePeso = (p: number) => (p < 0.2 ? 'Muy delgado' : p < 0.4 ? 'Delgado' : p < 0.6 ? 'Normal' : p < 0.75 ? 'Rellenito' : p < 0.9 ? 'Con sobrepeso' : 'Obeso');
const nombreMusculo = (m: number) => (m < 0.3 ? 'Poco' : m < 0.6 ? 'Medio' : m < 0.85 ? 'Marcado' : 'Mucho');

function Deslizante({ titulo, valor, texto, extremos, alCambiar }: { titulo: string; valor: number; texto: string; extremos: [string, string]; alCambiar: (v: number) => void }) {
  return (
    <label style={{ display: 'block', marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="cap gold">{titulo}</span>
        <span className="mu2" style={{ fontSize: 12.5, fontWeight: 700 }}>
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

/** El Espejo · Tu cuerpo: cuerpo realista gris (estilo escaneo) de hoy, y opcionalmente tu meta al lado. */
export function EspejoCuerpo() {
  const uid = useSesion((s) => s.usuario?.uid ?? '');
  const lienzo = useRef<HTMLCanvasElement>(null);
  const escena = useRef<EscenaHumano | null>(null);
  const [e, setE] = useState<Estado>(() => leer(uid));
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const cuerpos = e.comparar ? [e.hoy, e.meta] : [e.hoy];

  useEffect(() => {
    if (!lienzo.current) return;
    let vivo = true;
    crearHumano(lienzo.current, cuerpos)
      .then((s) => {
        if (!vivo) return s.destruir();
        escena.current = s;
        setCargando(false);
      })
      .catch(() => vivo && setError('No se pudo mostrar el cuerpo en este dispositivo (hace falta 3D/WebGL y conexión la primera vez).'));
    return () => {
      vivo = false;
      escena.current?.destruir();
      escena.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    escena.current?.actualizar(cuerpos);
    try {
      localStorage.setItem(clave(uid), JSON.stringify(e));
    } catch {
      /* sin almacenamiento */
    }
  }, [e, uid, cargando]); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiar = (quien: 'hoy' | 'meta', campo: keyof Cuerpo, v: number) =>
    setE((a) => (campo === 'altura' ? { ...a, hoy: { ...a.hoy, altura: v }, meta: { ...a.meta, altura: v } } : { ...a, [quien]: { ...a[quien], [campo]: v } }));

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: '1 1 340px', minWidth: 0, overflow: 'hidden', background: '#ece9e4' /* familia-ok: ilustración de El Espejo */, border: 'none' }}>
          {error ? (
            <p style={{ padding: 24, color: '#333' /* familia-ok: ilustración de El Espejo */ }}>{error}</p>
          ) : (
            <div style={{ position: 'relative' }}>
              <canvas ref={lienzo} style={{ width: '100%', height: 'min(64vh, 560px)', display: 'block', touchAction: 'pan-y' }} aria-label="Tu cuerpo en 3D" />
              {cargando && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 13.5, color: '#555' /* familia-ok: ilustración de El Espejo */ }}>Cargando tu cuerpo…</div>}
              {e.comparar && !cargando && (
                <div style={{ position: 'absolute', top: 10, left: 0, right: 0, display: 'flex', justifyContent: 'space-around', fontSize: 12.5, fontWeight: 800, color: '#555' /* familia-ok: ilustración de El Espejo */, letterSpacing: '.08em', pointerEvents: 'none' }}>
                  <span>HOY</span>
                  <span>META</span>
                </div>
              )}
              <p style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', fontSize: 11.5, color: '#777' /* familia-ok: ilustración de El Espejo */, margin: 0, pointerEvents: 'none' }}>Arrastrá para girar · pellizcá para acercar</p>
            </div>
          )}
        </div>

        <div className="card" style={{ flex: '1 1 280px', minWidth: 0, padding: '14px 16px 18px' }}>
          <div className="cap">Hoy</div>
          <Deslizante titulo="Peso" valor={e.hoy.peso} texto={nombrePeso(e.hoy.peso)} extremos={['Delgado', 'Obeso']} alCambiar={(v) => cambiar('hoy', 'peso', v)} />
          <Deslizante titulo="Músculo" valor={e.hoy.musculo} texto={nombreMusculo(e.hoy.musculo)} extremos={['Poco', 'Mucho']} alCambiar={(v) => cambiar('hoy', 'musculo', v)} />
          <Deslizante titulo="Altura" valor={e.hoy.altura} texto={e.hoy.altura < 0.35 ? 'Bajo' : e.hoy.altura > 0.65 ? 'Alto' : 'Medio'} extremos={['Bajo', 'Alto']} alCambiar={(v) => cambiar('hoy', 'altura', v)} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, fontWeight: 700 }}>
            <input type="checkbox" checked={e.comparar} onChange={(ev) => setE((a) => ({ ...a, comparar: ev.target.checked }))} style={{ accentColor: 'var(--gold)' }} />
            Comparar con mi meta
          </label>
          {e.comparar && (
            <>
              <Deslizante titulo="Peso meta" valor={e.meta.peso} texto={nombrePeso(e.meta.peso)} extremos={['Delgado', 'Obeso']} alCambiar={(v) => cambiar('meta', 'peso', v)} />
              <Deslizante titulo="Músculo meta" valor={e.meta.musculo} texto={nombreMusculo(e.meta.musculo)} extremos={['Poco', 'Mucho']} alCambiar={(v) => cambiar('meta', 'musculo', v)} />
            </>
          )}
          <p className="mu2" style={{ fontSize: 11.5, marginTop: 14 }}>
            Prueba: por ahora se mueve a mano. Más adelante puede tomar tu peso y tus hábitos.
          </p>
        </div>
      </div>
    </div>
  );
}
