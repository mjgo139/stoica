/**
 * Widget de escritorio para Windows (v2.9.0, pedido del dueño): un "skin" de Rainmeter con tus hábitos de hoy,
 * si los cumpliste y la racha, en negro y oro.
 *
 * Cómo llega la información sin pedir contraseñas ni claves:
 * - En Perfil se activa y la app crea un código secreto al azar (`perfil.escritorio`, 24 letras).
 * - Mientras la app está abierta (celular o PC), cada cambio actualiza el documento `escritorio/{codigo}` con un
 *   resumen corto (solo nombres de hábitos de hoy, si están hechos y la racha). Se escribe solo si cambió.
 * - El widget lee ese único documento cada 15 minutos (o al tocar "Actualizar"). Quien no tenga el código no puede
 *   leerlo ni listar los demás; "Cambiar el enlace" o "Desactivar" lo invalida al instante.
 * - El paquete .rmskin lo arma la app con el código adentro: la persona no ve ni copia nada.
 *
 * Formato del resumen (`t`), pensado para leerlo fácil en Lua:
 *   "1|Nombre|AAAA-MM-DD|HH:MM~id|hábito|hecho(0/1)|racha~…"   (hasta 8 hábitos de hoy)
 */
import { useEffect } from 'react';
import { cumplido, esDiaActivo, racha, type Habito, type Registro } from '@core/habitos';
import { useSesion } from '@/app/sesion';
import { registrosDe, useDatos, useHoy, VENTANA_DIAS } from '@/app/datos';
import { obtenerDriver } from '@/data';
import { COLORES_ICONO, FIGURAS, svgEmblemaSolo } from '../../familia/emblema.mjs';
import { DIRECCION } from '@/ui/AvisoMudanza';

export const MAX_HABITOS_ESCRITORIO = 8;
export const LARGO_CODIGO = 24;

/** Código secreto al azar (letras y números, sin confundibles). */
export function nuevoCodigoEscritorio(): string {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const azar = crypto.getRandomValues(new Uint8Array(LARGO_CODIGO));
  return Array.from(azar, (n) => letras[n % letras.length]).join('');
}

