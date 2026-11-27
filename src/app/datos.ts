/**
 * Datos del usuario que usan varias pantallas (hábitos, registros recientes, tareas, enfoque, examen).
 * Se sincronizan una sola vez (componente <Sincronizar/>) y se leen desde cualquier pantalla.
 */
import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { claveDia, minutoUTC, sumarDias } from '@core/fechas';
import {
  alternarItem,
  hitoAlcanzado,
  horasRecordatorio,
  idRegistro,
  mejorRacha,
  racha,
  registroVacio,
  type Habito,
  type Registro,
} from '@core/habitos';
import type { Examen, Proyecto, SesionEnfoque, Tarea, TareaHecha } from '@core/rutina';
import { idTareaHecha, tareaHecha } from '@core/rutina';
import { obtenerDriver } from '@/data';
import { mensajeDeError, type ConId } from '@/data/tipos';
import { useAvisos } from '@/ui/avisos';
import { Coleccion, idMarca, type MarcaBorrado } from './sync';

/** Quita de la vista local un documento recién borrado en este dispositivo. */
type ColConMarca = 'habits' | 'tasks' | 'projects';
let quitarLocal: ((col: ColConMarca, id: string) => void) | null = null;
import { useSesion } from './sesion';

/** Días de registros que se mantienen sincronizados (rachas, semana, balance de 30 días). */
export const VENTANA_DIAS = 120;

export type Registros = Map<string, Map<string, Registro>>; // habitId -> fecha -> registro

interface Datos {
  listo: boolean;
  /** Hábitos y registros ya llegaron del servidor (no solo lo guardado en el dispositivo). */
  alDia: boolean;
  habitos: Array<ConId<Habito>>;
  registros: Registros;
  tareas: Array<ConId<Tarea>>;
  proyectos: Array<ConId<Proyecto>>;
  tareasHechas: Set<string>; // ids taskId_fecha
  enfoque: Array<ConId<SesionEnfoque>>;
  examenes: Map<string, Examen>;
  celebracion: { habito: string; dias: number } | null;
  poner: (p: Partial<Omit<Datos, 'poner'>>) => void;
}

export const useDatos = create<Datos>((set) => ({
  listo: false,
  alDia: false,
  habitos: [],
  registros: new Map(),
  tareas: [],
  proyectos: [],
  tareasHechas: new Set(),
  enfoque: [],
  examenes: new Map(),
  celebracion: null,
  poner: (p) => set(p),
}));

/** Clave de "hoy" en la zona del usuario; se actualiza sola a la medianoche. */
export function useHoy(): string {
  const zona = useSesion((s) => s.perfil?.zonaHoraria);
  const [hoy, setHoy] = useState(() => claveDia(new Date(), zona));
  useEffect(() => {
    setHoy(claveDia(new Date(), zona));
    const t = setInterval(() => setHoy(claveDia(new Date(), zona)), 30_000);
    return () => clearInterval(t);
  }, [zona]);
  return hoy;
}

export const uidActual = () => useSesion.getState().usuario?.uid ?? '';
const zonaActual = () => useSesion.getState().perfil?.zonaHoraria ?? 'America/Asuncion';
export const hoyActual = () => claveDia(new Date(), zonaActual());

