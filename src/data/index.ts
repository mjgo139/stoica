import type { Driver } from './tipos';

let actual: Driver | null = null;

export const esModoPrueba = (): boolean => __MODO_PRUEBA__ || import.meta.env.VITE_DRIVER === 'memoria';

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
