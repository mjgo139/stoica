import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { estadoDesafio, finDesafio, REACCIONES, validarDesafio, type Desafio, type Miembro, type Progreso, type Reaccion, type TipoReaccion } from '@core/comunidad';
import { fechaCorta } from '@core/fechas';
import { cumplido, habitoParaDesafio, LIMITES_HABITO, NOMBRE_VIRTUD, validarHabito, VIRTUDES, type Habito, type Virtud } from '@core/habitos';
import { inicial } from '@core/perfil';
import { aRomano } from '@core/romanos';
import { limpiarNombre } from '@core/validaciones';
import { borrarDesafio, crearDesafio, elegirCompartidos, eliminarGrupo, reaccionar, salirDeGrupo, sumarmeADesafio, useComunidad } from '@/app/comunidad';
import { alternarSiNo, guardarHabito, registrosDe, sumar, uidActual, useDatos, useHabitosActivos, useHoy } from '@/app/datos';
import { HojaMedir } from '@/screens/habitos/HojaMedir';
import { useConsulta } from '@/data/hooks';
import type { ConId } from '@/data/tipos';
import { Confirmar, Hoja } from '@/ui/Hoja';
import { IconoHabito } from '@/ui/IconoHabito';
import { Icono } from '@/ui/Iconos';
import { useAvisos } from '@/ui/avisos';

