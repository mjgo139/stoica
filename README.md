# Stoica

Hábitos. Disciplina. Una vida más serena.

App web instalable (PWA) de hábitos con enfoque estoico: hábitos de sí/no, de cantidad y de medición (peso, cintura…), tareas, enfoque con temporizador, examen nocturno y perfil con balance de virtudes.

## Estructura

| Archivo | Qué es |
| --- | --- |
| `index.html` | La app completa: pantallas, lógica y base de datos JSON |
| `manifest.webmanifest` | Nombre, colores e íconos para instalarla |
| `sw.js` | Service worker: la app abre sin conexión |
| `icons/` | Íconos 192, 512, maskable y apple-touch-icon |

## Datos

Todo se guarda en el navegador del dispositivo (`localStorage`, clave `stoica.db.v1`) como un único JSON con tablas planas:
`users`, `user_settings`, `habits`, `habit_reminders`, `habit_metrics`, `habit_logs`, `habit_measurements`, `habit_notes`, `tasks`, `task_completions`, `focus_sessions`, `journal_entries`, `user_milestones`.

El login es local (simulado): sirve para separar cuentas en un mismo dispositivo, no es seguridad real.
Desde **Perfil › Ver y exportar JSON** se hace una copia; **Importar copia** la restaura.

## Publicar con GitHub Pages

Settings › Pages › Branch `main`, carpeta `/ (root)`. La app queda en `https://mjgo139.github.io/stoica/`.

Al publicar una versión nueva, cambiá `VERSION` en `sw.js` para que los teléfonos instalados la actualicen.