/** Sin los separadores del formato ni comillas (el widget lee el texto tal cual). */
function limpio(t: string, max: number): string {
  const s = t.replace(/[|~"\\\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export interface DatosEscritorio {
  nombre: string;
  hoy: string;
  habitos: Habito[];
  registros: (id: string) => Map<string, Registro>;
  ventana: number;
}

/** Cabecera + hábitos de hoy. Devuelve el texto sin la hora (para comparar si cambió) y con la hora. */
export function armarTextoEscritorio(d: DatosEscritorio, hora: string): { clave: string; texto: string } {
  const deHoy = d.habitos
    .filter((h) => !h.archivado && esDiaActivo(h, d.hoy))
    .sort((a, b) => a.momento - b.momento || a.orden - b.orden)
    .slice(0, MAX_HABITOS_ESCRITORIO);
  const filas = deHoy.map((h) => {
    const regs = d.registros(h.id);
    const hecho = cumplido(h, regs.get(d.hoy));
    const r = Math.max(0, racha(h, regs, d.hoy, d.ventana));
    return `${limpio(h.id, 40)}|${limpio(h.nombre, 30)}|${hecho ? 1 : 0}|${r}`;
  });
  const cuerpo = [limpio(d.nombre || 'estoico', 24), d.hoy].join('|');
  const clave = [`1|${cuerpo}`, ...filas].join('~');
  return { clave, texto: [`1|${cuerpo}|${hora}`, ...filas].join('~') };
}

// ---------------------------------------------------------------------------------------------
// Paquete .rmskin (un zip con un pie de 16 bytes que Rainmeter reconoce al hacer doble clic)
// ---------------------------------------------------------------------------------------------

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = TABLA_CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Zip sin comprimir (alcanza: son archivos chicos). */
export function armarZip(archivos: Array<{ nombre: string; datos: Uint8Array }>): Uint8Array {
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let pos = 0;
  const enc = new TextEncoder();
  for (const a of archivos) {
    const nombre = enc.encode(a.nombre);
    const crc = crc32(a.datos);
    const cab = new DataView(new ArrayBuffer(30));
    cab.setUint32(0, 0x04034b50, true);
    cab.setUint16(4, 20, true);
    cab.setUint16(8, 0, true); // sin comprimir
    cab.setUint16(12, 0x21, true); // fecha 1980-01-01
    cab.setUint32(14, crc, true);
    cab.setUint32(18, a.datos.length, true);
    cab.setUint32(22, a.datos.length, true);
    cab.setUint16(26, nombre.length, true);
    partes.push(new Uint8Array(cab.buffer), nombre, a.datos);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint16(14, 0x21, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, a.datos.length, true);
    cen.setUint32(24, a.datos.length, true);
    cen.setUint16(28, nombre.length, true);
    cen.setUint32(42, pos, true);
    central.push(new Uint8Array(cen.buffer), nombre);
    pos += 30 + nombre.length + a.datos.length;
  }
  const largoCentral = central.reduce((s, p) => s + p.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, archivos.length, true);
  fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, largoCentral, true);
  fin.setUint32(16, pos, true);
  return unir([...partes, ...central, new Uint8Array(fin.buffer)]);
}

function unir(partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let i = 0;
  for (const p of partes) {
    out.set(p, i);
    i += p.length;
  }
  return out;
}

/** .rmskin = zip + 8 bytes con el largo del zip (little-endian) + "\0RMSKIN\0". */
export function armarRmskin(archivos: Array<{ nombre: string; datos: Uint8Array }>): Uint8Array {
  const zip = armarZip(archivos);
  const pie = new DataView(new ArrayBuffer(16));
  pie.setUint32(0, zip.length, true);
  pie.setUint32(4, 0, true);
  new Uint8Array(pie.buffer).set([0, 0x52, 0x4d, 0x53, 0x4b, 0x49, 0x4e, 0], 8);
  return unir([zip, new Uint8Array(pie.buffer)]);
}

/** Rainmeter lee los .ini y los .lua en UTF-16 LE con BOM (con UTF-8 se rompen las tildes). */
export function utf16le(texto: string): Uint8Array {
  const t = texto.replace(/\r?\n/g, '\r\n');
  const out = new Uint8Array(2 + t.length * 2);
  out[0] = 0xff;
  out[1] = 0xfe;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    out[2 + i * 2] = c & 0xff;
    out[3 + i * 2] = c >> 8;
  }
  return out;
}

/** Color del ícono de la familia (COLORES_ICONO) en el formato de Rainmeter: "r,g,b" o "r,g,b,a". */
function aRainmeter(hex: string, alfa?: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const base = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  return alfa === undefined ? base : `${base},${alfa}`;
}

const FILAS = Array.from({ length: MAX_HABITOS_ESCRITORIO }, (_, i) => i + 1);

