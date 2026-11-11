/**
 * Terreno del jardín acomodable: el piso de la terraza se divide en una cuadrícula.
 * - Pasillos (filas y la columna del medio): nunca se puede poner nada, así el filósofo siempre puede caminar.
 * - Bloqueadas: fuente, arbustos, etc.
 * - Libres: ahí van las macetas y los adornos. Cada libre toca un pasillo, así el filósofo llega a cualquiera.
 * Todo en % del fondo.
 */
export type Forma = 'vertical' | 'horizontal';

interface Definicion {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  cols: number;
  filas: number;
  pasilloFilas: number[];
  pasilloCol: number;
  /** [fila, columna] donde no se puede poner nada ni caminar. */
  bloqueadas: Array<[number, number]>;
  /** Por dónde entra y sale el filósofo (fuera del dibujo, abajo del pasillo del medio). */
  entrada: [number, number];
  /** Celda inicial del brasero. */
  brasero: [number, number];
  /**
   * Punto de fuga del piso (en %): las líneas de las baldosas y de la guarda se juntan ahí.
   * La cuadrícula sigue esas líneas: x0/x1 son los bordes en la fila de adelante (y1) y hacia el fondo se angosta.
   */
  fuga: [number, number];
}

/**
 * Las dos terrazas usan la MISMA cuadrícula (5 columnas × 7 filas): dos bloques iguales de 2 × 4 lugares,
 * uno a cada lado del pasillo del medio, sin huecos. Así una maceta queda en el mismo lugar en el celular
 * (terraza vertical) y en la computadora (horizontal). Los rectángulos esquivan la fuente, el busto y los arbustos.
 */
export const TERRENOS: Record<Forma, Definicion> = {
  // Terraza vertical (941 × 1672): delante de la repisa, entre el busto y la fuente.
  vertical: {
    x0: 16,
    x1: 84,
    y0: 38.4,
    y1: 82,
    cols: 5,
    filas: 7,
    pasilloFilas: [0, 3, 6],
    pasilloCol: 2,
    bloqueadas: [],
    entrada: [50, 106],
    brasero: [1, 0],
    fuga: [47, -31],
  },
  // Terraza horizontal (1671 × 941)
  horizontal: {
    x0: 20,
    x1: 84,
    y0: 37.5,
    y1: 98,
    cols: 5,
    filas: 7,
    pasilloFilas: [0, 3, 6],
    pasilloCol: 2,
    bloqueadas: [],
    entrada: [52, 108],
    brasero: [1, 0],
    fuga: [49.5, -120],
  },
};

export type TipoCelda = 'pasillo' | 'libre' | 'bloqueada';
export interface Celda {
  i: number;
  fila: number;
  col: number;
  /** Centro de la celda (en %). */
  x: number;
  y: number;
  w: number;
  h: number;
  tipo: TipoCelda;
}

const cache = new Map<Forma, Celda[]>();

/** Los pasillos son más angostos que los lugares para macetas. */
const PESO_PASILLO = 0.62;

/** Bordes (en %) de filas y columnas según su peso. */
function bordes(desde: number, hasta: number, n: number, esPasillo: (k: number) => boolean): number[] {
  const pesos = Array.from({ length: n }, (_, k) => (esPasillo(k) ? PESO_PASILLO : 1));
  const total = pesos.reduce((a, b) => a + b, 0);
  const res = [desde];
  for (const p of pesos) res.push(res[res.length - 1] + ((hasta - desde) * p) / total);
  return res;
}

function grilla(forma: Forma) {
  const d = TERRENOS[forma];
  return {
    xs: bordes(d.x0, d.x1, d.cols, (c) => c === d.pasilloCol),
    ys: bordes(d.y0, d.y1, d.filas, (f) => d.pasilloFilas.includes(f)),
  };
}

/** Cuánto se achica el piso a la profundidad y (1 en la fila de adelante). */
export function perspectiva(forma: Forma, y: number): number {
  const d = TERRENOS[forma];
  return (y - d.fuga[1]) / (d.y1 - d.fuga[1]);
}

/** Del plano "derecho" (x medida en la fila de adelante) al dibujo, siguiendo las líneas del piso. */
export const aDibujo = (forma: Forma, x: number, y: number) => TERRENOS[forma].fuga[0] + (x - TERRENOS[forma].fuga[0]) * perspectiva(forma, y);
const aPlano = (forma: Forma, x: number, y: number) => TERRENOS[forma].fuga[0] + (x - TERRENOS[forma].fuga[0]) / perspectiva(forma, y);

export function celdas(forma: Forma): Celda[] {
  const hecho = cache.get(forma);
  if (hecho) return hecho;
  const d = TERRENOS[forma];
  const { xs, ys } = grilla(forma);
  const lista: Celda[] = [];
  for (let fila = 0; fila < d.filas; fila++)
    for (let col = 0; col < d.cols; col++) {
      const bloq = d.bloqueadas.some(([f, c]) => f === fila && c === col);
      const pasillo = d.pasilloFilas.includes(fila) || col === d.pasilloCol;
      const y = (ys[fila] + ys[fila + 1]) / 2;
      const p = perspectiva(forma, y);
      lista.push({ i: fila * d.cols + col, fila, col, x: aDibujo(forma, (xs[col] + xs[col + 1]) / 2, y), y, w: (xs[col + 1] - xs[col]) * p, h: ys[fila + 1] - ys[fila], tipo: bloq ? 'bloqueada' : pasillo ? 'pasillo' : 'libre' });
    }
  cache.set(forma, lista);
  return lista;
}

