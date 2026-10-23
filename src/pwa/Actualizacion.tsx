import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Aviso "Hay una versión nueva · Actualizar".
 * El service worker nuevo espera hasta que tocás Actualizar; ahí toma el control y recarga.
 * Además se revisa si hay versión nueva cada 30 minutos y al volver a la app.
 */
export function AvisoActualizacion() {
  const {
    needRefresh: [hayNueva, setHayNueva],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const revisar = () => reg.update().catch(() => undefined);
      setInterval(revisar, 30 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') revisar();
      });
    },
  });

  if (!hayNueva) return null;
  return (
    <div className="aviso" role="status">
      <span>Hay una versión nueva</span>
      <button type="button" onClick={() => updateServiceWorker(true)}>
        Actualizar
      </button>
      <button type="button" aria-label="Más tarde" onClick={() => setHayNueva(false)} style={{ textDecoration: 'none' }}>
        ×
      </button>
    </div>
  );
}
