import { useState } from 'react';
import { Grupo } from '../../familia/react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fechaCorta } from '@core/fechas';
import { avanceProyecto, tareaHecha, type Tarea } from '@core/rutina';
import { archivarProyecto, borrarProyecto, useDatos, useHoy } from '@/app/datos';
import { Confirmar } from '@/ui/Hoja';
import { Icono } from '@/ui/Iconos';
import type { ConId } from '@/data/tipos';
import { EditorProyecto, EditorTarea, FilaTarea } from './Tareas';

/** Un proyecto: sus tareas, cuánto falta y la fecha límite. */
export function Proyecto() {
  const { id = '' } = useParams();
  const navegar = useNavigate();
  const hoy = useHoy();
  const listo = useDatos((s) => s.listo);
  const p = useDatos((s) => s.proyectos.find((x) => x.id === id));
  const todas = useDatos((s) => s.tareas);
  const hechas = useDatos((s) => s.tareasHechas);
  const [editando, setEditando] = useState<ConId<Tarea> | 'nueva' | null>(null);
  const [editandoProyecto, setEditandoProyecto] = useState(false);
  const [borrando, setBorrando] = useState(false);

  if (!p) {
    return listo ? (
      <div className="card vacio">
        <div className="serif" style={{ fontSize: 20 }}>
          Este proyecto no existe
        </div>
        <p>Puede que lo hayas borrado.</p>
        <Link to="/tareas" className="ghost" style={{ textDecoration: 'none' }}>
          Ver mis tareas
        </Link>
      </div>
    ) : null;
  }

  const tareas = todas.filter((t) => t.proyectoId === p.id);
  const diaDe = (t: Tarea) => (t.repetir === 'diaria' ? hoy : (t.fecha ?? hoy));
  const orden = (a: Tarea, b: Tarea) => (a.fecha ?? '9999').localeCompare(b.fecha ?? '9999') || a.creado - b.creado;
  const pendientes = tareas.filter((t) => !tareaHecha(t, diaDe(t), hechas)).sort(orden);
  const listas = tareas.filter((t) => tareaHecha(t, diaDe(t), hechas)).sort(orden);
  const a = avanceProyecto(tareas, hoy, hechas);
  const pct = a.total ? Math.round((a.hechas / a.total) * 100) : 0;
  const completo = a.total > 0 && a.hechas === a.total;
  const atrasado = !!p.fechaLimite && p.fechaLimite < hoy && !completo;

  return (
    <div className="entra" style={{ maxWidth: 760, marginInline: 'auto' }}>
      <Link to="/tareas" className="link" style={{ paddingLeft: 0, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
        <Icono nombre="atras" tam={18} /> Tareas
      </Link>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="cap gold">
            Proyecto
            {p.archivado && ' · Terminado'}
          </div>
          <h1 className="titulo">{p.nombre}</h1>
        </div>
        <button type="button" className="ghost" onClick={() => setEditandoProyecto(true)}>
          Editar
        </button>
        <button type="button" className="btn" style={{ width: 'auto', padding: '0 22px', height: 44 }} onClick={() => setEditando('nueva')}>
          <Icono nombre="mas" tam={16} /> Tarea
        </button>
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="num" style={{ fontSize: 28 }}>
            {pct}%
          </span>
          <span className="mu" style={{ flex: 1, fontWeight: 600 }}>
            {a.hechas} de {a.total} {a.total === 1 ? 'tarea' : 'tareas'}
          </span>
          {p.fechaLimite && (
            <span className="cap" style={{ fontSize: 11, color: atrasado ? 'var(--miss)' : 'var(--mu2)' }}>
              {atrasado ? 'Venció el ' : 'Hasta el '}
              {fechaCorta(p.fechaLimite)}
            </span>
          )}
        </div>
        <span className="barra-prog" style={{ display: 'block', marginTop: 10 }}>
          <i style={{ width: `${pct}%`, background: completo ? 'var(--verde)' : 'var(--gold)' }} />
        </span>
        {completo && !p.archivado && (
          <div className="franja info" style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap' }}>
            <span style={{ flex: 1, minWidth: 180 }}>Todo hecho. “Lo que depende de ti, hacelo bien.”</span>
            <button type="button" className="link" onClick={() => archivarProyecto(p, true)}>
              Marcar como terminado
            </button>
          </div>
        )}
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <Grupo n={1} className="sep-grupo sin-arriba">Pendientes</Grupo>
        {pendientes.length === 0 && <p className="vacio-mini">{tareas.length ? 'No queda nada pendiente.' : 'Todavía no hay tareas. Tocá “+ Tarea” para agregar la primera.'}</p>}
        {pendientes.map((t) => (
          <FilaTarea key={t.id} t={t} dia={diaDe(t)} hoy={hoy} conProyecto={false} alEditar={() => setEditando(t)} />
        ))}
        {listas.length > 0 && (
          <>
            <Grupo n={2} className="sep-grupo">Hechas</Grupo>
            {listas.map((t) => (
              <FilaTarea key={t.id} t={t} dia={diaDe(t)} hoy={hoy} conProyecto={false} alEditar={() => setEditando(t)} />
            ))}
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
        {p.archivado ? (
          <button type="button" className="ghost" onClick={() => archivarProyecto(p, false)}>
            Volver a abrir
          </button>
        ) : (
          !completo && (
            <button type="button" className="ghost" onClick={() => archivarProyecto(p, true)}>
              Marcar como terminado
            </button>
          )
        )}
        <button type="button" className="ghost peligro" onClick={() => setBorrando(true)}>
          Borrar proyecto
        </button>
      </div>

      <EditorTarea tarea={editando === 'nueva' ? null : editando} abierta={editando !== null} alCerrar={() => setEditando(null)} hoy={hoy} proyectoFijo={p.id} />
      <EditorProyecto proyecto={p} abierto={editandoProyecto} alCerrar={() => setEditandoProyecto(false)} />
      <Confirmar
        abierto={borrando}
        titulo="¿Borrar el proyecto?"
        texto={tareas.length ? `También se borran sus ${tareas.length} ${tareas.length === 1 ? 'tarea' : 'tareas'}. No se puede deshacer.` : 'No se puede deshacer.'}
        accion="Borrar"
        peligro
        alCerrar={() => setBorrando(false)}
        alConfirmar={async () => {
          setBorrando(false);
          await borrarProyecto(p);
          navegar('/tareas', { replace: true });
        }}
      />
    </div>
  );
}
