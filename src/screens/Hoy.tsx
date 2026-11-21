import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { citaDelDia } from '@core/citas';
import { DIAS_CORTOS, diaSemanaDeClave, diasRestantesDelAnio, fechaLargaDeClave, momentoDelDia, MOMENTOS, partesDeClave, partesEnZona, sumarDias } from '@core/fechas';
import { cumplido, esDiaActivo, racha, type Habito } from '@core/habitos';
import { primerNombre } from '@core/perfil';
import { Ficha, Grupo, iniciales, PanelDia, TuSemana, type DiaSemana } from '../../familia/react';
import { Icono as IconoFamilia } from '../../familia/iconos';
import { useRango } from '@/app/rango';
import { aRomano } from '@core/romanos';
import { examenCompleto, tareaDelDia, tareaHecha } from '@core/rutina';
import { useSesion } from '@/app/sesion';
import { useComunidad } from '@/app/comunidad';
import { alternarTarea, registrosDe, useDatos, useHabitosActivos, useHoy, VENTANA_DIAS } from '@/app/datos';
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
  const rango = useRango();
  const comunidad = useComunidad((st) => st.grupos.size > 0);
  const navegar = useNavigate();
  const ir = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    navegar(href);
  };
  // Tu semana (lunes a domingo): cumplido = todas las prácticas del día hechas
  const lunes = sumarDias(hoy, -((diaSemanaDeClave(hoy) + 6) % 7));
  const semana: DiaSemana[] = [0, 1, 2, 3, 4, 5, 6].map((o) => {
    const d = sumarDias(lunes, o);
    const r = hechosDe(d);
    return { fecha: d, hoy: d === hoy, hecho: d <= hoy && r.total > 0 && r.ok === r.total, plan: d > hoy && r.total > 0 };
  });
  const momentosDelDia = ([0, 1, 2] as const).filter((m) => delDia.some((h) => h.momento === m));
  const nTareas = momentosDelDia.length + 1;
  const nRail = momentosDelDia.length + (tareasDia.length > 0 ? 1 : 0);

  return (
    <div className="entra">
      <PanelDia
        nombre={primerNombre(perfil.nombre) || 'estoico'}
        avatar={
          <Link to="/perfil" className="panel-dia-iniciales" aria-label="Perfil">
            {iniciales(perfil.nombre)}
          </Link>
        }
        linea={
          <Link to="/jardin" className="rango" data-testid="rango">
            {rango.nombre} · Nivel {rango.nivel}
          </Link>
        }
        esquina={
          <Link to="/habitos/nuevo" className="btn-redondo" aria-label="Nuevo hábito">
            <IconoFamilia n="mas" size={20} />
          </Link>
        }
        fichas={
          <>
            {perfil.mementoMori && (
              <Ficha href="/memento" ir={ir}>
                Memento mori · {quedan} {quedan === 1 ? 'día' : 'días'}
              </Ficha>
            )}
            <Ficha href="/jardin" ir={ir}>
              <IconoFamilia n="laurel" size={16} />
              Tu jardín
            </Ficha>
          </>
        }
        lado={
          <figure className="cita-dia">
            <blockquote className="quote">“{cita.texto}”</blockquote>
            <figcaption className="grupo">{cita.autor}</figcaption>
          </figure>
        }
      />

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
                  <span className="cap" style={{ fontSize: 11, letterSpacing: '.1em' }}>
                    {DIAS_CORTOS[diaSemanaDeClave(d)]}
                  </span>
                  <span className="num" style={{ fontSize: 20 }}>
                    {partesDeClave(d).dia}
                  </span>
                  <span className={`punto ${off <= 0 ? punto : ''}`} />
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 16 }}>
            <span className="num" style={{ fontSize: 36, color: resumen.total && resumen.ok === resumen.total ? 'var(--verde)' : 'var(--tx)' }}>
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
              <div className="serif" style={{ fontSize: 20, marginTop: 12 }}>
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
                    <Grupo
                      n={momentosDelDia.indexOf(m) + 1}
                      className={`sep-grupo${m === firstMomento(delDia) ? ' sin-arriba' : ''}`}
                      extra={sel === 0 && momentoDelDia(hora) === m ? <span className="mu2 ahora">ahora</span> : undefined}
                    >
                      {MOMENTOS[m].replace(/^[IVX]+ · /, "")}
                    </Grupo>
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
              <Grupo n={nTareas} className="sep-grupo mt-[28px]">
                Tareas
              </Grupo>
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
          <div>
            <Grupo n={nRail + 1} className="sep-grupo sin-arriba">Tu semana</Grupo>
            <TuSemana dias={semana} texto="días cumplidos" />
          </div>
          <div className="panel">
            <Grupo n={nRail + 2} className="sep-grupo sin-arriba">Rachas</Grupo>
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
          <PanelComunidad n={nRail + 3} />
          <Link to="/examen" className="panel" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
            <Grupo n={nRail + (comunidad ? 4 : 3)} className="sep-grupo sin-arriba">Examen nocturno</Grupo>
            <div className="serif" style={{ fontSize: 20 }}>
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
      <Grupo className="sep-grupo sin-arriba">Recordatorios</Grupo>
      <p className="mu" style={{ fontSize: 13.5, fontWeight: 500, margin: '0 0 12px' }}>
        Activá los avisos en este dispositivo para que StoaHabit te recuerde tus prácticas y el examen nocturno.
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

function PanelComunidad({ n }: { n: number }) {
  const grupos = useComunidad((s) => s.grupos);
  // Sin grupos no se muestra: la Comunidad ya tiene su pestaña.
  if (grupos.size === 0) return null;
  return (
    <Link to="/comunidad" className="panel" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
      <Grupo n={n} className="sep-grupo sin-arriba">Comunidad</Grupo>
      <div className="serif" style={{ fontSize: 20 }}>
        {`${grupos.size} ${grupos.size === 1 ? 'grupo' : 'grupos'}`}
      </div>
      <p className="mu" style={{ fontSize: 13.5, fontWeight: 500, marginTop: 6 }}>
        {[...grupos.values()].map((g) => g.grupo.nombre).join(' · ')}
      </p>
    </Link>
  );
}
