import type { CapacitorConfig } from '@capacitor/cli';

/**
 * APK de Android (para testers). La app abre la versión publicada, así cada publicación llega sola
 * sin reinstalar; solo los cambios nativos (avisos, widget) necesitan una APK nueva.
 */
const config: CapacitorConfig = {
  appId: 'app.stoica',
  appName: 'StoaHabit',
  webDir: 'dist',
  server: {
    url: 'https://stoahabit.web.app',
    androidScheme: 'https',
    // La dirección vieja sigue andando (mismo proyecto): se permite para no abrir el navegador
    allowNavigation: ['stoahabit.web.app', 'stoica-app.web.app', 'stoica-app.firebaseapp.com'],
  },
  android: {
    backgroundColor: '#14120E',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    // Entrar con Google: Android elige la cuenta (nativo) y la sesión la abre la misma app web con ese permiso.
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
};

export default config;
