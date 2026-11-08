import { lazy, Suspense, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useSesion } from '@/app/sesion';
import { EspejoImagen } from './EspejoImagen';

/** La versión con imágenes (IA) está pausada: no convenció. Para volver a mostrarla, poner esto en true (y ESPEJO_IMAGEN=si en el servidor). */
const CON_IMAGEN = false;

// Los 3D traen su motor (three.js): se cargan solo al entrar.
const EspejoMarmol = lazy(() => import('./EspejoMarmol').then((m) => ({ default: m.EspejoMarmol })));
const EspejoEstatua = lazy(() => import('./EspejoEstatua').then((m) => ({ default: m.EspejoEstatua })));
const EspejoCuerpo = lazy(() => import('./EspejoCuerpo').then((m) => ({ default: m.EspejoCuerpo })));
const Espejo3D = lazy(() => import('./Espejo3D').then((m) => ({ default: m.Espejo3D })));

type Version = 'cuerpo' | 'marmol' | 'estatua' | 'personaje' | 'imagen';

/** El Espejo (prueba, solo admin): estatua griega que cambia con el peso, personaje 3D y (pausada) versión con imágenes. */
export function Espejo() {
  const perfil = useSesion((s) => s.perfil);
  const [version, setVersion] = useState<Version>('cuerpo');
  if (perfil?.rol !== 'admin') return <Navigate to="/" replace />;
  const opciones: Array<[Version, string]> = [
    ['cuerpo', 'Tu cuerpo'],
    ['marmol', 'Mármol'],
    ['estatua', 'Estatua simple'],
    ['personaje', 'Personaje 3D'],
    ...(CON_IMAGEN ? ([['imagen', 'Imagen']] as Array<[Version, string]>) : []),
  ];
  return (
    <div className="entra" style={{ maxWidth: 980, marginInline: 'auto' }}>
      <div className="cap gold">El Espejo · prueba</div>
      <h1 className="titulo">Tu reflejo</h1>
      <p className="mu" style={{ marginTop: 4 }}>
        Solo vos lo ves por ahora.
      </p>
      <div className="seg3" role="radiogroup" aria-label="Versión del espejo" style={{ marginTop: 12, maxWidth: 620 }}>
        {opciones.map(([v, t]) => (
          <button key={v} type="button" role="radio" aria-checked={version === v} className={version === v ? 'on' : ''} onClick={() => setVersion(v)}>
            {t}
          </button>
        ))}
      </div>
      {version === 'imagen' && CON_IMAGEN ? (
        <EspejoImagen />
      ) : (
        <Suspense fallback={<p className="mu" style={{ marginTop: 18 }}>Cargando…</p>}>{version === 'cuerpo' ? <EspejoCuerpo /> : version === 'marmol' ? <EspejoMarmol /> : version === 'estatua' ? <EspejoEstatua /> : <Espejo3D />}</Suspense>
      )}
    </div>
  );
}
