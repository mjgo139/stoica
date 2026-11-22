import { useEffect } from 'react';
import { registerSW } from 'virtual:pwa-register';

/**
 * Actualización automática (v2.4.0, igual que StoaGym): se revisa si hay versión nueva al abrir la app,
 * al volver a ella y cada 30 minutos. La versión nueva se instala y se activa sola, pero la página se recarga
 * SOLO cuando la app queda en segundo plano (nunca con la app en pantalla). La próxima vez que la abras ya está.
 * Si falta un pedazo de la versión vieja (evento 'vite:preloadError'), se recarga para traer la nueva.
 */
export function AvisoActualizacion() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
    let recargando = false;
    const recargar = () => {
      if (!recargando) {
        recargando = true;
        location.reload();
      }
    };
    const habiaVersion = !!navigator.serviceWorker.controller;
    let pendiente = false;
    const alOcultar = () => {
      if (pendiente && document.visibilityState === 'hidden') recargar();
    };
    const alCambiar = () => {
      // La primera instalación también "cambia" de controlador: ahí no hace falta recargar.
      if (!habiaVersion) return;
      pendiente = true;
      if (document.visibilityState === 'hidden') recargar();
    };
    const revisar = () => navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => undefined);
    const alVolver = () => {
      if (document.visibilityState === 'visible') void revisar();
    };
    navigator.serviceWorker.addEventListener('controllerchange', alCambiar);
    document.addEventListener('visibilitychange', alOcultar);
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('vite:preloadError', recargar);
    registerSW({
      immediate: true,
      onRegisteredSW(_url, r) {
        if (r) setInterval(() => void r.update().catch(() => undefined), 30 * 60_000);
      },
    });
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', alCambiar);
      document.removeEventListener('visibilitychange', alOcultar);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('vite:preloadError', recargar);
    };
  }, []);
  return null;
}
