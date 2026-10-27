import { describe, expect, it } from 'vitest';
import { celdasCollage, disenosPara, recorteCubrir } from './collage.js';

describe('collage', () => {
  it('reparte las fotos sin pasarse del cuadrado', () => {
    for (const n of [1, 2, 3, 4]) {
      for (const d of disenosPara(n).map((x) => x.id).concat(n === 1 ? ['lado' as const] : [])) {
        const cs = celdasCollage(n, d, 1080);
        expect(cs).toHaveLength(n);
        for (const c of cs) {
          expect(c.x + c.ancho).toBeLessThanOrEqual(1080);
          expect(c.y + c.alto).toBeLessThanOrEqual(1080);
        }
      }
    }
  });

  it('dos fotos lado a lado o una arriba de otra', () => {
    expect(celdasCollage(2, 'lado', 1080, 8)[1]).toEqual({ x: 544, y: 0, ancho: 536, alto: 1080 });
    expect(celdasCollage(2, 'arriba', 1080, 8)[1]).toEqual({ x: 0, y: 544, ancho: 1080, alto: 536 });
  });

  it('un diseño que no corresponde usa el primero de esa cantidad', () => {
    expect(celdasCollage(4, 'lado', 1080)).toEqual(celdasCollage(4, 'grilla', 1080));
  });

  it('recorta al centro sin deformar', () => {
    expect(recorteCubrir(2000, 1000, { ancho: 500, alto: 500 })).toEqual({ sx: 500, sy: 0, sAncho: 1000, sAlto: 1000 });
  });
});
