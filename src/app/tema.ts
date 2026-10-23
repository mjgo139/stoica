import type { Tema } from '@core/validaciones';

const CLAVE = 'stoica.tema';

/** Aplica el tema en <html data-theme>. "sistema" deja que mande el celular o la PC. */
export function aplicarTema(tema: Tema) {
  const html = document.documentElement;
  if (tema === 'claro') html.setAttribute('data-theme', 'light');
  else if (tema === 'oscuro') html.setAttribute('data-theme', 'dark');
  else html.removeAttribute('data-theme');
  try {
    localStorage.setItem(CLAVE, tema);
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}
