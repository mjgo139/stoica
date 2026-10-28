/**
 * Plan del grupo: foto de hoy en cada hábito compartido (ligada a si se cumplió) y chat del grupo.
 * Todo depende del código de activación. Se lee del servidor solo con la pantalla del grupo abierta.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { COLLAGE_MAX, disenosPara, type DisenoCollage } from '@core/collage';
import { fechaCorta, sumarDias } from '@core/fechas';
import { cumplido } from '@core/habitos';
import { inicial } from '@core/perfil';
import { fotoCumplida, MENSAJE_MAX, type EstadoPlan, type FotoHabito, type MensajeGrupo } from '@core/plan';
import type { Miembro } from '@core/comunidad';
import { registrosDe, uidActual, useDatos, useHoy } from '@/app/datos';
import { armarCollage, borrarPublicacion, enviarMensaje, reportarPublicacion, subirFoto, type ColeccionPlan } from '@/app/plan';
import { useConsulta } from '@/data/hooks';
import type { ConId } from '@/data/tipos';
import { Confirmar, Hoja } from '@/ui/Hoja';
import { Icono } from '@/ui/Iconos';
import { useAvisos } from '@/ui/avisos';

const hora = (ms: number) => new Date(ms).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });
export const planVisible = (p: EstadoPlan) => p.estado === 'activo' || p.estado === 'gracia';

/** Fotos de la última semana del grupo (una lectura por foto; lo más viejo se carga al abrir el historial). */
export function useFotosSemana(gid: string, plan: EstadoPlan): Array<ConId<FotoHabito>> {
  const hoy = useHoy();
  return useConsulta<FotoHabito>(planVisible(plan) ? { ruta: `groups/${gid}/fotos`, filtros: [['dia', '>=', sumarDias(hoy, -6)]] } : null).datos;
}

/** ¿Cómo está hoy mi hábito? (con mis datos, siempre al día) */
function useMiCumplido(habitId: string, hoy: string): boolean {
  const h = useDatos((s) => s.habitos.find((x) => x.id === habitId));
  const r = useDatos((s) => registrosDe(s.registros, habitId).get(hoy));
  return h ? cumplido(h, r) : false;
}

function Sello({ ok, chico = false }: { ok: boolean; chico?: boolean }) {
  return (
    <span className={`sello ${ok ? 'ok' : 'mal'} ${chico ? 'chico' : ''}`} aria-hidden={chico || undefined}>
      {chico ? (ok ? '✓' : '×') : ok ? '✓ Cumplido' : '× No cumplido'}
    </span>
  );
}

/**
 * Al lado de cada hábito compartido: la foto de hoy (con su estado), o el botón para subirla si es tuyo.
 * Al tocar se abre el historial de fotos de ese hábito.
 */
export function FotoDelHabito({ gid, plan, miembro, habitId, habito, esYo, fotos, pedido = 0 }: { gid: string; plan: EstadoPlan; miembro: ConId<Miembro>; habitId: string; habito: string; esYo: boolean; fotos: Array<ConId<FotoHabito>>; pedido?: number }) {
  const hoy = useHoy();
  const [viendo, setViendo] = useState(false);
  const [subiendo, setSubiendo] = useState<false | 'normal' | 'sugerida'>(false);
  const propias = fotos.filter((f) => f.de === miembro.id && f.habitId === habitId).sort((a, b) => (a.dia < b.dia ? 1 : -1));
  const deHoy = propias.find((f) => f.dia === hoy);
  const puedeSubir = esYo && plan.estado === 'activo';
  // Acabás de cumplirlo desde el grupo: si todavía no hay foto de hoy, se ofrece subirla.
  const ultimoPedido = useRef(pedido);
  useEffect(() => {
    if (pedido === ultimoPedido.current) return;
    ultimoPedido.current = pedido;
    if (puedeSubir && !deHoy) setSubiendo('sugerida');
  }, [pedido, puedeSubir, deHoy]);
  if (!planVisible(plan)) return <span className="foto-mini hueco" aria-hidden="true" />;
  const quien = esYo ? 'tu' : `de ${miembro.nombre},`;
  return (
    <>
      {deHoy ? (
        <button type="button" className="foto-mini" onClick={() => setViendo(true)} aria-label={`Foto de hoy ${quien} ${habito}: ${fotoCumplida(deHoy, miembro) ? 'cumplido' : 'no cumplido'}`} data-foto-hoy={habito}>
          <img src={deHoy.miniUrl} alt="" />
          <Sello ok={fotoCumplida(deHoy, miembro)} chico />
        </button>
      ) : puedeSubir ? (
        <button type="button" className="foto-mini vacia" onClick={() => setSubiendo('normal')} aria-label={`Subir la foto de hoy de ${habito}`}>
          <Icono nombre="camara" tam={16} />
        </button>
      ) : propias.length > 0 ? (
        <button type="button" className="foto-mini vacia" onClick={() => setViendo(true)} aria-label={`Fotos ${quien} ${habito} (${propias.length})`}>
          <Icono nombre="camara" tam={14} />
          <b>{propias.length}</b>
        </button>
      ) : (
        <span className="foto-mini hueco" aria-hidden="true" />
      )}
      <HojaFotosHabito gid={gid} abierta={viendo} alCerrar={() => setViendo(false)} miembro={miembro} habitId={habitId} habito={habito} esYo={esYo} puedeSubir={puedeSubir} alSubir={() => (setViendo(false), setSubiendo('normal'))} />
      {esYo && <HojaSubirFoto gid={gid} habitId={habitId} habito={habito} reemplaza={!!deHoy} abierta={!!subiendo} sugerida={subiendo === 'sugerida'} alCerrar={() => setSubiendo(false)} />}
    </>
  );
}

