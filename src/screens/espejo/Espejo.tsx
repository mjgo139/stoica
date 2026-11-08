import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useSesion } from '@/app/sesion';
import { crearEscena, REFLEJO_INICIAL, type Barba, type Cara, type Escena, type Pelo, type Reflejo } from './estatua';

/** Por ahora el reflejo se guarda solo en este celular (prototipo). */
const clave = (uid: string) => `stoica.espejo.${uid}`;

function leer(uid: string): Reflejo {
  try {
    const crudo = localStorage.getItem(clave(uid));
    return crudo ? { ...REFLEJO_INICIAL, ...(JSON.parse(crudo) as Partial<Reflejo>) } : REFLEJO_INICIAL;
  } catch {
    return REFLEJO_INICIAL;
  }
}

function Deslizante({ etiqueta, izq, der, valor, alCambiar }: { etiqueta: string; izq: string; der: string; valor: number; alCambiar: (v: number) => void }) {
  return (
    <label style={{ display: 'block', marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="cap gold">{etiqueta}</span>
        <span className="mu2" style={{ fontSize: 12, fontWeight: 700 }}>
          {Math.round(valor * 100)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(valor * 100)}
        onChange={(e) => alCambiar(Number(e.target.value) / 100)}
        style={{ width: '100%', marginTop: 8, accentColor: 'var(--gold)' }}
        aria-label={etiqueta}
      />
      <div className="mu2" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
        <span>{izq}</span>
        <span>{der}</span>
      </div>
    </label>
  );
}

function Opciones<T extends string>({ titulo, valor, opciones, alCambiar }: { titulo: string; valor: T; opciones: Array<[T, string]>; alCambiar: (v: T) => void }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div className="cap mu2" style={{ fontSize: 10.5, marginBottom: 6 }}>
        {titulo}
      </div>
      <div className="seg3" role="radiogroup" aria-label={titulo}>
        {opciones.map(([v, t]) => (
          <button key={v} type="button" role="radio" aria-checked={valor === v} className={valor === v ? 'on' : ''} onClick={() => alCambiar(v)}>
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

/** El Espejo (prueba, solo admin): tu reflejo como estatua de mármol que cambia con tu cuerpo y tus hábitos. */
export function Espejo() {
  const perfil = useSesion((s) => s.perfil);
  const uid = useSesion((s) => s.usuario?.uid ?? '');
  const lienzo = useRef<HTMLCanvasElement>(null);
  const escena = useRef<Escena | null>(null);
  const [r, setR] = useState<Reflejo>(() => leer(uid));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!lienzo.current) return;
    try {
      escena.current = crearEscena(lienzo.current, r);
    } catch {
      setError('Este dispositivo no puede mostrar 3D (WebGL).');
    }
    return () => {
      escena.current?.destruir();
      escena.current = null;
    };
    // La escena se crea una vez; los cambios llegan por actualizar().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    escena.current?.actualizar(r);
    try {
      localStorage.setItem(clave(uid), JSON.stringify(r));
    } catch {
      /* sin almacenamiento */
    }
  }, [r, uid]);

  if (perfil?.rol !== 'admin') return <Navigate to="/" replace />;
  const cambiar = (c: Partial<Reflejo>) => setR((a) => ({ ...a, ...c }));

  return (
    <div className="entra" style={{ maxWidth: 980, marginInline: 'auto' }}>
      <div className="cap gold">El Espejo · prueba</div>
      <h1 className="titulo">Tu reflejo</h1>
      <p className="mu" style={{ marginTop: 4 }}>
        Solo vos lo ves por ahora. Movelo con el dedo para girarlo.
      </p>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 14 }}>
        <div className="card" style={{ flex: '1 1 320px', minWidth: 0, overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 35%, var(--sf) 0%, var(--bg) 85%)' }}>
          {error ? (
            <p className="mu" style={{ padding: 24 }}>
              {error}
            </p>
          ) : (
            <canvas ref={lienzo} style={{ width: '100%', height: 'min(62vh, 520px)', display: 'block', touchAction: 'pan-y' }} aria-label="Tu reflejo en 3D" />
          )}
        </div>
        <div className="card" style={{ flex: '1 1 280px', minWidth: 0, padding: '6px 16px 18px' }}>
          <Deslizante etiqueta="Cuerpo" izq="Delgado" der="Robusto" valor={r.grasa} alCambiar={(v) => cambiar({ grasa: v })} />
          <Deslizante etiqueta="Músculo" izq="Poco" der="Mucho" valor={r.musculo} alCambiar={(v) => cambiar({ musculo: v })} />
          <Deslizante etiqueta="Postura" izq="Encorvado" der="Erguido" valor={r.postura} alCambiar={(v) => cambiar({ postura: v })} />
          <Opciones<Cara> titulo="Cara" valor={r.cara} opciones={[['ovalada', 'Ovalada'], ['redonda', 'Redonda'], ['cuadrada', 'Cuadrada']]} alCambiar={(v) => cambiar({ cara: v })} />
          <Opciones<Pelo> titulo="Pelo" valor={r.pelo} opciones={[['corto', 'Corto'], ['rulos', 'Rulos'], ['largo', 'Largo'], ['calvo', 'Sin pelo']]} alCambiar={(v) => cambiar({ pelo: v })} />
          <Opciones<Barba> titulo="Barba" valor={r.barba} opciones={[['ninguna', 'Sin barba'], ['corta', 'Corta'], ['larga', 'Larga']]} alCambiar={(v) => cambiar({ barba: v })} />
          <Opciones<'no' | 'si'> titulo="Lentes" valor={r.lentes ? 'si' : 'no'} opciones={[['no', 'Sin lentes'], ['si', 'Con lentes']]} alCambiar={(v) => cambiar({ lentes: v === 'si' })} />
          <button type="button" className="ghost" style={{ marginTop: 18, width: '100%' }} onClick={() => setR(REFLEJO_INICIAL)}>
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
