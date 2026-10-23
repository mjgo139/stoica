import { ErrorStoica } from './tipos';

const MENSAJES: Record<string, string> = {
  'auth/invalid-credential': 'El correo o la contraseña no coinciden.',
  'auth/wrong-password': 'El correo o la contraseña no coinciden.',
  'auth/user-not-found': 'El correo o la contraseña no coinciden.',
  'auth/invalid-email': 'Ese correo no parece válido.',
  'auth/email-already-in-use': 'Ya hay una cuenta con ese correo. Probá entrar.',
  'auth/weak-password': 'La contraseña necesita al menos 6 caracteres.',
  'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos y probá de nuevo.',
  'auth/network-request-failed': 'No hay conexión. Revisá tu internet.',
  'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar.',
  'auth/cancelled-popup-request': 'Cerraste la ventana de Google antes de terminar.',
  'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Permití las ventanas emergentes y probá de nuevo.',
  'auth/account-exists-with-different-credential': 'Ese correo ya entra con otro método. Probá con correo y contraseña.',
  'auth/user-disabled': 'Esta cuenta está suspendida.',
  'auth/operation-not-allowed': 'Ese método de acceso no está habilitado.',
  'permission-denied': 'No se pudo guardar: no tenés permiso. Si te pasa con todo, tu cuenta puede estar limitada; avisá al administrador.',
  unavailable: 'No hay conexión. Los cambios se guardan y se envían cuando vuelva.',
};

export function traducirError(e: unknown): ErrorStoica {
  if (e instanceof ErrorStoica) return e;
  const codigo = typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : 'desconocido';
  return new ErrorStoica(MENSAJES[codigo] ?? 'Algo salió mal. Probá de nuevo en un momento.', codigo);
}
