import { describe, expect, it } from 'vitest';
import type { Habito, Registro } from '@core/habitos';
import { armarRmskin, armarTextoEscritorio, armarZip, LARGO_CODIGO, nuevoCodigoEscritorio, skinIni, skinLua, utf16le } from './escritorio';

const h = (id: string, nombre: string, orden: number, extra: Partial<Habito> = {}): Habito =>
  ({ id, nombre, tipo: 'sino', virtud: 'sabiduria', icono: 'med', momento: 0, dias: [0, 1, 2, 3, 4, 5, 6], meta: 1, unidad: '', variables: [], recordatorio: null, inicio: '2026-01-01', archivado: false, orden, racha: 0, mejorRacha: 0, creado: orden, actualizado: 0, actualizadoPor: 'yo', ...extra }) as unknown as Habito;

describe('widget de escritorio', () => {
  it('el código es largo y al azar', () => {
    const a = nuevoCodigoEscritorio();
    expect(a).toHaveLength(LARGO_CODIGO);
    expect(a).toMatch(/^[a-zA-Z0-9]+$/);
    expect(nuevoCodigoEscritorio()).not.toBe(a);
  });

  it('resumen: solo hábitos de hoy, sin separadores en los nombres, hecho y racha', () => {
    const hoy = '2026-11-25';
    const regs = new Map<string, Map<string, Registro>>([
      ['a', new Map([['2026-11-24', { hecho: true } as Registro], [hoy, { hecho: true } as Registro]])],
    ]);
    const r = armarTextoEscritorio(
      {
        nombre: 'Marco',
        hoy,
        habitos: [h('a', 'Meditar | ~ "ya"', 0), h('b', 'Leer', 1), h('c', 'Archivado', 2, { archivado: true }), h('d', 'Mañana', 3, { inicio: '2026-12-01' })],
        registros: (id) => regs.get(id) ?? new Map(),
        ventana: 60,
      },
      '14:05',
    );
    expect(r.texto).toBe('1|Marco|2026-11-25|14:05~a|Meditar ya|1|2~b|Leer|0|0');
    expect(r.clave).toBe('1|Marco|2026-11-25~a|Meditar ya|1|2~b|Leer|0|0');
  });

  it('hasta 8 hábitos', () => {
    const muchos = Array.from({ length: 12 }, (_, i) => h(`h${i}`, `H${i}`, i));
    const r = armarTextoEscritorio({ nombre: 'M', hoy: '2026-11-25', habitos: muchos, registros: () => new Map(), ventana: 60 }, '10:00');
    expect(r.texto.split('~')).toHaveLength(9);
  });

  it('el skin trae la dirección del resumen y los colores de la familia; los textos van en UTF-16 LE', () => {
    const ini = skinIni('stoica-app', 'CODIGO123');
    expect(ini).toContain('documents/escritorio/CODIGO123');
    expect(ini).toMatch(/Oro=\d+,\d+,\d+/);
    expect(ini).toContain('[MeterH8Racha]');
    expect(skinLua()).toContain('function Update()');
    const b = utf16le('Á\n');
    expect(Array.from(b)).toEqual([0xff, 0xfe, 0xc1, 0x00, 0x0d, 0x00, 0x0a, 0x00]);
  });

  it('el .rmskin es un zip válido con el pie de Rainmeter', () => {
    const datos = new TextEncoder().encode('hola');
    const zip = armarZip([{ nombre: 'a.txt', datos }]);
    const p = armarRmskin([{ nombre: 'a.txt', datos }]);
    expect(p.length).toBe(zip.length + 16);
    const pie = new DataView(p.buffer, p.length - 16);
    expect(pie.getUint32(0, true)).toBe(zip.length);
    expect(Array.from(p.slice(-8))).toEqual([0, 0x52, 0x4d, 0x53, 0x4b, 0x49, 0x4e, 0]);
    // Firma de zip al principio y CRC32 de "hola" en la cabecera
    expect(new DataView(p.buffer).getUint32(0, true)).toBe(0x04034b50);
    expect(new DataView(p.buffer).getUint32(14, true)).toBe(0x6fa0f988);
  });
});