/** El skin de Rainmeter (StoaHabit.ini). */
export function skinIni(proyecto: string, codigo: string, app = DIRECCION): string {
  const url = `https://firestore.googleapis.com/v1/projects/${proyecto}/databases/(default)/documents/escritorio/${codigo}`;
  const filas = FILAS.map(
    (i) => `
[MeterH${i}Marca]
Meter=String
MeterStyle=EstiloTexto
X=18
Y=0
FontSize=10
FontColor=#Gris#
Text=◇
Hidden=1

[MeterH${i}Nombre]
Meter=String
MeterStyle=EstiloTexto
X=40
Y=0
W=190
ClipString=1
FontSize=10
FontColor=#Marfil#
Text=
Hidden=1
MouseOverAction=[!SetOption MeterH${i}Nombre InlineSetting "Underline"][!UpdateMeter MeterH${i}Nombre][!Redraw]
MouseLeaveAction=[!SetOption MeterH${i}Nombre InlineSetting ""][!UpdateMeter MeterH${i}Nombre][!Redraw]
LeftMouseUpAction=["#App#"]

[MeterH${i}Racha]
Meter=String
MeterStyle=EstiloRomano
X=(#Ancho#-18)
Y=0
StringAlign=Right
Text=
Hidden=1
`,
  ).join('');
  return `; StoaHabit · widget de escritorio para Rainmeter (lo armó la app; no hace falta tocar nada)
; Lee tu resumen de hoy cada 15 minutos. Clic derecho → "Actualizar ahora" para pedirlo ya.

[Rainmeter]
Update=1000
DynamicWindowSize=1
AccurateText=1
ContextTitle=Abrir StoaHabit
ContextAction=["#App#"]
ContextTitle2=Actualizar ahora
ContextAction2=[!CommandMeasure MeasureDatos "Update"]

[Metadata]
Name=StoaHabit
Author=StoaHabit
Information=Tus hábitos de hoy, si los cumpliste y tu racha.
Version=1.0
License=Uso personal

[Variables]
Ancho=300
Fondo=${aRainmeter(COLORES_ICONO.fondo, 242)}
Oro=${aRainmeter(COLORES_ICONO.laurel)}
Marfil=${aRainmeter(COLORES_ICONO.figura)}
Gris=${aRainmeter(COLORES_ICONO.figura, 120)}
Linea=${aRainmeter(COLORES_ICONO.laurel, 70)}
App=${app}
Url=${url}

[EstiloTexto]
FontFace=Segoe UI
AntiAlias=1
SolidColor=0,0,0,1

[EstiloRomano]
FontFace=Georgia
FontSize=11
StringStyle=Bold
FontColor=#Oro#
AntiAlias=1

[MeasureDatos]
Measure=WebParser
URL=#Url#
UpdateRate=900
CodePage=65001
RegExp=(?siU)"t": \\{\\s*"stringValue": "(.*)"\\s*\\}
OnConnectErrorAction=[!CommandMeasure MeasureLua "Estado('sin-conexion')"]
OnRegExpErrorAction=[!CommandMeasure MeasureLua "Estado('sin-datos')"]

[MeasureTexto]
Measure=WebParser
URL=[MeasureDatos]
StringIndex=1

[MeasureLua]
Measure=Script
ScriptFile=#@#stoahabit.lua

[MeterFondo]
Meter=Shape
Shape=Rectangle 0,0,#Ancho#,150,16 | Fill Color #Fondo# | StrokeWidth 1 | Stroke Color #Linea#

[MeterEmblema]
Meter=Image
ImageName=#@#emblema.png
X=16
Y=16
W=40
PreserveAspectRatio=1
LeftMouseUpAction=["#App#"]

[MeterMarca]
Meter=String
X=64
Y=16
FontFace=Georgia
FontSize=14
StringStyle=Bold
FontColor=#Oro#
AntiAlias=1
Text=StoaHabit
LeftMouseUpAction=["#App#"]

[MeterResumen]
Meter=String
MeterStyle=EstiloTexto
X=65
Y=42
FontSize=8
StringStyle=Bold
FontColor=#Gris#
Text=CARGANDO…

[MeterBarra]
Meter=Shape
X=18
Y=72
Shape=Rectangle 0,0,(#Ancho#-36),4,2 | Fill Color #Linea# | StrokeWidth 0
Shape2=Rectangle 0,0,0,4,2 | Fill Color #Oro# | StrokeWidth 0
${filas}
[MeterPie]
Meter=String
MeterStyle=EstiloTexto
X=18
Y=120
FontSize=8
FontColor=#Gris#
Text=
LeftMouseUpAction=["#App#"]
`;
}

