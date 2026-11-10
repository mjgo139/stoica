/**
 * Dibujo del jardín (compartido entre tu jardín y el de otra persona del grupo):
 * la terraza, las macetas con sus plantas, los adornos, el fuego, la luz según la hora y la noche.
 * Lo interactivo (tocar, acomodar, el filósofo) lo agrega quien la usa como `children` o con los avisos.
 */
import type { ReactNode, Ref } from 'react';
import { alCien, MARCHITA, PLANTA_DE_VIRTUD } from '@core/jardin';
import type { Virtud } from '@core/habitos';
import { ADORNOS, FONDOS, FUEGO, MACETA } from './disposicion';
import { Noche, type Luz } from './Noche';
import { Medalla } from './Graficos';
import { fuerzaNoche, tinte, ubicarAdorno, ubicarPlanta, type Forma } from './escena';

export interface PlantaEnEscena {
  id: string;
  nombre: string;
  virtud: Virtud;
  etapa: number;
  retono: boolean;
  celda: number;
}
export interface AdornoEnEscena {
  id: string;
  celda: number;
}

export const ESTILOS_ESCENA = `
  @keyframes mecer { 0%,100% { transform: rotate(-1.2deg) } 50% { transform: rotate(1.2deg) } }
  @keyframes revivir { from { transform: scale(.6); opacity: 0 } to { transform: scale(1); opacity: 1 } }
  @keyframes saltito { 0%,100% { transform: scale(1) } 40% { transform: scale(1.06, .95) } 70% { transform: scale(.98, 1.03) } }
  @keyframes prender { 0% { transform: translate(-50%, -100%) scale(.15); opacity: 0 } 60% { transform: translate(-50%, -100%) scale(1.15); opacity: 1 } 100% { transform: translate(-50%, -100%) scale(1); opacity: 1 } }
  @keyframes crecer { 0% { transform: scale(1) } 30% { transform: scale(1.18) } 60% { transform: scale(.96) } 100% { transform: scale(1) } }
  @keyframes rayos { from { transform: translate(-50%, -50%) rotate(0deg) } to { transform: translate(-50%, -50%) rotate(360deg) } }
  .esc-maceta { position: absolute; pointer-events: none; }
  .esc-maceta img { width: 100%; display: block; }
  .esc-planta { position: absolute; transform-origin: 50% 100%; pointer-events: none; }
  .esc-planta img { width: 100%; display: block; transform-origin: 50% 100%; animation: revivir .5s ease-out, mecer 4.5s ease-in-out .5s infinite; transition: filter .4s; }
  .esc-planta.seca img { animation: revivir .5s ease-out; }
  .esc-planta.elegida img, .esc-adorno.elegida img { filter: drop-shadow(0 0 6px rgba(255,214,120,.95)) drop-shadow(0 0 14px rgba(255,190,80,.6)); }
  .esc-planta.regando { animation: saltito .9s ease-out; }
  .esc-planta.regando img { filter: drop-shadow(0 0 8px rgba(150,215,255,.95)) brightness(1.08); }
  .esc-planta.crece { animation: crecer 1.4s ease-out; }
  .esc-adorno { position: absolute; pointer-events: none; filter: drop-shadow(1px 4px 3px rgba(60,40,10,.35)); }
  .esc-adorno img { width: 100%; display: block; }
  .esc-fuego { position: absolute; transform: translate(-50%, -100%); pointer-events: none; }
  .esc-fuego.prende { animation: prender 1.2s ease-out; }
  .esc-medalla { position: absolute; transform: translate(-50%, -30%); animation: brillo-medalla 3s ease-in-out infinite; background: none; border: 0; padding: 0; cursor: pointer; }
  @media (prefers-reduced-motion: reduce) { .esc-planta img, .esc-medalla, .esc-fuego, .esc-planta.crece { animation: none } }
`;

interface Props {
  forma: Forma;
  plantas: PlantaEnEscena[];
  adornos: AdornoEnEscena[];
  hora: number;
  fuegoEncendido: boolean;
  /** El fuego se está prendiendo ahora (animación). */
  prendiendo?: boolean;
  anchoPx: number;
  refContenedor?: Ref<HTMLDivElement>;
  etiqueta: string;
  elegido?: string | null;
  regando?: Set<string>;
  creciendo?: string | null;
  /** Medalla al pie de la maceta: tocarla abre la página de la planta. */
  alTocarMedalla?: (id: string) => void;
  /** Lo que va encima (zonas tocables, el filósofo, la cuadrícula para acomodar). Por encima de la luz de la hora: zIndex > 152. */
  children?: ReactNode;
  /** Algo encima de cada maceta (por ejemplo la gota de "pide agua"). */
  sobrePlanta?: (p: PlantaEnEscena, punta: { x: number; y: number }) => ReactNode;
}

