/**
 * Hábitos, registros diarios, rachas, porcentajes, hitos y mediciones.
 * Lógica pura: la usan la web (@core) y las funciones.
 */
import { diaSemanaDeClave, diferenciaDias, esClaveDia, esHora, sumarDias } from './fechas.js';
import { limpiarNombre } from './validaciones.js';

export const VIRTUDES = ['sabiduria', 'coraje', 'justicia', 'templanza'] as const;
export type Virtud = (typeof VIRTUDES)[number];
export const NOMBRE_VIRTUD: Record<Virtud, string> = { sabiduria: 'Sabiduría', coraje: 'Coraje', justicia: 'Justicia', templanza: 'Templanza' };
/** Para ayudar a elegir: qué tipo de hábitos encajan con cada virtud. */
export const EJEMPLOS_VIRTUD: Record<Virtud, string> = {
  sabiduria: 'leer, estudiar, meditar, escribir un diario, aprender un idioma',
  coraje: 'entrenar, ducha fría, madrugar, hacer lo que venís postergando',
  justicia: 'tiempo con la familia, ayudar a alguien, cumplir tu palabra, ser puntual',
  templanza: 'comer bien, tomar agua, sin azúcar, menos pantallas, ahorrar',
};
/** Nombre corto de cada grupo de íconos (para las pestañas en el celular). */
export const GRUPO_CORTO: Record<string, string> = {
  'Cuerpo y movimiento': 'Cuerpo',
  'Salud y medidas': 'Salud',
  'Alimentación y hogar': 'Comida y hogar',
  Mente: 'Mente',
  Disciplina: 'Disciplina',
};

export const DETALLE_VIRTUD: Record<Virtud, string> = {
  sabiduria: 'Pensar con claridad, aprender, discernir',
  coraje: 'Hacer lo difícil, sostener el esfuerzo',
  justicia: 'Cumplir con los demás y con tu deber',
  templanza: 'Moderación, autocontrol, medida',
};

export const TIPOS = ['sino', 'cantidad', 'medicion', 'lista'] as const;
export type TipoHabito = (typeof TIPOS)[number];
export const NOMBRE_TIPO: Record<TipoHabito, string> = { sino: 'Sí / No', cantidad: 'Cantidad', medicion: 'Medición', lista: 'Lista' };

export const DIRECCIONES = ['bajar', 'subir', 'mantener'] as const;
export type Direccion = (typeof DIRECCIONES)[number];

export type Momento = 0 | 1 | 2;

/** 60 íconos en 5 grupos de 12 (los dibujos están en la web). */
export const GRUPOS_ICONOS: Array<[string, Array<[string, string]>]> = [
  ['Cuerpo y movimiento', [['run', 'Correr'], ['walk', 'Caminar'], ['bike', 'Bicicleta'], ['swim', 'Nadar'], ['weights', 'Pesas'], ['yoga', 'Yoga'], ['futbol', 'Fútbol'], ['montana', 'Montaña'], ['estirar', 'Estirar'], ['saltar', 'Saltar la cuerda'], ['boxeo', 'Boxeo'], ['pasos', 'Pasos']]],
  ['Salud y medidas', [['scale', 'Balanza'], ['ruler', 'Medidas'], ['heart', 'Corazón'], ['pill', 'Medicación'], ['tooth', 'Dientes'], ['cold', 'Ducha fría'], ['ojo', 'Vista'], ['termometro', 'Temperatura'], ['vendaje', 'Curita'], ['respirar', 'Respirar'], ['ducha', 'Ducha'], ['sinalcohol', 'Sin alcohol']]],
  ['Alimentación y hogar', [['food', 'Comer bien'], ['water', 'Agua'], ['coffee', 'Café'], ['nosugar', 'Sin azúcar'], ['plant', 'Plantas'], ['home', 'Hogar'], ['ensalada', 'Ensalada'], ['zanahoria', 'Verduras'], ['olla', 'Cocinar'], ['escoba', 'Limpiar'], ['caja', 'Ordenar'], ['mascota', 'Mascota']]],
  ['Mente', [['med', 'Meditar'], ['read', 'Leer'], ['write', 'Escribir'], ['lang', 'Idiomas'], ['music', 'Música'], ['code', 'Programar'], ['idea', 'Idea'], ['estudio', 'Estudiar'], ['auriculares', 'Escuchar'], ['paleta', 'Arte'], ['fotografia', 'Fotografía'], ['vela', 'Oración']]],
  ['Disciplina', [['sleep', 'Dormir'], ['sun', 'Madrugar'], ['nophone', 'Sin pantallas'], ['nosmoke', 'Sin fumar'], ['money', 'Ahorrar'], ['family', 'Familia'], ['alarma', 'Despertador'], ['calendario', 'Planificar'], ['checklist', 'Pendientes'], ['reloj', 'Tiempo'], ['diana', 'Objetivo'], ['cama', 'Tender la cama']]],
];
export const ICONOS: string[] = GRUPOS_ICONOS.flatMap(([, l]) => l.map(([id]) => id));

