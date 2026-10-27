/**
 * Collage simple para la foto del día: hasta 4 fotos en un cuadrado.
 * Solo calcula dónde va cada foto; el dibujo lo hace el celular (canvas).
 */
export const COLLAGE_MAX = 4;

export type DisenoCollage = 'lado' | 'arriba' | 'grande-izq' | 'grande-arriba' | 'grilla';

export interface Celda {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/** Diseños posibles según cuántas fotos hay (el primero es el que se usa si no se elige). */
export function disenosPara(n: number): Array<{ id: DisenoCollage; nombre: string }> {
  if (n === 2) return [{ id: 'lado', nombre: 'Lado a lado' }, { id: 'arriba', nombre: 'Una arriba de otra' }];
  if (n === 3) return [{ id: 'grande-izq', nombre: 'Grande a la izquierda' }, { id: 'grande-arriba', nombre: 'Grande arriba' }];
  if (n === 4) return [{ id: 'grilla', nombre: 'Cuadrícula' }, { id: 'grande-izq', nombre: 'Grande a la izquierda' }];
  return [];
}

/** Celdas de un collage cuadrado de `lado` px con `espacio` px entre fotos, en el orden de las fotos. */
export function celdasCollage(n: number, diseno: DisenoCollage, lado: number, espacio = 8): Celda[] {
  const medio = (lado - espacio) / 2;
  const c = (x: number, y: number, ancho: number, alto: number): Celda => ({ x: Math.round(x), y: Math.round(y), ancho: Math.round(ancho), alto: Math.round(alto) });
  if (n <= 1) return [c(0, 0, lado, lado)];
  const valido = disenosPara(n).some((d) => d.id === diseno) ? diseno : disenosPara(n)[0].id;
  if (n === 2) return valido === 'arriba' ? [c(0, 0, lado, medio), c(0, medio + espacio, lado, medio)] : [c(0, 0, medio, lado), c(medio + espacio, 0, medio, lado)];
  if (n === 3) {
    return valido === 'grande-arriba'
      ? [c(0, 0, lado, medio), c(0, medio + espacio, medio, medio), c(medio + espacio, medio + espacio, medio, medio)]
      : [c(0, 0, medio, lado), c(medio + espacio, 0, medio, medio), c(medio + espacio, medio + espacio, medio, medio)];
  }
  if (valido === 'grande-izq') {
    const tercio = (lado - 2 * espacio) / 3;
    return [c(0, 0, medio, lado), ...[0, 1, 2].map((i) => c(medio + espacio, i * (tercio + espacio), medio, tercio))];
  }
  return [c(0, 0, medio, medio), c(medio + espacio, 0, medio, medio), c(0, medio + espacio, medio, medio), c(medio + espacio, medio + espacio, medio, medio)];
}

/** Recorte "cubrir": qué parte de la foto entra en la celda sin deformarla (centrado). */
export function recorteCubrir(anchoFoto: number, altoFoto: number, celda: Pick<Celda, 'ancho' | 'alto'>): { sx: number; sy: number; sAncho: number; sAlto: number } {
  const escala = Math.max(celda.ancho / anchoFoto, celda.alto / altoFoto);
  const sAncho = celda.ancho / escala;
  const sAlto = celda.alto / escala;
  return { sx: (anchoFoto - sAncho) / 2, sy: (altoFoto - sAlto) / 2, sAncho, sAlto };
}
