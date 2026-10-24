/// <reference lib="webworker" />
/**
 * Service worker de Stoica.
 * - Precarga la app y borra cachés de versiones anteriores (nunca deja versiones viejas).
 * - La versión nueva espera hasta que la persona toca "Actualizar".
 * - Muestra las notificaciones push (recordatorios, examen, reacciones).
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/__\//] }));
registerRoute(({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com', new StaleWhileRevalidate({ cacheName: 'fuentes' }));
clientsClaim();

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

const esAndroid = /Android/i.test(self.navigator.userAgent);

interface Aviso {
  titulo?: string;
  cuerpo?: string;
  url?: string;
  tag?: string;
}

self.addEventListener('push', (e) => {
  let d: Aviso = {};
  try {
    const p = e.data?.json() ?? {};
    d = p.data ?? p.notification ?? p;
  } catch {
    d = { cuerpo: e.data?.text() };
  }
  e.waitUntil(
    self.registration.showNotification(d.titulo || 'Stoica', {
      body: d.cuerpo || '',
      // En Android el logo de la app ya aparece a la izquierda: a la derecha va solo el laurel con el rombo
      // (sin imagen, Chrome dibuja una letra en un círculo gris).
      icon: esAndroid ? '/icons/aviso-192.png' : '/icons/icon-192.png',
      // Ícono chico de la barra de estado: tiene que ser blanco sobre transparente (si no, se ve un cuadrado).
      badge: '/icons/badge-96.png',
      silent: false,
      tag: d.tag || 'stoica',
      // Volver a sonar y vibrar aunque reemplace un aviso anterior con la misma etiqueta.
      renotify: true,
      vibrate: [120, 60, 120],
      data: { url: d.url || '/' },
    } as NotificationOptions),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const v of ventanas) {
        if ('focus' in v) {
          await v.focus();
          if ('navigate' in v) await (v as WindowClient).navigate(url).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
