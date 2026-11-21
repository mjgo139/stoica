import { Icono as IconoFamilia } from '../../familia/iconos';

/**
 * Nombre de StoaHabit → ícono de la familia estoica (familia/iconos.tsx).
 * Desde la familia 1.5.0 están todos: ya no hay dibujos propios.
 */
const DE_FAMILIA = {
  hoy: 'hoy', habitos: 'check', tareas: 'nota', enfoque: 'reloj', examen: 'luna', mas: 'mas', atras: 'atras', sol: 'sol',
  camara: 'camara', comentario: 'mensaje', salir: 'salir', instalar: 'descargar', compartir: 'enlace', check: 'check',
  grupo: 'clientes', panel: 'barras', repisa: 'trofeo', gota: 'agua', info: 'info',
  planta: 'brote', craneo: 'calavera', llave: 'llave', nube: 'sin-conexion', lira: 'lira', liraMuda: 'lira-apagada', mover: 'mover',
} as const;

export type NombreIcono = keyof typeof DE_FAMILIA;

/** Tamaños de la familia: 16 (con texto), 20 (botones y filas), 22–23 (navegación), 32 y 44 (decorativos) */
const TAMANOS = [16, 20, 22, 23, 32, 44];
const ajustar = (t: number) => TAMANOS.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a));

/** Íconos de StoaHabit: todos salen del juego de la familia. */
export function Icono({ nombre, tam = 20, className = 'uic' }: { nombre: NombreIcono; tam?: number; className?: string }) {
  return <IconoFamilia n={DE_FAMILIA[nombre]} size={ajustar(tam)} className={className === 'uic' ? '' : className} />;
}

/** Logo de Google (del juego de íconos de la familia) */
export function LogoGoogle({ tam = 20 }: { tam?: number }) {
  return <IconoFamilia n="google" size={ajustar(tam)} />;
}
