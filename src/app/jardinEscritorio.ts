/**
 * Jardín completo para el escritorio de Windows (v2.11.0, pedido del dueño): la terraza horizontal con la repisa,
 * los braseros (con fuego de noche), cada maceta con su planta y su medalla, igual que en la app.
 *
 * La app ya sabe dibujar el jardín (Escena.tsx con escena.ts y terreno.ts): acá se calcula la MISMA ubicación de cada
 * cosa y se manda como una lista de "qué imagen, dónde y de qué ancho" en el campo `j` del documento del widget.
 * El widget (Rainmeter) solo pone esas imágenes, que vienen dentro del paquete: no se baja ninguna foto.
 *
 * Formato de `j` (todo en u, donde 10000 u = ancho del fondo):
 *   "1|plantas|medallas~tipo|archivo|x|y|ancho|inclinación×1000~…"
 *   tipo: i = imagen, n = imagen solo de noche (fuego), s = sombra (elipse; x,y = centro).
 */
import { MARCHITA, PLANTA_DE_VIRTUD, alCien } from '@core/jardin';
import type { Habito, Registro } from '@core/habitos';
import { ADORNOS, BRASERO, FONDOS, FUEGO, MACETA, REPISA } from '@/screens/jardin/disposicion';
import { anchoMaceta, ubicarPlanta } from '@/screens/jardin/escena';
import { nichosDeRepisa } from '@/screens/jardin/Escena';
import { BRASEROS, ubicar } from '@/screens/jardin/terreno';
import { calcularJardin, medallasGanadas, type Guardado } from '@/screens/jardin/estado';

const FORMA = 'horizontal' as const;
const F = FONDOS[FORMA];
/** Alto del fondo en u. */
export const ALTO_U = Math.round((10000 * F.alto) / F.ancho);
const relacion = F.ancho / F.alto;

/** % del ancho → u */
const ux = (p: number) => Math.round(p * 100);
/** % del alto → u */
const uy = (p: number) => Math.round((p * ALTO_U) / 100);

export interface DatosJardin {
  habitos: Habito[];
  registros: Map<string, Map<string, Registro>>;
  hoy: string;
  g: Guardado;
}

