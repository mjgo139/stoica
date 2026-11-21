import type { Config } from 'tailwindcss';
// Colores, letras y escala de la familia estoica (familia/tailwind-preset.js): bg-sf, text-gold, text-texto…
// @ts-ignore: el preset de la familia es JavaScript sin tipos
import familia from './familia/tailwind-preset.js';

export default {
  presets: [familia],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      borderRadius: { tarjeta: '16px' },
      maxWidth: { contenido: '1480px' },
      screens: { esc: '960px', ancho: '1400px' },
    },
  },
  plugins: [],
} satisfies Config;
