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
 *   "1|Nombre|AAAA-MM-DD|HH:MM|lunesGrilla~id|hábito|hecho(0/1)|racha|virtud|tipo|35 días|% 30 días~…"
 * (hasta 8 hábitos de hoy). Los 35 días (v2.10.0) son 5 semanas de lunes a domingo que terminan esta semana:
 * 1 cumplido · 0 no cumplido · p pendiente (hoy) · f futuro · - sin práctica ese día.
 * Los widgets de v2.9.0 leen solo los 4 primeros campos y siguen andando.
 */
import { useEffect } from 'react';
import { cumplido, esDiaActivo, estadoDia, porcentaje, racha, type Habito, type Registro } from '@core/habitos';
import { diaSemanaDeClave, sumarDias } from '@core/fechas';
import { useSesion } from '@/app/sesion';
import { registrosDe, useDatos, useHoy, VENTANA_DIAS } from '@/app/datos';
import { obtenerDriver } from '@/data';
import { armarJardinEscritorio, imagenesJardin, skinJardinIni, skinJardinLua, type ColoresJardin } from '@/app/jardinEscritorio';
import { leerGuardado } from '@/screens/jardin/estado';
import { tinte } from '@/screens/jardin/escena';
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
export const DIAS_GRILLA = 35;

/** Lunes de la semana de `hoy` menos 4 semanas: la grilla del mes termina el domingo de esta semana. */
export function inicioGrilla(hoy: string): string {
  const desdeLunes = (diaSemanaDeClave(hoy) + 6) % 7;
  return sumarDias(hoy, -desdeLunes - 28);
}

const LETRA: Record<ReturnType<typeof estadoDia>, string> = { ok: '1', mal: '0', pendiente: 'p', futuro: 'f', inactivo: '-' };