export interface Variable {
  id: string;
  nombre: string;
  unidad: string;
  inicial: number;
  meta: number;
  direccion: Direccion;
}

export interface Habito {
  id: string;
  nombre: string;
  tipo: TipoHabito;
  virtud: Virtud;
  icono: string;
  momento: Momento;
  /** Días de la semana activos (0 = domingo). */
  dias: number[];
  meta: number; // cantidad: meta diaria; lista: cuántos ítems alcanzan; otros: 1
  unidad: string; // cantidad: "vasos", "páginas"
  variables: Variable[]; // medición: variables; lista: ítems de sí/no (solo importan id y nombre)
  recordatorio: string | null; // "HH:MM" local (el primero; se mantiene por compatibilidad)
  recordatorioSlot: number | null; // franja UTC de 15 min (versiones anteriores; las nuevas usan `avisos`)
  /** Hasta 3 horas locales "HH:MM", a cualquier minuto. */
  recordatorios?: string[];
  /** Minutos del día en UTC de cada recordatorio, para que el servidor los encuentre. */
  avisos?: number[];
  inicio: string; // clave de día
  archivado: boolean;
  orden: number;
  racha: number; // última racha conocida (para rachas más largas que la ventana cargada)
  mejorRacha: number;
  creado: number;
  actualizado: number;
  actualizadoPor: string;
}

/** logs/{habitId}_{AAAA-MM-DD}: uno por hábito y día. */
export interface Registro {
  habitId: string;
  fecha: string;
  hecho: boolean; // sino
  valor: number; // cantidad; lista: cuántos ítems se cumplieron
  medidas: Record<string, number>; // medición: {variableId: valor}; lista: {itemId: 1}
  nota: string;
  actualizado: number;
  actualizadoPor: string;
}

export const idRegistro = (habitId: string, fecha: string) => `${habitId}_${fecha}`;

export const MAX_RECORDATORIOS = 3;

/** Horas de recordatorio de un hábito (las nuevas, o la única de versiones anteriores), ordenadas. */
export function horasRecordatorio(h: Pick<Habito, 'recordatorio'> & { recordatorios?: string[] }): string[] {
  const hs = h.recordatorios ?? (h.recordatorio ? [h.recordatorio] : []);
  return [...hs].sort();
}

export const LIMITES_HABITO = { nombreMax: 40, unidadMax: 16, metaMax: 100000, variablesMax: 4, itemsMin: 2, itemsMax: 6, itemNombreMax: 24, notaMax: 500, habitosMax: 40, valorMax: 100000 } as const;

export const HITOS = [3, 7, 14, 21, 30, 60, 100, 180, 365, 500, 1000] as const;

export function registroVacio(habitId: string, fecha: string, uid: string): Registro {
  return { habitId, fecha, hecho: false, valor: 0, medidas: {}, nota: '', actualizado: Date.now(), actualizadoPor: uid };
}

export function esDiaActivo(h: Pick<Habito, 'dias' | 'inicio'>, clave: string): boolean {
  return clave >= h.inicio && h.dias.includes(diaSemanaDeClave(clave));
}

export function cumplido(h: Pick<Habito, 'tipo' | 'meta'>, r: Partial<Registro> | undefined | null): boolean {
  if (!r) return false;
  if (h.tipo === 'sino') return r.hecho === true;
  if (h.tipo === 'cantidad' || h.tipo === 'lista') return (r.valor ?? 0) >= Math.max(1, h.meta);
  return !!r.medidas && Object.keys(r.medidas).length > 0;
}

