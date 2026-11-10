import { describe, expect, it } from 'vitest';
import { caminoHasta, celdas, celdaDePunto, libresEnOrden, ubicar, TERRENOS, type Forma } from './terreno';

const FORMAS: Forma[] = ['vertical', 'horizontal'];

describe('terreno del jardín', () => {
  it('hay lugar para al menos 15 macetas en cada forma', () => {
    for (const f of FORMAS) expect(libresEnOrden(f).length).toBeGreaterThanOrEqual(15);
  });

  it('cada lugar libre toca un pasillo y el filósofo llega a todos sin pisar nada', () => {
    for (const f of FORMAS) {
      const todas = celdas(f);
      for (const c of todas.filter((x) => x.tipo === 'libre')) {
        const r = caminoHasta(f, c.i);
        expect(r, `${f} celda ${c.fila},${c.col}`).not.toBeNull();
        // Cada tramo es recto y todos sus puntos caen en pasillos
        const pts = r!.puntos.slice(1);
        for (let k = 1; k < pts.length; k++) {
          const [ax, ay] = pts[k - 1];
          const [bx, by] = pts[k];
          expect(ax === bx || ay === by).toBe(true);
          for (let t = 0; t <= 1; t += 0.05) {
            const celda = celdaDePunto(f, ax + (bx - ax) * t, ay + (by - ay) * t);
            expect(celda?.tipo, `${f} hacia ${c.fila},${c.col}`).toBe('pasillo');
          }
        }
      }
    }
  });

  it('los pasillos nunca se ofrecen para poner cosas', () => {
    for (const f of FORMAS) {
      const d = TERRENOS[f];
      for (const c of libresEnOrden(f)) {
        expect(d.pasilloFilas.includes(c.fila)).toBe(false);
        expect(c.col).not.toBe(d.pasilloCol);
      }
    }
  });

  it('respeta lo acomodado, el brasero va a su lugar y el resto se llena solo', () => {
    const libres = libresEnOrden('vertical');
    const elegida = libres[5].i;
    const { lugar, sinLugar } = ubicar('vertical', ['a', 'b', 'c'], ['brasero', 'farol'], { b: elegida }, { farol: -1 });
    expect(lugar.get('b')).toBe(elegida);
    expect(lugar.has('adorno:brasero')).toBe(true);
    expect(lugar.has('adorno:farol')).toBe(false);
    expect(new Set(lugar.values()).size).toBe(lugar.size);
    expect(sinLugar).toEqual([]);
  });

  it('dos cosas en el mismo lugar: la segunda se mueve sola; si no hay lugar, queda afuera', () => {
    const una = libresEnOrden('horizontal')[0].i;
    const r = ubicar('horizontal', ['a', 'b'], [], { a: una, b: una }, {});
    expect(r.lugar.get('a')).toBe(una);
    expect(r.lugar.get('b')).not.toBe(una);
    const muchas = Array.from({ length: 40 }, (_, i) => `p${i}`);
    const lleno = ubicar('horizontal', muchas, ['brasero'], {}, {});
    expect(lleno.sinLugar.length).toBe(40 + 1 - libresEnOrden('horizontal').length);
  });
});
