/** Página de la repisa de logros: los adornos que se desbloquean con medallas y las medallas de cada hábito. */
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ADORNOS, ORDEN_NICHOS } from './disposicion';
import { Medalla } from './Graficos';

interface Props {
  /** "Tu repisa" o "Repisa de Ana". */
  titulo: string;
  logros: number;
  /** Medallas de cada hábito (solo en tu propia repisa). */
  porHabito?: Array<{ nombre: string; medallas: number; ciclo: number }>;
  alCerrar: () => void;
}

export function PaginaRepisa({ titulo, logros, porHabito, alCerrar }: Props) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [alCerrar]);
  const extra = Math.max(0, Math.min(logros, ORDEN_NICHOS.length) - ADORNOS.length);
  const proximo = ADORNOS.find((a) => a.medallas > logros);
  return createPortal(
    <div className="hoja-planta" role="dialog" aria-label={titulo} onClick={(e) => e.target === e.currentTarget && alCerrar()} style={{ zIndex: 205 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="cap gold">Repisa de logros</div>
            <h2 className="titulo" style={{ fontSize: 20, margin: 0 }}>
              {titulo}
            </h2>
          </div>
          <button type="button" className="ico" aria-label="Cerrar" onClick={alCerrar}>
            ✕
          </button>
        </div>
        <p className="mu2" style={{ fontSize: 13.5, margin: '6px 0 10px' }}>
          {logros === 0
            ? 'Todavía no hay medallas.'
            : `${logros} ${logros === 1 ? 'medalla ganada' : 'medallas ganadas'}${proximo ? ` · la próxima trae ${proximo.nombre.toLowerCase()}` : ''}.`}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 10 }}>
          {ADORNOS.map((a) => {
            const tiene = a.medallas <= logros;
            return (
              <div key={a.id} className="card" style={{ padding: 8, textAlign: 'center', opacity: tiene ? 1 : 0.6, borderStyle: tiene ? 'solid' : 'dashed' }}>
                <img src={`/jardin/adorno-${a.id}.webp`} alt="" style={{ width: 64, height: 64, objectFit: 'contain', display: 'block', margin: '0 auto 4px', filter: tiene ? 'none' : 'grayscale(1) brightness(.7)' }} />
                <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.2 }}>{a.nombre}</div>
                <div className="mu2" style={{ fontSize: 11 }}>
                  {tiene ? `Medalla ${a.medallas}` : `Con ${a.medallas} ${a.medallas === 1 ? 'medalla' : 'medallas'}`}
                </div>
              </div>
            );
          })}
        </div>
        {extra > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <Medalla tipo="Oro" dias={100} tam={28} />
            <span style={{ fontSize: 13.5 }}>
              Y {extra} {extra === 1 ? 'medalla más' : 'medallas más'} de laurel en la repisa.
            </span>
          </div>
        )}
        {porHabito && porHabito.length > 0 && (
          <div className="card" style={{ marginTop: 12, padding: '10px 14px' }}>
            <div className="cap gold">Medallas por hábito</div>
            {porHabito.map((h) => (
              <div key={h.nombre} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--ln2)' }}>
                <span style={{ flex: 1, fontSize: 13.5 }}>{h.nombre}</span>
                <span className="mu2" style={{ fontSize: 12.5 }}>
                  {h.medallas} {h.medallas === 1 ? 'medalla' : 'medallas'} · {30 - (h.ciclo % 30)} días para la próxima
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
