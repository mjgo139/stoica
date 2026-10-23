/**
 * Driver en memoria ("modo prueba"): todo vive en esta pestaña y se pierde al recargar.
 * Sirve para probar la app y para los recorridos automáticos, sin tocar Firebase.
 */
import type { CambiosPerfil, Perfil } from '@core/perfil';
import { validarContrasena, validarCorreo } from '@core/validaciones';
import { ErrorStoica, type Driver, type UsuarioSesion } from './tipos';

interface Cuenta {
  uid: string;
  correo: string;
  nombre: string;
  contrasena: string;
}

const espera = (ms = 120) => new Promise((r) => setTimeout(r, ms));

export function crearDriverMemoria(): Driver {
  const cuentas = new Map<string, Cuenta>();
  const perfiles = new Map<string, Perfil>();
  const accesos = new Map<string, { ultimoAcceso: number; plataforma: string }>();
  const oyentesSesion = new Set<(u: UsuarioSesion | null) => void>();
  const oyentesPerfil = new Map<string, Set<(p: Perfil | null) => void>>();
  let sesion: UsuarioSesion | null = null;
  let contador = 0;

  // Una cuenta de ejemplo para entrar rápido.
  cuentas.set('prueba@stoica.app', { uid: 'u-prueba', correo: 'prueba@stoica.app', nombre: 'Marco Aurelio', contrasena: 'stoica' });

  const emitirSesion = () => oyentesSesion.forEach((cb) => cb(sesion));
  const emitirPerfil = (uid: string) => oyentesPerfil.get(uid)?.forEach((cb) => cb(perfiles.get(uid) ?? null));
  const iniciar = (c: Cuenta, proveedor: UsuarioSesion['proveedor']) => {
    sesion = { uid: c.uid, correo: c.correo, nombre: c.nombre, proveedor };
    emitirSesion();
  };

  return {
    nombre: 'memoria',
    observarSesion(cb) {
      oyentesSesion.add(cb);
      setTimeout(() => cb(sesion), 0);
      return () => oyentesSesion.delete(cb);
    },
    async entrar(correo, contrasena) {
      await espera();
      const c = cuentas.get(correo.trim().toLowerCase());
      if (!c || c.contrasena !== contrasena) throw new ErrorStoica('El correo o la contraseña no coinciden.', 'auth/invalid-credential');
      iniciar(c, 'password');
    },
    async registrar(nombre, correo, contrasena) {
      await espera();
      const k = correo.trim().toLowerCase();
      const vc = validarCorreo(k);
      if (!vc.ok) throw new ErrorStoica(vc.error, 'auth/invalid-email');
      const vp = validarContrasena(contrasena);
      if (!vp.ok) throw new ErrorStoica(vp.error, 'auth/weak-password');
      if (cuentas.has(k)) throw new ErrorStoica('Ya hay una cuenta con ese correo. Probá entrar.', 'auth/email-already-in-use');
      const c = { uid: `u-${++contador}`, correo: k, nombre, contrasena };
      cuentas.set(k, c);
      iniciar(c, 'password');
    },
    async entrarConGoogle() {
      await espera(250);
      const k = 'google@stoica.app';
      if (!cuentas.has(k)) cuentas.set(k, { uid: 'u-google', correo: k, nombre: 'Lucio Séneca', contrasena: '' });
      iniciar(cuentas.get(k)!, 'google');
    },
    async recuperarContrasena(correo) {
      await espera();
      const v = validarCorreo(correo);
      if (!v.ok) throw new ErrorStoica(v.error, 'auth/invalid-email');
    },
    async salir() {
      await espera(60);
      sesion = null;
      emitirSesion();
    },
    observarPerfil(uid, cb) {
      if (!oyentesPerfil.has(uid)) oyentesPerfil.set(uid, new Set());
      oyentesPerfil.get(uid)!.add(cb);
      setTimeout(() => cb(perfiles.get(uid) ?? null), 0);
      return () => oyentesPerfil.get(uid)?.delete(cb);
    },
    async crearPerfil(uid, perfil) {
      await espera(60);
      if (perfiles.has(uid)) return;
      perfiles.set(uid, { ...perfil, rol: 'usuario' }); // en Firebase el rol lo pone la función alCrearUsuario
      emitirPerfil(uid);
    },
    async actualizarPerfil(uid, cambios: CambiosPerfil) {
      const p = perfiles.get(uid);
      if (!p) throw new ErrorStoica('Tu perfil todavía no está listo.', 'not-found');
      perfiles.set(uid, { ...p, ...cambios, actualizado: Date.now(), actualizadoPor: uid });
      emitirPerfil(uid);
    },
    async registrarAcceso(uid, plataforma) {
      accesos.set(uid, { ultimoAcceso: Date.now(), plataforma });
    },
  };
}
