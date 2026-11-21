/**
 * Plan del grupo: foto de hoy en cada hábito compartido (ligada a si se cumplió), con sus comentarios.
 * Todo depende del código de activación. Se lee del servidor solo con la pantalla del grupo abierta.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Grupo } from '../../../familia/react';
import { COLLAGE_MAX, disenosPara, type DisenoCollage } from '@core/collage';
import { fechaCorta, sumarDias } from '@core/fechas';
import { cumplido } from '@core/habitos';
import { inicial } from '@core/perfil';
import { fotoCumplida, MENSAJE_MAX, type ComentarioFoto, type EstadoPlan, type FotoHabito } from '@core/plan';
import type { Miembro } from '@core/comunidad';
import { registrosDe, uidActual, useDatos, useHoy } from '@/app/datos';
import { armarCollage, borrarPublicacion, comentarFoto, reportarPublicacion, subirFoto, type Publicable } from '@/app/plan';
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

/** Qué foto mirar o qué hábito fotografiar: lo maneja la pantalla del grupo (una sola hoja para todo). */
export interface VerFotos {
  miembro: ConId<Miembro>;
  habitId: string;
  habito: string;
  esYo: boolean;
  dia?: string;
}
export interface SubirFotos {
  habitId: string;
  habito: string;
  sugerida: boolean;
}

/** Días con foto de un integrante en un hábito (para el puntito de la semana). */
export function diasConFoto(fotos: Array<ConId<FotoHabito>>, de: string, habitId: string): Set<string> {
  return new Set(fotos.filter((f) => f.de === de && f.habitId === habitId).map((f) => f.dia));
}

/**
 * Al lado de cada hábito compartido: la foto de hoy (con su estado), o el botón para subirla si es tuyo.
 * Al tocar la foto se abre el historial de ese hábito.
 */
export function FotoDelHabito({ plan, miembro, habitId, habito, esYo, fotos, pedido = 0, alVer, alSubir }: { plan: EstadoPlan; miembro: ConId<Miembro>; habitId: string; habito: string; esYo: boolean; fotos: Array<ConId<FotoHabito>>; pedido?: number; alVer: (v: VerFotos) => void; alSubir: (s: SubirFotos) => void }) {
  const hoy = useHoy();
  const propias = fotos.filter((f) => f.de === miembro.id && f.habitId === habitId);
  const deHoy = propias.find((f) => f.dia === hoy);
  const puedeSubir = esYo && plan.estado === 'activo';
  // Acabás de cumplirlo desde el grupo: si todavía no hay foto de hoy, se ofrece subirla.
  const ultimoPedido = useRef(pedido);
  useEffect(() => {
    if (pedido === ultimoPedido.current) return;
    ultimoPedido.current = pedido;
    if (puedeSubir && !deHoy) alSubir({ habitId, habito, sugerida: true });
  }, [pedido, puedeSubir, deHoy, alSubir, habitId, habito]);
  if (!planVisible(plan)) return <span className="foto-mini hueco" aria-hidden="true" />;
  const quien = esYo ? 'tu' : `de ${miembro.nombre},`;
  if (deHoy) {
    return (
      <button type="button" className="foto-mini" onClick={() => alVer({ miembro, habitId, habito, esYo, dia: hoy })} aria-label={`Foto de hoy ${quien} ${habito}: ${fotoCumplida(deHoy, miembro) ? 'cumplido' : 'no cumplido'}`} data-foto-hoy={habito}>
        <img src={deHoy.miniUrl} alt="" />
        <Sello ok={fotoCumplida(deHoy, miembro)} chico />
      </button>
    );
  }
  if (puedeSubir) {
    return (
      <button type="button" className="foto-mini vacia" onClick={() => alSubir({ habitId, habito, sugerida: false })} aria-label={`Subir la foto de hoy de ${habito}`}>
        <Icono nombre="camara" tam={16} />
      </button>
    );
  }
  if (propias.length > 0) {
    return (
      <button type="button" className="foto-mini vacia" onClick={() => alVer({ miembro, habitId, habito, esYo })} aria-label={`Fotos ${quien} ${habito} (${propias.length})`}>
        <Icono nombre="camara" tam={14} />
        <b>{propias.length}</b>
      </button>
    );
  }
  return <span className="foto-mini hueco" aria-hidden="true" />;
}

