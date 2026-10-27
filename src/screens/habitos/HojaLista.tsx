import { cumplido, itemsHechos, type Habito } from '@core/habitos';
import { alternarItemLista, registrosDe, useDatos } from '@/app/datos';
import { Hoja } from '@/ui/Hoja';

/** Marcar los ítems de una lista desde otra pantalla (Comunidad, desafíos). */
export function HojaLista({ h, fecha, abierta, alCerrar }: { h: Habito; fecha: string; abierta: boolean; alCerrar: () => void }) {
  const r = useDatos((s) => registrosDe(s.registros, h.id).get(fecha));
  const hechos = itemsHechos(h, r);
  return (
    <Hoja titulo={h.nombre} abierta={abierta} alCerrar={alCerrar}>
      <p className="mu" style={{ fontWeight: 500, marginTop: 0 }}>
        Tocá lo que ya cumpliste hoy.
      </p>
      <div className="lista-items" role="group" aria-label={`Ítems de ${h.nombre}`} style={{ padding: 0 }}>
        {h.variables.map((v) => {
          const si = hechos.includes(v.id);
          return (
            <button key={v.id} type="button" className={`chip-item grande ${si ? 'ok' : ''}`} aria-pressed={si} onClick={() => alternarItemLista(h, fecha, v.id)}>
              <i aria-hidden="true">
                <svg width="10" height="10" viewBox="0 0 24 24">
                  <path d="M5 12l4 4 10-10" />
                </svg>
              </i>
              {v.nombre}
            </button>
          );
        })}
      </div>
      <p className="mu" style={{ fontWeight: 600, marginTop: 14 }}>
        {hechos.length} de {h.variables.length} · {cumplido(h, r) ? 'día cumplido' : `faltan ${Math.max(0, h.meta - hechos.length)}`}
      </p>
      <button type="button" className="btn" style={{ marginTop: 8 }} onClick={alCerrar}>
        Listo
      </button>
    </Hoja>
  );
}
