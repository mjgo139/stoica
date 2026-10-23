import { describe, expect, it } from 'vitest';
import { calcularMetricas, haceCuanto, type Cuenta } from './admin.js';

const dia = 864e5;
const ahora = Date.UTC(2026, 9, 23, 15); // 23 oct, mediodía en Asunción
const c = (alta: number, acceso: number, extra: Partial<Cuenta> = {}): Cuenta => ({ nombre: 'x', correo: 'x@x', alta: ahora - alta * dia, ultimoAcceso: ahora - acceso * dia, plataforma: 'Android · app', rol: 'usuario', suspendida: false, ...extra });

describe('métricas del admin', () => {
  it('cuenta activos, altas y retención sin nombres', () => {
    const m = calcularMetricas([c(0, 0), c(3, 1), c(20, 2), c(40, 35, { suspendida: true, plataforma: 'iOS · web' })], { sino: 3, cantidad: 1, medicion: 0 }, ahora, 'America/Asuncion');
    expect(m).toMatchObject({ fecha: '2026-10-23', total: 4, activosHoy: 1, activos7: 3, activos30: 3, altasHoy: 1, altas7: 2, altas30: 3, suspendidas: 1 });
    expect(m.retencion7).toBe(50); // de las 2 cuentas con más de 7 días, volvió 1
    expect(m.porPlataforma).toEqual({ Android: 3, iOS: 1 });
    expect(JSON.stringify(m)).not.toContain('x@x');
  });
  it('hace cuánto', () => {
    expect(haceCuanto(ahora, ahora, 'America/Asuncion')).toBe('hoy');
    expect(haceCuanto(ahora - dia, ahora, 'America/Asuncion')).toBe('ayer');
    expect(haceCuanto(ahora - 5 * dia, ahora, 'America/Asuncion')).toBe('hace 5 días');
    expect(haceCuanto(ahora - 65 * dia, ahora, 'America/Asuncion')).toBe('hace 2 meses');
  });
});
