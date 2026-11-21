import { useEffect, useMemo, useRef, useState } from 'react';
import { CabeceraPagina, Grupo } from '../../familia/react';
import { fechaCorta, fechaLargaDeClave, sumarDias } from '@core/fechas';
import { balanceVirtudes, DETALLE_VIRTUD, NOMBRE_VIRTUD, VIRTUDES } from '@core/habitos';
import { examenCompleto, examenVacio, LIMITE_RESPUESTA, PREGUNTAS_EXAMEN, type Examen as TipoExamen } from '@core/rutina';
import { guardarExamen, uidActual, useDatos, useHabitosActivos, useHoy } from '@/app/datos';
import { useAvisos } from '@/ui/avisos';

export function Examen() {
  const hoy = useHoy();
  const examenes = useDatos((s) => s.examenes);
  const [dia, setDia] = useState(hoy);
  const actual = examenes.get(dia) ?? examenVacio(dia, uidActual());
  const historial = [...examenes.values()].filter(examenCompleto).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  return (
    <div className="entra">
      <CabeceraPagina etiqueta="Al anochecer" titulo="Examen" linea="“Cuando se apaga la luz, examino todo mi día.” — Séneca" />

      <div className="cols c64" style={{ marginTop: 24 }}>
        <div className="panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Grupo n={1} className="sep-grupo sin-arriba flex-1">{dia === hoy ? 'Hoy' : 'Día anterior'} · {fechaLargaDeClave(dia)}</Grupo>
            {dia !== hoy && (
              <button type="button" className="link" onClick={() => setDia(hoy)}>
                Volver a hoy
              </button>
            )}
          </div>
          <Formulario key={dia} examen={actual} />
        </div>
        <div className="pila">
          <Balance hoy={hoy} />
          <div className="panel">
            <Grupo n={2} className="sep-grupo sin-arriba">Exámenes anteriores</Grupo>
            {historial.filter((e) => e.fecha !== dia).length === 0 && <p className="vacio-mini">Acá vas a poder releer tus exámenes.</p>}
            {historial
              .filter((e) => e.fecha !== dia)
              .slice(0, 12)
              .map((e) => (
                <button key={e.fecha} type="button" className="srow" onClick={() => setDia(e.fecha)}>
                  <span className="cap gold" style={{ fontSize: 11, width: 64 }}>
                    {fechaCorta(e.fecha)}
                  </span>
                  <span className="mu dos-lineas" style={{ flex: 1, fontWeight: 500, minWidth: 0 }}>
                    {e.respuestas.p1 || e.respuestas.p2 || e.respuestas.p3}
                  </span>
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Formulario({ examen }: { examen: TipoExamen }) {
  const [e, setE] = useState(examen);
  const mostrar = useAvisos((s) => s.mostrar);
  const sucio = useRef(false);
  const temporizador = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!sucio.current) setE(examen);
  }, [examen]);

  const guardar = async (x: TipoExamen, aviso = false) => {
    sucio.current = false;
    await guardarExamen({ fecha: x.fecha, respuestas: x.respuestas, libre: x.libre });
    if (aviso) mostrar('Examen guardado.');
  };
  const cambiar = (x: TipoExamen) => {
    sucio.current = true;
    setE(x);
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => guardar(x), 1500);
  };
  useEffect(() => () => clearTimeout(temporizador.current), []);

  return (
    <div>
      {PREGUNTAS_EXAMEN.map((p, i) => (
        <div key={p.id} style={{ marginTop: i ? 20 : 4 }}>
          <label className="serif" htmlFor={`ex-${p.id}`} style={{ display: 'block', fontSize: 18, marginBottom: 8 }}>
            {p.texto}
          </label>
          <textarea id={`ex-${p.id}`} className="ta" maxLength={LIMITE_RESPUESTA} value={e.respuestas[p.id]} onChange={(ev) => cambiar({ ...e, respuestas: { ...e.respuestas, [p.id]: ev.target.value } })} />
        </div>
      ))}
      <label className="fl" htmlFor="ex-libre" style={{ marginTop: 20 }}>
        Algo más (opcional)
      </label>
      <textarea id="ex-libre" className="ta" maxLength={LIMITE_RESPUESTA} value={e.libre} onChange={(ev) => cambiar({ ...e, libre: ev.target.value })} />
      <button type="button" className="btn" style={{ marginTop: 16 }} onClick={() => (clearTimeout(temporizador.current), guardar(e, true))}>
        Guardar examen
      </button>
      <p className="mu" style={{ fontSize: 13.5, fontWeight: 500, marginTop: 10 }}>
        Se guarda solo mientras escribís. Es privado: nadie más lo ve, ni el admin ni tus grupos.
      </p>
    </div>
  );
}

function Balance({ hoy }: { hoy: string }) {
  const habitos = useHabitosActivos();
  const registros = useDatos((s) => s.registros);
  const [dias, setDias] = useState(7);
  const b = useMemo(() => balanceVirtudes(habitos, registros, sumarDias(hoy, -(dias - 1)), hoy), [habitos, registros, hoy, dias]);
  return (
    <div className="panel">
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Grupo n={3} className="sep-grupo sin-arriba">Balance de virtudes</Grupo>
      </div>
      <div className="seg3" role="radiogroup" aria-label="Período" style={{ marginBottom: 8 }}>
        {[7, 30].map((d) => (
          <button key={d} type="button" role="radio" aria-checked={dias === d} className={dias === d ? 'on' : ''} onClick={() => setDias(d)}>
            {d} días
          </button>
        ))}
      </div>
      {VIRTUDES.map((v) => (
        <div key={v} className={`v-${v}`} style={{ padding: '10px 0', borderBottom: '1px solid var(--ln2)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <strong className="vt" style={{ flex: 1 }}>
              {NOMBRE_VIRTUD[v]}
            </strong>
            <span className="num" style={{ fontSize: 18 }}>
              {b[v] === null ? '—' : `${b[v]}%`}
            </span>
          </div>
          <div className="barra-prog" style={{ marginTop: 6 }}>
            <i style={{ width: `${b[v] ?? 0}%`, background: 'var(--vc)' }} />
          </div>
          <div className="mu2" style={{ fontSize: 12.5, fontWeight: 500, marginTop: 4 }}>
            {b[v] === null ? 'Ningún hábito cultiva esta virtud todavía.' : DETALLE_VIRTUD[v]}
          </div>
        </div>
      ))}
    </div>
  );
}
