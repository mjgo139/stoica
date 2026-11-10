import { useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useSesion } from '@/app/sesion';
import { alCien, DIAS_PARA_MARCHITAR, DIAS_POR_RETONO, ETAPAS_PLANTA, faltanParaCrecer, MARCHITA, MAX_RETONOS, PLANTA_DE_VIRTUD, UMBRALES } from '@core/jardin';
import { NOMBRE_VIRTUD, type Habito } from '@core/habitos';
import { alternarSiNo, useDatos, useHabitosActivos, useHoy } from '@/app/datos';
import { ESTILOS_GRAFICOS, Medalla } from './Graficos';
import { Icono } from '@/ui/Iconos';
import { calcularJardin, useGuardado, type PlantaCalc, type RetonoCalc } from './estado';

/** Página de una planta (ruta /jardin/:id). Dentro del jardín se abre la misma vista encima. */
export function PlantaJardin() {
  const { id } = useParams();
  const uid = useSesion((s) => s.usuario?.uid ?? '');
  const hoy = useHoy();
  const habitos = useHabitosActivos();
  const registros = useDatos((s) => s.registros);
  const [g, setG] = useGuardado(uid);
  const jardin = useMemo(() => calcularJardin({ habitos, registros, hoy, g, prueba: null }), [habitos, registros, hoy, g]);
  const p = jardin.plantas.find((x) => x.id === id);
  if (!p || !p.habito) return <Navigate to="/jardin" replace />;
  return (
    <div className="entra" style={{ maxWidth: 760, marginInline: 'auto' }}>
      <Link to="/jardin" className="link" style={{ paddingLeft: 0 }}>
        ‹ Volver al jardín
      </Link>
      <VistaPlanta
        p={p}
        retonos={jardin.retonos.filter((r) => r.madre.id === p.id)}
        dificil={g.dificil}
        prueba={false}
        alMarcar={(h) => void alternarSiNo(h, hoy)}
        alRegar={() => setG((x) => ({ ...x, riegos: { ...x.riegos, [p.id]: [...(x.riegos[p.id] ?? []).filter((d) => d !== hoy), hoy] } }))}
      />
    </div>
  );
}

