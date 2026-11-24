/**
 * Sello de StoaHabit en las fotos del grupo (v2.8.0, pedido del dueño): abajo de la foto va una franja oscura
 * con el emblema, "StoaHabit", el hábito cumplido, la racha, la fecha y la dirección de la app.
 * Así, si alguien comparte la foto fuera del grupo, se sabe de dónde salió.
 * Los colores son los del ícono de la familia (COLORES_ICONO): son parte del dibujo, no de la interfaz.
 */
import { COLORES_ICONO, FIGURAS, svgEmblemaSolo } from '../../familia/emblema.mjs';
import { fechaLargaDeClave } from '@core/fechas';
import { aRomano } from '@core/romanos';
import { DIRECCION } from '@/ui/AvisoMudanza';

export interface DatosSello {
  habito: string;
  racha: number;
  cumplido: boolean;
  dia: string;
}

const ORO = COLORES_ICONO.laurel;
const MARFIL = COLORES_ICONO.figura;
const NEGRO = COLORES_ICONO.fondo;

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => mal(new Error('No se pudo dibujar el emblema.'));
    img.src = src;
  });
}

async function fuentes() {
  try {
    // Como mucho 1,5 s: sin conexión no se espera a las letras
    await Promise.race([
      Promise.all([document.fonts.load('600 40px Cinzel'), document.fonts.load('600 40px "Playfair Display"'), document.fonts.load('600 20px Inter')]),
      new Promise((ok) => setTimeout(ok, 1500)),
    ]);
  } catch {
    /* si no cargan, se usan las de respaldo */
  }
}

/** Texto que entra en `ancho`: lo corta con "…" si hace falta. */
function ajustar(ctx: CanvasRenderingContext2D, texto: string, ancho: number): string {
  if (ctx.measureText(texto).width <= ancho) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > ancho) t = t.slice(0, -1);
  return `${t}…`;
}

/** Devuelve la foto (o collage) con el sello de StoaHabit abajo. `lado` = lado mayor de la foto final. */
export async function sellarFoto(archivo: Blob, d: DatosSello, lado = 1080): Promise<Blob> {
  await fuentes();
  const bmp = await createImageBitmap(archivo, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const escala = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  const ancho = Math.round(bmp.width * escala);
  const altoFoto = Math.round(bmp.height * escala);
  // La franja mide lo mismo en proporción al ancho, para que se lea igual en fotos verticales y apaisadas
  const u = ancho / 1080;
  const franja = Math.round(196 * u);
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = altoFoto + franja;
  const ctx = lienzo.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0, ancho, altoFoto);
  bmp.close?.();

  // Franja negra con un filo de oro arriba
  ctx.fillStyle = NEGRO;
  ctx.fillRect(0, altoFoto, ancho, franja);
  ctx.fillStyle = ORO;
  ctx.fillRect(0, altoFoto, ancho, Math.max(2, Math.round(4 * u)));

  const margen = Math.round(44 * u);
  const emb = Math.round(118 * u);
  const svg = svgEmblemaSolo(FIGURAS.check, 512);
  const img = await cargarImagen(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  const embAlto = Math.round((emb * img.height) / img.width) || emb;
  const centroY = altoFoto + franja / 2;
  ctx.drawImage(img, margen, Math.round(centroY - embAlto / 2), emb, embAlto);

  // Columna izquierda: StoaHabit + hábito + fecha
  const x = margen + emb + Math.round(26 * u);
  const derecha = ancho - margen;
  const anchoRacha = d.racha > 0 ? Math.round(200 * u) : 0;
  const anchoTexto = derecha - x - anchoRacha - Math.round(16 * u);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = ORO;
  ctx.font = `600 ${Math.round(34 * u)}px Cinzel, Georgia, serif`;
  ctx.fillText('StoaHabit', x, altoFoto + Math.round(62 * u));
  ctx.fillStyle = MARFIL;
  ctx.font = `600 ${Math.round(46 * u)}px "Playfair Display", Georgia, serif`;
  ctx.fillText(ajustar(ctx, `${d.cumplido ? '✓ ' : ''}${d.habito}`, anchoTexto), x, altoFoto + Math.round(120 * u));
  ctx.fillStyle = ORO;
  ctx.globalAlpha = 0.85;
  ctx.font = `600 ${Math.round(24 * u)}px Inter, Arial, sans-serif`;
  const pie = `${fechaLargaDeClave(d.dia)} · ${DIRECCION.replace('https://', '')}`;
  ctx.fillText(ajustar(ctx, pie, anchoTexto), x, altoFoto + Math.round(162 * u));
  ctx.globalAlpha = 1;

  // Derecha: la racha en grande (números romanos, como en la app)
  if (d.racha > 0) {
    ctx.textAlign = 'right';
    ctx.fillStyle = ORO;
    const romano = d.racha <= 3999 ? aRomano(d.racha) : String(d.racha);
    ctx.font = `600 ${Math.round((romano.length > 6 ? 48 : 64) * u)}px "Playfair Display", Georgia, serif`;
    ctx.fillText(ajustar(ctx, romano, anchoRacha), derecha, altoFoto + Math.round(108 * u));
    ctx.fillStyle = MARFIL;
    ctx.globalAlpha = 0.8;
    ctx.font = `700 ${Math.round(22 * u)}px Inter, Arial, sans-serif`;
    ctx.fillText(`RACHA · ${d.racha} ${d.racha === 1 ? 'DÍA' : 'DÍAS'}`, derecha, altoFoto + Math.round(150 * u));
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  return new Promise((ok, mal) => lienzo.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo sellar la foto.'))), 'image/jpeg', 0.92));
}
