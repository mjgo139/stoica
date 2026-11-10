/**
 * Jardín de otra persona del grupo (solo para mirar): las plantas reales de los hábitos que comparte
 * (su celular sube la etapa, los días sin marchitarse y los retoños junto con el resumen del grupo).
 * Si el resumen es de una versión vieja de la app, la planta se aproxima con la racha.
 */
import { useEffect, useMemo, useState } from 'react';
import { alCien, DIAS_PARA_MARCHITAR, ETAPAS_PLANTA, MARCHITA, PLANTA_DE_VIRTUD, plantaCompartida, rachaRetono, etapaPlanta } from '@core/jardin';
import { diferenciaDias } from '@core/fechas';
import { NOMBRE_VIRTUD, type Virtud } from '@core/habitos';
import type { Compartido } from '@core/comunidad';
import { FONDOS } from './disposicion';
import { fuerzaNoche, maceterosOrdenados, tinte, ubicarPlanta, useAncho } from './escena';
import { Noche } from './Noche';
import { ESTILOS_GRAFICOS, Medalla } from './Graficos';

interface Item {
  id: string;
  nombre: string;
  virtud: Virtud;
  etapa: number;
  racha: number | null;
  ciclo: number | null;
  retono: boolean;
}

export default function JardinDeOtro({ nombre, compartidos, fecha, hoy, alCerrar }: { nombre: string; compartidos: Compartido[]; fecha: string; hoy: string; alCerrar: () => void }) {
  const forma = useAncho() ? 'horizontal' : 'vertical';
  const fondo = FONDOS[forma];
  const relacion = fondo.ancho / fondo.alto;
  const maceteros = useMemo(() => maceterosOrdenados(forma), [forma]);
  const [elegido, setElegido] = useState<string | null>(null);
  const hora = new Date().getHours();
  const t = tinte(hora);

  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [alCerrar]);

  const atraso = Math.max(0, diferenciaDias(fecha, hoy));
  // Si pasó días sin abrir la app no pudo cumplir nada: a los 3 días su jardín real ya está marchito.
  const seco = atraso >= DIAS_PARA_MARCHITAR;
  const aproximadas = compartidos.some((c) => !c.planta);

  const items = useMemo(() => {
    const plantas: Item[] = [];
    const brotes: Item[] = [];
    for (const c of compartidos) {
      const real = c.planta;
      const etapas = real ? real.retonos : Array.from({ length: plantaCompartida(c).retonos }, (_, k) => etapaPlanta(rachaRetono(c.racha, k), 0));
      const etapa = seco ? MARCHITA : real ? real.etapa : plantaCompartida(c).etapa;
      plantas.push({ id: c.habitId, nombre: c.nombre, virtud: c.virtud, etapa, racha: c.racha, ciclo: real && !seco ? real.ciclo : null, retono: false });
      if (!seco) etapas.forEach((e, k) => brotes.push({ id: `${c.habitId}-r${k}`, nombre: `Retoño de ${c.nombre}`, virtud: c.virtud, etapa: e, racha: null, ciclo: null, retono: true }));
    }
    return [...plantas, ...brotes].slice(0, maceteros.length);
  }, [compartidos, maceteros.length, seco]);

  const sel = items.find((i) => i.id === elegido);
  const flor = items.filter((i) => alCien(i.etapa)).length;

  return (
    <div className="hoja-planta" role="dialog" aria-label={`Jardín de ${nombre}`} onClick={(e) => e.target === e.currentTarget && alCerrar()}>
      <style>{`
        ${ESTILOS_GRAFICOS}
        @keyframes mecer { 0%,100% { transform: rotate(-1.2deg) } 50% { transform: rotate(1.2deg) } }
        .hoja-planta { position: fixed; inset: 0; z-index: 200; background: rgba(20,14,6,.55); display: flex; justify-content: center; align-items: flex-end; }
        .hoja-planta > div { background: var(--bg, #f4ede1); width: min(900px, 100%); max-height: 94vh; overflow: auto; border-radius: 22px 22px 0 0; padding: 14px 16px 24px; }
        @media (min-width: 760px) { .hoja-planta { align-items: center } .hoja-planta > div { border-radius: 22px } }
        .otro-planta { position: absolute; transform-origin: 50% 100%; pointer-events: none; }
        .otro-planta img { width: 100%; display: block; transform-origin: 50% 100%; animation: mecer 4.5s ease-in-out infinite; transition: filter .3s; }
        .otro-planta.seca img { animation: none; }
        .otro-planta.elegida img { filter: drop-shadow(0 0 6px rgba(255,214,120,.95)) drop-shadow(0 0 14px rgba(255,190,80,.6)); }
        .otro-medalla { position: absolute; transform: translate(-50%, -30%); pointer-events: none; animation: brillo-medalla 3s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .otro-planta img, .otro-medalla { animation: none } }
      `}</style>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="cap gold">Jardín estoico</div>
            <h2 className="titulo" style={{ fontSize: 22, margin: 0 }}>
              Jardín de {nombre}
            </h2>
          </div>
          <button type="button" className="ico" aria-label="Cerrar" onClick={alCerrar}>
            ✕
          </button>
        </div>
        <p className="mu2" style={{ fontSize: 12.5, margin: '4px 0 10px' }}>
          {compartidos.length === 1 ? 'Su planta real del hábito que comparte en este grupo.' : `Sus plantas reales de los ${compartidos.length} hábitos que comparte en este grupo.`}
          {atraso >= 1 && ` Actualizado hace ${atraso === 1 ? '1 día' : `${atraso} días`}${seco ? ': sin cumplir esos días, su jardín se marchitó' : ''}.`}
          {aproximadas && !seco && ' Todavía tiene una versión vieja de la app: hasta que la actualice, sus plantas se calculan con la racha.'}
        </p>

        <div className="card" style={{ padding: 0, overflow: 'hidden', border: 'none' }}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: `${fondo.ancho} / ${fondo.alto}`, background: `#d9c7a5 url(${fondo.archivo}) center / cover no-repeat` }} role="img" aria-label={`Jardín de ${nombre} con ${items.length} plantas`}>
            {items.map((it, i) => {
              const m = maceteros[i];
              const planta = PLANTA_DE_VIRTUD[it.virtud].id;
              const u = ubicarPlanta(planta, it.etapa, m, relacion, it.retono);
              return (
                <div key={it.id}>
                  <div className={`otro-planta${it.etapa === MARCHITA ? ' seca' : ''}${elegido === it.id ? ' elegida' : ''}`} style={{ left: `${u.left}%`, top: `${u.top}%`, width: `${u.ancho}%`, zIndex: 2 + Math.round(m.y) }}>
                    <img src={`/jardin/${planta}-${it.etapa}.webp`} alt="" draggable={false} style={{ animationDelay: `${-(i * 0.7) % 4.5}s` }} />
                  </div>
                  {alCien(it.etapa) && (
                    <span className="otro-medalla" style={{ left: `${m.x + m.w * 0.36}%`, top: `${m.y + m.h * 0.75}%`, zIndex: 66 }}>
                      <Medalla tipo="Oro" dias={100} tam={it.retono ? 22 : 28} />
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`${it.nombre}: ${PLANTA_DE_VIRTUD[it.virtud].nombre}, ${ETAPAS_PLANTA[it.etapa]}`}
                    aria-pressed={elegido === it.id}
                    onClick={() => setElegido(elegido === it.id ? null : it.id)}
                    style={{ position: 'absolute', left: `${m.x - m.w * 0.55}%`, top: `${m.y - m.h * 2.4}%`, width: `${m.w * 1.1}%`, height: `${m.h * 3}%`, zIndex: 70, borderRadius: 12, background: 'transparent', border: 0, WebkitTapHighlightColor: 'transparent', outline: 'none' }}
                  />
                </div>
              );
            })}
            <div style={{ position: 'absolute', inset: 0, background: t.color, opacity: t.opacidad, mixBlendMode: 'multiply', pointerEvents: 'none', zIndex: 50 }} />
            <Noche forma={forma} fuerza={fuerzaNoche(hora)} />
          </div>
        </div>

        {sel ? (
          <div className="card" style={{ marginTop: 10, padding: '10px 14px', display: 'flex', gap: 12, alignItems: 'center' }}>
            <img src={`/jardin/${PLANTA_DE_VIRTUD[sel.virtud].id}-${sel.etapa}.webp`} alt="" style={{ width: 52, height: 52, objectFit: 'contain' }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800 }}>{sel.nombre}</div>
              <div className="mu2" style={{ fontSize: 12.5 }}>
                {PLANTA_DE_VIRTUD[sel.virtud].nombre} ({NOMBRE_VIRTUD[sel.virtud]}) · {ETAPAS_PLANTA[sel.etapa]}
                {sel.racha !== null && ` · racha ${sel.racha}`}
                {sel.ciclo !== null && ` · ${sel.ciclo} días sin marchitarse`}
                {alCien(sel.etapa) && ' · 100 %'}
              </div>
            </div>
          </div>
        ) : (
          <p className="mu2" style={{ fontSize: 12.5, marginTop: 8 }}>
            {items.length} {items.length === 1 ? 'planta' : 'plantas'} · {flor} al 100 %. Tocá una planta para ver de qué hábito es.
          </p>
        )}
      </div>
    </div>
  );
}
