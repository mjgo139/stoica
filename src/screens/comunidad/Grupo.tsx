import { DIRECCION } from '@/ui/AvisoMudanza';
import { Grupo as TituloGrupo } from '../../../familia/react';
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { estadoDesafio, finDesafio, REACCIONES, semanaAlDia, validarDesafio, validarNombreGrupo, type Compartido, type Desafio, type Miembro, type Progreso, type Reaccion, type TipoReaccion } from '@core/comunidad';
import { fechaCorta, sumarDias } from '@core/fechas';
import { cumplido, formatoNumero, habitoParaDesafio, LIMITES_HABITO, NOMBRE_VIRTUD, validarHabito, VIRTUDES, type Habito, type Virtud } from '@core/habitos';
import { inicial } from '@core/perfil';
import { aRomano } from '@core/romanos';
import { limpiarNombre } from '@core/validaciones';
import { crearDesafio, editarDesafio, elegirCompartidos, eliminarGrupo, reaccionar, renombrarGrupo, salirDeGrupo, sumarmeADesafio, useComunidad } from '@/app/comunidad';
import { alternarSiNo, guardarHabito, registrosDe, sumar, uidActual, useDatos, useHabitosActivos, useHoy } from '@/app/datos';
import { HojaLista } from '@/screens/habitos/HojaLista';
import { HojaMedir } from '@/screens/habitos/HojaMedir';
import { esMetaGrande, HojaCantidad } from '@/screens/habitos/HojaCantidad';
import { useConsulta } from '@/data/hooks';
import type { ConId } from '@/data/tipos';
import { Confirmar, Hoja } from '@/ui/Hoja';
import { IconoHabito } from '@/ui/IconoHabito';
import { Icono } from '@/ui/Iconos';
import { useAvisos } from '@/ui/avisos';
import { SemanaMini } from '@/ui/SemanaMini';
import { diasConFoto, FotoDelHabito, FotosDeHoy, HojaFotosHabito, HojaSubirFoto, planVisible, useFotosSemana, type SubirFotos, type VerFotos } from './Muro';
import { PanelPlan, usePlan } from './Plan';
import { recordarGrupoWidget } from '@/nativo/widget';
import type { EstadoPlan, FotoHabito } from '@core/plan';

/** El jardín de otro miembro se carga recién cuando se abre. */
const JardinDeOtro = lazy(() => import('@/screens/jardin/JardinDeOtro'));

