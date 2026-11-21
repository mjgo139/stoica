/**
 * Un filósofo animado que recorre el jardín por los pasillos: camina de parada en parada (en cada una
 * hace algo: encender un brasero con la antorcha o hablar con gestos) y al final se va por donde vino.
 * Su tamaño depende de la profundidad (más chico al fondo), siempre más alto que una planta.
 */
import { useEffect, useRef, useState } from 'react';
import { cuadroAntorcha, cuadroCaminar, cuadroHablar, type Atlas, type Dir } from './filosofos';

export type Punto = [number, number]; // [x %, y %] del jardín

export interface Parada {
  /** Camino hasta la parada (el primero es la entrada o donde está parado). */
  puntos: Punto[];
  mirar: Dir;
  accion: 'antorcha' | 'hablar';
}

interface Props {
  atlas: Atlas;
  paradas: Parada[];
  /** Camino de salida desde la última parada. */
  salida: Punto[];
  /** Hasta qué parada puede seguir (el jardín lo sube cuando termina lo de cada parada). */
  seguir: number;
  irse: boolean;
  altoEn: (y: number) => number;
  anchoPx: number;
  altoPx: number;
  etiqueta: string;
  alTocar: () => void;
  alLlegar?: (parada: number) => void;
  alIrse?: () => void;
  /** Para dibujar el globo sobre la cabeza. */
  alMoverse?: (x: number, y: number, alto: number, parado: boolean) => void;
}

type Fase = 'camina' | 'parado' | 'seVa' | 'fuera';

export function Filosofo({ atlas, paradas, salida, seguir, irse, altoEn, anchoPx, altoPx, etiqueta, alTocar, alLlegar, alIrse, alMoverse }: Props) {
  const reducido = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const inicio = reducido ? paradas[0].puntos[paradas[0].puntos.length - 1] : paradas[0].puntos[0];
  const r = useRef({
    x: inicio[0],
    y: inicio[1],
    dir: (reducido ? paradas[0].mirar : 'arriba') as Dir,
    fase: (reducido ? 'parado' : 'camina') as Fase,
    i: 0,
    ruta: paradas[0].puntos,
    tramo: 1,
    ciclo: 0,
    t: 0,
  });
  const [, setTic] = useState(0);
  const prop = useRef({ seguir, irse, paradas, salida, alLlegar, alIrse });
  prop.current = { seguir, irse, paradas, salida, alLlegar, alIrse };
  const avisado = useRef(-1);

  useEffect(() => {
    let raf = 0;
    let antes = performance.now();
    const tick = (ahora: number) => {
      const dt = Math.min(0.05, (ahora - antes) / 1000);
      antes = ahora;
      const s = r.current;
      const p = prop.current;
      if (s.fase === 'parado') {
        s.t += dt;
        if (avisado.current !== s.i) {
          avisado.current = s.i;
          p.alLlegar?.(s.i);
        }
        if (p.irse) {
          s.fase = 'seVa';
          s.ruta = [[s.x, s.y], ...p.salida];
          s.tramo = 1;
        } else if (p.seguir > s.i && s.i + 1 < p.paradas.length) {
          s.i++;
          const sig = p.paradas[s.i];
          if (reducido) {
            const fin = sig.puntos[sig.puntos.length - 1];
            s.x = fin[0];
            s.y = fin[1];
            s.dir = sig.mirar;
            s.t = 0;
          } else {
            s.fase = 'camina';
            s.ruta = [[s.x, s.y], ...sig.puntos.slice(1)];
            s.tramo = 1;
          }
        }
      } else if (s.fase === 'camina' || s.fase === 'seVa') {
        const [tx, ty] = s.ruta[s.tramo];
        const dxPx = ((tx - s.x) / 100) * anchoPx;
        const dyPx = ((ty - s.y) / 100) * altoPx;
        const dist = Math.hypot(dxPx, dyPx);
        // Camina a ~0,9 de su altura por segundo (más lento al fondo, como en la vida real)
        const avance = Math.max(25, altoEn(s.y) * 0.9) * dt;
        if (dist > 0.5) s.dir = Math.abs(dxPx) >= Math.abs(dyPx) ? (dxPx > 0 ? 'derecha' : 'izquierda') : dyPx > 0 ? 'abajo' : 'arriba';
        if (dist <= avance) {
          s.x = tx;
          s.y = ty;
          s.tramo++;
          if (s.tramo >= s.ruta.length) {
            if (s.fase === 'camina') {
              s.fase = 'parado';
              s.dir = p.paradas[s.i].mirar;
              s.t = 0;
            } else s.fase = 'fuera';
          }
        } else {
          s.x += (dxPx / dist) * avance * (100 / anchoPx);
          s.y += (dyPx / dist) * avance * (100 / altoPx);
        }
        s.ciclo += dt * atlas.pasos.length * (atlas.ritmo / atlas.pasos.length);
      }
      setTic((n) => (n + 1) % 1_000_000);
      if (s.fase !== 'fuera') raf = requestAnimationFrame(tick);
      else p.alIrse?.();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchoPx, altoPx, altoEn, atlas]);

  const s = r.current;
  const alto = altoEn(s.y);
  useEffect(() => {
    alMoverse?.(s.x, s.y, alto, s.fase === 'parado');
  });
  if (s.fase === 'fuera') return null;

  // Qué cuadro se ve
  let cuadro: [number, number];
  let espejo = false;
  const accion = paradas[s.i]?.accion;
  if (s.fase === 'parado' && accion === 'antorcha' && atlas.filas.antorcha) {
    cuadro = cuadroAntorcha(atlas, s.t)!;
    espejo = s.dir === 'izquierda'; // la antorcha está dibujada mirando a la derecha
  } else if (s.fase === 'parado') {
    cuadro = cuadroHablar(atlas, s.dir, s.t).cuadro;
  } else cuadro = cuadroCaminar(atlas, s.dir, s.ciclo);

  const [cw, ch] = atlas.celda;
  const esc = alto / ch;
  return (
    <>
      {/* Sombra en el piso, bajo los pies */}
      <span
        aria-hidden
        style={{ position: 'absolute', left: `${s.x}%`, top: `${s.y}%`, width: cw * esc * 0.62, height: cw * esc * 0.17, transform: 'translate(-50%, -50%)', borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(45,28,10,.5), rgba(45,28,10,0) 70%)' /* familia-ok: ilustración del jardín */, pointerEvents: 'none', zIndex: 2 }}
      />
    <button
      type="button"
      className={`filosofo${s.fase === 'parado' ? ' hablando' : ''}`}
      aria-label={etiqueta}
      onClick={alTocar}
      style={{
        position: 'absolute',
        left: `${s.x}%`,
        top: `${s.y}%`,
        width: cw * esc,
        height: alto,
        transform: `translate(-50%, -100%)${espejo ? ' scaleX(-1)' : ''}`,
        transformOrigin: '50% 100%',
        backgroundImage: `url(${atlas.archivo})`,
        backgroundSize: `${atlas.ancho * esc}px ${atlas.alto * esc}px`,
        backgroundPosition: `${-cuadro[0] * cw * esc}px ${-cuadro[1] * ch * esc}px`,
        backgroundRepeat: 'no-repeat',
        border: 0,
        padding: 0,
        cursor: 'pointer',
        filter: 'drop-shadow(1px 3px 2px rgba(60,40,10,.3))' /* familia-ok: ilustración del jardín */,
        // Delante de las plantas de su fila y detrás de las de adelante
        zIndex: 3 + Math.round(s.y),
      }}
    />
    </>
  );
}
