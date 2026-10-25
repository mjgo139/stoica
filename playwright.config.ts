import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

// En la nube de Claude hay un Chromium ya instalado; en GitHub se usa el que baja Playwright.
const chromiumLocal = '/opt/pw-browsers/chromium';
const launchOptions = existsSync(chromiumLocal) ? { executablePath: chromiumLocal } : {};

/** Recorridos en modo prueba (sin Firebase). Las capturas quedan en e2e/capturas. */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    locale: 'es-PY',
    timezoneId: 'America/Asuncion',
    serviceWorkers: 'block',
    launchOptions,
    reducedMotion: 'reduce',
    // Permiso de avisos concedido (el modo prueba simula el registro del dispositivo).
    permissions: ['notifications'],
  },
  webServer: {
    command: 'npm run build:prueba && npx vite preview --mode prueba --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'celular', use: { ...devices['Pixel 7'] } },
    { name: 'escritorio', use: { viewport: { width: 1440, height: 900 } } },
  ],
});
