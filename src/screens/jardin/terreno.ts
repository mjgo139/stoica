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
}

export const TERRENOS: Record<Forma, Definicion> = {
  // Terraza vertical (941 × 1672): la repisa va contra la baranda; el piso acomodable empieza delante (33 %).
  vertical: {
    x0: 14,
    x1: 92,
    y0: 33,
    y1: 100,
    cols: 5,
    filas: 10,
    pasilloFilas: [0, 3, 6, 9],
    pasilloCol: 2,
    bloqueadas: [
      [0, 4], // fuente
      [1, 4],
      [7, 4], // arbustos de abajo a la derecha
      [8, 3],
      [8, 4],
      [9, 4],
    ],
    entrada: [53, 106],
    brasero: [1, 0],
  },
  // Terraza horizontal (1671 × 941)
  horizontal: {
    x0: 18,
    x1: 86,
    y0: 32,
    y1: 100,
    cols: 7,
    filas: 7,
    pasilloFilas: [0, 3, 6],
    pasilloCol: 3,
    bloqueadas: [
      [0, 6], // fuente
      [1, 6],
    ],
    entrada: [52, 108],
    brasero: [1, 0],
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
      lista.push({ i: fila * d.cols + col, fila, col, x: (xs[col] + xs[col + 1]) / 2, y: (ys[fila] + ys[fila + 1]) / 2, w: xs[col + 1] - xs[col], h: ys[fila + 1] - ys[fila], tipo: bloq ? 'bloqueada' : pasillo ? 'pasillo' : 'libre' });
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
  if (x < d.x0 || x >= d.x1 || y < d.y0 || y >= d.y1) return null;
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
export const BRASEROS: Record<Forma, Brasero[]> = {
  vertical: [
    { x: 8.5, y: 37.4, parada: [0, 0], mirar: 'izquierda' }, // atrás a la izquierda
    { x: 96, y: 57.6, parada: [3, 4], mirar: 'derecha' }, // atrás a la derecha (la fuente ocupa la esquina)
    { x: 8.5, y: 78.6, parada: [6, 0], mirar: 'izquierda' }, // adelante a la izquierda
    { x: 96, y: 78.6, parada: [6, 4], mirar: 'derecha' }, // adelante a la derecha
  ],
  horizontal: [
    { x: 14, y: 38, parada: [0, 0], mirar: 'izquierda' },
    { x: 90, y: 66, parada: [3, 6], mirar: 'derecha' },
    { x: 14, y: 66, parada: [3, 0], mirar: 'izquierda' },
    { x: 90, y: 96, parada: [6, 6], mirar: 'derecha' },
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
  const puntos: Array<[number, number]> = desde === undefined ? [[todas[inicio].x, d.entrada[1]]] : [[todas[inicio].x, todas[inicio].y]];
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
  return [...pts, [todas[inicio].x, d.entrada[1]]];
}
