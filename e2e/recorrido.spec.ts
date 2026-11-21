import { expect, test, type Page } from '@playwright/test';

/** Menú de la familia: barra lateral en la PC, pestañas en el celular */
const menu = (page: Page) => page.locator('aside.lateral:visible, nav.pestanas:visible');

const captura = (page: Page, nombre: string) =>
  page.screenshot({ path: `e2e/capturas/${test.info().project.name}-${nombre}.png`, fullPage: true });

test.describe('v0.1 · base', () => {
  test('pantalla de acceso', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'StoaHabit' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeVisible();
    // El contenido va encima de las vetas del fondo de la familia (contenedor #root)
    await expect(page.locator('#root')).toHaveCSS('z-index', '1');
    await page.emulateMedia({ colorScheme: 'light' });
    await captura(page, '01-acceso-claro');
    await page.emulateMedia({ colorScheme: 'dark' });
    await captura(page, '02-acceso-oscuro');
  });

  test('errores claros al entrar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar', exact: true }).last().click();
    await expect(page.getByRole('alert')).toHaveText('Escribí tu correo.');
    await page.getByLabel('Correo').fill('prueba@stoica.app');
    await page.getByLabel('Contraseña').fill('equivocada');
    await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('alert')).toHaveText('El correo o la contraseña no coinciden.');
  });

  test('crear cuenta, recorrer, cambiar tema y nombre, salir', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await page.getByRole('tab', { name: 'Crear cuenta' }).click();
    await page.getByLabel('Nombre').fill('Epicteto de Hierápolis');
    await page.getByLabel('Correo').fill('epicteto.nuevo@ejemplo.com');
    await page.getByLabel('Contraseña').fill('123');
    await page.locator('form').getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByRole('alert')).toContainText('al menos 6');
    await page.getByLabel('Contraseña').fill('nicopolis');
    await page.locator('form').getByRole('button', { name: 'Crear cuenta' }).click();

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Epicteto');
    await expect(page.getByText(/Memento mori · \d+ días/)).toBeVisible();
    await captura(page, '03-hoy-claro');

    for (const [seccion, titulo] of [['Hábitos', 'Hábitos'], ['Tareas', 'Tareas'], ['Examen', 'Examen'], ['Memento', 'Memento']] as const) {
      await menu(page).getByRole('link', { name: seccion }).click();
      await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible();
    }
    await captura(page, '04-examen');

    if (test.info().project.name === 'celular') await page.getByRole('link', { name: 'Hoy' }).click(), await page.getByRole('link', { name: 'Perfil' }).first().click();
    else await menu(page).getByRole('link', { name: /Epicteto/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Perfil' })).toBeVisible();
    await captura(page, '05-perfil-claro');

    // Temas de la familia: Noche romana (predeterminado) · Mármol · Sistema
    await page.getByRole('radio', { name: 'Mármol' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByRole('radio', { name: 'Noche romana' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('switch', { name: /Memento mori/ }).click();
    await expect(page.getByRole('switch', { name: /Memento mori/ })).toHaveAttribute('aria-checked', 'false');

    await page.getByRole('button', { name: 'Cambiar nombre' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Cambiar nombre' });
    await expect(dialogo).toBeVisible();
    await captura(page, '06-hoja-nombre');
    await dialogo.getByLabel('Nombre').fill('Epicteto');
    await dialogo.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Nombre guardado.')).toBeVisible();
    await captura(page, '07-perfil-oscuro');

    await menu(page).getByRole('link', { name: 'Hoy' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Epicteto');
    await expect(page.getByText(/Memento mori · \d+ días/)).toHaveCount(0);
    await captura(page, '08-hoy-oscuro');

    if (test.info().project.name === 'celular') await page.getByRole('link', { name: 'Perfil' }).first().click();
    else await menu(page).getByRole('link', { name: /Epicteto/ }).click();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page.getByRole('heading', { name: 'StoaHabit' })).toBeVisible();
  });

  test('entrar con la cuenta de ejemplo y con Google simulado', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Correo').fill('prueba@stoica.app');
    await page.getByLabel('Contraseña').fill('stoica');
    await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Marco');
    // Panel del día de la familia 1.5.0: frase estoica, sin rango ni nivel
    const panel = page.getByTestId('panel-dia');
    await expect(panel.getByTestId('frase-del-dia')).toBeVisible();
    await expect(panel).not.toContainText('Nivel');
    await expect(panel.getByTestId('practicas-de-hoy')).toHaveCount(0);
    await page.goto('/');
    await page.getByRole('button', { name: 'Continuar con Google' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Lucio');
  });

  test('sin conexión antes de entrar', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'StoaHabit' })).toBeVisible();
    await context.setOffline(true);
    await expect(page.getByRole('heading', { name: 'Sin conexión' })).toBeVisible();
    await captura(page, '09-sin-conexion');
    await context.setOffline(false);
  });

  test('entrar como invitado y guardar la cuenta con correo', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Continuar como invitado' }).click();
    await expect(page.getByTestId('panel-dia')).toContainText(/(Buen día|Buenas tardes|Buenas noches), Invitado/);
    if (test.info().project.name === 'celular') await page.getByRole('link', { name: 'Perfil' }).first().click();
    else await page.getByTestId('persona-lateral').click();
    await expect(page.getByTestId('tarjeta-perfil')).toContainText('Modo invitado');
    await page.getByTestId('guardar-invitado').click();
    const hoja = page.getByRole('dialog', { name: 'Guardar mi cuenta' });
    await hoja.getByLabel('Correo').fill('invitado@ejemplo.com');
    await hoja.getByLabel('Contraseña').fill('secreto123');
    await hoja.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Cuenta guardada: ya podés entrar con tu correo.')).toBeVisible();
    await expect(page.getByTestId('tarjeta-perfil')).toContainText('Entra con correo');
    await expect(page.getByTestId('tarjeta-perfil')).toContainText('invitado@ejemplo.com');
  });

  test('foto de perfil: se sube, se ve en Perfil, en el Panel del día y en la barra lateral, y se quita', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar con la cuenta de ejemplo' }).click();
    const panel = page.getByTestId('panel-dia');
    await expect(panel).toContainText('Marco');
    await expect(panel.getByTestId('foto-perfil')).toHaveCount(0);
    await panel.getByRole('link', { name: 'Perfil' }).click();
    const tarjeta = page.getByTestId('tarjeta-perfil');
    await expect(tarjeta).toContainText('Entra con correo · Admin');
    await tarjeta.getByLabel('Elegir foto de perfil').setInputFiles('public/icons/icon-512.png');
    await expect(page.getByText('Foto guardada.')).toBeVisible();
    const foto = tarjeta.getByTestId('foto-perfil');
    await expect(foto).toBeVisible();
    expect(await foto.getAttribute('src')).toMatch(/^data:image\/(webp|jpeg);base64,/);
    // 256×256 y liviana (la regla de Firestore acepta hasta 100.000 caracteres)
    expect(await foto.evaluate((i: HTMLImageElement) => [i.naturalWidth, i.naturalHeight])).toEqual([256, 256]);
    expect((await foto.getAttribute('src'))!.length).toBeLessThan(100000);
    await captura(page, '10-perfil-con-foto');
    await menu(page).getByRole('link', { name: 'Hoy' }).click();
    await expect(page.getByTestId('panel-dia').getByTestId('foto-perfil')).toBeVisible();
    if (test.info().project.name === 'escritorio') await expect(page.getByTestId('persona-lateral').getByTestId('foto-perfil')).toBeVisible();
    await captura(page, '11-inicio-con-foto');
    await page.getByTestId('panel-dia').getByRole('link', { name: 'Perfil' }).click();
    await page.getByTestId('tarjeta-perfil').getByRole('button', { name: 'Quitar foto' }).click();
    await expect(page.getByTestId('tarjeta-perfil').getByTestId('foto-perfil')).toHaveCount(0);
    await expect(page.getByTestId('tarjeta-perfil').getByRole('button', { name: 'Quitar foto' })).toHaveCount(0);
  });

  test('entrar con la cuenta de ejemplo desde el aviso de modo prueba', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar con la cuenta de ejemplo' }).click();
    await expect(page.getByTestId('panel-dia')).toContainText('Marco');
    await expect(page.getByText('Modo prueba · datos inventados')).toBeVisible();
  });
});
