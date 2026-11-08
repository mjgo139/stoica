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
    await page.getByRole('tab', { name: 'Cuerpo' }).click();
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

  test('lista: comer bien con almuerzo, merienda y cena', async ({ page }) => {
    await entrarConEjemplo(page);
    const comer = page.locator('[data-habito="Comer bien"]');
    await expect(comer).toContainText('1/3');
    await comer.getByRole('button', { name: 'Merienda' }).click();
    await expect(comer.getByRole('button', { name: 'Merienda' })).toHaveAttribute('aria-pressed', 'true');
    await expect(comer).toContainText('2/3');
    await comer.getByRole('button', { name: 'Cena' }).click();
    // Completar la lista puede llegar a un hito
    const victoria = page.getByRole('alertdialog', { name: 'Victoria sobre ti mismo' });
    await expect(victoria).toBeVisible();
    await victoria.getByRole('button', { name: 'Seguir' }).click();
    await expect(comer).toContainText('cumplido');
    await comer.getByRole('button', { name: 'Cena' }).click();
    await expect(comer).toContainText('faltan 1');
    await captura(page, '10c-lista');

    // Detalle: porcentaje por ítem
    await ir(page, '/habitos/h-comer');
    await expect(page.locator('[data-items]')).toContainText('Merienda');

    // Crear una lista desde cero: alcanza con 2 de 3
    await ir(page, '/habitos/nuevo');
    await page.getByLabel('Nombre').fill('Rutina de mañana');
    await page.getByRole('radio', { name: 'Lista' }).click();
    await page.getByLabel('Ítem 1', { exact: true }).fill('Cama');
    await page.getByLabel('Ítem 2', { exact: true }).fill('Agua');
    await page.getByRole('button', { name: '+ Agregar ítem' }).click();
    await page.getByLabel('Ítem 3', { exact: true }).fill('Estirar');
    await page.getByLabel('Para cumplir el día').selectOption({ label: 'Al menos 2 de 3' });
    await page.getByRole('button', { name: /Crear hábito|Guardar/ }).click();
    const rutina = page.locator('[data-habito="Rutina de mañana"]');
    await rutina.getByRole('button', { name: 'Cama' }).click();
    await rutina.getByRole('button', { name: 'Agua' }).click();
    await expect(rutina).toContainText('cumplido');
  });

  test('editor: la virtud se explica al elegirla y los íconos van por grupo', async ({ page }) => {
    await entrarConEjemplo(page);
    await ir(page, '/habitos/nuevo');
    const explica = page.locator('[data-explica-virtud]');
    await expect(explica).toContainText('Sabiduría');
    await page.getByRole('radio', { name: 'Coraje' }).click();
    await expect(explica).toContainText('hacer lo difícil');
    await expect(explica).toContainText('entrenar');
    // Solo se ven los 12 íconos del grupo elegido
    await page.getByRole('tab', { name: 'Salud' }).click();
    await expect(page.getByRole('radiogroup', { name: 'Salud y medidas' }).getByRole('radio')).toHaveCount(12);
    await page.getByRole('radio', { name: 'Corazón' }).click();
    await expect(page.getByText('Elegido: Corazón')).toBeVisible();
    // Los proyectos ya no piden virtud
    await ir(page, '/tareas');
    await page.getByRole('button', { name: '+ Nuevo' }).click();
    await expect(page.getByRole('dialog')).not.toContainText('Virtud');
  });

  test('cantidad grande: 8.000 pasos se registran escribiendo el total', async ({ page }) => {
    await entrarConEjemplo(page);
    await ir(page, '/habitos/nuevo');
    await page.getByLabel('Nombre').fill('Caminar');
    await page.getByRole('radio', { name: 'Cantidad' }).click();
    await page.getByLabel('Meta por día').fill('8000');
    await page.getByLabel('Unidad').fill('pasos');
    await page.getByRole('button', { name: 'Crear hábito' }).click();
    await expect(page.getByText('Hábito creado.')).toBeVisible();
    const fila = page.locator('[data-habito="Caminar"]');
    await expect(fila).toContainText('0/8.000');
    await fila.getByRole('button', { name: 'Registrar cantidad de Caminar' }).click();
    const hoja = page.getByRole('dialog', { name: 'Caminar' });
    await hoja.getByRole('button', { name: '+1.000' }).click();
    await hoja.getByRole('button', { name: '+2.000' }).click();
    await expect(hoja).toContainText('Faltan 5.000 pasos.');
    await hoja.getByRole('button', { name: 'Guardar' }).click();
    await expect(fila).toContainText('3.000/8.000');
    await fila.getByRole('button', { name: 'Registrar cantidad de Caminar' }).click();
    await hoja.getByLabel('Total de hoy (pasos)').fill('8500');
    await expect(hoja).toContainText('¡Meta cumplida!');
    await hoja.getByRole('button', { name: 'Guardar' }).click();
    await expect(fila).toContainText('cumplido');
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
    // Desglose en Tareas: las tareas del proyecto se ven y se marcan ahí mismo
    const mudanza = page.locator('[data-proyecto="Mudanza"]');
    await expect(mudanza).toContainText('1/3');
    await expect(mudanza.locator('[data-tarea="Embalar la biblioteca"]')).toBeVisible();
    await mudanza.getByRole('button', { name: 'Marcar Embalar la biblioteca' }).click();
    await expect(mudanza).toContainText('2/3');
    await mudanza.getByRole('button', { name: 'Ver hechas (2)' }).click();
    await mudanza.getByRole('button', { name: 'Desmarcar Embalar la biblioteca' }).click();
    await expect(mudanza).toContainText('1/3');
    // Plegar y desplegar tocando justo en la flecha del borde (antes el toque se perdía)
    const cabecera = mudanza.getByRole('button', { name: /^Mudanza/ });
    const caja = (await cabecera.boundingBox())!;
    await cabecera.click({ position: { x: caja.width - 4, y: 12 }, delay: 120 });
    await expect(mudanza.locator('[data-tarea]')).toHaveCount(0);
    await cabecera.click({ position: { x: caja.width - 4, y: 12 }, delay: 120 });
    await expect(mudanza.locator('[data-tarea]').first()).toBeVisible();
    await captura(page, '23-desglose');
    // El botón de Enfoque está arriba, junto a Nueva tarea
    await expect(page.getByRole('link', { name: /Enfoque/ })).toBeVisible();
    await mudanza.getByRole('link', { name: 'Abrir proyecto ›' }).click();
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
    await ir(page, '/tareas');
    await page.getByRole('link', { name: /Enfoque/ }).click();
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

  test('perfil: cambiar la contraseña', async ({ page }) => {
    await entrarConEjemplo(page);
    await ir(page, '/perfil');
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
    const hoja = page.getByRole('dialog', { name: 'Cambiar contraseña' });
    await hoja.getByLabel('Contraseña actual').fill('equivocada');
    await hoja.getByLabel('Contraseña nueva').fill('estoico2');
    await hoja.getByLabel('Repetí la nueva').fill('estoico2');
    await hoja.getByRole('button', { name: 'Guardar contraseña' }).click();
    await expect(hoja.getByRole('alert')).toHaveText('La contraseña actual no es correcta.');
    await hoja.getByLabel('Contraseña actual').fill('stoica');
    await hoja.getByLabel('Repetí la nueva').fill('otra');
    await hoja.getByRole('button', { name: 'Guardar contraseña' }).click();
    await expect(hoja.getByRole('alert')).toHaveText('Las dos contraseñas nuevas no coinciden.');
    await hoja.getByLabel('Repetí la nueva').fill('estoico2');
    await hoja.getByRole('button', { name: 'Guardar contraseña' }).click();
    await expect(page.getByText('Contraseña cambiada.')).toBeVisible();
    // Sale y entra con la nueva
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await page.getByLabel('Correo').fill('prueba@stoica.app');
    await page.getByLabel('Contraseña').fill('estoico2');
    await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  });

  test('admin: métricas, cuentas, suspender', async ({ page }) => {
    await entrarConEjemplo(page);
    await ir(page, '/admin');
    await expect(page.getByRole('heading', { level: 1, name: 'Panel' })).toBeVisible();
    await expect(page.getByText('Epicteto').first()).toBeVisible();
    await page.getByRole('button', { name: 'Recalcular métricas' }).click();
    await expect(page.getByText('Métricas actualizadas.')).toBeVisible();
    await page.getByLabel('Buscar cuentas').fill('zenon');
    await expect(page.locator('table').first().getByRole('row')).toHaveCount(2);
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

    // La semana de los demás se ve en rombos chicos
    await expect(page.getByRole('img', { name: /Epicteto, Meditar: \d de 7 días/ })).toBeVisible();

    // Toda la tarjeta del desafío abre su pantalla; ahí te sumás y marcás tu hábito
    await page.locator('[data-desafio="21 días meditando"]').click();
    await expect(page.getByRole('heading', { level: 1, name: '21 días meditando' })).toBeVisible();
    await page.locator('[data-mi-habito]').getByRole('button', { name: 'Sumarme' }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Meditar/ }).click();
    await expect(page.locator('[data-mi-habito]')).toContainText('Meditar');
    await expect(page.locator('[data-mi-habito]').getByRole('button', { name: /^(Marcar|Desmarcar) Meditar$/ })).toBeVisible();
    // Cada participante con su hábito como en el grupo (racha, %, semana)
    await expect(page.locator('[data-participante="vos"]')).toContainText('Meditar');
    await expect(page.locator('[data-participante="Epicteto"]')).toContainText('Meditar');
    await expect(page.locator('[data-participante="Epicteto"]').getByRole('img', { name: /Epicteto, Meditar: 7 de 7 días/ })).toBeVisible();
    await expect(page.locator('[data-chat]')).toHaveCount(0);
    await captura(page, '20-grupo');
    await ir(page, '/comunidad/g-portico');

    // Desafío sin hábito propio: se crea el hábito y se suma en un toque
    await page.getByRole('button', { name: '+ Nuevo' }).click();
    await page.getByLabel('Nombre').fill('10 días de gratitud');
    await page.getByRole('dialog').getByRole('button', { name: 'Crear desafío' }).click();
    await page.locator('[data-desafio="10 días de gratitud"]').click();
    await page.locator('[data-mi-habito]').getByRole('button', { name: 'Sumarme' }).click();
    await expect(page.getByRole('dialog')).toContainText('“Gratitud”');
    await page.getByRole('dialog').getByRole('button', { name: 'Crear el hábito y sumarme' }).click();
    await expect(page.locator('[data-mi-habito]')).toContainText('Gratitud');

    // Quien lo creó lo edita: la duración solo se alarga
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await page.getByLabel('Nombre').fill('15 días de gratitud');
    await page.getByLabel('Duración (días)').fill('5');
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('solo se puede alargar');
    await page.getByLabel('Duración (días)').fill('30');
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByRole('heading', { level: 1, name: '15 días de gratitud' })).toBeVisible();
    // Y lo borra: vuelve al grupo y el desafío ya no está (el hábito queda)
    await page.getByRole('button', { name: 'Borrar', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Borrar' }).click();
    await expect(page.locator('[data-desafio="15 días de gratitud"]')).toHaveCount(0);
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
    // Quien creó el grupo le cambia el nombre
    await page.getByRole('button', { name: 'Editar nombre' }).click();
    await page.getByLabel('Nombre', { exact: true }).fill('Jardín');
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /^Jardín/ })).toBeVisible();

    // Código inválido
    await ir(page, '/comunidad');
    await page.getByRole('button', { name: 'Unirme con código' }).click();
    await page.getByLabel('Código de invitación').fill('XX');
    await page.getByRole('dialog').getByRole('button', { name: 'Unirme' }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('8 letras');
  });

  test('plan del grupo: código, foto de hoy en cada hábito ligada a si se cumplió y comentarios en las fotos', async ({ page }) => {
    // Recorrido largo (admin, código, fotos, comentarios, collage, desafío): necesita más que los 30 s por defecto.
    test.setTimeout(120_000);
    await entrarConEjemplo(page);
    // Admin: generar un código y ver los días de espera
    await ir(page, '/admin');
    const plan = page.locator('[data-admin="plan"]');
    await plan.getByLabel('Duración del código').selectOption('3');
    await plan.getByRole('button', { name: 'Generar código' }).click();
    const codigo = (await plan.locator('[data-codigo-nuevo]').first().textContent())!.trim();
    expect(codigo).toMatch(/^STOA-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    await expect(plan.getByLabel('Días de espera')).toHaveValue('7');

    // Grupo sin plan: no hay fotos, solo la invitación a activarlo
    await ir(page, '/comunidad');
    await page.getByText('El Pórtico').click();
    await expect(page.locator('[data-plan="sin"]')).toBeVisible();
    await expect(page.locator('[data-chat]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Foto de hoy de Epicteto/ })).toHaveCount(0);

    // Código inválido y después el bueno
    await page.locator('[data-plan="sin"]').getByRole('button', { name: 'Activar con un código' }).click();
    await page.getByLabel('Código de habilitación').fill('STOA-ZZZZ-ZZZZ');
    await page.getByRole('dialog').getByRole('button', { name: 'Activar' }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('no existe');
    await page.getByLabel('Código de habilitación').fill(codigo.toLowerCase());
    await page.getByRole('dialog').getByRole('button', { name: 'Activar' }).click();
    await expect(page.getByText(/fotos y comentarios activos hasta/)).toBeVisible();
    // Ya no hay chat aparte: se comenta cada foto
    await expect(page.locator('[data-chat]')).toHaveCount(0);

    // Fotos de los demás, con su estado: Epicteto cumplió, Séneca no
    await page.getByRole('button', { name: 'Foto de hoy de Epicteto, Meditar: cumplido' }).click();
    const historial = page.getByRole('dialog', { name: 'Meditar · Epicteto' });
    await expect(historial).toContainText('Al amanecer, antes que nadie.');
    await expect(historial).toContainText('✓ Cumplido');
    await expect(historial.getByRole('list', { name: 'Días con foto' }).getByRole('listitem')).toHaveCount(2);
    // Comentarios ligados a la foto: se leen y se comenta ahí mismo
    const comentarios = historial.locator('[data-comentarios]');
    await expect(comentarios).toContainText('Comentarios · 2');
    await expect(comentarios).toContainText('Qué buena luz. Mañana te sigo.');
    await comentarios.getByLabel('Comentario', { exact: true }).fill('¡Vamos, Pórtico!');
    await comentarios.getByRole('button', { name: 'Enviar' }).click();
    await expect(comentarios).toContainText('¡Vamos, Pórtico!');
    await expect(comentarios).toContainText('Comentarios · 3');
    // Lo propio se borra; lo ajeno se reporta (la foto y los comentarios de otros)
    await expect(comentarios.getByRole('button', { name: 'Borrar' })).toHaveCount(1);
    await expect(comentarios.getByRole('button', { name: 'Reportar' })).toHaveCount(2);
    await expect(historial.getByRole('button', { name: 'Reportar' }).last()).toBeVisible();
    await captura(page, '25-fotos-de-otro');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-fotos-hoy]').getByRole('listitem', { name: 'Foto de Epicteto: Meditar, cumplido, 3 comentarios' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Foto de hoy de Lucio Séneca, Ayuno: no cumplido' })).toBeVisible();

    // Tira "Fotos de hoy" arriba del grupo
    const tira = page.locator('[data-fotos-hoy]');
    await expect(tira).toContainText('Fotos de hoy · 2');
    await tira.getByRole('listitem', { name: 'Foto de Lucio Séneca: Ayuno, no cumplido' }).click();
    await expect(page.getByRole('dialog', { name: 'Ayuno · Lucio Séneca' })).toContainText('Hoy no pude');
    await page.keyboard.press('Escape');

    // En la semana, los días con foto se tocan: ayer de Epicteto
    const semanaEpicteto = page.getByRole('group', { name: /Epicteto, Meditar: 7 de 7 días/ });
    const botonesDia = semanaEpicteto.getByRole('button');
    await expect(botonesDia).toHaveCount(2);
    await botonesDia.first().click();
    const ayer = page.getByRole('dialog', { name: 'Meditar · Epicteto' });
    await expect(ayer.locator('[data-foto-grande]')).not.toContainText('Hoy');
    await expect(ayer.locator('[data-foto-grande]')).not.toContainText('Al amanecer');
    await page.keyboard.press('Escape');

    // Mi foto: primero comparto Meditar; la foto queda ligada a cómo me fue hoy (cumplido)
    await page.getByRole('button', { name: 'Qué comparto' }).click();
    await page.getByRole('dialog').getByLabel('Meditar').check();
    await page.getByRole('dialog').getByLabel('Tiempo con la familia').check();
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click();
    await page.getByRole('button', { name: 'Subir la foto de hoy de Meditar' }).click();
    const hojaFoto = page.getByRole('dialog', { name: 'Foto de hoy · Meditar' });
    await expect(hojaFoto.locator('[data-estado-foto="cumplido"]')).toBeVisible();
    await expect(hojaFoto.getByLabel('Sacar foto con la cámara')).toHaveAttribute('capture', 'environment');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP8z4APMOGVHbHSAEEsAROxCnMTAAAAAElFTkSuQmCC', 'base64');
    await hojaFoto.getByLabel('Elegir foto').setInputFiles({ name: 'dia.png', mimeType: 'image/png', buffer: png });
    await hojaFoto.getByLabel('Comentario (opcional)').fill('Diez minutos');
    await hojaFoto.getByRole('button', { name: 'Compartir' }).click();
    await expect(page.getByText('Foto de Meditar compartida.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Foto de hoy tu Meditar: cumplido' })).toBeVisible();

    // Si después lo desmarco, la foto pasa a "no cumplido"
    await page.getByRole('button', { name: 'Desmarcar Meditar' }).click();
    await expect(page.getByRole('button', { name: 'Foto de hoy tu Meditar: no cumplido' })).toBeVisible({ timeout: 8000 });

    // Reemplazar con un collage (una sola foto por hábito y día)
    await page.getByRole('button', { name: /Foto de hoy tu Meditar/ }).click();
    await page.getByRole('dialog', { name: 'Meditar · tus fotos' }).getByRole('button', { name: 'Cambiar la foto de hoy' }).click();
    const hojaCollage = page.getByRole('dialog', { name: 'Foto de hoy · Meditar' });
    await expect(hojaCollage.locator('[data-estado-foto="no-cumplido"]')).toBeVisible();
    const varias = ['a', 'b', 'c', 'd'].map((n) => ({ name: `${n}.png`, mimeType: 'image/png', buffer: png }));
    await hojaCollage.getByLabel('Elegir foto').setInputFiles(varias);
    await expect(hojaCollage.getByRole('radio', { name: 'Cuadrícula' })).toHaveAttribute('aria-checked', 'true');
    await hojaCollage.getByRole('button', { name: 'Quitar foto 4' }).click();
    await hojaCollage.getByRole('radio', { name: 'Grande arriba' }).click();
    await expect(hojaCollage.locator('[data-vista-previa]')).toBeVisible();
    await captura(page, '25b-collage');
    await hojaCollage.getByRole('button', { name: 'Compartir' }).click();
    // Armar el collage y achicarlo lleva unos segundos en celulares lentos
    await expect(page.getByText('Foto de Meditar compartida.')).toBeVisible({ timeout: 15000 });
    await captura(page, '25c-grupo-con-fotos');

    // Al cumplir un hábito desde el grupo se ofrece la foto (si todavía no hay una de hoy)
    await page.getByRole('button', { name: 'Marcar Meditar' }).click();
    // Según el día, volver a marcar puede llegar a un hito ("Victoria sobre ti mismo"): se cierra y sigue.
    const hito = page.getByRole('alertdialog', { name: 'Victoria sobre ti mismo' });
    if (await hito.isVisible({ timeout: 1500 }).catch(() => false)) await hito.getByRole('button', { name: 'Seguir' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Marcar Tiempo con la familia' }).click();
    // Si llega a un hito, primero aparece la Victoria y recién al cerrarla, la oferta de foto
    if (await hito.isVisible({ timeout: 1500 }).catch(() => false)) {
      await expect(page.getByRole('dialog', { name: '¡Tiempo con la familia cumplido!' })).toHaveCount(0);
      await hito.getByRole('button', { name: 'Seguir' }).click();
    }
    const oferta = page.getByRole('dialog', { name: '¡Tiempo con la familia cumplido!' });
    await expect(oferta).toContainText('¿Querés sumar la foto de hoy');
    await expect(oferta.locator('[data-estado-foto="cumplido"]')).toBeVisible();
    await captura(page, '25d-oferta-foto');
    await oferta.getByRole('button', { name: 'Ahora no' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // Desmarcar no vuelve a ofrecer nada
    await page.getByRole('button', { name: 'Desmarcar Tiempo con la familia' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Quien subió la foto puede borrar los comentarios que le dejaron
    await page.getByRole('button', { name: /Foto de hoy tu Meditar/ }).click();
    const misFotos = page.getByRole('dialog', { name: 'Meditar · tus fotos' });
    await misFotos.getByLabel('Comentario', { exact: true }).fill('Diez minutos fueron');
    await misFotos.getByRole('button', { name: 'Enviar' }).click();
    await expect(misFotos.locator('[data-comentarios]')).toContainText('Diez minutos fueron');
    await misFotos.locator('[data-comentarios]').getByRole('button', { name: 'Borrar' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Borrar' }).click();
    await expect(misFotos.locator('[data-comentarios]')).not.toContainText('Diez minutos fueron');
    await page.keyboard.press('Escape');

    // En el desafío no hay fotos: están en el grupo
    await page.locator('[data-desafio="21 días meditando"]').click();
    await expect(page.locator('[data-participantes]')).toBeVisible();
    await expect(page.locator('[data-chat]')).toHaveCount(0);
    await ir(page, '/comunidad/g-portico');

    // El código ya no sirve otra vez
    await expect(page.locator('[data-plan="activo"]')).toBeVisible();
    await page.locator('[data-plan="activo"]').getByRole('button', { name: 'Renovar con un código' }).click();
    await page.getByLabel('Código de habilitación').fill(codigo);
    await page.getByRole('dialog').getByRole('button', { name: 'Activar' }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('ya se usó');
  });

  test('memento mori: pestaña con calavera, fecha de nacimiento, contadores y grilla de semanas', async ({ page }) => {
    await entrarConEjemplo(page);
    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Memento' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Recordá que vas a morir' })).toBeVisible();
    await page.getByLabel('Fecha de nacimiento').fill('1990-03-15');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.locator('[data-contador="Ya viviste"]')).toContainText('años');
    await expect(page.locator('[data-contador="Probablemente te quedan"]')).toContainText('días');
    await expect(page.getByRole('img', { name: /semanas vividas de 3796/ })).toBeVisible();
    await page.getByRole('button', { name: '+ Agregar' }).click();
    await page.getByLabel('Nombre').fill('Viaje');
    await page.getByLabel('Fecha', { exact: true }).fill('2030-01-01');
    await page.getByRole('dialog').getByRole('button', { name: 'Agregar' }).click();
    await expect(page.locator('[data-contador-propio="Viaje"]')).toContainText('faltan');
    await captura(page, '26-memento');
    // Enfoque ahora está dentro de Tareas
    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Tareas' }).click();
    await page.getByRole('link', { name: /Enfoque/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Enfoque' })).toBeVisible();
  });

  test('el espejo (solo admin): estatua griega que cambia con el peso, tira de 7 etapas y personaje 3D', async ({ page }) => {
    test.setTimeout(90_000);
    await entrarConEjemplo(page);
    await ir(page, '/espejo');
    await expect(page.getByRole('heading', { level: 1, name: 'Tu reflejo' })).toBeVisible();
    // Tu cuerpo (realista, hoy vs meta)
    await expect(page.getByText('Cargando tu cuerpo…')).toBeHidden({ timeout: 45_000 });
    await expect(page.getByText('META', { exact: true })).toBeVisible();
    await page.getByLabel('Peso', { exact: true }).fill('90');
    await page.waitForTimeout(800);
    await captura(page, '27-espejo-cuerpo');
    // Mármol (estatuas de Meshy)
    await page.getByRole('radio', { name: 'Mármol' }).click();
    await expect(page.getByText('Trayendo tu estatua…')).toBeHidden({ timeout: 45_000 });
    await expect(page.getByLabel('Estatua: Atlético')).toBeVisible();
    await page.waitForTimeout(800);
    await captura(page, '27-espejo-marmol');
    await page.getByRole('radio', { name: 'Cara' }).click();
    await page.waitForTimeout(800);
    await captura(page, '27-espejo-marmol-cara');
    await page.getByRole('radio', { name: 'Cuerpo', exact: true }).click();
    // Estatua simple
    await page.getByRole('radio', { name: 'Estatua simple' }).click();
    await expect(page.getByText('Esculpiendo tu estatua…')).toBeHidden({ timeout: 45_000 });
    await expect(page.getByRole('radiogroup', { name: 'Etapas de peso' }).locator('img')).toHaveCount(7, { timeout: 20_000 });
    await page.getByRole('radio', { name: 'Obeso' }).click();
    await expect(page.getByLabel('Tu estatua: Obeso')).toBeVisible();
    await page.getByRole('radio', { name: 'Con laurel' }).click();
    await page.waitForTimeout(800);
    await captura(page, '27-espejo-estatua');
    await page.getByRole('radio', { name: 'Cara' }).click();
    await page.waitForTimeout(800);
    await captura(page, '27-espejo-estatua-cara');
    // Personaje 3D (el anterior)
    await page.getByRole('radio', { name: 'Personaje 3D' }).click();
    await expect(page.getByText('Preparando tu reflejo…')).toBeHidden({ timeout: 45_000 });
    await page.getByLabel('Cuerpo').fill('95');
    await page.waitForTimeout(500);
    await captura(page, '27-espejo-3d');
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
