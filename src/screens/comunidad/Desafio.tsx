import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { estadoDesafio, finDesafio, type Progreso } from '@core/comunidad';
import { fechaCorta } from '@core/fechas';
import { NOMBRE_VIRTUD } from '@core/habitos';
import { inicial } from '@core/perfil';
import { MENSAJE_MAX, type EstadoPlan, type Publicacion } from '@core/plan';
import { useComunidad } from '@/app/comunidad';
import { uidActual, useHoy } from '@/app/datos';
import { armarCollage, borrarPublicacion, enviarMensaje, reportarPublicacion, subirFoto } from '@/app/plan';
import { COLLAGE_MAX, disenosPara, type DisenoCollage } from '@core/collage';
import { useConsulta } from '@/data/hooks';
import type { ConId } from '@/data/tipos';
import { Confirmar, Hoja } from '@/ui/Hoja';
import { Icono } from '@/ui/Iconos';
import { useAvisos } from '@/ui/avisos';
import { HojaDesafio, HojaElegirHabito, MarcaMia, RankingDesafio } from './Grupo';
import { borrarDesafio } from '@/app/comunidad';
import { TarjetaHabito } from '../habitos/Lista';
import { registrosDe, useDatos } from '@/app/datos';
import type { Desafio as TipoDesafio } from '@core/comunidad';
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
  const uid = uidActual();
  const [editando, setEditando] = useState(false);
  const [borrando, setBorrando] = useState(false);

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
  // Edita quien creó el desafío o quien creó el grupo (para ordenar desafíos de otros).
  const puedeEditar = d.creador === uid || estado.grupo.creador === uid;
  return (
    <div className="entra" style={{ maxWidth: 820, marginInline: 'auto' }}>
      <Link to={`/comunidad/${gid}`} className="link" style={{ paddingLeft: 0, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
        <Icono nombre="atras" tam={18} /> {estado.grupo.nombre}
      </Link>
      <div className={`cap v-${d.virtud} vt`}>
        Desafío · {NOMBRE_VIRTUD[d.virtud]} · {e.estado === 'activo' ? `Día ${e.dia} de ${d.duracion}` : e.estado === 'proximo' ? `Empieza en ${e.quedan} días` : 'Terminado'}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 className="titulo">{d.titulo}</h1>
          <p className="mu" style={{ fontWeight: 500, marginTop: 4 }}>
            Meta: {d.meta} de {d.duracion} días · {fechaCorta(d.inicio)} al {fechaCorta(finDesafio(d))}
          </p>
        </div>
        {puedeEditar ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="ghost" onClick={() => setEditando(true)}>
              Editar
            </button>
            <button type="button" className="ghost peligro" onClick={() => setBorrando(true)}>
              Borrar
            </button>
          </div>
        ) : (
          <p className="mu2" style={{ fontSize: 12.5, fontWeight: 600, margin: 0 }}>
            Lo edita quien lo creó o quien creó el grupo.
          </p>
        )}
      </div>

      <div className="cols c64" style={{ marginTop: 20 }}>
        <div className="pila">
          <MiHabito d={d} gid={gid} hoy={hoy} terminado={e.estado === 'terminado'} />
          <Muro gid={gid} cid={cid} plan={plan} />
        </div>
        <div style={{ alignSelf: 'start' }}>
          <RankingDesafio d={d} grupoId={gid} />
        </div>
      </div>
      <HojaDesafio abierta={editando} alCerrar={() => setEditando(false)} grupoId={gid} hoy={d.inicio} existente={d} />
      <Confirmar
        abierto={borrando}
        titulo="¿Borrar el desafío?"
        texto="Se borra para todo el grupo, con el ranking, las fotos y los mensajes. Los hábitos de cada uno no se tocan."
        accion="Borrar"
        peligro
        alCerrar={() => setBorrando(false)}
        alConfirmar={() => {
          setBorrando(false);
          navegar(`/comunidad/${gid}`, { replace: true });
          void borrarDesafio(gid, d.id);
        }}
      />
    </div>
  );
}

