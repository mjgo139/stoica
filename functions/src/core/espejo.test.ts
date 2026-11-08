import { describe, expect, it } from 'vitest';
import { etapaPorCumplimiento, promptEtapa, promptLamina } from './espejo';

describe('espejo', () => {
  it('la lámina pide las tres vistas, respeta el cuerpo real y la ropa elegida', () => {
    const p = promptLamina({ descripcion: '35 años, 1,75 m', remera: 'azul', pantalon: 'negro', conFoto: true });
    expect(p).toContain('front view');
    expect(p).toContain('back view');
    expect(p).toContain('do NOT slim');
    expect(p).toContain('navy blue t-shirt');
    expect(p).toContain('black long casual trousers');
    expect(p).toContain('35 años');
  });
  it('cada etapa edita la misma persona', () => {
    for (const e of ['aflojando', 'mejorando', 'meta'] as const) expect(promptEtapa(e)).toContain('Keep EXACTLY the same person');
    expect(promptEtapa('hoy')).toBe('');
  });
  it('la etapa sale del cumplimiento de 30 días', () => {
    expect(etapaPorCumplimiento(0.2)).toBe('aflojando');
    expect(etapaPorCumplimiento(0.5)).toBe('hoy');
    expect(etapaPorCumplimiento(0.7)).toBe('mejorando');
    expect(etapaPorCumplimiento(0.9)).toBe('meta');
  });
});
