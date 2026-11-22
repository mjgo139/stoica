# StoaHabit · instrucciones para Claude

App de hábitos con enfoque estoico. Es parte de la **familia estoica** del dueño: StoaGym (entrenamiento, repo `mjgo139/titanus`), StoaFit (nutrición), **StoaHabit** (hábitos, este repo) y una futura de mente.

## Estado actual

| Dato | Valor |
|---|---|
| Nombre | **StoaHabit** (antes Stoica, desde v2.0.0). El repositorio (`mjgo139/stoica`), el proyecto de Firebase (`stoica-app`) y el `appId` de Android (`app.stoica`) **no se cambian**. Tampoco las claves internas (`stoica.tema`, `ErrorStoica`, `WidgetStoica`…). |
| Web | **https://stoahabit.web.app** (principal, target `principal`) y https://stoica-app.web.app (target `anterior`: misma app + `AvisoMudanza`, **sin redirección** para no perder sesiones ni romper APKs viejas). `firebase.json` tiene `hosting` como lista de dos targets y `.firebaserc` los mapea; `firebase deploy --only hosting` publica en las dos. Los enlaces que se comparten usan siempre `DIRECCION` (`src/ui/AvisoMudanza.tsx`). |
| APK | La arma GitHub Actions y queda en la Release `apk-ultima`; la web la sirve en `/descargas/stoica.apk`. Carga `https://stoahabit.web.app` (`server.url` en `capacitor.config.ts`) con `allowNavigation` para las dos direcciones: se actualiza sola. Reinstalar solo si cambia algo nativo (ícono, plugins, permisos, widgets). |
| Widgets Android | `android/.../app/stoica/*Widget.java`. `Nube.java` manda `Referer: https://stoica-app.web.app/` (la clave de la API puede estar restringida a esa dirección). |
| Ícono | Figura `FIGURAS.check` de la familia. Se generan con `npm run iconos` (`scripts/iconos.mjs`: `svgIcono` + `svgEmblemaSolo`): web (`public/icons`), Android (común, redondo y adaptable) y pantalla de inicio oscura. Dentro de la app: `<EmblemaStoaHabit/>` / `<Marca/>` (`src/ui/Marca.tsx`) = `<Emblema figura={FIGURAS.check}/>` + "StoaHabit" en Cinzel. |

## Cómo trabajar con el dueño

- No programa. Español con voseo paraguayo, claro y directo; cada término técnico explicado en una frase. Primero el resultado, después el detalle; tablas al comparar.
- Pasos para él: "📍 Estás en: …" y "## Paso N" con sub-pasos numerados y enlaces.
- Siempre el costo aproximado en Firebase según cantidad de usuarios.
- **Nunca** pedir ni escribir contraseñas, claves, tokens; no tocar IAM; datos personales reales nunca a GitHub.
- Commits en español, **sin** líneas `Co-Authored-By` ni `Claude-Session`.
- Al cambiar algo visible: subir `version` en `package.json` y agregar arriba en `src/app/novedades.ts` (hay prueba que lo exige). El admin lo ve en Perfil → Ajustes.
- Publicar solo con todas las pruebas en verde; después seguir el run "Publicar" y avisar.

## Comandos

| Para qué | Comando |
|---|---|
| Modo prueba (sin Firebase) | `npm run prueba` (cuenta de ejemplo en la pantalla de acceso) |
| Pruebas de lógica + control de la familia | `npm test` (`node familia/revisar.mjs && vitest run`) |
| Pruebas de pantallas + capturas | `npm run e2e` (capturas en `e2e/capturas`) |
| Pruebas de reglas | `npm run test:reglas` |
| Íconos y pantalla de inicio | `npm run iconos` (en la nube de Claude: `PW_CHROME=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`) |

