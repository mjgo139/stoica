/**
 * Datos del usuario que usan varias pantallas (hábitos, registros recientes, tareas, enfoque, examen).
 * Se sincronizan una sola vez (componente <Sincronizar/>) y se leen desde cualquier pantalla.
 */
import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { claveDia, franjaUTC, sumarDias } from '@core/fechas';
import {
  hitoAlcanzado,
  idRegistro,
  mejorRacha,
  racha,
  registroVacio,
  type Habito,
  type Registro,
} from '@core/habitos';
import type { Examen, SesionEnfoque, Tarea, TareaHecha } from '@core/rutina';
import { idTareaHecha } from '@core/rutina';
import { obtenerDriver } from '@/data';
import { mensajeDeError, type ConId } from '@/data/tipos';
import { useAvisos } from '@/ui/avisos';
import { useSesion } from './sesion';

/** Días de registros que se mantienen sincronizados (rachas, semana, balance de 30 días). */
export const VENTANA_DIAS = 120;

export type Registros = Map<string, Map<string, Registro>>; // habitId -> fecha -> registro

interface Datos {
  listo: boolean;
  habitos: Array<ConId<Habito>>;
  registros: Registros;
  tareas: Array<ConId<Tarea>>;
  tareasHechas: Set<string>; // ids taskId_fecha
  enfoque: Array<ConId<SesionEnfoque>>;
  examenes: Map<string, Examen>;
  celebracion: { habito: string; dias: number } | null;
  poner: (p: Partial<Omit<Datos, 'poner'>>) => void;
}

export const useDatos = create<Datos>((set) => ({
  listo: false,
  habitos: [],
  registros: new Map(),
  tareas: [],
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
    const desde30 = sumarDias(hoy, -40);
    const cancelar: Array<() => void> = [];
    let vivo = true;
    let pendientes = 2;
    const marcarListo = () => {
      pendientes--;
      if (pendientes <= 0) poner({ listo: true });
    };
    const fallo = (e: unknown) => useAvisos.getState().mostrar(mensajeDeError(e));
    obtenerDriver().then((d) => {
      if (!vivo) return;
      cancelar.push(
        d.observarLista<Habito>({ ruta: `users/${uid}/habits` }, (hs) => {
          poner({ habitos: hs.sort((a, b) => a.orden - b.orden || a.creado - b.creado) });
          marcarListo();
        }, fallo),
        d.observarLista<Registro>({ ruta: `users/${uid}/logs`, filtros: [['fecha', '>=', desde]] }, (rs) => {
          const m: Registros = new Map();
          for (const r of rs) {
            if (!m.has(r.habitId)) m.set(r.habitId, new Map());
            m.get(r.habitId)!.set(r.fecha, r);
          }
          poner({ registros: m });
          marcarListo();
        }, fallo),
        d.observarLista<Tarea>({ ruta: `users/${uid}/tasks` }, (ts) => poner({ tareas: ts }), fallo),
        d.observarLista<TareaHecha>({ ruta: `users/${uid}/taskDone`, filtros: [['fecha', '>=', desde30]] }, (ts) => poner({ tareasHechas: new Set(ts.map((t) => idTareaHecha(t.taskId, t.fecha))) }), fallo),
        d.observarLista<SesionEnfoque>({ ruta: `users/${uid}/focus`, filtros: [['fecha', '>=', desde30]] }, (fs) => poner({ enfoque: fs.sort((a, b) => b.inicio - a.inicio) }), fallo),
        d.observarLista<Examen>({ ruta: `users/${uid}/journal`, filtros: [['fecha', '>=', desde30]] }, (es) => poner({ examenes: new Map(es.map((e) => [e.fecha, e])) }), fallo),
      );
    });
    return () => {
      vivo = false;
      cancelar.forEach((c) => c());
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
  const valor = Math.max(0, Math.min(10000, (r?.valor ?? 0) + delta));
  await guardarRegistro(h, fecha, { valor });
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
    recordatorioSlot: h.recordatorio ? franjaUTC(h.recordatorio, zonaActual()) : null,
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
  await borrar(`users/${uid}/habits/${h.id}`);
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
  await guardar(`users/${uid}/tasks/${id}`, { ...resto, creado: t.creado ?? ahora, actualizado: ahora, actualizadoPor: uid });
}

export async function alternarTarea(t: Tarea, fecha: string) {
  const uid = uidActual();
  const id = idTareaHecha(t.id, fecha);
  const hechas = new Set(useDatos.getState().tareasHechas);
  if (hechas.has(id)) {
    hechas.delete(id);
    useDatos.getState().poner({ tareasHechas: hechas });
    await borrar(`users/${uid}/taskDone/${id}`);
  } else {
    hechas.add(id);
    useDatos.getState().poner({ tareasHechas: hechas });
    await guardar(`users/${uid}/taskDone/${id}`, { taskId: t.id, fecha, actualizado: Date.now(), actualizadoPor: uid });
  }
}

export async function borrarTarea(t: Tarea) {
  await borrar(`users/${uidActual()}/tasks/${t.id}`);
  avisar('Tarea borrada.');
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
