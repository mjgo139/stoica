import { describe, expect, it } from 'vitest';
import { esMetaGrande, saltosPara } from './HojaCantidad';

describe('cantidades grandes', () => {
  it('atajos según la meta', () => {
    expect(saltosPara(8000)).toEqual([500, 1000, 2000]);
    expect(saltosPara(10000)).toEqual([1000, 2000, 5000]);
    expect(saltosPara(100)).toEqual([10, 20, 50]);
  });
  it('desde 51 se escribe la cantidad; hasta 50 se suma de a uno', () => {
    expect(esMetaGrande({ tipo: 'cantidad', meta: 8000 })).toBe(true);
    expect(esMetaGrande({ tipo: 'cantidad', meta: 30 })).toBe(false);
    expect(esMetaGrande({ tipo: 'sino', meta: 1 })).toBe(false);
  });
});
