import { useMemo, useRef, useState } from 'react';
import { ETAPAS, etapaPorCumplimiento, MAX_IMAGENES_MES, type Etapa } from '@core/espejo';
import { useSesion } from '@/app/sesion';
import { useHoy } from '@/app/datos';
import { borrarReflejo, crearEtapa, crearLamina, cumplimiento30, type DocReflejo } from '@/app/espejo';
import { useDocumento } from '@/data/hooks';
import { Confirmar } from '@/ui/Hoja';
import { useAvisos } from '@/ui/avisos';

const NOMBRE_ETAPA: Record<Etapa, string> = { aflojando: 'Aflojando', hoy: 'Hoy', mejorando: 'Mejorando', meta: 'Tu meta' };
const COLORES: Array<[string, string, string]> = [
  ['blanco', 'Blanco', '#f4f1ea' /* familia-ok: ilustración de El Espejo */],
  ['negro', 'Negro', '#2f2f33' /* familia-ok: ilustración de El Espejo */],
  ['gris', 'Gris', '#9a9a9a' /* familia-ok: ilustración de El Espejo */],
  ['rojo', 'Rojo', '#c8302c' /* familia-ok: ilustración de El Espejo */],
  ['azul', 'Azul', '#2f4f7f' /* familia-ok: ilustración de El Espejo */],
  ['jean', 'Jean', '#5878a8' /* familia-ok: ilustración de El Espejo */],
  ['verde', 'Verde', '#3f6b45' /* familia-ok: ilustración de El Espejo */],
  ['dorado', 'Mostaza', '#c9a24a' /* familia-ok: ilustración de El Espejo */],
  ['violeta', 'Violeta', '#7a4a8c' /* familia-ok: ilustración de El Espejo */],
];
type Plano = 'lamina' | 0 | 1 | 2;
const PLANOS: Array<[Plano, string]> = [
  ['lamina', 'Lámina'],
  [0, 'Frente'],
  [1, 'Perfil'],
  [2, 'Espalda'],
];

function ElegirColor({ titulo, valor, alCambiar }: { titulo: string; valor: string; alCambiar: (v: string) => void }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div className="cap mu2" style={{ fontSize: 11, marginBottom: 6 }}>
        {titulo}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="radiogroup" aria-label={titulo}>
        {COLORES.map(([v, t, c]) => (
          <button key={v} type="button" role="radio" aria-checked={valor === v} aria-label={t} title={t} onClick={() => alCambiar(v)} style={{ width: 32, height: 32, borderRadius: 16, background: c, border: valor === v ? '3px solid var(--gold)' : '1px solid var(--ln3)' }} />
        ))}
      </div>
    </div>
  );
}

/** Una imagen de la lámina: entera o recortada a un plano (cada vista ocupa un tercio). */
function VistaLamina({ url, plano, opacidad = 1 }: { url: string; plano: Plano; opacidad?: number }) {
  const estilo = { position: 'absolute' as const, inset: 0, opacity: opacidad, transition: 'opacity .35s' };
  if (plano === 'lamina') return <img src={url} alt="" style={{ ...estilo, width: '100%', height: '100%', objectFit: 'contain' }} />;
  return (
    <div style={{ ...estilo, overflow: 'hidden' }}>
      <img src={url} alt="" style={{ position: 'absolute', top: 0, height: '100%', width: '300%', maxWidth: 'none', left: `${-100 * plano}%`, objectFit: 'fill' }} />
    </div>
  );
}

