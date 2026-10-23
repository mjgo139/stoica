/** Límites compartidos entre la web, las funciones y las reglas de Firestore. */
export const LIMITES = {
  nombreMin: 1,
  nombreMax: 40,
  contrasenaMin: 6,
  correoMax: 254,
} as const;

export const TEMAS = ['claro', 'oscuro', 'sistema'] as const;
export type Tema = (typeof TEMAS)[number];

export const ROLES = ['usuario', 'admin'] as const;
export type Rol = (typeof ROLES)[number];

export type Resultado = { ok: true } | { ok: false; error: string };

const ok: Resultado = { ok: true };
const mal = (error: string): Resultado => ({ ok: false, error });

export function limpiarNombre(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export function validarNombre(s: string): Resultado {
  const n = limpiarNombre(s);
  if (n.length < LIMITES.nombreMin) return mal('Escribí tu nombre.');
  if (n.length > LIMITES.nombreMax) return mal(`El nombre puede tener hasta ${LIMITES.nombreMax} letras.`);
  return ok;
}

export function validarCorreo(s: string): Resultado {
  const c = s.trim();
  if (!c) return mal('Escribí tu correo.');
  if (c.length > LIMITES.correoMax || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c)) return mal('Ese correo no parece válido.');
  return ok;
}

export function validarContrasena(s: string): Resultado {
  if (s.length < LIMITES.contrasenaMin) return mal(`La contraseña necesita al menos ${LIMITES.contrasenaMin} caracteres.`);
  return ok;
}

export function esTema(s: unknown): s is Tema {
  return typeof s === 'string' && (TEMAS as readonly string[]).includes(s);
}
