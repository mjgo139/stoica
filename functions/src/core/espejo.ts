/**
 * El Espejo v2 (imágenes): instrucciones para la IA de imágenes y etapas de evolución.
 * Sin dependencias de Firebase, para poder probarlo.
 */
export const ETAPAS = ['aflojando', 'hoy', 'mejorando', 'meta'] as const;
export type Etapa = (typeof ETAPAS)[number];
export const ETAPAS_GENERADAS: Etapa[] = ['aflojando', 'mejorando', 'meta'];
/** Imágenes por mes por persona (prueba: generoso; después se ajusta al plan). */
export const MAX_IMAGENES_MES = 20;
export const FOTO_REFLEJO_MAX_BYTES = 1_500_000;

export const ROPA: Record<string, string> = {
  blanco: 'white',
  negro: 'black',
  rojo: 'red',
  azul: 'navy blue',
  verde: 'forest green',
  dorado: 'mustard yellow',
  violeta: 'purple',
  gris: 'heather gray',
  jean: 'denim blue',
};

export interface PedidoLamina {
  descripcion: string;
  remera: string;
  pantalon: string;
  conFoto: boolean;
}

const ESTILO =
  'Stylized 3D animated character, like a modern animated feature film: soft studio lighting, clean shading, friendly and dignified. ' +
  'Character turnaround sheet with exactly three full-body views side by side, evenly spaced and at the same scale, feet visible, on a plain soft light-gray background: ' +
  'left third = front view, middle third = left side profile, right third = back view. Relaxed neutral standing pose, arms down. ' +
  'No text, no labels, no logos, no extra characters.';

/** Primera lámina: a partir de la selfie (si hay) y lo que la persona cuenta de sí. */
export function promptLamina(p: PedidoLamina): string {
  const ropa = `Outfit: a ${ROPA[p.remera] ?? 'white'} t-shirt, ${ROPA[p.pantalon] ?? 'denim blue'} long casual trousers and white sneakers. Modest everyday clothing.`;
  const persona = p.conFoto
    ? 'The character must clearly be the person in the reference photo: keep their face shape, facial features, skin tone, hairstyle, hair color, facial hair and glasses (if any). ' +
      'Keep their real body shape and weight as it appears or is described — do NOT slim, idealize or beautify the body.'
    : 'Create the character from this description, keeping the described body shape and weight faithfully — do NOT slim or idealize.';
  const extra = p.descripcion.trim() ? ` About the person: ${p.descripcion.trim()}.` : '';
  return `${ESTILO} ${persona}${extra} ${ropa}`;
}

const MISMO =
  'Edit this character turnaround sheet. Keep EXACTLY the same person (same face, hairstyle, skin tone, glasses), the same outfit, the same art style, background and the same three-view layout (front, side, back). Only change what is described: ';

/** Cada etapa se edita a partir de la lámina de hoy (así sigue siendo la misma persona). */
export function promptEtapa(e: Etapa): string {
  switch (e) {
    case 'aflojando':
      return MISMO + 'show the same person after several weeks of neglecting their habits: about 8 kg heavier, slouched posture, tired eyes with dark circles, slightly duller skin. Respectful and realistic, not a caricature.';
    case 'mejorando':
      return MISMO + 'show the same person after two months of good habits: about 5 kg lighter, a bit more toned, more upright posture, more energy in the face.';
    case 'meta':
      return MISMO + 'show the same person after a year of consistent exercise and healthy eating: clearly fitter and leaner, healthy athletic build realistic for them (not a bodybuilder), confident upright posture, bright healthy face.';
    default:
      return '';
  }
}

/** Qué etapa mostrar según el cumplimiento de los últimos 30 días (0 a 1). */
export function etapaPorCumplimiento(porcentaje: number): Etapa {
  if (porcentaje < 0.35) return 'aflojando';
  if (porcentaje < 0.65) return 'hoy';
  if (porcentaje < 0.85) return 'mejorando';
  return 'meta';
}