/** Progreso 0..1 del día (cantidad muestra cuánto va). */
export function progreso(h: Pick<Habito, 'tipo' | 'meta'>, r: Partial<Registro> | undefined | null): number {
  if (!r) return 0;
  if (h.tipo === 'cantidad' || h.tipo === 'lista') return Math.min(1, (r.valor ?? 0) / Math.max(1, h.meta));
  return cumplido(h, r) ? 1 : 0;
}

// ---------- Listas (varios sí/no en un hábito) ----------
/** Ítem nuevo de una lista: se guarda con la forma de una variable, sin unidad ni meta. */
export function itemLista(id: string, nombre: string): Variable {
  return { id, nombre, unidad: '', inicial: 0, meta: 0, direccion: 'mantener' };
}

/** Ítems de la lista cumplidos ese día (solo cuentan los que siguen en el hábito). */
export function itemsHechos(h: Pick<Habito, 'variables'>, r: Partial<Registro> | undefined | null): string[] {
  if (!r?.medidas) return [];
  return h.variables.filter((v) => r.medidas![v.id] === 1).map((v) => v.id);
}

/** Cambia un ítem y devuelve lo que hay que guardar en el registro (medidas, cuántos, hecho). */
export function alternarItem(h: Pick<Habito, 'variables' | 'meta'>, r: Partial<Registro> | undefined | null, itemId: string): Pick<Registro, 'medidas' | 'valor' | 'hecho'> {
  const medidas: Record<string, number> = {};
  for (const id of itemsHechos(h, r)) medidas[id] = 1;
  if (medidas[itemId]) delete medidas[itemId];
  else medidas[itemId] = 1;
  const valor = Object.keys(medidas).length;
  return { medidas, valor, hecho: valor >= Math.max(1, h.meta) };
}

export type MapaRegistros = Map<string, Registro> | Record<string, Registro>;
const leer = (m: MapaRegistros, fecha: string): Registro | undefined => (m instanceof Map ? m.get(fecha) : m[fecha]);

/**
 * Racha actual: días activos seguidos cumplidos, contando hacia atrás desde hoy.
 * Si hoy todavía no se cumplió, no corta la racha (se cuenta desde ayer).
 * `ventana` limita cuántos días mira; si la racha llega al borde, se usa la racha guardada en el hábito.
 */
export function racha(h: Habito, registros: MapaRegistros, hoy: string, ventana = 400): number {
  let n = 0;
  let dia = hoy;
  if (esDiaActivo(h, hoy) && !cumplido(h, leer(registros, hoy))) dia = sumarDias(hoy, -1);
  for (let i = 0; i < ventana; i++, dia = sumarDias(dia, -1)) {
    if (dia < h.inicio) return n;
    if (!esDiaActivo(h, dia)) continue;
    if (cumplido(h, leer(registros, dia))) n++;
    else return n;
  }
  return Math.max(n, h.racha);
}

/** Mejor racha dentro de los registros cargados (o la guardada si es mayor). */
export function mejorRacha(h: Habito, registros: MapaRegistros, hoy: string, ventana = 400): number {
  let mejor = 0;
  let actual = 0;
  const desde = h.inicio > sumarDias(hoy, -ventana) ? h.inicio : sumarDias(hoy, -ventana);
  for (let dia = desde; dia <= hoy; dia = sumarDias(dia, 1)) {
    if (!esDiaActivo(h, dia)) continue;
    if (cumplido(h, leer(registros, dia))) {
      actual++;
      mejor = Math.max(mejor, actual);
    } else if (dia !== hoy) actual = 0;
  }
  return Math.max(mejor, h.mejorRacha, racha(h, registros, hoy, ventana));
}

