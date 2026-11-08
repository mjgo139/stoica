import { describe, expect, it } from 'vitest';
import { calcularAvance, diasDesde, simularDias, type ResultadoDia } from './progreso.js';
import type { Habito, Registro } from './habitos.js';

const C = 'cumplido' as const;
const F = 'fallado' as const;
const veces = (d: ResultadoDia, n: number) => Array.from({ length: n }, () => d);

describe('progreso del espejo', () => {
  it('cada 10 días cumplidos avanza una etapa hacia la meta (bajando por el camino)', () => {
    const a = calcularAvance({ desde: 5, meta: 1 }, veces(C, 15));
    expect(a.puntos).toBe(15);
    expect(a.posicion).toBeCloseTo(3.5);
    expect(a.etapa).toBe(4);
    expect(a.siguiente).toBe(3);
    expect(a.enEtapa).toBe(5);
    expect(a.faltanEtapa).toBe(5);
    expect(a.faltanMeta).toBe(25);
    expect(a.racha).toBe(15);
  });
  it('subiendo (músculo) y sin pasarse de la meta', () => {
    const a = calcularAvance({ desde: 0, meta: 2 }, veces(C, 40));
    expect(a.puntos).toBe(20);
    expect(a.posicion).toBe(2);
    expect(a.llegaste).toBe(true);
    expect(a.siguiente).toBeNull();
    expect(a.faltanMeta).toBe(0);
  });
  it('fallar 2 días se perdona; desde el 3.º seguido se retrocede 1 por día, sin bajar de la etapa inicial', () => {
    expect(calcularAvance({ desde: 3, meta: 1 }, [...veces(C, 6), F, F]).puntos).toBe(6);
    expect(calcularAvance({ desde: 3, meta: 1 }, [...veces(C, 6), ...veces(F, 4)]).puntos).toBe(4);
    expect(calcularAvance({ desde: 3, meta: 1 }, [...veces(C, 2), ...veces(F, 9)]).puntos).toBe(0);
    const a = calcularAvance({ desde: 3, meta: 1 }, [...veces(C, 6), F, F]);
    expect(a.racha).toBe(0);
    expect(a.sinCumplir).toBe(2);
  });
  it('los días libres y hoy pendiente no cortan la racha', () => {
    const a = calcularAvance({ desde: 3, meta: 1 }, [C, 'libre', C, C, 'pendiente']);
    expect(a.racha).toBe(3);
    expect(a.puntos).toBe(3);
  });
  it('un día cuenta solo si se hicieron todos los hábitos elegidos que tocaban', () => {
    const h = (id: string, dias = [0, 1, 2, 3, 4, 5, 6]): Habito => ({ id, nombre: id, tipo: 'sino', meta: 1, dias, inicio: '2026-11-01', archivado: false }) as unknown as Habito;
    const r = (hecho: boolean) => ({ hecho, valor: hecho ? 1 : 0 }) as unknown as Registro;
    const registros = new Map([
      ['a', new Map([['2026-11-01', r(true)], ['2026-11-02', r(true)], ['2026-11-03', r(true)]])],
      ['b', new Map([['2026-11-01', r(true)], ['2026-11-02', r(false)]])],
    ]);
    // 2026-11-03 es martes: "b" solo toca domingo y lunes → ese día alcanza con "a".
    const dias = diasDesde([h('a'), h('b', [0, 1])], registros, '2026-11-01', '2026-11-04');
    expect(dias).toEqual(['cumplido', 'fallado', 'cumplido', 'pendiente']);
  });
  it('la simulación es repetible', () => {
    expect(simularDias(30, 70, 5)).toEqual(simularDias(30, 70, 5));
    expect(simularDias(100, 100).every((d) => d === 'cumplido')).toBe(true);
  });
});
