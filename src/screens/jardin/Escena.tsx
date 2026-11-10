/**
 * Dibujo del jardín (compartido entre tu jardín y el de otra persona del grupo):
 * la terraza, la repisa de logros, los 4 braseros, las macetas con sus plantas, la luz según la hora y la noche.
 * Lo interactivo (tocar, mover, el filósofo) lo agrega quien la usa como `children` o con los avisos.
 */
import type { ReactNode, Ref } from 'react';
import { alCien, MARCHITA, PLANTA_DE_VIRTUD } from '@core/jardin';
import type { Virtud } from '@core/habitos';
import { ADORNOS, BRASERO, FONDOS, FUEGO, MACETA, ORDEN_NICHOS, REGADERA, REPISA } from './disposicion';
import { Noche, type Luz } from './Noche';
import { Medalla } from './Graficos';
import { anchoMaceta, fuerzaNoche, tinte, ubicarPlanta, type Forma } from './escena';
import { BRASEROS } from './terreno';

export interface PlantaEnEscena {
  id: string;
  nombre: string;
  virtud: Virtud;
  etapa: number;
  retono: boolean;
  celda: number;
}

export const ESTILOS_ESCENA = `
  @keyframes mecer { 0%,100% { transform: rotate(-1.2deg) } 50% { transform: rotate(1.2deg) } }
  @keyframes revivir { from { transform: scale(.6); opacity: 0 } to { transform: scale(1); opacity: 1 } }
  @keyframes saltito { 0%,100% { transform: scale(1) } 40% { transform: scale(1.06, .95) } 70% { transform: scale(.98, 1.03) } }
  @keyframes prender { 0% { transform: translate(-50%, -100%) scale(.15); opacity: 0 } 60% { transform: translate(-50%, -100%) scale(1.15); opacity: 1 } 100% { transform: translate(-50%, -100%) scale(1); opacity: 1 } }
  @keyframes crecer { 0% { transform: scale(1) } 30% { transform: scale(1.18) } 60% { transform: scale(.96) } 100% { transform: scale(1) } }
  @keyframes rayos { from { transform: translate(-50%, -50%) rotate(0deg) } to { transform: translate(-50%, -50%) rotate(360deg) } }
  @keyframes regar { 0% { opacity: 0; transform: translate(-10%, -100%) rotate(0deg) } 15% { opacity: 1 } 35%,75% { transform: translate(-10%, -100%) rotate(-28deg) } 100% { opacity: 0; transform: translate(-10%, -100%) rotate(0deg) } }
  .esc-maceta { position: absolute; pointer-events: none; }
  .esc-maceta img { width: 100%; display: block; }
  .esc-planta { position: absolute; transform-origin: 50% 100%; pointer-events: none; }
  .esc-planta img { width: 100%; display: block; transform-origin: 50% 100%; animation: revivir .5s ease-out, mecer 4.5s ease-in-out .5s infinite; transition: filter .4s; }
  .esc-planta.seca img { animation: revivir .5s ease-out; }
  .esc-planta.elegida img { filter: drop-shadow(0 0 6px rgba(255,214,120,.95)) drop-shadow(0 0 14px rgba(255,190,80,.6)); }
  .esc-planta.regando { animation: saltito .9s ease-out .5s; }
  .esc-planta.regando img { filter: drop-shadow(0 0 8px rgba(150,215,255,.95)) brightness(1.08); }
  .esc-planta.crece { animation: crecer 1.4s ease-out; }
  .esc-planta.levantada { opacity: .35; }
  .esc-regadera { position: absolute; transform-origin: 20% 80%; pointer-events: none; animation: regar 1.6s ease-in-out forwards; filter: drop-shadow(0 4px 4px rgba(0,0,0,.3)); }
  .esc-brasero { position: absolute; pointer-events: none; filter: drop-shadow(1px 4px 3px rgba(60,40,10,.35)); }
  .esc-brasero img { width: 100%; display: block; }
  .esc-fuego { position: absolute; transform: translate(-50%, -100%); pointer-events: none; }
  .esc-fuego.prende { animation: prender 1.2s ease-out; }
  .esc-medalla { position: absolute; transform: translate(-50%, -30%); animation: brillo-medalla 3s ease-in-out infinite; background: none; border: 0; padding: 0; cursor: pointer; }
  .esc-repisa { position: absolute; overflow: hidden; }
  .esc-repisa-dentro { position: absolute; inset: 0; transition: transform 1.5s cubic-bezier(.5,.05,.3,1); }
  .esc-repisa-dentro.oculta { transform: translateY(102%); }
  .esc-repisa img.fondo { width: 100%; height: 100%; display: block; }
  .esc-nicho { position: absolute; transform: translate(-50%, -100%); display: flex; align-items: flex-end; justify-content: center; }
  .esc-nicho img { width: 100%; display: block; filter: drop-shadow(0 2px 2px rgba(60,40,10,.35)); }
  @media (prefers-reduced-motion: reduce) { .esc-planta img, .esc-medalla, .esc-fuego, .esc-planta.crece, .esc-regadera, .esc-repisa-dentro { animation: none; transition: none } }
`;

