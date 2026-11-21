/**
 * Jardín de otra persona del grupo (solo para mirar): las plantas reales de los hábitos que comparte
 * (su celular sube la etapa, los días sin marchitarse, los retoños y cómo acomodó su jardín).
 * Si el resumen es de una versión vieja de la app, la planta se aproxima con la racha y se acomoda sola.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { alCien, DIAS_PARA_MARCHITAR, ETAPAS_PLANTA, MARCHITA, PLANTA_DE_VIRTUD, plantaCompartida, rachaRetono, etapaPlanta } from '@core/jardin';
import { diferenciaDias } from '@core/fechas';
import { NOMBRE_VIRTUD, type Virtud } from '@core/habitos';
import type { Compartido, JardinCompartido } from '@core/comunidad';
import { Icono } from '@/ui/Iconos';
import { esNocheDeFuego, useAncho } from './escena';
import { PaginaRepisa } from './Repisa';
import { Escena, ESTILOS_ESCENA, type PlantaEnEscena } from './Escena';
import { ESTILOS_GRAFICOS } from './Graficos';
import { celdas, ubicar, type Forma } from './terreno';

interface Item {
  id: string;
  nombre: string;
  virtud: Virtud;
  etapa: number;
  racha: number | null;
  ciclo: number | null;
  retono: boolean;
}

interface Props {
  nombre: string;
  compartidos: Compartido[];
  jardin?: JardinCompartido;
  fecha: string;
  hoy: string;
  alCerrar: () => void;
  /** Laureles que le dejaron hoy en este grupo. */
  laureles?: number;
  /** Dejarle un laurel (no está si es tu propio jardín). */
  regalo?: { dado: boolean; alDar: () => void };
}

export default function JardinDeOtro({ nombre, compartidos, jardin, fecha, hoy, alCerrar, laureles = 0, regalo }: Props) {
  // Como en tu jardín: vertical en el celular, horizontal en la computadora (misma cuadrícula)
  const forma: Forma = useAncho() ? 'horizontal' : 'vertical';
  const [verRepisa, setVerRepisa] = useState(false);
  const [elegido, setElegido] = useState<string | null>(null);
  const hora = new Date().getHours();
  const ref = useRef<HTMLDivElement>(null);
  const [anchoPx, setAnchoPx] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const o = new ResizeObserver(([e]) => setAnchoPx(e.contentRect.width));
    o.observe(ref.current);
    return () => o.disconnect();
  }, []);

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
    return [...plantas, ...brotes];
  }, [compartidos, seco]);

  // Cómo acomodó sus macetas (si su app ya lo comparte); su repisa se llena con sus medallas
  const logros = jardin?.logros ?? 0;
  const acomodo = useMemo(() => ubicar(forma, items.map((i) => i.id), [], jardin?.pos.vertical ?? {}, {}), [forma, items, jardin]);
  const visibles = items.filter((i) => acomodo.lugar.has(i.id));
  const enEscena: PlantaEnEscena[] = visibles.map((i) => ({ id: i.id, nombre: i.nombre, virtud: i.virtud, etapa: i.etapa, retono: i.retono, celda: acomodo.lugar.get(i.id)! }));

  const sel = visibles.find((i) => i.id === elegido);
  const flor = visibles.filter((i) => alCien(i.etapa)).length;

  return createPortal(
    <div className="hoja-planta" role="dialog" aria-label={`Jardín de ${nombre}`} onClick={(e) => e.target === e.currentTarget && alCerrar()}>
      <style>{`
        ${ESTILOS_GRAFICOS}
        ${ESTILOS_ESCENA}
        .hoja-planta { position: fixed; inset: 0; z-index: 200; background: color-mix(in srgb, var(--bg) 70%, transparent); display: flex; justify-content: center; align-items: flex-end; }
        .hoja-planta > div { background: var(--bg); width: min(1000px, 100%); max-height: 94vh; overflow: auto; border-radius: 22px 22px 0 0; padding: 14px 16px 24px; }
        @media (min-width: 760px) { .hoja-planta { align-items: center } .hoja-planta > div { border-radius: 22px } }
      `}</style>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="cap gold">Jardín estoico</div>
            <h2 className="titulo" style={{ fontSize: 20, margin: 0 }}>
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
          <Escena
            forma={forma}
            plantas={enEscena}
            hora={hora}
            fuegos={[0, 1, 2, 3].map(() => esNocheDeFuego(hora))}
            logros={logros}
            repisaVisible
            alTocarRepisa={() => setVerRepisa(true)}
            anchoPx={anchoPx}
            refContenedor={ref}
            etiqueta={`Jardín de ${nombre} con ${visibles.length} plantas`}
            elegido={elegido}
          >
            {visibles.map((it) => {
              const c = celdas(forma)[acomodo.lugar.get(it.id)!];
              return (
                <button
                  key={`b-${it.id}`}
                  type="button"
                  aria-label={`${it.nombre}: ${PLANTA_DE_VIRTUD[it.virtud].nombre}, ${ETAPAS_PLANTA[it.etapa]}`}
                  aria-pressed={elegido === it.id}
                  onClick={() => setElegido(elegido === it.id ? null : it.id)}
                  style={{ position: 'absolute', left: `${c.x - c.w / 2}%`, top: `${c.y - c.h * 1.4}%`, width: `${c.w}%`, height: `${c.h * 1.85}%`, zIndex: 158, borderRadius: 12, background: 'transparent', border: 0, WebkitTapHighlightColor: 'transparent', outline: 'none' }}
                />
              );
            })}
          </Escena>
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
            {visibles.length} {visibles.length === 1 ? 'planta' : 'plantas'} · {flor} al 100 % · {logros} {logros === 1 ? 'medalla' : 'medallas'} en su repisa. Tocá una planta para ver de qué hábito es, o la repisa para ver sus logros.
          </p>
        )}

        {verRepisa && <PaginaRepisa titulo={`Repisa de ${nombre}`} logros={logros} alCerrar={() => setVerRepisa(false)} />}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          {regalo && (
            <button type="button" className={regalo.dado ? 'ghost' : 'btn'} style={{ width: 'auto', flex: '0 1 auto', padding: '0 18px', height: 44 }} disabled={regalo.dado} onClick={regalo.alDar}>
              <Icono nombre="planta" tam={17} />
              {regalo.dado ? 'Le dejaste un laurel hoy' : 'Dejarle un laurel'}
            </button>
          )}
          {laureles > 0 && (
            <span className="mu2" style={{ fontSize: 12.5 }}>
              Hoy {laureles === 1 ? 'recibió 1 laurel' : `recibió ${laureles} laureles`} del grupo.
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