## Diseño: familia estoica (obligatorio)
- El diseño sale de la carpeta `familia/`, copia exacta del repo mjgo139/familia-estoica (modelo: StoaGym). **No editar `familia/`.**
- **Prohibido escribir colores a mano** (#…, rgb(), hsl()). Solo `var(--…)` de `familia/tokens.css` o las clases de Tailwind del preset (`bg-sf`, `text-gold`…). Si falta un color, se agrega en familia-estoica y se vuelve a copiar la carpeta.
- **Escala única de letras e íconos** (`familia/tokens.css`, `familia/iconos.tsx`): no inventar otros tamaños.
- Piezas obligatorias: `BarraLateral`, `Pestanas`, `PanelDia` (primer bloque de Inicio), `TuSemana`, `ElegirTema` (arranca en Noche romana) y `AvisoPrueba`. Cabecera: etiqueta corta + título = nombre de la pestaña; secciones numeradas.
- Usar las piezas de la familia: `CabeceraPagina`, `Grupo`, `Ficha`, `.tarjeta`, `.panel-dia`, `.btn`, `.btn-sec`, `.campo`, `.chip`, `.esqueleto`.
- `node familia/revisar.mjs` corre con las pruebas y falla si hay colores sueltos o si `familia/` fue cambiada.
- Se conserva la estructura y las pantallas propias de esta app; lo común es el aspecto.

**Modo prueba (v2.6.0, decisión del dueño):** solo en el armado de prueba (`npm run prueba`, pruebas automáticas). En la web publicada `?prueba=1` no existe; al abrir se borra la marca vieja `stoica.prueba`.

### Cómo está aplicada en StoaHabit (v2.5.0, versión de la familia 1.8.0)
- `src/main.tsx` carga `familia/familia.css` antes de `src/styles/stoica.css`; Tailwind usa `presets: [familia]`. `stoica.css` ya no define colores: solo usa variables de la familia (las equivalencias viejas → nuevas están aplicadas: `--ok`→`--verde`, `--card-ln`→`--ln`, virtudes → `--serie-1/2/4/6`…).
- `src/app/Shell.tsx`: `BarraLateral` (PC) + `Pestanas` (celular: Hoy, Hábitos, Tareas, Examen, Memento, Comunidad), contenedor `.con-lateral`, `AvisoMudanza` y `AvisoPrueba`. En el celular se entra a Perfil tocando el avatar del Panel del día.
- Inicio (`src/screens/Hoy.tsx`): `PanelDia` (decisión del dueño, igual en las 3 apps, familia 1.5.0): avatar (foto o iniciales), saludo y **frase estoica del día** en la prop `frase` = `fraseDelDia('constancia')`. **Sin** rango, nivel ni emblema en el panel (las props `linea` y `esquina` ya no existen). Lo propio de StoaHabit va en `fichas` (Memento mori, Tu jardín, Nuevo hábito). **Sin `lado`** (decisión del dueño, v2.3.1: se quitó "1/5 Prácticas de hoy"; el avance del día ya está más abajo). El avatar es `<Avatar foto={perfil.foto} nombre={perfil.nombre}/>` dentro de un enlace a Perfil. Después, `TuSemana` (lunes a domingo; cumplido = todas las prácticas del día).
- Frases: `src/lib/frases.ts` reexporta `familia/frases.ts` (como StoaGym y StoaFit). `functions/src/core/citas.ts` queda solo para las funciones del servidor.
- **Foto de perfil (familia 1.6.0, pedido del dueño):** `perfil.foto` = data URL WebP (o JPEG) de 256×256 hecha con `BotonFoto`/`prepararFoto` de la familia (abre la galería, sin `capture`). **Sin Storage**: va dentro de `users/{uid}`. `firestore.rules` acepta `foto` string ≤ 100.000 caracteres que empiece con `data:image/webp` o `data:image/jpeg`, o `null` para quitarla (prueba en `tests/reglas`). `<Avatar>` (foto o iniciales) en el Panel del día, en la persona de la barra lateral y en la tarjeta de Perfil. Prueba de pantalla: "foto de perfil" en `e2e/recorrido.spec.ts`.
- Perfil: arriba `<TarjetaPerfil>` de la familia (avatar, nombre, correo, detalle "Entra con correo · Admin" / "Modo invitado", acciones `.btn-borde`: Cambiar foto, Quitar foto solo si hay, Cambiar nombre). Barra lateral: persona = avatar + primer nombre + correo (o "Modo invitado"); el rango ya no se muestra en ningún lado (`useRango` en `src/app/rango.ts` queda por si el dueño lo quiere de vuelta).
- **Acceso (familia 1.7.0, v2.4.0):** `src/screens/Acceso.tsx` = `<PortadaAcceso>` con `familia/portada-filosofo.webp`, `<Emblema figura={FIGURAS.check} size={92}/>`, "StoaHabit", lema "Hábitos · Disciplina · Serenidad" y frase para PC. Botones en orden: "Iniciar sesión" (`.btn` + ícono `corona`), "Crear cuenta" (`.btn-sec`), "Continuar como invitado" (`.portada-invitado`); abajo `BotonInstalar` y la franja del modo prueba. **Desde v2.5.0 (familia 1.8.0, obligatorio):** al tocar "Iniciar sesión" o "Crear cuenta" se abre la pantalla completa `PantallaAcceso` (emblema `<EmblemaStoaHabit size={72}/>`, nombre "StoaHabit", `alVolver` → portada) con `FormularioAcceso` adentro (`vista`, `alCambiarVista`, `mensajeError={mensajeDeError}`, `acciones={accionesAcceso}`: ingresar, registrar, recuperar y google, con las validaciones de `@core/validaciones`). No hay formulario propio. El invitado guarda su cuenta en Perfil con `FormularioAcceso` `sinTitulo` dentro de la `Hoja` "Guardar mi cuenta" (registrar = `guardarCuentaInvitado` + nombre). `App.tsx` muestra la portada sin el contenedor `.app-contenido`. Textos para las pruebas: "Bienvenido de nuevo", "Creá tu cuenta", "Recuperar contraseña", "Entrar", "Enviar enlace", "¿No tenés cuenta? Creá una", "¿Ya tenés cuenta? Iniciá sesión", "Volver"; campos con `getByLabel('Nombre' | 'Correo' | 'Contraseña', { exact: true })`.
- **Arranque rápido (v2.4.0, como StoaGym v1.28.0):** `observarPerfil` entrega primero el perfil de la caché (`getDocFromCache`) y después el oyente de siempre; `Arranque.tsx` lo refresca una vez con `perfilDelServidor` (`getDocFromServer`) y solo lo aplica si `actualizado` del servidor es más nuevo (no pisa un cambio local). `Coleccion` (`src/app/sync.ts`) siempre muestra primero lo guardado en el dispositivo. `leerListaRapida` (caché + servidor por detrás) para lo que no valida nada (reacciones del jardín); `leerLista` sigue yendo al servidor (borrar hábito, exportar, dispositivos). Funciones del servidor (códigos, borrar cuenta) sin cambios.
- **Service worker (v2.4.0):** `src/sw.ts` hace `skipWaiting()` al instalarse (la versión nueva se instala y activa sola); `src/pwa/Actualizacion.tsx` recarga la página **solo** cuando `document.visibilityState === 'hidden'` tras `controllerchange` (nunca en pantalla) y ante `vite:preloadError`. Revisa versión nueva al volver a la app y cada 30 min. Ya no hay aviso "Hay una versión nueva".
- Tema: `ElegirTema` en Perfil; `src/app/tema.ts` usa `aplicarTema` de la familia y recuerda la elección en `stoica.tema`. Perfil nuevo arranca en `oscuro` (Noche romana).
- `src/ui/Iconos.tsx` solo traduce los nombres viejos a íconos de la familia; **no hay dibujos propios** (familia 1.5.0). Jardín = `brote` (menú, pestañas, fichas), Memento = `calavera`, `llave`, sin conexión = `sin-conexion`, sonido = `lira` / `lira-apagada`, `mover`. Un ícono nuevo se agrega en familia-estoica. Los íconos de cada hábito (`IconoHabito`) son contenido, no navegación.
- **Ilustraciones** (dibujos del jardín, noche, fuego y bichos; estatua y personajes 3D de El Espejo; fotos de ejemplo del modo prueba; fondo del collage) conservan sus colores con el comentario `familia-ok`. No son colores de interfaz; si el dueño quiere, se pasan a la familia.
