import { describe, expect, it } from 'vitest';
import { traducirError } from './errores';

describe('mensajes de error', () => {
  it('muestra el texto en español que manda el servidor', () => {
    expect(traducirError({ code: 'functions/resource-exhausted', message: 'Ya te mandamos uno. Podés probar otra vez en 40 segundos.' }).message).toContain('40 segundos');
  });
  it('no muestra errores internos ni códigos crudos', () => {
    expect(traducirError({ code: 'functions/internal', message: 'INTERNAL' }).message).toBe('Algo salió mal. Probá de nuevo en un momento.');
    expect(traducirError({ code: 'functions/unavailable', message: 'unavailable' }).message).toContain('No hay conexión');
  });
});
