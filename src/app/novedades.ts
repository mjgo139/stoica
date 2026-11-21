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
    version: '2.0.1',
    fecha: '2026-11-21',
    cambios: ['Panel del día: "Nuevo hábito" pasa a ser una ficha (el botón redondo tapaba la fecha en el celular).'],
  },
  {
    version: '2.0.0',
    fecha: '2026-11-21',
    cambios: [
      'La app pasa a llamarse StoaHabit y se une a la familia estoica (StoaGym, StoaFit, StoaHabit).',
      'Nueva dirección: stoahabit.web.app. La anterior (stoica-app.web.app) sigue andando con un aviso de mudanza; las sesiones no se pierden.',
      'Ícono y pantalla de inicio nuevos: el laurel de la familia con el check de StoaHabit.',
      'Diseño de la familia: colores, letras, barra lateral, pestañas, Panel del día, Tu semana, cabeceras y secciones numeradas.',
      'Tema predeterminado Noche romana; también Mármol y Sistema.',
    ],
  },
  {
    version: '1.3.1',
    fecha: '2026-11-17',
    cambios: [
      'Familia estoica: tarjetas con los mismos colores, bordes dorados, sombra y tamaño que TITANUS.',
      'Panel del día con el mismo borde dorado y brillo que en TITANUS; fichas de fecha iguales.',
      'Fondo y vetas de mármol con el mismo dibujo que TITANUS.',
      'Barra lateral de la PC igual a la de TITANUS en los dos temas (negro, oro y línea dorada bajo la marca).',
    ],
  },
  {
    version: '1.3.0',
    fecha: '2026-11-16',
    cambios: [
      'Familia estoica con TITANUS: la marca STOICA y los títulos de página en letra Cinzel, con brillo de bronce.',
      'Botón principal con degradé de bronce, como en TITANUS.',
      'Fondo con vetas finas de mármol y un leve brillo dorado.',
      'Modo oscuro "noche romana": más negro y con oro más vivo; barra lateral negra en la PC.',
      'Panel del día: rango y nivel (Aprendiz, Discípulo, Practicante, Filósofo, Sabio, Maestro, Estoico), que suben con las medallas del jardín.',
    ],
  },
  {
    version: '1.2.1',
    fecha: '2026-11-14',
    cambios: ['Marco Aurelio vuelve a caminar como antes (la caminata nueva de 4 pasos se veía peor).'],
  },
  {
    version: '1.2.0',
    fecha: '2026-11-14',
    cambios: [
      'Jardín: plantas nuevas (olivo, laurel, lavanda, granado y lirio) con recorte limpio, sin bordes blancos en la noche.',
      'Jardín: los 11 adornos de la repisa con recorte limpio.',
      'Jardín: fuego nuevo de los braseros.',
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
