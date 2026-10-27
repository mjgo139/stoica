import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fechaCorta, fechaLargaDeClave, MOMENTOS, sumarDias } from '@core/fechas';
import { type Momento } from '@core/habitos';
import { avanceProyecto, tareaDelDia, tareaHecha, tareaVencida, validarProyecto, validarTarea, type Proyecto, type Tarea } from '@core/rutina';
import { LIMITES_ABUSO } from '@core/limites';
import { limpiarNombre } from '@core/validaciones';
import { alternarTarea, borrarTarea, guardarProyecto, guardarTarea, useDatos, useHoy } from '@/app/datos';
import { Hoja } from '@/ui/Hoja';
import { Horas } from '@/ui/Horas';
import { Icono } from '@/ui/Iconos';
import { useAvisos } from '@/ui/avisos';
import type { ConId } from '@/data/tipos';

type Cuando = 'hoy' | 'manana' | 'fecha' | 'sin';

/** Fila de una tarea: se toca el texto para editar y el rombo para marcar. */
export function FilaTarea({ t, dia, hoy, alEditar, conProyecto = true }: { t: ConId<Tarea>; dia: string; hoy: string; alEditar: () => void; conProyecto?: boolean }) {
  const hechas = useDatos((s) => s.tareasHechas);
  const proyectos = useDatos((s) => s.proyectos);
  const hecha = tareaHecha(t, dia, hechas);
  const proyecto = conProyecto && t.proyectoId ? proyectos.find((p) => p.id === t.proyectoId) : undefined;
  const cuando = t.repetir === 'diaria' ? 'Todos los días' : t.fecha ? fechaCorta(t.fecha) : 'Sin fecha';
  return (
    <div className={`item ${hecha ? 'is-done tachada' : ''}`} data-tarea={t.titulo}>
      <button type="button" className="item-main" onClick={alEditar}>
        <span style={{ minWidth: 0 }}>
          <span className="nm">{t.titulo}</span>
          <span className="sub mu2">
            {cuando}
            {t.hora ? ` · ${t.hora}` : ` · ${MOMENTOS[t.momento].split(' · ')[1]}`}
            {proyecto && (
              <span className="gold">
                {' · '}
                {proyecto.nombre}
              </span>
            )}
          </span>
        </span>
      </button>
      {t.dependeDeTi && (
        <button type="button" className={`dia ${hecha ? 'ok' : tareaVencida(t, hecha, hoy) ? 'mal' : ''}`} aria-pressed={hecha} aria-label={`${hecha ? 'Desmarcar' : 'Marcar'} ${t.titulo}`} onClick={() => alternarTarea(t, dia)}>
          <span>
            <svg width="14" height="14" viewBox="0 0 24 24">
              <path d="M5 12l4 4 10-10" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}

export function Tareas() {
  const hoy = useHoy();
  const tareas = useDatos((s) => s.tareas);
  const hechas = useDatos((s) => s.tareasHechas);
  const proyectos = useDatos((s) => s.proyectos);
  const [editando, setEditando] = useState<ConId<Tarea> | 'nueva' | null>(null);
  const [nuevoProyecto, setNuevoProyecto] = useState(false);
  const [verTerminados, setVerTerminados] = useState(false);
  const [nuevaEnProyecto, setNuevaEnProyecto] = useState<string | null>(null);
  const navegar = useNavigate();

  const hecha = (t: Tarea, dia: string) => tareaHecha(t, dia, hechas);
  const deHoy = tareas.filter((t) => (t.repetir === 'diaria' ? tareaDelDia(t, hoy) : t.fecha === hoy));
  const vencidas = tareas.filter((t) => tareaVencida(t, hecha(t, t.fecha ?? hoy), hoy));
  const proximas = tareas.filter((t) => t.repetir === 'no' && t.fecha && t.fecha > hoy).sort((a, b) => (a.fecha! < b.fecha! ? -1 : 1));
  // Las tareas sin fecha de un proyecto viven en el proyecto (no se repiten acá).
  const sinFecha = tareas.filter((t) => t.repetir === 'no' && !t.fecha && !t.proyectoId && !(t.completada && t.completada < hoy));
  const noDependen = deHoy.filter((t) => !t.dependeDeTi);
  const dependen = deHoy.filter((t) => t.dependeDeTi).sort((a, b) => (a.hora ?? '').localeCompare(b.hora ?? '') || a.momento - b.momento);
  const activos = proyectos.filter((p) => !p.archivado);
  const terminados = proyectos.filter((p) => p.archivado);

  const fila = (t: ConId<Tarea>, dia: string) => <FilaTarea key={t.id} t={t} dia={dia} hoy={hoy} alEditar={() => setEditando(t)} />;

  const tarjetaProyecto = (p: ConId<Proyecto>) => <DesgloseProyecto key={p.id} p={p} hoy={hoy} alEditar={(t) => setEditando(t)} alAgregar={() => setNuevaEnProyecto(p.id)} />;

  return (
    <div className="entra">
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="cap gold">Lo que hay que hacer</div>
          <h1 className="titulo">Tareas</h1>
          <p className="lead">Ocupate de lo que depende de ti. Lo demás, soltalo.</p>
        </div>
        <div className="acciones-tareas">
          <Link to="/tareas/enfoque" className="btn btn-enfoque v-sabiduria" aria-label="Enfoque: temporizador para una tarea, un descanso o meditar">
            <Icono nombre="enfoque" tam={18} /> Enfoque
          </Link>
          <button type="button" className="btn" style={{ width: 'auto', padding: '0 24px' }} onClick={() => setEditando('nueva')}>
            <Icono nombre="mas" tam={16} /> Nueva tarea
          </button>
        </div>
      </div>

      <div className="cols c64" style={{ marginTop: 24 }}>
        <div className="pila">
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
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div className="grp cap" style={{ marginTop: 0, flex: 1 }}>
                <span>Proyectos</span>
              </div>
              <button type="button" className="link" onClick={() => setNuevoProyecto(true)}>
                + Nuevo
              </button>
            </div>
            {activos.length === 0 && <p className="vacio-mini">Un proyecto junta varias tareas con un mismo fin: “Mudanza”, “Tesis”, “Viaje”. Vas viendo cuánto falta.</p>}
            {activos.map(tarjetaProyecto)}
            {terminados.length > 0 && (
              <>
                <button type="button" className="link" style={{ paddingLeft: 0, marginTop: 8 }} onClick={() => setVerTerminados(!verTerminados)}>
                  {verTerminados ? 'Ocultar terminados' : `Ver terminados (${terminados.length})`}
                </button>
                {verTerminados && terminados.map(tarjetaProyecto)}
              </>
            )}
          </div>
        </div>
        <div className="pila">
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
                  <span
                    className="rombo"
                    style={{
                      width: 10,
                      height: 10,
                      borderColor: 'var(--mu3)',
                      margin: '0 6px',
                    }}
                  />
                  <span style={{ flex: 1, fontWeight: 600 }}>{t.titulo}</span>
                  <span className="cap mu2" style={{ fontSize: 10 }}>
                    Soltar
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <EditorTarea tarea={editando === 'nueva' ? null : editando} abierta={editando !== null} alCerrar={() => setEditando(null)} hoy={hoy} />
      <EditorTarea key={nuevaEnProyecto ?? 'ninguno'} tarea={null} abierta={nuevaEnProyecto !== null} alCerrar={() => setNuevaEnProyecto(null)} hoy={hoy} proyectoFijo={nuevaEnProyecto ?? undefined} />
      <EditorProyecto proyecto={null} abierto={nuevoProyecto} alCerrar={() => setNuevoProyecto(false)} alCrear={(id) => navegar(`/tareas/proyecto/${id}`)} />
    </div>
  );
}

/** Proyecto desplegado: avance, tareas pendientes (se marcan acá mismo) y las hechas a un toque. */
function DesgloseProyecto({ p, hoy, alEditar, alAgregar }: { p: ConId<Proyecto>; hoy: string; alEditar: (t: ConId<Tarea>) => void; alAgregar: () => void }) {
  const todas = useDatos((s) => s.tareas);
  const hechas = useDatos((s) => s.tareasHechas);
  const [abierto, setAbierto] = useState(!p.archivado);
  const [verHechas, setVerHechas] = useState(false);
  const tareas = todas.filter((t) => t.proyectoId === p.id);
  const diaDe = (t: Tarea) => (t.repetir === 'diaria' ? hoy : (t.fecha ?? hoy));
  const orden = (a: Tarea, b: Tarea) => (a.fecha ?? '9999').localeCompare(b.fecha ?? '9999') || a.creado - b.creado;
  const pendientes = tareas.filter((t) => !tareaHecha(t, diaDe(t), hechas)).sort(orden);
  const listas = tareas.filter((t) => tareaHecha(t, diaDe(t), hechas)).sort(orden);
  const a = avanceProyecto(tareas, hoy, hechas);
  const pct = a.total ? Math.round((a.hechas / a.total) * 100) : 0;
  const completo = a.total > 0 && a.hechas === a.total;
  return (
    <div className="desglose" data-proyecto={p.nombre}>
      <button type="button" className="desglose-cab" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <strong style={{ flex: 1, fontSize: 15.5, textAlign: 'left', color: 'var(--tx)' }}>
            {p.nombre}
          </strong>
          <span className="num mu2" style={{ fontSize: 13 }}>
            {a.hechas}/{a.total}
          </span>
          <span className={`flecha ${abierto ? 'abierta' : ''}`} aria-hidden="true">
            ›
          </span>
        </span>
        <span className="barra-prog" style={{ display: 'block', marginTop: 8 }}>
          <i
            style={{
              width: `${pct}%`,
              background: completo ? 'var(--ok)' : 'var(--gold)',
            }}
          />
        </span>
        <span
          className="mu2"
          style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 600,
            marginTop: 6,
            textAlign: 'left',
            color: p.fechaLimite && p.fechaLimite < hoy && !completo ? 'var(--miss)' : undefined,
          }}
        >
          {a.total === 0 ? 'Sin tareas todavía' : completo ? 'Todo hecho' : `${pct}% · faltan ${a.total - a.hechas}`}
          {p.fechaLimite ? ` · hasta el ${fechaCorta(p.fechaLimite)}` : ''}
        </span>
      </button>
      {abierto && (
        <div className="desglose-cuerpo">
          {pendientes.map((t) => (
            <FilaTarea key={t.id} t={t} dia={diaDe(t)} hoy={hoy} alEditar={() => alEditar(t)} conProyecto={false} />
          ))}
          {pendientes.length === 0 && a.total > 0 && <p className="vacio-mini">No quedan tareas pendientes.</p>}
          {verHechas && listas.map((t) => <FilaTarea key={t.id} t={t} dia={diaDe(t)} hoy={hoy} alEditar={() => alEditar(t)} conProyecto={false} />)}
          <div className="desglose-pie">
            {!p.archivado && (
              <button type="button" className="link" onClick={alAgregar}>
                + Tarea
              </button>
            )}
            {listas.length > 0 && (
              <button type="button" className="link" onClick={() => setVerHechas(!verHechas)}>
                {verHechas ? 'Ocultar hechas' : `Ver hechas (${listas.length})`}
              </button>
            )}
            <Link to={`/tareas/proyecto/${p.id}`} className="link" style={{ marginLeft: 'auto' }}>
              Abrir proyecto ›
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/** Crear o editar una tarea. `proyectoFijo`: la tarea se crea dentro de ese proyecto (y empieza sin fecha). */
export function EditorTarea({ tarea, abierta, alCerrar, hoy, proyectoFijo }: { tarea: ConId<Tarea> | null; abierta: boolean; alCerrar: () => void; hoy: string; proyectoFijo?: string }) {
  const proyectos = useDatos((s) => s.proyectos);
  const total = useDatos((s) => s.tareas.length);
  const [titulo, setTitulo] = useState('');
  const [depende, setDepende] = useState(true);
  const [momento, setMomento] = useState<Momento>(1);
  const [cuando, setCuando] = useState<Cuando>('hoy');
  const [fecha, setFecha] = useState(hoy);
  const [diaria, setDiaria] = useState(false);
  const [proyectoId, setProyectoId] = useState('');
  const [horas, setHoras] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [abiertaAntes, setAbiertaAntes] = useState(false);

  if (abierta && !abiertaAntes) {
    setAbiertaAntes(true);
    setTitulo(tarea?.titulo ?? '');
    setDepende(tarea?.dependeDeTi ?? true);
    setMomento(tarea?.momento ?? 1);
    setDiaria(tarea?.repetir === 'diaria');
    const f = tarea ? (tarea.fecha ?? null) : proyectoFijo ? null : hoy;
    setCuando(f === null ? 'sin' : f === hoy ? 'hoy' : f === sumarDias(hoy, 1) ? 'manana' : 'fecha');
    setFecha(f ?? hoy);
    setProyectoId(tarea?.proyectoId ?? proyectoFijo ?? '');
    setHoras(tarea?.hora ? [tarea.hora] : []);
    setError('');
  }
  if (!abierta && abiertaAntes) setAbiertaAntes(false);

  const sinFecha = cuando === 'sin' && !diaria;

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!tarea && total >= LIMITES_ABUSO.tareasMax) return setError(`Podés tener hasta ${LIMITES_ABUSO.tareasMax} tareas.`);
    const f = cuando === 'hoy' ? hoy : cuando === 'manana' ? sumarDias(hoy, 1) : cuando === 'fecha' ? fecha : null;
    const t = {
      id: tarea?.id,
      creado: tarea?.creado,
      titulo: limpiarNombre(titulo),
      dependeDeTi: depende,
      momento,
      fecha: diaria ? (f ?? hoy) : f,
      repetir: diaria ? ('diaria' as const) : ('no' as const),
      proyectoId: proyectoId || null,
      hora: sinFecha ? null : horas[0] || null,
      completada: tarea?.completada,
    };
    const err = validarTarea(t);
    if (err) return setError(err);
    await guardarTarea(t);
    alCerrar();
  };

  const activos = proyectos.filter((p) => !p.archivado || p.id === proyectoId);

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
        <label className="casilla" style={{ marginTop: 12 }}>
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

        {depende && (
          <>
            <div className="lbl cap">Aviso</div>
            {sinFecha ? (
              <p className="mu" style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>
                Para avisarte a una hora, elegí un día o repetila todos los días.
              </p>
            ) : (
              <Horas idBase="t-hora" etiqueta="Hora del aviso" max={1} valores={horas} alCambiar={setHoras} />
            )}
          </>
        )}

        {(activos.length > 0 || proyectoFijo) && (
          <>
            <label className="lbl cap" htmlFor="t-proyecto">
              Proyecto
            </label>
            <select id="t-proyecto" className="fi" value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
              <option value="">Ninguno</option>
              {activos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </>
        )}

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

/** Crear o editar un proyecto (nombre y fecha límite opcional). La virtud no aplica a proyectos: se guarda la que tenía. */
export function EditorProyecto({ proyecto, abierto, alCerrar, alCrear }: { proyecto: ConId<Proyecto> | null; abierto: boolean; alCerrar: () => void; alCrear?: (id: string) => void }) {
  const total = useDatos((s) => s.proyectos.length);
  const mostrar = useAvisos((s) => s.mostrar);
  const [nombre, setNombre] = useState('');
  const [conFecha, setConFecha] = useState(false);
  const [fecha, setFecha] = useState('');
  const [error, setError] = useState('');
  const [antes, setAntes] = useState(false);
  const hoy = useHoy();
  if (abierto && !antes) {
    setAntes(true);
    setNombre(proyecto?.nombre ?? '');
    setConFecha(!!proyecto?.fechaLimite);
    setFecha(proyecto?.fechaLimite ?? sumarDias(hoy, 14));
    setError('');
  }
  if (!abierto && antes) setAntes(false);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!proyecto && total >= LIMITES_ABUSO.proyectosMax) return setError(`Podés tener hasta ${LIMITES_ABUSO.proyectosMax} proyectos.`);
    const p = {
      id: proyecto?.id,
      creado: proyecto?.creado,
      archivado: proyecto?.archivado,
      nombre: limpiarNombre(nombre),
      virtud: proyecto?.virtud ?? ('sabiduria' as const),
      fechaLimite: conFecha ? fecha : null,
    };
    const err = validarProyecto(p);
    if (err) return setError(err);
    const id = await guardarProyecto(p);
    alCerrar();
    if (!proyecto) {
      mostrar('Proyecto creado. Agregale tareas.');
      alCrear?.(id);
    }
  };

  return (
    <Hoja titulo={proyecto ? 'Editar proyecto' : 'Nuevo proyecto'} abierta={abierto} alCerrar={alCerrar}>
      <form onSubmit={guardar} noValidate>
        <label className="lbl cap" htmlFor="p-nombre">
          Nombre del proyecto
        </label>
        <input id="p-nombre" className="inp" maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Por ejemplo: Mudanza" />
        <label className="casilla" style={{ marginTop: 14 }}>
          <input type="checkbox" checked={conFecha} onChange={(e) => setConFecha(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--gold)' }} />
          <span>Tiene fecha límite</span>
        </label>
        {conFecha && <input type="date" className="fi" value={fecha} min={proyecto?.fechaLimite && proyecto.fechaLimite < hoy ? proyecto.fechaLimite : hoy} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha límite" />}
        <div className="err" role="alert">
          {error}
        </div>
        <button className="btn" type="submit" style={{ marginTop: 8 }}>
          {proyecto ? 'Guardar' : 'Crear proyecto'}
        </button>
      </form>
    </Hoja>
  );
}
