import { describe, expect, it } from 'vitest';
import { rangoDe } from './perfil';

describe('rango y nivel', () => {
  it('sube con las medallas', () => {
    expect(rangoDe(0)).toEqual({ nombre: 'Aprendiz', nivel: 1, siguiente: { nombre: 'Discípulo', faltan: 1 } });
    expect(rangoDe(5).nombre).toBe('Practicante');
    expect(rangoDe(6).nombre).toBe('Filósofo');
    expect(rangoDe(171)).toEqual({ nombre: 'Estoico', nivel: 172, siguiente: null });
  });
});