/** La lista de dibujo del jardín, en el orden en que se pinta (de atrás hacia adelante). */
export function armarJardinEscritorio(d: DatosJardin): string {
  const jardin = calcularJardin({ habitos: d.habitos.filter((h) => !h.archivado), registros: d.registros, hoy: d.hoy, g: d.g, prueba: null });
  const items = [
    ...jardin.plantas.map((p) => ({ id: p.id, virtud: p.virtud, etapa: p.a.etapa, retono: false })),
    ...jardin.retonos.map((r) => ({ id: r.id, virtud: r.madre.virtud, etapa: r.etapa, retono: true })),
  ];
  const medallas = Math.max(d.g.logros, medallasGanadas(jardin.plantas));
  const acomodo = ubicar(FORMA, items.map((i) => i.id), [], d.g.pos.vertical, {});
  const capas: Array<{ z: number; t: string }> = [];
  const img = (z: number, tipo: 'i' | 'n', archivo: string, x: number, y: number, w: number, k = 0) =>
    capas.push({ z, t: `${tipo}|${archivo}|${ux(x)}|${uy(y)}|${ux(w)}|${Math.round(k * 1000)}` });
  const sombra = (z: number, x: number, y: number, w: number) => capas.push({ z, t: `s||${ux(x)}|${uy(y)}|${ux(w)}|0` });

  // Repisa de logros con sus adornos y medallas (si está a la vista)
  if (d.g.repisa) {
    const R = REPISA.lugar[FORMA];
    const altoRepisa = R.ancho * relacion * (REPISA.h / REPISA.w);
    const arriba = R.piso - altoRepisa;
    img(1, 'i', 'repisa', R.x, arriba, R.ancho);
    for (const n of nichosDeRepisa(medallas)) {
      const fila = REPISA.filas[n.fila];
      const a = n.adorno ? ADORNOS.find((x) => x.id === n.adorno)! : null;
      let w = REPISA.anchoNicho * 0.92;
      if (a) {
        const altoPct = w * (REPISA.w / REPISA.h) * (a.h / a.w);
        if (altoPct > fila.alto * 0.95) w = (fila.alto * 0.95) / ((REPISA.w / REPISA.h) * (a.h / a.w));
      }
      // Del % de la repisa al % del fondo
      const anchoF = (R.ancho * w) / 100;
      const cx = R.x + (R.ancho * REPISA.columnas[n.col]) / 100;
      const pisoF = arriba + (altoRepisa * fila.piso) / 100;
      const altoF = a ? anchoF * relacion * (a.h / a.w) : anchoF * relacion;
      img(1.5, 'i', a ? `adorno-${a.id}` : 'medalla', cx - anchoF / 2, pisoF - altoF, anchoF);
    }
  }

  // Braseros (de noche, con fuego)
  for (const b of BRASEROS[FORMA]) {
    const ancho = anchoMaceta(FORMA, b.y) * 0.78;
    const alto = ancho * relacion * (BRASERO.h / BRASERO.w);
    const top = b.y - alto;
    const z = 3 + Math.round(b.y);
    sombra(2, b.x, b.y - 0.3, ancho * 1.25);
    img(z, 'i', 'brasero', b.x - ancho / 2, top, ancho);
    const anchoFuego = (ancho * FUEGO.sobre.w * 1.15) / 100;
    const altoFuego = anchoFuego * relacion * (FUEGO.h / FUEGO.w);
    img(152, 'n', 'fuego', b.x - anchoFuego / 2, top + (alto * (FUEGO.sobre.y + 3)) / 100 - altoFuego, anchoFuego);
  }

  // Macetas con su planta (y su medalla si llegó al 100 %)
  for (const p of items) {
    const celda = acomodo.lugar.get(p.id);
    if (celda === undefined) continue;
    const especie = PLANTA_DE_VIRTUD[p.virtud].id;
    const u = ubicarPlanta(FORMA, especie, p.etapa, celda, p.retono);
    const m = u.maceta;
    const z = 3 + Math.round(m.piso);
    sombra(2, m.left + m.w / 2, m.piso - m.h * 0.06, m.w * 1.18);
    img(z, 'i', 'maceta', m.left, m.top, m.w, m.inclina);
    img(z + 0.1, 'i', `${especie}-${p.etapa}`, u.left, u.top, u.ancho);
    if (alCien(p.etapa)) {
      const tam = m.w * (p.retono ? 0.3 : 0.36);
      img(z + 0.2, 'i', 'medalla', m.left + m.w * 0.84 + m.corre(m.h * 0.3) - tam / 2, m.top + m.h * 0.7 - tam * 0.3, tam);
    }
  }
  capas.sort((a, b) => a.z - b.z);
  return [`1|${items.length}|${medallas}`, ...capas.map((c) => c.t)].join('~');
}

/** Las imágenes que usa el jardín del escritorio: nombre en el paquete ← archivo de la app. */
export function imagenesJardin(): Array<{ nombre: string; desde: string; ancho: number; jpg?: boolean }> {
  const lista: Array<{ nombre: string; desde: string; ancho: number; jpg?: boolean }> = [
    { nombre: 'terraza', desde: F.archivo, ancho: 1400, jpg: true },
    { nombre: 'repisa', desde: REPISA.archivo, ancho: 700 },
    { nombre: 'brasero', desde: BRASERO.apagado, ancho: 160 },
    { nombre: 'fuego', desde: FUEGO.archivo, ancho: 120 },
    { nombre: 'maceta', desde: MACETA.archivo, ancho: 240 },
    ...ADORNOS.map((a) => ({ nombre: `adorno-${a.id}`, desde: `/jardin/adorno-${a.id}.webp`, ancho: 120 })),
  ];
  for (const { id } of Object.values(PLANTA_DE_VIRTUD)) {
    for (let e = 0; e <= MARCHITA; e++) lista.push({ nombre: `${id}-${e}`, desde: `/jardin/${id}-${e}.webp`, ancho: 220 });
  }
  return lista;
}

/** Skin del jardín (Jardin/Jardin.ini). */
export interface ColoresJardin {
  fondo: string;
  oro: string;
  marfil: string;
  noche: string;
  amanecer: string;
  atardecer: string;
  sombra: string;
}

