/**
 * Widgets de Android: la app les pasa tus hábitos (con sus días), las marcas de hoy y ayer, las tareas
 * y tus grupos. Con eso el celular calcula solo qué toca hoy (también después de la medianoche).
 * Para marcar desde el widget, el celular usa tu misma sesión (nunca tu contraseña).
 */
import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { registerPlugin } from '@capacitor/core';
import { sumarDias } from '@core/fechas';
import { cumplido, esDiaActivo, NOMBRE_VIRTUD, racha, type Registro } from '@core/habitos';
import type { Miembro } from '@core/comunidad';
import { tareaHecha } from '@core/rutina';
import { obtenerDriver } from '@/data';
import { programarResumenGrupos, registrosDe, useDatos, useHoy, VENTANA_DIAS } from '@/app/datos';
import { useComunidad } from '@/app/comunidad';
import { useSesion } from '@/app/sesion';
import { esNativo } from './nativo';

type Datos = Record<string, unknown>;

const WidgetStoica = registerPlugin<{
  actualizar(datos: Datos): Promise<void>;
  sesion(datos: Datos): Promise<void>;
}>('WidgetStoica');

const FRASES = ['Victoria sobre ti mismo.', 'Bien hecho: lo que dependía de vos.', 'Ningún gran logro surge de repente.', 'Un día más de virtud.'];

async function enviar(datos: Datos) {
  if (!esNativo()) return;
  // Una APK vieja no tiene el complemento: no pasa nada, el widget aparece al actualizar.
  await WidgetStoica.actualizar(datos).catch(() => undefined);
}

async function enviarSesion(datos: Datos) {
  if (!esNativo()) return;
  await WidgetStoica.sesion(datos).catch(() => undefined);
}

/** Al cerrar sesión: los widgets dejan de mostrar los datos de esa cuenta y olvidan la sesión. */
export async function limpiarWidget() {
  await enviarSesion({});
  await enviar({ sinSesion: true });
}

// ---------- Compañeros de cada grupo (lo último que viste en la app) ----------
interface MiembroWidget {
  uid: string;
  nombre: string;
  fecha: string;
  hechos: number;
  total: number;
}

const CLAVE_MIEMBROS = 'stoica.widget.miembros';

interface GrupoVisto {
  visto: number;
  lista: MiembroWidget[];
}

function leerMiembros(): Record<string, GrupoVisto> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_MIEMBROS) ?? '{}') as Record<string, GrupoVisto>;
  } catch {
    return {};
  }
}

const useMiembros = create<{ porGrupo: Record<string, GrupoVisto> }>(() => ({ porGrupo: esNativo() ? leerMiembros() : {} }));

/** La pantalla del grupo avisa qué ve, así el widget de comunidad arranca con datos aunque no haya conexión. */
export function recordarGrupoWidget(gid: string, miembros: Array<Miembro & { id: string }>) {
  if (!esNativo()) return;
  const lista = miembros.map((m) => ({
    uid: m.id,
    nombre: m.nombre,
    fecha: m.fecha,
    hechos: m.compartidos.filter((c) => c.hoy).length,
    total: m.compartidos.length,
  }));
  if (JSON.stringify(lista) === JSON.stringify(useMiembros.getState().porGrupo[gid]?.lista)) return;
  const porGrupo = { ...useMiembros.getState().porGrupo, [gid]: { visto: Date.now(), lista } };
  useMiembros.setState({ porGrupo });
  try {
    localStorage.setItem(CLAVE_MIEMBROS, JSON.stringify(porGrupo));
  } catch {
    /* sin almacenamiento */
  }
}

// ---------- Armado de los datos ----------
function marca(r: Registro | undefined) {
  return { h: r?.hecho === true, v: r?.valor ?? 0, m: r?.medidas ? Object.keys(r.medidas).length : 0 };
}

