/**
 * La app dentro de la APK de Android (Capacitor). En el navegador nada de esto se usa:
 * todo pregunta primero `esNativo()` y los módulos nativos se cargan solo dentro de la APK.
 */
import { Capacitor } from '@capacitor/core';

export const esNativo = (): boolean => Capacitor.isNativePlatform();

/** Canales de aviso de Android: cada uno con su prioridad. Alta = ventanita arriba y sonido. */
export const CANALES = [
  { id: 'recordatorios', name: 'Recordatorios', description: 'Hábitos, tareas y examen nocturno' },
  { id: 'grupo', name: 'Mis grupos', description: 'Cuando un compañero cumple, sube una foto o reacciona' },
  { id: 'comentarios', name: 'Comentarios', description: 'Comentarios en tus fotos' },
] as const;

let preparado = false;

/**
 * Al abrir la APK: crea los canales, escucha los toques en los avisos (abren la pantalla del aviso),
 * muestra los avisos que llegan con la app abierta y maneja el botón atrás de Android.
 */
export async function prepararNativo(navegar: (url: string) => void, avisar: (texto: string) => void) {
  if (!esNativo() || preparado) return;
  preparado = true;
  const [{ PushNotifications }, { App }] = await Promise.all([import('@capacitor/push-notifications'), import('@capacitor/app')]);
  for (const c of CANALES) {
    await PushNotifications.createChannel({ ...c, importance: 5, visibility: 1, sound: 'default', vibration: true, lights: true }).catch(() => undefined);
  }
  await PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
    const url = String(a.notification.data?.url ?? '/');
    if (url.startsWith('/')) navegar(url);
  });
  // Con la app abierta Android no muestra el aviso: se ve como un cartel dentro de la app.
  await PushNotifications.addListener('pushNotificationReceived', (n) => {
    const t = [n.title, n.body].filter(Boolean).join(': ');
    if (t) avisar(t);
  });
  await App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) history.back();
    else App.minimizeApp();
  });
}

/** Pide permiso y registra este celular para avisos nativos. Devuelve el token o un mensaje de error. */
export async function registrarAvisosNativos(): Promise<{ token: string } | { error: string }> {
  const { PushNotifications } = await import('@capacitor/push-notifications');
  let permiso = await PushNotifications.checkPermissions();
  if (permiso.receive === 'prompt' || permiso.receive === 'prompt-with-rationale') permiso = await PushNotifications.requestPermissions();
  if (permiso.receive !== 'granted') return { error: 'No diste permiso para avisos. Activalo en Ajustes del celular › Apps › Stoica › Notificaciones.' };
  return new Promise((resolver) => {
    let listo = false;
    const fin = (r: { token: string } | { error: string }) => {
      if (listo) return;
      listo = true;
      resolver(r);
    };
    void PushNotifications.addListener('registration', (t) => fin({ token: t.value }));
    void PushNotifications.addListener('registrationError', () => fin({ error: 'No se pudo registrar este celular para avisos. Revisá la conexión y probá de nuevo.' }));
    void PushNotifications.register();
    setTimeout(() => fin({ error: 'El celular tardó demasiado en registrarse para avisos. Probá de nuevo.' }), 15000);
  });
}

export async function desregistrarAvisosNativos() {
  const { PushNotifications } = await import('@capacitor/push-notifications');
  await PushNotifications.unregister().catch(() => undefined);
}

/** ¿El permiso de avisos de la APK está concedido? (para mostrar el interruptor bien) */
export async function permisoNativo(): Promise<'concedido' | 'negado' | 'preguntar'> {
  const { PushNotifications } = await import('@capacitor/push-notifications');
  const p = await PushNotifications.checkPermissions();
  return p.receive === 'granted' ? 'concedido' : p.receive === 'denied' ? 'negado' : 'preguntar';
}

/** Número de compilación de esta APK (para saber si hay una más nueva). */
export async function versionApk(): Promise<{ codigo: number; nombre: string } | null> {
  if (!esNativo()) return null;
  const { App } = await import('@capacitor/app');
  const i = await App.getInfo();
  return { codigo: Number(i.build) || 0, nombre: i.version };
}

/** Abre un enlace fuera de la app (por ejemplo, para descargar la APK nueva). */
export async function abrirAfuera(url: string) {
  if (!esNativo()) return void window.open(url, '_blank', 'noopener');
  const { AppLauncher } = await import('@capacitor/app-launcher');
  await AppLauncher.openUrl({ url });
}
