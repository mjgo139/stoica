import { describe, expect, it } from 'vitest';
import { habitoParaDesafio } from './habitos.js';

describe('hábito sugerido para un desafío', () => {
  it('reconoce los temas de las sugerencias', () => {
    expect(habitoParaDesafio('21 días meditando', 'templanza').nombre).toBe('Meditar');
    expect(habitoParaDesafio('30 días sin azúcar', 'templanza').nombre).toBe('Sin azúcar');
    expect(habitoParaDesafio('Una semana de ducha fría', 'templanza').nombre).toBe('Ducha fría');
    expect(habitoParaDesafio('14 días leyendo', 'templanza')).toMatchObject({ nombre: 'Leer', tipo: 'cantidad', meta: 20 });
  });
  it('si no lo reconoce, arma un Sí/No sin la duración y con la virtud del desafío', () => {
    expect(habitoParaDesafio('10 días de gratitud', 'justicia')).toMatchObject({ nombre: 'Gratitud', tipo: 'sino', virtud: 'justicia' });
    expect(habitoParaDesafio('Levantarme temprano', 'coraje')).toMatchObject({ nombre: 'Levantarme temprano', virtud: 'coraje' });
  });
});
