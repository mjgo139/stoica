/**
 * Versiones de Stoica y qué trae cada una (lo ve solo el admin, en Perfil → Ajustes).
 * La primera de la lista es la actual y tiene que coincidir con "version" de package.json
 * (hay una prueba que lo revisa). Al publicar algo nuevo: subir la versión y agregar arriba.
 */
export interface Novedad {
  version: string;
  fecha: string;
  cambios: string[];
}

export const NOVEDADES: Novedad[] = [
  {
    version: '1.2.0',
    fecha: '2026-11-14',
    cambios: [
      'Jardín: plantas nuevas (olivo, laurel, lavanda, granado y lirio) con recorte limpio, sin bordes blancos en la noche.',
      'Jardín: los 11 adornos de la repisa con recorte limpio.',
      'Jardín: fuego nuevo de los braseros.',
      'Marco Aurelio camina con 4 pasos por dirección (más suave).',
      'Widget de Android: las mismas plantas nuevas.',
    ],
  },
  {
    version: '1.1.1',
    fecha: '2026-11-10',
    cambios: [
      'Jardín: maceta nueva de frente (mármol crema con guarda griega), sin recortes, suavizada para que combine con la terraza.',
      'Widget de Android: la misma maceta nueva.',
    ],
  },
  {
    version: '1.1.0',
    fecha: '2026-11-10',
    cambios: [
      'Jardín: las plantas siguen dando retoños hasta llenar los 16 lugares (antes paraban en 3 por planta y quedaban 4 vacíos).',
      'Jardín: la ventana de la repisa y las demás ventanas quedan centradas en la PC (sin contar el menú de la izquierda).',
      'Ajustes: número de versión y novedades, visibles solo para el admin.',
      'Jardín: macetas derechas que siguen las líneas del piso, braseros de a pares en la misma línea y repisa centrada.',
      'App: se actualiza sola al abrirla o al volver a ella.',
    ],
  },
  {
    version: '1.0.0',
    fecha: '2026-11-09',
    cambios: ['Jardín para todos, jardín de los miembros del grupo, repisa de logros, braseros, Marco Aurelio y Epicteto.'],
  },
];
