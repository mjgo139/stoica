/**
 * Plan con fotos y chat de los desafíos (pago por grupo).
 * Las fotos se reducen en el celular antes de subirlas: así pesan ~150 KB, viajan rápido,
 * casi no cuestan y pierden los datos ocultos de la cámara (como la ubicación).
 */
import { DIAS_GRACIA_DEFECTO, FOTO_LADO, FOTO_MAX_BYTES, MINI_LADO, MINI_MAX_BYTES, validarMensaje, diasGraciaValidos, type ConfigPlan } from '@core/plan';
import { celdasCollage, recorteCubrir, type DisenoCollage } from '@core/collage';
import { limpiarNombre } from '@core/validaciones';
import { obtenerDriver } from '@/data';
import { useDocumento } from '@/data/hooks';
import { mensajeDeError } from '@/data/tipos';
import { useSesion } from './sesion';
import { hoyActual, uidActual } from './datos';

/** Días de espera antes del borrado definitivo (los define el admin). */
export function useDiasGracia(): number {
  const { datos } = useDocumento<ConfigPlan>('config/plan');
  return datos ? diasGraciaValidos(datos.diasGracia) : DIAS_GRACIA_DEFECTO;
}

/** Devuelve un mensaje de error, o null si salió bien. */
export async function canjearCodigo(grupoId: string, codigo: string): Promise<{ hasta: number } | { error: string }> {
  try {
    const r = await (await obtenerDriver()).llamar<{ hasta: number }>('canjearCodigo', { grupoId, codigo });
    return { hasta: r.hasta };
  } catch (e) {
    return { error: mensajeDeError(e) };
  }
}

/** Chat del grupo (con el plan activo). Devuelve un mensaje de error, o null si salió bien. */
export async function enviarMensaje(grupoId: string, texto: string): Promise<string | null> {
  const err = validarMensaje(texto);
  if (err) return err;
  const uid = uidActual();
  try {
    const d = await obtenerDriver();
    const ahora = Date.now();
    await d.guardar(`groups/${grupoId}/mensajes/${d.nuevoId()}`, {
      de: uid,
      nombre: (useSesion.getState().perfil?.nombre ?? '').slice(0, 40),
      texto: limpiarNombre(texto),
      dia: hoyActual(),
      creado: ahora,
      actualizado: ahora,
      actualizadoPor: uid,
    });
    return null;
  } catch (e) {
    return mensajeDeError(e);
  }
}

export type ColeccionPlan = 'fotos' | 'mensajes';

export async function borrarPublicacion(grupoId: string, coleccion: ColeccionPlan, id: string): Promise<string | null> {
  try {
    await (await obtenerDriver()).borrar(`groups/${grupoId}/${coleccion}/${id}`);
    return null;
  } catch (e) {
    return mensajeDeError(e);
  }
}

export async function reportarPublicacion(grupoId: string, coleccion: ColeccionPlan, publicacionId: string, motivo: string): Promise<string | null> {
  try {
    await (await obtenerDriver()).llamar('reportarPublicacion', { grupoId, coleccion, publicacionId, motivo });
    return null;
  } catch (e) {
    return mensajeDeError(e);
  }
}

/** Reduce una imagen a JPEG (lado mayor = `lado`) bajando la calidad hasta que pese menos de `max`. */
export async function reducirImagen(archivo: Blob, lado: number, max: number): Promise<string> {
  const bmp = await createImageBitmap(archivo, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const escala = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(bmp.width * escala);
  lienzo.height = Math.round(bmp.height * escala);
  lienzo.getContext('2d')!.drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
  bmp.close?.();
  for (const calidad of [0.82, 0.72, 0.6, 0.5, 0.4]) {
    const url = lienzo.toDataURL('image/jpeg', calidad);
    const base64 = url.slice(url.indexOf(',') + 1);
    if (base64.length * 0.75 <= max) return base64;
  }
  throw new Error('La foto es demasiado pesada.');
}

/** Foto de hoy de un hábito compartido en el grupo. */
export async function subirFoto(grupoId: string, habitId: string, archivo: Blob, texto: string): Promise<string | null> {
  if (!archivo.type.startsWith('image/')) return 'Elegí una imagen.';
  try {
    const [foto, mini] = await Promise.all([reducirImagen(archivo, FOTO_LADO, FOTO_MAX_BYTES), reducirImagen(archivo, MINI_LADO, MINI_MAX_BYTES)]);
    await (await obtenerDriver()).llamar('subirFotoGrupo', { grupoId, habitId, foto, mini, texto: limpiarNombre(texto) });
    return null;
  } catch (e) {
    return e instanceof Error && e.message === 'La foto es demasiado pesada.' ? e.message : mensajeDeError(e);
  }
}

/**
 * Junta 2 a 4 fotos en un cuadrado (se sube como una sola foto: mismo costo que una).
 * Cada foto se recorta al centro para llenar su lugar, sin deformarse.
 */
export async function armarCollage(fotos: Blob[], diseno: DisenoCollage, lado = FOTO_LADO): Promise<Blob> {
  const lienzo = document.createElement('canvas');
  lienzo.width = lado;
  lienzo.height = lado;
  const ctx = lienzo.getContext('2d')!;
  ctx.fillStyle = '#f6f1e7';
  ctx.fillRect(0, 0, lado, lado);
  const celdas = celdasCollage(fotos.length, diseno, lado, Math.round(lado / 135));
  for (let i = 0; i < celdas.length; i++) {
    const bmp = await createImageBitmap(fotos[i], { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const c = celdas[i];
    const r = recorteCubrir(bmp.width, bmp.height, c);
    ctx.drawImage(bmp, r.sx, r.sy, r.sAncho, r.sAlto, c.x, c.y, c.ancho, c.alto);
    bmp.close?.();
  }
  return new Promise((ok, mal) => lienzo.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo armar el collage.'))), 'image/jpeg', 0.9));
}