/** Mantiene los widgets al día mientras la app está abierta (cada vez que marcás algo). */
export function useWidgetHoy() {
  const hoy = useHoy();
  const uid = useSesion((s) => s.usuario?.uid);
  const zona = useSesion((s) => s.perfil?.zonaHoraria);
  const habitos = useDatos((s) => s.habitos);
  const registros = useDatos((s) => s.registros);
  const tareas = useDatos((s) => s.tareas);
  const hechas = useDatos((s) => s.tareasHechas);
  const listo = useDatos((s) => s.listo);
  const grupos = useComunidad((s) => s.grupos);
  const miembros = useMiembros((s) => s.porGrupo);
  const ultimo = useRef('');

  // La sesión para marcar desde el widget (se manda una vez por inicio de sesión).
  useEffect(() => {
    if (!esNativo() || !uid) return;
    void obtenerDriver().then((d) => {
      const s = d.sesionWidget?.();
      if (s && s.uid === uid) void enviarSesion({ ...s });
    });
  }, [uid]);

  // Si marcaste desde el widget con la app cerrada, al abrirla se avisa a tus grupos.
  useEffect(() => {
    if (esNativo() && listo) programarResumenGrupos(4000);
  }, [listo, registros]);

  useEffect(() => {
    if (!esNativo() || !listo || !uid) return;
    const ayer = sumarDias(hoy, -1);
    const activos = habitos.filter((h) => !h.archivado).sort((a, b) => a.momento - b.momento || a.orden - b.orden);
    const deHoy = activos.filter((h) => esDiaActivo(h, hoy));
    const pendientes = deHoy.filter((h) => !cumplido(h, registrosDe(registros, h.id).get(hoy)));
    const marcas: Record<string, ReturnType<typeof marca>> = {};
    const lista = activos.slice(0, 40).map((h) => {
      const regs = registrosDe(registros, h.id);
      for (const f of [ayer, hoy]) {
        const r = regs.get(f);
        if (r) marcas[`${h.id}_${f}`] = marca(r);
      }
      const sinHoy = new Map(regs);
      sinHoy.delete(hoy);
      return {
        id: h.id,
        nombre: h.nombre,
        tipo: h.tipo,
        virtud: NOMBRE_VIRTUD[h.virtud] ?? '',
        meta: h.meta,
        unidad: h.unidad,
        dias: h.dias,
        inicio: h.inicio,
        items: h.variables.length,
        racha: racha(h, sinHoy, hoy, VENTANA_DIAS),
      };
    });
    const tareasWidget = tareas
      .filter((t) => t.repetir === 'diaria' || !t.completada || t.completada >= ayer)
      .filter((t) => t.repetir === 'diaria' || !tareaHecha(t, t.fecha ?? hoy, hechas) || (t.completada ?? '') >= ayer)
      .slice(0, 60)
      .map((t) => ({
        id: t.id,
        titulo: t.titulo,
        diaria: t.repetir === 'diaria',
        fecha: t.fecha,
        hora: t.hora ?? null,
        momento: t.momento,
        // Tareas de versiones anteriores marcadas en taskDone: se pasan como completadas.
        completada: t.repetir === 'diaria' ? null : t.completada ?? (tareaHecha(t, t.fecha ?? hoy, hechas) ? t.fecha ?? hoy : null),
      }));
    const hechasDiarias = tareas
      .filter((t) => t.repetir === 'diaria')
      .flatMap((t) => [ayer, hoy].filter((f) => tareaHecha(t, f, hechas)).map((f) => `${t.id}_${f}`));
    const gruposWidget = [...grupos.values()].map((g) => ({ id: g.grupo.id, nombre: g.grupo.nombre, miembros: miembros[g.grupo.id]?.lista ?? [], visto: miembros[g.grupo.id]?.visto ?? 0 }));

    const datos: Datos = {
      // Lo que entienden las APK anteriores (widget Hoy simple).
      fecha: hoy,
      hecho: deHoy.length - pendientes.length,
      total: deHoy.length,
      pendientes: pendientes.slice(0, 4).map((h) => h.nombre),
      frase: FRASES[new Date().getDate() % FRASES.length],
      // Lo nuevo: con esto el celular calcula cada día por su cuenta.
      v: 2,
      yo: uid,
      zona: zona ?? 'America/Asuncion',
      habitos: lista,
      marcas,
      tareas: tareasWidget,
      hechas: hechasDiarias,
      grupos: gruposWidget,
    };
    const clave = JSON.stringify({ ...datos, frase: '' });
    if (clave === ultimo.current) return;
    const t = setTimeout(() => {
      ultimo.current = clave;
      void enviar(datos);
    }, 600);
    return () => clearTimeout(t);
  }, [hoy, uid, zona, habitos, registros, tareas, hechas, listo, grupos, miembros]);
}