export const celdaEn = (forma: Forma, fila: number, col: number) => celdas(forma)[fila * TERRENOS[forma].cols + col];

/** Celdas libres en el orden en que se llenan solas: de adelante hacia atrás, del medio hacia los costados. */
export function libresEnOrden(forma: Forma): Celda[] {
  return celdas(forma)
    .filter((c) => c.tipo === 'libre')
    .sort((a, b) => b.fila - a.fila || Math.abs(a.x - 50) - Math.abs(b.x - 50) || a.col - b.col);
}

/** Celda de un punto (en %), o null si cae fuera de la cuadrícula. */
export function celdaDePunto(forma: Forma, x: number, y: number): Celda | null {
  const d = TERRENOS[forma];
  if (y < d.y0 || y >= d.y1) return null;
  x = aPlano(forma, x, y);
  if (x < d.x0 || x >= d.x1) return null;
  const { xs, ys } = grilla(forma);
  const col = Math.max(0, xs.findIndex((v) => v > x) - 1);
  const fila = Math.max(0, ys.findIndex((v) => v > y) - 1);
  return celdaEn(forma, fila, col);
}

export const ADORNO_BRASERO = 'brasero';

export interface Brasero {
  /** Pie del brasero (en %). */
  x: number;
  y: number;
  /** Pasillo donde se para el filósofo para encenderlo, y hacia dónde mira. */
  parada: [number, number];
  mirar: 'izquierda' | 'derecha';
}

/**
 * Los 4 braseros fijos, en las esquinas: al final de los pasillos y por fuera de la cuadrícula,
 * así el filósofo los enciende parado en el pasillo sin pisar ninguna maceta.
 */
/** Brasero puesto sobre la línea del piso que pasa a `u` (medido en la fila de adelante), a la altura y. */
const brasero = (forma: Forma, u: number, y: number, parada: [number, number], mirar: 'izquierda' | 'derecha'): Brasero => ({ x: aDibujo(forma, u, y), y, parada, mirar });

export const BRASEROS: Record<Forma, Brasero[]> = {
  // Dos arriba y dos abajo, cada par a la misma altura y los de cada lado sobre la misma línea del piso
  vertical: [
    brasero('vertical', 11.5, 42, [0, 0], 'izquierda'),
    brasero('vertical', 88.5, 42, [0, 4], 'derecha'),
    brasero('vertical', 11.5, 81.2, [6, 0], 'izquierda'),
    brasero('vertical', 88.5, 81.2, [6, 4], 'derecha'),
  ],
  horizontal: [
    brasero('horizontal', 17.5, 36.5, [0, 0], 'izquierda'),
    brasero('horizontal', 86.5, 36.5, [0, 4], 'derecha'),
    brasero('horizontal', 17.5, 97.4, [6, 0], 'izquierda'),
    brasero('horizontal', 86.5, 97.4, [6, 4], 'derecha'),
  ],
};

/**
 * Dónde va cada cosa.
 * - `plantas`: ids en el orden del jardín (hábitos y después retoños).
 * - `adornos`: ids de los adornos que se pueden poner.
 * - `guardadas` / `adornosGuardados`: lo que la persona acomodó (id → celda; -1 = guardado en el depósito).
 * Lo que no tiene lugar guardado (o cuyo lugar ya no sirve) se acomoda solo en las libres que quedan.
 * El brasero, si no se tocó, va a su lugar de siempre.
 */
export function ubicar(
  forma: Forma,
  plantas: string[],
  adornos: string[],
  guardadas: Record<string, number>,
  adornosGuardados: Record<string, number>,
): { lugar: Map<string, number>; sinLugar: string[] } {
  const todas = celdas(forma);
  const ocupada = new Set<number>();
  const lugar = new Map<string, number>();
  const valida = (i: number | undefined) => i !== undefined && todas[i]?.tipo === 'libre' && !ocupada.has(i);
  const poner = (id: string, i: number) => {
    lugar.set(id, i);
    ocupada.add(i);
  };
  // 1. Adornos (los puso la persona, o el brasero en su lugar de siempre)
  const brasero = celdaEn(forma, TERRENOS[forma].brasero[0], TERRENOS[forma].brasero[1]).i;
  for (const a of adornos) {
    const g = adornosGuardados[a];
    if (g === -1) continue;
    if (valida(g)) poner(`adorno:${a}`, g!);
    else if (a === ADORNO_BRASERO && g === undefined && valida(brasero)) poner(`adorno:${a}`, brasero);
  }
  // 2. Plantas con lugar guardado
  for (const p of plantas) if (valida(guardadas[p])) poner(p, guardadas[p]);
  // 3. El resto, en orden
  const libres = libresEnOrden(forma).filter((c) => !ocupada.has(c.i));
  const sinLugar: string[] = [];
  for (const p of plantas) {
    if (lugar.has(p)) continue;
    const c = libres.shift();
    if (c) poner(p, c.i);
    else sinLugar.push(p);
  }
  return { lugar, sinLugar };
}

