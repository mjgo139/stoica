import { Capacitor } from '@capacitor/core';

/** Dirección principal de StoaHabit. La vieja (stoica-app.web.app) sigue andando pero muestra este aviso. */
export const DIRECCION = 'https://stoahabit.web.app';

/** En la dirección vieja, en el navegador (no en la APK), invita a pasar a la nueva. Sin redirección: no se pierden sesiones. */
export function AvisoMudanza() {
  if (Capacitor.isNativePlatform() || location.hostname !== 'stoica-app.web.app') return null;
  return (
    <a href={DIRECCION + location.pathname + location.search} data-testid="aviso-mudanza" className="ficha aviso-mudanza">
      <span>StoaHabit ahora está en</span>
      <b className="oro">stoahabit.web.app</b>
      <span aria-hidden>›</span>
    </a>
  );
}
