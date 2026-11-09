/**
 * Marco Aurelio animado: camina por los pasillos del jardín en 4 direcciones (hoja de ChatGPT de 4 filas × 3 pasos),
 * llega a la planta, se da vuelta y habla, y se va caminando por donde vino.
 * Su tamaño depende de la profundidad (más chico al fondo), siempre más alto que una planta.
 */
import { useEffect, useRef, useState } from 'react';

const ATLAS = { archivo: '/jardin/marco.webp', celda: [157, 224], columnas: 3, ancho: 471, alto: 896 } as const;
/** Filas de la hoja: hacia abajo (de frente), izquierda, derecha, hacia arriba (de espaldas). */
const DIR = { abajo: 0, izquierda: 1, derecha: 2, arriba: 3 } as const;
type Dir = keyof typeof DIR;
/** Ciclo de pasos: pie, parado, el otro pie, parado. */
const PASOS = [0, 1, 2, 1];

export type Punto = [number, number]; // [x %, y %] del jardín

interface Props {
  /** Camino de llegada (el primero puede estar fuera del jardín) y de salida. */
  llegada: Punto[];
  salida: Punto[];
  /** Alto en px que debe tener parado en una profundidad y (en %). */
  altoEn: (y: number) => number;
  /** Tamaño del jardín en px (para caminar a velocidad pareja). */
  anchoPx: number;
  altoPx: number;
  irse: boolean;
  etiqueta: string;
  alTocar: () => void;
  alLlegar?: () => void;
  alIrse?: () => void;
  /** Para dibujar el globo sobre la cabeza. */
  alMoverse?: (x: number, y: number, alto: number, hablando: boolean) => void;
}

export function MarcoAnimado({ llegada, salida, altoEn, anchoPx, altoPx, irse, etiqueta, alTocar, alLlegar, alIrse, alMoverse }: Props) {
  const reducido = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const destino = llegada[llegada.length - 1];
  const [estado, setEstado] = useState<{ x: number; y: number; dir: Dir; paso: number; fase: 'llega' | 'habla' | 'seVa' | 'fuera' }>(() =>
    reducido ? { x: destino[0], y: destino[1], dir: 'abajo', paso: 1, fase: 'habla' } : { x: llegada[0][0], y: llegada[0][1], dir: 'derecha', paso: 1, fase: 'llega' },
  );
  const r = useRef({ ...estado, tramo: 1, ruta: llegada, ciclo: 0 });

  useEffect(() => {
    if (irse && (r.current.fase === 'habla' || r.current.fase === 'llega')) {
      r.current.fase = 'seVa';
      r.current.ruta = [[r.current.x, r.current.y], ...salida];
      r.current.tramo = 1;
    }
  }, [irse, salida]);

  useEffect(() => {
    if (estado.fase === 'habla') alLlegar?.();
    if (estado.fase === 'fuera') alIrse?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.fase]);

  useEffect(() => {
    alMoverse?.(estado.x, estado.y, altoEn(estado.y), estado.fase === 'habla');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.x, estado.y, estado.fase]);

  useEffect(() => {
    let raf = 0;
    let antes = performance.now();
    const tick = (ahora: number) => {
      const dt = Math.min(0.05, (ahora - antes) / 1000);
      antes = ahora;
      const s = r.current;
      if (s.fase === 'llega' || s.fase === 'seVa') {
        const [tx, ty] = s.ruta[s.tramo];
        const dxPx = ((tx - s.x) / 100) * anchoPx;
        const dyPx = ((ty - s.y) / 100) * altoPx;
        const dist = Math.hypot(dxPx, dyPx);
        // Camina a ~0,9 de su altura por segundo (más lento al fondo, como en la vida real)
        const vel = Math.max(25, altoEn(s.y) * 0.9);
        const avance = vel * dt;
        if (Math.abs(dxPx) > 0.5 || Math.abs(dyPx) > 0.5) s.dir = Math.abs(dxPx) >= Math.abs(dyPx) ? (dxPx > 0 ? 'derecha' : 'izquierda') : dyPx > 0 ? 'abajo' : 'arriba';
        if (dist <= avance) {
          s.x = tx;
          s.y = ty;
          s.tramo++;
          if (s.tramo >= s.ruta.length) {
            if (s.fase === 'llega') {
              s.fase = 'habla';
              s.dir = 'abajo';
              s.paso = 1;
            } else s.fase = 'fuera';
          }
        } else {
          s.x += (dxPx / dist) * avance * (100 / anchoPx);
          s.y += (dyPx / dist) * avance * (100 / altoPx);
        }
        s.ciclo += dt * 7;
        s.paso = PASOS[Math.floor(s.ciclo) % PASOS.length];
      }
      setEstado({ x: s.x, y: s.y, dir: s.dir, paso: s.paso, fase: s.fase });
      if (s.fase !== 'fuera') raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [anchoPx, altoPx, altoEn]);

  if (estado.fase === 'fuera') return null;
  const [cw, ch] = ATLAS.celda;
  const alto = altoEn(estado.y);
  const esc = alto / ch;
  return (
    <button
      type="button"
      className={`marco${estado.fase === 'habla' ? ' hablando' : ''}`}
      aria-label={etiqueta}
      onClick={alTocar}
      style={{
        position: 'absolute',
        left: `${estado.x}%`,
        top: `${estado.y}%`,
        width: cw * esc,
        height: alto,
        transform: 'translate(-50%, -100%)',
        transformOrigin: '50% 100%',
        backgroundImage: `url(${ATLAS.archivo})`,
        backgroundSize: `${ATLAS.ancho * esc}px ${ATLAS.alto * esc}px`,
        backgroundPosition: `${-estado.paso * cw * esc}px ${-DIR[estado.dir] * ch * esc}px`,
        backgroundRepeat: 'no-repeat',
        border: 0,
        padding: 0,
        cursor: 'pointer',
        filter: 'drop-shadow(2px 5px 3px rgba(60,40,10,.4))',
        // Delante de las plantas de su fila y detrás de las de adelante
        zIndex: 3 + Math.round(estado.y),
      }}
    />
  );
}