export function Grupo() {
  const { id = '' } = useParams();
  const navegar = useNavigate();
  const hoy = useHoy();
  const uid = uidActual();
  const estado = useComunidad((s) => s.grupos.get(id));
  const listo = useComunidad((s) => s.listo);
  const mostrar = useAvisos((s) => s.mostrar);
  const { datos: miembros, cargando: cargandoMiembros } = useConsulta<Miembro>(estado ? { ruta: `groups/${id}/members` } : null);
  // El widget de comunidad muestra lo último que viste acá (y después se actualiza solo).
  useEffect(() => {
    if (id && !cargandoMiembros && miembros.length) recordarGrupoWidget(id, miembros);
  }, [id, miembros, cargandoMiembros]);
  const { datos: reacciones } = useConsulta<Reaccion>(estado ? { ruta: `groups/${id}/reactions`, filtros: [['dia', '==', hoy]] } : null);
  const [hoja, setHoja] = useState<'compartir' | 'desafio' | null>(null);
  const [saliendo, setSaliendo] = useState(false);
  const [renombrando, setRenombrando] = useState(false);
  const plan = usePlan(estado?.grupo);
  const fotos = useFotosSemana(id, plan);
  // Si arriba están las fotos de hoy, son la sección I y las demás se corren uno
  const conFotos = planVisible(plan) && fotos.some((f) => f.dia === hoy) ? 1 : 0;
  const [verFotos, setVerFotos] = useState<VerFotos | null>(null);
  const [subirFotos, setSubirFotos] = useState<SubirFotos | null>(null);
  const celebrando = useDatos((s) => !!s.celebracion);
  const accionesFotos = useMemo(() => ({ alVer: setVerFotos, alSubir: setSubirFotos }), []);

  if (!estado) {
    return listo ? (
      <div className="card vacio">
        <div className="serif" style={{ fontSize: 20 }}>
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
  const enlace = `${DIRECCION}/unirse/${grupo.codigo}`;
  const compartir = async () => {
    const texto = `Sumate a mi grupo "${grupo.nombre}" en StoaHabit. Código: ${grupo.codigo}`;
    try {
      if (navigator.share) await navigator.share({ title: 'StoaHabit', text: texto, url: enlace });
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
          <h1 className="titulo" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {grupo.nombre}
            {grupo.creador === uid && (
              <button type="button" className="link" style={{ fontSize: 13.5 }} onClick={() => setRenombrando(true)}>
                Editar nombre
              </button>
            )}
          </h1>
        </div>
        <button type="button" className="ghost" onClick={() => setHoja('compartir')}>
          Qué comparto
        </button>
        <button type="button" className="btn" style={{ width: 'auto', padding: '0 22px', height: 44 }} onClick={compartir}>
          Invitar
        </button>
      </div>

      <AccionesFotos.Provider value={accionesFotos}>
      <div className="cols c64" style={{ marginTop: 24 }}>
        <div className="pila">
        {planVisible(plan) && <FotosDeHoy fotos={fotos} miembros={miembros} alVer={setVerFotos} />}
        <div className="panel">
          <TituloGrupo n={conFotos + 1} className="sep-grupo sin-arriba">Integrantes · hoy</TituloGrupo>
          {ordenados.map((m) => (
            <TarjetaMiembro key={m.id} m={m} esYo={m.id === uid} grupoId={id} reacciones={reacciones} hoy={hoy} plan={plan} fotos={fotos} />
          ))}
          {sinResumen > 0 && (
            <p className="vacio-mini">
              {sinResumen} {sinResumen === 1 ? 'integrante todavía no compartió' : 'integrantes todavía no compartieron'} hábitos.
            </p>
          )}
          {yo && plan.estado === 'activo' && yo.compartidos.length > 0 && (
            <p className="mu2" style={{ fontSize: 12.5, fontWeight: 600, marginTop: 10 }}>
              <Icono nombre="camara" tam={14} className="uic en-linea" /> Tocá la cámara de tu hábito para subir la foto de hoy, la hayas cumplido o no.
            </p>
          )}
          {!yo && (
            <div className="franja info" style={{ marginTop: 14 }}>
              Todavía no compartís nada. Tocá “Qué comparto” para elegir tus hábitos: solo se ve si lo cumpliste en la semana, la racha y el %.
            </div>
          )}
        </div>
        </div>
        <div className="pila">
          <div className="panel">
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <TituloGrupo n={conFotos + 2} className="sep-grupo sin-arriba">Desafíos</TituloGrupo>
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
            <TituloGrupo n={conFotos + 3} className="sep-grupo sin-arriba">Invitación</TituloGrupo>
            <div className="num" style={{ fontSize: 28, letterSpacing: '.18em' }}>
              {grupo.codigo}
            </div>
            <p className="mu" style={{ fontSize: 13.5, fontWeight: 500, marginTop: 6 }}>
              Compartí este código o el enlace. Quien lo tenga puede entrar mientras haya lugar.
            </p>
            <PanelPlan grupoId={id} plan={plan} />
            <TituloGrupo n={conFotos + 4} className="sep-grupo">Tu lugar en el grupo</TituloGrupo>
            <button type="button" className="ghost peligro" style={{ marginTop: 4 }} onClick={() => setSaliendo(true)}>
              {grupo.creador === uid ? 'Eliminar o salir' : 'Salir del grupo'}
            </button>
          </div>
        </div>
      </div>

      </AccionesFotos.Provider>
      <HojaFotosHabito gid={id} plan={plan} ver={verFotos} alCerrar={() => setVerFotos(null)} alSubir={setSubirFotos} />
      {/* Si al cumplir llegaste a un hito, primero se ve "Victoria sobre ti mismo" y después la oferta de foto. */}
      <HojaSubirFoto gid={id} subir={celebrando ? null : subirFotos} fotos={fotos} alCerrar={() => setSubirFotos(null)} />
      {estado && <HojaRenombrar abierta={renombrando} alCerrar={() => setRenombrando(false)} grupoId={id} actual={estado.grupo.nombre} />}
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

function TarjetaMiembro({ m, esYo, grupoId, reacciones, hoy, plan, fotos }: { m: ConId<Miembro>; esYo: boolean; grupoId: string; reacciones: Array<ConId<Reaccion>>; hoy: string; plan: EstadoPlan; fotos: Array<ConId<FotoHabito>> }) {
  const uid = uidActual();
  const recibidas = reacciones.filter((r) => r.para === m.id);
  const mia = recibidas.find((r) => r.de === uid);
  const actualizado = m.fecha === hoy;
  const conteo = REACCIONES.map((x) => ({ ...x, n: recibidas.filter((r) => r.tipo === x.id).length })).filter((x) => x.n > 0);
  const [verJardin, setVerJardin] = useState(false);
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
            <span className="mu" style={{ fontSize: 13.5, fontWeight: 600 }}>
              {conteo.map((c) => `${c.simbolo} ${c.n}`).join('  ')}
            </span>
          )}
        </span>
        {m.compartidos.length > 0 && (
          <button type="button" className="ghost" style={{ minHeight: 34, padding: '0 12px', fontSize: 13.5 }} onClick={() => setVerJardin(true)} aria-label={esYo ? 'Ver mi jardín como lo ve el grupo' : `Ver el jardín de ${m.nombre}`}>
            <Icono nombre="planta" tam={16} /> Jardín
          </button>
        )}
      </div>
      {verJardin && (
        <Suspense fallback={null}>
          <JardinDeOtro
            nombre={esYo ? `${m.nombre} (vos)` : m.nombre}
            compartidos={m.compartidos}
            jardin={m.jardin}
            fecha={m.fecha}
            hoy={hoy}
            alCerrar={() => setVerJardin(false)}
            laureles={recibidas.filter((r) => r.tipo === 'laurel').length}
            regalo={esYo ? undefined : { dado: mia?.tipo === 'laurel', alDar: () => void reaccionar(grupoId, m.id, 'laurel') }}
          />
        </Suspense>
      )}
      {m.compartidos.length === 0 && <p className="vacio-mini" style={{ padding: '8px 0 0' }}>No comparte hábitos.</p>}
      {m.compartidos.map((c) => (
        <FilaDelGrupo key={c.habitId} c={c} m={m} esYo={esYo} alDia={actualizado} hoy={hoy} grupoId={grupoId} plan={plan} fotos={fotos} />
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

/**
 * Fila de un hábito compartido, con la misma estructura para todos:
 * ícono · nombre, racha, % y semana · foto de hoy · rombo de hoy.
 */
export function FilaCompartida({ c, esYo, hoy, semana, etiquetaSemana, foto, marca, extra, conFoto, alTocarDia }: { c: Compartido; esYo: boolean; hoy: string; semana: Array<boolean | null>; etiquetaSemana: string; foto?: ReactNode; marca?: ReactNode; extra?: string; conFoto?: Set<string>; alTocarDia?: (dia: string) => void }) {
  return (
    <div className={`fila-compartida ${foto === undefined ? 'sin-foto' : ''}`} data-fila-habito={c.nombre}>
      <IconoHabito icono={c.icono} virtud={c.virtud} tam={32} />
      <div style={{ minWidth: 0 }}>
        {esYo ? (
          <Link to={`/habitos/${c.habitId}`} className="fc-nombre">
            {c.nombre}
            {'\u00a0'}
            <span className="gold">›</span>
          </Link>
        ) : (
          <span className="fc-nombre">{c.nombre}</span>
        )}
        <span className="fc-datos">
          <span>
            Racha <b className="num gold">{c.racha > 0 ? aRomano(c.racha) : '—'}</b>
          </span>
          <span>{c.porcentaje}% en 30 días</span>
          {extra && <span>{extra}</span>}
        </span>
        <div style={{ marginTop: 6 }}>
          <SemanaMini dias={semana} hoy={hoy} etiqueta={etiquetaSemana} conFoto={conFoto} alTocar={alTocarDia} />
        </div>
      </div>
      {foto !== undefined && <div className="fc-foto">{foto}</div>}
      {/* Solo marcás lo tuyo: en los demás, si cumplieron hoy se ve en el último rombo de la semana. */}
      <div className="fc-marca">{marca ?? null}</div>
    </div>
  );
}

/** En el grupo: la fila con la foto de hoy. Al cumplir tu hábito desde acá, te ofrece subir la foto. */
/** La pantalla del grupo abre una sola hoja de fotos (para ver o para subir). */
const AccionesFotos = createContext<{ alVer: (v: VerFotos) => void; alSubir: (s: SubirFotos) => void }>({ alVer: () => undefined, alSubir: () => undefined });

function FilaDelGrupo({ c, m, esYo, alDia, hoy, plan, fotos }: { c: Compartido; m: ConId<Miembro>; esYo: boolean; alDia: boolean; hoy: string; grupoId: string; plan: EstadoPlan; fotos: Array<ConId<FotoHabito>> }) {
  const { alVer, alSubir } = useContext(AccionesFotos);
  const [pedido, setPedido] = useState(0);
  const pedirFoto = useCallback(() => setPedido((n) => n + 1), []);
  const miSemana = useMiSemana(esYo ? c.habitId : '', hoy);
  const conteo = useConteoHoy(esYo ? c.habitId : '', hoy);
  return (
    <FilaCompartida
      c={c}
      esYo={esYo}
      hoy={hoy}
      semana={esYo && miSemana ? miSemana : semanaAlDia(c.semana, m.fecha, hoy)}
      etiquetaSemana={esYo ? `Tu semana de ${c.nombre}` : `${m.nombre}, ${c.nombre}`}
      extra={conteo}
      foto={planVisible(plan) ? <FotoDelHabito plan={plan} miembro={m} habitId={c.habitId} habito={c.nombre} esYo={esYo} fotos={fotos} pedido={pedido} alVer={alVer} alSubir={alSubir} /> : undefined}
      conFoto={planVisible(plan) ? diasConFoto(fotos, m.id, c.habitId) : undefined}
      alTocarDia={(dia) => alVer({ miembro: m, habitId: c.habitId, habito: c.nombre, esYo, dia })}
      marca={esYo ? <MarcaMia habitId={c.habitId} nombre={c.nombre} hoy={hoy} resumenOk={alDia && c.hoy} alCumplir={pedirFoto} /> : undefined}
    />
  );
}

/** Hoy en números (cantidad o lista): "3/8" o "2/3 ítems". */
export function useConteoHoy(habitId: string, hoy: string): string | undefined {
  const h = useHabitosActivos().find((x) => x.id === habitId);
  const r = useDatos((s) => (habitId ? registrosDe(s.registros, habitId).get(hoy) : undefined));
  if (!h) return undefined;
  if (h.tipo === 'cantidad') return `Hoy ${formatoNumero(r?.valor ?? 0)}/${formatoNumero(h.meta)}${h.unidad ? ` ${h.unidad}` : ''}`;
  if (h.tipo === 'lista') return `Hoy ${r?.valor ?? 0}/${h.variables.length}`;
  return undefined;
}

/** Tu semana de un hábito, calculada con tus datos (siempre al día). */
export function useMiSemana(habitId: string, hoy: string): boolean[] | null {
  const h = useHabitosActivos().find((x) => x.id === habitId);
  const registros = useDatos((s) => s.registros);
  if (!h) return null;
  const regs = registrosDe(registros, h.id);
  return [-6, -5, -4, -3, -2, -1, 0].map((o) => cumplido(h, regs.get(sumarDias(hoy, o))));
}

/** Tu propio hábito compartido: se puede marcar desde el grupo (igual que en Hoy). */

export function MarcaMia({ habitId, nombre, hoy, resumenOk, alCumplir }: { habitId: string; nombre: string; hoy: string; resumenOk: boolean; alCumplir?: () => void }) {
  const h = useHabitosActivos().find((x) => x.id === habitId);
  const registros = useDatos((s) => s.registros);
  const [midiendo, setMidiendo] = useState(false);
  const [rebote, setRebote] = useState(0);
  const r = h ? registrosDe(registros, h.id).get(hoy) : undefined;
  const ok = h ? cumplido(h, r) : resumenOk;
  // Si lo acabás de cumplir desde acá (no si ya venía cumplido), se ofrece subir la foto.
  const tocado = useRef(false);
  const antes = useRef(ok);
  useEffect(() => {
    if (ok && !antes.current && tocado.current) {
      tocado.current = false;
      setMidiendo(false);
      alCumplir?.();
    }
    antes.current = ok;
  }, [ok, alCumplir]);
  const tocar = () => {
    if (!h) return;
    tocado.current = true;
    setRebote((n) => n + 1);
    if (h.tipo === 'sino') alternarSiNo(h, hoy);
    else if (h.tipo === 'cantidad' && !esMetaGrande(h)) sumar(h, hoy, 1);
    else setMidiendo(true); // medición, lista o cantidad grande: se abre una hoja
  };
  const etiqueta = !h ? nombre : h.tipo === 'sino' ? `${ok ? 'Desmarcar' : 'Marcar'} ${nombre}` : h.tipo === 'cantidad' ? (esMetaGrande(h) ? `Registrar cantidad de ${nombre}` : ok ? `${nombre}: cumplido` : `Sumar uno a ${nombre}`) : h.tipo === 'lista' ? `Marcar ítems de ${nombre}` : `Registrar ${nombre}`;
  return (
    <>
      <button
        type="button"
        key={rebote}
        className={`dia ${ok ? 'ok' : ''} ${rebote ? 'rebote' : ''}`}
        style={{ margin: 0, width: 32, height: 32 }}
        disabled={!h || (h.tipo === 'cantidad' && ok && !esMetaGrande(h))}
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
      {h?.tipo === 'lista' && <HojaLista h={h} fecha={hoy} abierta={midiendo} alCerrar={() => setMidiendo(false)} />}
      {h && esMetaGrande(h) && <HojaCantidad h={h} fecha={hoy} abierta={midiendo} alCerrar={() => setMidiendo(false)} />}
    </>
  );
}

/** Tarjeta de un desafío en el grupo: toda la tarjeta abre su pantalla. */
export function TarjetaDesafio({ d, grupoId, hoy }: { d: ConId<Desafio>; grupoId: string; hoy: string }) {
  const uid = uidActual();
  const progresos = useConsulta<Progreso>({ ruta: `groups/${grupoId}/challenges/${d.id}/progress` }).datos;
  const mio = progresos.find((p) => p.id === uid);
  const e = estadoDesafio(d, hoy);
  const otros = [...progresos].filter((p) => p.id !== uid).sort((a, b) => b.cumplidos - a.cumplidos).slice(0, 2);
  const barra = (p: ConId<Progreso>, nombre: string) => (
    <span key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
      <span className="nombre-barra">{nombre}</span>
      <span className="barra-prog" style={{ flex: 1 }}>
        <i style={{ width: `${Math.min(100, (p.cumplidos / d.meta) * 100)}%`, background: p.cumplidos >= d.meta ? 'var(--verde)' : 'var(--gold)' }} />
      </span>
      <span className="num" style={{ fontSize: 13.5, width: 48, textAlign: 'right' }}>
        {p.cumplidos}/{d.meta}
      </span>
    </span>
  );
  return (
    <Link to={`/comunidad/${grupoId}/desafio/${d.id}`} className="tarjeta-desafio" data-desafio={d.titulo} aria-label={`Abrir desafío ${d.titulo}`}>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <strong className={`v-${d.virtud} vt`} style={{ flex: 1, fontSize: 16 }}>
          {d.titulo}
        </strong>
        <span className="cap mu2" style={{ fontSize: 11 }}>
          {e.estado === 'activo' ? `Día ${e.dia} de ${d.duracion}` : e.estado === 'proximo' ? `Empieza en ${e.quedan} días` : 'Terminado'}
        </span>
      </span>
      <span className="mu" style={{ display: 'block', fontSize: 13.5, fontWeight: 500, marginTop: 2 }}>
        Meta: {d.meta} de {d.duracion} días · {fechaCorta(d.inicio)} al {fechaCorta(finDesafio(d))}
      </span>
      {mio ? barra(mio, 'Vos') : <span className="mu2" style={{ display: 'block', fontSize: 13.5, fontWeight: 600, marginTop: 8 }}>Todavía no participás</span>}
      {otros.map((p) => barra(p, p.nombre))}
      <span style={{ display: 'flex', alignItems: 'center', marginTop: 10, gap: 8 }}>
        <span className="mu2" style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>
          {progresos.length} {progresos.length === 1 ? 'participa' : 'participan'}

        </span>
        <span className="gold" style={{ fontWeight: 700, fontSize: 13.5 }}>
          {mio ? 'Abrir' : e.estado === 'terminado' ? 'Ver' : 'Ver y sumarme'} ›
        </span>
      </span>
    </Link>
  );
}

/** Elegir con qué hábito participás (o crear uno sugerido y sumarte en un toque). */
export function HojaElegirHabito({ d, grupoId, abierta, alCerrar }: { d: ConId<Desafio>; grupoId: string; abierta: boolean; alCerrar: () => void }) {
  const uid = uidActual();
  const hoy = useHoy();
  const habitos = useHabitosActivos();
  const progresos = useConsulta<Progreso>(abierta ? { ruta: `groups/${grupoId}/challenges/${d.id}/progress` } : null).datos;
  const mio = progresos.find((p) => p.id === uid);
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
      alCerrar();
      mostrar(`Creamos “${nuevo.nombre}” y te sumaste al desafío.`);
    } finally {
      setCreando(false);
    }
  };
  return (
    <Hoja titulo="¿Con qué hábito participás?" abierta={abierta} alCerrar={alCerrar}>
      <p className="mu" style={{ fontWeight: 500, marginTop: 8 }}>
        Cuenta cada día que cumplas ese hábito dentro del desafío.
      </p>
      {!coincide && (
        <div className="franja info" style={{ display: 'block', marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <IconoHabito icono={sugerido.icono} virtud={sugerido.virtud} tam={34} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block' }}>¿No tenés un hábito para esto?</span>
              <span style={{ fontWeight: 500, fontSize: 13.5 }}>
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
          <button key={h.id} type="button" className="srow" onClick={async () => (await sumarmeADesafio(grupoId, d, h.id), alCerrar())}>
            <IconoHabito icono={h.icono} virtud={h.virtud} tam={34} />
            <span style={{ flex: 1, fontWeight: 600 }}>{h.nombre}</span>
            {mio?.habitId === h.id ? <span className="cap gold">Elegido</span> : h.id === coincide?.id && <span className="cap gold">Coincide</span>}
          </button>
        ))}
      {mio && (
        <button type="button" className="ghost peligro" style={{ width: '100%', marginTop: 14 }} onClick={async () => (await sumarmeADesafio(grupoId, d, null), alCerrar())}>
          Dejar el desafío
        </button>
      )}
    </Hoja>
  );
}

function HojaRenombrar({ abierta, alCerrar, grupoId, actual }: { abierta: boolean; alCerrar: () => void; grupoId: string; actual: string }) {
  const [nombre, setNombre] = useState(actual);
  const [error, setError] = useState('');
  const [antes, setAntes] = useState(false);
  if (abierta && !antes) {
    setAntes(true);
    setNombre(actual);
    setError('');
  }
  if (!abierta && antes) setAntes(false);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const err = validarNombreGrupo(nombre);
    if (err) return setError(err);
    const r = await renombrarGrupo(grupoId, nombre);
    if (r !== undefined) alCerrar();
  };
  return (
    <Hoja titulo="Nombre del grupo" abierta={abierta} alCerrar={alCerrar}>
      <form onSubmit={enviar} noValidate>
        <label className="lbl cap" htmlFor="g-nombre">
          Nombre
        </label>
        <input id="g-nombre" className="inp" maxLength={40} value={nombre} onChange={(e) => setNombre(e.target.value)} />
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
        De cada hábito se ve solo: si lo cumpliste en los últimos 7 días, tu racha y el % de los últimos 30 días. Nunca tus notas, tu examen ni los valores de tus mediciones.
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

export function HojaDesafio({ abierta, alCerrar, grupoId, hoy, existente }: { abierta: boolean; alCerrar: () => void; grupoId: string; hoy: string; existente?: ConId<Desafio> }) {
  const [titulo, setTitulo] = useState('');
  const [virtud, setVirtud] = useState<Virtud>('templanza');
  const [duracion, setDuracion] = useState('21');
  const [meta, setMeta] = useState('18');
  const [error, setError] = useState('');
  const [antes, setAntes] = useState(false);
  if (abierta && !antes) {
    setAntes(true);
    setError('');
    if (existente) {
      setTitulo(existente.titulo);
      setVirtud(existente.virtud);
      setDuracion(String(existente.duracion));
      setMeta(String(existente.meta));
    }
  }
  if (!abierta && antes) setAntes(false);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const d = { titulo: limpiarNombre(titulo), virtud, duracion: Number(duracion), meta: Number(meta), inicio: existente?.inicio ?? hoy };
    if (existente && d.duracion < existente.duracion) return setError(`La duración solo se puede alargar (ahora: ${existente.duracion} días).`);
    const err = validarDesafio(d);
    if (err) return setError(err);
    if (existente) await editarDesafio(grupoId, existente.id, { titulo: d.titulo, virtud: d.virtud, duracion: d.duracion, meta: d.meta });
    else await crearDesafio(grupoId, d);
    setTitulo('');
    alCerrar();
  };
  const sugeridos = useMemo(() => ['21 días meditando', '30 días sin azúcar', 'Una semana de ducha fría', '14 días leyendo'], []);
  return (
    <Hoja titulo={existente ? 'Editar desafío' : 'Nuevo desafío'} abierta={abierta} alCerrar={alCerrar}>
      <form onSubmit={enviar} noValidate>
        <label className="lbl cap" htmlFor="d-titulo">
          Nombre
        </label>
        <input id="d-titulo" className="inp" maxLength={60} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="21 días meditando" />
        {!existente && (
        <div className="chips" style={{ marginTop: 10 }}>
          {sugeridos.map((s) => (
            <button key={s} type="button" className="chip" onClick={() => setTitulo(s)}>
              {s}
            </button>
          ))}
        </div>
        )}
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
        <p className="mu" style={{ fontSize: 13.5, fontWeight: 500, marginTop: 8 }}>
          {existente ? 'La fecha de inicio no cambia y la duración solo se puede alargar, para no romper el conteo de quienes participan.' : 'Empieza hoy. Cada integrante elige con qué hábito participa.'}
        </p>
        <div className="err" role="alert">
          {error}
        </div>
        <button className="btn" type="submit" style={{ marginTop: 8 }}>
          {existente ? 'Guardar cambios' : 'Crear desafío'}
        </button>
      </form>
    </Hoja>
  );
}
