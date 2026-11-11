import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** ¿La persona está escribiendo algo? (no se recarga en ese momento) */
const escribiendo = () => {
  const a = document.activeElement;
  return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || (a as HTMLElement).isContentEditable);
};

/**
 * Actualización automática: se revisa si hay versión nueva al abrir la app, al volver a ella y cada
 * 30 minutos. Si hay una, se instala sola al abrir o al volver a la app (nunca mientras escribís);
 * si te encuentra en medio de algo, aparece el aviso "Hay una versión nueva · Actualizar".
 */
export function AvisoActualizacion() {
  const inicio = useRef(Date.now());
  const volvio = useRef(0);
  const {
    needRefresh: [hayNueva, setHayNueva],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const revisar = () => reg.update().catch(() => undefined);
      revisar();
      setInterval(revisar, 30 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          volvio.current = Date.now();
          revisar();
        }
      });
    },
  });

  // Recién abierta o recién vuelta a la app (y sin estar escribiendo): se actualiza sola.
  useEffect(() => {
    if (!hayNueva) return;
    const ahora = Date.now();
    const recien = ahora - inicio.current < 20_000 || ahora - volvio.current < 20_000;
    if (recien && !escribiendo()) void updateServiceWorker(true);
  }, [hayNueva, updateServiceWorker]);

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
