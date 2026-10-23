import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cumplido, NOMBRE_VIRTUD, formatoNumero, type Habito, type Registro } from '@core/habitos';
import { aRomano } from '@core/romanos';
import { alternarSiNo, sumar } from '@/app/datos';
import { IconoHabito, Trazo } from '@/ui/IconoHabito';
import { HojaMedir } from './HojaMedir';

interface Props {
  h: Habito;
  r: Registro | undefined;
  fecha: string;
  racha: number;
  /** Día pasado no cumplido (se marca en terracota). */
  perdido: boolean;
  editable: boolean;
}

export function FilaHabito({ h, r, fecha, racha, perdido, editable }: Props) {
  const ok = cumplido(h, r);
  const [rebote, setRebote] = useState(0);
  const [midiendo, setMidiendo] = useState(false);
  const valor = r?.valor ?? 0;

  const sub = (
    <span className={`sub v-${h.virtud} vt`}>
      {NOMBRE_VIRTUD[h.virtud]}
      {racha > 0 && <span className="mu2"> · Racha {aRomano(racha)}</span>}
    </span>
  );

  return (
    <div className={`item ${ok ? 'is-done' : ''}`} data-habito={h.nombre}>
      <Link to={`/habitos/${h.id}`} className="item-main">
        <IconoHabito icono={h.icono} virtud={h.virtud} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <span className="nm">{h.nombre}</span>
          {sub}
          {h.tipo === 'cantidad' && h.meta <= 24 && (
            <span className={`segs ${ok ? 'ok' : ''}`} aria-hidden="true">
              {Array.from({ length: h.meta }, (_, i) => (
                <i key={i} className={i < valor ? 'f' : ''} />
              ))}
            </span>
          )}
          {h.tipo === 'cantidad' && h.meta > 24 && (
            <span className="barra-prog" style={{ display: 'block', marginTop: 8, maxWidth: 170 }} aria-hidden="true">
              <i style={{ width: `${Math.min(100, (valor / h.meta) * 100)}%`, background: ok ? 'var(--ok)' : 'var(--gold)' }} />
            </span>
          )}
        </span>
      </Link>

      {h.tipo === 'sino' && (
        <button
          type="button"
          className={`dia ${ok ? 'ok' : perdido ? 'mal' : ''} ${rebote ? 'rebote' : ''}`}
          key={rebote}
          disabled={!editable}
          aria-pressed={ok}
          aria-label={`${ok ? 'Desmarcar' : 'Marcar'} ${h.nombre}`}
          onClick={() => {
            setRebote((n) => n + 1);
            alternarSiNo(h, fecha);
          }}
        >
          <span>{perdido && !ok ? <svg className="x" width="14" height="14" viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17" /></svg> : <svg width="14" height="14" viewBox="0 0 24 24"><path d="M5 12l4 4 10-10" /></svg>}</span>
        </button>
      )}

      {h.tipo === 'cantidad' && (
        <div className="contador">
          {valor > 0 && editable && (
            <button type="button" className="menos" aria-label={`Restar uno a ${h.nombre}`} onClick={() => sumar(h, fecha, -1)}>
              <Trazo d="menos" tam={16} />
            </button>
          )}
          <span className="val">
            <span className="num" style={{ fontSize: 18, color: ok ? 'var(--ok)' : perdido ? 'var(--miss)' : 'var(--tx)' }}>
              {valor}
              <span className="mu2" style={{ fontSize: 13 }}>/{h.meta}</span>
            </span>
            <span className="mu2" style={{ fontSize: 11, fontWeight: 600 }}>
              {ok ? 'cumplido' : `faltan ${h.meta - valor}`}
            </span>
          </span>
          <button
            type="button"
            className={`plus ${ok ? 'ok' : !editable ? 'off' : ''} ${rebote ? 'rebote' : ''}`}
            key={`p${rebote}`}
            disabled={!editable}
            aria-label={`Sumar uno a ${h.nombre}`}
            onClick={() => {
              setRebote((n) => n + 1);
              sumar(h, fecha, 1);
            }}
          >
            {ok ? <Trazo d="check" tam={18} /> : <Trazo d="mas" tam={18} />}
          </button>
        </div>
      )}

      {h.tipo === 'medicion' && (
        <>
          <button type="button" className={`pill ${ok ? 'ok' : perdido ? 'mal' : ''}`} disabled={!editable} onClick={() => setMidiendo(true)} aria-label={`Registrar ${h.nombre}`}>
            {ok ? `✓ ${formatoNumero(Object.values(r!.medidas)[0])} ${h.variables.find((v) => v.id === Object.keys(r!.medidas)[0])?.unidad ?? ''}` : 'Medir'}
          </button>
          <HojaMedir h={h} fecha={fecha} abierta={midiendo} alCerrar={() => setMidiendo(false)} />
        </>
      )}
    </div>
  );
}
