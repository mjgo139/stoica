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
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: d.tag || 'stoica',
      data: { url: d.url || '/' },
    }),
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
