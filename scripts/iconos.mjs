// Genera los íconos de StoaHabit (web y Android, también el adaptable) y la pantalla de inicio oscura,
// con la figura de la familia estoica FIGURAS.check (familia/emblema.mjs). Igual que scripts/iconos.mjs de StoaGym.
// Uso: node scripts/iconos.mjs   (necesita Chromium de Playwright)
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { COLORES_ICONO, emblema, FIGURAS, svgEmblemaSolo, svgIcono } from '../familia/emblema.mjs';

const FIGURA = FIGURAS.check;
const RES = 'android/app/src/main/res';
/** forma: 'cuadrado' (esquinas redondeadas) | 'circulo' | 'lleno' (el teléfono pone la forma) */
const svg = (forma) => svgIcono(FIGURA, { forma, titulo: 'StoaHabit' });

const navegador = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
const pagina = await navegador.newPage();
const ancho = (s, w, h = w) => s.replace('<svg ', `<svg width="${w}" height="${h}" `);

async function foto(html, w, h, ruta, fondo = 'transparent') {
  await pagina.setViewportSize({ width: w, height: h });
  await pagina.setContent(`<html><body style="margin:0;background:${fondo}">${html}</body></html>`);
  await pagina.screenshot({ path: ruta, omitBackground: fondo === 'transparent' });
}
const icono = (forma, tam, ruta) => foto(ancho(svg(forma), tam), tam, tam, ruta);

// ——— Web ———
await icono('lleno', 512, 'public/icons/icon-512.png');
await icono('lleno', 192, 'public/icons/icon-192.png');
await icono('lleno', 512, 'public/icons/maskable-512.png');
await icono('lleno', 180, 'public/icons/apple-touch-icon.png');
writeFileSync('public/icons/icono.svg', svg('cuadrado'));
// Aviso (Android, ícono grande): el emblema solo sobre transparente
await foto(`<div style="width:192px;height:192px;display:flex;align-items:center;justify-content:center">${svgEmblemaSolo(FIGURA, 176)}</div>`, 192, 192, 'public/icons/aviso-192.png');
// Insignia de la barra de avisos: silueta blanca del emblema (Android solo usa la transparencia)
// (el check queda calado: una máscara lo recorta del círculo)
const CHECK = '<g transform="translate(256 245) scale(.5)"><path d="M-54 2 L-16 40 L58 -38" fill="none" stroke="black" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/></g>';
const silueta = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="62 100 388 300" width="88" height="68"><defs><mask id="m"><rect x="0" y="0" width="512" height="512" fill="white"/>${CHECK}</mask></defs><g mask="url(#m)" style="filter:brightness(0) invert(1)">${emblema(FIGURA)}</g></svg>`;
await foto(`<div style="width:96px;height:96px;display:flex;align-items:center;justify-content:center">${silueta}</div>`, 96, 96, 'public/icons/badge-96.png');

// ——— Android: ícono común, redondo y adaptable (frente transparente sobre el color de fondo) ———
for (const [d, t, frente] of [['mdpi', 48, 108], ['hdpi', 72, 162], ['xhdpi', 96, 216], ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432]]) {
  await icono('lleno', t, `${RES}/mipmap-${d}/ic_launcher.png`);
  await icono('circulo', t, `${RES}/mipmap-${d}/ic_launcher_round.png`);
  // El sistema recorta el frente: el emblema va dentro de la zona segura (66 de 108)
  const e = Math.round(frente * 0.6);
  await foto(`<div style="width:${frente}px;height:${frente}px;display:flex;align-items:center;justify-content:center">${svgEmblemaSolo(FIGURA, e)}</div>`, frente, frente, `${RES}/mipmap-${d}/ic_launcher_foreground.png`);
}

// ——— Pantalla de inicio (splash): fondo oscuro de la familia y el emblema solo al centro ———
for (const [d, w, h] of [['', 480, 320], ['land-mdpi', 480, 320], ['land-hdpi', 800, 480], ['land-xhdpi', 1280, 720], ['land-xxhdpi', 1600, 960], ['land-xxxhdpi', 1920, 1280],
  ['port-mdpi', 320, 480], ['port-hdpi', 480, 800], ['port-xhdpi', 720, 1280], ['port-xxhdpi', 960, 1600], ['port-xxxhdpi', 1280, 1920]]) {
  const e = Math.round(Math.min(w, h) * 0.4);
  await foto(`<div style="width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center">${svgEmblemaSolo(FIGURA, e)}</div>`, w, h, `${RES}/drawable${d ? '-' + d : ''}/splash.png`, COLORES_ICONO.fondo);
}

// Web: el mismo emblema dentro de index.html (se ve apenas abre, antes de que cargue la app)
const html = readFileSync('index.html', 'utf8');
if (html.includes('<!--splash-->')) {
  writeFileSync('index.html', html.replace(/<!--splash-->[\s\S]*?<!--\/splash-->/, `<!--splash-->${svgEmblemaSolo(FIGURA, 168)}<!--/splash-->`));
}
await navegador.close();
console.log('íconos de StoaHabit listos');
