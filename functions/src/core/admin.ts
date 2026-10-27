/** Panel de admin: cuentas (datos no privados) y métricas diarias sin nombres. */
import { claveDia, sumarDias } from './fechas.js';
import type { Rol } from './validaciones.js';

/** accounts/{uid} */
export interface Cuenta {
  nombre: string;
  correo: string;
  alta: number;
  ultimoAcceso: number;
  plataforma: string;
  rol: Rol;
  suspendida: boolean;
  /** Bloqueo automático por abuso (lo pone el servidor). */
  bloqueada?: boolean;
  motivoBloqueo?: string;
}

/** metrics/{fecha} */
export interface Metricas {
  fecha: string;
  total: number;
  activosHoy: number;
  activos7: number;
  activos30: number;
  altasHoy: number;
  altas7: number;
  altas30: number;
  /** % de cuentas con más de 7 días que volvieron en los últimos 7 días. */
  retencion7: number;
  suspendidas: number;
  porTipo: { sino: number; cantidad: number; medicion: number; lista?: number };
  porPlataforma: Record<string, number>;
  calculado: number;
}

export function calcularMetricas(cuentas: Cuenta[], porTipo: Metricas['porTipo'], ahora: number, zona: string): Metricas {
  const hoy = claveDia(new Date(ahora), zona);
  const dia = (ms: number) => claveDia(new Date(ms), zona);
  const desde7 = sumarDias(hoy, -6);
  const desde30 = sumarDias(hoy, -29);
  let activosHoy = 0, activos7 = 0, activos30 = 0, altasHoy = 0, altas7 = 0, altas30 = 0, viejas = 0, viejasActivas = 0, suspendidas = 0;
  const porPlataforma: Record<string, number> = {};
  for (const c of cuentas) {
    const acc = dia(c.ultimoAcceso || c.alta);
    const alta = dia(c.alta);
    if (acc === hoy) activosHoy++;
    if (acc >= desde7) activos7++;
    if (acc >= desde30) activos30++;
    if (alta === hoy) altasHoy++;
    if (alta >= desde7) altas7++;
    if (alta >= desde30) altas30++;
    if (alta < desde7) {
      viejas++;
      if (acc >= desde7) viejasActivas++;
    }
    if (c.suspendida) suspendidas++;
    const p = (c.plataforma || 'Sin dato').split(' · ')[0];
    porPlataforma[p] = (porPlataforma[p] ?? 0) + 1;
  }
  return {
    fecha: hoy,
    total: cuentas.length,
    activosHoy,
    activos7,
    activos30,
    altasHoy,
    altas7,
    altas30,
    retencion7: viejas ? Math.round((viejasActivas / viejas) * 100) : 0,
    suspendidas,
    porTipo,
    porPlataforma,
    calculado: ahora,
  };
}

/** "hace 3 días", "hoy", "ayer" */
export function haceCuanto(ms: number, ahora: number, zona: string): string {
  if (!ms) return '—';
  const a = claveDia(new Date(ms), zona);
  const h = claveDia(new Date(ahora), zona);
  if (a === h) return 'hoy';
  if (a === sumarDias(h, -1)) return 'ayer';
  const d = Math.round((Date.parse(h) - Date.parse(a)) / 864e5);
  if (d < 30) return `hace ${d} días`;
  const m = Math.floor(d / 30);
  return m === 1 ? 'hace 1 mes' : `hace ${m} meses`;
}
