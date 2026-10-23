import type { CambiosPerfil, Perfil } from '@core/perfil';

export interface UsuarioSesion {
  uid: string;
  correo: string;
  nombre: string;
  proveedor: 'password' | 'google' | 'prueba';
}

export type Cancelar = () => void;

/**
 * Capa de datos. La app habla solo con esta interfaz; abajo hay dos "drivers":
 * Firebase (real) y memoria (modo prueba, sin internet ni cuentas reales).
 */
export interface Driver {
  readonly nombre: 'firebase' | 'memoria';
  observarSesion(cb: (u: UsuarioSesion | null) => void): Cancelar;
  entrar(correo: string, contrasena: string): Promise<void>;
  registrar(nombre: string, correo: string, contrasena: string): Promise<void>;
  entrarConGoogle(): Promise<void>;
  recuperarContrasena(correo: string): Promise<void>;
  salir(): Promise<void>;
  observarPerfil(uid: string, cb: (p: Perfil | null) => void, alFallar: (e: unknown) => void): Cancelar;
  crearPerfil(uid: string, perfil: Perfil): Promise<void>;
  actualizarPerfil(uid: string, cambios: CambiosPerfil): Promise<void>;
  registrarAcceso(uid: string, plataforma: string): Promise<void>;
}

/** Error con un mensaje listo para mostrar en español. */
export class ErrorStoica extends Error {
  constructor(public readonly mensaje: string, public readonly codigo = 'desconocido') {
    super(mensaje);
  }
}

export function mensajeDeError(e: unknown): string {
  if (e instanceof ErrorStoica) return e.mensaje;
  return 'Algo salió mal. Probá de nuevo en un momento.';
}