/** Mantiene sincronizados los datos del usuario mientras la app está abierta. */
export function Sincronizar() {
  const uid = useSesion((s) => s.usuario?.uid);
  const hoy = useHoy();
  const poner = useDatos((s) => s.poner);

  useEffect(() => {
    if (!uid) return;
    const desde = sumarDias(hoy, -VENTANA_DIAS);
    const desde40 = sumarDias(hoy, -40);
    const colecciones: Array<{ iniciar: () => Promise<void>; detener: () => void }> = [];
    let vivo = true;
    let pendientes = 2;
    const marcarListo = () => {
      pendientes--;
      if (pendientes <= 0) poner({ listo: true });
    };
    const fallo = (e: unknown) => useAvisos.getState().mostrar(mensajeDeError(e));
    obtenerDriver().then(async (d) => {
      if (!vivo) return;
      const enVentana = (f: string) => (x: { fecha: string }) => x.fecha >= f;
      const habitos = new Coleccion<Habito>(d, uid, 'habits', [], () => true, (hs) => {
        poner({ habitos: hs.sort((a, b) => a.orden - b.orden || a.creado - b.creado) });
        marcarListo();
      }, fallo);
      const registros = new Coleccion<Registro>(d, uid, 'logs', [['fecha', '>=', desde]], enVentana(desde), (rs) => {
        const m: Registros = new Map();
        for (const r of rs) {
          if (!m.has(r.habitId)) m.set(r.habitId, new Map());
          m.get(r.habitId)!.set(r.fecha, r);
        }
        poner({ registros: m });
        marcarListo();
      }, fallo);
      const tareas = new Coleccion<Tarea>(d, uid, 'tasks', [], () => true, (ts) => poner({ tareas: ts }), fallo);
      const proyectos = new Coleccion<Proyecto>(d, uid, 'projects', [], () => true, (ps) => poner({ proyectos: ps.sort((a, b) => a.creado - b.creado) }), fallo);
      const hechas = new Coleccion<TareaHecha>(d, uid, 'taskDone', [['fecha', '>=', desde40]], enVentana(desde40), (ts) =>
        poner({ tareasHechas: new Set(ts.filter((t) => t.hecha !== false).map((t) => idTareaHecha(t.taskId, t.fecha))) }), fallo);
      const enfoque = new Coleccion<SesionEnfoque>(d, uid, 'focus', [['fecha', '>=', desde40]], enVentana(desde40), (fs) => poner({ enfoque: fs.sort((a, b) => b.inicio - a.inicio) }), fallo);
      const examenes = new Coleccion<Examen>(d, uid, 'journal', [['fecha', '>=', desde40]], enVentana(desde40), (es) => poner({ examenes: new Map(es.map((e) => [e.fecha, e])) }), fallo);
      // Marcas de borrado: quitan de la vista lo que se borró en cualquier dispositivo.
      const marcas = new Coleccion<MarcaBorrado>(d, uid, 'borrados', [], () => true, (ms) => {
        habitos.quitar(ms.filter((m) => m.col === 'habits').map((m) => m.docId));
        tareas.quitar(ms.filter((m) => m.col === 'tasks').map((m) => m.docId));
        proyectos.quitar(ms.filter((m) => m.col === 'projects').map((m) => m.docId));
      }, () => undefined);
      let faltanServidor = 2;
      habitos.alServidor = registros.alServidor = () => {
        faltanServidor--;
        if (faltanServidor <= 0) poner({ alDia: true });
      };
      colecciones.push(habitos, registros, tareas, proyectos, hechas, enfoque, examenes, marcas);
      for (const c of colecciones) {
        if (!vivo) break;
        await c.iniciar();
      }
      if (!vivo) colecciones.forEach((c) => c.detener());
      quitarLocal = (col, id) => (col === 'habits' ? habitos : col === 'tasks' ? tareas : proyectos).quitar([id]);
    });
    return () => {
      vivo = false;
      quitarLocal = null;
      colecciones.forEach((c) => c.detener());
    };
  }, [uid, hoy, poner]);

  return null;
}

// ---------- Selectores ----------
export function useHabitosActivos() {
  const habitos = useDatos((s) => s.habitos);
  return useMemo(() => habitos.filter((h) => !h.archivado), [habitos]);
}

export function registrosDe(registros: Registros, habitId: string): Map<string, Registro> {
  return registros.get(habitId) ?? new Map();
}

// ---------- Acciones ----------
const avisar = (t: string) => useAvisos.getState().mostrar(t);

async function guardar(ruta: string, datos: Record<string, unknown>, combinar = false) {
  try {
    await (await obtenerDriver()).guardar(ruta, datos, { combinar });
  } catch (e) {
    avisar(mensajeDeError(e));
    throw e;
  }
}