export function skinJardinIni(url: string, app: string, colores: ColoresJardin, capas = 110): string {
  const metros = Array.from(
    { length: capas },
    (_, i) => `
[Img${i + 1}]
Meter=Image
X=0
Y=0
W=1
PreserveAspectRatio=1
Hidden=1
`,
  ).join('');
  return `; StoaHabit · tu jardín completo (lo armó la app; no hace falta tocar nada)
; Se actualiza cada 15 minutos. Clic derecho → tamaño, actualizar o abrir el jardín.

[Rainmeter]
Update=1000
AccurateText=1
ContextTitle=Abrir el jardín
ContextAction=["#App#/jardin"]
ContextTitle2=Actualizar ahora
ContextAction2=[!CommandMeasure MeasureDatos "Update"]
ContextTitle3=Tamaño chico
ContextAction3=[!WriteKeyValue Variables Ancho 480][!Refresh]
ContextTitle4=Tamaño normal
ContextAction4=[!WriteKeyValue Variables Ancho 600][!Refresh]
ContextTitle5=Tamaño grande
ContextAction5=[!WriteKeyValue Variables Ancho 780][!Refresh]

[Metadata]
Name=StoaHabit · jardín
Author=StoaHabit
Information=Tu jardín estoico completo, con la luz según la hora.
Version=1.2
License=Uso personal

[Variables]
Ancho=600
Fondo=${colores.fondo}
Oro=${colores.oro}
Marfil=${colores.marfil}
Noche=${colores.noche}
Amanecer=${colores.amanecer}
Atardecer=${colores.atardecer}
Sombra=${colores.sombra}
App=${app}
Url=${url}

[MeasureDatos]
Measure=WebParser
URL=#Url#
UpdateRate=900
CodePage=65001
RegExp=(?siU)"j": \\{\\s*"stringValue": "(.*)"\\s*\\}
OnRegExpErrorAction=[!CommandMeasure MeasureLua "Estado('sin-datos')"]
OnConnectErrorAction=[!CommandMeasure MeasureLua "Estado('sin-conexion')"]

[MeasureTexto]
Measure=WebParser
URL=[MeasureDatos]
StringIndex=1

[MeasureLua]
Measure=Script
ScriptFile=#@#jardin.lua

[Fondo]
Meter=Image
ImageName=#@#jardin\\terraza.jpg
X=0
Y=0
W=#Ancho#
PreserveAspectRatio=1
LeftMouseUpAction=["#App#/jardin"]

[Sombras]
Meter=Shape
X=0
Y=0
Shape=Rectangle 0,0,1,1 | Fill Color 0,0,0,0 | StrokeWidth 0
${metros}
[Tinte]
Meter=Shape
X=0
Y=0
Shape=Rectangle 0,0,1,1 | Fill Color 0,0,0,0 | StrokeWidth 0

[Marco]
Meter=Shape
X=0
Y=0
Shape=Rectangle 0,0,1,1 | Fill Color 0,0,0,0 | StrokeWidth 0

[Etiqueta]
Meter=String
X=12
Y=10
FontFace=Georgia
FontSize=10
StringStyle=Bold
FontColor=#Oro#
SolidColor=#Fondo#,200
Padding=8,4,8,4
AntiAlias=1
Text=TU JARDÍN
LeftMouseUpAction=["#App#/jardin"]
`;
}