export function Escena({ forma, plantas, adornos, hora, fuegoEncendido, prendiendo, anchoPx, refContenedor, etiqueta, elegido, regando, creciendo, alTocarMedalla, children, sobrePlanta }: Props) {
  const fondo = FONDOS[forma];
  const t = tinte(hora);
  const pxPorPct = anchoPx / 100;
  // Luz de noche: el brasero encendido y los faroles
  const luces: Luz[] = adornos
    .filter((a) => ADORNOS.find((x) => x.id === a.id)?.luz && (a.id !== 'brasero' || fuegoEncendido))
    .map((a) => {
      const u = ubicarAdorno(forma, a.id, a.celda);
      return { x: u.left + u.ancho / 2, y: u.top + u.alto * 0.3, r: Math.max(50, u.ancho * pxPorPct * 1.6) };
    });
  return (
    <div
      ref={refContenedor}
      style={{ position: 'relative', isolation: 'isolate', width: '100%', aspectRatio: `${fondo.ancho} / ${fondo.alto}`, background: `#d9c7a5 url(${fondo.archivo}) center / cover no-repeat` }}
      aria-label={etiqueta}
      role="img"
    >
      {plantas.map((p, i) => {
        const especie = PLANTA_DE_VIRTUD[p.virtud].id;
        const u = ubicarPlanta(forma, especie, p.etapa, p.celda, p.retono);
        const m = u.maceta;
        const z = 3 + Math.round(m.piso);
        return (
          <div key={p.id}>
            <div className="esc-maceta" style={{ left: `${m.left}%`, top: `${m.top}%`, width: `${m.w}%`, zIndex: z }}>
              <img src={MACETA.archivo} alt="" draggable={false} />
            </div>
            <div
              className={`esc-planta${p.etapa === MARCHITA ? ' seca' : ''}${regando?.has(p.id) ? ' regando' : ''}${elegido === p.id ? ' elegida' : ''}${creciendo === p.id ? ' crece' : ''}`}
              style={{ left: `${u.left}%`, top: `${u.top}%`, width: `${u.ancho}%`, zIndex: z }}
            >
              <img key={`${especie}-${p.etapa}`} src={`/jardin/${especie}-${p.etapa}.webp`} alt="" draggable={false} style={{ animationDelay: `0s, ${-(i * 0.7) % 4.5}s` }} />
            </div>
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
      {adornos.map((a) => {
        const u = ubicarAdorno(forma, a.id, a.celda);
        const z = 3 + Math.round(u.piso);
        const brasero = a.id === 'brasero';
        return (
          <div key={`adorno-${a.id}`}>
            <div className={`esc-adorno${elegido === `adorno:${a.id}` ? ' elegida' : ''}`} style={{ left: `${u.left}%`, top: `${u.top}%`, width: `${u.ancho}%`, zIndex: z }}>
              <img src={`/jardin/adorno-${brasero ? 'brasero-apagado' : a.id}.webp`} alt="" draggable={false} />
            </div>
            {brasero && fuegoEncendido && (
              <img
                className={`esc-fuego${prendiendo ? ' prende' : ''}`}
                src={FUEGO.archivo}
                alt=""
                draggable={false}
                data-fuego="encendido"
                style={{ left: `${u.left + u.ancho / 2}%`, top: `${u.top + (u.alto * (FUEGO.sobre.y + 3)) / 100}%`, width: `${(u.ancho * FUEGO.sobre.w * 1.15) / 100}%`, zIndex: 152 }}
              />
            )}
          </div>
        );
      })}
      {children}
      <div style={{ position: 'absolute', inset: 0, background: t.color, opacity: t.opacidad, mixBlendMode: 'multiply', pointerEvents: 'none', zIndex: 150, transition: 'opacity 1s' }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 151, pointerEvents: 'none' }}>
        <Noche forma={forma} fuerza={fuerzaNoche(hora)} luces={luces} />
      </div>
    </div>
  );
}