/** Porcentaje de días activos cumplidos entre dos fechas (sin contar hoy si todavía no se cumplió). */
export function porcentaje(h: Habito, registros: MapaRegistros, desde: string, hasta: string): number {
  let activos = 0;
  let hechos = 0;
  const inicio = desde < h.inicio ? h.inicio : desde;
  for (let dia = inicio; dia <= hasta; dia = sumarDias(dia, 1)) {
    if (!esDiaActivo(h, dia)) continue;
    const ok = cumplido(h, leer(registros, dia));
    if (dia === hasta && !ok) continue;
    activos++;
    if (ok) hechos++;
  }
  return activos === 0 ? 0 : Math.round((hechos / activos) * 100);
}

/** Lista: porcentaje de días activos en que se cumplió cada ítem (hoy solo cuenta si ya se marcó). */
export function porcentajeItems(h: Habito, registros: MapaRegistros, desde: string, hasta: string): Array<{ id: string; nombre: string; porcentaje: number }> {
  const inicio = desde < h.inicio ? h.inicio : desde;
  return h.variables.map((v) => {
    let activos = 0;
    let hechos = 0;
    for (let dia = inicio; dia <= hasta; dia = sumarDias(dia, 1)) {
      if (!esDiaActivo(h, dia)) continue;
      const si = leer(registros, dia)?.medidas?.[v.id] === 1;
      if (dia === hasta && !si) continue;
      activos++;
      if (si) hechos++;
    }
    return { id: v.id, nombre: v.nombre, porcentaje: activos === 0 ? 0 : Math.round((hechos / activos) * 100) };
  });
}

/** Estado de un día para el calendario. */
export function estadoDia(h: Habito, registros: MapaRegistros, dia: string, hoy: string): 'ok' | 'mal' | 'pendiente' | 'futuro' | 'inactivo' {
  if (dia > hoy) return 'futuro';
  if (!esDiaActivo(h, dia)) return 'inactivo';
  if (cumplido(h, leer(registros, dia))) return 'ok';
  return dia === hoy ? 'pendiente' : 'mal';
}

/** Hito alcanzado al pasar de una racha a otra (o null). */
export function hitoAlcanzado(antes: number, despues: number): number | null {
  if (despues <= antes) return null;
  const h = [...HITOS].reverse().find((x) => x <= despues && x > antes);
  return h ?? null;
}

// ---------- Mediciones ----------
export interface Punto {
  fecha: string;
  valor: number;
}

export interface Proyeccion {
  inicial: number;
  actual: number | null;
  cambio: number | null; // actual - inicial
  ritmoSemanal: number | null; // por semana (regresión lineal)
  faltan: number | null; // distancia a la meta (positiva)
  fechaEstimada: string | null;
  alcanzada: boolean;
  avance: number; // 0..1
}

export function serieDeVariable(variableId: string, registros: Registro[]): Punto[] {
  return registros
    .filter((r) => typeof r.medidas?.[variableId] === 'number')
    .map((r) => ({ fecha: r.fecha, valor: r.medidas[variableId] }))
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
}

export function proyectar(v: Variable, puntos: Punto[], hoy: string): Proyeccion {
  const actual = puntos.length ? puntos[puntos.length - 1].valor : null;
  const base = { inicial: v.inicial, actual, cambio: actual === null ? null : redondear(actual - v.inicial) };
  const alcanzada =
    actual !== null &&
    (v.direccion === 'bajar' ? actual <= v.meta : v.direccion === 'subir' ? actual >= v.meta : Math.abs(actual - v.meta) <= Math.max(0.5, Math.abs(v.meta) * 0.01));
  const total = Math.abs(v.meta - v.inicial);
  const recorrido = actual === null ? 0 : v.direccion === 'bajar' ? v.inicial - actual : v.direccion === 'subir' ? actual - v.inicial : total - Math.abs(actual - v.meta);
  const avance = total === 0 ? (alcanzada ? 1 : 0) : Math.max(0, Math.min(1, recorrido / total));
  const faltan = actual === null ? null : redondear(Math.abs(v.meta - actual));

  let ritmoSemanal: number | null = null;
  let fechaEstimada: string | null = null;
  if (puntos.length >= 2) {
    const x0 = puntos[0].fecha;
    const xs = puntos.map((p) => diferenciaDias(x0, p.fecha));
    const ys = puntos.map((p) => p.valor);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0;
    let den = 0;
    xs.forEach((x, i) => {
      num += (x - mx) * (ys[i] - my);
      den += (x - mx) ** 2;
    });
    if (den > 0) {
      const pendiente = num / den; // por día
      ritmoSemanal = redondear(pendiente * 7);
      const vaBien = v.direccion === 'bajar' ? pendiente < 0 : v.direccion === 'subir' ? pendiente > 0 : false;
      if (!alcanzada && vaBien && actual !== null) {
        const dias = Math.ceil(Math.abs(v.meta - actual) / Math.abs(pendiente));
        if (Number.isFinite(dias) && dias < 3650) fechaEstimada = sumarDias(hoy, dias);
      }
    }
  }
  return { ...base, ritmoSemanal, faltan, fechaEstimada, alcanzada, avance };
}

