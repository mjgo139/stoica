import { useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useSesion } from '@/app/sesion';
import { DIAS_PARA_MARCHITAR, DIAS_POR_RETONO, ETAPAS_PLANTA, faltanParaCrecer, MARCHITA, MAX_RETONOS, MEDALLAS, PASIONES, PLANTA_DE_VIRTUD } from '@core/jardin';
import { NOMBRE_VIRTUD } from '@core/habitos';
import { alternarSiNo, useDatos, useHabitosActivos, useHoy } from '@/app/datos';
import { Bicho, ESTILOS_GRAFICOS, Medalla } from './Graficos';
import { calcularJardin, useGuardado } from './estado';

/** Página de una planta: su estado, medallas, retoños y los últimos 30 días. */
export function PlantaJardin() {
  const perfil = useSesion((s) => s.perfil);
  if (perfil?.rol !== 'admin') return <Navigate to="/" replace />;
  return <Pagina />;
}

function Pagina() {
  const { id } = useParams();
  const uid = useSesion((s) => s.usuario?.uid ?? '');
  const hoy = useHoy();
  const habitos = useHabitosActivos();
  const registros = useDatos((s) => s.registros);
  const [g, setG] = useGuardado(uid);
  const jardin = useMemo(() => calcularJardin({ habitos, registros, hoy, g, prueba: null }), [habitos, registros, hoy, g]);
  const p = jardin.plantas.find((x) => x.id === id);
  if (!p || !p.habito) return <Navigate to="/jardin" replace />;
  const h = p.habito;
  const especie = PLANTA_DE_VIRTUD[p.virtud];
  const falta = faltanParaCrecer(p.ciclo, p.a.etapa);
  const proxima = MEDALLAS.find((m) => p.mejor < m.dias);
  const retonosVisibles = jardin.retonos.filter((r) => r.madre.id === p.id);

  const regar = () => {
    setG((x) => ({ ...x, riegos: { ...x.riegos, [p.id]: [...(x.riegos[p.id] ?? []).filter((d) => d !== hoy), hoy] } }));
  };

  return (
    <div className="entra" style={{ maxWidth: 760, marginInline: 'auto' }}>
      <style>{`
        ${ESTILOS_GRAFICOS}
        @keyframes mecer { 0%,100% { transform: rotate(-1deg) } 50% { transform: rotate(1deg) } }
        .planta-grande { width: min(62%, 280px); display: block; margin: 0 auto; transform-origin: 50% 100%; animation: mecer 5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .planta-grande { animation: none } }
      `}</style>
      <Link to="/jardin" className="link" style={{ paddingLeft: 0 }}>
        ‹ Volver al jardín
      </Link>
      <div className="cap gold" style={{ marginTop: 6 }}>
        {especie.nombre} · {NOMBRE_VIRTUD[p.virtud]}
      </div>
      <h1 className="titulo">{p.nombre}</h1>

      <div className="card" style={{ marginTop: 12, padding: '18px 16px 14px', background: 'radial-gradient(ellipse at 50% 35%, #fff4dc 0%, #ead7b2 60%, #d9c19a 100%)', border: 'none', position: 'relative', overflow: 'hidden' }}>
        <img className="planta-grande" src={`/jardin/${especie.id}-${p.a.etapa}.webp`} alt={`${especie.nombre}: ${ETAPAS_PLANTA[p.a.etapa]}`} />
        {p.plaga > 0 && (
          <div style={{ position: 'absolute', left: '50%', top: '38%', display: 'flex', gap: 24, transform: 'translate(-50%,-50%)' }} aria-hidden>
            {Array.from({ length: p.plaga === 1 ? 1 : 3 }, (_, k) => (
              <span key={k} style={{ animation: `vaiven ${1 + k * 0.3}s ease-in-out infinite` }}>
                <Bicho pasion={PASIONES[k % PASIONES.length].id} tam={30} />
              </span>
            ))}
          </div>
        )}
        <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 18, marginTop: 8, color: '#3b2a12' }}>{ETAPAS_PLANTA[p.a.etapa]}</div>
        <div style={{ textAlign: 'center', fontSize: 13, color: '#5a4524' }}>
          {p.a.etapa === MARCHITA
            ? `Lleva ${p.a.sinCumplir} días sin cumplir. Cumplilo hoy y revive como brote.`
            : p.plaga > 0
              ? `Las pasiones la rondan: ${p.a.sinCumplir} ${p.a.sinCumplir === 1 ? 'día' : 'días'} sin cumplir. A los ${DIAS_PARA_MARCHITAR} se marchita.`
              : falta === null
                ? '¡Florecida!'
                : `Te ${falta === 1 ? 'falta 1 día' : `faltan ${falta} días`} para que sea ${ETAPAS_PLANTA[p.a.etapa + 1].toLowerCase()}.`}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12, padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
          {[
            [p.a.racha, 'días de racha'],
            [p.mejor, 'récord sin marchitarse'],
            [p.ciclo, 'días sin marchitarse'],
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
        <div className="cap gold">Medallas</div>
        <div style={{ display: 'flex', gap: 18, marginTop: 10, alignItems: 'flex-end' }}>
          {MEDALLAS.map((m) => {
            const tiene = p.mejor >= m.dias;
            return (
              <div key={m.nombre} style={{ textAlign: 'center', opacity: tiene ? 1 : 0.28, filter: tiene ? 'none' : 'grayscale(1)' }}>
                <Medalla tipo={m.nombre} dias={m.dias} tam={46} />
                <div style={{ fontSize: 11.5, fontWeight: 700 }}>{m.nombre}</div>
                <div className="mu2" style={{ fontSize: 11 }}>
                  {m.dias} días
                </div>
              </div>
            );
          })}
        </div>
        <p className="mu2" style={{ fontSize: 12.5, marginTop: 8 }}>
          {proxima ? `Te ${proxima.dias - p.mejor === 1 ? 'falta 1 día' : `faltan ${proxima.dias - p.mejor} días`} sin marchitarse para la de ${proxima.nombre.toLowerCase()}. Las medallas no se pierden.` : '¡Tenés todas las medallas!'}
        </p>
      </div>

      <div className="card" style={{ marginTop: 12, padding: '12px 16px' }}>
        <div className="cap gold">Retoños</div>
        {p.retonos === 0 ? (
          <p className="mu2" style={{ fontSize: 13, marginTop: 6 }}>
            Cada {DIAS_POR_RETONO} días cumplidos sin que se marchite, esta planta da un retoño. Te {DIAS_POR_RETONO - (p.ciclo % DIAS_POR_RETONO) === 1 ? 'falta 1 día' : `faltan ${DIAS_POR_RETONO - (p.ciclo % DIAS_POR_RETONO)} días`} para el primero.
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
              {retonosVisibles.map((r) => (
                <div key={r.id} style={{ textAlign: 'center' }}>
                  <img src={`/jardin/${especie.id}-${r.etapa}.webp`} alt="" style={{ width: 64, height: 64, objectFit: 'contain' }} />
                  <div style={{ fontSize: 11.5 }}>{ETAPAS_PLANTA[r.etapa]}</div>
                </div>
              ))}
              {p.retonos > retonosVisibles.length && <div className="mu2" style={{ fontSize: 12, alignSelf: 'center' }}>+{p.retonos - retonosVisibles.length} en el vivero</div>}
            </div>
            <p className="mu2" style={{ fontSize: 12.5, marginTop: 6 }}>
              {g.dificil ? 'Modo difícil: si CUALQUIER planta del jardín se marchita, perdés todos los retoños.' : `Si esta planta se marchita (${DIAS_PARA_MARCHITAR} días sin cumplir), perdés sus retoños.`}
              {p.retonos < MAX_RETONOS && ` Próximo retoño en ${DIAS_POR_RETONO - (p.ciclo % DIAS_POR_RETONO)} días.`}
            </p>
          </>
        )}
      </div>

      <div className="card" style={{ marginTop: 12, padding: '12px 16px' }}>
        <div className="cap gold">Últimos 30 días</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
          {p.historia.map((d, i) => (
            <span key={i} title={d === null ? 'no tocaba' : d ? 'cumplido' : i === p.historia.length - 1 ? 'hoy, pendiente' : 'sin cumplir'} style={{ width: 16, height: 16, borderRadius: 5, background: d === null ? 'var(--ln)' : d ? 'var(--gold)' : i === p.historia.length - 1 ? 'transparent' : '#b5473a', border: d === false && i === p.historia.length - 1 ? '2px dashed var(--gold)' : 'none' }} />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        {h.tipo === 'sino' && (
          <button type="button" className="btn" style={{ width: 'auto', flex: '1 1 200px' }} onClick={() => void alternarSiNo(h, hoy)}>
            {p.hechoHoy ? 'Desmarcar hoy' : 'Marcar hoy'}
          </button>
        )}
        {p.pideAgua && (
          <button type="button" className="ghost" onClick={regar}>
            💧 Regar
          </button>
        )}
        <Link to={`/habitos/${h.id}`} className="ghost">
          Ver hábito
        </Link>
      </div>
    </div>
  );
}