export function Grupo() {
  const { id = '' } = useParams();
  const navegar = useNavigate();
  const hoy = useHoy();
  const uid = uidActual();
  const estado = useComunidad((s) => s.grupos.get(id));
  const listo = useComunidad((s) => s.listo);
  const mostrar = useAvisos((s) => s.mostrar);
  const { datos: miembros } = useConsulta<Miembro>(estado ? { ruta: `groups/${id}/members` } : null);
  const { datos: reacciones } = useConsulta<Reaccion>(estado ? { ruta: `groups/${id}/reactions`, filtros: [['dia', '==', hoy]] } : null);
  const [hoja, setHoja] = useState<'compartir' | 'desafio' | null>(null);
  const [saliendo, setSaliendo] = useState(false);

  if (!estado) {
    return listo ? (
      <div className="card vacio">
        <div className="serif" style={{ fontSize: 22 }}>
          No estás en este grupo
        </div>
        <p>Puede que hayas salido o que el grupo se haya eliminado.</p>
        <Link to="/comunidad" className="ghost" style={{ textDecoration: 'none' }}>
          Ver mis grupos
        </Link>
      </div>
    ) : null;
  }
  const { grupo, yo, desafios } = estado;
  const enlace = `${location.origin}/unirse/${grupo.codigo}`;
  const compartir = async () => {
    const texto = `Sumate a mi grupo "${grupo.nombre}" en Stoica. Código: ${grupo.codigo}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Stoica', text: texto, url: enlace });
      else {
        await navigator.clipboard.writeText(`${texto}\n${enlace}`);
        mostrar('Invitación copiada.');
      }
    } catch {
      /* cancelado */
    }
  };
  const ordenados = [...miembros].sort((a, b) => (a.id === uid ? -1 : b.id === uid ? 1 : a.nombre.localeCompare(b.nombre)));
  const sinResumen = grupo.miembros.filter((m) => !miembros.some((x) => x.id === m)).length;

  return (
    <div className="entra">
      <Link to="/comunidad" className="link" style={{ paddingLeft: 0, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
        <Icono nombre="atras" tam={18} /> Grupos
      </Link>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="cap gold">
            Grupo privado · {grupo.miembros.length}/{20}
          </div>
          <h1 className="titulo">{grupo.nombre}</h1>
        </div>
        <button type="button" className="ghost" onClick={() => setHoja('compartir')}>
          Qué comparto
        </button>
        <button type="button" className="btn" style={{ width: 'auto', padding: '0 22px', height: 44 }} onClick={compartir}>
          Invitar
        </button>
      </div>

      <div className="cols c64" style={{ marginTop: 24 }}>
        <div className="panel">
          <div className="grp cap" style={{ marginTop: 0 }}>
            <span>Integrantes · hoy</span>
          </div>
          {ordenados.map((m) => (
            <TarjetaMiembro key={m.id} m={m} esYo={m.id === uid} grupoId={id} reacciones={reacciones} hoy={hoy} />
          ))}
          {sinResumen > 0 && (
            <p className="vacio-mini">
              {sinResumen} {sinResumen === 1 ? 'integrante todavía no compartió' : 'integrantes todavía no compartieron'} hábitos.
            </p>
          )}
          {!yo && (
            <div className="franja info" style={{ marginTop: 14 }}>
              Todavía no compartís nada. Tocá “Qué comparto” para elegir tus hábitos: solo se ve si lo cumpliste hoy, la racha y el %.
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
          <div className="panel">
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div className="grp cap" style={{ marginTop: 0, flex: 1 }}>
                <span>Desafíos</span>
              </div>
              <button type="button" className="link" onClick={() => setHoja('desafio')}>
                + Nuevo
              </button>
            </div>
            {desafios.length === 0 && <p className="vacio-mini">Proponé un desafío con duración y meta: por ejemplo, 21 días meditando.</p>}
            {[...desafios]
              .sort((a, b) => (a.inicio < b.inicio ? 1 : -1))
              .map((d) => (
                <TarjetaDesafio key={d.id} d={d} grupoId={id} hoy={hoy} />
              ))}
          </div>
          <div className="panel">
            <div className="grp cap" style={{ marginTop: 0 }}>
              <span>Invitación</span>
            </div>
            <div className="num" style={{ fontSize: 28, letterSpacing: '.18em' }}>
              {grupo.codigo}
            </div>
            <p className="mu" style={{ fontSize: 13, fontWeight: 500, marginTop: 6 }}>
              Compartí este código o el enlace. Quien lo tenga puede entrar mientras haya lugar.
            </p>
            <button type="button" className="ghost peligro" style={{ marginTop: 14 }} onClick={() => setSaliendo(true)}>
              {grupo.creador === uid ? 'Eliminar o salir' : 'Salir del grupo'}
            </button>
          </div>
        </div>
      </div>

      <HojaCompartir abierta={hoja === 'compartir'} alCerrar={() => setHoja(null)} grupoId={id} actuales={yo?.compartidos.map((c) => c.habitId) ?? []} />
      <HojaDesafio abierta={hoja === 'desafio'} alCerrar={() => setHoja(null)} grupoId={id} hoy={hoy} />
      <Confirmar
        abierto={saliendo}
        titulo={grupo.creador === uid ? 'Eliminar el grupo' : '¿Salir del grupo?'}
        texto={grupo.creador === uid ? 'Como creador podés eliminar el grupo para todos. Si solo querés salir, el grupo queda a cargo de otra persona.' : 'Dejás de ver el grupo y los demás dejan de ver lo que compartías.'}
        accion={grupo.creador === uid ? 'Eliminar para todos' : 'Salir'}
        peligro
        alCerrar={() => setSaliendo(false)}
        alConfirmar={async () => {
          setSaliendo(false);
          if (grupo.creador === uid) await eliminarGrupo(id);
          else await salirDeGrupo(id);
          navegar('/comunidad', { replace: true });
        }}
      />
    </div>
  );
}

function TarjetaMiembro({ m, esYo, grupoId, reacciones, hoy }: { m: ConId<Miembro>; esYo: boolean; grupoId: string; reacciones: Array<ConId<Reaccion>>; hoy: string }) {
  const uid = uidActual();
  const recibidas = reacciones.filter((r) => r.para === m.id);
  const mia = recibidas.find((r) => r.de === uid);
  const actualizado = m.fecha === hoy;
  const conteo = REACCIONES.map((x) => ({ ...x, n: recibidas.filter((r) => r.tipo === x.id).length })).filter((x) => x.n > 0);
  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid var(--ln2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="avatar" style={{ width: 38, height: 38, fontSize: 16 }}>
          {inicial(m.nombre)}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="nm">
            {m.nombre}
            {esYo && <span className="mu2"> · vos</span>}
          </span>
          {conteo.length > 0 && (
            <span className="mu" style={{ fontSize: 13, fontWeight: 600 }}>
              {conteo.map((c) => `${c.simbolo} ${c.n}`).join('  ')}
            </span>
          )}
        </span>
      </div>
      {m.compartidos.length === 0 && <p className="vacio-mini" style={{ padding: '8px 0 0' }}>No comparte hábitos.</p>}
      {m.compartidos.map((c) => (
        <div key={c.habitId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0 0 50px' }}>
          <IconoHabito icono={c.icono} virtud={c.virtud} tam={30} />
          <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14.5 }}>{c.nombre}</span>
          <span className="num gold" style={{ fontSize: 15 }} title={`Racha de ${c.racha} días`}>
            {aRomano(c.racha)}
          </span>
          <span className="mu2" style={{ fontSize: 12, fontWeight: 700, width: 38, textAlign: 'right' }}>
            {c.porcentaje}%
          </span>
          {esYo ? (
            <MarcaMia habitId={c.habitId} nombre={c.nombre} hoy={hoy} resumenOk={actualizado && c.hoy} />
          ) : (
            <span className={`dia ${actualizado && c.hoy ? 'ok' : ''}`} style={{ margin: 0, width: 32, height: 32 }} aria-label={actualizado && c.hoy ? 'Cumplido hoy' : 'Pendiente hoy'}>
              <span style={{ width: 16, height: 16 }}>
                <svg width="11" height="11" viewBox="0 0 24 24">
                  <path d="M5 12l4 4 10-10" />
                </svg>
              </span>
            </span>
          )}
        </div>
      ))}
      {!esYo && (
        <div className="chips" style={{ padding: '10px 0 0 50px', gap: 6 }} role="group" aria-label={`Reaccionar a ${m.nombre}`}>
          {REACCIONES.map((x) => (
            <button key={x.id} type="button" className={`chip ${mia?.tipo === x.id ? 'on' : ''}`} style={{ minHeight: 32, padding: '0 10px' }} aria-pressed={mia?.tipo === x.id} title={x.texto} aria-label={x.texto} onClick={() => reaccionar(grupoId, m.id, mia?.tipo === x.id ? null : (x.id as TipoReaccion))}>
              {x.simbolo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Tu propio hábito compartido: se puede marcar desde el grupo (igual que en Hoy). */
function MarcaMia({ habitId, nombre, hoy, resumenOk }: { habitId: string; nombre: string; hoy: string; resumenOk: boolean }) {
  const h = useHabitosActivos().find((x) => x.id === habitId);
  const registros = useDatos((s) => s.registros);
  const [midiendo, setMidiendo] = useState(false);
  const [rebote, setRebote] = useState(0);
  const r = h ? registrosDe(registros, h.id).get(hoy) : undefined;
  const ok = h ? cumplido(h, r) : resumenOk;
  const tocar = () => {
    if (!h) return;
    setRebote((n) => n + 1);
    if (h.tipo === 'sino') alternarSiNo(h, hoy);
    else if (h.tipo === 'cantidad') sumar(h, hoy, 1);
    else setMidiendo(true);
  };
  const etiqueta = !h ? nombre : h.tipo === 'sino' ? `${ok ? 'Desmarcar' : 'Marcar'} ${nombre}` : h.tipo === 'cantidad' ? (ok ? `${nombre}: cumplido` : `Sumar uno a ${nombre}`) : `Registrar ${nombre}`;
  return (
    <>
      {h?.tipo === 'cantidad' && (
        <span className="mu2 num" style={{ fontSize: 13 }}>
          {r?.valor ?? 0}/{h.meta}
        </span>
      )}
      <button
        type="button"
        key={rebote}
        className={`dia ${ok ? 'ok' : ''} ${rebote ? 'rebote' : ''}`}
        style={{ margin: 0, width: 32, height: 32 }}
        disabled={!h || (h.tipo === 'cantidad' && ok)}
        aria-pressed={ok}
        aria-label={etiqueta}
        onClick={tocar}
      >
        <span style={{ width: 16, height: 16 }}>
          <svg width="11" height="11" viewBox="0 0 24 24">
            <path d="M5 12l4 4 10-10" />
          </svg>
        </span>
      </button>
      {h?.tipo === 'medicion' && <HojaMedir h={h} fecha={hoy} abierta={midiendo} alCerrar={() => setMidiendo(false)} />}
    </>
  );
}

function TarjetaDesafio({ d, grupoId, hoy }: { d: ConId<Desafio>; grupoId: string; hoy: string }) {
  const uid = uidActual();
  const habitos = useHabitosActivos();
  const progresos = useConsulta<Progreso>({ ruta: `groups/${grupoId}/challenges/${d.id}/progress` }).datos;
  const mio = progresos.find((p) => p.id === uid);
  const e = estadoDesafio(d, hoy);
  const [eligiendo, setEligiendo] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [creando, setCreando] = useState(false);
  const mostrar = useAvisos((s) => s.mostrar);
  const todos = useDatos((s) => s.habitos);
  const sugerido = useMemo(() => habitoParaDesafio(d.titulo, d.virtud), [d.titulo, d.virtud]);
  const igual = (a: string) => a.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const coincide = habitos.find((h) => igual(h.nombre) === igual(sugerido.nombre));
  const crearYSumarme = async () => {
    if (todos.length >= LIMITES_HABITO.habitosMax) return mostrar(`Podés tener hasta ${LIMITES_HABITO.habitosMax} hábitos.`);
    const nuevo = {
      ...sugerido,
      id: '',
      dias: [0, 1, 2, 3, 4, 5, 6],
      variables: sugerido.variables.map((v, i) => ({ ...v, id: igual(v.nombre).replace(/[^a-z]/g, '') || `v${i}`, inicial: NaN, meta: NaN })),
      recordatorio: null,
      inicio: hoy,
      archivado: false,
      orden: todos.length,
      racha: 0,
      mejorRacha: 0,
    };
    const err = validarHabito(nuevo);
    if (err) return mostrar(err);
    setCreando(true);
    try {
      const idNuevo = await guardarHabito(nuevo);
      const ahora = Date.now();
      await sumarmeADesafio(grupoId, d, idNuevo, { ...nuevo, id: idNuevo, recordatorioSlot: null, creado: ahora, actualizado: ahora, actualizadoPor: uid } as Habito);
      setEligiendo(false);
      mostrar(`Creamos “${nuevo.nombre}” y te sumaste al desafío.`);
    } finally {
      setCreando(false);
    }
  };
  const ranking = [...progresos].sort((a, b) => b.cumplidos - a.cumplidos);
  return (
    <div data-desafio={d.titulo} style={{ padding: '12px 0', borderBottom: '1px solid var(--ln2)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <strong className={`v-${d.virtud} vt`} style={{ flex: 1, fontSize: 16 }}>
          {d.titulo}
        </strong>
        <span className="cap mu2" style={{ fontSize: 10 }}>
          {e.estado === 'activo' ? `Día ${e.dia} de ${d.duracion}` : e.estado === 'proximo' ? `Empieza en ${e.quedan} días` : 'Terminado'}
        </span>
      </div>
      <div className="mu" style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>
        Meta: {d.meta} de {d.duracion} días · {fechaCorta(d.inicio)} al {fechaCorta(finDesafio(d))}
      </div>
      {ranking.map((p) => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <span style={{ width: 110, fontWeight: 600, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.id === uid ? 'Vos' : p.nombre}</span>
          <span className="barra-prog" style={{ flex: 1 }}>
            <i style={{ width: `${Math.min(100, (p.cumplidos / d.meta) * 100)}%`, background: p.cumplidos >= d.meta ? 'var(--ok)' : 'var(--gold)' }} />
          </span>
          <span className="num" style={{ fontSize: 14, width: 48, textAlign: 'right' }}>
            {p.cumplidos}/{d.meta}
          </span>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        {e.estado !== 'terminado' && (
          <button type="button" className="link" style={{ paddingLeft: 0 }} onClick={() => setEligiendo(true)}>
            {mio ? 'Cambiar mi hábito' : 'Sumarme'}
          </button>
        )}
        {d.creador === uid && (
          <button type="button" className="link" style={{ color: 'var(--cor)' }} onClick={() => setBorrando(true)}>
            Borrar
          </button>
        )}
      </div>
      <Hoja titulo="¿Con qué hábito participás?" abierta={eligiendo} alCerrar={() => setEligiendo(false)}>
        <p className="mu" style={{ fontWeight: 500, marginTop: 8 }}>
          Cuenta cada día que cumplas ese hábito dentro del desafío.
        </p>
        {!coincide && (
          <div className="franja info" style={{ display: 'block', marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <IconoHabito icono={sugerido.icono} virtud={sugerido.virtud} tam={34} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block' }}>¿No tenés un hábito para esto?</span>
                <span style={{ fontWeight: 500, fontSize: 13 }}>
                  Creamos “{sugerido.nombre}” ({NOMBRE_VIRTUD[sugerido.virtud]}, todos los días). Después lo podés editar.
                </span>
              </span>
            </div>
            <button type="button" className="btn" style={{ marginTop: 12, height: 44 }} disabled={creando} onClick={crearYSumarme}>
              {creando ? 'Creando…' : 'Crear el hábito y sumarme'}
            </button>
          </div>
        )}
        {habitos.length > 0 && (
          <div className="fl" style={{ marginTop: 18 }}>
            {coincide ? 'Elegí uno de tus hábitos' : 'O elegí uno que ya tenés'}
          </div>
        )}
        {[...habitos]
          .sort((a, b) => (a.id === coincide?.id ? -1 : b.id === coincide?.id ? 1 : 0))
          .map((h) => (
            <button key={h.id} type="button" className="srow" onClick={async () => (await sumarmeADesafio(grupoId, d, h.id), setEligiendo(false))}>
              <IconoHabito icono={h.icono} virtud={h.virtud} tam={34} />
              <span style={{ flex: 1, fontWeight: 600 }}>{h.nombre}</span>
              {mio?.habitId === h.id ? <span className="cap gold">Elegido</span> : h.id === coincide?.id && <span className="cap gold">Coincide</span>}
            </button>
          ))}
        {mio && (
          <button type="button" className="ghost peligro" style={{ width: '100%', marginTop: 14 }} onClick={async () => (await sumarmeADesafio(grupoId, d, null), setEligiendo(false))}>
            Dejar el desafío
          </button>
        )}
      </Hoja>
      <Confirmar abierto={borrando} titulo="¿Borrar el desafío?" texto="Se borra para todo el grupo." accion="Borrar" peligro alCerrar={() => setBorrando(false)} alConfirmar={() => (setBorrando(false), borrarDesafio(grupoId, d.id))} />
    </div>
  );
}

function HojaCompartir({ abierta, alCerrar, grupoId, actuales }: { abierta: boolean; alCerrar: () => void; grupoId: string; actuales: string[] }) {
  const habitos = useHabitosActivos();
  const [sel, setSel] = useState<string[]>(actuales);
  const [antes, setAntes] = useState(false);
  if (abierta && !antes) {
    setAntes(true);
    setSel(actuales);
  }
  if (!abierta && antes) setAntes(false);
  return (
    <Hoja titulo="Qué comparto en este grupo" abierta={abierta} alCerrar={alCerrar}>
      <p className="mu" style={{ fontWeight: 500, marginTop: 8 }}>
        De cada hábito se ve solo: si lo cumpliste hoy, tu racha y el % de los últimos 30 días. Nunca tus notas, tu examen ni los valores de tus mediciones.
      </p>
      {habitos.map((h) => (
        <label key={h.id} className="fila">
          <input type="checkbox" checked={sel.includes(h.id)} onChange={(e) => setSel(e.target.checked ? [...sel, h.id] : sel.filter((x) => x !== h.id))} style={{ width: 20, height: 20, accentColor: 'var(--gold)' }} />
          <IconoHabito icono={h.icono} virtud={h.virtud} tam={32} />
          <span style={{ flex: 1 }}>{h.nombre}</span>
        </label>
      ))}
      {habitos.length === 0 && <p className="vacio-mini">Todavía no tenés hábitos para compartir.</p>}
      <button type="button" className="btn" style={{ marginTop: 18 }} onClick={async () => (await elegirCompartidos(grupoId, sel.slice(0, 12)), alCerrar())}>
        Guardar
      </button>
    </Hoja>
  );
}

function HojaDesafio({ abierta, alCerrar, grupoId, hoy }: { abierta: boolean; alCerrar: () => void; grupoId: string; hoy: string }) {
  const [titulo, setTitulo] = useState('');
  const [virtud, setVirtud] = useState<Virtud>('templanza');
  const [duracion, setDuracion] = useState('21');
  const [meta, setMeta] = useState('18');
  const [error, setError] = useState('');
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const d = { titulo: limpiarNombre(titulo), virtud, duracion: Number(duracion), meta: Number(meta), inicio: hoy };
    const err = validarDesafio(d);
    if (err) return setError(err);
    await crearDesafio(grupoId, d);
    setTitulo('');
    alCerrar();
  };
  const sugeridos = useMemo(() => ['21 días meditando', '30 días sin azúcar', 'Una semana de ducha fría', '14 días leyendo'], []);
  return (
    <Hoja titulo="Nuevo desafío" abierta={abierta} alCerrar={alCerrar}>
      <form onSubmit={enviar} noValidate>
        <label className="lbl cap" htmlFor="d-titulo">
          Nombre
        </label>
        <input id="d-titulo" className="inp" maxLength={60} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="21 días meditando" />
        <div className="chips" style={{ marginTop: 10 }}>
          {sugeridos.map((s) => (
            <button key={s} type="button" className="chip" onClick={() => setTitulo(s)}>
              {s}
            </button>
          ))}
        </div>
        <div className="lbl cap">Virtud</div>
        <div className="chips">
          {VIRTUDES.map((v) => (
            <button key={v} type="button" aria-pressed={virtud === v} className={`chip v-${v} ${virtud === v ? 'on' : ''}`} style={virtud === v ? { background: 'var(--vc)', borderColor: 'var(--vc)' } : { color: 'var(--vc)' }} onClick={() => setVirtud(v)}>
              {NOMBRE_VIRTUD[v]}
            </button>
          ))}
        </div>
        <div className="g2" style={{ marginTop: 14 }}>
          <div>
            <label className="fl" htmlFor="d-dur">
              Duración (días)
            </label>
            <input id="d-dur" className="fi" inputMode="numeric" value={duracion} onChange={(e) => setDuracion(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div>
            <label className="fl" htmlFor="d-meta">
              Meta (días cumplidos)
            </label>
            <input id="d-meta" className="fi" inputMode="numeric" value={meta} onChange={(e) => setMeta(e.target.value.replace(/\D/g, ''))} />
          </div>
        </div>
        <p className="mu" style={{ fontSize: 13, fontWeight: 500, marginTop: 8 }}>
          Empieza hoy. Cada integrante elige con qué hábito participa.
        </p>
        <div className="err" role="alert">
          {error}
        </div>
        <button className="btn" type="submit" style={{ marginTop: 8 }}>
          Crear desafío
        </button>
      </form>
    </Hoja>
  );
}
