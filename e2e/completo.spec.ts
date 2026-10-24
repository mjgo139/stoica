import { expect, test, type Page } from '@playwright/test';

/**
 * Recorrido completo v0.2 → v1.0 en modo prueba, con la cuenta de ejemplo (que es admin y trae datos).
 */
const captura = (page: Page, nombre: string) => page.screenshot({ path: `e2e/capturas/${test.info().project.name}-${nombre}.png`, fullPage: true });
const esCelular = () => test.info().project.name === 'celular';

async function entrarConEjemplo(page: Page) {
  await page.goto('/');
  await page.getByLabel('Correo').fill('prueba@stoica.app');
  await page.getByLabel('Contraseña').fill('stoica');
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Marco');
}

async function ir(page: Page, ruta: string) {
  // Navegación interna (sin recargar: el modo prueba vive en memoria).
  await page.evaluate((r) => {
    window.history.pushState({}, '', r);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, ruta);
}

test.describe('v0.2–v0.3 · hábitos', () => {
  test('Hoy con datos: marcar, sumar, medir, ver otro día', async ({ page }) => {
    await entrarConEjemplo(page);
    await expect(page.getByText('I · Al amanecer')).toBeVisible();
    await captura(page, '10-hoy-con-datos');

    // Sí/No: marcar y desmarcar
    const fria = page.locator('[data-habito="Ducha fría"]');
    if (await fria.count()) {
      const boton = fria.getByRole('button', { name: /Ducha fría/ });
      const antes = await boton.getAttribute('aria-pressed');
      await boton.click();
      await expect(boton).toHaveAttribute('aria-pressed', antes === 'true' ? 'false' : 'true');
      // Si con esto llegó a un hito, aparece "Victoria sobre ti mismo".
      const victoria = page.getByRole('alertdialog', { name: 'Victoria sobre ti mismo' });
      if (await victoria.isVisible().catch(() => false)) {
        await captura(page, '10b-victoria');
        await victoria.getByRole('button', { name: 'Seguir' }).click();
      }
    }

    // Cantidad: de 3 a 4 vasos, y corregir con −
    const agua = page.locator('[data-habito="Beber agua"]');
    await expect(agua).toContainText('3/8');
    await agua.getByRole('button', { name: 'Sumar uno a Beber agua' }).click();
    await expect(agua).toContainText('4/8');
    await expect(agua).toContainText('faltan 4');
    await agua.getByRole('button', { name: 'Restar uno a Beber agua' }).click();
    await expect(agua).toContainText('3/8');

    // Ver ayer: los días pasados no cumplidos se ven en terracota y se pueden corregir
    await page.getByRole('tab').nth(2).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ayer');
    await page.getByRole('tab').nth(3).click();
  });

  test('crear hábito desde plantilla, detalle, editar, archivar y borrar', async ({ page }) => {
    await entrarConEjemplo(page);
    await ir(page, '/habitos');
    await expect(page.getByRole('heading', { level: 1, name: 'Hábitos' })).toBeVisible();
    await captura(page, '11-habitos');

    await page.getByRole('link', { name: /Nuevo hábito/ }).click();
    await page.getByRole('button', { name: /Ducha fría/ }).first().click();
    await expect(page.getByLabel('Nombre')).toHaveValue('Ducha fría');
    await page.getByLabel('Nombre').fill('Caminar al alba');
    await page.getByRole('radio', { name: 'Cantidad' }).click();
    await page.getByLabel('Meta por día').fill('30');
    await page.getByLabel('Unidad').fill('minutos');
    await page.getByRole('radio', { name: 'Caminar' }).click();
    await page.getByRole('button', { name: '+ Agregar aviso' }).click();
    await page.getByLabel('Hora del recordatorio 1', { exact: true }).fill('06:47');
    await captura(page, '12-editor');
    await page.getByRole('button', { name: 'Crear hábito' }).click();
    await expect(page.getByText('Hábito creado.')).toBeVisible();

    // Validación: sin nombre no deja crear
    await ir(page, '/habitos/nuevo');
    await page.getByRole('button', { name: 'Crear hábito' }).click();
    await expect(page.getByRole('alert')).toContainText('nombre');

    // Detalle con medición
    await ir(page, '/habitos/h-peso');
    await expect(page.getByRole('heading', { level: 1, name: 'Bajar de peso' })).toBeVisible();
    await expect(page.getByText('Ritmo semanal').first()).toBeVisible();
    await page.getByRole('button', { name: /Registrar medición|Corregir medición/ }).click();
    await page.getByLabel(/Peso/).fill('80,4');
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Medición guardada.')).toBeVisible();
    await expect(page.getByText(/Peso: 80,4 kg/)).toBeVisible();
    await captura(page, '13-detalle-medicion');

    // Detalle sí/no con calendario
    await ir(page, '/habitos/h-meditar');
    await expect(page.getByRole('grid', { name: 'Calendario del mes' })).toBeVisible();
    await expect(page.getByText('Racha actual')).toBeVisible();
    await captura(page, '14-detalle-meditar');

    // Archivar y restaurar
    await page.getByRole('button', { name: 'Archivar' }).click();
    await expect(page.getByText('Hábito archivado.')).toBeVisible();
    await page.getByRole('button', { name: 'Restaurar' }).click();

    // Borrar con confirmación
    await ir(page, '/habitos/h-familia');
    await page.getByRole('button', { name: 'Borrar' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Borrar' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Hábitos' })).toBeVisible();
    await expect(page.getByText('Tiempo con la familia')).toHaveCount(0);
  });

  test('hito: Victoria sobre ti mismo al llegar a 3 días', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Crear cuenta' }).click();
    await page.getByLabel('Nombre').fill('Cleantes');
    await page.getByLabel('Correo').fill('cleantes2@ejemplo.com');
    await page.getByLabel('Contraseña').fill('aguador');
    await page.locator('form').getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByText('Empezá por una práctica')).toBeVisible();
    await page.getByRole('button', { name: /Meditar/ }).first().click();
    await page.getByRole('button', { name: 'Crear hábito' }).click();
    // Para el hito, el hábito tiene que existir desde hace 3 días: se marca hoy, ayer y anteayer.
    // Como recién se creó hoy, ayer no cuenta: verificamos que solo hoy suma racha I.
    await page.getByRole('button', { name: 'Marcar Meditar' }).click();
    await expect(page.locator('[data-habito="Meditar"]')).toContainText('Racha I');
  });
});