/** El script que lee el resumen y acomoda las filas (stoahabit.lua). Lua 5.1 de Rainmeter. */
export function skinLua(): string {
  return `-- StoaHabit · acomoda el widget con el resumen que manda la app.
local FILAS = ${MAX_HABITOS_ESCRITORIO}
local ultimo, dia = nil, nil

function Initialize()
  Pintar('', os.date('%Y-%m-%d'))
end

local function u8(cp)
  if cp < 128 then return string.char(cp) end
  if cp < 2048 then return string.char(192 + math.floor(cp / 64), 128 + cp % 64) end
  return string.char(224 + math.floor(cp / 4096), 128 + math.floor(cp / 64) % 64, 128 + cp % 64)
end

local function decodificar(s)
  s = s:gsub('\\\\u(%x%x%x%x)', function(h) return u8(tonumber(h, 16)) end)
  s = s:gsub('\\\\(.)', '%1')
  return s
end

local function partir(s, sep)
  local t = {}
  for p in string.gmatch(s, '([^' .. sep .. ']+)') do t[#t + 1] = p end
  return t
end

local function romano(n)
  if n <= 0 then return '' end
  if n > 3999 then return tostring(n) end
  local v = { {1000,'M'},{900,'CM'},{500,'D'},{400,'CD'},{100,'C'},{90,'XC'},{50,'L'},{40,'XL'},{10,'X'},{9,'IX'},{5,'V'},{4,'IV'},{1,'I'} }
  local r = ''
  for _, p in ipairs(v) do
    while n >= p[1] do r = r .. p[2]; n = n - p[1] end
  end
  return r
end

local function v(nombre) return SKIN:GetVariable(nombre) or '' end

local function poner(meter, opcion, valor)
  SKIN:Bang('!SetOption', meter, opcion, valor)
end

function Estado(cual)
  if cual == 'sin-conexion' then
    poner('MeterResumen', 'Text', 'SIN CONEXIÓN · REINTENTA EN 15 MIN')
  else
    poner('MeterResumen', 'Text', 'ABRÍ STOAHABIT PARA ACTUALIZAR')
  end
  SKIN:Bang('!UpdateMeter', 'MeterResumen')
  SKIN:Bang('!Redraw')
end

function Pintar(texto, hoy)
  local partes = partir(texto, '~')
  local cab = partir(partes[1] or '', '|')
  local fecha = cab[3] or ''
  local esHoy = (fecha == hoy)
  local hechos, total = 0, 0
  local y = 88
  for i = 1, FILAS do
    local f = partes[i + 1]
    local m = 'MeterH' .. i
    if f then
      local c = partir(f, '|')
      local hecho = esHoy and c[3] == '1'
      local r = tonumber(c[4] or '0') or 0
      total = total + 1
      if hecho then hechos = hechos + 1 end
      poner(m .. 'Marca', 'Text', hecho and '◆' or '◇')
      poner(m .. 'Marca', 'FontColor', hecho and v('Oro') or v('Gris'))
      poner(m .. 'Nombre', 'Text', c[2] or '')
      poner(m .. 'Nombre', 'FontColor', hecho and v('Marfil') or v('Gris'))
      poner(m .. 'Nombre', 'LeftMouseUpAction', '["' .. v('App') .. '/habitos/' .. (c[1] or '') .. '"]')
      poner(m .. 'Racha', 'Text', romano(r))
      for _, s in ipairs({ 'Marca', 'Nombre', 'Racha' }) do
        poner(m .. s, 'Y', tostring(y))
        SKIN:Bang('!ShowMeter', m .. s)
      end
      y = y + 26
    else
      for _, s in ipairs({ 'Marca', 'Nombre', 'Racha' }) do SKIN:Bang('!HideMeter', m .. s) end
    end
  end
  if texto == '' then
    poner('MeterResumen', 'Text', 'CARGANDO…')
  elseif total == 0 then
    poner('MeterResumen', 'Text', 'HOY NO HAY PRÁCTICAS')
  elseif esHoy then
    poner('MeterResumen', 'Text', 'HOY · ' .. hechos .. ' DE ' .. total .. (hechos == total and ' · DÍA CUMPLIDO' or ''))
  else
    poner('MeterResumen', 'Text', 'HOY · ABRÍ STOAHABIT PARA MARCAR')
  end
  local ancho = (tonumber(v('Ancho')) or 300) - 36
  local lleno = 0
  if total > 0 then lleno = math.floor(ancho * hechos / total) end
  poner('MeterBarra', 'Shape2', 'Rectangle 0,0,' .. lleno .. ',4,2 | Fill Color ' .. v('Oro') .. ' | StrokeWidth 0')
  local pie = 'Abrir StoaHabit'
  if cab[4] and cab[4] ~= '' then pie = 'Actualizado ' .. (esHoy and '' or (fecha .. ' ')) .. cab[4] .. ' · abrir StoaHabit' end
  poner('MeterPie', 'Text', pie)
  poner('MeterPie', 'Y', tostring(y + 8))
  poner('MeterFondo', 'Shape', 'Rectangle 0,0,' .. v('Ancho') .. ',' .. (y + 36) .. ',16 | Fill Color ' .. v('Fondo') .. ' | StrokeWidth 1 | Stroke Color ' .. v('Linea'))
  SKIN:Bang('!UpdateMeter', '*')
  SKIN:Bang('!Redraw')
end

function Update()
  local medida = SKIN:GetMeasure('MeasureTexto')
  local t = medida and medida:GetStringValue() or ''
  local hoy = os.date('%Y-%m-%d')
  if t ~= ultimo or hoy ~= dia then
    ultimo, dia = t, hoy
    Pintar(decodificar(t), hoy)
  end
  return 0
end
`;
}