export const redondear = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/** "1,5" o "1.5" → 1.5 ; vacío o inválido → NaN */
export function aNumero(s: string): number {
  if (s.trim() === '') return NaN;
  return Number(s.replace(',', '.').trim());
}

export function formatoNumero(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return redondear(n).toLocaleString('es-PY', { maximumFractionDigits: 1 });
}

export function conSigno(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const r = redondear(n);
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${formatoNumero(Math.abs(r))}`;
}

// ---------- Validación ----------
export type ErrorValidacion = string | null;

export function validarHabito(h: Partial<Habito>): ErrorValidacion {
  const nombre = limpiarNombre(h.nombre ?? '');
  if (!nombre) return 'Ponele un nombre al hábito.';
  if (nombre.length > LIMITES_HABITO.nombreMax) return `El nombre puede tener hasta ${LIMITES_HABITO.nombreMax} letras.`;
  if (!h.tipo || !TIPOS.includes(h.tipo)) return 'Elegí el tipo de hábito.';
  if (!h.virtud || !VIRTUDES.includes(h.virtud)) return 'Elegí qué virtud cultiva.';
  if (!h.icono || !ICONOS.includes(h.icono)) return 'Elegí un ícono.';
  if (h.momento === undefined || ![0, 1, 2].includes(h.momento)) return 'Elegí en qué momento del día.';
  if (!h.dias || h.dias.length === 0 || h.dias.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return 'Elegí al menos un día de la semana.';
  if (h.tipo === 'cantidad') {
    if (!Number.isInteger(h.meta) || (h.meta ?? 0) < 1 || (h.meta ?? 0) > LIMITES_HABITO.metaMax) return `La meta diaria tiene que ser un número entero entre 1 y ${LIMITES_HABITO.metaMax}.`;
    if ((h.unidad ?? '').length > LIMITES_HABITO.unidadMax) return 'La unidad es muy larga.';
  }
  if (h.tipo === 'lista') {
    const vs = h.variables ?? [];
    if (vs.length < LIMITES_HABITO.itemsMin) return `Una lista necesita al menos ${LIMITES_HABITO.itemsMin} ítems (por ejemplo, Almuerzo y Cena).`;
    if (vs.length > LIMITES_HABITO.itemsMax) return `Una lista puede tener hasta ${LIMITES_HABITO.itemsMax} ítems.`;
    for (const v of vs) {
      if (!limpiarNombre(v.nombre)) return 'Cada ítem de la lista necesita un nombre.';
      if (v.nombre.length > LIMITES_HABITO.itemNombreMax) return `El nombre de un ítem puede tener hasta ${LIMITES_HABITO.itemNombreMax} letras.`;
    }
    if (new Set(vs.map((v) => limpiarNombre(v.nombre).toLowerCase())).size !== vs.length) return 'Hay dos ítems con el mismo nombre.';
    if (!Number.isInteger(h.meta) || (h.meta ?? 0) < 1 || (h.meta ?? 0) > vs.length) return `Elegí cuántos ítems alcanzan para cumplir (entre 1 y ${vs.length}).`;
  }
  if (h.tipo === 'medicion') {
    const vs = h.variables ?? [];
    if (vs.length === 0) return 'Agregá al menos una variable para medir (por ejemplo, peso).';
    if (vs.length > LIMITES_HABITO.variablesMax) return `Podés medir hasta ${LIMITES_HABITO.variablesMax} variables.`;
    for (const v of vs) {
      if (!limpiarNombre(v.nombre)) return 'Cada variable necesita un nombre.';
      if (v.nombre.length > 24 || v.unidad.length > LIMITES_HABITO.unidadMax) return 'El nombre o la unidad de una variable es muy largo.';
      if (!Number.isFinite(v.inicial) || !Number.isFinite(v.meta)) return `Completá el valor inicial y la meta de ${v.nombre}.`;
      if (!DIRECCIONES.includes(v.direccion)) return `Elegí si ${v.nombre} tiene que bajar, subir o mantenerse.`;
    }
  }
  if (h.recordatorio !== null && h.recordatorio !== undefined && !esHora(h.recordatorio)) return 'La hora del recordatorio no es válida.';
  if (h.recordatorios) {
    if (h.recordatorios.length > MAX_RECORDATORIOS) return `Podés poner hasta ${MAX_RECORDATORIOS} recordatorios por hábito.`;
    if (h.recordatorios.some((x) => !esHora(x))) return 'Alguna hora de recordatorio no es válida.';
    if (new Set(h.recordatorios).size !== h.recordatorios.length) return 'Hay dos recordatorios a la misma hora.';
  }
  if (h.inicio && !esClaveDia(h.inicio)) return 'La fecha de inicio no es válida.';
  return null;
}

export function validarValor(n: number): ErrorValidacion {
  if (!Number.isFinite(n)) return 'Escribí un número.';
  if (Math.abs(n) > LIMITES_HABITO.valorMax) return 'Ese número es demasiado grande.';
  return null;
}

// ---------- Plantillas ----------
export interface Plantilla {
  id: string;
  nombre: string;
  detalle: string;
  datos: Pick<Habito, 'nombre' | 'tipo' | 'virtud' | 'icono' | 'momento' | 'meta' | 'unidad'> & { variables: Array<Omit<Variable, 'id' | 'inicial' | 'meta'>> };
}

export const PLANTILLAS: Plantilla[] = [
  { id: 'peso', nombre: 'Bajar de peso', detalle: 'Medición · peso y cintura', datos: { nombre: 'Bajar de peso', tipo: 'medicion', virtud: 'templanza', icono: 'scale', momento: 0, meta: 1, unidad: '', variables: [{ nombre: 'Peso', unidad: 'kg', direccion: 'bajar' }, { nombre: 'Cintura', unidad: 'cm', direccion: 'bajar' }] } },
  { id: 'agua', nombre: 'Beber agua', detalle: 'Cantidad · 8 vasos', datos: { nombre: 'Beber agua', tipo: 'cantidad', virtud: 'templanza', icono: 'water', momento: 1, meta: 8, unidad: 'vasos', variables: [] } },
  { id: 'leer', nombre: 'Leer', detalle: 'Cantidad · 20 páginas', datos: { nombre: 'Leer', tipo: 'cantidad', virtud: 'sabiduria', icono: 'read', momento: 2, meta: 20, unidad: 'páginas', variables: [] } },
  { id: 'meditar', nombre: 'Meditar', detalle: 'Sí / No · al amanecer', datos: { nombre: 'Meditar', tipo: 'sino', virtud: 'sabiduria', icono: 'med', momento: 0, meta: 1, unidad: '', variables: [] } },
  { id: 'ejercicio', nombre: 'Entrenar', detalle: 'Sí / No · durante el día', datos: { nombre: 'Entrenar', tipo: 'sino', virtud: 'coraje', icono: 'weights', momento: 1, meta: 1, unidad: '', variables: [] } },
  { id: 'fria', nombre: 'Ducha fría', detalle: 'Sí / No · al amanecer', datos: { nombre: 'Ducha fría', tipo: 'sino', virtud: 'coraje', icono: 'cold', momento: 0, meta: 1, unidad: '', variables: [] } },
  { id: 'pantallas', nombre: 'Sin pantallas de noche', detalle: 'Sí / No · al anochecer', datos: { nombre: 'Sin pantallas de noche', tipo: 'sino', virtud: 'templanza', icono: 'nophone', momento: 2, meta: 1, unidad: '', variables: [] } },
  { id: 'familia', nombre: 'Tiempo con la familia', detalle: 'Sí / No · al anochecer', datos: { nombre: 'Tiempo con la familia', tipo: 'sino', virtud: 'justicia', icono: 'family', momento: 2, meta: 1, unidad: '', variables: [] } },
  { id: 'escribir', nombre: 'Escribir un diario', detalle: 'Sí / No · al anochecer', datos: { nombre: 'Escribir', tipo: 'sino', virtud: 'sabiduria', icono: 'write', momento: 2, meta: 1, unidad: '', variables: [] } },
  { id: 'comer', nombre: 'Comer bien', detalle: 'Lista · almuerzo, merienda y cena', datos: { nombre: 'Comer bien', tipo: 'lista', virtud: 'templanza', icono: 'food', momento: 1, meta: 3, unidad: '', variables: [{ nombre: 'Almuerzo', unidad: '', direccion: 'mantener' }, { nombre: 'Merienda', unidad: '', direccion: 'mantener' }, { nombre: 'Cena', unidad: '', direccion: 'mantener' }] } },
  { id: 'caminar', nombre: 'Caminar', detalle: 'Cantidad · 30 minutos', datos: { nombre: 'Caminar', tipo: 'cantidad', virtud: 'coraje', icono: 'walk', momento: 1, meta: 30, unidad: 'minutos', variables: [] } },
];

/** Balance de virtudes: % de cumplimiento por virtud en un período. */
export function balanceVirtudes(habitos: Habito[], registrosPorHabito: Map<string, MapaRegistros>, desde: string, hasta: string): Record<Virtud, number | null> {
  const out = { sabiduria: null, coraje: null, justicia: null, templanza: null } as Record<Virtud, number | null>;
  for (const v of VIRTUDES) {
    const hs = habitos.filter((h) => h.virtud === v && !h.archivado);
    if (!hs.length) continue;
    const ps = hs.map((h) => porcentaje(h, registrosPorHabito.get(h.id) ?? new Map(), desde, hasta));
    out[v] = Math.round(ps.reduce((a, b) => a + b, 0) / ps.length);
  }
  return out;
}

// ---------- Hábito sugerido para un desafío ----------
const sinTildes = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const CLAVES_DESAFIO: Array<[RegExp, string]> = [
  [/medit/, 'meditar'],
  [/ducha|fria/, 'fria'],
  [/\blee|leyendo|lectura|libro/, 'leer'],
  [/camin/, 'caminar'],
  [/entren|ejercic|gimnas|gym/, 'ejercicio'],
  [/pantalla|celular|redes/, 'pantallas'],
  [/familia/, 'familia'],
  [/diario|escrib/, 'escribir'],
  [/agua/, 'agua'],
  [/peso|adelgaz/, 'peso'],
  [/comer|comida|aliment/, 'comer'],
];

/**
 * Propone el hábito con el que alguien se suma a un desafío ("21 días meditando" → Meditar).
 * Si reconoce el tema usa la plantilla; si no, arma un Sí/No con el nombre del desafío sin la duración.
 */
export function habitoParaDesafio(titulo: string, virtud: Virtud): Plantilla['datos'] {
  const t = sinTildes(titulo);
  if (/azucar|dulce/.test(t)) return { nombre: 'Sin azúcar', tipo: 'sino', virtud: 'templanza', icono: 'nosugar', momento: 1, meta: 1, unidad: '', variables: [] };
  if (/fumar|cigarr/.test(t)) return { nombre: 'Sin fumar', tipo: 'sino', virtud: 'templanza', icono: 'nosmoke', momento: 1, meta: 1, unidad: '', variables: [] };
  for (const [re, id] of CLAVES_DESAFIO) {
    const p = PLANTILLAS.find((x) => x.id === id);
    if (re.test(t) && p) return { ...p.datos, variables: p.datos.variables.map((v) => ({ ...v })) };
  }
  const limpio = titulo
    .trim()
    .replace(/^(\d+|un|una|dos|tres|cuatro|siete|diez|treinta)\s+(d[ií]as?|semanas?|mes(es)?)\s+(de\s+)?/i, '')
    .trim();
  const nombre = (limpio || titulo.trim()).slice(0, LIMITES_HABITO.nombreMax);
  return { nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1), tipo: 'sino', virtud, icono: 'sun', momento: 1, meta: 1, unidad: '', variables: [] };
}
