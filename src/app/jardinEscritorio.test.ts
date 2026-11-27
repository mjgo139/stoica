import { describe, expect, it } from 'vitest';
import type { Habito, Registro } from '@core/habitos';
import { sumarDias } from '@core/fechas';
import { leerGuardado } from '@/screens/jardin/estado';
import { ALTO_U, armarJardinEscritorio, imagenesJardin, skinJardinIni, skinJardinLua } from './jardinEscritorio';

const h = (id: string, virtud: string, orden: number): Habito =>
  ({ id, nombre: id, tipo: 'sino', virtud, icono: 'med', momento: 0, dias: [0, 1, 2, 3, 4, 5, 6], meta: 1, unidad: '', variables: [], recordatorio: null, inicio: '2026-09-01', archivado: false, orden, racha: 0, mejorRacha: 0, creado: orden, actualizado: 0, actualizadoPor: 'yo' }) as unknown as Habito;

describe('jardín completo para el escritorio', () => {
  it('arma la lista de dibujo: repisa, braseros con fuego de noche, macetas inclinadas y plantas', () => {
    const hoy = '2026-11-26';
    const cumplidos = new Map<string, Registro>();
    for (let i = 0; i < 40; i++) cumplidos.set(sumarDias(hoy, -i), { hecho: true } as Registro);
    const g = { ...leerGuardado(''), repisa: true, logros: 2 };
    const j = armarJardinEscritorio({ habitos: [h('a', 'coraje', 0), h('b', 'templanza', 1), h('c', 'sabiduria', 2)], registros: new Map([['a', cumplidos]]), hoy, g });
    const [cab, ...capas] = j.split('~');
    expect(cab.split('|')[0]).toBe('1');
    expect(Number(cab.split('|')[1])).toBeGreaterThanOrEqual(3);
    const archivos = capas.map((c) => c.split('|')[1]);
    expect(archivos).toContain('repisa');
    expect(archivos.filter((a) => a === 'brasero')).toHaveLength(4);
    expect(capas.filter((c) => c.startsWith('n|fuego'))).toHaveLength(4);
    expect(archivos.filter((a) => a === 'maceta').length).toBeGreaterThanOrEqual(3);
    expect(archivos.some((a) => /^laurel-\d$/.test(a))).toBe(true);
    // Todo dentro del fondo y con números enteros
    for (const c of capas) {
      const [, , x, y, w] = c.split('|').map(Number);
      expect(Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(w)).toBe(true);
      expect(x).toBeGreaterThan(-500);
      expect(x).toBeLessThan(10500);
      expect(y).toBeLessThan(ALTO_U + 200);
    }
    // Cabe en el documento (reglas: j ≤ 6000)
    expect(j.length).toBeLessThan(6000);
    // Cada imagen que usa la lista viene en el paquete
    const enPaquete = new Set([...imagenesJardin().map((i) => i.nombre), 'medalla']);
    for (const a of archivos) if (a) expect(enPaquete.has(a)).toBe(true);
  });

  it('el skin lee el campo j y el script pone las imágenes', () => {
    const ini = skinJardinIni('https://ejemplo/escritorio/X', 'https://stoahabit.web.app', { fondo: '1,1,1', oro: '2,2,2', marfil: '3,3,3', noche: '4,4,4', amanecer: '5,5,5', atardecer: '6,6,6', sombra: '7,7,7' });
    expect(ini).toContain('"j": \\{');
    expect(ini).toContain('ImageName=#@#jardin\\terraza.jpg');
    expect(ini).toContain('[Img110]');
    expect(skinJardinLua()).toContain("'#@#jardin\\\\' .. archivo .. '.png'");
  });
});
