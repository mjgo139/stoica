import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { citaDelDia } from '@core/citas';
import { DIAS_CORTOS, diaSemanaDeClave, diasRestantesDelAnio, fechaLarga, fechaLargaDeClave, momentoDelDia, MOMENTOS, partesDeClave, partesEnZona, saludo, sumarDias } from '@core/fechas';
import { cumplido, esDiaActivo, racha, type Habito } from '@core/habitos';
import { inicial, primerNombre } from '@core/perfil';
import { aRomano } from '@core/romanos';
import { examenCompleto, tareaDelDia, tareaHecha } from '@core/rutina';
import { useSesion } from '@/app/sesion';
import { useComunidad } from '@/app/comunidad';
import { alternarTarea, registrosDe, useDatos, useHabitosActivos, useHoy, VENTANA_DIAS } from '@/app/datos';
import { Laurel } from '@/ui/Laurel';
import { Icono } from '@/ui/Iconos';
import { IconoHabito } from '@/ui/IconoHabito';
import { FilaHabito } from './habitos/FilaHabito';
import { Plantillas } from './habitos/Editor';
import { useNotificacionesDispositivo } from './PerfilExtra';

export function Hoy() {
  const perfil = useSesion((s) => s.perfil)!;
  const hoy = useHoy();
  const [sel, setSel] = useState(0);
  const dia = sumarDias(hoy, sel);
  const habitos = useHabitosActivos();
  const { registros, tareas, tareasHechas, examenes, listo } = useDatos();
  const ahora = new Date();
  const zona = perfil.zonaHoraria;
  const { hora } = partesEnZona(ahora, zona);
  const cita = citaDelDia(dia);
  const quedan = diasRestantesDelAnio(ahora, zona);

  const delDia = useMemo(() => habitos.filter((h) => esDiaActivo(h, dia)), [habitos, dia]);
  const hechosDe = (d: string) => {
    const hs = habitos.filter((h) => esDiaActivo(h, d));
    const ok = hs.filter((h) => cumplido(h, registrosDe(registros, h.id).get(d))).length;
    return { total: hs.length, ok };
  };
  const resumen = hechosDe(dia);
  const rachas = useMemo(
    () => new Map(habitos.map((h) => [h.id, racha(h, registrosDe(registros, h.id), hoy, VENTANA_DIAS)])),
    [habitos, registros, hoy],
  );
  // Sin fecha: solo las sueltas (las de un proyecto se ven en el proyecto) y no las que ya se completaron otro día.
  const tareasDia = tareas
    .filter((t) => tareaDelDia(t, dia) && !(t.repetir === 'no' && !t.fecha && (t.proyectoId || (t.completada && t.completada < dia))))
    .sort((a, b) => (a.hora ?? '').localeCompare(b.hora ?? '') || a.momento - b.momento);
  const titulo = sel === 0 ? `${saludo(hora)}${primerNombre(perfil.nombre) ? `, ${primerNombre(perfil.nombre)}` : ''}` : sel === -1 ? 'Ayer' : sel === 1 ? 'Mañana' : fechaLargaDeClave(dia).split(' ')[0];

  return (
    <div className="entra">
      <section className="hero" aria-label="Bienvenida">
        <Laurel ancho={300} alto={272} completo={false} grosor={2} className="wm" />
        <div className="acciones">
          <Link to="/habitos/nuevo" className="ico ring" style={{ background: 'var(--sf)' }} aria-label="Nuevo hábito">
            <Icono nombre="mas" tam={18} />
          </Link>
          <Link to="/perfil" className="avatar solo-mov" aria-label="Perfil" style={{ textDecoration: 'none' }}>
            {inicial(perfil.nombre)}
          </Link>
        </div>
        <div style={{ position: 'relative', minWidth: 0, paddingRight: 100 }}>
          <div className="cap gold">{sel === 0 ? 'Panel del día' : 'Viendo otro día'}</div>
          <h1 className="titulo">{titulo}</h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            <span className="chip-fecha">
              <Icono nombre="sol" tam={15} />
              {sel === 0 ? fechaLarga(ahora, zona) : fechaLargaDeClave(dia)}
            </span>
            {perfil.mementoMori && (
              <Link to="/memento" className="chip-fecha" style={{ textDecoration: 'none' }}>
                Memento mori · {quedan} {quedan === 1 ? 'día' : 'días'} ›
              </Link>
            )}
            <Link to="/jardin" className="chip-fecha" style={{ textDecoration: 'none' }}>
              <Icono nombre="planta" tam={15} />
              Tu jardín ›
            </Link>
          </div>
        </div>
        <figure className="hq" style={{ margin: 0 }}>
          <blockquote className="quote" style={{ margin: 0, fontSize: 18 }}>
            “{cita.texto}”
          </blockquote>
          <figcaption className="cap gold" style={{ marginTop: 8, fontSize: 11 }}>
            {cita.autor}
          </figcaption>
        </figure>
      </section>

      <div style={{ marginTop: 18 }}>
        <InvitarAvisos />
      </div>
      <div className="hoy-grilla" style={{ marginTop: 24 }}>
        <aside className="panel" aria-label="Elegir día">
          <div className="franja-dias" role="tablist">
            {[-3, -2, -1, 0, 1, 2, 3].map((off) => {
              const d = sumarDias(hoy, off);
              const r = hechosDe(d);
              const punto = r.total > 0 && r.ok === r.total ? 'ok' : r.ok > 0 ? 'medio' : '';
              return (
                <button key={off} type="button" role="tab" aria-selected={off === sel} className={`${off === sel ? 'on' : ''} ${off > 0 ? 'fut' : ''}`} onClick={() => setSel(off)} aria-label={fechaLargaDeClave(d)}>
                  <span className="cap" style={{ fontSize: 10.5, letterSpacing: '.1em' }}>
                    {DIAS_CORTOS[diaSemanaDeClave(d)]}
                  </span>
                  <span className="num" style={{ fontSize: 21 }}>
                    {partesDeClave(d).dia}
                  </span>
                  <span className={`punto ${off <= 0 ? punto : ''}`} />
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 16 }}>
            <span className="num" style={{ fontSize: 34, color: resumen.total && resumen.ok === resumen.total ? 'var(--ok)' : 'var(--tx)' }}>
              {resumen.ok}
              <span className="mu2" style={{ fontSize: 20 }}>/{resumen.total}</span>
            </span>
            <span className="mu" style={{ fontWeight: 600 }}>
              {resumen.total === 0 ? 'Sin prácticas este día' : resumen.ok === resumen.total ? 'Día cumplido' : 'prácticas cumplidas'}
            </span>
          </div>
          <div className="barra-prog" style={{ marginTop: 10 }}>
            <i style={{ width: `${resumen.total ? (resumen.ok / resumen.total) * 100 : 0}%` }} />
          </div>
        </aside>

        <section aria-label="Prácticas del día" className={sel !== 0 ? 'entra' : ''} key={dia}>
          {listo && habitos.length === 0 ? (
            <div className="card vacio">
              <IconoHabito icono="med" virtud="sabiduria" grande />
              <div className="serif" style={{ fontSize: 22, marginTop: 12 }}>
                Empezá por una práctica
              </div>
              <p>Elegí un hábito: algo que marcás, una cantidad que vas sumando o una medida como tu peso.</p>
              <Link to="/habitos/nuevo" className="btn" style={{ textDecoration: 'none', maxWidth: 320, margin: '0 auto' }}>
                Crear mi primer hábito
              </Link>
              <div style={{ marginTop: 22, textAlign: 'left' }}>
                <Plantillas compacta />
              </div>
            </div>
          ) : (
            <>
              {([0, 1, 2] as const).map((m) => {
                const lista = delDia.filter((h) => h.momento === m);
                if (!lista.length) return null;
                return (
                  <div key={m}>
                    <div className="grp cap" style={{ marginTop: m === firstMomento(delDia) ? 0 : 24 }}>
                      <span>{MOMENTOS[m]}</span>
                      {sel === 0 && momentoDelDia(hora) === m && <span className="mu2" style={{ fontSize: 10 }}>· ahora</span>}
                    </div>
                    {lista.map((h) => (
                      <FilaHabito
                        key={h.id}
                        h={h}
                        r={registrosDe(registros, h.id).get(dia)}
                        fecha={dia}
                        racha={rachas.get(h.id) ?? 0}
                        perdido={sel < 0 && !cumplido(h, registrosDe(registros, h.id).get(dia))}
                        editable={sel <= 0}
                      />
                    ))}
                  </div>
                );
              })}
              {listo && delDia.length === 0 && <p className="vacio-mini">No hay prácticas para este día de la semana.</p>}
              {sel > 0 && <p className="vacio-mini">Los días futuros se pueden ver, pero no marcar.</p>}
            </>
          )}

          {tareasDia.length > 0 && (
            <>
              <div className="grp cap" style={{ marginTop: 28 }}>
                <span>Tareas</span>
              </div>
              {tareasDia.slice(0, 6).map((t) => {
                const hecha = tareaHecha(t, dia, tareasHechas);
                return (
                  <div key={t.id} className={`item ${hecha ? 'is-done tachada' : ''}`}>
                    <Link to="/tareas" className="item-main">
                      <span style={{ minWidth: 0 }}>
                        <span className="nm">{t.titulo}</span>
                        <span className="sub mu2">{t.dependeDeTi ? 'Depende de ti' : 'No depende de ti'}</span>
                      </span>
                    </Link>
                    {t.dependeDeTi && (
                      <button type="button" className={`dia ${hecha ? 'ok' : ''}`} aria-pressed={hecha} aria-label={`${hecha ? 'Desmarcar' : 'Marcar'} ${t.titulo}`} disabled={sel > 0} onClick={() => alternarTarea(t, dia)}>
                        <span>
                          <svg width="14" height="14" viewBox="0 0 24 24">
                            <path d="M5 12l4 4 10-10" />
                          </svg>
                        </span>
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </section>

        <aside className="rail" style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
          <UltimosSiete hoy={hoy} habitos={habitos} />
          <div className="panel">
            <div className="grp cap" style={{ marginTop: 0 }}>
              <span>Rachas</span>
            </div>
            {[...habitos]
              .sort((a, b) => (rachas.get(b.id) ?? 0) - (rachas.get(a.id) ?? 0))
              .slice(0, 4)
              .map((h) => (
                <Link key={h.id} to={`/habitos/${h.id}`} className="srow">
                  <IconoHabito icono={h.icono} virtud={h.virtud} tam={34} />
                  <span style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{h.nombre}</span>
                  <span className="num gold" style={{ fontSize: 18 }}>
                    {aRomano(rachas.get(h.id) ?? 0)}
                  </span>
                </Link>
              ))}
            {habitos.length === 0 && <p className="vacio-mini">Tus rachas van a aparecer acá.</p>}
          </div>
          <PanelComunidad />
          <Link to="/examen" className="panel" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
            <div className="grp cap" style={{ marginTop: 0 }}>
              <span>Examen nocturno</span>
            </div>
            <div className="serif" style={{ fontSize: 19 }}>
              {examenCompleto(examenes.get(hoy)) ? 'Examen de hoy hecho' : '¿Qué mal he corregido hoy?'}
            </div>
            <p className="mu" style={{ fontSize: 13.5, fontWeight: 500, marginTop: 6 }}>
              {examenCompleto(examenes.get(hoy)) ? 'Podés releerlo o completarlo.' : 'Tres preguntas de Séneca para cerrar el día.'}
            </p>
          </Link>
        </aside>
      </div>
    </div>
  );
}

const firstMomento = (hs: Habito[]) => Math.min(...hs.map((h) => h.momento), 3);

function UltimosSiete({ hoy, habitos }: { hoy: string; habitos: Habito[] }) {
  const registros = useDatos((s) => s.registros);
  const dias = [-6, -5, -4, -3, -2, -1, 0].map((o) => sumarDias(hoy, o));
  return (
    <div className="panel">
      <div className="grp cap" style={{ marginTop: 0 }}>
        <span>Últimos 7 días</span>
      </div>
      <div className="barras" role="img" aria-label="Porcentaje cumplido en los últimos 7 días">
        {dias.map((d) => {
          const hs = habitos.filter((h) => esDiaActivo(h, d));
          const ok = hs.filter((h) => cumplido(h, registrosDe(registros, h.id).get(d))).length;
          const p = hs.length ? Math.round((ok / hs.length) * 100) : 0;
          return (
            <div key={d} className={d === hoy ? 'hoy' : ''}>
              <span className="p">{hs.length ? `${p}%` : '—'}</span>
              <span className={`b ${p === 100 ? 'full' : ''}`} style={{ height: `${Math.max(3, p * 0.8)}px` }} />
              <span className="cap" style={{ fontSize: 10, color: 'var(--mu2)' }}>
                {DIAS_CORTOS[diaSemanaDeClave(d)].charAt(0)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Invita a activar los avisos en este dispositivo (el navegador solo pregunta al tocar un botón). */
function InvitarAvisos() {
  const { activa, ocupado, activar, soportado, bloqueado } = useNotificacionesDispositivo();
  const clave = 'stoica.invitacionAvisos';
  const [oculta, setOculta] = useState(() => {
    try {
      return localStorage.getItem(clave) === 'no';
    } catch {
      return false;
    }
  });
  if (activa || !soportado || bloqueado || oculta) return null;
  return (
    <div className="panel">
      <div className="grp cap" style={{ marginTop: 0 }}>
        <span>Recordatorios</span>
      </div>
      <p className="mu" style={{ fontSize: 13.5, fontWeight: 500, margin: '0 0 12px' }}>
        Activá los avisos en este dispositivo para que Stoica te recuerde tus prácticas y el examen nocturno.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn" style={{ width: 'auto', padding: '0 22px', height: 44 }} disabled={ocupado} onClick={() => activar(true)}>
          Activar avisos
        </button>
        <button
          type="button"
          className="link"
          onClick={() => {
            try {
              localStorage.setItem(clave, 'no');
            } catch {
              /* nada */
            }
            setOculta(true);
          }}
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}

function PanelComunidad() {
  const grupos = useComunidad((s) => s.grupos);
  // Sin grupos no se muestra: la Comunidad ya tiene su pestaña.
  if (grupos.size === 0) return null;
  return (
    <Link to="/comunidad" className="panel" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
      <div className="grp cap" style={{ marginTop: 0 }}>
        <span>Comunidad</span>
      </div>
      <div className="serif" style={{ fontSize: 19 }}>
        {`${grupos.size} ${grupos.size === 1 ? 'grupo' : 'grupos'}`}
      </div>
      <p className="mu" style={{ fontSize: 13.5, fontWeight: 500, marginTop: 6 }}>
        {[...grupos.values()].map((g) => g.grupo.nombre).join(' · ')}
      </p>
    </Link>
  );
}
