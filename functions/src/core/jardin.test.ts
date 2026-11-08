import { describe, expect, it } from 'vitest';
import { diasSinCumplir, estadoPorDias, estadoSimulado, etapaPlanta, faltanParaCrecer, MARCHITA } from './jardin.js';
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
  it('riego manual: el día cuenta solo si se cumplió y se regó', () => {
    const h = { dias: [0, 1, 2, 3, 4, 5, 6], inicio: '2026-11-01' };
    const cumplidos = new Set(['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
    const regados = new Set(['2026-11-06', '2026-11-07']);
    const e = estadoPorDias(h, '2026-11-08', (d) => cumplidos.has(d) && regados.has(d));
    // hoy (8) cumplido pero sin regar todavía: no corta; 7 y 6 buenos; 5 sin regar corta.
    expect(e.racha).toBe(2);
    expect(e.sinCumplir).toBe(0);
    regados.add('2026-11-08');
    expect(estadoPorDias(h, '2026-11-08', (d) => cumplidos.has(d) && regados.has(d)).racha).toBe(3);
    // Tres días sin regar → marchita
    const nada = estadoPorDias(h, '2026-11-12', (d) => cumplidos.has(d) && regados.has(d));
    expect(nada.sinCumplir).toBe(3);
    expect(nada.etapa).toBe(MARCHITA);
  });
});
