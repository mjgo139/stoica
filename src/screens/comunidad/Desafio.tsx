import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { estadoDesafio, finDesafio, type Progreso } from '@core/comunidad';
import { fechaCorta } from '@core/fechas';
import { NOMBRE_VIRTUD } from '@core/habitos';
import { inicial } from '@core/perfil';
import { MENSAJE_MAX, type EstadoPlan, type Publicacion } from '@core/plan';
import { useComunidad } from '@/app/comunidad';
import { uidActual, useHoy } from '@/app/datos';
import { borrarPublicacion, enviarMensaje, reportarPublicacion, subirFoto } from '@/app/plan';
import { useConsulta } from '@/data/hooks';
import type { ConId } from '@/data/tipos';
import { Confirmar, Hoja } from '@/ui/Hoja';
import { Icono } from '@/ui/Iconos';
import { useAvisos } from '@/ui/avisos';
import { TarjetaDesafio } from './Grupo';
import { AvisoBorrado, HojaCodigo, usePlan } from './Plan';

const hora = (ms: number) => new Date(ms).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });

/** Pantalla de un desafío: ranking, fotos del día y chat (si el grupo tiene el plan). */
export function Desafio() {
  const { id: gid = '', cid = '' } = useParams();
  const navegar = useNavigate();
  const hoy = useHoy();
  const estado = useComunidad((s) => s.grupos.get(gid));
  const listo = useComunidad((s) => s.listo);
  const plan = usePlan(estado?.grupo);
  const d = estado?.desafios.find((x) => x.id === cid);

  if (!estado || !d) {
    return listo ? (
      <div className="card vacio">
        <div className="serif" style={{ fontSize: 22 }}>
          Este desafío ya no está
        </div>
        <p>Puede que lo hayan borrado o que ya no estés en el grupo.</p>
        <Link to={estado ? `/comunidad/${gid}` : '/comunidad'} className="ghost" style={{ textDecoration: 'none' }}>
          Volver
        </Link>
      </div>
    ) : null;
  }
  const e = estadoDesafio(d, hoy);
  return (
    <div className="entra" style={{ maxWidth: 820, marginInline: 'auto' }}>
      <Link to={`/comunidad/${gid}`} className="link" style={{ paddingLeft: 0, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
        <Icono nombre="atras" tam={18} /> {estado.grupo.nombre}
      </Link>
      <div className={`cap v-${d.virtud} vt`}>
        Desafío · {NOMBRE_VIRTUD[d.virtud]} · {e.estado === 'activo' ? `Día ${e.dia} de ${d.duracion}` : e.estado === 'proximo' ? `Empieza en ${e.quedan} días` : 'Terminado'}
      </div>
      <h1 className="titulo">{d.titulo}</h1>
      <p className="mu" style={{ fontWeight: 500, marginTop: 4 }}>
        Meta: {d.meta} de {d.duracion} días · {fechaCorta(d.inicio)} al {fechaCorta(finDesafio(d))}
      </p>

      <div className="cols c64" style={{ marginTop: 20 }}>
        <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
          <Muro gid={gid} cid={cid} plan={plan} />
        </div>
        <div className="panel" style={{ alignSelf: 'start' }}>
          <TarjetaDesafio d={d} grupoId={gid} hoy={hoy} completo alBorrar={() => navegar(`/comunidad/${gid}`, { replace: true })} />
        </div>
      </div>
    </div>
  );
}

/** Fotos y chat. Se leen del servidor solo mientras esta pantalla está abierta. */
function Muro({ gid, cid, plan }: { gid: string; cid: string; plan: EstadoPlan }) {
  const uid = uidActual();
  const [codigo, setCodigo] = useState(false);
  const visible = plan.estado === 'activo' || plan.estado === 'gracia';
  const progresos = useConsulta<Progreso>({ ruta: `groups/${gid}/challenges/${cid}/progress` }).datos;
  const participa = progresos.some((p) => p.id === uid);
  const { datos: pubs } = useConsulta<Publicacion>(visible ? { ruta: `groups/${gid}/challenges/${cid}/posts`, orden: ['creado', 'desc'], limite: 150 } : null);

  if (!visible) {
    return (
      <div className="panel" data-muro="bloqueado">
        <div className="grp cap" style={{ marginTop: 0 }}>
          <span>Fotos y chat</span>
        </div>
        <p className="mu" style={{ fontSize: 13.5, fontWeight: 500, margin: 0 }}>
          {plan.estado === 'borrado'
            ? 'El plan del grupo venció y las fotos y mensajes se borraron. Activalo de nuevo para seguir compartiendo.'
            : 'Con el plan del grupo, cada desafío tiene la foto del día de cada uno y un chat corto para darse ánimo.'}
        </p>
        <button type="button" className="btn" style={{ marginTop: 12, height: 44 }} onClick={() => setCodigo(true)}>
          Activar con un código
        </button>
        <HojaCodigo grupoId={gid} abierta={codigo} alCerrar={() => setCodigo(false)} />
      </div>
    );
  }

  const activo = plan.estado === 'activo';
  const fotos = pubs.filter((p) => p.tipo === 'foto');
  const mensajes = [...pubs].reverse();
  return (
    <>
      {plan.estado === 'gracia' && (
        <div>
          <AvisoBorrado plan={plan} />
          <button type="button" className="link" style={{ paddingLeft: 0, marginTop: 6 }} onClick={() => setCodigo(true)}>
            Renovar con un código
          </button>
          <HojaCodigo grupoId={gid} abierta={codigo} alCerrar={() => setCodigo(false)} />
        </div>
      )}
      <Fotos gid={gid} cid={cid} fotos={fotos} puedeSubir={activo && participa} participa={participa} />
      <Chat gid={gid} cid={cid} mensajes={mensajes} puedeEscribir={activo && participa} participa={participa} />
    </>
  );
}

function Fotos({ gid, cid, fotos, puedeSubir, participa }: { gid: string; cid: string; fotos: Array<ConId<Publicacion>>; puedeSubir: boolean; participa: boolean }) {
  const hoy = useHoy();
  const uid = uidActual();
  const mostrar = useAvisos((s) => s.mostrar);
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [viendo, setViendo] = useState<ConId<Publicacion> | null>(null);
  const [leyenda, setLeyenda] = useState('');
  const [elegida, setElegida] = useState<File | null>(null);
  const mia = fotos.find((f) => f.de === uid && f.dia === hoy);
  const vista = useMemo(() => (elegida ? URL.createObjectURL(elegida) : ''), [elegida]);
  useEffect(() => () => (vista ? URL.revokeObjectURL(vista) : undefined), [vista]);

  const subir = async () => {
    if (!elegida) return;
    setSubiendo(true);
    const err = await subirFoto(gid, cid, elegida, leyenda);
    setSubiendo(false);
    if (err) return mostrar(err);
    setElegida(null);
    setLeyenda('');
    mostrar('Foto del día compartida.');
  };

  return (
    <div className="panel" data-muro="fotos">
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div className="grp cap" style={{ marginTop: 0, flex: 1 }}>
          <span>Fotos del día</span>
        </div>
        {puedeSubir && (
          <button type="button" className="link" onClick={() => entrada.current?.click()}>
            {mia ? 'Cambiar mi foto de hoy' : '+ Foto de hoy'}
          </button>
        )}
      </div>
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        hidden
        aria-label="Elegir foto"
        onChange={(e) => {
          setElegida(e.target.files?.[0] ?? null);
          e.target.value = '';
        }}
      />
      {fotos.length === 0 && <p className="vacio-mini">{puedeSubir ? 'Todavía no hay fotos. Cuando cumplas, subí la tuya: es opcional.' : participa ? 'Todavía no hay fotos.' : 'Todavía no hay fotos. Sumate al desafío para compartir la tuya.'}</p>}
      {fotos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 }}>
          {fotos.map((f) => (
            <button key={f.id} type="button" onClick={() => setViendo(f)} aria-label={`Foto de ${f.nombre}, ${fechaCorta(f.dia)}`} style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', background: 'var(--ln)' }}>
              <img src={f.miniUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <span style={{ position: 'absolute', left: 6, bottom: 6, background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 8 }}>{f.de === uid ? 'Vos' : f.nombre.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      )}

      <Hoja titulo="Foto de hoy" abierta={!!elegida} alCerrar={() => setElegida(null)}>
        {vista && <img src={vista} alt="Vista previa" style={{ width: '100%', maxHeight: 340, objectFit: 'contain', borderRadius: 12, marginTop: 8, background: 'var(--ln)' }} />}
        <label className="lbl cap" htmlFor="leyenda">
          Comentario (opcional)
        </label>
        <input id="leyenda" className="inp" maxLength={MENSAJE_MAX} value={leyenda} onChange={(e) => setLeyenda(e.target.value)} placeholder="Día cumplido" />
        <p className="mu" style={{ fontSize: 12.5, fontWeight: 500 }}>
          La ven solo los integrantes del grupo. Se achica antes de subirla y se le quita la ubicación.
        </p>
        <button type="button" className="btn" disabled={subiendo} onClick={subir}>
          {subiendo ? 'Subiendo…' : 'Compartir'}
        </button>
      </Hoja>
      <VerFoto gid={gid} cid={cid} foto={viendo} alCerrar={() => setViendo(null)} />
    </div>
  );
}

function VerFoto({ gid, cid, foto, alCerrar }: { gid: string; cid: string; foto: ConId<Publicacion> | null; alCerrar: () => void }) {
  const uid = uidActual();
  return (
    <Hoja titulo={foto ? `${foto.de === uid ? 'Tu foto' : foto.nombre} · ${fechaCorta(foto.dia)}` : ''} abierta={!!foto} alCerrar={alCerrar}>
      {foto && (
        <>
          <img src={foto.fotoUrl} alt={foto.texto || `Foto de ${foto.nombre}`} style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: 12, marginTop: 8, background: 'var(--ln)' }} />
          {foto.texto && <p style={{ fontWeight: 600, marginTop: 10 }}>{foto.texto}</p>}
          <AccionesPublicacion gid={gid} cid={cid} p={foto} alTerminar={alCerrar} />
        </>
      )}
    </Hoja>
  );
}

function Chat({ gid, cid, mensajes, puedeEscribir, participa }: { gid: string; cid: string; mensajes: Array<ConId<Publicacion>>; puedeEscribir: boolean; participa: boolean }) {
  const uid = uidActual();
  const mostrar = useAvisos((s) => s.mostrar);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [elegido, setElegido] = useState<ConId<Publicacion> | null>(null);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    const err = await enviarMensaje(gid, cid, texto);
    setEnviando(false);
    if (err) return mostrar(err);
    setTexto('');
  };
  return (
    <div className="panel" data-muro="chat">
      <div className="grp cap" style={{ marginTop: 0 }}>
        <span>Chat del desafío</span>
      </div>
      {mensajes.length === 0 && <p className="vacio-mini">Nadie escribió todavía. Un “¡vamos!” ayuda más de lo que parece.</p>}
      <div style={{ display: 'grid', gap: 10 }} aria-live="polite">
        {mensajes.map((m) => {
          const mio = m.de === uid;
          return (
            <button key={m.id} type="button" className="srow" style={{ alignItems: 'flex-start', borderBottom: 0, padding: 0 }} onClick={() => setElegido(m)} aria-label={`Mensaje de ${mio ? 'vos' : m.nombre}: opciones`}>
              <span className="avatar" style={{ width: 30, height: 30, fontSize: 13, flex: 'none' }}>
                {inicial(m.nombre)}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <b style={{ fontSize: 13.5 }}>{mio ? 'Vos' : m.nombre}</b>
                  <span className="mu2" style={{ fontSize: 11.5, fontWeight: 600 }}>
                    {fechaCorta(m.dia)} · {hora(m.creado)}
                  </span>
                </span>
                {m.tipo === 'foto' && (
                  <span className="mu2" style={{ display: 'block', fontSize: 12.5, fontWeight: 600 }}>
                    📷 Subió la foto del día
                  </span>
                )}
                {m.texto && <span style={{ display: 'block', fontSize: 14.5, fontWeight: 500, overflowWrap: 'anywhere' }}>{m.texto}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {puedeEscribir ? (
        <form onSubmit={enviar} style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <input className="fi" aria-label="Mensaje" maxLength={MENSAJE_MAX} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribí algo corto…" style={{ flex: 1 }} />
          <button type="submit" className="btn" style={{ width: 'auto', padding: '0 18px', height: 46 }} disabled={enviando || !texto.trim()}>
            Enviar
          </button>
        </form>
      ) : (
        <p className="vacio-mini" style={{ marginTop: 10 }}>
          {participa ? 'El plan venció: se puede leer, pero no escribir.' : 'Sumate al desafío para escribir.'}
        </p>
      )}
      <Hoja titulo="Mensaje" abierta={!!elegido} alCerrar={() => setElegido(null)}>
        {elegido && (
          <>
            <p style={{ fontWeight: 500, marginTop: 8, overflowWrap: 'anywhere' }}>{elegido.texto || '📷 Foto del día'}</p>
            <AccionesPublicacion gid={gid} cid={cid} p={elegido} alTerminar={() => setElegido(null)} />
          </>
        )}
      </Hoja>
    </div>
  );
}

/** Borrar lo propio o reportar lo ajeno (el admin ve solo lo reportado). */
function AccionesPublicacion({ gid, cid, p, alTerminar }: { gid: string; cid: string; p: ConId<Publicacion>; alTerminar: () => void }) {
  const uid = uidActual();
  const mostrar = useAvisos((s) => s.mostrar);
  const [confirmando, setConfirmando] = useState(false);
  if (p.de === uid) {
    return (
      <>
        <button type="button" className="ghost peligro" style={{ width: '100%', marginTop: 12 }} onClick={() => setConfirmando(true)}>
          Borrar
        </button>
        <Confirmar
          abierto={confirmando}
          titulo="¿Borrar?"
          texto="Se borra para todo el grupo."
          accion="Borrar"
          peligro
          alCerrar={() => setConfirmando(false)}
          alConfirmar={async () => {
            setConfirmando(false);
            const err = await borrarPublicacion(gid, cid, p.id);
            mostrar(err ?? 'Borrado.');
            alTerminar();
          }}
        />
      </>
    );
  }
  return (
    <>
      <button type="button" className="ghost" style={{ width: '100%', marginTop: 12 }} onClick={() => setConfirmando(true)}>
        Reportar
      </button>
      <Confirmar
        abierto={confirmando}
        titulo="¿Reportar?"
        texto="Le llega al administrador de Stoica para revisarlo. Quien lo publicó no sabe que lo reportaste."
        accion="Reportar"
        alCerrar={() => setConfirmando(false)}
        alConfirmar={async () => {
          setConfirmando(false);
          const err = await reportarPublicacion(gid, cid, p.id, '');
          mostrar(err ?? 'Gracias. Lo vamos a revisar.');
          alTerminar();
        }}
      />
    </>
  );
}