/** Todo sobre una planta: estado, medalla, retoños y últimos 30 días. */
export function VistaPlanta({ p, retonos, dificil, prueba, alMarcar, alRegar }: { p: PlantaCalc; retonos: RetonoCalc[]; dificil: boolean; prueba: boolean; alMarcar: (h: Habito) => void; alRegar: () => void }) {
  const especie = PLANTA_DE_VIRTUD[p.virtud];
  const falta = faltanParaCrecer(p.ciclo, p.a.etapa);
  const h = p.habito;
  const cien = alCien(p.a.etapa);
  const proximoRetono = DIAS_POR_RETONO - (p.ciclo % DIAS_POR_RETONO);
  return (
    <>
      <style>{`
        ${ESTILOS_GRAFICOS}
        @keyframes mecer { 0%,100% { transform: rotate(-1deg) } 50% { transform: rotate(1deg) } }
        .planta-grande { width: min(62%, 280px); display: block; margin: 0 auto; transform-origin: 50% 100%; animation: mecer 5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .planta-grande { animation: none } }
      `}</style>
      <div className="cap gold" style={{ marginTop: 6 }}>
        {especie.nombre} · {NOMBRE_VIRTUD[p.virtud]}
      </div>
      <h1 className="titulo">{p.nombre}</h1>

      <div className="card" style={{ marginTop: 12, padding: '18px 16px 14px', background: 'radial-gradient(ellipse at 50% 35%, #fff4dc 0%, #ead7b2 60%, #d9c19a 100%)', border: 'none', position: 'relative', isolation: 'isolate', overflow: 'hidden' }}>
        <img className="planta-grande" src={`/jardin/${especie.id}-${p.a.etapa}.webp`} alt={`${especie.nombre}: ${ETAPAS_PLANTA[p.a.etapa]}`} />
        {cien && (
          <div style={{ position: 'absolute', right: 14, top: 12, textAlign: 'center' }}>
            <Medalla tipo="Oro" dias={100} tam={44} />
            <div style={{ fontSize: 11, fontWeight: 800, color: '#6b4a10' }}>100 %</div>
          </div>
        )}
        <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 18, marginTop: 8, color: '#3b2a12' }}>{ETAPAS_PLANTA[p.a.etapa]}</div>
        <div style={{ textAlign: 'center', fontSize: 13, color: '#5a4524' }}>
          {p.a.etapa === MARCHITA
            ? `Lleva ${p.a.sinCumplir} días sin cumplir. Cumplilo hoy y revive como brote.`
            : p.riesgo > 0
              ? `${p.a.sinCumplir} ${p.a.sinCumplir === 1 ? 'día' : 'días'} sin cumplir: a los ${DIAS_PARA_MARCHITAR} se marchita${cien ? ' y pierde la medalla' : ''}.`
              : cien
                ? 'Al 100 %: lleva la medalla de laurel mientras no se marchite.'
                : `Te ${falta === 1 ? 'falta 1 día' : `faltan ${falta} días`} para que sea ${ETAPAS_PLANTA[p.a.etapa + 1].toLowerCase()}.`}
        </div>
        {/* Barra hasta el 100 % */}
        {p.a.etapa !== MARCHITA && (
          <div style={{ height: 8, borderRadius: 5, background: 'rgba(90,69,36,.18)', marginTop: 10, overflow: 'hidden' }} aria-label="Avance hasta el 100 %">
            <div style={{ height: '100%', width: `${Math.min(100, (p.ciclo / UMBRALES[4]) * 100)}%`, background: 'linear-gradient(90deg, #8aa04a, #d9a92a)' }} />
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 12, padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
          {[
            [p.a.racha, 'días de racha'],
            [p.ciclo, 'días sin marchitarse'],
            [p.mejor, 'récord sin marchitarse'],
            [`${p.retonos}/${MAX_RETONOS}`, 'retoños'],
          ].map(([n, t]) => (
            <div key={t as string}>
              <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{n}</div>
              <div className="mu2" style={{ fontSize: 11 }}>
                {t}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12, padding: '12px 16px' }}>
        <div className="cap gold">Retoños</div>
        {p.retonos === 0 ? (
          <p className="mu2" style={{ fontSize: 13, marginTop: 6 }}>
            Cada {DIAS_POR_RETONO} días cumplidos sin que se marchite, esta planta da un retoño. Te {proximoRetono === 1 ? 'falta 1 día' : `faltan ${proximoRetono} días`} para el primero.
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
              {retonos.map((r) => (
                <div key={r.id} style={{ textAlign: 'center', position: 'relative' }}>
                  <img src={`/jardin/${especie.id}-${r.etapa}.webp`} alt="" style={{ width: 64, height: 64, objectFit: 'contain' }} />
                  {alCien(r.etapa) && (
                    <span style={{ position: 'absolute', right: -6, bottom: 14 }}>
                      <Medalla tipo="Oro" dias={100} tam={20} />
                    </span>
                  )}
                  <div style={{ fontSize: 11.5 }}>{ETAPAS_PLANTA[r.etapa]}</div>
                </div>
              ))}
              {p.retonos > retonos.length && <div className="mu2" style={{ fontSize: 12, alignSelf: 'center' }}>+{p.retonos - retonos.length} en el vivero</div>}
            </div>
            <p className="mu2" style={{ fontSize: 12.5, marginTop: 6 }}>
              {dificil ? 'Modo difícil: si CUALQUIER planta del jardín se marchita, perdés todos los retoños.' : `Si esta planta se marchita (${DIAS_PARA_MARCHITAR} días sin cumplir), perdés sus retoños.`}
              {p.retonos < MAX_RETONOS && ` Próximo retoño en ${proximoRetono} días.`}
            </p>
          </>
        )}
      </div>

      <div className="card" style={{ marginTop: 12, padding: '12px 16px' }}>
        <div className="cap gold">Últimos 30 días</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
          {p.historia.map((d, i) => {
            const hoyPend = d === false && i === p.historia.length - 1 && !prueba;
            return (
              <span
                key={i}
                title={d === null ? 'no tocaba' : d ? 'cumplido' : hoyPend ? 'hoy, pendiente' : 'sin cumplir'}
                style={{ width: 16, height: 16, borderRadius: 5, background: d === null ? 'var(--ln)' : d ? 'var(--gold)' : hoyPend ? 'transparent' : '#b5473a', border: hoyPend ? '2px dashed var(--gold)' : 'none' }}
              />
            );
          })}
        </div>
      </div>

      {h && !prueba && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {h.tipo === 'sino' && (
            <button type="button" className="btn" style={{ width: 'auto', flex: '1 1 200px' }} onClick={() => alMarcar(h)}>
              {p.hechoHoy ? 'Desmarcar hoy' : 'Marcar hoy'}
            </button>
          )}
          {p.pideAgua && (
            <button type="button" className="ghost" onClick={alRegar}>
              <Icono nombre="gota" tam={16} /> Regar
            </button>
          )}
          <Link to={`/habitos/${h.id}`} className="ghost">
            Ver hábito
          </Link>
        </div>
      )}
    </>
  );
}
