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
    version: '2.9.0',
    fecha: '2026-11-25',
    cambios: [
      'Widget para Windows: en Perfil → "Widget para Windows" se baja StoaHabit.rmskin para Rainmeter (gratis). En el escritorio quedan tus hábitos de hoy, si los cumpliste y tu racha, en negro y oro.',
      'Se actualiza cada 15 minutos con lo que marcás en la app; tocar un hábito lo abre en StoaHabit. "Cambiar el enlace" o "Desactivar" lo cortan al instante.',
    ],
  },
  {
    version: '2.8.0',
    fecha: '2026-11-24',
    cambios: [
      'Widget nuevo del Jardín de 2×2 (dos columnas): hasta 4 plantas y si alguna te necesita hoy. Hay que reinstalar la APK para verlo.',
      'Plantas al doble de nitidez en el jardín, en su ficha y en los widgets; la planta de la celebración queda centrada.',
      'Fotos del grupo con el sello de StoaHabit: emblema, hábito, racha, fecha y la dirección de la app.',
      'Fotos de hoy del grupo como historias: pantalla completa, pasan solas, tocá para avanzar y mantené para pausar.',
      'Marcar días pasados: tocá un día del calendario del hábito. Viene prendido y se puede apagar por hábito.',
      'Menos textos de explicación en Jardín, Comunidad, Hábitos, Tareas, Enfoque y Memento.',
    ],
  },
  {
    version: '2.7.0',
    fecha: '2026-11-22',
    cambios: [
      'En la portada, "Descargar para Android" baja la app (solo en el navegador; no aparece en la app instalada ni en iPhone).',
    ],
  },
  {
    version: '2.6.0',
    fecha: '2026-11-22',
    cambios: [
      'La web publicada ya no tiene modo prueba (?prueba=1): solo existe en las pruebas automáticas.',
    ],
  },
  {
    version: '2.5.0',
    fecha: '2026-11-22',
    cambios: [
      'Iniciar sesión, crear cuenta y recuperar contraseña con la pantalla de la familia estoica, igual en todas las apps: pantalla completa, ojito para ver la contraseña, Google y "Volver" a la portada.',
      'El invitado guarda su cuenta con el mismo formulario (ahora también puede poner su nombre).',
      'Familia estoica 1.8.0.',
    ],
  },
  {
    version: '2.4.0',
    fecha: '2026-11-22',
    cambios: [
      'Pantalla de acceso nueva, igual en las apps de la familia: el filósofo sentado, "Iniciar sesión", "Crear cuenta" y "Continuar como invitado". Google está dentro del formulario.',
      'Arranque más rápido: tu perfil, tus hábitos y tus días se muestran al instante con lo guardado en el teléfono, y el servidor completa por detrás.',
      'Actualizaciones sin cortes: la versión nueva se instala sola y la app se recarga recién cuando la dejás en segundo plano.',
      'Familia estoica 1.7.1.',
    ],
  },
  {
    version: '2.3.1',
    fecha: '2026-11-21',
    cambios: ['Panel del día más limpio: se quitó "Prácticas de hoy" de la derecha (el avance del día sigue más abajo).'],
  },
  {
    version: '2.3.0',
    fecha: '2026-11-21',
    cambios: [
      'Foto de perfil: en Perfil → "Cambiar foto" (se elige de la galería y se achica a 256×256) y "Quitar foto". Se ve en Perfil, en el Panel del día y en la barra lateral de la PC.',
      'Tarjeta de Perfil de la familia estoica, con botones de borde.',
      'Barra lateral: debajo de tu nombre, tu correo (o "Modo invitado"), como en StoaGym y StoaFit.',
      'Familia estoica 1.6.0.',
    ],
  },
  {
    version: '2.2.0',
    fecha: '2026-11-21',
    cambios: [
      'Panel del día igual en las 3 apps de la familia: debajo del saludo va la frase estoica del día (sin rango ni nivel). A la derecha, tus prácticas de hoy.',
      'Íconos nuevos de la familia: brote para el Jardín, calavera para Memento, y llave, sin conexión, lira del sonido y mover.',
      'Familia estoica 1.5.0.',
    ],
  },
  {
    version: '2.1.0',
    fecha: '2026-11-21',
    cambios: [
      'Modo prueba en la web publicada: stoahabit.web.app/?prueba=1 entra con la cuenta de ejemplo y datos inventados (sin Firebase); ?prueba=0 o "Salir del modo prueba" vuelve a la app real.',
      '"Continuar como invitado": entrar sin correo; desde Perfil → "Guardar mi cuenta" se agrega correo y contraseña sin perder nada.',
      'Las tarjetas vuelven a verse sólidas: las vetas del fondo quedaban encima del contenido (el contenedor de la app ahora es #root, como pide la familia).',
      'Borrar y quitar usan el rojo ladrillo de la familia.',
    ],
  },
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
