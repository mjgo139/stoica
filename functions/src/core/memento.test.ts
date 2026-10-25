import { describe, expect, it } from 'vitest';
import { calcularVida, finDeAnio, proximoCumple, sumarAnios, validarContador, validarEsperanza, validarNacimiento } from './memento.js';

describe('memento mori', () => {
  it('edad exacta, días y semanas vividas', () => {
    const v = calcularVida('1999-05-10', '2026-10-25', 73);
    expect([v.anios, v.meses, v.dias]).toEqual([27, 5, 15]);
    expect(v.diasVividos).toBe(10030);
    expect(v.semanasVividas).toBe(1432);
    expect(v.semanasTotales).toBe(73 * 52);
    expect(v.aniosRestantes).toBeCloseTo(45.5, 0);
    expect(v.porcentaje).toBeGreaterThan(37);
    expect(v.porcentaje).toBeLessThan(38);
  });
  it('si ya pasó la esperanza de vida, no quedan días negativos', () => {
    expect(calcularVida('1940-01-01', '2026-10-25', 73).diasRestantes).toBe(0);
  });
  it('cumpleaños y fin de año', () => {
    expect(proximoCumple('1999-05-10', '2026-10-25')).toEqual({ fecha: '2027-05-10', dias: 197, cumple: 28 });
    expect(proximoCumple('1999-10-25', '2026-10-25').dias).toBe(0);
    expect(sumarAnios('2000-02-29', 1)).toBe('2001-02-28');
    expect(finDeAnio('2026-10-25')).toEqual({ fecha: '2027-01-01', dias: 68, anio: 2027 });
  });
  it('validaciones', () => {
    expect(validarNacimiento('2030-01-01', '2026-10-25')).toMatch(/futura/);
    expect(validarNacimiento('1999-05-10', '2026-10-25')).toBeNull();
    expect(validarEsperanza(73)).toBeNull();
    expect(validarEsperanza(200)).toMatch(/40 a 120/);
    expect(validarContador({ nombre: 'Viaje', fecha: '2027-01-15' })).toBeNull();
    expect(validarContador({ nombre: '', fecha: '2027-01-15' })).toMatch(/nombre/);
  });
});