async function borrar(ruta: string) {
  try {
    await (await obtenerDriver()).borrar(ruta);
  } catch (e) {
    avisar(mensajeDeError(e));
    throw e;
  }
}

/** Borra un hábito o una tarea y deja la marca para que los demás dispositivos también lo quiten. */
async function borrarConMarca(col: ColConMarca, id: string) {
  const uid = uidActual();
  quitarLocal?.(col, id);
  await guardar(`users/${uid}/borrados/${idMarca(col, id)}`, { col, docId: id, actualizado: Date.now(), actualizadoPor: uid });
  await borrar(`users/${uid}/${col}/${id}`);
}

/** Guarda el registro del día y actualiza racha, mejor racha, hitos y resúmenes de grupos. */
async function guardarRegistro(h: Habito, fecha: string, cambios: Partial<Registro>) {
  const uid = uidActual();
  const { registros } = useDatos.getState();
  const previos = registrosDe(registros, h.id);
  const actual = previos.get(fecha) ?? registroVacio(h.id, fecha, uid);
  const nuevo: Registro = { ...actual, ...cambios, habitId: h.id, fecha, actualizado: Date.now(), actualizadoPor: uid };

  // Cálculo optimista: la pantalla responde al instante.
  const nuevos = new Map(previos);
  nuevos.set(fecha, nuevo);
  const copia: Registros = new Map(registros);
  copia.set(h.id, nuevos);
  useDatos.getState().poner({ registros: copia });

  const hoy = hoyActual();
  const antes = racha(h, previos, hoy, VENTANA_DIAS);
  const despues = racha({ ...h, racha: 0 }, nuevos, hoy, VENTANA_DIAS);
  const mejor = mejorRacha({ ...h, mejorRacha: 0, racha: 0 }, nuevos, hoy, VENTANA_DIAS);

  await guardar(`users/${uid}/logs/${idRegistro(h.id, fecha)}`, nuevo as never);
  if (despues !== h.racha || Math.max(mejor, h.mejorRacha) !== h.mejorRacha) {
    await guardar(`users/${uid}/habits/${h.id}`, { racha: despues, mejorRacha: Math.max(mejor, h.mejorRacha), actualizado: Date.now(), actualizadoPor: uid }, true);
  }
  const hito = hitoAlcanzado(antes, despues);
  if (hito) {
    useDatos.getState().poner({ celebracion: { habito: h.nombre, dias: hito } });
    await guardar(`users/${uid}/milestones/${h.id}_${hito}`, { habitId: h.id, dias: hito, fecha: hoy, actualizado: Date.now(), actualizadoPor: uid });
  }
  programarResumenGrupos();
}

export async function alternarSiNo(h: Habito, fecha: string) {
  const r = registrosDe(useDatos.getState().registros, h.id).get(fecha);
  await guardarRegistro(h, fecha, { hecho: !r?.hecho });
}

export async function sumar(h: Habito, fecha: string, delta: number) {
  const r = registrosDe(useDatos.getState().registros, h.id).get(fecha);
  const valor = Math.max(0, Math.min(200000, (r?.valor ?? 0) + delta));
  await guardarRegistro(h, fecha, { valor });
}

/** Lista: marca o desmarca un ítem (por ejemplo, Almuerzo) y recalcula cuántos van. */
export async function alternarItemLista(h: Habito, fecha: string, itemId: string) {
  const r = registrosDe(useDatos.getState().registros, h.id).get(fecha);
  await guardarRegistro(h, fecha, alternarItem(h, r, itemId));
}

export async function fijarValor(h: Habito, fecha: string, valor: number) {
  await guardarRegistro(h, fecha, { valor: Math.max(0, Math.round(valor)) });
}

export async function medir(h: Habito, fecha: string, medidas: Record<string, number>) {
  await guardarRegistro(h, fecha, { medidas });
}

export async function guardarNota(h: Habito, fecha: string, nota: string) {
  await guardarRegistro(h, fecha, { nota: nota.slice(0, 500) });
}

