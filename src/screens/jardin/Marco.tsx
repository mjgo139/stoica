/**
 * Marco Aurelio animado (prueba de animación con la hoja de poses de ChatGPT):
 * entra caminando desde el costado hasta la planta, se da vuelta y habla gesticulando, y se va caminando.
 * Los cuadros están en public/jardin/marco.webp (una grilla de celdas iguales, pies abajo).
 */
import { useEffect, useRef, useState } from 'react';

const ATLAS = { archivo: '/jardin/marco.webp', celda: [146, 207], columnas: 8, ancho: 1168, alto: 621 } as const;
const ANIM = { camina: [0, 1, 2, 3, 4, 5, 6], frente: [7, 8, 9, 10, 11, 12], quieto: [13], brazos: [14], piensa: [15], habla: [16, 17], senala: [18] } as const;

/** Secuencia mientras habla: [cuadro, segundos]. */
const CHARLA: Array<[number, number]> = [
  [ANIM.quieto[0], 1.4],
  [ANIM.habla[0], 0.8],
  [ANIM.habla[1], 0.9],
  [ANIM.habla[0], 0.7],
  [ANIM.quieto[0], 1.2],
  [ANIM.piensa[0], 1.6],
  [ANIM.senala[0], 1.1],
  [ANIM.quieto[0], 1.0],
  [ANIM.brazos[0], 1.6],
];

export type FaseMarco = 'llega' | 'habla' | 'seVa' | 'fuera';

interface Props {
  /** Destino (en % del ancho del jardín) y piso donde apoya los pies (en % del alto). */
  x: number;
  piso: number;
  /** Alto en px. */
  alto: number;
  /** true cuando hay que irse. */
  irse: boolean;
  etiqueta: string;
  alTocar: () => void;
  alLlegar?: () => void;
  alIrse?: () => void;
}

export function MarcoAnimado({ x, piso, alto, irse, etiqueta, alTocar, alLlegar, alIrse }: Props) {
  const quieto = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [fase, setFase] = useState<FaseMarco>(quieto ? 'habla' : 'llega');
  const [pos, setPos] = useState(quieto ? x : -8);
  const [cuadro, setCuadro] = useState<number>(quieto ? ANIM.quieto[0] : ANIM.camina[0]);
  const ref = useRef({ fase, pos, t0: 0, charla: 0, enCharla: 0 });
  ref.current.fase = fase;

  useEffect(() => {
    if (irse && (fase === 'habla' || fase === 'llega')) setFase('seVa');
  }, [irse, fase]);

  useEffect(() => {
    if (fase === 'habla') alLlegar?.();
    if (fase === 'fuera') alIrse?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  useEffect(() => {
    if (fase === 'fuera') return;
    let raf = 0;
    let antes = performance.now();
    let paso = 0;
    const velocidad = 13; // % del ancho por segundo
    const tick = (ahora: number) => {
      const dt = Math.min(0.05, (ahora - antes) / 1000);
      antes = ahora;
      const r = ref.current;
      if (r.fase === 'llega' || r.fase === 'seVa') {
        paso += dt * 9; // cuadros por segundo de la caminata
        setCuadro(ANIM.camina[Math.floor(paso) % ANIM.camina.length]);
        const meta = r.fase === 'llega' ? x : 110;
        r.pos = Math.min(meta, r.pos + velocidad * dt);
        setPos(r.pos);
        if (r.pos >= meta) {
          if (r.fase === 'llega') {
            r.enCharla = 0;
            r.charla = 0;
            setFase('habla');
          } else setFase('fuera');
        }
      } else if (r.fase === 'habla') {
        r.enCharla += dt;
        const [c, dur] = CHARLA[r.charla % CHARLA.length];
        setCuadro(c);
        if (r.enCharla > dur) {
          r.enCharla = 0;
          r.charla++;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fase, x]);

  if (fase === 'fuera') return null;
  const [cw, ch] = ATLAS.celda;
  const esc = alto / ch;
  const col = cuadro % ATLAS.columnas;
  const fila = Math.floor(cuadro / ATLAS.columnas);
  return (
    <button
      type="button"
      className="marco"
      aria-label={etiqueta}
      onClick={alTocar}
      style={{
        position: 'absolute',
        left: `${pos}%`,
        top: `${piso}%`,
        width: cw * esc,
        height: alto,
        transform: 'translate(-50%, -100%)',
        backgroundImage: `url(${ATLAS.archivo})`,
        backgroundSize: `${ATLAS.ancho * esc}px ${ATLAS.alto * esc}px`,
        backgroundPosition: `${-col * cw * esc}px ${-fila * ch * esc}px`,
        backgroundRepeat: 'no-repeat',
        border: 0,
        padding: 0,
        cursor: 'pointer',
        filter: 'drop-shadow(2px 5px 3px rgba(60,40,10,.4))',
        zIndex: 85,
      }}
    />
  );
}
