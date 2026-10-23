const TABLA: Array<[number, string]> = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

/** Número romano para rachas. 0 o negativo devuelve "0". */
export function aRomano(n: number): string {
  let resto = Math.floor(n);
  if (!Number.isFinite(resto) || resto <= 0) return '0';
  if (resto > 3999) return String(resto);
  let s = '';
  for (const [v, r] of TABLA) {
    while (resto >= v) {
      s += r;
      resto -= v;
    }
  }
  return s;
}