/** Tu hábito en este desafío: la misma tarjeta de Hábitos, con el rombo para marcar hoy y el enlace al detalle. */
function MiHabito({ d, gid, hoy, terminado }: { d: ConId<TipoDesafio>; gid: string; hoy: string; terminado: boolean }) {
  const uid = uidActual();
  const progresos = useConsulta<Progreso>({ ruta: `groups/${gid}/challenges/${d.id}/progress` }).datos;
  const mio = progresos.find((p) => p.id === uid);
  const habitos = useDatos((s) => s.habitos);
  const registros = useDatos((s) => s.registros);
  const [eligiendo, setEligiendo] = useState(false);
  const h = mio ? habitos.find((x) => x.id === mio.habitId) : undefined;
  return (
    <div data-mi-habito>
      {h ? (
        <>
          <TarjetaHabito h={h} hoy={hoy} regs={registrosDe(registros, h.id)} accion={<MarcaMia habitId={h.id} nombre={h.nombre} hoy={hoy} resumenOk={false} />} />
          {!terminado && (
            <button type="button" className="link" style={{ paddingLeft: 0, marginTop: 6 }} onClick={() => setEligiendo(true)}>
              Cambiar el hábito con el que participo
            </button>
          )}
        </>
      ) : (
        <div className="panel">
          <div className="grp cap" style={{ marginTop: 0 }}>
            <span>Tu participación</span>
          </div>
          <p className="mu" style={{ fontSize: 13.5, fontWeight: 500, margin: 0 }}>
            {terminado ? 'Este desafío ya terminó.' : mio ? 'El hábito con el que participabas ya no está activo. Elegí otro.' : 'Sumate eligiendo uno de tus hábitos: cada día que lo cumplas cuenta para el desafío.'}
          </p>
          {!terminado && (
            <button type="button" className="btn" style={{ marginTop: 12, height: 44 }} onClick={() => setEligiendo(true)}>
              {mio ? 'Elegir hábito' : 'Sumarme'}
            </button>
          )}
        </div>
      )}
      <HojaElegirHabito d={d} grupoId={gid} abierta={eligiendo} alCerrar={() => setEligiendo(false)} />
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
  const galeria = useRef<HTMLInputElement>(null);
  const camara = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [viendo, setViendo] = useState<ConId<Publicacion> | null>(null);
  const [leyenda, setLeyenda] = useState('');
  const [abierta, setAbierta] = useState(false);
  const [elegidas, setElegidas] = useState<File[]>([]);
  const [diseno, setDiseno] = useState<DisenoCollage>('lado');
  const mia = fotos.find((f) => f.de === uid && f.dia === hoy);
  const disenos = disenosPara(elegidas.length);
  const disenoValido = disenos.some((d) => d.id === diseno) ? diseno : (disenos[0]?.id ?? 'lado');
  const vista = useVistaPrevia(elegidas, disenoValido);

  const agregar = (lista: FileList | null) => {
    const nuevas = [...(lista ?? [])].filter((f) => f.type.startsWith('image/'));
    if (!nuevas.length) return;
    const juntas = [...elegidas, ...nuevas];
    if (juntas.length > COLLAGE_MAX) mostrar(`Un collage lleva hasta ${COLLAGE_MAX} fotos: usé las primeras ${COLLAGE_MAX}.`);
    setElegidas(juntas.slice(0, COLLAGE_MAX));
    setAbierta(true);
  };
  const cerrar = () => {
    setAbierta(false);
    setElegidas([]);
    setLeyenda('');
  };

  const subir = async () => {
    if (!elegidas.length) return;
    setSubiendo(true);
    let err: string | null;
    try {
      const archivo = elegidas.length === 1 ? elegidas[0] : await armarCollage(elegidas, disenoValido);
      err = await subirFoto(gid, cid, archivo, leyenda);
    } catch {
      err = 'No se pudo armar el collage. Probá con otras fotos.';
    }
    setSubiendo(false);
    if (err) return mostrar(err);
    cerrar();
    mostrar(elegidas.length > 1 ? 'Collage del día compartido.' : 'Foto del día compartida.');
  };

  return (
    <div className="panel" data-muro="fotos">
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div className="grp cap" style={{ marginTop: 0, flex: 1 }}>
          <span>Fotos del día</span>
        </div>
        {puedeSubir && (
          <button type="button" className="link" onClick={() => setAbierta(true)}>
            {mia ? 'Cambiar mi foto de hoy' : '+ Foto de hoy'}
          </button>
        )}
      </div>
      <input
        ref={galeria}
        type="file"
        accept="image/*"
        multiple
        hidden
        aria-label="Elegir foto"
        onChange={(e) => {
          agregar(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={camara}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        aria-label="Sacar foto con la cámara"
        onChange={(e) => {
          agregar(e.target.files);
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

      <Hoja titulo={elegidas.length > 1 ? 'Collage de hoy' : 'Foto de hoy'} abierta={abierta} alCerrar={cerrar}>
        {vista ? (
          <img src={vista} alt="Vista previa" data-vista-previa style={{ width: '100%', maxHeight: 340, objectFit: 'contain', borderRadius: 12, marginTop: 8, background: 'var(--ln)' }} />
        ) : (
          <p className="mu" style={{ fontWeight: 500, marginTop: 4 }}>
            Sacá una foto o elegí de la galería. Con 2 a {COLLAGE_MAX} fotos se arma un collage.
          </p>
        )}
        {elegidas.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }} aria-label="Fotos elegidas">
            {elegidas.map((f, i) => (
              <Miniatura key={`${f.name}-${i}`} archivo={f} indice={i + 1} alQuitar={() => setElegidas(elegidas.filter((_, j) => j !== i))} />
            ))}
          </div>
        )}
        {disenos.length > 0 && (
          <div className="seg3" role="radiogroup" aria-label="Diseño del collage" style={{ marginTop: 12 }}>
            {disenos.map((d) => (
              <button key={d.id} type="button" role="radio" aria-checked={disenoValido === d.id} className={disenoValido === d.id ? 'on' : ''} onClick={() => setDiseno(d.id)}>
                {d.nombre}
              </button>
            ))}
          </div>
        )}
        {elegidas.length < COLLAGE_MAX && (
          <div className="g2" style={{ marginTop: 12 }}>
            <button type="button" className="ghost" onClick={() => camara.current?.click()}>
              <Icono nombre="camara" tam={18} /> {elegidas.length ? 'Sacar otra' : 'Sacar foto'}
            </button>
            <button type="button" className="ghost" onClick={() => galeria.current?.click()}>
              {elegidas.length ? '+ De la galería' : 'Elegir de la galería'}
            </button>
          </div>
        )}
        {elegidas.length > 0 && (
          <>
            <label className="lbl cap" htmlFor="leyenda" style={{ marginTop: 14 }}>
              Comentario (opcional)
            </label>
            <input id="leyenda" className="inp" maxLength={MENSAJE_MAX} value={leyenda} onChange={(e) => setLeyenda(e.target.value)} placeholder="Día cumplido" />
            <p className="mu" style={{ fontSize: 12.5, fontWeight: 500 }}>
              La ven solo los integrantes del grupo. Se achica antes de subirla y se le quita la ubicación.
            </p>
            <button type="button" className="btn" disabled={subiendo} onClick={subir}>
              {subiendo ? 'Subiendo…' : 'Compartir'}
            </button>
          </>
        )}
      </Hoja>
      <VerFoto gid={gid} cid={cid} foto={viendo} alCerrar={() => setViendo(null)} />
    </div>
  );
}

/** Vista previa: la foto sola, o el collage armado en chico (se rehace al cambiar fotos o diseño). */
function useVistaPrevia(fotos: File[], diseno: DisenoCollage): string {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let vivo = true;
    let actual = '';
    if (!fotos.length) {
      setUrl('');
      return;
    }
    const hacer = fotos.length === 1 ? Promise.resolve<Blob>(fotos[0]) : armarCollage(fotos, diseno, 540);
    hacer
      .then((b) => {
        if (!vivo) return;
        actual = URL.createObjectURL(b);
        setUrl(actual);
      })
      .catch(() => vivo && setUrl(''));
    return () => {
      vivo = false;
      if (actual) URL.revokeObjectURL(actual);
    };
  }, [fotos, diseno]);
  return url;
}

function Miniatura({ archivo, indice, alQuitar }: { archivo: File; indice: number; alQuitar: () => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const u = URL.createObjectURL(archivo);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [archivo]);
  return (
    <span style={{ position: 'relative', width: 64, height: 64, borderRadius: 10, overflow: 'hidden', background: 'var(--ln)', flex: 'none' }}>
      {url && <img src={url} alt={`Foto ${indice}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
      <button type="button" aria-label={`Quitar foto ${indice}`} onClick={alQuitar} style={{ position: 'absolute', top: 2, right: 2, width: 22, height: 22, borderRadius: 11, background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 14, lineHeight: '22px', textAlign: 'center' }}>
        ×
      </button>
    </span>
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
                    <Icono nombre="camara" tam={14} className="uic en-linea" /> Subió la foto del día
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
            <p style={{ fontWeight: 500, marginTop: 8, overflowWrap: 'anywhere' }}>{elegido.texto || 'Foto del día'}</p>
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