/** Qué hay en cada nicho de la repisa: los adornos desbloqueados y, después, una medalla por cada medalla extra. */
export function nichosDeRepisa(logros: number): Array<{ fila: number; col: number; adorno: string | null; medalla: boolean }> {
  const res: Array<{ fila: number; col: number; adorno: string | null; medalla: boolean }> = [];
  for (let k = 0; k < Math.min(logros, ORDEN_NICHOS.length); k++) {
    const [fila, col] = ORDEN_NICHOS[k];
    res.push({ fila, col, adorno: ADORNOS[k]?.id ?? null, medalla: !ADORNOS[k] });
  }
  return res;
}

interface Props {
  forma: Forma;
  plantas: PlantaEnEscena[];
  hora: number;
  /** Braseros encendidos (por índice de BRASEROS). */
  fuegos: boolean[];
  /** El brasero que se está prendiendo ahora (animación). */
  prendiendo?: number | null;
  /** Medallas ganadas: llenan la repisa. */
  logros: number;
  repisaVisible: boolean;
  alTocarRepisa?: () => void;
  anchoPx: number;
  refContenedor?: Ref<HTMLDivElement>;
  etiqueta: string;
  elegido?: string | null;
  regando?: Set<string>;
  creciendo?: string | null;
  /** La maceta que se está moviendo (se ve transparente en su lugar). */
  levantada?: string | null;
  /** Medalla al pie de la maceta: tocarla abre la página de la planta. */
  alTocarMedalla?: (id: string) => void;
  /** Lo que va encima (zonas tocables, el filósofo, la cuadrícula). Por encima de la luz de la hora: zIndex > 152. */
  children?: ReactNode;
  /** Algo encima de cada maceta (por ejemplo la gota de "pide agua"). */
  sobrePlanta?: (p: PlantaEnEscena, punta: { x: number; y: number }) => ReactNode;
}

