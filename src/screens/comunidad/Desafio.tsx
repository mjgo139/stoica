import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { estadoDesafio, finDesafio, semanaAlDia, type Desafio as TipoDesafio, type Progreso } from '@core/comunidad';
import { fechaCorta } from '@core/fechas';
import { NOMBRE_VIRTUD } from '@core/habitos';
import { inicial } from '@core/perfil';
import { aRomano } from '@core/romanos';
import { borrarDesafio, useComunidad } from '@/app/comunidad';
import { registrosDe, uidActual, useDatos, useHoy } from '@/app/datos';
import { useConsulta } from '@/data/hooks';
import type { ConId } from '@/data/tipos';
import { Confirmar } from '@/ui/Hoja';
import { IconoHabito } from '@/ui/IconoHabito';
import { Icono } from '@/ui/Iconos';
import { SemanaMini } from '@/ui/SemanaMini';
import { TarjetaHabito } from '../habitos/Lista';
import { HojaDesafio, HojaElegirHabito, MarcaMia } from './Grupo';

/** Pantalla de un desafío: tu hábito y el de cada participante, como en el grupo. Las fotos y el chat están en el grupo. */
export function Desafio() {
  const { id: gid = '', cid = '' } = useParams();
  const navegar = useNavigate();
  const hoy = useHoy();
  const estado = useComunidad((s) => s.grupos.get(gid));
  const listo = useComunidad((s) => s.listo);
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
        </div>
        <div className="pila">
          <Participantes d={d} gid={gid} hoy={hoy} />
        </div>
      </div>
      <HojaDesafio abierta={editando} alCerrar={() => setEditando(false)} grupoId={gid} hoy={d.inicio} existente={d} />
      <Confirmar
        abierto={borrando}
        titulo="¿Borrar el desafío?"
        texto="Se borra para todo el grupo, con el avance de cada uno. Los hábitos de cada uno no se tocan."
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

/**
 * Participantes: cada uno con su avance en el desafío y su hábito como se ve en el grupo
 * (racha, % de 30 días, si cumplió hoy y la semana).
 */
function Participantes({ d, gid, hoy }: { d: ConId<TipoDesafio>; gid: string; hoy: string }) {
  const uid = uidActual();
  const progresos = useConsulta<Progreso>({ ruta: `groups/${gid}/challenges/${d.id}/progress` }).datos;
  const ranking = [...progresos].sort((a, b) => b.cumplidos - a.cumplidos || a.nombre.localeCompare(b.nombre));
  return (
    <div className="panel" data-participantes>
      <div className="grp cap" style={{ marginTop: 0 }}>
        <span>Participantes · {ranking.length}</span>
      </div>
      {ranking.length === 0 && <p className="vacio-mini">Nadie se sumó todavía.</p>}
      {ranking.map((p, i) => {
        const esYo = p.id === uid;
        const c = p.habito;
        const alDia = p.fecha === hoy;
        return (
          <div key={p.id} className="participante" data-participante={esYo ? 'vos' : p.nombre}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="num mu2" style={{ width: 16, fontSize: 13 }}>
                {i + 1}
              </span>
              <span className="avatar" style={{ width: 30, height: 30, fontSize: 13, flex: 'none' }}>
                {inicial(p.nombre)}
              </span>
              <b style={{ flex: 1, minWidth: 0, fontSize: 14.5, overflowWrap: 'anywhere' }}>{esYo ? 'Vos' : p.nombre}</b>
              <span className="num" style={{ fontSize: 14 }}>
                {p.cumplidos}/{d.meta}
              </span>
            </div>
            <span className="barra-prog" style={{ display: 'block', margin: '8px 0 0 26px' }}>
              <i style={{ width: `${Math.min(100, (p.cumplidos / d.meta) * 100)}%`, background: p.cumplidos >= d.meta ? 'var(--ok)' : 'var(--gold)' }} />
            </span>
            {c ? (
              <div style={{ padding: '10px 0 0 26px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <IconoHabito icono={c.icono} virtud={c.virtud} tam={30} />
                  {esYo ? (
                    <Link to={`/habitos/${c.habitId}`} style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14, color: 'inherit', textDecoration: 'none' }}>
                      {c.nombre}{'\u00a0'}<span className="gold">›</span>
                    </Link>
                  ) : (
                    <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14 }}>{c.nombre}</span>
                  )}
                  <span className="num gold" style={{ fontSize: 15 }} title={`Racha de ${c.racha} días`}>
                    {aRomano(c.racha)}
                  </span>
                  <span className="mu2" style={{ fontSize: 12, fontWeight: 700, width: 38, textAlign: 'right' }}>
                    {c.porcentaje}%
                  </span>
                  {esYo ? (
                    <MarcaMia habitId={c.habitId} nombre={c.nombre} hoy={hoy} resumenOk={alDia && c.hoy} />
                  ) : (
                    <span className={`dia ${alDia && c.hoy ? 'ok' : ''}`} style={{ margin: 0, width: 32, height: 32 }} aria-label={alDia && c.hoy ? 'Cumplido hoy' : 'Pendiente hoy'}>
                      <span style={{ width: 16, height: 16 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24">
                          <path d="M5 12l4 4 10-10" />
                        </svg>
                      </span>
                    </span>
                  )}
                </div>
                <div style={{ paddingLeft: 40, marginTop: 6 }}>
                  <SemanaMini dias={semanaAlDia(c.semana, p.fecha ?? hoy, hoy)} hoy={hoy} etiqueta={`${esYo ? 'Tu semana' : p.nombre}, ${c.nombre}`} />
                </div>
              </div>
            ) : (
              <p className="mu2" style={{ fontSize: 12.5, fontWeight: 600, margin: '8px 0 0 26px' }}>
                Su hábito aparece cuando vuelva a abrir la app.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
