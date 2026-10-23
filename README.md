# Stoica

Hábitos. Disciplina. Una vida más serena.

App de hábitos con enfoque estoico. Web instalable (PWA) con Firebase, publicada en **https://stoica-app.web.app**.
La versión anterior (un solo HTML con localStorage) quedó en la rama `version-anterior`, que sigue publicando Netlify.

## Qué tiene (v1.0)

| Versión | Qué agrega |
| --- | --- |
| v0.1 | Acceso con correo y Google, perfil y tema, navegación, modo prueba, reglas, PWA, workflow "Publicar" |
| v0.2 | Hábitos Sí/No, Hoy por momentos del día, detalle con calendario, rachas en romanos, hitos "Victoria sobre ti mismo" |
| v0.3 | Hábitos de cantidad (+ y −) y de medición (variables, gráfico, cambio, ritmo semanal, fecha estimada), 30 íconos, plantillas |
| v0.4 | Tareas con "¿depende de ti?", enfoque con temporizador, examen nocturno de Séneca, balance de virtudes |
| v0.5 | Notificaciones push: recordatorios de hábitos pendientes y aviso del examen |
| v0.6 | Panel de admin: métricas (activos, altas, retención, uso por tipo, plataformas) y cuentas (cambio de contraseña, suspender, borrar) |
| v0.7 | Grupos privados por invitación (hasta 20) y "qué comparto" (cumplido hoy, racha, %) |
| v0.8 | Desafíos con duración y meta, con progreso de cada integrante |
| v0.9 | Reacciones predefinidas (sin chat) con aviso push |
| v1.0 | Exportar mis datos (JSON), borrar mi cuenta, pulido y pruebas completas |

## Privacidad

- Cada persona ve y escribe solo sus datos (`users/{uid}/**`). El admin **no** puede leer hábitos, registros, mediciones ni exámenes: lo comprueban los tests de reglas.
- En los grupos solo se comparte, por hábito elegido: si se cumplió hoy, la racha y el % de 30 días. Nunca notas, examen ni valores de medición.
- Las métricas del admin son totales sin nombres.

## Estructura

| Carpeta / archivo | Qué es |
| --- | --- |
| `src/screens/` | Pantallas (Hoy, Hábitos, Tareas, Enfoque, Examen, Comunidad, Admin, Perfil) |
| `src/app/datos.ts` | Datos del usuario sincronizados y acciones (marcar, sumar, medir, rachas, hitos) |
| `src/app/comunidad.ts` | Grupos, resumen compartido, reacciones y desafíos |
| `src/data/` | Capa de datos: `firebase.ts` (real) y `memoria.ts` (modo prueba, con datos de ejemplo) |
| `src/sw.ts` | Service worker: sin conexión, versión nueva y notificaciones |
| `functions/src/core/` | Lógica compartida web + servidor, con tests |
| `functions/src/index.ts` | Cloud Functions (São Paulo) |
| `firestore.rules` | Reglas de seguridad por colección |
| `tests/reglas/` | Tests de seguridad (emulador, en GitHub) |
| `e2e/` | Recorridos con Playwright y capturas |

## Comandos

| Comando | Para qué |
| --- | --- |
| `npm run prueba` | App en modo prueba (entrá con `prueba@stoica.app` / `stoica`, que es admin y trae datos de ejemplo) |
| `npm run typecheck` | Tipos de la web y las funciones |
| `npm test` | Tests de lógica |
| `npm run test:reglas` | Tests de seguridad con el emulador (necesita Java) |
| `npm run e2e` | Recorridos con capturas en `e2e/capturas/` |

## Configuración en GitHub

- Variables: `VITE_FIREBASE_*` (6), `VITE_FIREBASE_VAPID_KEY` (clave pública para notificaciones web) y `ADMIN_EMAIL` (el admin tiene que entrar con Google).
- Secreto: `FIREBASE_SERVICE_ACCOUNT` (clave JSON de la cuenta `github-publicar`).

Nunca subir claves ni datos personales reales al repositorio.
