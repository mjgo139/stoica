/** El Espejo v2: pedir a la nube la lámina de tu reflejo y sus etapas (lo genera la IA en el servidor). */
import { cumplido, esDiaActivo } from '@core/habitos';
import { sumarDias } from '@core/fechas';
import type { Etapa } from '@core/espejo';
import { obtenerDriver } from '@/data';
import { mensajeDeError } from '@/data/tipos';
import { registrosDe, useDatos } from './datos';
import { reducirImagen } from './plan';

export interface ImagenReflejo {
  url: string;
  ruta: string;
  creado: number;
}

export interface DocReflejo {
  base?: ImagenReflejo;
  etapas?: Partial<Record<Etapa, ImagenReflejo>>;
  pedido?: { remera: string; pantalon: string };
  usos?: { mes: string; cantidad: number };
}

const SELFIE_LADO = 1024;
const SELFIE_MAX = 1_400_000;

async function llamar(datos: Record<string, unknown>): Promise<string | null> {
  try {
    await (await obtenerDriver()).llamar('espejoGenerar', datos);
    return null;
  } catch (e) {
    return mensajeDeError(e);
  }
}

export async function crearLamina(selfie: Blob | null, descripcion: string, remera: string, pantalon: string): Promise<string | null> {
  let foto: string | undefined;
  if (selfie) {
    if (!selfie.type.startsWith('image/')) return 'Elegí una imagen.';
    try {
      foto = await reducirImagen(selfie, SELFIE_LADO, SELFIE_MAX);
    } catch (e) {
      return mensajeDeError(e);
    }
  }
  return llamar({ que: 'lamina', foto, descripcion, remera, pantalon });
}

export const crearEtapa = (etapa: Etapa) => llamar({ que: 'etapa', etapa });
export const borrarReflejo = () => llamar({ que: 'borrar' });

/** Cumplimiento de tus hábitos en los 30 días anteriores a hoy (0 a 1), o null si no hay datos. */
export function cumplimiento30(hoy: string): number | null {
  const { habitos, registros } = useDatos.getState();
  let tocaban = 0;
  let hechos = 0;
  for (const h of habitos) {
    if (h.archivado) continue;
    const regs = registrosDe(registros, h.id);
    for (let o = -30; o <= -1; o++) {
      const dia = sumarDias(hoy, o);
      if (!esDiaActivo(h, dia)) continue;
      tocaban++;
      if (cumplido(h, regs.get(dia))) hechos++;
    }
  }
  return tocaban ? hechos / tocaban : null;
}
