import { useMemo } from 'react';
import { rangoDe } from '@core/perfil';
import { calcularJardin, leerGuardado, medallasGanadas } from '@/screens/jardin/estado';
import { useSesion } from './sesion';
import { useDatos, useHabitosActivos, useHoy } from './datos';

/** Rango y nivel de la persona (suben con las medallas del jardín). Se usa en Inicio y en la barra lateral. */
export function useRango() {
  const habitos = useHabitosActivos();
  const registros = useDatos((s) => s.registros);
  const hoy = useHoy();
  const uid = useSesion((s) => s.usuario?.uid ?? '');
  return useMemo(() => {
    try {
      return rangoDe(medallasGanadas(calcularJardin({ habitos, registros, hoy, g: leerGuardado(uid), prueba: null }).plantas));
    } catch {
      return rangoDe(0);
    }
  }, [habitos, registros, hoy, uid]);
}
