/**
 * Comunidad: mis grupos, mi resumen compartido y mi progreso en desafíos.
 * El resumen se recalcula solo cuando marco algo (agrupando cambios seguidos).
 */
import { createElement, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { create } from 'zustand';
import { sumarDias } from '@core/fechas';
import { cumplido, porcentaje, racha, type Habito } from '@core/habitos';
import { finDesafio, idReaccion, type Compartido, type Desafio, type Grupo, type Miembro, type Progreso, type TipoReaccion } from '@core/comunidad';
import { esModoPrueba, obtenerDriver } from '@/data';
import { mensajeDeError, type ConId } from '@/data/tipos';
import { useAvisos } from '@/ui/avisos';
import { useSesion } from './sesion';
import { hoyActual, registrarActualizadorGrupos, registrosDe, uidActual, useDatos, VENTANA_DIAS } from './datos';

interface EstadoGrupo {
  grupo: ConId<Grupo>;
  yo: Miembro | null;
  desafios: Array<ConId<Desafio>>;
  misProgresos: Map<string, Progreso>; // cid -> mi progreso
}

interface Comunidad {
  grupos: Map<string, EstadoGrupo>;
  listo: boolean;
  poner: (p: Partial<Omit<Comunidad, 'poner'>>) => void;
}

export const useComunidad = create<Comunidad>((set) => ({ grupos: new Map(), listo: false, poner: (p) => set(p) }));

const actualizarGrupo = (gid: string, cambios: Partial<EstadoGrupo>) => {
  const { grupos, poner } = useComunidad.getState();
  const actual = grupos.get(gid);
  if (!actual) return;
  const nuevo = new Map(grupos);
  nuevo.set(gid, { ...actual, ...cambios });
  poner({ grupos: nuevo });
};

// ---------- Copia local (para no leer del servidor si no hace falta) ----------
const claveCopia = (uid: string) => `stoica.comunidad.${uid}`;

function guardarCopia(uid: string) {
  if (esModoPrueba()) return;
  try {
    const g = [...useComunidad.getState().grupos.values()].map((x) => ({ ...x, misProgresos: [...x.misProgresos.entries()] }));
    localStorage.setItem(claveCopia(uid), JSON.stringify(g));
  } catch {
    /* sin almacenamiento */
  }
}

function cargarCopia(uid: string) {
  if (esModoPrueba()) return;
  try {
    const crudo = JSON.parse(localStorage.getItem(claveCopia(uid)) ?? '[]') as Array<Omit<EstadoGrupo, 'misProgresos'> & { misProgresos: Array<[string, Progreso]> }>;
    const m = new Map<string, EstadoGrupo>();
    for (const g of crudo) m.set(g.grupo.id, { ...g, misProgresos: new Map(g.misProgresos) });
    useComunidad.getState().poner({ grupos: m, listo: m.size > 0 });
  } catch {
    /* copia dañada: se ignora */
  }
}

/**
 * La comunidad se lee del servidor SOLO mientras estás en sus pantallas.
 * El resto del tiempo se usa la copia local (para el panel de Hoy y para actualizar tu resumen
 * cuando marcás algo, sin leer nada).
 */
export function SincronizarComunidad() {
  const uid = useSesion((s) => s.usuario?.uid);
  const { pathname } = useLocation();
  const activa = pathname.startsWith('/comunidad') || pathname.startsWith('/unirse');

  useEffect(() => {
    if (!uid) return;
    cargarCopia(uid);
    registrarActualizadorGrupos(actualizarResumenes);
    const desuscribir = useComunidad.subscribe(() => guardarCopia(uid));
    return () => {
      desuscribir();
      registrarActualizadorGrupos(null);
    };
  }, [uid]);

  return activa && uid ? createElement(EscucharComunidad, { uid }) : null;
}

function EscucharComunidad({ uid }: { uid: string }) {
  const grupos = useComunidad((s) => s.grupos);
  const ids = [...grupos.keys()].sort().join(',');

  useEffect(() => {
    let cancelar: (() => void) | undefined;
    obtenerDriver().then((d) => {
      cancelar = d.observarLista<Grupo>(
        { ruta: 'groups', filtros: [['miembros', 'array-contains', uid]] },
        (lista) => {
          const previo = useComunidad.getState().grupos;
          const m = new Map<string, EstadoGrupo>();
          for (const g of lista) m.set(g.id, { yo: null, desafios: [], misProgresos: new Map(), ...previo.get(g.id), grupo: g });
          useComunidad.getState().poner({ grupos: m, listo: true });
        },
        () => useComunidad.getState().poner({ listo: true }),
      );
    });
    return () => cancelar?.();
  }, [uid]);

  useEffect(() => {
    if (!uid || !ids) return;
    const cancelar: Array<() => void> = [];
    let vivo = true;
    obtenerDriver().then((d) => {
      if (!vivo) return;
      for (const gid of ids.split(',')) {
        cancelar.push(
          d.observarDoc<Miembro>(`groups/${gid}/members/${uid}`, (yo) => actualizarGrupo(gid, { yo }), () => undefined),
          d.observarLista<Desafio>({ ruta: `groups/${gid}/challenges` }, (desafios) => actualizarGrupo(gid, { desafios }), () => undefined),
        );
      }
    });
    return () => {
      vivo = false;
      cancelar.forEach((c) => c());
    };
  }, [uid, ids]);

  return createElement(SincronizarProgresos);
}

/** Mi progreso en cada desafío (un documento por desafío). */
function SincronizarProgresos() {
  const uid = useSesion((s) => s.usuario?.uid);
  const grupos = useComunidad((s) => s.grupos);
  const rutas = [...grupos.values()].flatMap((g) => g.desafios.map((c) => `${g.grupo.id}/${c.id}`)).sort().join(',');
  useEffect(() => {
    if (!uid || !rutas) return;
    const cancelar: Array<() => void> = [];
    obtenerDriver().then((d) => {
      for (const r of rutas.split(',')) {
        const [gid, cid] = r.split('/');
        cancelar.push(
          d.observarDoc<Progreso>(`groups/${gid}/challenges/${cid}/progress/${uid}`, (p) => {
            const g = useComunidad.getState().grupos.get(gid);
            if (!g) return;
            const m = new Map(g.misProgresos);
            if (p) m.set(cid, p);
            else m.delete(cid);
            actualizarGrupo(gid, { misProgresos: m });
          }, () => undefined),
        );
      }
    });
    return () => cancelar.forEach((c) => c());
  }, [uid, rutas]);
  return null;
}

// ---------- Cálculos (nunca valores reales de medición ni el examen) ----------
export function resumirHabito(h: Habito, hoy: string): Compartido {
  const regs = registrosDe(useDatos.getState().registros, h.id);
  return {
    habitId: h.id,
    nombre: h.nombre,
    icono: h.icono,
    virtud: h.virtud,
    hoy: cumplido(h, regs.get(hoy)),
    racha: racha(h, regs, hoy, VENTANA_DIAS),
    porcentaje: porcentaje(h, regs, sumarDias(hoy, -29), hoy),
  };
}

export function contarCumplidos(h: Habito, d: Pick<Desafio, 'inicio' | 'duracion'>, hoy: string): number {
  const regs = registrosDe(useDatos.getState().registros, h.id);
  const fin = finDesafio(d) < hoy ? finDesafio(d) : hoy;
  let n = 0;
  for (let dia = d.inicio; dia <= fin; dia = sumarDias(dia, 1)) if (cumplido(h, regs.get(dia))) n++;
  return n;
}

async function actualizarResumenes() {
  const uid = uidActual();
  const hoy = hoyActual();
  const { habitos } = useDatos.getState();
  const d = await obtenerDriver();
  const nombre = useSesion.getState().perfil?.nombre ?? '';
  for (const g of useComunidad.getState().grupos.values()) {
    if (g.yo) {
      const compartidos = g.yo.compartidos
        .map((c) => habitos.find((h) => h.id === c.habitId && !h.archivado))
        .filter((h): h is ConId<Habito> => !!h)
        .map((h) => resumirHabito(h, hoy));
      const cambio = JSON.stringify(compartidos) !== JSON.stringify(g.yo.compartidos) || g.yo.fecha !== hoy || g.yo.nombre !== nombre;
      if (cambio) {
        const yo = { nombre, compartidos, fecha: hoy, actualizado: Date.now(), actualizadoPor: uid };
        try {
          await d.guardar(`groups/${g.grupo.id}/members/${uid}`, yo);
          actualizarGrupo(g.grupo.id, { yo });
        } catch {
          // Ya no estoy en el grupo (o se eliminó): se saca de la copia local.
          const m = new Map(useComunidad.getState().grupos);
          m.delete(g.grupo.id);
          useComunidad.getState().poner({ grupos: m });
          continue;
        }
      }
    }
    for (const c of g.desafios) {
      const p = g.misProgresos.get(c.id);
      const h = p && habitos.find((x) => x.id === p.habitId);
      if (!p || !h) continue;
      const cumplidos = contarCumplidos(h, c, hoy);
      if (cumplidos !== p.cumplidos || p.nombre !== nombre) {
        const nuevo = { nombre, habitId: h.id, cumplidos, actualizado: Date.now(), actualizadoPor: uid };
        await d.guardar(`groups/${g.grupo.id}/challenges/${c.id}/progress/${uid}`, nuevo).catch(() => undefined);
        const m = new Map(g.misProgresos);
        m.set(c.id, nuevo);
        actualizarGrupo(g.grupo.id, { misProgresos: m });
      }
    }
  }
}

// ---------- Acciones ----------
const avisar = (t: string) => useAvisos.getState().mostrar(t);

async function intentar<T>(f: () => Promise<T>): Promise<T | undefined> {
  try {
    return await f();
  } catch (e) {
    avisar(mensajeDeError(e));
    return undefined;
  }
}

export const crearGrupo = (nombre: string) => intentar(async () => (await obtenerDriver()).llamar<{ id: string; codigo: string }>('crearGrupo', { nombre }));
export const unirseAGrupo = (codigo: string) => intentar(async () => (await obtenerDriver()).llamar<{ id: string }>('unirseAGrupo', { codigo }));
export const salirDeGrupo = (grupoId: string) => intentar(async () => (await obtenerDriver()).llamar('salirDeGrupo', { grupoId }));
export const eliminarGrupo = (grupoId: string) => intentar(async () => (await obtenerDriver()).llamar('eliminarGrupo', { grupoId }));

/** Elijo qué hábitos comparto en un grupo. */
export async function elegirCompartidos(grupoId: string, habitIds: string[]) {
  const uid = uidActual();
  const hoy = hoyActual();
  const { habitos } = useDatos.getState();
  const compartidos = habitIds
    .map((id) => habitos.find((h) => h.id === id))
    .filter((h): h is ConId<Habito> => !!h)
    .map((h) => resumirHabito(h, hoy));
  await intentar(async () =>
    (await obtenerDriver()).guardar(`groups/${grupoId}/members/${uid}`, { nombre: useSesion.getState().perfil?.nombre ?? '', compartidos, fecha: hoy, actualizado: Date.now(), actualizadoPor: uid }),
  );
}

export async function reaccionar(grupoId: string, para: string, tipo: TipoReaccion | null) {
  const uid = uidActual();
  const hoy = hoyActual();
  const ruta = `groups/${grupoId}/reactions/${idReaccion(hoy, uid, para)}`;
  await intentar(async () => {
    const d = await obtenerDriver();
    if (tipo === null) await d.borrar(ruta);
    else await d.guardar(ruta, { de: uid, para, dia: hoy, tipo, nombreDe: useSesion.getState().perfil?.nombre ?? '', actualizado: Date.now(), actualizadoPor: uid });
  });
}

export async function crearDesafio(grupoId: string, d: Omit<Desafio, 'id' | 'creador' | 'actualizado' | 'actualizadoPor'>) {
  const uid = uidActual();
  await intentar(async () => {
    const dr = await obtenerDriver();
    await dr.guardar(`groups/${grupoId}/challenges/${dr.nuevoId()}`, { ...d, creador: uid, actualizado: Date.now(), actualizadoPor: uid });
  });
}

export async function borrarDesafio(grupoId: string, cid: string) {
  await intentar(async () => (await obtenerDriver()).borrar(`groups/${grupoId}/challenges/${cid}`));
}

export async function sumarmeADesafio(grupoId: string, d: Desafio & { id: string }, habitId: string | null) {
  const uid = uidActual();
  const ruta = `groups/${grupoId}/challenges/${d.id}/progress/${uid}`;
  const h = useDatos.getState().habitos.find((x) => x.id === habitId);
  await intentar(async () => {
    const dr = await obtenerDriver();
    if (!h) await dr.borrar(ruta);
    else await dr.guardar(ruta, { nombre: useSesion.getState().perfil?.nombre ?? '', habitId: h.id, cumplidos: contarCumplidos(h, d, hoyActual()), actualizado: Date.now(), actualizadoPor: uid });
  });
}