export function Escena({ forma, plantas, hora, fuegos, prendiendo, logros, repisaVisible, alTocarRepisa, anchoPx, refContenedor, etiqueta, elegido, regando, creciendo, levantada, alTocarMedalla, children, sobrePlanta }: Props) {
  const fondo = FONDOS[forma];
  const relacion = fondo.ancho / fondo.alto;
  const t = tinte(hora);
  const pxPorPct = anchoPx / 100;
  const braseros = BRASEROS[forma].map((b, i) => {
    const ancho = anchoMaceta(forma, b.y) * 0.78;
    const alto = ancho * relacion * (BRASERO.h / BRASERO.w);
    return { ...b, i, ancho, alto, left: b.x - ancho / 2, top: b.y - alto };
  });
  // Luz de noche: los braseros encendidos
  const luces: Luz[] = braseros.filter((b) => fuegos[b.i]).map((b) => ({ x: b.x, y: b.top + b.alto * 0.25, r: Math.max(55, b.ancho * pxPorPct * 1.9) }));
  // Repisa
  const R = REPISA.lugar[forma];
  const altoRepisa = R.ancho * relacion * (REPISA.h / REPISA.w);
  const nichos = nichosDeRepisa(logros);
  return (
    <div
      ref={refContenedor}
      style={{ position: 'relative', isolation: 'isolate', width: '100%', aspectRatio: `${fondo.ancho} / ${fondo.alto}`, background: `#d9c7a5 url(${fondo.archivo}) center / cover no-repeat` }}
      aria-label={etiqueta}
      role="img"
    >
      {(
        <div className="esc-repisa" style={{ left: `${R.x}%`, top: `${R.piso - altoRepisa}%`, width: `${R.ancho}%`, height: `${altoRepisa}%`, zIndex: 2 }}>
          <div className={`esc-repisa-dentro${repisaVisible ? '' : ' oculta'}`} data-repisa={repisaVisible ? 'visible' : 'oculta'}>
            <img className="fondo" src={REPISA.archivo} alt="" draggable={false} />
            {nichos.map((n) => {
              const fila = REPISA.filas[n.fila];
              const a = n.adorno ? ADORNOS.find((x) => x.id === n.adorno)! : null;
              // Ancho en % de la repisa, sin pasarse del alto del nicho
              let w = REPISA.anchoNicho * 0.92;
              if (a) {
                const altoPct = w * (REPISA.w / REPISA.h) * (a.h / a.w);
                if (altoPct > fila.alto * 0.95) w = (fila.alto * 0.95) / ((REPISA.w / REPISA.h) * (a.h / a.w));
              }
              return (
                <span key={`${n.fila}-${n.col}`} className="esc-nicho" style={{ left: `${REPISA.columnas[n.col]}%`, top: `${fila.piso}%`, width: `${w}%` }}>
                  {a ? <img src={`/jardin/adorno-${a.id}.webp`} alt="" draggable={false} /> : <Medalla tipo="Oro" dias={100} tam={Math.max(14, (anchoPx * R.ancho * w) / 10000)} />}
                </span>
              );
            })}
          </div>
        </div>
      )}
      {braseros.map((b) => (
        <div key={`brasero-${b.i}`}>
          <div className="esc-brasero" style={{ left: `${b.left}%`, top: `${b.top}%`, width: `${b.ancho}%`, zIndex: 3 + Math.round(b.y) }}>
            <img src={BRASERO.apagado} alt="" draggable={false} />
          </div>
          {fuegos[b.i] && (
            <img
              className={`esc-fuego${prendiendo === b.i ? ' prende' : ''}`}
              src={FUEGO.archivo}
              alt=""
              draggable={false}
              data-fuego="encendido"
              style={{ left: `${b.x}%`, top: `${b.top + (b.alto * (FUEGO.sobre.y + 3)) / 100}%`, width: `${(b.ancho * FUEGO.sobre.w * 1.15) / 100}%`, zIndex: 152 }}
            />
          )}
        </div>
      ))}
      {plantas.map((p, i) => {
        const especie = PLANTA_DE_VIRTUD[p.virtud].id;
        const u = ubicarPlanta(forma, especie, p.etapa, p.celda, p.retono);
        const m = u.maceta;
        const z = 3 + Math.round(m.piso);
        const fuera = levantada === p.id;
        return (
          <div key={p.id}>
            <div className="esc-maceta" style={{ left: `${m.left}%`, top: `${m.top}%`, width: `${m.w}%`, zIndex: z, opacity: fuera ? 0.35 : 1 }}>
              <img src={MACETA.archivo} alt="" draggable={false} />
            </div>
            <div
              className={`esc-planta${p.etapa === MARCHITA ? ' seca' : ''}${regando?.has(p.id) ? ' regando' : ''}${elegido === p.id ? ' elegida' : ''}${creciendo === p.id ? ' crece' : ''}${fuera ? ' levantada' : ''}`}
              style={{ left: `${u.left}%`, top: `${u.top}%`, width: `${u.ancho}%`, zIndex: z }}
            >
              <img key={`${especie}-${p.etapa}`} src={`/jardin/${especie}-${p.etapa}.webp`} alt="" draggable={false} style={{ animationDelay: `0s, ${-(i * 0.7) % 4.5}s` }} />
            </div>
            {regando?.has(p.id) && <img className="esc-regadera" src={REGADERA.archivo} alt="" style={{ left: `${m.plantaX - m.w * 0.15}%`, top: `${Math.min(u.top, m.top - m.h * 0.2)}%`, width: `${m.w * 0.85}%`, zIndex: 160 }} />}
            {alCien(p.etapa) &&
              (alTocarMedalla ? (
                <button
                  type="button"
                  className="esc-medalla"
                  aria-label={`${p.nombre} está al 100 %: ver su página`}
                  onClick={() => alTocarMedalla(p.id)}
                  style={{ left: `${m.left + m.w * 0.84}%`, top: `${m.top + m.h * 0.7}%`, zIndex: 159, animationDelay: `${-i * 0.4}s` }}
                >
                  <Medalla tipo="Oro" dias={100} tam={Math.max(22, m.w * pxPorPct * (p.retono ? 0.3 : 0.36))} />
                </button>
              ) : (
                <span className="esc-medalla" style={{ left: `${m.left + m.w * 0.84}%`, top: `${m.top + m.h * 0.7}%`, zIndex: z + 1, cursor: 'default' }} aria-hidden>
                  <Medalla tipo="Oro" dias={100} tam={Math.max(20, m.w * pxPorPct * 0.32)} />
                </span>
              ))}
            {sobrePlanta?.(p, { x: m.plantaX, y: u.top })}
          </div>
        );
      })}
      {repisaVisible && alTocarRepisa && (
        <button
          type="button"
          aria-label="Repisa de logros: ver su página"
          onClick={alTocarRepisa}
          style={{ position: 'absolute', left: `${R.x}%`, top: `${R.piso - altoRepisa}%`, width: `${R.ancho}%`, height: `${altoRepisa * 0.82}%`, zIndex: 156, background: 'transparent', border: 0, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
        />
      )}
      {children}
      <div style={{ position: 'absolute', inset: 0, background: t.color, opacity: t.opacidad, mixBlendMode: 'multiply', pointerEvents: 'none', zIndex: 150, transition: 'opacity 1s' }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 151, pointerEvents: 'none' }}>
        <Noche forma={forma} fuerza={fuerzaNoche(hora)} luces={luces} />
      </div>
    </div>
  );
}
