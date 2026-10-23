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

  it('rechaza credenciales malas y correos repetidos', async () => {
    const d = crearDriverMemoria();
    await expect(d.entrar('prueba@stoica.app', 'mal')).rejects.toBeInstanceOf(ErrorStoica);
    await expect(d.registrar('X', 'prueba@stoica.app', 'secreto1')).rejects.toThrow('Ya hay una cuenta');
    await expect(d.registrar('X', 'nuevo@stoica.app', '123')).rejects.toThrow('6 caracteres');
  });
});
