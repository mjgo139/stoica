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
  /** Rasgos leídos de la selfie (barba, pelo, lentes, contextura…), en inglés para la IA de imágenes. */
  rasgos?: string;
}

/** Pedido a la IA de texto para que describa la selfie antes de dibujar (así no se olvida la barba). */
export const PROMPT_RASGOS =
  'Describe the person in this photo for a character artist, in English, as compact JSON with these keys: ' +
  'sex, approxAge, skinTone, faceShape, hair (length, style, color), facialHair (none / stubble / short beard / full beard / long beard, plus mustache and color), ' +
  'glasses (none or style), eyebrows, build (thin / average / chubby / overweight / obese / athletic), belly (none / slight / noticeable / large), ' +
  'distinctiveFeatures. Be precise and honest about facial hair and body build; do not flatter.';

/** Convierte el JSON de rasgos en una frase para la imagen. */
export function rasgosEnTexto(json: unknown): string {
  if (!json || typeof json !== 'object') return '';
  const partes: string[] = [];
  const plano = (v: unknown): string => (v && typeof v === 'object' ? Object.values(v as Record<string, unknown>).map(plano).filter(Boolean).join(' ') : String(v ?? '').trim());
  for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
    const t = plano(v).slice(0, 120);
    if (t) partes.push(`${k}: ${t}`);
  }
  return partes.join('; ').slice(0, 900);
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
  const rasgos = p.rasgos ? ` MUST MATCH these traits exactly (especially facial hair, glasses, hair and body build): ${p.rasgos}.` : '';
  const extra = p.descripcion.trim() ? ` About the person: ${p.descripcion.trim()}.` : '';
  return `${ESTILO} ${persona}${rasgos}${extra} ${ropa}`;
}

const MISMO =
  'Edit this character turnaround sheet. Keep the same identity (same face, hairstyle, facial hair, skin tone, glasses), the same outfit colors, art style, background and the same three-view layout (front, side, back). ' +
  'The BODY and POSTURE MUST CHANGE CLEARLY — the difference has to be obvious at first glance when compared side by side with the original. Change: ';

/** Cada etapa se edita a partir de la lámina de hoy (así sigue siendo la misma persona). */
export function promptEtapa(e: Etapa, rasgos = ''): string {
  const id = rasgos ? ` Identity reference: ${rasgos}.` : '';
  switch (e) {
    case 'aflojando':
      return MISMO + 'the same person after months of neglecting exercise, sleep and diet: about 15 kg heavier, a big round belly that stretches the t-shirt, wider waist and thicker arms, a double chin, rounded slouched shoulders, head forward, tired eyes with dark circles, dull skin, low energy expression. Respectful and realistic, not a caricature.' + id;
    case 'mejorando':
      return MISMO + 'the same person after three months of good habits: about 7 kg lighter, visibly smaller belly and waist, slimmer face, some muscle tone in the arms, standing straighter, rested eyes, more energy and a slight confident smile.' + id;
    case 'meta':
      return MISMO + 'the same person after one year of consistent training and healthy eating: clearly lean and fit, flat stomach, defined shoulders, chest and arms (athletic, not a bodybuilder), slimmer defined jaw, tall upright confident posture, bright healthy skin, calm proud expression. The t-shirt now fits an athletic body.' + id;
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
