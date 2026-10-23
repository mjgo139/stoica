import type { Config } from 'tailwindcss';

const v = (n: string) => `var(--${n})`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        fondo: v('bg'),
        sup: v('sf'),
        linea: v('ln'),
        linea2: v('ln2'),
        linea3: v('ln3'),
        tinta: v('tx'),
        tinta2: v('tx2'),
        apagado: v('mu'),
        apagado2: v('mu2'),
        bronce: v('gold'),
        broncefondo: v('goldbg'),
        oliva: v('ok'),
        olivafondo: v('okbg'),
        terracota: v('miss'),
        terracotafondo: v('missbg'),
      },
      fontFamily: {
        display: ["'Playfair Display'", 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: { tarjeta: '16px' },
      maxWidth: { contenido: '1480px' },
      screens: { esc: '960px', ancho: '1400px' },
    },
  },
  plugins: [],
} satisfies Config;