export type Dir = 'abajo' | 'izquierda' | 'derecha' | 'arriba';

/**
 * Camino del filósofo desde la entrada hasta una celda (por los pasillos), con el punto donde se para
 * y hacia dónde mira. null si no hay camino (no debería pasar: toda libre toca un pasillo).
 */
export function caminoHasta(forma: Forma, destino: number, desde?: number): { puntos: Array<[number, number]>; mirar: Dir; fin: number } | null {
  const d = TERRENOS[forma];
  const todas = celdas(forma);
  const obj = todas[destino];
  if (!obj) return null;
  const pasillo = (f: number, c: number) => f >= 0 && c >= 0 && f < d.filas && c < d.cols && todas[f * d.cols + c].tipo === 'pasillo';
  // Arranca en la última celda del pasillo del medio (al lado de la entrada)
  const inicio = desde ?? (d.filas - 1) * d.cols + d.pasilloCol;
  const vecinas = (i: number) => {
    const f = Math.floor(i / d.cols);
    const c = i % d.cols;
    return [
      [f - 1, c],
      [f + 1, c],
      [f, c - 1],
      [f, c + 1],
    ]
      .filter(([a, b]) => pasillo(a, b))
      .map(([a, b]) => a * d.cols + b);
  };
  // Dónde se puede parar: un pasillo pegado al destino (o el destino mismo si es pasillo)
  const metas = new Set<number>(
    obj.tipo === 'pasillo'
      ? [obj.i]
      : [
          [obj.fila - 1, obj.col],
          [obj.fila + 1, obj.col],
          [obj.fila, obj.col - 1],
          [obj.fila, obj.col + 1],
        ]
          .filter(([a, b]) => pasillo(a, b))
          .map(([a, b]) => a * d.cols + b),
  );
  if (!metas.size) return null;
  const previo = new Map<number, number>([[inicio, -1]]);
  const cola = [inicio];
  let fin = -1;
  while (cola.length) {
    const i = cola.shift()!;
    if (metas.has(i)) {
      fin = i;
      break;
    }
    for (const v of vecinas(i))
      if (!previo.has(v)) {
        previo.set(v, i);
        cola.push(v);
      }
  }
  if (fin < 0) return null;
  const ruta: number[] = [];
  for (let i = fin; i !== -1; i = previo.get(i)!) ruta.unshift(i);
  // Solo las esquinas (camina derecho entre ellas)
  // Desde la entrada (fuera del dibujo) o desde donde está parado
  const puntos: Array<[number, number]> = desde === undefined ? [[aDibujo(forma, aPlano(forma, todas[inicio].x, todas[inicio].y), d.entrada[1]), d.entrada[1]]] : [[todas[inicio].x, todas[inicio].y]];
  ruta.forEach((i, k) => {
    const a = ruta[k - 1];
    const b = ruta[k + 1];
    const recto = a !== undefined && b !== undefined && (Math.floor(a / d.cols) === Math.floor(b / d.cols) || a % d.cols === b % d.cols);
    if (!recto) puntos.push([todas[i].x, todas[i].y]);
  });
  const parado = todas[fin];
  const mirar: Dir = obj.i === fin ? 'abajo' : obj.col < parado.col ? 'izquierda' : obj.col > parado.col ? 'derecha' : 'abajo';
  return { puntos, mirar, fin };
}

/** Recorrido para encender los braseros: de uno al otro por los pasillos. */
export function rondaDeBraseros(forma: Forma): Array<{ puntos: Array<[number, number]>; mirar: Dir; brasero: number }> {
  const d = TERRENOS[forma];
  const res: Array<{ puntos: Array<[number, number]>; mirar: Dir; brasero: number }> = [];
  // Orden: adelante izquierda, atrás izquierda, atrás derecha, adelante derecha (sin volver sobre sus pasos)
  const orden = [2, 0, 1, 3];
  let desde: number | undefined;
  for (const b of orden) {
    const br = BRASEROS[forma][b];
    const celda = br.parada[0] * d.cols + br.parada[1];
    const c = caminoHasta(forma, celda, desde);
    if (!c) continue;
    res.push({ puntos: c.puntos, mirar: br.mirar, brasero: b });
    desde = c.fin;
  }
  return res;
}

/** Camino de salida desde una celda de pasillo hasta la entrada. */
export function caminoDeSalida(forma: Forma, desde: number): Array<[number, number]> {
  const d = TERRENOS[forma];
  const todas = celdas(forma);
  const inicio = (d.filas - 1) * d.cols + d.pasilloCol;
  const c = caminoHasta(forma, inicio, desde);
  const pts = c ? c.puntos : [[todas[desde].x, todas[desde].y] as [number, number]];
  return [...pts, [aDibujo(forma, aPlano(forma, todas[inicio].x, todas[inicio].y), d.entrada[1]), d.entrada[1]]];
}
