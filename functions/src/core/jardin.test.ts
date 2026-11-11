import { describe, expect, it } from 'vitest';
import { analizar, buenosDesde, diasSinCumplir, estadoPorDias, estadoSimulado, alCien, consejo, visitaDelDia, rachaRetono, retonos, etapaPlanta, faltanParaCrecer, MARCHITA, plantaCompartida, plantasEnPeligro, avisoDelJardin } from './jardin.js';
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


describe('jardín: medallas, retoños y modo difícil', () => {
  const v = (s: string) => [...s].map((c) => (c === '1' ? true : c === '0' ? false : null));
  it('analiza racha, mejor racha, ciclo y marchitada', () => {
    const a = analizar(v('1111000111'), false);
    expect(a.racha).toBe(3);
    expect(a.mejor).toBe(4);
    expect(a.marchitaEn).toBe(6);
    expect(a.ciclo).toBe(3);
    expect(a.mejorCiclo).toBe(4);
  });
  it('fallar 1 o 2 días no achica la planta (solo trae plagas); al 3.º se marchita', () => {
    const treinta = '1'.repeat(30);
    expect(analizar(v(treinta + '00'), false).etapa).toBe(4);
    expect(analizar(v(treinta + '000'), false).etapa).toBe(MARCHITA);
  });
  it('dos días sin cumplir no reinician el ciclo; tres sí', () => {
    expect(analizar(v('11100111'), false).ciclo).toBe(6);
    expect(analizar(v('111000111'), false).ciclo).toBe(3);
  });
  it('hoy pendiente no cuenta como fallado', () => {
    const a = analizar(v('1110'), true);
    expect(a.racha).toBe(3);
    expect(a.sinCumplir).toBe(0);
  });
  it('los días que no tocan se saltean', () => {
    expect(analizar(v('11-1-1'), false).racha).toBe(4);
  });
  it('medalla solo al 100 % (florecida); retoños cada 30 días del ciclo', () => {
    expect([3, 4, MARCHITA].map(alCien)).toEqual([false, true, false]);
    expect([29, 30, 61, 200, 9999].map(retonos)).toEqual([0, 1, 2, 6, 15]);
    expect(rachaRetono(45, 0)).toBe(15);
    expect(rachaRetono(45, 1)).toBe(0);
  });
  it('el filósofo avisa según el riesgo', () => {
    expect(consejo(1, 'Meditar', 0).titulo).toContain('Ayer');
    expect(consejo(2, 'Meditar', 4).titulo).toContain('Dos días');
    expect(consejo(0, 'Meditar', 2).titulo).toContain('pasea');
  });
  it('modo difícil: solo cuentan los días buenos después de la última marchitada de cualquier planta', () => {
    expect(buenosDesde(v('1111111111'), 4, false)).toBe(5);
  });
  it('la visita del filósofo es la misma todo el día y no es todos los días', () => {
    expect(visitaDelDia('2026-11-08', 7)).toEqual(visitaDelDia('2026-11-08', 7));
    const dias = Array.from({ length: 300 }, (_, i) => `dia-${i}`);
    const con = dias.filter((d) => visitaDelDia(d, 5)).length;
    expect(con).toBeGreaterThan(60);
    expect(con).toBeLessThan(140);
  });
});

describe('jardín de otra persona del grupo', () => {
  it('crece con la racha compartida y da retoños', () => {
    expect(plantaCompartida({ racha: 0, semana: [true, false, false, false, false, false, false] })).toEqual({ etapa: 0, retonos: 0 });
    expect(plantaCompartida({ racha: 12 })).toEqual({ etapa: 3, retonos: 0 });
    expect(plantaCompartida({ racha: 65 })).toEqual({ etapa: 4, retonos: 2 });
  });
  it('se ve marchita solo si no cumplió ningún día de la semana', () => {
    expect(plantaCompartida({ racha: 0, semana: Array(7).fill(false) }).etapa).toBe(MARCHITA);
    expect(plantaCompartida({ racha: 0 }).etapa).toBe(0);
  });
});

describe('aviso del jardín', () => {
  const h = { id: 'a', nombre: 'Meditar', virtud: 'sabiduria', tipo: 'sino', meta: 1, dias: [0, 1, 2, 3, 4, 5, 6], inicio: '2026-11-01' } as unknown as Habito;
  const r = (hecho: boolean) => ({ hecho }) as unknown as Registro;
  it('avisa cuando lleva 2 días sin cumplir y hoy todavía no', () => {
    const regs = new Map([['a', new Map([['2026-11-07', r(true)]])]]);
    expect(plantasEnPeligro([h], regs, '2026-11-10').map((x) => x.id)).toEqual(['a']);
    // Hoy ya cumplido: no avisa
    regs.get('a')!.set('2026-11-10', r(true));
    expect(plantasEnPeligro([h], regs, '2026-11-10')).toEqual([]);
    // Solo 1 día sin cumplir: todavía no
    expect(plantasEnPeligro([h], new Map([['a', new Map([['2026-11-08', r(true)]])]]), '2026-11-10')).toEqual([]);
  });
  it('en riego manual, cumplir sin regar no salva la planta', () => {
    const regs = new Map([['a', new Map([['2026-11-07', r(true)], ['2026-11-08', r(true)], ['2026-11-09', r(true)]])]]);
    expect(plantasEnPeligro([h], regs, '2026-11-10', { modo: 'manual', riegos: { a: ['2026-11-07'] } }).length).toBe(1);
    expect(plantasEnPeligro([h], regs, '2026-11-10', { modo: 'auto' }).length).toBe(0);
  });
  it('el texto nombra la planta de la virtud', () => {
    expect(avisoDelJardin([h]).titulo).toBe('Tu olivo se marchita mañana');
    expect(avisoDelJardin([h, { ...h, nombre: 'Leer' }]).titulo).toContain('2 plantas');
  });
});