/** El Espejo v2: tu reflejo hecho por la IA a partir de una selfie, en frente, perfil y espalda, con etapas. */
export function EspejoImagen() {
  const uid = useSesion((s) => s.usuario?.uid ?? '');
  const mostrar = useAvisos((s) => s.mostrar);
  const hoy = useHoy();
  const { datos: doc, cargando } = useDocumento<DocReflejo>(uid ? `users/${uid}/espejo/reflejo` : null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [remera, setRemera] = useState('blanco');
  const [pantalon, setPantalon] = useState('jean');
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [plano, setPlano] = useState<Plano>('lamina');
  const [evolucion, setEvolucion] = useState(1); // 0 aflojando · 1 hoy · 2 mejorando · 3 meta
  const [rehacer, setRehacer] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const vistaPrevia = useMemo(() => (selfie ? URL.createObjectURL(selfie) : null), [selfie]);
  const porcentaje = useMemo(() => cumplimiento30(hoy), [hoy]);

  const imagenDe = (e: Etapa) => (e === 'hoy' ? doc?.base?.url : doc?.etapas?.[e]?.url);
  const usados = doc?.usos?.mes === hoy.slice(0, 7) ? doc.usos.cantidad : 0;

  const crear = async () => {
    setTrabajando('lamina');
    const error = await crearLamina(selfie, descripcion, remera, pantalon);
    setTrabajando(null);
    if (error) mostrar(error);
    else {
      setSelfie(null);
      setEvolucion(1);
    }
  };
  const generarEtapa = async (e: Etapa) => {
    setTrabajando(e);
    const error = await crearEtapa(e);
    setTrabajando(null);
    if (error) mostrar(error);
  };

  if (cargando) return <p className="mu" style={{ marginTop: 18 }}>Cargando…</p>;

  // ---------- Crear la lámina ----------
  if (!doc?.base || rehacer) {
    return (
      <div className="card" style={{ marginTop: 14, padding: '16px 16px 18px', maxWidth: 560 }}>
        <div className="cap gold">Crear tu reflejo</div>
        <p className="mu" style={{ marginTop: 6, fontSize: 13.5 }}>
          Subí una selfie de frente, con buena luz. La IA arma tu personaje de frente, perfil y espalda, respetando tu cuerpo tal como es. La foto no se guarda: se usa una vez y se descarta.
        </p>
        <input ref={entrada} type="file" accept="image/*" capture="user" hidden onChange={(e) => setSelfie(e.target.files?.[0] ?? null)} aria-label="Selfie" />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
          {vistaPrevia ? (
            <img src={vistaPrevia} alt="Tu selfie" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--ln3)' }} />
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: 12, border: '1px dashed var(--ln)', display: 'grid', placeItems: 'center' }} className="mu2">
              ?
            </div>
          )}
          <button type="button" className="ghost" onClick={() => entrada.current?.click()}>
            {selfie ? 'Cambiar foto' : 'Sacar o elegir selfie'}
          </button>
        </div>
        <label style={{ display: 'block', marginTop: 14 }}>
          <span className="cap mu2" style={{ fontSize: 11 }}>
            Algo más de vos (opcional)
          </span>
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value.slice(0, 300))} rows={2} placeholder="Ej.: 34 años, 1,75 m, algo de panza, barba corta" style={{ width: '100%', marginTop: 6 }} />
        </label>
        <ElegirColor titulo="Remera" valor={remera} alCambiar={setRemera} />
        <ElegirColor titulo="Pantalón" valor={pantalon} alCambiar={setPantalon} />
        <button type="button" className="btn" style={{ marginTop: 18, width: '100%' }} disabled={!!trabajando || (!selfie && !descripcion.trim())} onClick={() => void crear()}>
          {trabajando ? 'Creando tu reflejo… (unos 30 segundos)' : 'Crear mi reflejo'}
        </button>
        {rehacer && (
          <button type="button" className="ghost" style={{ marginTop: 10, width: '100%' }} onClick={() => setRehacer(false)}>
            Cancelar
          </button>
        )}
        <p className="mu2" style={{ fontSize: 12.5, marginTop: 10 }}>
          Imágenes usadas este mes: {usados} de {MAX_IMAGENES_MES}.
        </p>
      </div>
    );
  }

  // ---------- Ver la lámina y su evolución ----------
  const idx = Math.min(2, Math.floor(evolucion));
  const crudo = evolucion - idx;
  const etapaA = ETAPAS[idx];
  const etapaB = ETAPAS[idx + 1];
  // Si a una de las dos etapas vecinas le falta la imagen, se muestra la otra entera.
  const urlA = imagenDe(etapaA) ?? imagenDe(etapaB);
  const urlB = imagenDe(etapaB) ?? imagenDe(etapaA);
  const mezcla = imagenDe(etapaA) && imagenDe(etapaB) ? crudo : 0;
  const actualEtapa = ETAPAS[Math.round(evolucion)];
  const faltantes = ETAPAS.filter((e) => !imagenDe(e));
  const sugerida = porcentaje === null ? null : etapaPorCumplimiento(porcentaje);
  const alto = plano === 'lamina' ? 'auto' : 'min(64vh, 560px)';

  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 14 }}>
      <div className="card" style={{ flex: '1 1 340px', minWidth: 0, overflow: 'hidden', padding: 0 }}>
        <div
          style={{ position: 'relative', width: '100%', aspectRatio: plano === 'lamina' ? '16 / 9' : undefined, height: alto, maxWidth: plano === 'lamina' ? undefined : 'calc(min(64vh, 560px) * 0.593)', marginInline: 'auto', background: '#eceae6' /* familia-ok: ilustración de El Espejo */ }}
          aria-label={`Tu reflejo: ${NOMBRE_ETAPA[actualEtapa]}${imagenDe(actualEtapa) ? '' : ' (sin generar)'}`}
          role="img"
        >
          {urlA && <VistaLamina url={urlA} plano={plano} opacidad={urlB && urlB !== urlA ? 1 - mezcla : 1} />}
          {urlB && urlB !== urlA && <VistaLamina url={urlB} plano={plano} opacidad={mezcla} />}
          {!imagenDe(actualEtapa) && (
            <div className="mu2" style={{ position: 'absolute', left: 10, right: 10, bottom: 10, textAlign: 'center', fontSize: 12.5, padding: '6px 10px', borderRadius: 10, background: 'rgba(255,255,255,.85)' /* familia-ok: ilustración de El Espejo */ }}>
              Falta generar “{NOMBRE_ETAPA[actualEtapa]}”: se muestra la más cercana.
            </div>
          )}
        </div>
        <div className="seg3" role="radiogroup" aria-label="Plano" style={{ margin: 12 }}>
          {PLANOS.map(([v, t]) => (
            <button key={String(v)} type="button" role="radio" aria-checked={plano === v} className={plano === v ? 'on' : ''} onClick={() => setPlano(v)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ flex: '1 1 280px', minWidth: 0, padding: '14px 16px 18px' }}>
        <label style={{ display: 'block' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="cap gold">Evolución</span>
            <span className="mu2" style={{ fontSize: 12.5, fontWeight: 700 }}>
              {NOMBRE_ETAPA[actualEtapa]}
            </span>
          </div>
          <input type="range" min={0} max={300} value={Math.round(evolucion * 100)} onChange={(e) => setEvolucion(Number(e.target.value) / 100)} style={{ width: '100%', marginTop: 8, accentColor: 'var(--gold)' }} aria-label="Evolución" />
          <div className="mu2" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
            <span>Aflojando</span>
            <span>Hoy</span>
            <span>Mejorando</span>
            <span>Meta</span>
          </div>
        </label>
        {sugerida && porcentaje !== null && (
          <button type="button" className="ghost" style={{ marginTop: 14, width: '100%' }} onClick={() => setEvolucion(ETAPAS.indexOf(sugerida))}>
            Según tus hábitos ({Math.round(porcentaje * 100)}% en 30 días): {NOMBRE_ETAPA[sugerida]}
          </button>
        )}
        {faltantes.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div className="cap mu2" style={{ fontSize: 11, marginBottom: 6 }}>
              Generar etapas
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {faltantes.map((e) => (
                <button key={e} type="button" className="pill" disabled={!!trabajando} onClick={() => void generarEtapa(e)}>
                  {trabajando === e ? 'Generando…' : NOMBRE_ETAPA[e]}
                </button>
              ))}
            </div>
            <p className="mu2" style={{ fontSize: 12.5, marginTop: 8 }}>
              Cada etapa tarda unos 30 segundos y queda guardada.
            </p>
          </div>
        )}
        <p className="mu2" style={{ fontSize: 12.5, marginTop: 14 }}>
          Imágenes usadas este mes: {usados} de {MAX_IMAGENES_MES}.
        </p>
        <button type="button" className="ghost" style={{ marginTop: 10, width: '100%' }} disabled={!!trabajando} onClick={() => setRehacer(true)}>
          Rehacer mi reflejo
        </button>
        <BorrarReflejo />
      </div>
    </div>
  );
}

function BorrarReflejo() {
  const [abierto, setAbierto] = useState(false);
  const mostrar = useAvisos((s) => s.mostrar);
  return (
    <>
      <button type="button" className="ghost" style={{ marginTop: 10, width: '100%', color: 'var(--miss)' }} onClick={() => setAbierto(true)}>
        Borrar mi reflejo
      </button>
      <Confirmar
        abierto={abierto}
        titulo="¿Borrar tu reflejo?"
        texto="Se borran todas las imágenes (hoy y las etapas). No se puede deshacer."
        accion="Borrar"
        peligro
        alCerrar={() => setAbierto(false)}
        alConfirmar={() => {
          setAbierto(false);
          void borrarReflejo().then((e) => e && mostrar(e));
        }}
      />
    </>
  );
}
