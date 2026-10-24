import { useEffect, useState } from 'react';

interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let pendiente: EventoInstalar | null = null;
const oyentes = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pendiente = e as EventoInstalar;
    oyentes.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    pendiente = null;
    oyentes.forEach((f) => f());
  });
}

export function esInstalada(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function esAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

export function esIOS(): boolean {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

/** Botón "Instalar la app": en Android/PC usa el aviso del navegador; en iPhone muestra los pasos. */
export function useInstalar() {
  const [, refrescar] = useState(0);
  useEffect(() => {
    const f = () => refrescar((n) => n + 1);
    oyentes.add(f);
    return () => {
      oyentes.delete(f);
    };
  }, []);
  const instalada = esInstalada();
  return {
    instalada,
    puedeInstalar: !instalada && (pendiente !== null || esIOS()),
    necesitaPasos: !instalada && pendiente === null && esIOS(),
    async instalar(): Promise<'aceptada' | 'rechazada' | 'pasos'> {
      if (!pendiente) return 'pasos';
      await pendiente.prompt();
      const r = await pendiente.userChoice;
      pendiente = null;
      return r.outcome === 'accepted' ? 'aceptada' : 'rechazada';
    },
  };
}
