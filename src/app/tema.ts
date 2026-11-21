import type { Tema } from '@core/validaciones';
import { aplicarTema as aplicarTemaFamilia, TEMA_PREDETERMINADO } from '../../familia/react';

const CLAVE = 'stoica.tema';
export { TEMA_PREDETERMINADO };

/** Aplica el tema de la familia (Noche romana · Mármol · Sistema) y lo recuerda para la próxima apertura. */
export function aplicarTema(tema: Tema = TEMA_PREDETERMINADO) {
  aplicarTemaFamilia(tema);
  try {
    localStorage.setItem(CLAVE, tema);
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}
