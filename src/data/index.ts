import type { Driver } from './tipos';

let actual: Driver | null = null;

const CLAVE_PRUEBA = 'stoica.prueba';

/**
 * Modo prueba por enlace (igual que StoaGym): `?prueba=1` lo prende en este navegador y `?prueba=0` lo apaga.
 * Usa la cuenta de ejemplo con datos inventados y no toca Firebase.
 */
function pruebaPorEnlace(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const p = new URLSearchParams(location.search).get('prueba');
    if (p === '1') localStorage.setItem(CLAVE_PRUEBA, '1');
    if (p === '0') localStorage.removeItem(CLAVE_PRUEBA);
    return localStorage.getItem(CLAVE_PRUEBA) === '1';
  } catch {
    return false;
  }
}
const PRUEBA_ARMADA = __MODO_PRUEBA__ || import.meta.env.VITE_DRIVER === 'memoria';
const PRUEBA = PRUEBA_ARMADA || pruebaPorEnlace();

export const esModoPrueba = (): boolean => PRUEBA;
/** Prendido con ?prueba=1 en la versión publicada (se puede salir con ?prueba=0) */
export const esPruebaPorEnlace = (): boolean => PRUEBA && !PRUEBA_ARMADA;
/** Sale del modo prueba por enlace y vuelve a la app real */
export function salirDelModoPrueba() {
  try {
    localStorage.removeItem(CLAVE_PRUEBA);
  } catch {
    /* nada */
  }
  location.href = '/?prueba=0';
}

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