/** Crea o edita un hábito. */
export async function guardarHabito(h: Omit<Habito, 'creado' | 'actualizado' | 'actualizadoPor' | 'recordatorioSlot'> & { creado?: number }) {
  const uid = uidActual();
  const d = await obtenerDriver();
  const id = h.id || d.nuevoId();
  const ahora = Date.now();
  const datos: Habito = {
    ...h,
    id,
    // Avisos a cualquier minuto (`avisos`); la franja vieja de 15 min queda vacía para no avisar dos veces.
    recordatorio: horasRecordatorio(h)[0] ?? null,
    recordatorios: horasRecordatorio(h),
    avisos: [...new Set(horasRecordatorio(h).map((x) => minutoUTC(x, zonaActual())))],
    recordatorioSlot: null,
    creado: h.creado ?? ahora,
    actualizado: ahora,
    actualizadoPor: uid,
  };
  const { id: _omitido, ...sinId } = datos;
  void _omitido;
  await guardar(`users/${uid}/habits/${id}`, sinId as never);
  return id;
}

export async function archivarHabito(h: Habito, archivado: boolean) {
  await guardar(`users/${uidActual()}/habits/${h.id}`, { archivado, actualizado: Date.now(), actualizadoPor: uidActual() }, true);
  avisar(archivado ? 'Hábito archivado.' : 'Hábito restaurado.');
  programarResumenGrupos();
}

/** Borra el hábito y todos sus registros. */
export async function borrarHabito(h: Habito) {
  const uid = uidActual();
  const d = await obtenerDriver();
  const regs = await d.leerLista<Registro>({ ruta: `users/${uid}/logs`, filtros: [['habitId', '==', h.id]] });
  for (const r of regs) await borrar(`users/${uid}/logs/${r.id}`);
  await borrarConMarca('habits', h.id);
  avisar('Hábito borrado.');
  programarResumenGrupos();
}

export async function reordenar(habitos: Habito[]) {
  const uid = uidActual();
  await Promise.all(habitos.map((h, i) => (h.orden === i ? null : guardar(`users/${uid}/habits/${h.id}`, { orden: i, actualizado: Date.now(), actualizadoPor: uid }, true))));
}

// ---------- Tareas ----------
export async function guardarTarea(t: Omit<Tarea, 'id' | 'creado' | 'actualizado' | 'actualizadoPor'> & { id?: string; creado?: number }) {
  const uid = uidActual();
  const d = await obtenerDriver();
  const id = t.id || d.nuevoId();
  const ahora = Date.now();
  const { id: _x, ...resto } = t;
  void _x;
  const hora = t.hora && (t.fecha || t.repetir === 'diaria') ? t.hora : null;
  await guardar(`users/${uid}/tasks/${id}`, {
    ...resto,
    proyectoId: t.proyectoId ?? null,
    hora,
    avisoMin: hora ? minutoUTC(hora, zonaActual()) : null,
    completada: t.repetir === 'diaria' ? null : (t.completada ?? null),
    creado: t.creado ?? ahora,
    actualizado: ahora,
    actualizadoPor: uid,
  });
  return id;
}

