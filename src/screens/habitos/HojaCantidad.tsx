import { useEffect, useState } from 'react';
import { cumplido, formatoNumero, LIMITES_HABITO, type Habito } from '@core/habitos';
import { fijarValor, registrosDe, useDatos } from '@/app/datos';
import { Hoja } from '@/ui/Hoja';

/** Metas grandes (pasos, minutos, páginas): a partir de este número se escribe la cantidad en vez de sumar de a uno. */
export const META_GRANDE = 50;
export const esMetaGrande = (h: Pick<Habito, 'tipo' | 'meta'>) => h.tipo === 'cantidad' && h.meta > META_GRANDE;

/** Saltos cómodos según la meta: 8.000 pasos → +500, +1.000, +2.000. */
export function saltosPara(meta: number): number[] {
  const base = [1, 2, 5].flatMap((x) => [x, x * 10, x * 100, x * 1000, x * 10000]).sort((a, b) => a - b);
  const chico = base.filter((x) => x <= meta / 10).pop() ?? 1;
  const i = base.indexOf(chico);
  return [base[i], base[i + 1] ?? chico * 2, base[i + 2] ?? chico * 5];
}

/** Escribir cuánto se hizo hoy (total) o sumar con atajos. */
export function HojaCantidad({ h, fecha, abierta, alCerrar }: { h: Habito; fecha: string; abierta: boolean; alCerrar: () => void }) {
  const actual = useDatos((s) => registrosDe(s.registros, h.id).get(fecha)?.valor ?? 0);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (abierta) {
      setTexto(actual ? String(actual) : '');
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta]);
  const n = Number(texto.replace(/\D/g, '') || 0);
  const guardar = async () => {
    if (!Number.isFinite(n) || n < 0 || n > LIMITES_HABITO.valorMax) return setError(`Escribí un número entre 0 y ${formatoNumero(LIMITES_HABITO.valorMax)}.`);
    await fijarValor(h, fecha, n);
    alCerrar();
  };
  const unidad = h.unidad || 'unidades';
  return (
    <Hoja titulo={h.nombre} abierta={abierta} alCerrar={alCerrar}>
      <label className="lbl cap" htmlFor="cantidad-total" style={{ marginTop: 0 }}>
        Total de hoy ({unidad})
      </label>
      <input id="cantidad-total" className="inp num" inputMode="numeric" autoComplete="off" value={texto ? formatoNumero(n) : ''} placeholder="0" onChange={(e) => setTexto(e.target.value.replace(/\D/g, '').slice(0, 6))} style={{ fontSize: 26 }} />
      <div className="chips" style={{ marginTop: 10 }} role="group" aria-label="Sumar rápido">
        {saltosPara(h.meta).map((x) => (
          <button key={x} type="button" className="chip" onClick={() => setTexto(String(Math.min(LIMITES_HABITO.valorMax, n + x)))}>
            +{formatoNumero(x)}
          </button>
        ))}
        <button type="button" className="chip" onClick={() => setTexto(String(h.meta))}>
          Meta ({formatoNumero(h.meta)})
        </button>
      </div>
      <p className="mu" style={{ fontWeight: 600, marginTop: 10 }}>
        {cumplido(h, { valor: n }) ? '¡Meta cumplida!' : `Faltan ${formatoNumero(Math.max(0, h.meta - n))} ${unidad}.`}
      </p>
      <div className="err" role="alert">
        {error}
      </div>
      <button type="button" className="btn" onClick={guardar}>
        Guardar
      </button>
    </Hoja>
  );
}
