import { describe, expect, it } from 'vitest';
import {
  balanceVirtudes,
  cumplido,
  esDiaActivo,
  estadoDia,
  hitoAlcanzado,
  mejorRacha,
  porcentaje,
  progreso,
  proyectar,
  racha,
  serieDeVariable,
  validarHabito,
  type Habito,
  type Registro,
} from './habitos.js';
import { desfaseMinutos, diferenciaDias, franjaUTC, rangoDias, sumarDias } from './fechas.js';
import { estadoDesafio, esCodigo, generarCodigo, normalizarCodigo, validarDesafio } from './comunidad.js';
import { examenCompleto, examenVacio, mmss, restante, tareaDelDia, tareaVencida, validarTarea, type Tarea } from './rutina.js';

const base = (extra: Partial<Habito> = {}): Habito => ({
  id: 'h1',
  nombre: 'Meditar',
  tipo: 'sino',
  virtud: 'sabiduria',
  icono: 'med',
  momento: 0,
  dias: [0, 1, 2, 3, 4, 5, 6],
  meta: 1,
  unidad: '',
  variables: [],
  recordatorio: null,
  recordatorioSlot: null,
  inicio: '2026-10-01',
  archivado: false,
  orden: 0,
  racha: 0,
  mejorRacha: 0,
  creado: 0,
  actualizado: 0,
  actualizadoPor: 'u',
  ...extra,
});

const reg = (fecha: string, extra: Partial<Registro> = {}): Registro => ({ habitId: 'h1', fecha, hecho: true, valor: 0, medidas: {}, nota: '', actualizado: 0, actualizadoPor: 'u', ...extra });
const mapa = (fechas: string[], extra: Partial<Registro> = {}) => new Map(fechas.map((f) => [f, reg(f, extra)]));