export async function alternarTarea(t: Tarea, fecha: string) {
  const uid = uidActual();
  if (t.repetir !== 'diaria') {
    // Tareas que no se repiten: se completan en la tarea misma (no dependen del día en que se mire).
    const { tareasHechas, tareas } = useDatos.getState();
    const hecha = !tareaHecha(t, fecha, tareasHechas);
    const completada = hecha ? hoyActual() : null;
    useDatos.getState().poner({ tareas: tareas.map((x) => (x.id === t.id ? { ...x, completada } : x)) });
    await guardar(`users/${uid}/tasks/${t.id}`, { completada, actualizado: Date.now(), actualizadoPor: uid }, true);
    // Marcas de versiones anteriores: se apagan para que no la vuelvan a mostrar como hecha.
    if (!hecha) {
      const viejas = [...tareasHechas].filter((k) => k.startsWith(`${t.id}_`));
      if (viejas.length) {
        const sin = new Set(tareasHechas);
        viejas.forEach((k) => sin.delete(k));
        useDatos.getState().poner({ tareasHechas: sin });
        await Promise.all(viejas.map((k) => guardar(`users/${uid}/taskDone/${k}`, { taskId: t.id, fecha: k.slice(t.id.length + 1), hecha: false, actualizado: Date.now(), actualizadoPor: uid })));
      }
    }
    return;
  }
  const id = idTareaHecha(t.id, fecha);
  const hechas = new Set(useDatos.getState().tareasHechas);
  const hecha = !hechas.has(id);
  if (hecha) hechas.add(id);
  else hechas.delete(id);
  useDatos.getState().poner({ tareasHechas: hechas });
  // Se marca con hecha: true/false en vez de borrar, así la lectura incremental ve el cambio.
  await guardar(`users/${uid}/taskDone/${id}`, { taskId: t.id, fecha, hecha, actualizado: Date.now(), actualizadoPor: uid });
}

export async function borrarTarea(t: Tarea) {
  await borrarConMarca('tasks', t.id);
  avisar('Tarea borrada.');
}

// ---------- Proyectos ----------
export async function guardarProyecto(p: Omit<Proyecto, 'id' | 'creado' | 'actualizado' | 'actualizadoPor' | 'archivado'> & { id?: string; creado?: number; archivado?: boolean }) {
  const uid = uidActual();
  const d = await obtenerDriver();
  const id = p.id || d.nuevoId();
  const ahora = Date.now();
  await guardar(`users/${uid}/projects/${id}`, { nombre: p.nombre, virtud: p.virtud, fechaLimite: p.fechaLimite ?? null, archivado: p.archivado ?? false, creado: p.creado ?? ahora, actualizado: ahora, actualizadoPor: uid });
  return id;
}

export async function archivarProyecto(p: Proyecto, archivado: boolean) {
  const uid = uidActual();
  await guardar(`users/${uid}/projects/${p.id}`, { archivado, actualizado: Date.now(), actualizadoPor: uid }, true);
}

/** Borra el proyecto y sus tareas. */
export async function borrarProyecto(p: Proyecto) {
  const tareas = useDatos.getState().tareas.filter((t) => t.proyectoId === p.id);
  for (const t of tareas) await borrarConMarca('tasks', t.id);
  await borrarConMarca('projects', p.id);
  avisar(tareas.length ? `Proyecto y ${tareas.length} ${tareas.length === 1 ? 'tarea borrados' : 'tareas borradas'}.` : 'Proyecto borrado.');
}

// ---------- Enfoque y examen ----------
export async function guardarSesionEnfoque(s: Omit<SesionEnfoque, 'id' | 'actualizado' | 'actualizadoPor'>) {
  const uid = uidActual();
  const d = await obtenerDriver();
  await guardar(`users/${uid}/focus/${d.nuevoId()}`, { ...s, actualizado: Date.now(), actualizadoPor: uid });
}

export async function guardarExamen(e: Omit<Examen, 'actualizado' | 'actualizadoPor'>) {
  const uid = uidActual();
  await guardar(`users/${uid}/journal/${e.fecha}`, { ...e, actualizado: Date.now(), actualizadoPor: uid });
}

// ---------- Resumen para los grupos (v0.7) ----------
let temporizadorGrupos: ReturnType<typeof setTimeout> | undefined;
let actualizadorGrupos: (() => Promise<void>) | null = null;

/** La pantalla de comunidad registra cómo actualizar los resúmenes; acá solo se agenda (agrupando cambios seguidos). */
export function registrarActualizadorGrupos(f: (() => Promise<void>) | null) {
  actualizadorGrupos = f;
}

export function programarResumenGrupos(ms = 2500) {
  clearTimeout(temporizadorGrupos);
  temporizadorGrupos = setTimeout(() => {
    actualizadorGrupos?.().catch(() => undefined);
  }, ms);
}
