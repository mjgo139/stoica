import { describe, expect, it } from 'vitest';
import { canalDeAviso } from './avisos.js';

describe('canal de Android de cada aviso', () => {
  it('reparte por tipo', () => {
    expect(canalDeAviso('recordatorio-h1')).toBe('recordatorios');
    expect(canalDeAviso('examen')).toBe('recordatorios');
    expect(canalDeAviso('tarea-t1')).toBe('recordatorios');
    expect(canalDeAviso('prueba-u1')).toBe('recordatorios');
    expect(canalDeAviso('cumple-g1-u2')).toBe('grupo');
    expect(canalDeAviso('foto-g1-u2')).toBe('grupo');
    expect(canalDeAviso('reaccion-g1')).toBe('grupo');
    expect(canalDeAviso('plan-g1')).toBe('grupo');
    expect(canalDeAviso('coment-g1-f1')).toBe('comentarios');
  });
});
