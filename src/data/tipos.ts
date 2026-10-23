import type { CambiosPerfil, Perfil } from '@core/perfil';

export interface UsuarioSesion {
  uid: string;
  correo: string;
  nombre: string;
  proveedor: 'password' | 'google' | 'prueba';
}

export type Cancelar = () => void;

export type Operador = '==' | '>=' | '<=' | 'array-contains';
export type Filtro = [campo: string, op: Operador, valor: unknown];

/** Consulta a una colección (ruta tipo "users/abc/habits"). */
export interface Consulta {
  ruta: string;
  filtros?: Filtro[];
  orden?: [campo: string, direccion: 'asc' | 'desc'];
  limite?: number;
}

export type ConId<T> = T & { id: string };

export type NombreFuncion =
  | 'crearGrupo'
  | 'unirseAGrupo'
  | 'salirDeGrupo'
  | 'eliminarGrupo'
  | 'borrarMiCuenta'
  | 'adminSuspender'
  | 'adminBorrarCuenta'
  | 'adminCalcularMetricas'
  | 'adminDesbloquear'
  | 'asignarRol';

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

  // ---------- Datos genéricos ----------
  nuevoId(): string;
  observarDoc<T>(ruta: string, cb: (d: ConId<T> | null) => void, alFallar: (e: unknown) => void): Cancelar;
  /** `desdeServidor` es false cuando la respuesta vino solo de la caché del dispositivo (por ejemplo, sin conexión). */
  observarLista<T>(c: Consulta, cb: (docs: Array<ConId<T>>, info: { desdeServidor: boolean }) => void, alFallar: (e: unknown) => void): Cancelar;
  leerLista<T>(c: Consulta): Promise<Array<ConId<T>>>;
  /** Lo que ya está guardado en este dispositivo (sin ir al servidor, sin costo de lectura). */
  leerListaLocal<T>(c: Consulta): Promise<Array<ConId<T>>>;
  /** Crea o reemplaza (o combina con merge) el documento. No espera al servidor si no hay conexión. */
  guardar(ruta: string, datos: Record<string, unknown>, opciones?: { combinar?: boolean }): Promise<void>;
  borrar(ruta: string): Promise<void>;
  llamar<T = unknown>(nombre: NombreFuncion, datos?: Record<string, unknown>): Promise<T>;
  /** Pide un token nuevo (para que el rol de admin se vea enseguida). */
  refrescarToken(): Promise<void>;
  /** Notificaciones push: devuelve el token del dispositivo o un motivo por el que no se pudo. */
  activarNotificaciones(): Promise<{ token: string } | { error: string }>;
  desactivarNotificaciones(): Promise<void>;
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
