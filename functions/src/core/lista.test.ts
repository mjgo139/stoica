import { describe, expect, it } from 'vitest';
import { alternarItem, cumplido, itemLista, itemsHechos, porcentajeItems, progreso, validarHabito, type Habito, type Registro } from './habitos.js';

const comidas = [itemLista('almuerzo', 'Almuerzo'), itemLista('merienda', 'Merienda'), itemLista('cena', 'Cena')];
const h: Habito = {
  id: 'h', nombre: 'Comer bien', tipo: 'lista', virtud: 'templanza', icono: 'food', momento: 1, dias: [0, 1, 2, 3, 4, 5, 6], meta: 3, unidad: '', variables: comidas,
  recordatorio: null, recordatorioSlot: null, inicio: '2026-10-01', archivado: false, orden: 0, racha: 0, mejorRacha: 0, creado: 0, actualizado: 0, actualizadoPor: 'u',
};
const reg = (fecha: string, medidas: Record<string, number>): Registro => ({ habitId: 'h', fecha, hecho: false, valor: Object.keys(medidas).length, medidas, nota: '', actualizado: 0, actualizadoPor: 'u' });

describe('hábito de tipo lista', () => {
  it('marca y desmarca ítems y cuenta cuántos van', () => {
    let r: Partial<Registro> = {};
    r = { ...r, ...alternarItem(h, r, 'almuerzo') };
    r = { ...r, ...alternarItem(h, r, 'cena') };
    expect(itemsHechos(h, r)).toEqual(['almuerzo', 'cena']);
    expect(r.valor).toBe(2);
    expect(cumplido(h, r)).toBe(false);
    expect(progreso(h, r)).toBeCloseTo(2 / 3);
    r = { ...r, ...alternarItem(h, r, 'merienda') };
    expect(cumplido(h, r)).toBe(true);
    expect(r.hecho).toBe(true);
    r = { ...r, ...alternarItem(h, r, 'cena') };
    expect(r.medidas).toEqual({ almuerzo: 1, merienda: 1 });
    expect(cumplido(h, r)).toBe(false);
  });

  it('con meta menor, alcanza con algunos ítems', () => {
    expect(cumplido({ ...h, meta: 2 }, reg('2026-10-02', { almuerzo: 1, cena: 1 }))).toBe(true);
  });

  it('ignora ítems que ya no están en el hábito', () => {
    const sinCena = { ...h, variables: comidas.slice(0, 2), meta: 2 };
    const r = alternarItem(sinCena, reg('2026-10-02', { cena: 1, almuerzo: 1 }), 'merienda');
    expect(r.medidas).toEqual({ almuerzo: 1, merienda: 1 });
    expect(r.valor).toBe(2);
  });

  it('porcentaje por ítem', () => {
    const regs = new Map([
      ['2026-10-01', reg('2026-10-01', { almuerzo: 1, cena: 1 })],
      ['2026-10-02', reg('2026-10-02', { almuerzo: 1 })],
    ]);
    expect(porcentajeItems(h, regs, '2026-10-01', '2026-10-02').map((x) => x.porcentaje)).toEqual([100, 0, 100]); // el último día (hoy) sin marcar no cuenta todavía
  });

  it('valida ítems y meta', () => {
    expect(validarHabito(h)).toBeNull();
    expect(validarHabito({ ...h, variables: comidas.slice(0, 1), meta: 1 })).toMatch(/al menos 2/);
    expect(validarHabito({ ...h, meta: 4 })).toMatch(/entre 1 y 3/);
    expect(validarHabito({ ...h, variables: [...comidas, itemLista('x', 'cena')] , meta: 2})).toMatch(/mismo nombre/);
  });
});
