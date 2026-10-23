import { aRomano } from '@core/romanos';
import { useDatos } from '@/app/datos';
import { Laurel } from '@/ui/Laurel';

/** "Victoria sobre ti mismo": aparece al alcanzar un hito de racha. */
export function Celebracion() {
  const c = useDatos((s) => s.celebracion);
  const poner = useDatos((s) => s.poner);
  if (!c) return null;
  const cerrar = () => poner({ celebracion: null });
  return (
    <div className="capa centro" onKeyDown={(e) => e.key === 'Escape' && cerrar()}>
      <div className="fondo-capa" onClick={cerrar} />
      <div className="dialogo" role="alertdialog" aria-modal="true" aria-label="Victoria sobre ti mismo">
        <div style={{ position: 'relative', width: 180, height: 164, margin: '0 auto' }}>
          <Laurel ancho={180} alto={164} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: 10 }}>
            <div className="num rebote" style={{ fontSize: 44, lineHeight: 1 }}>
              {aRomano(c.dias)}
            </div>
            <div className="cap mu" style={{ fontSize: 10.5, marginTop: 6 }}>
              {c.dias} días
            </div>
          </div>
        </div>
        <div className="cap gold" style={{ marginTop: 8 }}>
          Victoria sobre ti mismo
        </div>
        <h2 className="serif" style={{ fontSize: 24, fontWeight: 700, margin: '8px 0 0' }}>
          {c.dias} días seguidos de {c.habito}
        </h2>
        <p className="mu" style={{ fontWeight: 500, marginTop: 10 }}>
          “Ningún gran logro surge de repente.” — Epicteto
        </p>
        <button type="button" className="btn" style={{ marginTop: 18 }} onClick={cerrar} autoFocus>
          Seguir
        </button>
      </div>
    </div>
  );
}
