import { describe, expect, it } from 'vitest';
import { diasGraciaValidos, esCodigoPlan, estadoPlan, extenderPlan, generarCodigoPlan, normalizarCodigoPlan, validarMensaje } from './plan.js';

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