/** Arriba del grupo: las fotos de hoy de todos, para verlas de un vistazo. */
export function FotosDeHoy({ fotos, miembros, alVer }: { fotos: Array<ConId<FotoHabito>>; miembros: Array<ConId<Miembro>>; alVer: (v: VerFotos) => void }) {
  const hoy = useHoy();
  const uid = uidActual();
  const deHoy = fotos.filter((f) => f.dia === hoy).sort((a, b) => b.actualizado - a.actualizado);
  if (!deHoy.length) return null;
  return (
    <div className="panel" data-fotos-hoy>
      <Grupo n={1} className="sep-grupo sin-arriba">Fotos de hoy · {deHoy.length}</Grupo>
      <div className="fotos-hoy" role="list">
        {deHoy.map((f) => {
          const m = miembros.find((x) => x.id === f.de);
          const ok = fotoCumplida(f, m);
          const esYo = f.de === uid;
          return (
            <button
              key={f.id}
              type="button"
              role="listitem"
              onClick={() => m && alVer({ miembro: m, habitId: f.habitId, habito: f.habito, esYo, dia: f.dia })}
              aria-label={`${esYo ? 'Tu foto' : `Foto de ${f.nombre}`}: ${f.habito}, ${ok ? 'cumplido' : 'no cumplido'}${f.comentarios ? `, ${f.comentarios} ${f.comentarios === 1 ? 'comentario' : 'comentarios'}` : ''}`}
            >
              <img src={f.miniUrl} alt="" loading="lazy" />
              <Sello ok={ok} chico />
              <span className="q">{esYo ? 'Vos' : f.nombre.split(' ')[0]}</span>
              <span className="h">{f.habito}</span>
              {!!f.comentarios && <ContadorComentarios n={f.comentarios} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Todas las fotos de un hábito de un integrante (se leen al abrir), con el estado de cada día. */
export function HojaFotosHabito({ gid, plan, ver, alCerrar, alSubir }: { gid: string; plan: EstadoPlan; ver: VerFotos | null; alCerrar: () => void; alSubir: (s: SubirFotos) => void }) {
  const hoy = useHoy();
  const abierta = !!ver;
  const miembro = ver?.miembro;
  const habitId = ver?.habitId ?? '';
  const habito = ver?.habito ?? '';
  const esYo = !!ver?.esYo;
  const puedeSubir = esYo && plan.estado === 'activo';
  const { datos } = useConsulta<FotoHabito>(abierta && miembro ? { ruta: `groups/${gid}/fotos`, filtros: [['de', '==', miembro.id], ['habitId', '==', habitId]] } : null);
  const fotos = [...datos].sort((a, b) => (a.dia < b.dia ? 1 : -1));
  const [elegida, setElegida] = useState<string | null>(null);
  const actual = fotos.find((f) => f.id === elegida) ?? fotos.find((f) => f.dia === ver?.dia) ?? fotos[0];
  useEffect(() => {
    setElegida(null);
  }, [ver]);
  if (!miembro) return null;
  return (
    <Hoja titulo={`${habito} · ${esYo ? 'tus fotos' : miembro.nombre}`} abierta={abierta} alCerrar={alCerrar}>
      {puedeSubir && (
        <button type="button" className="ghost" style={{ width: '100%', marginBottom: 12 }} onClick={() => (alCerrar(), alSubir({ habitId, habito, sugerida: false }))}>
          <Icono nombre="camara" tam={18} /> {fotos.some((f) => f.dia === hoy) ? 'Cambiar la foto de hoy' : 'Subir la foto de hoy'}
        </button>
      )}
      {fotos.length === 0 && <p className="vacio-mini">Todavía no hay fotos de este hábito.</p>}
      {actual && (
        <div data-foto-grande>
          <img src={actual.fotoUrl} alt={actual.texto || `Foto de ${habito}`} style={{ width: '100%', maxHeight: '40vh', objectFit: 'contain', borderRadius: 12, background: 'var(--ln2)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <b style={{ fontSize: 13.5 }}>{actual.dia === hoy ? 'Hoy' : fechaCorta(actual.dia)}</b>
            <Sello ok={fotoCumplida(actual, miembro)} />
          </div>
          {actual.texto && <p style={{ fontWeight: 500, marginTop: 6, overflowWrap: 'anywhere' }}>{actual.texto}</p>}
          <Comentarios gid={gid} foto={actual} plan={plan} />
          <AccionesPublicacion gid={gid} que={{ coleccion: 'fotos', id: actual.id }} de={actual.de} alTerminar={alCerrar} />
        </div>
      )}
      {fotos.length > 1 && (
        <div className="tira-fotos" role="list" aria-label="Días con foto">
          {fotos.map((f) => (
            <button key={f.id} type="button" role="listitem" className={f.id === actual?.id ? 'on' : ''} onClick={() => setElegida(f.id)} aria-label={`${fechaCorta(f.dia)}: ${fotoCumplida(f, miembro) ? 'cumplido' : 'no cumplido'}`}>
              <img src={f.miniUrl} alt="" loading="lazy" />
              <Sello ok={fotoCumplida(f, miembro)} chico />
              <span>{f.dia === hoy ? 'Hoy' : fechaCorta(f.dia)}</span>
              {!!f.comentarios && <ContadorComentarios n={f.comentarios} />}
            </button>
          ))}
        </div>
      )}
    </Hoja>
  );
}

/** Subir (o reemplazar) la foto de hoy de un hábito: cámara o galería, y collage si son varias. */
export function HojaSubirFoto({ gid, subir: pedido, fotos, alCerrar }: { gid: string; subir: SubirFotos | null; fotos: Array<ConId<FotoHabito>>; alCerrar: () => void }) {
  const hoy = useHoy();
  const uid = uidActual();
  const abierta = !!pedido;
  const habitId = pedido?.habitId ?? '';
  const habito = pedido?.habito ?? '';
  const sugerida = !!pedido?.sugerida;
  const reemplaza = fotos.some((f) => f.de === uid && f.habitId === habitId && f.dia === hoy);
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
        <img src={vista} alt="Vista previa" data-vista-previa style={{ width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 12, marginTop: 10, background: 'var(--ln2)' }} />
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

/** Borrar lo propio o reportar lo ajeno (el admin ve solo lo reportado). */
function AccionesPublicacion({ gid, que, de, puedeBorrar, alTerminar, chico = false }: { gid: string; que: Publicable; de: string; puedeBorrar?: boolean; alTerminar: () => void; chico?: boolean }) {
  const uid = uidActual();
  const mostrar = useAvisos((s) => s.mostrar);
  const [confirmando, setConfirmando] = useState(false);
  // Borra lo propio (y quien subió la foto puede borrar los comentarios que le dejaron); lo ajeno se reporta.
  const mio = de === uid || !!puedeBorrar;
  return (
    <>
      {chico ? (
        <button type="button" className={`link ${mio ? 'peligro-txt' : ''}`} style={{ padding: 0, minHeight: 0, fontSize: 12.5 }} onClick={() => setConfirmando(true)}>
          {mio ? 'Borrar' : 'Reportar'}
        </button>
      ) : (
        <button type="button" className={`ghost ${mio ? 'peligro' : ''}`} style={{ width: '100%', marginTop: 12 }} onClick={() => setConfirmando(true)}>
          {mio ? (que.coleccion === 'fotos' ? 'Borrar esta foto' : 'Borrar') : 'Reportar'}
        </button>
      )}
      <Confirmar
        abierto={confirmando}
        titulo={mio ? '¿Borrar?' : '¿Reportar?'}
        texto={mio ? 'Se borra para todo el grupo.' : 'Le llega al administrador de StoaHabit para revisarlo. Quien lo publicó no sabe que lo reportaste.'}
        accion={mio ? 'Borrar' : 'Reportar'}
        peligro={mio}
        alCerrar={() => setConfirmando(false)}
        alConfirmar={async () => {
          setConfirmando(false);
          const err = mio ? await borrarPublicacion(gid, que) : await reportarPublicacion(gid, que, '');
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
    <span style={{ position: 'relative', width: 64, height: 64, borderRadius: 10, overflow: 'hidden', background: 'var(--ln2)', flex: 'none' }}>
      {url && <img src={url} alt={`Foto ${indice}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
      <button type="button" aria-label={`Quitar foto ${indice}`} onClick={alQuitar} style={{ position: 'absolute', top: 2, right: 2, width: 22, height: 22, borderRadius: 11, background: 'color-mix(in srgb, var(--icono-fondo) 60%, transparent)', color: 'var(--icono-figura)', fontSize: 13.5, lineHeight: '22px', textAlign: 'center' }}>
        ×
      </button>
    </span>
  );
}


function ContadorComentarios({ n }: { n: number }) {
  return (
    <span className="cuenta-coment" aria-hidden="true">
      <Icono nombre="comentario" tam={12} /> {n}
    </span>
  );
}

/** Comentarios de una foto: los ven los integrantes; comentan con el plan activo. */
function Comentarios({ gid, foto, plan }: { gid: string; foto: ConId<FotoHabito>; plan: EstadoPlan }) {
  const uid = uidActual();
  const mostrar = useAvisos((s) => s.mostrar);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const { datos } = useConsulta<ComentarioFoto>({ ruta: `groups/${gid}/fotos/${foto.id}/comentarios`, orden: ['creado', 'asc'], limite: 100 });
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    const err = await comentarFoto(gid, foto.id, texto);
    setEnviando(false);
    if (err) return mostrar(err);
    setTexto('');
  };
  return (
    <div className="comentarios" data-comentarios>
      <Grupo n={2} className="sep-grupo mt-[14px]">Comentarios{datos.length ? ` · ${datos.length}` : ''}</Grupo>
      {datos.length === 0 && <p className="vacio-mini">Todavía nadie comentó. Un “¡vamos!” ayuda más de lo que parece.</p>}
      <div className="lista-coment" aria-live="polite">
        {datos.map((c) => (
          <div key={c.id} className="comentario">
            <span className="avatar" style={{ width: 28, height: 28, fontSize: 12.5, flex: 'none' }}>
              {inicial(c.nombre)}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <b style={{ fontSize: 13.5 }}>{c.de === uid ? 'Vos' : c.nombre}</b>
                <span className="mu2" style={{ fontSize: 11, fontWeight: 600 }}>
                  {c.dia === foto.dia ? '' : `${fechaCorta(c.dia)} · `}
                  {hora(c.creado)}
                </span>
                <span style={{ marginLeft: 'auto' }}>
                  <AccionesPublicacion gid={gid} que={{ coleccion: 'comentarios', id: c.id, fotoId: foto.id }} de={c.de} puedeBorrar={foto.de === uid} alTerminar={() => undefined} chico />
                </span>
              </span>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 500, overflowWrap: 'anywhere' }}>{c.texto}</span>
            </span>
          </div>
        ))}
      </div>
      {plan.estado === 'activo' ? (
        <form onSubmit={enviar} style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input className="fi" aria-label="Comentario" maxLength={MENSAJE_MAX} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Comentá esta foto…" style={{ flex: 1, minWidth: 0 }} />
          <button type="submit" className="btn" style={{ width: 'auto', padding: '0 16px', height: 46 }} disabled={enviando || !texto.trim()}>
            Enviar
          </button>
        </form>
      ) : (
        <p className="vacio-mini">El plan venció: se pueden leer los comentarios, pero no escribir.</p>
      )}
    </div>
  );
}
