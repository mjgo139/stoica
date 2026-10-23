import { useEffect, useState, type FormEvent } from 'react';
import { aNumero, validarValor, formatoNumero, type Habito, type Registro } from '@core/habitos';
import { fechaLargaDeClave } from '@core/fechas';
import { medir, registrosDe, useDatos } from '@/app/datos';
import { Hoja } from '@/ui/Hoja';
import { useAvisos } from '@/ui/avisos';

/** Hoja para registrar una o más variables de un hábito de medición. */
export function HojaMedir({ h, fecha, abierta, alCerrar }: { h: Habito; fecha: string; abierta: boolean; alCerrar: () => void }) {
  const registros = useDatos((s) => s.registros);
  const mostrar = useAvisos((s) => s.mostrar);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  // Último valor conocido de cada variable, como referencia.
  const ultimo = (vid: string) => {
    const lista = [...registrosDe(registros, h.id).values()].filter((r: Registro) => typeof r.medidas?.[vid] === 'number' && r.fecha <= fecha).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    return lista[0]?.medidas[vid];
  };

  useEffect(() => {
    if (!abierta) return;
    const r = registrosDe(registros, h.id).get(fecha);
    setValores(Object.fromEntries(h.variables.map((v) => [v.id, r?.medidas?.[v.id] !== undefined ? String(r.medidas[v.id]).replace('.', ',') : ''])));
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta]);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    const medidas: Record<string, number> = {};
    for (const v of h.variables) {
      const s = valores[v.id] ?? '';
      if (!s.trim()) continue;
      const n = aNumero(s);
      const err = validarValor(n);
      if (err) return setError(`${v.nombre}: ${err}`);
      medidas[v.id] = Math.round(n * 100) / 100;
    }
    if (Object.keys(medidas).length === 0) return setError('Escribí al menos un valor.');
    await medir(h, fecha, medidas);
    mostrar('Medición guardada.');
    alCerrar();
  };

  return (
    <Hoja titulo={h.nombre} abierta={abierta} alCerrar={alCerrar}>
      <p className="mu" style={{ fontWeight: 600, marginTop: 6 }}>
        {fechaLargaDeClave(fecha)}
      </p>
      <form onSubmit={guardar} noValidate>
        {h.variables.map((v) => {
          const u = ultimo(v.id);
          return (
            <div key={v.id} style={{ marginTop: 18 }}>
              <label className="fl" htmlFor={`v-${v.id}`}>
                {v.nombre} {v.unidad && `(${v.unidad})`}
              </label>
              <input
                id={`v-${v.id}`}
                className="fi"
                inputMode="decimal"
                autoComplete="off"
                placeholder={u !== undefined ? `Último: ${formatoNumero(u)}` : `Meta: ${formatoNumero(v.meta)}`}
                value={valores[v.id] ?? ''}
                onChange={(e) => setValores({ ...valores, [v.id]: e.target.value })}
              />
            </div>
          );
        })}
        <div className="err" role="alert">
          {error}
        </div>
        <button className="btn" type="submit" style={{ marginTop: 8 }}>
          Guardar
        </button>
      </form>
    </Hoja>
  );
}