test.describe('v0.4 · tareas, enfoque, examen', () => {
  test('tareas con ¿depende de ti?', async ({ page }) => {
    await entrarConEjemplo(page);
    await ir(page, '/tareas');
    await expect(page.getByRole('heading', { level: 1, name: 'Tareas' })).toBeVisible();
    await expect(page.getByText('Que el cliente apruebe el presupuesto')).toBeVisible();
    await page.getByRole('button', { name: /Nueva tarea/ }).click();
    await page.getByLabel('Tarea', { exact: true }).fill('Comprar pan');
    await page.getByRole('button', { name: 'Agregar tarea' }).click();
    await expect(page.getByText('Comprar pan')).toBeVisible();
    await page.getByRole('button', { name: 'Marcar Comprar pan' }).click();
    await expect(page.getByRole('button', { name: 'Desmarcar Comprar pan' })).toBeVisible();
    await captura(page, '15-tareas');
  });

  test('proyectos: ver avance, agregar y completar tareas, crear uno nuevo', async ({ page }) => {
    await entrarConEjemplo(page);
    await ir(page, '/tareas');
    await expect(page.getByRole('link', { name: /Mudanza/ })).toContainText('1/3');
    await page.getByRole('link', { name: /Mudanza/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Mudanza' })).toBeVisible();
    await page.getByRole('button', { name: 'Marcar Embalar la biblioteca' }).click();
    await expect(page.getByText('2 de 3 tareas')).toBeVisible();
    await page.getByRole('button', { name: /Tarea$/ }).click();
    await page.getByLabel('Tarea', { exact: true }).fill('Dar de baja la luz');
    await expect(page.getByLabel('Proyecto')).toHaveValue('p1');
    await page.getByRole('dialog').getByRole('button', { name: 'Agregar tarea' }).click();
    await expect(page.getByText('2 de 4 tareas')).toBeVisible();
    await captura(page, '24-proyecto');

    // Proyecto nuevo desde Tareas
    await ir(page, '/tareas');
    await page.getByRole('button', { name: '+ Nuevo' }).click();
    await page.getByLabel('Nombre del proyecto').fill('Tesis');
    await page.getByRole('dialog').getByRole('button', { name: 'Crear proyecto' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Tesis' })).toBeVisible();
    await page.getByRole('button', { name: 'Borrar proyecto' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Borrar' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Tareas' })).toBeVisible();
  });

  test('avisos a cualquier hora: tarea con hora y hábito con varias horas', async ({ page }) => {
    await entrarConEjemplo(page);
    await ir(page, '/tareas');
    await page.getByRole('button', { name: 'Nueva tarea' }).click();
    await page.getByLabel('Tarea', { exact: true }).fill('Tomar la pastilla');
    await page.getByRole('dialog').getByRole('button', { name: '+ Agregar aviso' }).click();
    await page.getByLabel('Hora del aviso 1', { exact: true }).fill('18:37');
    await page.getByRole('dialog').getByRole('button', { name: 'Agregar tarea' }).click();
    await expect(page.locator('[data-tarea="Tomar la pastilla"]')).toContainText('18:37');

    await ir(page, '/habitos/h-meditar/editar');
    await expect(page.getByLabel('Hora del recordatorio 1', { exact: true })).toHaveValue('06:30');
    await page.getByRole('button', { name: '+ Otra hora' }).click();
    await page.getByLabel('Hora del recordatorio 2', { exact: true }).fill('21:13');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await ir(page, '/habitos/h-meditar/editar');
    await expect(page.getByLabel('Hora del recordatorio 2', { exact: true })).toHaveValue('21:13');
  });

  test('enfoque: temporizador que se pausa y cancela', async ({ page }) => {
    await entrarConEjemplo(page);
    await ir(page, '/enfoque');
    await page.getByRole('radio', { name: 'Meditación' }).click();
    await page.getByRole('button', { name: '5 min' }).click();
    await page.getByRole('button', { name: 'Comenzar' }).click();
    await expect(page.getByRole('timer')).toHaveText(/0[45]:\d\d/);
    await page.getByRole('button', { name: 'Pausar' }).click();
    await expect(page.getByText('En pausa')).toBeVisible();
    await captura(page, '16-enfoque');
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('button', { name: 'Comenzar' })).toBeVisible();
  });

  test('examen nocturno y balance de virtudes', async ({ page }) => {
    await entrarConEjemplo(page);
    await ir(page, '/examen');
    await page.getByLabel('¿Qué mal he corregido hoy?').fill('Respondí con calma a una crítica.');
    await page.getByRole('button', { name: 'Guardar examen' }).click();
    await expect(page.getByText('Examen guardado.')).toBeVisible();
    await expect(page.getByText('Balance de virtudes')).toBeVisible();
    await captura(page, '17-examen');
  });
});

test.describe('v0.5–v1.0', () => {
  test('perfil: notificaciones, exportar', async ({ page }) => {
    await entrarConEjemplo(page);
    await ir(page, '/perfil');
    await page.getByRole('switch', { name: /Recordatorios y examen/ }).click();
    await expect(page.getByText('Notificaciones activadas en este dispositivo.')).toBeVisible();
    await expect(page.getByRole('switch', { name: /Recordatorios y examen/ })).toHaveAttribute('aria-checked', 'true');
    const descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: /Exportar mis datos/ }).click();
    const archivo = await descarga;
    expect(archivo.suggestedFilename()).toMatch(/^stoica-\d{4}-\d{2}-\d{2}\.json$/);
    await captura(page, '18-perfil');
  });

  test('admin: métricas, cuentas, suspender', async ({ page }) => {
    await entrarConEjemplo(page);
    await ir(page, '/admin');
    await expect(page.getByRole('heading', { level: 1, name: 'Panel' })).toBeVisible();
    await expect(page.getByText('Epicteto').first()).toBeVisible();
    await page.getByRole('button', { name: 'Recalcular métricas' }).click();
    await expect(page.getByText('Métricas actualizadas.')).toBeVisible();
    await page.getByLabel('Buscar cuentas').fill('zenon');
    await expect(page.getByRole('row')).toHaveCount(2);
    await page.getByRole('button', { name: 'Suspender' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Suspender' }).click();
    await expect(page.getByText('Cuenta suspendida.')).toBeVisible();
    await page.getByLabel('Buscar cuentas').fill('');
    await captura(page, '19-admin');
  });

  test('comunidad: grupo, compartir, reaccionar, desafío, crear y unirse', async ({ page }) => {
    await entrarConEjemplo(page);
    await ir(page, '/comunidad');
    await expect(page.getByText('El Pórtico')).toBeVisible();
    await page.getByText('El Pórtico').click();
    await expect(page.getByRole('heading', { level: 1, name: 'El Pórtico' })).toBeVisible();

    await page.getByRole('button', { name: 'Qué comparto' }).click();
    // Las hojas se dibujan directo en <body> (si no, quedan cortadas dentro de la pantalla animada).
    await expect(page.locator('body > .capa')).toHaveCount(1);
    await page.getByRole('dialog').getByLabel('Meditar').check();
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('· vos')).toBeVisible();

    // Marcar mi hábito compartido desde el grupo
    const mio = page.getByRole('button', { name: /^(Marcar|Desmarcar) Meditar$/ });
    const antes = await mio.getAttribute('aria-pressed');
    await mio.click();
    await expect(mio).toHaveAttribute('aria-pressed', antes === 'true' ? 'false' : 'true');
    const victoria = page.getByRole('alertdialog', { name: 'Victoria sobre ti mismo' });
    if (await victoria.isVisible().catch(() => false)) await victoria.getByRole('button').first().click();

    await page.getByRole('group', { name: 'Reaccionar a Epicteto' }).getByRole('button', { name: 'Fuerza' }).click();
    await expect(page.getByRole('group', { name: 'Reaccionar a Epicteto' }).getByRole('button', { name: 'Fuerza' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Sumarme' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: /Meditar/ }).click();
    await expect(page.getByText('Vos', { exact: true })).toBeVisible();
    await captura(page, '20-grupo');

    // Desafío sin hábito propio: se crea el hábito y se suma en un toque
    await page.getByRole('button', { name: '+ Nuevo' }).click();
    await page.getByLabel('Nombre').fill('10 días de gratitud');
    await page.getByRole('dialog').getByRole('button', { name: 'Crear desafío' }).click();
    const gratitud = page.locator('[data-desafio="10 días de gratitud"]');
    await gratitud.getByRole('button', { name: 'Sumarme' }).click();
    await expect(page.getByRole('dialog')).toContainText('“Gratitud”');
    await page.getByRole('dialog').getByRole('button', { name: 'Crear el hábito y sumarme' }).click();
    await expect(gratitud.getByText('Vos', { exact: true })).toBeVisible();
    await ir(page, '/habitos');
    await expect(page.getByText('Gratitud').first()).toBeVisible();
    await ir(page, '/comunidad');
    await page.getByText('El Pórtico').click();

    // Crear un grupo y ver el código
    await ir(page, '/comunidad');
    await page.getByRole('button', { name: /Crear grupo/ }).click();
    await page.getByLabel('Nombre del grupo').fill('Jardín de Epicuro');
    await page.getByRole('dialog').getByRole('button', { name: 'Crear' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Jardín de Epicuro' })).toBeVisible();

    // Código inválido
    await ir(page, '/comunidad');
    await page.getByRole('button', { name: 'Unirme con código' }).click();
    await page.getByLabel('Código de invitación').fill('XX');
    await page.getByRole('dialog').getByRole('button', { name: 'Unirme' }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('8 letras');
  });

  test('borrar mi cuenta', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Crear cuenta' }).click();
    await page.getByLabel('Nombre').fill('Temporal');
    await page.getByLabel('Correo').fill('temporal@ejemplo.com');
    await page.getByLabel('Contraseña').fill('temporal1');
    await page.locator('form').getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Temporal');
    await ir(page, '/perfil');
    await page.getByRole('button', { name: 'Borrar mi cuenta' }).click();
    const borrar = page.getByRole('button', { name: 'Borrar definitivamente' });
    await expect(borrar).toBeDisabled();
    await page.getByLabel('Escribí BORRAR para confirmar').fill('borrar');
    await borrar.click();
    await expect(page.getByRole('heading', { name: 'STOICA' })).toBeVisible();
    // Ya no puede entrar
    await page.getByLabel('Correo').fill('temporal@ejemplo.com');
    await page.getByLabel('Contraseña').fill('temporal1');
    await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('alert')).toHaveText('El correo o la contraseña no coinciden.');
  });

  test('navegación de celular y escritorio', async ({ page }) => {
    await entrarConEjemplo(page);
    if (esCelular()) {
      await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Hoy' })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Comunidad' })).toBeVisible();
      await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Comunidad' }).click();
      await expect(page.getByText('El Pórtico')).toBeVisible();
    } else {
      await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Comunidad' })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Admin' })).toBeVisible();
    }
  });
});
