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

### Cómo está aplicada en StoaHabit (v2.2.0, versión de la familia 1.5.0)
- `src/main.tsx` carga `familia/familia.css` antes de `src/styles/stoica.css`; Tailwind usa `presets: [familia]`. `stoica.css` ya no define colores: solo usa variables de la familia (las equivalencias viejas → nuevas están aplicadas: `--ok`→`--verde`, `--card-ln`→`--ln`, virtudes → `--serie-1/2/4/6`…).
- `src/app/Shell.tsx`: `BarraLateral` (PC) + `Pestanas` (celular: Hoy, Hábitos, Tareas, Examen, Memento, Comunidad), contenedor `.con-lateral`, `AvisoMudanza` y `AvisoPrueba`. En el celular se entra a Perfil tocando el avatar del Panel del día.
- Inicio (`src/screens/Hoy.tsx`): `PanelDia` (decisión del dueño, igual en las 3 apps, familia 1.5.0): iniciales como avatar, saludo y **frase estoica del día** en la prop `frase` = `fraseDelDia('constancia')`. **Sin** rango, nivel ni emblema en el panel (las props `linea` y `esquina` ya no existen). Lo propio de StoaHabit va en `fichas` (Memento mori, Tu jardín, Nuevo hábito) y en `lado` (prácticas de hoy n/total, `practicas-de-hoy`). El rango sigue en la persona de la barra lateral. Después, `TuSemana` (lunes a domingo; cumplido = todas las prácticas del día).
- Frases: `src/lib/frases.ts` reexporta `familia/frases.ts` (como StoaGym y StoaFit). `functions/src/core/citas.ts` queda solo para las funciones del servidor.
- Tema: `ElegirTema` en Perfil; `src/app/tema.ts` usa `aplicarTema` de la familia y recuerda la elección en `stoica.tema`. Perfil nuevo arranca en `oscuro` (Noche romana).
- `src/ui/Iconos.tsx` solo traduce los nombres viejos a íconos de la familia; **no hay dibujos propios** (familia 1.5.0). Jardín = `brote` (menú, pestañas, fichas), Memento = `calavera`, `llave`, sin conexión = `sin-conexion`, sonido = `lira` / `lira-apagada`, `mover`. Un ícono nuevo se agrega en familia-estoica. Los íconos de cada hábito (`IconoHabito`) son contenido, no navegación.
- **Ilustraciones** (dibujos del jardín, noche, fuego y bichos; estatua y personajes 3D de El Espejo; fotos de ejemplo del modo prueba; fondo del collage) conservan sus colores con el comentario `familia-ok`. No son colores de interfaz; si el dueño quiere, se pasan a la familia.