export function armarTextoEscritorio(d: DatosEscritorio, hora: string): { clave: string; texto: string } {
  const lunes = inicioGrilla(d.hoy);
  const deHoy = d.habitos
    .filter((h) => !h.archivado && esDiaActivo(h, d.hoy))
    .sort((a, b) => a.momento - b.momento || a.orden - b.orden)
    .slice(0, MAX_HABITOS_ESCRITORIO);
  const filas = deHoy.map((h) => {
    const regs = d.registros(h.id);
    const hecho = cumplido(h, regs.get(d.hoy));
    const r = Math.max(0, racha(h, regs, d.hoy, d.ventana));
    let dias = '';
    for (let i = 0; i < DIAS_GRILLA; i++) {
      const dia = sumarDias(lunes, i);
      dias += dia < h.inicio && dia <= d.hoy ? '-' : LETRA[estadoDia(h, regs, dia, d.hoy)];
    }
    const pct = porcentaje(h, regs, sumarDias(d.hoy, -29), d.hoy);
    return `${limpio(h.id, 40)}|${limpio(h.nombre, 30)}|${hecho ? 1 : 0}|${r}|${h.virtud}|${h.tipo}|${dias}|${pct}`;
  });
  const cuerpo = [limpio(d.nombre || 'estoico', 24), d.hoy].join('|');
  const clave = [`1|${cuerpo}|${lunes}`, ...filas].join('~');
  return { clave, texto: [`1|${cuerpo}|${hora}|${lunes}`, ...filas].join('~') };
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
export function aRainmeter(color: string, alfa?: number): string {
  const m = color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (m) return alfa === undefined ? `${m[1]},${m[2]},${m[3]}` : `${m[1]},${m[2]},${m[3]},${alfa}`;
  const hex = color;
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
ContextTitle3=Agregar tarjeta de hábito (con el mes)
ContextAction3=[!ActivateConfig "StoaHabit\\Habito1" "Habito.ini"]
ContextTitle4=Mostrar el jardín
ContextAction4=[!ActivateConfig "StoaHabit\\Jardin" "Jardin.ini"]

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
Version=1.1
MinimumRainmeter=4.5.0
MinimumWindows=10.0
LoadType=Skin
Load=StoaHabit\\Habito1\\Habito.ini
`;

// ---------------------------------------------------------------------------------------------
// Tarjeta de un hábito con el mes (v2.10.0, pedido del dueño: "como el widget de Android, con más días")
// ---------------------------------------------------------------------------------------------

export const TARJETAS = 8;

/** Colores del widget en formato Rainmeter ("r,g,b"). Los arma la app con las variables de la familia. */
export interface ColoresWidget {
  verde: string;
  rojo: string;
  virtudes: Record<'sabiduria' | 'coraje' | 'justicia' | 'templanza', string>;
}

/** Tarjeta de hábito: Habito{n}/Habito.ini. `indice` = qué hábito de la lista muestra al principio. */
export function skinHabitoIni(proyecto: string, codigo: string, indice: number, c: ColoresWidget, app = DIRECCION): string {
  const url = `https://firestore.googleapis.com/v1/projects/${proyecto}/databases/(default)/documents/escritorio/${codigo}`;
  const letras = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
    .map(
      (l, i) => `
[MeterDia${i + 1}]
Meter=String
MeterStyle=EstiloChico
X=(${27 + i * 36 + 15}*#E#)
Y=(82*#E#)
StringAlign=Center
Text=${l}
`,
    )
    .join('');
  const siguiente = indice < TARJETAS ? `\nContextTitle12=Agregar otra tarjeta\nContextAction12=[!ActivateConfig "StoaHabit\\Habito${indice + 1}" "Habito.ini"]` : '';
  return `; StoaHabit · tarjeta de un hábito con las últimas 5 semanas (lo armó la app; no hace falta tocar nada)
; Clic derecho → "Siguiente hábito" para elegir cuál muestra esta tarjeta.

[Rainmeter]
Update=1000
AccurateText=1
ContextTitle=Siguiente hábito
ContextAction=[!CommandMeasure MeasureLua "Mover(1)"]
ContextTitle2=Hábito anterior
ContextAction2=[!CommandMeasure MeasureLua "Mover(-1)"]
ContextTitle3=---
ContextTitle4=Ver la semana
ContextAction4=[!CommandMeasure MeasureLua "Vista('semana')"]
ContextTitle5=Ver el mes (5 semanas)
ContextAction5=[!CommandMeasure MeasureLua "Vista('mes')"]
ContextTitle6=Tamaño chico
ContextAction6=[!WriteKeyValue Variables E 0.8][!Refresh]
ContextTitle7=Tamaño normal
ContextAction7=[!WriteKeyValue Variables E 1][!Refresh]
ContextTitle8=Tamaño grande
ContextAction8=[!WriteKeyValue Variables E 1.3][!Refresh]
ContextTitle9=---
ContextTitle10=Actualizar ahora
ContextAction10=[!CommandMeasure MeasureDatos "Update"]
ContextTitle11=Mostrar el jardín
ContextAction11=[!ActivateConfig "StoaHabit\\Jardin" "Jardin.ini"]${siguiente}

[Metadata]
Name=StoaHabit · hábito
Author=StoaHabit
Information=Un hábito con su racha y las últimas 5 semanas.
Version=1.1
License=Uso personal

[Variables]
Indice=${indice}
; Vista: mes (5 semanas) o semana · E: tamaño (0.8 chico, 1 normal, 1.3 grande)
Vista=mes
E=1
Ancho=300
Fondo=${aRainmeter(COLORES_ICONO.fondo, 242)}
Oro=${aRainmeter(COLORES_ICONO.laurel)}
Marfil=${aRainmeter(COLORES_ICONO.figura)}
Gris=${aRainmeter(COLORES_ICONO.figura, 120)}
Tenue=${aRainmeter(COLORES_ICONO.figura, 40)}
Linea=${aRainmeter(COLORES_ICONO.laurel, 70)}
Verde=${c.verde}
Rojo=${c.rojo}
Sabiduria=${c.virtudes.sabiduria}
Coraje=${c.virtudes.coraje}
Justicia=${c.virtudes.justicia}
Templanza=${c.virtudes.templanza}
App=${app}
Url=${url}

[EstiloChico]
FontFace=Segoe UI
FontSize=(8*#E#)
StringStyle=Bold
FontColor=#Gris#
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
ScriptFile=#@#habito.lua

[MeterFondo]
Meter=Shape
Shape=Rectangle 0,0,(#Ancho#*#E#),(326*#E#),(16*#E#) | Fill Color #Fondo# | StrokeWidth 1 | Stroke Color #Linea#
LeftMouseUpAction=["#App#"]

[MeterCirculo]
Meter=Shape
X=(16*#E#)
Y=(16*#E#)
Shape=Ellipse (22*#E#),(22*#E#),(22*#E#) | Fill Color 0,0,0,1 | StrokeWidth 1.5 | Stroke Color #Oro#

[MeterInicial]
Meter=String
X=(38*#E#)
Y=(27*#E#)
StringAlign=Center
FontFace=Georgia
FontSize=(14*#E#)
StringStyle=Bold
FontColor=#Oro#
AntiAlias=1
Text=

[MeterNombre]
Meter=String
X=(72*#E#)
Y=(17*#E#)
W=(150*#E#)
ClipString=1
FontFace=Segoe UI
FontSize=(13*#E#)
StringStyle=Bold
FontColor=#Marfil#
AntiAlias=1
Text=StoaHabit

[MeterSub]
Meter=String
MeterStyle=EstiloChico
X=(72*#E#)
Y=(43*#E#)
ClipString=1
FontColor=#Oro#
Text=CARGANDO…

[MeterRacha]
Meter=String
X=(264*#E#)
Y=(10*#E#)
StringAlign=Center
FontFace=Georgia
FontSize=(20*#E#)
StringStyle=Bold
FontColor=#Oro#
AntiAlias=1
Text=

[MeterRachaTexto]
Meter=String
MeterStyle=EstiloChico
X=(264*#E#)
Y=(48*#E#)
StringAlign=Center
Text=RACHA
${letras}
[MeterGrilla]
Meter=Shape
X=(27*#E#)
Y=(100*#E#)
Shape=Rectangle 0,0,(246*#E#),(174*#E#) | Fill Color 0,0,0,1 | StrokeWidth 0

[MeterRaya]
Meter=Shape
X=(16*#E#)
Y=(286*#E#)
Shape=Line 0,0,(268*#E#),0 | StrokeWidth 1 | Stroke Color #Linea#

[MeterPie]
Meter=String
MeterStyle=EstiloChico
X=(18*#E#)
Y=(297*#E#)
Text=

[MeterAccion]
Meter=String
X=(284*#E#)
Y=(294*#E#)
StringAlign=Right
FontFace=Segoe UI
FontSize=(10*#E#)
StringStyle=Bold
FontColor=#Oro#
AntiAlias=1
SolidColor=0,0,0,1
Text=Ver detalle ›
LeftMouseUpAction=["#App#"]
`;
}

/** Script de la tarjeta de hábito (habito.lua). Lua 5.1 de Rainmeter. */
export function skinHabitoLua(): string {
  return `-- StoaHabit · tarjeta de un hábito: racha y las últimas 5 semanas.
local ultimo, dia = nil, nil
local habitos = {}

local function v(nombre) return SKIN:GetVariable(nombre) or '' end
local function poner(meter, opcion, valor) SKIN:Bang('!SetOption', meter, opcion, valor) end

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
  if n <= 0 then return '0' end
  if n > 3999 then return tostring(n) end
  local tabla = { {1000,'M'},{900,'CM'},{500,'D'},{400,'CD'},{100,'C'},{90,'XC'},{50,'L'},{40,'XL'},{10,'X'},{9,'IX'},{5,'V'},{4,'IV'},{1,'I'} }
  local r = ''
  for _, p in ipairs(tabla) do while n >= p[1] do r = r .. p[2]; n = n - p[1] end end
  return r
end
local NOMBRE_VIRTUD = { sabiduria = 'SABIDURÍA', coraje = 'CORAJE', justicia = 'JUSTICIA', templanza = 'TEMPLANZA' }
local VAR_VIRTUD = { sabiduria = 'Sabiduria', coraje = 'Coraje', justicia = 'Justicia', templanza = 'Templanza' }
local NOMBRE_TIPO = { sino = 'SÍ / NO', cantidad = 'CANTIDAD', medicion = 'MEDICIÓN', lista = 'LISTA' }

-- Días desde 1970 de una fecha AAAA-MM-DD (para saber qué casilla es hoy)
local function diaNumero(f)
  local a, m, d = f:match('(%d+)-(%d+)-(%d+)')
  if not a then return nil end
  return math.floor(os.time({ year = tonumber(a), month = tonumber(m), day = tonumber(d), hour = 12 }) / 86400)
end

function Initialize() end

function Estado(cual)
  poner('MeterSub', 'Text', cual == 'sin-conexion' and 'SIN CONEXIÓN' or 'ABRÍ STOAHABIT PARA ACTUALIZAR')
  SKIN:Bang('!UpdateMeter', 'MeterSub')
  SKIN:Bang('!Redraw')
end

local function indice()
  local n = #habitos
  if n == 0 then return 0 end
  local i = tonumber(v('Indice')) or 1
  return ((i - 1) % n) + 1
end

function Mover(paso)
  local n = #habitos
  if n == 0 then return end
  local i = ((indice() - 1 + paso) % n) + 1
  SKIN:Bang('!SetVariable', 'Indice', tostring(i))
  SKIN:Bang('!WriteKeyValue', 'Variables', 'Indice', tostring(i))
  ultimo = nil
end

-- Tamaño (E) y vista (mes = 5 semanas, semana = solo esta)
local function E() return tonumber(v('E')) or 1 end
local function n(x) return string.format('%.1f', x * E()) end
local function esSemana() return v('Vista') == 'semana' end

local function celdas(dias, hoyIdx)
  local s = {}
  local function agregar(x) s[#s + 1] = x end
  local verde, rojo, gris, tenue, oro, marfil = v('Verde'), v('Rojo'), v('Gris'), v('Tenue'), v('Oro'), v('Marfil')
  local desde = esSemana() and 29 or 1
  local function caja(x, y, relleno, borde) return 'Rectangle ' .. n(x) .. ',' .. n(y) .. ',' .. n(30) .. ',' .. n(30) .. ',' .. n(7) .. ' | Fill Color ' .. relleno .. ' | ' .. borde end
  local function raya(x1, y1, x2, y2, g) return 'Line ' .. n(x1) .. ',' .. n(y1) .. ',' .. n(x2) .. ',' .. n(y2) .. ' | StrokeWidth ' .. g .. ' | Stroke Color ' .. marfil end
  for i = desde, 35 do
    local c = dias:sub(i, i)
    local col, fila = (i - 1) % 7, math.floor((i - desde) / 7)
    local x, y = col * 36, fila * 36
    if c == '1' then
      agregar(caja(x, y, verde .. ',70', 'StrokeWidth 1.5 | Stroke Color ' .. verde))
      agregar(raya(x + 8, y + 16, x + 13, y + 21, 2))
      agregar(raya(x + 13, y + 21, x + 22, y + 10, 2))
    elseif c == '0' then
      agregar(caja(x, y, rojo .. ',45', 'StrokeWidth 1.5 | Stroke Color ' .. rojo))
      agregar(raya(x + 10, y + 10, x + 20, y + 20, 1.8))
      agregar(raya(x + 20, y + 10, x + 10, y + 20, 1.8))
    elseif c == 'p' then
      agregar(caja(x, y, '0,0,0,1', 'StrokeWidth 1.5 | Stroke Color ' .. gris))
    elseif c == '-' then
      agregar(caja(x, y, tenue, 'StrokeWidth 0'))
    else
      agregar(caja(x, y, '0,0,0,1', 'StrokeWidth 1 | Stroke Color ' .. tenue))
    end
    if i == hoyIdx then
      agregar('Rectangle ' .. n(x - 3) .. ',' .. n(y - 3) .. ',' .. n(36) .. ',' .. n(36) .. ',' .. n(9) .. ' | Fill Color 0,0,0,0 | StrokeWidth 2 | Stroke Color ' .. oro)
    end
  end
  return s
end

-- Acomoda el pie y el fondo según cuántas semanas se ven
local function Acomodar()
  local filas = esSemana() and 1 or 5
  local alto = filas * 36 - 6
  local raya = 100 + alto + 12
  poner('MeterGrilla', 'Shape', 'Rectangle 0,0,' .. n(246) .. ',' .. n(alto) .. ' | Fill Color 0,0,0,1 | StrokeWidth 0')
  poner('MeterRaya', 'Y', n(raya))
  poner('MeterPie', 'Y', n(raya + 11))
  poner('MeterAccion', 'Y', n(raya + 8))
  poner('MeterFondo', 'Shape', 'Rectangle 0,0,' .. n(tonumber(v('Ancho')) or 300) .. ',' .. n(raya + 40) .. ',' .. n(16) .. ' | Fill Color ' .. v('Fondo') .. ' | StrokeWidth 1 | Stroke Color ' .. v('Linea'))
end

function Vista(cual)
  SKIN:Bang('!SetVariable', 'Vista', cual)
  SKIN:Bang('!WriteKeyValue', 'Variables', 'Vista', cual)
  ultimo = nil
end

local maxFormas = 0

local function Pintar(texto, hoy)
  local partes = partir(texto, '~')
  local cab = partir(partes[1] or '', '|')
  habitos = {}
  for i = 2, #partes do habitos[#habitos + 1] = partir(partes[i], '|') end
  local fecha, lunes = cab[3] or '', cab[5] or ''
  local esHoy = (fecha == hoy)
  local i = indice()
  local h = habitos[i]
  if not h then
    poner('MeterNombre', 'Text', 'StoaHabit')
    poner('MeterSub', 'Text', texto == '' and 'CARGANDO…' or 'HOY NO HAY PRÁCTICAS')
    poner('MeterRacha', 'Text', '')
    poner('MeterInicial', 'Text', '')
    Acomodar()
    SKIN:Bang('!UpdateMeter', '*')
    SKIN:Bang('!Redraw')
    return
  end
  local virtud = h[5] or 'sabiduria'
  local color = v(VAR_VIRTUD[virtud] or 'Oro')
  local nombre = h[2] or ''
  poner('MeterNombre', 'Text', nombre)
  poner('MeterNombre', 'LeftMouseUpAction', '["' .. v('App') .. '/habitos/' .. (h[1] or '') .. '"]')
  poner('MeterInicial', 'Text', string.upper(nombre:sub(1, 1)))
  poner('MeterInicial', 'FontColor', color)
  poner('MeterCirculo', 'Shape', 'Ellipse 22,22,22 | Fill Color ' .. color .. ',30 | StrokeWidth 1.5 | Stroke Color ' .. color)
  poner('MeterSub', 'Text', (NOMBRE_VIRTUD[virtud] or '') .. ' · ' .. (NOMBRE_TIPO[h[6] or ''] or ''))
  poner('MeterSub', 'FontColor', color)
  local rom = romano(tonumber(h[4] or '0') or 0)
  poner('MeterRacha', 'Text', rom)
  poner('MeterRacha', 'FontSize', string.format('%.1f', (#rom > 4 and 15 or 20) * E()))
  poner('MeterRacha', 'Y', string.format('%.1f', (#rom > 4 and 14 or 10) * E()))
  -- El número de la racha va centrado sobre "RACHA"; si es largo (XXVIII) se corre a la izquierda para no salirse
  SKIN:Bang('!UpdateMeter', 'MeterRacha')
  SKIN:Bang('!UpdateMeter', 'MeterRachaTexto')
  local mr, mt = SKIN:GetMeter('MeterRacha'), SKIN:GetMeter('MeterRachaTexto')
  local ancho = math.max(mr and mr:GetW() or 0, mt and mt:GetW() or 0)
  local centro = math.min(264 * E(), 284 * E() - ancho / 2)
  poner('MeterRacha', 'X', string.format('%.1f', centro))
  poner('MeterRachaTexto', 'X', string.format('%.1f', centro))
  -- El nombre y la virtud se cortan antes de llegar a la racha
  local libre = string.format('%.1f', math.max(40 * E(), centro - ancho / 2 - 8 * E() - 72 * E()))
  poner('MeterNombre', 'W', libre)
  poner('MeterSub', 'W', libre)
  local dias = h[7] or ''
  local hoyIdx = 0
  if esHoy and lunes ~= '' then
    local a, b = diaNumero(lunes), diaNumero(hoy)
    if a and b then hoyIdx = b - a + 1 end
  end
  local formas = celdas(dias, hoyIdx)
  Acomodar()
  for k, f in ipairs(formas) do poner('MeterGrilla', 'Shape' .. (k + 1), f) end
  for k = #formas + 2, maxFormas + 1 do poner('MeterGrilla', 'Shape' .. k, 'Rectangle 0,0,0,0 | StrokeWidth 0') end
  if #formas > maxFormas then maxFormas = #formas end
  local pie = '30 DÍAS · ' .. (h[8] or '0') .. '%'
  if esSemana() then
    local hechos = 0
    for k = 29, 35 do if dias:sub(k, k) == '1' then hechos = hechos + 1 end end
    pie = 'ESTA SEMANA · ' .. hechos .. '/7'
  end
  if not esHoy and fecha ~= '' then pie = pie .. ' · DEL ' .. fecha:sub(9, 10) .. '/' .. fecha:sub(6, 7) end
  poner('MeterPie', 'Text', pie)
  local pendiente = esHoy and h[3] ~= '1'
  poner('MeterAccion', 'Text', pendiente and 'Marcar hoy ◇' or 'Ver detalle ›')
  poner('MeterAccion', 'LeftMouseUpAction', '["' .. v('App') .. '/habitos/' .. (h[1] or '') .. '"]')
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

/** Lee los colores de la familia que la página ya tiene cargados (verde, rojo ladrillo y los de cada virtud). */
function coloresDeLaFamilia(): ColoresWidget {
  const estilo = getComputedStyle(document.documentElement);
  const c = document.createElement('canvas').getContext('2d')!;
  const leer = (nombre: string, respaldo: string) => {
    c.fillStyle = respaldo;
    const v = estilo.getPropertyValue(nombre).trim();
    if (v) c.fillStyle = v;
    return aRainmeter(String(c.fillStyle));
  };
  return {
    verde: leer('--verde', COLORES_ICONO.laurel),
    rojo: leer('--miss', COLORES_ICONO.laurel),
    virtudes: { sabiduria: leer('--serie-1', COLORES_ICONO.laurel), coraje: leer('--serie-2', COLORES_ICONO.laurel), justicia: leer('--serie-4', COLORES_ICONO.laurel), templanza: leer('--serie-6', COLORES_ICONO.laurel) },
  };
}

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
    { nombre: 'Skins/StoaHabit/@Resources/habito.lua', datos: utf16le(skinHabitoLua()) },
  ];
  const colores = coloresDeLaFamilia();
  for (let n = 1; n <= TARJETAS; n++) {
    archivos.push({ nombre: `Skins/StoaHabit/Habito${n}/Habito.ini`, datos: utf16le(skinHabitoIni(proyecto, codigo, n, colores)) });
  }
  // Jardín completo (v2.11.0): su skin, su script y las imágenes pasadas a PNG/JPG (Rainmeter no lee WebP)
  const url = `https://firestore.googleapis.com/v1/projects/${proyecto}/databases/(default)/documents/escritorio/${codigo}`;
  const cj: ColoresJardin = {
    fondo: aRainmeter(COLORES_ICONO.fondo),
    oro: aRainmeter(COLORES_ICONO.laurel),
    marfil: aRainmeter(COLORES_ICONO.figura),
    noche: aRainmeter(tinte(22).color),
    amanecer: aRainmeter(tinte(6).color),
    atardecer: aRainmeter(tinte(18).color),
    sombra: '45,28,10', // familia-ok: la sombra de las macetas, igual que en la escena del jardín
  };
  archivos.push(
    { nombre: 'Skins/StoaHabit/Jardin/Jardin.ini', datos: utf16le(skinJardinIni(url, DIRECCION, cj)) },
    { nombre: 'Skins/StoaHabit/@Resources/jardin.lua', datos: utf16le(skinJardinLua()) },
    ...(await imagenesJardinPng()),
  );
  return new Blob([armarRmskin(archivos)], { type: 'application/octet-stream' });
}

/** Baja cada imagen del jardín de la app, la achica y la pasa a PNG (o JPG el fondo). También la medalla de laurel. */
async function imagenesJardinPng(): Promise<Array<{ nombre: string; datos: Uint8Array }>> {
  const pasar = async (img: CanvasImageSource & { width: number; height: number }, ancho: number, jpg: boolean) => {
    const w = Math.min(ancho, img.width);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = Math.max(1, Math.round((img.height * w) / img.width));
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const b = await new Promise<Blob>((ok, mal) => c.toBlob((x) => (x ? ok(x) : mal(new Error('No se pudo armar una imagen del jardín.'))), jpg ? 'image/jpeg' : 'image/png', 0.86));
    return new Uint8Array(await b.arrayBuffer());
  };
  const salida = await Promise.all(
    imagenesJardin().map(async (i) => {
      const r = await fetch(i.desde);
      if (!r.ok) throw new Error(`Falta la imagen ${i.desde}.`);
      const bmp = await createImageBitmap(await r.blob());
      const datos = await pasar(bmp, i.ancho, !!i.jpg);
      bmp.close();
      return { nombre: `Skins/StoaHabit/@Resources/jardin/${i.nombre}.${i.jpg ? 'jpg' : 'png'}`, datos };
    }),
  );
  // La medalla de laurel (es un dibujo de la app): se pasa a PNG
  const [{ renderToStaticMarkup }, { createElement }, { Medalla }] = await Promise.all([import('react-dom/server'), import('react'), import('@/screens/jardin/Graficos')]);
  let svg = renderToStaticMarkup(createElement(Medalla, { tipo: 'Oro', dias: 100, tam: 96 }));
  if (!svg.includes('xmlns=')) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  salida.push({ nombre: 'Skins/StoaHabit/@Resources/jardin/medalla.png', datos: await pasar(img, 96, false) });
  return salida;
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
export async function subirResumenEscritorio(codigo: string, uid: string, texto: { clave: string; texto: string }, forzar = false, jardin = '') {
  const marca = `${codigo}:${texto.clave}:${jardin}`;
  if (!forzar && leerUltimo() === marca) return;
  const d = await obtenerDriver();
  await d.guardar(`escritorio/${codigo}`, { uid, t: texto.texto, j: jardin, actualizado: Date.now() });
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
    // El jardín completo (v2.11.0): misma ubicación que en la app, con lo guardado en este dispositivo
    let jardin = '';
    try {
      jardin = armarJardinEscritorio({ habitos, registros, hoy, g: leerGuardado(uid) });
    } catch {
      /* si algo falla, el widget del jardín queda como estaba */
    }
    const t = setTimeout(() => void subirResumenEscritorio(codigo, uid, texto, false, jardin).catch(() => undefined), 3000);
    return () => clearTimeout(t);
  }, [codigo, uid, listo, habitos, registros, hoy, nombre]);
}
