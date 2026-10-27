const TRAZOS = {
  hoy: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  habitos: '<path d="M4 21h16M5 4h14M6 4v17M10 4v17M14 4v17M18 4v17M3 4l9-2 9 2"/>',
  tareas: '<path d="M7 3h10v18H7zM10 8h4M10 12h4M10 16h2M5 5v14M19 5v14"/>',
  enfoque: '<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>',
  craneo: '<path d="M12 3a8 8 0 0 0-8 8c0 2.6 1.2 4.4 3 5.5V20a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3.5c1.8-1.1 3-2.9 3-5.5a8 8 0 0 0-8-8z"/><circle cx="8.8" cy="11.5" r="1.9"/><circle cx="15.2" cy="11.5" r="1.9"/><path d="M12 14.2l-1 2h2zM10 21v-2.4M14 21v-2.4"/>',
  examen: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  atras: '<path d="M15 6l-6 6 6 6"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  llave: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3M16 7l3 3M14 9l2 2"/>',
  camara: '<path d="M4 8h3l1.6-2.4a1 1 0 0 1 .8-.4h5.2a1 1 0 0 1 .8.4L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.4"/>',
  salir: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l4-4-4-4M14 12H4"/>',
  instalar: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  compartir: '<path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/>',
  nube: '<path d="M7 18a4 4 0 0 1-.6-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9zM4 4l16 16"/>',
  check: '<path d="M5 12l4 4 10-10"/>',
  grupo: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 14.5c3 0 6 2 6 5.5"/>',
  panel: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
} as const;

export type NombreIcono = keyof typeof TRAZOS;

export function Icono({ nombre, tam = 20, className = 'uic' }: { nombre: NombreIcono; tam?: number; className?: string }) {
  return <svg className={className} width={tam} height={tam} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: TRAZOS[nombre] }} />;
}

export function LogoGoogle({ tam = 18 }: { tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
