import { describe, expect, it } from 'vitest';
import { diasGraciaValidos, esCodigoPlan, estadoPlan, extenderPlan, generarCodigoPlan, normalizarCodigoPlan, validarMensaje, fotoCumplida, idFotoHabito } from './plan.js';

const D = 864e5;
const t = (s: string) => Date.parse(`${s}T12:00:00Z`);

describe('plan de fotos y chat', () => {
  it('estados: sin plan, activo, espera y borrado', () => {
    const hasta = t('2026-11-25');
    expect(estadoPlan(undefined, t('2026-10-25'))).toEqual({ estado: 'sin' });
    expect(estadoPlan(hasta, t('2026-10-25'))).toMatchObject({ estado: 'activo', diasRestantes: 31 });
    expect(estadoPlan(hasta, hasta + 2 * D, 7)).toMatchObject({ estado: 'gracia', diasParaBorrar: 5, borraEn: hasta + 7 * D });
    expect(estadoPlan(hasta, hasta + 8 * D, 7)).toMatchObject({ estado: 'borrado' });
    expect(estadoPlan(hasta, hasta + 1, 0)).toMatchObject({ estado: 'borrado' });
  });
  it('extiende desde hoy o desde el vencimiento si sigue activo', () => {
    expect(new Date(extenderPlan(undefined, t('2026-10-25'), 1)).toISOString().slice(0, 10)).toBe('2026-11-25');
    expect(new Date(extenderPlan(t('2026-11-25'), t('2026-10-25'), 3)).toISOString().slice(0, 10)).toBe('2027-02-25');
    expect(new Date(extenderPlan(t('2026-01-01'), t('2026-10-25'), 12)).toISOString().slice(0, 10)).toBe('2027-10-25');
    expect(new Date(extenderPlan(undefined, t('2026-01-31'), 1)).toISOString().slice(0, 10)).toBe('2026-02-28');
  });
  it('códigos: formato, normalización y validación', () => {
    let i = 0;
    const c = generarCodigoPlan(() => (i++ % 10) / 10);
    expect(esCodigoPlan(c)).toBe(true);
    expect(normalizarCodigoPlan(' stoa 7k2m q9xp ')).toBe('STOA-7K2M-Q9XP');
    expect(normalizarCodigoPlan('7K2MQ9XP')).toBe('STOA-7K2M-Q9XP');
    expect(normalizarCodigoPlan('corto')).toBe('');
    expect(esCodigoPlan('STOA-0O1I-AAAA')).toBe(false);
  });
  it('días de espera y mensajes', () => {
    expect(diasGraciaValidos('10')).toBe(10);
    expect(diasGraciaValidos(-1)).toBe(7);
    expect(diasGraciaValidos(500)).toBe(7);
    expect(validarMensaje('  ')).toMatch(/Escribí/);
    expect(validarMensaje('x'.repeat(281))).toMatch(/280/);
    expect(validarMensaje('¡Vamos!')).toBeNull();
  });
});

import { semanaAlDia } from './comunidad.js';
describe('semana compartida', () => {
  const s = [true, false, true, true, false, true, true];
  it('al día: igual', () => expect(semanaAlDia(s, '2026-10-25', '2026-10-25')).toEqual(s));
  it('resumen de hace 2 días: corre y deja sin dato los últimos', () => expect(semanaAlDia(s, '2026-10-23', '2026-10-25')).toEqual([true, true, false, true, true, null, null]));
  it('sin semana (versiones anteriores): todo sin dato', () => expect(semanaAlDia(undefined, '2026-10-25', '2026-10-25')).toEqual(Array(7).fill(null)));
});

describe('foto ligada al estado del hábito', () => {
  const resumen = { fecha: '2026-10-28', compartidos: [{ habitId: 'h1', hoy: true, semana: [true, true, false, true, true, true, true] }] };
  it('hoy manda lo que dice el resumen (si marcó o desmarcó después de subirla)', () => {
    expect(fotoCumplida({ habitId: 'h1', dia: '2026-10-28', cumplido: false }, resumen)).toBe(true);
  });
  it('días de la semana: se toma de la semana del resumen', () => {
    expect(fotoCumplida({ habitId: 'h1', dia: '2026-10-24', cumplido: true }, resumen)).toBe(false);
  });
  it('más viejo, sin resumen o de otro hábito: lo que valía al subirla', () => {
    expect(fotoCumplida({ habitId: 'h1', dia: '2026-10-01', cumplido: true }, resumen)).toBe(true);
    expect(fotoCumplida({ habitId: 'h2', dia: '2026-10-28', cumplido: false }, resumen)).toBe(false);
    expect(fotoCumplida({ habitId: 'h1', dia: '2026-10-28', cumplido: false }, null)).toBe(false);
  });
  it('id determinístico: una por persona, hábito y día', () => {
    expect(idFotoHabito('u1', 'h1', '2026-10-28')).toBe('u1_h1_2026-10-28');
  });
});