/** Todas las fotos de un hábito de un integrante (se leen al abrir), con el estado de cada día. */
function HojaFotosHabito({ gid, abierta, alCerrar, miembro, habitId, habito, esYo, puedeSubir, alSubir }: { gid: string; abierta: boolean; alCerrar: () => void; miembro: ConId<Miembro>; habitId: string; habito: string; esYo: boolean; puedeSubir: boolean; alSubir: () => void }) {
  const hoy = useHoy();
  const { datos } = useConsulta<FotoHabito>(abierta ? { ruta: `groups/${gid}/fotos`, filtros: [['de', '==', miembro.id], ['habitId', '==', habitId]] } : null);
  const fotos = [...datos].sort((a, b) => (a.dia < b.dia ? 1 : -1));
  const [elegida, setElegida] = useState<string | null>(null);
  const actual = fotos.find((f) => f.id === elegida) ?? fotos[0];
  useEffect(() => {
    if (!abierta) setElegida(null);
  }, [abierta]);
  return (
    <Hoja titulo={`${habito} · ${esYo ? 'tus fotos' : miembro.nombre}`} abierta={abierta} alCerrar={alCerrar}>
      {puedeSubir && (
        <button type="button" className="ghost" style={{ width: '100%', marginBottom: 12 }} onClick={alSubir}>
          <Icono nombre="camara" tam={18} /> {fotos.some((f) => f.dia === hoy) ? 'Cambiar la foto de hoy' : 'Subir la foto de hoy'}
        </button>
      )}
      {fotos.length === 0 && <p className="vacio-mini">Todavía no hay fotos de este hábito.</p>}
      {actual && (
        <div data-foto-grande>
          <img src={actual.fotoUrl} alt={actual.texto || `Foto de ${habito}`} style={{ width: '100%', maxHeight: '52vh', objectFit: 'contain', borderRadius: 12, background: 'var(--ln)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <b style={{ fontSize: 14 }}>{actual.dia === hoy ? 'Hoy' : fechaCorta(actual.dia)}</b>
            <Sello ok={fotoCumplida(actual, miembro)} />
          </div>
          {actual.texto && <p style={{ fontWeight: 500, marginTop: 6, overflowWrap: 'anywhere' }}>{actual.texto}</p>}
          <AccionesPublicacion gid={gid} coleccion="fotos" p={actual} alTerminar={alCerrar} />
        </div>
      )}
      {fotos.length > 1 && (
        <div className="tira-fotos" role="list" aria-label="Días con foto">
          {fotos.map((f) => (
            <button key={f.id} type="button" role="listitem" className={f.id === actual?.id ? 'on' : ''} onClick={() => setElegida(f.id)} aria-label={`${fechaCorta(f.dia)}: ${fotoCumplida(f, miembro) ? 'cumplido' : 'no cumplido'}`}>
              <img src={f.miniUrl} alt="" loading="lazy" />
              <Sello ok={fotoCumplida(f, miembro)} chico />
              <span>{f.dia === hoy ? 'Hoy' : fechaCorta(f.dia)}</span>
            </button>
          ))}
        </div>
      )}
    </Hoja>
  );
}

/** Subir (o reemplazar) la foto de hoy de un hábito: cámara o galería, y collage si son varias. */
function HojaSubirFoto({ gid, habitId, habito, reemplaza, abierta, sugerida = false, alCerrar }: { gid: string; habitId: string; habito: string; reemplaza: boolean; abierta: boolean; sugerida?: boolean; alCerrar: () => void }) {
  const hoy = useHoy();
  const ok = useMiCumplido(habitId, hoy);
  const mostrar = useAvisos((s) => s.mostrar);
  const galeria = useRef<HTMLInputElement>(null);
  const camara = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [leyenda, setLeyenda] = useState('');
  const [elegidas, setElegidas] = useState<File[]>([]);
  const [diseno, setDiseno] = useState<DisenoCollage>('lado');
  const disenos = disenosPara(elegidas.length);
  const disenoValido = disenos.some((d) => d.id === diseno) ? diseno : (disenos[0]?.id ?? 'lado');
  const vista = useVistaPrevia(elegidas, disenoValido);

  const agregar = (lista: FileList | null) => {
    const nuevas = [...(lista ?? [])].filter((f) => f.type.startsWith('image/'));
    if (!nuevas.length) return;
    const juntas = [...elegidas, ...nuevas];
    if (juntas.length > COLLAGE_MAX) mostrar(`Un collage lleva hasta ${COLLAGE_MAX} fotos: usé las primeras ${COLLAGE_MAX}.`);
    setElegidas(juntas.slice(0, COLLAGE_MAX));
  };
  const cerrar = () => {
    setElegidas([]);
    setLeyenda('');
    alCerrar();
  };
  const subir = async () => {
    if (!elegidas.length) return;
    setSubiendo(true);
    let err: string | null;
    try {
      const archivo = elegidas.length === 1 ? elegidas[0] : await armarCollage(elegidas, disenoValido);
      err = await subirFoto(gid, habitId, archivo, leyenda);
    } catch {
      err = 'No se pudo armar el collage. Probá con otras fotos.';
    }
    setSubiendo(false);
    if (err) return mostrar(err);
    cerrar();
    mostrar(`Foto de ${habito} compartida.`);
  };

  return (
    <Hoja titulo={sugerida ? `¡${habito} cumplido!` : `Foto de hoy · ${habito}`} abierta={abierta} alCerrar={cerrar}>
      {sugerida && elegidas.length === 0 && (
        <p style={{ fontWeight: 600, marginTop: 0 }}>¿Querés sumar la foto de hoy para el grupo? Es opcional.</p>
      )}
      <div className="franja-estado" data-estado-foto={ok ? 'cumplido' : 'no-cumplido'}>
        <Sello ok={ok} />
        <span>{ok ? 'La foto va con tu día cumplido.' : 'Todavía no lo marcaste: la foto va como no cumplido. Si lo marcás después, se actualiza.'}</span>
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
      {vista ? (
        <img src={vista} alt="Vista previa" data-vista-previa style={{ width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 12, marginTop: 10, background: 'var(--ln)' }} />
      ) : (
        <p className="mu" style={{ fontWeight: 500, marginTop: 10 }}>
          Una foto por hábito por día{reemplaza ? ': la nueva reemplaza a la de hoy' : ''}. Con 2 a {COLLAGE_MAX} fotos se arma un collage.
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
            {elegidas.length ? '+ Galería' : 'Galería'}
          </button>
        </div>
      )}
      {elegidas.length > 0 && (
        <>
          <label className="lbl cap" htmlFor="leyenda" style={{ marginTop: 14 }}>
            Comentario (opcional)
          </label>
          <input id="leyenda" className="inp" maxLength={MENSAJE_MAX} value={leyenda} onChange={(e) => setLeyenda(e.target.value)} placeholder={ok ? 'Día cumplido' : 'Qué pasó hoy'} />
          <p className="mu" style={{ fontSize: 12.5, fontWeight: 500 }}>
            La ven solo los integrantes del grupo. Se achica antes de subirla y se le quita la ubicación.
          </p>
          <button type="button" className="btn" disabled={subiendo} onClick={subir}>
            {subiendo ? 'Subiendo…' : 'Compartir'}
          </button>
        </>
      )}
      {sugerida && elegidas.length === 0 && (
        <button type="button" className="link" style={{ width: '100%', marginTop: 10 }} onClick={cerrar}>
          Ahora no
        </button>
      )}
    </Hoja>
  );
}

/** Chat del grupo: lo leen todos los integrantes; se escribe con el plan activo. */
export function ChatGrupo({ gid, plan }: { gid: string; plan: EstadoPlan }) {
  const uid = uidActual();
  const mostrar = useAvisos((s) => s.mostrar);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [elegido, setElegido] = useState<ConId<MensajeGrupo> | null>(null);
  const visible = planVisible(plan);
  const { datos } = useConsulta<MensajeGrupo>(visible ? { ruta: `groups/${gid}/mensajes`, orden: ['creado', 'desc'], limite: 60 } : null);
  const lista = useRef<HTMLDivElement>(null);
  // Se abre mostrando lo último, como cualquier chat.
  useEffect(() => {
    const el = lista.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [datos.length]);
  if (!visible) return null;
  const mensajes = [...datos].reverse();
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    const err = await enviarMensaje(gid, texto);
    setEnviando(false);
    if (err) return mostrar(err);
    setTexto('');
  };
  return (
    <div className="panel" data-chat>
      <div className="grp cap" style={{ marginTop: 0 }}>
        <span>Chat del grupo</span>
      </div>
      {mensajes.length === 0 && <p className="vacio-mini">Nadie escribió todavía. Un “¡vamos!” ayuda más de lo que parece.</p>}
      <div className="chat-lista" aria-live="polite" ref={lista}>
        {mensajes.map((m) => {
          const mio = m.de === uid;
          return (
            <button key={m.id} type="button" className="srow" style={{ alignItems: 'flex-start', borderBottom: 0, padding: 0 }} onClick={() => setElegido(m)} aria-label={`Mensaje de ${mio ? 'vos' : m.nombre}: opciones`}>
              <span className="avatar" style={{ width: 30, height: 30, fontSize: 13, flex: 'none' }}>
                {inicial(m.nombre)}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 13.5 }}>{mio ? 'Vos' : m.nombre}</b>
                  <span className="mu2" style={{ fontSize: 11.5, fontWeight: 600 }}>
                    {fechaCorta(m.dia)} · {hora(m.creado)}
                  </span>
                </span>
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 500, overflowWrap: 'anywhere' }}>{m.texto}</span>
              </span>
            </button>
          );
        })}
      </div>
      {plan.estado === 'activo' ? (
        <form onSubmit={enviar} style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <input className="fi" aria-label="Mensaje" maxLength={MENSAJE_MAX} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribí algo corto…" style={{ flex: 1, minWidth: 0 }} />
          <button type="submit" className="btn" style={{ width: 'auto', padding: '0 18px', height: 46 }} disabled={enviando || !texto.trim()}>
            Enviar
          </button>
        </form>
      ) : (
        <p className="vacio-mini" style={{ marginTop: 10 }}>
          El plan venció: se puede leer, pero no escribir.
        </p>
      )}
      <Hoja titulo="Mensaje" abierta={!!elegido} alCerrar={() => setElegido(null)}>
        {elegido && (
          <>
            <p style={{ fontWeight: 500, marginTop: 8, overflowWrap: 'anywhere' }}>{elegido.texto}</p>
            <AccionesPublicacion gid={gid} coleccion="mensajes" p={elegido} alTerminar={() => setElegido(null)} />
          </>
        )}
      </Hoja>
    </div>
  );
}