const RMSKIN_INI = `[rmskin]
Name=StoaHabit
Author=StoaHabit
Version=1.0
MinimumRainmeter=4.5.0
MinimumWindows=10.0
LoadType=Skin
Load=StoaHabit\\StoaHabit.ini
`;

/** Dibuja el emblema de la familia (laurel + check) como PNG para el widget. */
async function emblemaPng(lado = 120): Promise<Uint8Array> {
  const svg = svgEmblemaSolo(FIGURAS.check, lado);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = lado;
  c.height = Math.round((lado * img.height) / img.width) || lado;
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob>((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo dibujar el emblema.'))), 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

/** Arma el paquete StoaHabit.rmskin con el código adentro, listo para doble clic. */
export async function paqueteEscritorio(proyecto: string, codigo: string): Promise<Blob> {
  const archivos = [
    { nombre: 'RMSKIN.ini', datos: utf16le(RMSKIN_INI) },
    { nombre: 'Skins/StoaHabit/StoaHabit.ini', datos: utf16le(skinIni(proyecto, codigo)) },
    { nombre: 'Skins/StoaHabit/@Resources/stoahabit.lua', datos: utf16le(skinLua()) },
    { nombre: 'Skins/StoaHabit/@Resources/emblema.png', datos: await emblemaPng() },
  ];
  return new Blob([armarRmskin(archivos)], { type: 'application/octet-stream' });
}

/** Hora corta para el pie del widget. */
export function horaCorta(d = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}


// ---------------------------------------------------------------------------------------------
// Mantener el resumen al día mientras la app está abierta
// ---------------------------------------------------------------------------------------------

const CLAVE_ULTIMO = 'stoica.escritorio.ultimo';

function leerUltimo(): string {
  try {
    return localStorage.getItem(CLAVE_ULTIMO) ?? '';
  } catch {
    return '';
  }
}
function guardarUltimo(v: string) {
  try {
    localStorage.setItem(CLAVE_ULTIMO, v);
  } catch {
    /* sin almacenamiento: a lo sumo se escribe de nuevo */
  }
}

/** Sube el resumen de hoy (solo si cambió y 3 s después del último cambio, para no gastar escrituras). */
export async function subirResumenEscritorio(codigo: string, uid: string, texto: { clave: string; texto: string }, forzar = false) {
  const marca = `${codigo}:${texto.clave}`;
  if (!forzar && leerUltimo() === marca) return;
  const d = await obtenerDriver();
  await d.guardar(`escritorio/${codigo}`, { uid, t: texto.texto, actualizado: Date.now() });
  guardarUltimo(marca);
}

export function useResumenEscritorio() {
  const codigo = useSesion((s) => s.perfil?.escritorio ?? null);
  const nombre = useSesion((s) => s.perfil?.nombre ?? '');
  const uid = useSesion((s) => s.usuario?.uid);
  const habitos = useDatos((s) => s.habitos);
  const registros = useDatos((s) => s.registros);
  const listo = useDatos((s) => s.listo);
  const hoy = useHoy();
  useEffect(() => {
    if (!codigo || !uid || !listo) return;
    const texto = armarTextoEscritorio(
      { nombre: nombre.split(' ')[0] ?? '', hoy, habitos, registros: (id) => registrosDe(registros, id), ventana: VENTANA_DIAS },
      horaCorta(),
    );
    const t = setTimeout(() => void subirResumenEscritorio(codigo, uid, texto).catch(() => undefined), 3000);
    return () => clearTimeout(t);
  }, [codigo, uid, listo, habitos, registros, hoy, nombre]);
}