/** Script del jardín (jardin.lua). Lua 5.1 de Rainmeter. */
export function skinJardinLua(capas = 110): string {
  return `-- StoaHabit · pone las imágenes del jardín donde las calculó la app.
local CAPAS = ${capas}
local ALTO_U = ${ALTO_U}
local ultimo, hora = nil, nil

local function v(n) return SKIN:GetVariable(n) or '' end
local function poner(m, o, x) SKIN:Bang('!SetOption', m, o, x) end
local function partir(s, sep)
  local t = {}
  for p in string.gmatch(s, '([^' .. sep .. ']+)') do t[#t + 1] = p end
  return t
end
local function campos(s)
  -- Campos separados por | (pueden venir vacíos)
  local t = {}
  for p in string.gmatch(s .. '|', '([^|]*)|') do t[#t + 1] = p end
  return t
end

function Initialize() end

function Estado(cual)
  poner('Etiqueta', 'Text', cual == 'sin-conexion' and 'TU JARDÍN · SIN CONEXIÓN' or 'TU JARDÍN · ABRÍ STOAHABIT')
  SKIN:Bang('!UpdateMeter', 'Etiqueta')
  SKIN:Bang('!Redraw')
end

-- Luz según la hora (como en la app): noche, amanecer, día, atardecer
local function tinte(h)
  if h >= 20 or h < 6 then return v('Noche'), 120 end
  if h < 8 then return v('Amanecer'), 35 end
  if h >= 17 then return v('Atardecer'), 45 end
  return nil, 0
end

local function Pintar(texto, h)
  local ancho = tonumber(v('Ancho')) or 600
  local e = ancho / 10000
  local alto = math.floor(ALTO_U * e + 0.5)
  local partes = partir(texto, '~')
  local cab = campos(partes[1] or '')
  local noche = (h >= 18 or h < 6)
  local n, sombras = 0, {}
  for i = 2, #partes do
    local c = campos(partes[i])
    local tipo, archivo = c[1], c[2]
    local x, y, w, k = (tonumber(c[3]) or 0) * e, (tonumber(c[4]) or 0) * e, (tonumber(c[5]) or 0) * e, (tonumber(c[6]) or 0) / 1000
    if tipo == 's' then
      sombras[#sombras + 1] = 'Ellipse ' .. math.floor(x) .. ',' .. math.floor(y) .. ',' .. math.floor(w / 2) .. ',' .. math.max(1, math.floor(w * 0.15)) .. ' | Fill Color ' .. v('Sombra') .. ',90 | StrokeWidth 0'
    elseif (tipo == 'i' or (tipo == 'n' and noche)) and n < CAPAS then
      n = n + 1
      local m = 'Img' .. n
      poner(m, 'ImageName', '#@#jardin\\\\' .. archivo .. '.png')
      poner(m, 'X', tostring(math.floor(x + 0.5)))
      poner(m, 'Y', tostring(math.floor(y + 0.5)))
      poner(m, 'W', tostring(math.max(1, math.floor(w + 0.5))))
      if k ~= 0 then
        -- Inclinada como el piso, con el pie fijo (igual que skewX con origen abajo en la app)
        local base = y + w * 0.769
        poner(m, 'TransformationMatrix', '1;0;' .. k .. ';1;' .. (-k * base) .. ';0')
      else
        poner(m, 'TransformationMatrix', '1;0;0;1;0;0')
      end
      SKIN:Bang('!ShowMeter', m)
    end
  end
  for i = n + 1, CAPAS do SKIN:Bang('!HideMeter', 'Img' .. i) end
  poner('Sombras', 'Shape', 'Rectangle 0,0,' .. ancho .. ',' .. alto .. ' | Fill Color 0,0,0,0 | StrokeWidth 0')
  for i, s in ipairs(sombras) do poner('Sombras', 'Shape' .. (i + 1), s) end
  local color, alfa = tinte(h)
  poner('Tinte', 'Shape', 'Rectangle 0,0,' .. ancho .. ',' .. alto .. ' | Fill Color ' .. (color or '0,0,0') .. ',' .. alfa .. ' | StrokeWidth 0')
  poner('Marco', 'Shape', 'Rectangle 0.5,0.5,' .. (ancho - 1) .. ',' .. (alto - 1) .. ',14 | Fill Color 0,0,0,0 | StrokeWidth 1 | Stroke Color ' .. v('Oro') .. ',120')
  local plantas = tonumber(cab[2] or '0') or 0
  local etiqueta = 'TU JARDÍN'
  if texto == '' then etiqueta = 'TU JARDÍN · CARGANDO…'
  elseif plantas > 0 then etiqueta = 'TU JARDÍN · ' .. plantas .. (plantas == 1 and ' PLANTA' or ' PLANTAS') end
  poner('Etiqueta', 'Text', etiqueta)
  SKIN:Bang('!UpdateMeter', '*')
  SKIN:Bang('!Redraw')
end

function Update()
  local medida = SKIN:GetMeasure('MeasureTexto')
  local t = medida and medida:GetStringValue() or ''
  local h = tonumber(os.date('%H')) or 12
  if t ~= ultimo or h ~= hora then
    ultimo, hora = t, h
    Pintar(t, h)
  end
  return 0
end
`;
}
