import type { Driver } from './tipos';

let actual: Driver | null = null;

const CLAVE_PRUEBA = 'stoica.prueba';

/**
 * Modo prueba: solo en el armado de prueba (pruebas automáticas y `npm run prueba`).
 * En la web publicada ya no existe `?prueba=1` (decisión del dueño, v2.6.0); se borra la marca vieja.
 */
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem(CLAVE_PRUEBA);
  } catch {
    /* nada */
  }
}
const PRUEBA = __MODO_PRUEBA__ || import.meta.env.VITE_DRIVER === 'memoria';

export const esModoPrueba = (): boolean => PRUEBA;

/** Carga el driver una sola vez. Firebase se importa aparte para que el modo prueba no lo descargue. */
export async function obtenerDriver(): Promise<Driver> {
  if (actual) return actual;
  if (esModoPrueba()) {
    const { crearDriverMemoria } = await import('./memoria');
    actual = crearDriverMemoria();
  } else {
    const { crearDriverFirebase } = await import('./firebase');
    actual = crearDriverFirebase();
  }
  return actual;
}

export function driverListo(): Driver {
  if (!actual) throw new Error('El driver todavía no se cargó.');
  return actual;
}
