/**
 * Widget "Hoy" de Android: la app le pasa el resumen del día (cuántos hábitos, cuáles faltan).
 * Se guarda en el celular: el widget no usa internet ni hace lecturas de Firebase.
 */
import { useEffect, useRef } from 'react';
import { registerPlugin } from '@capacitor/core';
import { cumplido, esDiaActivo } from '@core/habitos';
import { registrosDe, useDatos, useHoy } from '@/app/datos';
import { esNativo } from './nativo';

interface ResumenWidget {
  fecha?: string;
  hecho?: number;
  total?: number;
  pendientes?: string[];
  frase?: string;
  sinSesion?: boolean;
}

const WidgetStoica = registerPlugin<{ actualizar(datos: ResumenWidget): Promise<void> }>('WidgetStoica');

const FRASES = ['Victoria sobre ti mismo.', 'Bien hecho: lo que dependía de vos.', 'Ningún gran logro surge de repente.', 'Un día más de virtud.'];

async function enviar(datos: ResumenWidget) {
  if (!esNativo()) return;
  // Una APK vieja no tiene el complemento: no pasa nada, el widget aparece al actualizar.
  await WidgetStoica.actualizar(datos).catch(() => undefined);
}

/** Al cerrar sesión: el widget deja de mostrar los hábitos de esa cuenta. */
export function limpiarWidget() {
  return enviar({ sinSesion: true });
}

/** Mantiene el widget al día mientras la app está abierta (cada vez que marcás algo). */
export function useWidgetHoy() {
  const hoy = useHoy();
  const habitos = useDatos((s) => s.habitos);
  const registros = useDatos((s) => s.registros);
  const listo = useDatos((s) => s.listo);
  const ultimo = useRef('');
  useEffect(() => {
    if (!esNativo() || !listo) return;
    const deHoy = habitos.filter((h) => !h.archivado && esDiaActivo(h, hoy)).sort((a, b) => a.momento - b.momento || a.orden - b.orden);
    const pendientes = deHoy.filter((h) => !cumplido(h, registrosDe(registros, h.id).get(hoy)));
    const datos: ResumenWidget = {
      fecha: hoy,
      hecho: deHoy.length - pendientes.length,
      total: deHoy.length,
      pendientes: pendientes.slice(0, 4).map((h) => h.nombre),
      frase: FRASES[new Date().getDate() % FRASES.length],
    };
    const clave = JSON.stringify(datos);
    if (clave === ultimo.current) return;
    const t = setTimeout(() => {
      ultimo.current = clave;
      void enviar(datos);
    }, 600);
    return () => clearTimeout(t);
  }, [hoy, habitos, registros, listo]);
}
