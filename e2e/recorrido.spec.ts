import { expect, test, type Page } from '@playwright/test';

const captura = (page: Page, nombre: string) =>
  page.screenshot({ path: `e2e/capturas/${test.info().project.name}-${nombre}.png`, fullPage: true });

test.describe('v0.1 · base', () => {
  test('pantalla de acceso', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'STOICA' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeVisible();
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
    await page.getByLabel('Correo').fill('epicteto@ejemplo.com');
    await page.getByLabel('Contraseña').fill('123');
    await page.locator('form').getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByRole('alert')).toContainText('al menos 6');
    await page.getByLabel('Contraseña').fill('nicopolis');
    await page.locator('form').getByRole('button', { name: 'Crear cuenta' }).click();

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Epicteto');
    await expect(page.getByText(/Memento mori · \d+ días/)).toBeVisible();
    await captura(page, '03-hoy-claro');

    for (const [seccion, titulo] of [['Hábitos', 'Hábitos'], ['Tareas', 'Tareas'], ['Enfoque', 'Enfoque'], ['Examen', 'Examen']] as const) {
      await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: seccion }).click();
      await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible();
    }
    await captura(page, '04-examen');

    if (test.info().project.name === 'celular') await page.getByRole('link', { name: 'Hoy' }).click(), await page.getByRole('link', { name: 'Perfil' }).first().click();
    else await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: /Epicteto/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Perfil' })).toBeVisible();
    await captura(page, '05-perfil-claro');

    await page.getByRole('radio', { name: 'Oscuro' }).click();
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

    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Hoy' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Epicteto');
    await expect(page.getByText(/Memento mori · \d+ días/)).toHaveCount(0);
    await captura(page, '08-hoy-oscuro');

    if (test.info().project.name === 'celular') await page.getByRole('link', { name: 'Perfil' }).first().click();
    else await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: /Epicteto/ }).click();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page.getByRole('heading', { name: 'STOICA' })).toBeVisible();
  });

  test('entrar con la cuenta de ejemplo y con Google simulado', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Correo').fill('prueba@stoica.app');
    await page.getByLabel('Contraseña').fill('stoica');
    await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Marco');
    await page.goto('/');
    await page.getByRole('button', { name: 'Continuar con Google' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Lucio');
  });

  test('sin conexión antes de entrar', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'STOICA' })).toBeVisible();
    await context.setOffline(true);
    await expect(page.getByRole('heading', { name: 'Sin conexión' })).toBeVisible();
    await captura(page, '09-sin-conexion');
    await context.setOffline(false);
  });
});
