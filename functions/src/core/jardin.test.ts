import { describe, expect, it } from 'vitest';
import { diasSinCumplir, estadoSimulado, etapaPlanta, faltanParaCrecer, MARCHITA } from './jardin.js';
import type { Habito, Registro } from './habitos.js';

describe('jardín estoico', () => {
  it('la planta crece con la racha', () => {
    expect([0, 1, 3, 4, 10, 11, 29, 30, 200].map((r) => etapaPlanta(r, 0))).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
  it('a los 3 días seguidos sin cumplir se marchita', () => {
    expect(etapaPlanta(0, 2)).toBe(0);
    expect(etapaPlanta(0, 3)).toBe(MARCHITA);
  });
  it('cuántos días faltan para crecer', () => {
    expect(faltanParaCrecer(0, 0)).toBe(1);
    expect(faltanParaCrecer(5, 2)).toBe(6);
    expect(faltanParaCrecer(40, 4)).toBeNull();
  });
  it('al volver a cumplir, revive como brote', () => {
    const marchita = estadoSimulado([true, true, false, false, false]);
    expect(marchita.etapa).toBe(MARCHITA);
    expect(estadoSimulado([true, true, false, false, false, true]).etapa).toBe(1);
  });
  it('días sin cumplir: cuenta desde ayer, salta días no activos y hoy cumplido lo pone en cero', () => {
    const h = { id: 'a', tipo: 'sino', meta: 1, dias: [1, 2, 3, 4, 5], inicio: '2026-10-01', racha: 0 } as unknown as Habito;
    const r = (hecho: boolean) => ({ hecho }) as unknown as Registro;
    // 2026-11-06 viernes cumplido; sábado y domingo no tocan; lunes 9 y martes 10 sin cumplir; hoy miércoles 11.
    const reg = new Map([['2026-11-06', r(true)]]);
    expect(diasSinCumplir(h, reg, '2026-11-11')).toBe(2);
    reg.set('2026-11-11', r(true));
    expect(diasSinCumplir(h, reg, '2026-11-11')).toBe(0);
  });
});
