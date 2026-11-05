import type { CapacitorConfig } from '@capacitor/cli';

/**
 * APK de Android (para testers). La app abre la versión publicada, así cada publicación llega sola
 * sin reinstalar; solo los cambios nativos (avisos, widget) necesitan una APK nueva.
 */
const config: CapacitorConfig = {
  appId: 'app.stoica',
  appName: 'Stoica',
  webDir: 'dist',
  server: {
    url: 'https://stoica-app.web.app',
    androidScheme: 'https',
    allowNavigation: ['stoica-app.web.app', 'stoica-app.firebaseapp.com'],
  },
  android: {
    backgroundColor: '#ece6db',
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
