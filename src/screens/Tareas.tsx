import { useState, type FormEvent } from 'react';
import { fechaCorta, fechaLargaDeClave, MOMENTOS, sumarDias } from '@core/fechas';
import type { Momento } from '@core/habitos';
import { idTareaHecha, tareaDelDia, tareaVencida, validarTarea, type Tarea } from '@core/rutina';
import { limpiarNombre } from '@core/validaciones';
import { alternarTarea, borrarTarea, guardarTarea, useDatos, useHoy } from '@/app/datos';
import { Hoja } from '@/ui/Hoja';
import { Icono } from '@/ui/Iconos';
import type { ConId } from '@/data/tipos';

type Cuando = 'hoy' | 'manana' | 'fecha' | 'sin';

export function Tareas() {
  const hoy = useHoy();
  const tareas = useDatos((s) => s.tareas);
  const hechas = useDatos((s) => s.tareasHechas);
  const [editando, setEditando] = useState<ConId<Tarea> | 'nueva' | null>(null);

  const estaHecha = (t: Tarea, dia: string) => hechas.has(idTareaHecha(t.id, t.repetir === 'diaria' ? dia : t.fecha ?? dia));
  const deHoy = tareas.filter((t) => (t.repetir === 'diaria' ? tareaDelDia(t, hoy) : t.fecha === hoy));
  const vencidas = tareas.filter((t) => tareaVencida(t, estaHecha(t, t.fecha ?? hoy), hoy));
  const proximas = tareas.filter((t) => t.repetir === 'no' && t.fecha && t.fecha > hoy).sort((a, b) => (a.fecha! < b.fecha! ? -1 : 1));
  const sinFecha = tareas.filter((t) => t.repetir === 'no' && !t.fecha);
  const noDependen = deHoy.filter((t) => !t.dependeDeTi);
  const dependen = deHoy.filter((t) => t.dependeDeTi).sort((a, b) => a.momento - b.momento);

  const fila = (t: ConId<Tarea>, dia: string) => {
    const hecha = estaHecha(t, dia);
    const fechaMarca = t.repetir === 'diaria' ? dia : t.fecha ?? dia;
    return (
      <div key={t.id} className={`item ${hecha ? 'is-done tachada' : ''}`}>
        <button type="button" className="item-main" onClick={() => setEditando(t)}>
          <span style={{ minWidth: 0 }}>
            <span className="nm">{t.titulo}</span>
            <span className="sub mu2">
              {t.repetir === 'diaria' ? 'Todos los días' : t.fecha ? fechaCorta(t.fecha) : 'Sin fecha'} · {MOMENTOS[t.momento].split(' · ')[1]}
            </span>
          </span>
        </button>
        {t.dependeDeTi && (
          <button type="button" className={`dia ${hecha ? 'ok' : tareaVencida(t, hecha, hoy) ? 'mal' : ''}`} aria-pressed={hecha} aria-label={`${hecha ? 'Desmarcar' : 'Marcar'} ${t.titulo}`} onClick={() => alternarTarea(t, fechaMarca)}>
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24">
                <path d="M5 12l4 4 10-10" />
              </svg>
            </span>
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="entra">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="cap gold">Lo que hay que hacer</div>
          <h1 className="titulo">Tareas</h1>
          <p className="lead">Ocupate de lo que depende de ti. Lo demás, soltalo.</p>
        </div>
        <button type="button" className="btn" style={{ width: 'auto', padding: '0 24px' }} onClick={() => setEditando('nueva')}>
          <Icono nombre="mas" tam={16} /> Nueva tarea
        </button>
      </div>

      <div className="cols c64" style={{ marginTop: 24 }}>
        <div className="panel">
          <div className="grp cap" style={{ marginTop: 0 }}>
            <span>Hoy · {fechaLargaDeClave(hoy)}</span>
          </div>
          {dependen.length === 0 && <p className="vacio-mini">Nada pendiente para hoy que dependa de vos.</p>}
          {dependen.map((t) => fila(t, hoy))}
          {vencidas.length > 0 && (
            <>
              <div className="grp cap" style={{ color: 'var(--miss)' }}>
                <span>Atrasadas</span>
              </div>
              {vencidas.map((t) => fila(t, t.fecha!))}
            </>
          )}
          {proximas.length > 0 && (
            <>
              <div className="grp cap">
                <span>Próximas</span>
              </div>
              {proximas.map((t) => fila(t, t.fecha!))}
            </>
          )}
          {sinFecha.length > 0 && (
            <>
              <div className="grp cap">
                <span>Sin fecha</span>
              </div>
              {sinFecha.map((t) => fila(t, hoy))}
            </>
          )}
        </div>
        <div className="panel">
          <div className="grp cap" style={{ marginTop: 0 }}>
            <span>No depende de ti</span>
          </div>
          <p className="quote" style={{ fontSize: 16 }}>
            “Hay cosas que dependen de nosotros y otras que no.” — Epicteto
          </p>
          {noDependen.length === 0 ? (
            <p className="vacio-mini">Cuando anotes algo que no depende de vos, aparece acá para recordarte que no te corresponde cargarlo.</p>
          ) : (
            noDependen.map((t) => (
              <button key={t.id} type="button" className="srow" onClick={() => setEditando(t)}>
                <span className="rombo" style={{ width: 10, height: 10, borderColor: 'var(--mu3)', margin: '0 6px' }} />
                <span style={{ flex: 1, fontWeight: 600 }}>{t.titulo}</span>
                <span className="cap mu2" style={{ fontSize: 10 }}>
                  Soltar
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      <EditorTarea tarea={editando === 'nueva' ? null : editando} abierta={editando !== null} alCerrar={() => setEditando(null)} hoy={hoy} />
    </div>
  );
}

function EditorTarea({ tarea, abierta, alCerrar, hoy }: { tarea: ConId<Tarea> | null; abierta: boolean; alCerrar: () => void; hoy: string }) {
  const [titulo, setTitulo] = useState('');
  const [depende, setDepende] = useState(true);
  const [momento, setMomento] = useState<Momento>(1);
  const [cuando, setCuando] = useState<Cuando>('hoy');
  const [fecha, setFecha] = useState(hoy);
  const [diaria, setDiaria] = useState(false);
  const [error, setError] = useState('');
  const [abiertaAntes, setAbiertaAntes] = useState(false);

  if (abierta && !abiertaAntes) {
    setAbiertaAntes(true);
    setTitulo(tarea?.titulo ?? '');
    setDepende(tarea?.dependeDeTi ?? true);
    setMomento(tarea?.momento ?? 1);
    setDiaria(tarea?.repetir === 'diaria');
    const f = tarea?.fecha ?? null;
    setCuando(!tarea ? 'hoy' : f === null ? 'sin' : f === hoy ? 'hoy' : f === sumarDias(hoy, 1) ? 'manana' : 'fecha');
    setFecha(f ?? hoy);
    setError('');
  }
  if (!abierta && abiertaAntes) setAbiertaAntes(false);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    const f = cuando === 'hoy' ? hoy : cuando === 'manana' ? sumarDias(hoy, 1) : cuando === 'fecha' ? fecha : null;
    const t = { id: tarea?.id, creado: tarea?.creado, titulo: limpiarNombre(titulo), dependeDeTi: depende, momento, fecha: diaria ? f ?? hoy : f, repetir: diaria ? ('diaria' as const) : ('no' as const) };
    const err = validarTarea(t);
    if (err) return setError(err);
    await guardarTarea(t);
    alCerrar();
  };

  return (
    <Hoja titulo={tarea ? 'Editar tarea' : 'Nueva tarea'} abierta={abierta} alCerrar={alCerrar}>
      <form onSubmit={guardar} noValidate>
        <label className="lbl cap" htmlFor="t-titulo">
          Tarea
        </label>
        <input id="t-titulo" className="inp" maxLength={120} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Qué hay que hacer" />

        <div className="lbl cap">¿Depende de ti?</div>
        <div className="seg3" role="radiogroup" aria-label="¿Depende de ti?">
          <button type="button" role="radio" aria-checked={depende} className={depende ? 'on' : ''} onClick={() => setDepende(true)}>
            Sí, depende de mí
          </button>
          <button type="button" role="radio" aria-checked={!depende} className={!depende ? 'on' : ''} onClick={() => setDepende(false)}>
            No depende de mí
          </button>
        </div>
        {!depende && (
          <p className="mu" style={{ fontSize: 13, fontWeight: 500, marginTop: 8 }}>
            La anotamos para que la sueltes: no se marca, solo se recuerda que no está en tus manos.
          </p>
        )}

        <div className="lbl cap">Cuándo</div>
        <div className="chips">
          {(
            [
              ['hoy', 'Hoy'],
              ['manana', 'Mañana'],
              ['fecha', 'Elegir fecha'],
              ['sin', 'Sin fecha'],
            ] as Array<[Cuando, string]>
          ).map(([c, n]) => (
            <button key={c} type="button" aria-pressed={cuando === c} className={`chip ${cuando === c ? 'on' : ''}`} onClick={() => setCuando(c)}>
              {n}
            </button>
          ))}
        </div>
        {cuando === 'fecha' && <input type="date" className="fi" style={{ marginTop: 10 }} value={fecha} min={hoy} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha" />}
        <label className="fila" style={{ marginTop: 6 }}>
          <input type="checkbox" checked={diaria} onChange={(e) => setDiaria(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--gold)' }} />
          <span>Repetir todos los días</span>
        </label>

        <div className="lbl cap">Momento</div>
        <div className="seg3" role="radiogroup" aria-label="Momento">
          {([0, 1, 2] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={momento === m} className={momento === m ? 'on' : ''} onClick={() => setMomento(m)}>
              {MOMENTOS[m].split(' · ')[1]}
            </button>
          ))}
        </div>

        <div className="err" role="alert">
          {error}
        </div>
        <button className="btn" type="submit" style={{ marginTop: 8 }}>
          {tarea ? 'Guardar' : 'Agregar tarea'}
        </button>
        {tarea && (
          <button
            type="button"
            className="ghost peligro"
            style={{ width: '100%', marginTop: 10 }}
            onClick={async () => {
              await borrarTarea(tarea);
              alCerrar();
            }}
          >
            Borrar tarea
          </button>
        )}
      </form>
    </Hoja>
  );
}