/** Borrar lo propio o reportar lo ajeno (el admin ve solo lo reportado). */
function AccionesPublicacion({ gid, coleccion, p, alTerminar }: { gid: string; coleccion: ColeccionPlan; p: { id: string; de: string }; alTerminar: () => void }) {
  const uid = uidActual();
  const mostrar = useAvisos((s) => s.mostrar);
  const [confirmando, setConfirmando] = useState(false);
  const mio = p.de === uid;
  return (
    <>
      <button type="button" className={`ghost ${mio ? 'peligro' : ''}`} style={{ width: '100%', marginTop: 12 }} onClick={() => setConfirmando(true)}>
        {mio ? (coleccion === 'fotos' ? 'Borrar esta foto' : 'Borrar') : 'Reportar'}
      </button>
      <Confirmar
        abierto={confirmando}
        titulo={mio ? '¿Borrar?' : '¿Reportar?'}
        texto={mio ? 'Se borra para todo el grupo.' : 'Le llega al administrador de Stoica para revisarlo. Quien lo publicó no sabe que lo reportaste.'}
        accion={mio ? 'Borrar' : 'Reportar'}
        peligro={mio}
        alCerrar={() => setConfirmando(false)}
        alConfirmar={async () => {
          setConfirmando(false);
          const err = mio ? await borrarPublicacion(gid, coleccion, p.id) : await reportarPublicacion(gid, coleccion, p.id, '');
          mostrar(err ?? (mio ? 'Borrado.' : 'Gracias. Lo vamos a revisar.'));
          alTerminar();
        }}
      />
    </>
  );
}

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

