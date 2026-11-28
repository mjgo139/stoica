import { describe, expect, it } from 'vitest';
import type { Habito, Registro } from '@core/habitos';
import { armarRmskin, armarTextoEscritorio, armarZip, inicioGrilla, LARGO_CODIGO, nuevoCodigoEscritorio, skinHabitoIni, skinHabitoLua, skinIni, skinLua, utf16le } from './escritorio';

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
    const [cab, a, b] = r.texto.split('~');
    expect(cab).toBe('1|Marco|2026-11-25|14:05|2026-10-26');
    // id|nombre|hecho|racha|virtud|tipo|35 días|% 30 días (el 25/11/2026 es miércoles: casilla 31 de 35, martes 24 y miércoles 25 cumplidos)
    const ca = a.split('|');
    expect(ca.slice(0, 6)).toEqual(['a', 'Meditar ya', '1', '2', 'sabiduria', 'sino']);
    expect(ca[6]).toHaveLength(35);
    expect(ca[6].slice(28)).toBe('011ffff');
    expect(b.split('|').slice(0, 4)).toEqual(['b', 'Leer', '0', '0']);
    expect(b.split('|')[6].slice(28)).toBe('00pffff');
    expect(r.clave).toBe('1|Marco|2026-11-25|2026-10-26~' + [a, b].join('~'));
  });

  it('la grilla empieza un lunes, 4 semanas antes de esta', () => {
    expect(inicioGrilla('2026-11-25')).toBe('2026-10-26');
    expect(inicioGrilla('2026-11-30')).toBe('2026-11-02');
  });

  it('la tarjeta de hábito trae su número, la siguiente y los colores', () => {
    const c = { verde: '1,2,3', rojo: '4,5,6', virtudes: { sabiduria: '7,7,7', coraje: '8,8,8', justicia: '9,9,9', templanza: '10,10,10' } };
    const ini = skinHabitoIni('stoica-app', 'COD', 2, c);
    expect(ini).toContain('Indice=2');
    expect(ini).toContain('[!ActivateConfig "StoaHabit\\Habito3" "Habito.ini"]');
    expect(ini).toContain('Templanza=10,10,10');
    expect(ini).toContain('ContextTitle11=Mostrar el jardín');
    expect(ini).toContain('ContextTitle12=Agregar otra tarjeta');
    // Semana o mes, y tres tamaños (v2.12.0)
    expect(ini).toContain(`ContextAction4=[!CommandMeasure MeasureLua "Vista('semana')"]`);
    expect(ini).toContain('ContextAction8=[!WriteKeyValue Variables E 1.3][!Refresh]');
    expect(ini).toContain('FontSize=(13*#E#)');
    // Los números del menú van seguidos (Rainmeter deja de leer en el primero que falta)
    const nums = [...ini.matchAll(/^ContextTitle(\d*)=/gm)].map((m) => Number(m[1] || 1));
    expect(nums).toEqual(nums.map((_, i) => i + 1));
    expect(skinHabitoIni('stoica-app', 'COD', 8, c)).not.toContain('Agregar otra tarjeta');
    expect(skinHabitoLua()).toContain('function Mover(paso)');
    expect(skinHabitoLua()).toContain('function Vista(cual)');
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

/** Familia 1.11.0: todos los widgets con tamaños chico · normal · grande (pedido del dueño) */
function revisarTamanos(ini: string) {
  expect(ini).toMatch(/^E=1$/m);
  for (const t of ['chico', 'normal', 'grande']) expect(ini).toContain(`Tamaño ${t}`);
  expect(ini).toContain('[!WriteKeyValue Variables E 1.3][!Refresh]');
  // ContextTitle seguidos (Rainmeter corta la lista en el primer hueco)
  const n = [...ini.matchAll(/^ContextTitle(\d*)=/gm)].map((m) => Number(m[1] || 1));
  expect(n).toEqual(n.map((_, i) => i + 1));
  // ninguna medida queda fija: todas pasan por #E#
  expect(ini).not.toMatch(/^(X|Y|W|FontSize)=-?[1-9][\d.]*[rR]?$/m);
}

describe('widget para Windows · tamaños (familia 1.11.0)', () => {
  it('la lista de hoy tiene chico · normal · grande como las tarjetas', () => {
    revisarTamanos(skinIni('stoica-app', 'C'));
    expect(skinLua()).toContain("SKIN:Bang('!SetOption', meter, opcion, escalar(opcion, valor))");
  });
});
