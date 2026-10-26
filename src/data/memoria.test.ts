import { describe, expect, it } from 'vitest';
import { perfilInicial } from '@core/perfil';
import { crearDriverMemoria } from './memoria';
import { ErrorStoica, type UsuarioSesion } from './tipos';

describe('driver en memoria (modo prueba)', () => {
  it('registra, crea perfil, actualiza y sale', async () => {
    const d = crearDriverMemoria();
    const sesiones: Array<UsuarioSesion | null> = [];
    d.observarSesion((u) => sesiones.push(u));
    await d.registrar('Epicteto', 'epi@nicopolis.gr', 'secreto1');
    const u = sesiones.at(-1)!;
    expect(u.nombre).toBe('Epicteto');

    const perfiles: unknown[] = [];
    d.observarPerfil(u.uid, (p) => perfiles.push(p), () => undefined);
    await d.crearPerfil(u.uid, perfilInicial(u.uid, u.nombre, u.correo, 'America/Asuncion', Date.now()));
    await d.actualizarPerfil(u.uid, { tema: 'oscuro' });
    expect(perfiles.at(-1)).toMatchObject({ nombre: 'Epicteto', tema: 'oscuro', rol: 'usuario' });

    await d.salir();
    expect(sesiones.at(-1)).toBeNull();
  });

  it('cambia la contraseña solo con la actual correcta', async () => {
    const d = crearDriverMemoria();
    await d.registrar('Cleantes', 'cleantes@assos.gr', 'secreto1');
    await expect(d.cambiarContrasena('mala', 'nueva22')).rejects.toThrow('La contraseña actual no es correcta.');
    await expect(d.cambiarContrasena('secreto1', '123')).rejects.toBeInstanceOf(ErrorStoica);
    await d.cambiarContrasena('secreto1', 'nueva22');
    await d.salir();
    await expect(d.entrar('cleantes@assos.gr', 'secreto1')).rejects.toBeInstanceOf(ErrorStoica);
    await d.entrar('cleantes@assos.gr', 'nueva22');
  });

  it('rechaza credenciales malas y correos repetidos', async () => {
    const d = crearDriverMemoria();
    await expect(d.entrar('prueba@stoica.app', 'mal')).rejects.toBeInstanceOf(ErrorStoica);
    await expect(d.registrar('X', 'prueba@stoica.app', 'secreto1')).rejects.toThrow('Ya hay una cuenta');
    await expect(d.registrar('X', 'nuevo@stoica.app', '123')).rejects.toThrow('6 caracteres');
  });
});

describe('funciones del servidor simuladas (modo prueba)', () => {
  it('grupos: crear, unirse con código, solo el creador elimina', async () => {
    const d = crearDriverMemoria();
    await d.registrar('Ana', 'ana@x.com', 'secreto1');
    const g = await d.llamar<{ id: string; codigo: string }>('crearGrupo', { nombre: 'Pórtico' });
    await d.salir();
    await d.registrar('Beto', 'beto@x.com', 'secreto1');
    await expect(d.llamar('unirseAGrupo', { codigo: 'MALO' })).rejects.toThrow('no es válido');
    await d.llamar('unirseAGrupo', { codigo: g.codigo });
    await expect(d.llamar('eliminarGrupo', { grupoId: g.id })).rejects.toThrow('Solo quien creó');
    await expect(d.llamar('adminSuspender', { uid: 'x', suspender: true })).rejects.toThrow('Solo el admin');
  });

  it('admin suspende y la cuenta ya no entra; borrar mi cuenta borra todo', async () => {
    const d = crearDriverMemoria();
    await d.entrar('prueba@stoica.app', 'stoica'); // cuenta de ejemplo: admin
    await d.llamar('adminSuspender', { uid: 'u-zenon', suspender: true });
    await d.salir();
    await expect(d.entrar('zenon@ejemplo.com', 'stoica')).rejects.toThrow('suspendida');
    await d.entrar('epicteto@ejemplo.com', 'stoica');
    await d.llamar('borrarMiCuenta');
    await expect(d.entrar('epicteto@ejemplo.com', 'stoica')).rejects.toThrow('no coinciden');
    await d.entrar('prueba@stoica.app', 'stoica');
    const cuentas = await d.leerLista({ ruta: 'accounts' });
    expect(cuentas.some((c) => c.id === 'u-epicteto')).toBe(false);
    const grupo = await d.leerLista<{ miembros: string[] }>({ ruta: 'groups' });
    expect(grupo[0].miembros).not.toContain('u-epicteto');
  });
});
