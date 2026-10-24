import { describe, expect, it } from 'vitest';
import { minutoUTC } from './fechas.js';
import { horasRecordatorio, validarHabito } from './habitos.js';
import { avanceProyecto, tareaHecha, validarProyecto, validarTarea, type Tarea } from './rutina.js';

const tarea = (extra: Partial<Tarea> = {}): Tarea => ({ id: 't1', titulo: 'Embalar', dependeDeTi: true, momento: 1, fecha: null, repetir: 'no', creado: 1, actualizado: 1, actualizadoPor: 'a', ...extra });

describe('avisos a cualquier minuto', () => {
  it('convierte la hora local al minuto UTC (Asunción es UTC−3)', () => {
    expect(minutoUTC('07:40', 'America/Asuncion')).toBe(10 * 60 + 40);
    expect(minutoUTC('22:05', 'America/Asuncion')).toBe(1 * 60 + 5);
    expect(minutoUTC('00:00', 'UTC')).toBe(0);
  });
  it('lee las horas nuevas o la única de versiones anteriores', () => {
    expect(horasRecordatorio({ recordatorio: '06:30' })).toEqual(['06:30']);
    expect(horasRecordatorio({ recordatorio: '06:30', recordatorios: ['21:00', '07:15'] })).toEqual(['07:15', '21:00']);
    expect(horasRecordatorio({ recordatorio: null })).toEqual([]);
  });
  it('valida hasta 3 horas distintas', () => {
    const base = { nombre: 'Agua', tipo: 'sino' as const, virtud: 'templanza' as const, icono: 'water', momento: 1 as const, dias: [1], meta: 1, unidad: '', variables: [], inicio: '2026-10-01' };
    expect(validarHabito({ ...base, recordatorios: ['07:00', '12:00', '18:00'] })).toBeNull();
    expect(validarHabito({ ...base, recordatorios: ['07:00', '08:00', '09:00', '10:00'] })).toMatch(/hasta 3/);
    expect(validarHabito({ ...base, recordatorios: ['07:00', '07:00'] })).toMatch(/misma hora/);
  });
  it('una tarea con hora necesita fecha o repetirse', () => {
    expect(validarTarea(tarea({ hora: '18:00' }))).toMatch(/necesita una fecha/);
    expect(validarTarea(tarea({ hora: '18:00', fecha: '2026-10-24' }))).toBeNull();
    expect(validarTarea(tarea({ hora: '18:00', repetir: 'diaria' }))).toBeNull();
  });
});

describe('tareas hechas y proyectos', () => {
  it('las que no se repiten se completan en la tarea y siguen hechas otro día', () => {
    expect(tareaHecha(tarea({ completada: '2026-10-20' }), '2026-10-23', new Set())).toBe(true);
    expect(tareaHecha(tarea({ completada: null }), '2026-10-23', new Set(['t1_2026-10-20']))).toBe(false);
  });
  it('respeta las marcas de versiones anteriores', () => {
    expect(tareaHecha(tarea(), '2026-10-23', new Set(['t1_2026-10-20']))).toBe(true);
    expect(tareaHecha(tarea({ fecha: '2026-10-21' }), '2026-10-23', new Set(['t1_2026-10-21']))).toBe(true);
  });
  it('las diarias se marcan por día', () => {
    const t = tarea({ repetir: 'diaria', fecha: '2026-10-01' });
    expect(tareaHecha(t, '2026-10-23', new Set(['t1_2026-10-22']))).toBe(false);
    expect(tareaHecha(t, '2026-10-23', new Set(['t1_2026-10-23']))).toBe(true);
  });
  it('el avance cuenta solo lo que depende de vos', () => {
    const ts = [tarea({ id: 'a', completada: '2026-10-23' }), tarea({ id: 'b', completada: null }), tarea({ id: 'c', dependeDeTi: false })];
    expect(avanceProyecto(ts, '2026-10-23', new Set())).toEqual({ hechas: 1, total: 2 });
  });
  it('valida el proyecto', () => {
    expect(validarProyecto({ nombre: 'Mudanza', fechaLimite: null })).toBeNull();
    expect(validarProyecto({ nombre: '   ' })).toMatch(/nombre/);
    expect(validarProyecto({ nombre: 'Tesis', fechaLimite: 'mañana' })).toMatch(/fecha/);
  });
});
