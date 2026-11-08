import { useEffect, useRef, useState } from 'react';
import { useSesion } from '@/app/sesion';
import { COLORES_PELO, COLORES_ROPA, crearEscena, PIELES, REFLEJO_INICIAL, type Barba, type Cara, type Escena, type Nariz, type Pelo, type Reflejo, type Vista } from './avatar';

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

function Colores({ titulo, valor, opciones, alCambiar }: { titulo: string; valor: string; opciones: string[]; alCambiar: (v: string) => void }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div className="cap mu2" style={{ fontSize: 10.5, marginBottom: 6 }}>
        {titulo}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="radiogroup" aria-label={titulo}>
        {opciones.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={valor === c}
            aria-label={c}
            onClick={() => alCambiar(c)}
            style={{ width: 32, height: 32, borderRadius: 16, background: c, border: valor === c ? '3px solid var(--gold)' : '1px solid var(--ln3)', boxShadow: valor === c ? '0 0 0 2px var(--sf) inset' : 'none' }}
          />
        ))}
      </div>
    </div>
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

/** El Espejo 3D (prueba, solo admin): reflejo facetado que se deforma con los deslizantes. */
export function Espejo3D() {
  const uid = useSesion((s) => s.usuario?.uid ?? '');
  const lienzo = useRef<HTMLCanvasElement>(null);
  const escena = useRef<Escena | null>(null);
  const [r, setR] = useState<Reflejo>(() => leer(uid));
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<Vista>('cuerpo');

  useEffect(() => {
    if (!lienzo.current) return;
    let vivo = true;
    crearEscena(lienzo.current, r)
      .then((e) => {
        if (!vivo) return e.destruir();
        escena.current = e;
        setCargando(false);
      })
      .catch(() => {
        if (vivo) setError('No se pudo mostrar tu reflejo en este dispositivo (hace falta 3D/WebGL y conexión la primera vez).');
      });
    return () => {
      vivo = false;
      escena.current?.destruir();
      escena.current = null;
    };
    // La escena se crea una vez; los cambios llegan por actualizar().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    escena.current?.enfocar(vista);
  }, [vista, cargando]);

  useEffect(() => {
    escena.current?.actualizar(r);
    try {
      localStorage.setItem(clave(uid), JSON.stringify(r));
    } catch {
      /* sin almacenamiento */
    }
  }, [r, uid, cargando]);

  const cambiar = (c: Partial<Reflejo>) => setR((a) => ({ ...a, ...c }));

  return (
    <div>
      <p className="mu" style={{ marginTop: 4 }}>
        Movelo con el dedo para girarlo; tocá “Cara” para verte de cerca.
      </p>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 14 }}>
        <div className="card" style={{ flex: '1 1 320px', minWidth: 0, overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 35%, var(--sf) 0%, var(--bg) 85%)' }}>
          {error ? (
            <p className="mu" style={{ padding: 24 }}>
              {error}
            </p>
          ) : (
            <div style={{ position: 'relative' }}>
              <canvas ref={lienzo} style={{ width: '100%', height: 'min(64vh, 560px)', display: 'block', touchAction: 'pan-y' }} aria-label="Tu reflejo en 3D" />
              {cargando && (
                <div className="mu" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 14 }}>
                  Preparando tu reflejo…
                </div>
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
        <div className="card" style={{ flex: '1 1 280px', minWidth: 0, padding: '6px 16px 18px' }}>
          <Deslizante etiqueta="Cuerpo" izq="Delgado" der="Robusto" valor={r.grasa} alCambiar={(v) => cambiar({ grasa: v })} />
          <Deslizante etiqueta="Músculo" izq="Poco" der="Mucho" valor={r.musculo} alCambiar={(v) => cambiar({ musculo: v })} />
          <Deslizante etiqueta="Postura" izq="Encorvado" der="Erguido" valor={r.postura} alCambiar={(v) => cambiar({ postura: v })} />
          <Opciones<Cara> titulo="Cara" valor={r.cara} opciones={[['ovalada', 'Ovalada'], ['redonda', 'Redonda'], ['cuadrada', 'Cuadrada'], ['triangular', 'Triangular']]} alCambiar={(v) => cambiar({ cara: v })} />
          <Opciones<Nariz> titulo="Nariz" valor={r.nariz} opciones={[['chica', 'Chica'], ['media', 'Media'], ['grande', 'Grande']]} alCambiar={(v) => cambiar({ nariz: v })} />
          <Opciones<Pelo> titulo="Pelo" valor={r.pelo} opciones={[['corto', 'Corto'], ['rulos', 'Abundante'], ['rapado', 'Rapado'], ['calvo', 'Sin pelo']]} alCambiar={(v) => cambiar({ pelo: v })} />
          <Opciones<Barba> titulo="Barba" valor={r.barba} opciones={[['ninguna', 'Sin barba'], ['corta', 'Corta'], ['larga', 'Larga']]} alCambiar={(v) => cambiar({ barba: v })} />
          <Opciones<'no' | 'si'> titulo="Lentes" valor={r.lentes ? 'si' : 'no'} opciones={[['no', 'Sin lentes'], ['si', 'Con lentes']]} alCambiar={(v) => cambiar({ lentes: v === 'si' })} />
          <Colores titulo="Piel" valor={r.piel} opciones={PIELES} alCambiar={(v) => cambiar({ piel: v })} />
          <Colores titulo="Color de pelo" valor={r.colorPelo} opciones={COLORES_PELO} alCambiar={(v) => cambiar({ colorPelo: v })} />
          <Colores titulo="Remera" valor={r.remera} opciones={COLORES_ROPA} alCambiar={(v) => cambiar({ remera: v })} />
          <Colores titulo="Pantalón" valor={r.pantalon} opciones={COLORES_ROPA} alCambiar={(v) => cambiar({ pantalon: v })} />
          <button type="button" className="ghost" style={{ marginTop: 18, width: '100%' }} onClick={() => setR(REFLEJO_INICIAL)}>
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
