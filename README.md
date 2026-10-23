# Stoica

Hábitos. Disciplina. Una vida más serena.

App de hábitos con enfoque estoico. Web instalable (PWA) con Firebase.
Publicada en **https://stoica-app.web.app**. La versión anterior (un solo HTML con localStorage) quedó en la rama `version-anterior`, que sigue publicando Netlify.

## Versión actual: v0.1 · la base

| Qué | Estado |
| --- | --- |
| Acceso con correo y contraseña, y con Google; "Olvidé mi contraseña" | ✅ |
| Perfil: nombre, tema Claro/Oscuro/Sistema, memento mori | ✅ |
| Navegación: barra inferior en celular, barra lateral en escritorio | ✅ |
| Hoy: saludo, fecha, memento mori, cita del día, semana | ✅ |
| Modo prueba (todo en memoria, sin Firebase) | ✅ |
| Reglas de Firestore estrictas + tests con el emulador | ✅ |
| Funciones: `alCrearUsuario`, `asignarRol` | ✅ |
| PWA: instalar, aviso de versión nueva, sin conexión | ✅ |
| Workflow "Publicar" en GitHub Actions | ✅ |

Plan: v0.2 hábitos Sí/No · v0.3 cantidad y medición · v0.4 tareas, enfoque y examen · v0.5 notificaciones · v0.6 panel admin · v0.7–v0.9 comunidad · v1.0 pulido.

## Estructura

| Carpeta / archivo | Qué es |
| --- | --- |
| `src/` | La app web (React + TypeScript + Tailwind) |
| `src/data/` | Capa de datos con dos drivers: `firebase.ts` (real) y `memoria.ts` (modo prueba) |
| `src/screens/` | Pantallas |
| `functions/src/core/` | Lógica compartida entre la web (`@core`) y las funciones: fechas con zona horaria, romanos, validaciones, citas |
| `functions/src/index.ts` | Cloud Functions (v2, São Paulo) |
| `firestore.rules` | Reglas de seguridad |
| `tests/reglas/` | Tests de reglas (corren en GitHub con el emulador) |
| `e2e/` | Recorridos con Playwright en modo prueba |
| `.github/workflows/publicar.yml` | Tests en cada push; en `main` además publica |

## Comandos

| Comando | Para qué |
| --- | --- |
| `npm run prueba` | Abre la app en modo prueba (entrá con `prueba@stoica.app` / `stoica`) |
| `npm run typecheck` | Revisa los tipos de la web y las funciones |
| `npm test` | Tests de lógica (Vitest) |
| `npm run test:reglas` | Tests de reglas con el emulador (necesita Java) |
| `npm run e2e` | Recorridos con capturas en `e2e/capturas/` |

## Configuración en GitHub

- Variables (`Settings › Secrets and variables › Actions › Variables`): `VITE_FIREBASE_*` (6) y `ADMIN_EMAIL` (correo del admin; tiene que entrar con Google para tener el correo verificado).
- Secreto: `FIREBASE_SERVICE_ACCOUNT` (clave JSON de la cuenta `github-publicar`).

Nunca subir claves ni datos personales reales al repositorio.