describe('fechas', () => {
  it('suma días y cruza meses y años', () => {
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
    expect(diferenciaDias('2026-10-01', '2026-10-22')).toBe(21);
    expect(rangoDias('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });
  it('calcula la franja UTC de un recordatorio', () => {
    const f = new Date(Date.UTC(2026, 9, 22, 12));
    expect(desfaseMinutos('America/Asuncion', f)).toBe(-180);
    expect(franjaUTC('07:00', 'America/Asuncion', f)).toBe(40); // 10:00 UTC
    expect(franjaUTC('22:30', 'America/Asuncion', f)).toBe(6); // 01:30 UTC
    expect(franjaUTC('07:00', 'UTC', f)).toBe(28);
  });
});

describe('cumplido y progreso por tipo', () => {
  it('sí/no', () => {
    expect(cumplido(base(), reg('2026-10-22'))).toBe(true);
    expect(cumplido(base(), reg('2026-10-22', { hecho: false }))).toBe(false);
    expect(cumplido(base(), undefined)).toBe(false);
  });
  it('cantidad: llega a la meta', () => {
    const h = base({ tipo: 'cantidad', meta: 8 });
    expect(cumplido(h, reg('x', { valor: 7 }))).toBe(false);
    expect(cumplido(h, reg('x', { valor: 8 }))).toBe(true);
    expect(progreso(h, reg('x', { valor: 4 }))).toBe(0.5);
    expect(progreso(h, reg('x', { valor: 12 }))).toBe(1);
  });
  it('medición: alcanza con registrar una variable', () => {
    const h = base({ tipo: 'medicion' });
    expect(cumplido(h, reg('x', { medidas: {} }))).toBe(false);
    expect(cumplido(h, reg('x', { medidas: { peso: 80 } }))).toBe(true);
  });
});

describe('rachas', () => {
  it('cuenta días seguidos y no corta si hoy está pendiente', () => {
    const h = base();
    const r = mapa(['2026-10-19', '2026-10-20', '2026-10-21']);
    expect(racha(h, r, '2026-10-22')).toBe(3);
    r.set('2026-10-22', reg('2026-10-22'));
    expect(racha(h, r, '2026-10-22')).toBe(4);
  });
  it('se corta con un día no cumplido', () => {
    const r = mapa(['2026-10-18', '2026-10-20', '2026-10-21']);
    expect(racha(base(), r, '2026-10-22')).toBe(2);
  });
  it('ignora los días que el hábito no está activo', () => {
    // Solo lunes (1) y jueves (4). 2026-10-19 es lunes, 2026-10-22 jueves, 2026-10-15 jueves.
    const h = base({ dias: [1, 4] });
    expect(esDiaActivo(h, '2026-10-20')).toBe(false);
    const r = mapa(['2026-10-15', '2026-10-19', '2026-10-22']);
    expect(racha(h, r, '2026-10-22')).toBe(3);
  });
  it('no cuenta antes del inicio y usa la racha guardada si la ventana se queda corta', () => {
    const h = base({ inicio: '2026-01-01', racha: 50 });
    const fechas = rangoDias('2026-10-01', '2026-10-22');
    expect(racha(h, mapa(fechas), '2026-10-22', 10)).toBe(50);
    expect(racha(base({ inicio: '2026-10-21' }), mapa(fechas), '2026-10-22')).toBe(2);
  });
  it('mejor racha', () => {
    const r = mapa(['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-21', '2026-10-22']);
    expect(mejorRacha(base(), r, '2026-10-22')).toBe(4);
  });
  it('hitos', () => {
    expect(hitoAlcanzado(6, 7)).toBe(7);
    expect(hitoAlcanzado(7, 8)).toBeNull();
    expect(hitoAlcanzado(2, 3)).toBe(3);
    expect(hitoAlcanzado(5, 4)).toBeNull();
  });
});

describe('porcentajes y calendario', () => {
  it('no castiga el día de hoy pendiente', () => {
    const r = mapa(['2026-10-20', '2026-10-21']);
    expect(porcentaje(base(), r, '2026-10-19', '2026-10-22')).toBe(67);
    r.set('2026-10-22', reg('2026-10-22'));
    expect(porcentaje(base(), r, '2026-10-19', '2026-10-22')).toBe(75);
  });
  it('estado de cada día', () => {
    const r = mapa(['2026-10-21']);
    expect(estadoDia(base(), r, '2026-10-21', '2026-10-22')).toBe('ok');
    expect(estadoDia(base(), r, '2026-10-20', '2026-10-22')).toBe('mal');
    expect(estadoDia(base(), r, '2026-10-22', '2026-10-22')).toBe('pendiente');
    expect(estadoDia(base(), r, '2026-10-23', '2026-10-22')).toBe('futuro');
    expect(estadoDia(base({ dias: [1] }), r, '2026-10-21', '2026-10-22')).toBe('inactivo');
  });
  it('balance de virtudes', () => {
    const hs = [base(), base({ id: 'h2', virtud: 'coraje' })];
    const regs = new Map([['h1', mapa(['2026-10-21'])], ['h2', new Map()]]);
    const b = balanceVirtudes(hs, regs, '2026-10-20', '2026-10-21');
    expect(b.sabiduria).toBe(50);
    expect(b.coraje).toBe(0);
    expect(b.justicia).toBeNull();
  });
});

describe('mediciones', () => {
  const v = { id: 'peso', nombre: 'Peso', unidad: 'kg', inicial: 90, meta: 80, direccion: 'bajar' as const };
  it('calcula cambio, ritmo semanal y fecha estimada', () => {
    const regs = [reg('2026-10-01', { medidas: { peso: 90 } }), reg('2026-10-08', { medidas: { peso: 89 } }), reg('2026-10-15', { medidas: { peso: 88 } })];
    const serie = serieDeVariable('peso', regs);
    const p = proyectar(v, serie, '2026-10-15');
    expect(p.cambio).toBe(-2);
    expect(p.ritmoSemanal).toBe(-1);
    expect(p.faltan).toBe(8);
    expect(p.fechaEstimada).toBe('2026-12-10');
    expect(p.avance).toBeCloseTo(0.2);
    expect(p.alcanzada).toBe(false);
  });
  it('sin fecha estimada si va en la dirección contraria', () => {
    const regs = [reg('2026-10-01', { medidas: { peso: 90 } }), reg('2026-10-08', { medidas: { peso: 91 } })];
    expect(proyectar(v, serieDeVariable('peso', regs), '2026-10-08').fechaEstimada).toBeNull();
  });
  it('meta alcanzada', () => {
    expect(proyectar(v, [{ fecha: '2026-10-01', valor: 79.5 }], '2026-10-01').alcanzada).toBe(true);
  });
});

describe('validaciones de hábitos', () => {
  it('acepta un hábito válido y rechaza los incompletos', () => {
    expect(validarHabito(base())).toBeNull();
    expect(validarHabito(base({ nombre: ' ' }))).toMatch(/nombre/);
    expect(validarHabito(base({ dias: [] }))).toMatch(/día/);
    expect(validarHabito(base({ icono: 'inventado' }))).toMatch(/ícono/);
    expect(validarHabito(base({ tipo: 'cantidad', meta: 0 }))).toMatch(/meta/);
    expect(validarHabito(base({ tipo: 'medicion', variables: [] }))).toMatch(/variable/);
    expect(validarHabito(base({ recordatorio: '25:00' }))).toMatch(/hora/);
  });
});

describe('tareas, enfoque y examen', () => {
  const t = (extra: Partial<Tarea>): Tarea => ({ id: 't', titulo: 'Llamar', dependeDeTi: true, momento: 1, fecha: '2026-10-22', repetir: 'no', creado: 0, actualizado: 0, actualizadoPor: 'u', ...extra });
  it('tareas del día', () => {
    expect(tareaDelDia(t({}), '2026-10-22')).toBe(true);
    expect(tareaDelDia(t({}), '2026-10-23')).toBe(false);
    expect(tareaDelDia(t({ fecha: null }), '2026-10-23')).toBe(true);
    expect(tareaDelDia(t({ repetir: 'diaria' }), '2026-10-30')).toBe(true);
    expect(tareaDelDia(t({ repetir: 'diaria' }), '2026-10-21')).toBe(false);
    expect(tareaVencida(t({}), false, '2026-10-23')).toBe(true);
    expect(validarTarea({ titulo: '', dependeDeTi: true })).toMatch(/Escribí/);
  });
  it('temporizador', () => {
    expect(restante(0, 25, 60_000)).toBe(24 * 60);
    expect(restante(0, 1, 120_000)).toBe(0);
    expect(mmss(1499)).toBe('24:59');
  });
  it('examen', () => {
    const e = examenVacio('2026-10-22', 'u');
    expect(examenCompleto(e)).toBe(false);
    e.respuestas.p2 = 'El enojo en el tránsito';
    expect(examenCompleto(e)).toBe(true);
  });
});

describe('comunidad', () => {
  it('códigos de invitación', () => {
    const c = generarCodigo();
    expect(esCodigo(c)).toBe(true);
    expect(normalizarCodigo('ab-cd ef23')).toBe('ABCDEF23');
    expect(esCodigo('ABCDEFG1')).toBe(false); // sin 1, 0, O, I para no confundir
  });
  it('desafíos', () => {
    expect(validarDesafio({ titulo: '21 días sin azúcar', duracion: 21, meta: 18 })).toBeNull();
    expect(validarDesafio({ titulo: 'X', duracion: 2, meta: 1 })).toMatch(/duración/);
    expect(validarDesafio({ titulo: 'X', duracion: 10, meta: 11 })).toMatch(/meta/);
    expect(estadoDesafio({ inicio: '2026-10-20', duracion: 7 }, '2026-10-22')).toEqual({ estado: 'activo', dia: 3, quedan: 4 });
    expect(estadoDesafio({ inicio: '2026-10-20', duracion: 7 }, '2026-10-27').estado).toBe('terminado');
    expect(estadoDesafio({ inicio: '2026-10-25', duracion: 7 }, '2026-10-22')).toEqual({ estado: 'proximo', dia: 0, quedan: 3 });
  });
});

import { puedeMarcarDia as puedeMarcarDiaPrueba } from './habitos';
describe('puedeMarcarDia', () => {
  it('hoy siempre, futuro nunca, pasado según el hábito (sin el campo = sí)', () => {
    expect(puedeMarcarDiaPrueba({ inicio: '2026-01-01' }, '2026-11-24', '2026-11-24')).toBe(true);
    expect(puedeMarcarDiaPrueba({ inicio: '2026-01-01' }, '2026-11-25', '2026-11-24')).toBe(false);
    expect(puedeMarcarDiaPrueba({ inicio: '2026-01-01' }, '2026-11-20', '2026-11-24')).toBe(true);
    expect(puedeMarcarDiaPrueba({ inicio: '2026-01-01', marcarPasado: false }, '2026-11-20', '2026-11-24')).toBe(false);
    expect(puedeMarcarDiaPrueba({ inicio: '2026-01-01', marcarPasado: false }, '2026-11-24', '2026-11-24')).toBe(true);
  });
});
