/**
 * Sincronización incremental: la app gasta lecturas solo por lo que cambió.
 *
 * - La primera vez en un dispositivo (o cada 30 días, para "curarse" de cualquier desfase) se
 *   descarga la colección completa dentro de su ventana.
 * - Las demás veces se arma la lista con lo que ya está guardado en el dispositivo (sin costo) y al
 *   servidor solo se le piden los documentos con `actualizado` posterior a la última sincronización
 *   (con un día de margen por relojes desfasados).
 * - Lo que se borra deja una marca en `users/{uid}/borrados/{col}_{id}` para que los otros
 *   dispositivos también lo quiten (una consulta incremental no ve los documentos borrados).
 */
import type { Driver, ConId, Filtro } from '@/data/tipos';

const DIA = 864e5;
const RESINCRONIZAR_CADA = 30 * DIA;

export interface MarcaBorrado {
  col: string;
  docId: string;
  actualizado: number;
  actualizadoPor: string;
}

const leerNumero = (clave: string) => {
  try {
    return Number(localStorage.getItem(clave) ?? 0) || 0;
  } catch {
    return 0;
  }
};
const escribirNumero = (clave: string, n: number) => {
  try {
    localStorage.setItem(clave, String(n));
  } catch {
    /* sin almacenamiento: la próxima vez se descarga todo */
  }
};

export class Coleccion<T extends { actualizado?: number }> {
  private todos = new Map<string, ConId<T>>();
  private cancelar: (() => void) | null = null;
  private quitados = new Set<string>();

  constructor(
    private d: Driver,
    private uid: string,
    private col: string,
    /** Filtro de la descarga completa (por ejemplo, la ventana de días). */
    private base: Filtro[],
    /** Qué documentos de la caché siguen valiendo (por ejemplo, los que entran en la ventana). */
    private vale: (x: ConId<T>) => boolean,
    private alCambiar: (docs: Array<ConId<T>>) => void,
    private fallo: (e: unknown) => void,
  ) {}

  private get clave() {
    return `stoica.sync.${this.col}.${this.uid}`;
  }

  private emitir() {
    this.alCambiar([...this.todos.values()].filter((x) => this.vale(x) && !this.quitados.has(x.id)));
  }

  /** Quita documentos borrados (por marcas propias o de otros dispositivos). */
  quitar(ids: Iterable<string>) {
    let cambio = false;
    for (const id of ids) {
      if (this.todos.delete(id)) cambio = true;
      this.quitados.add(id);
    }
    if (cambio) this.emitir();
  }

  async iniciar() {
    const ruta = `users/${this.uid}/${this.col}`;
    let ultima = this.d.nombre === 'firebase' ? leerNumero(this.clave) : 0;
    if (Date.now() - ultima > RESINCRONIZAR_CADA) ultima = 0;
    if (ultima > 0) {
      for (const x of await this.d.leerListaLocal<T>({ ruta, filtros: this.base })) this.todos.set(x.id, x);
      if (this.todos.size === 0) ultima = 0; // la caché del dispositivo se borró: descargar todo
    }
    if (this.todos.size) this.emitir();
    const filtros: Filtro[] = ultima > 0 ? [['actualizado', '>=', ultima - DIA]] : this.base;
    this.cancelar = this.d.observarLista<T>(
      { ruta, filtros },
      (docs, info) => {
        for (const x of docs) if (!this.quitados.has(x.id)) this.todos.set(x.id, x);
        this.emitir();
        // Solo se marca la sincronización cuando la respuesta vino del servidor (no de la caché sin conexión).
        if (info.desdeServidor) escribirNumero(this.clave, Date.now());
      },
      this.fallo,
    );
  }

  detener() {
    this.cancelar?.();
    this.cancelar = null;
  }
}

export const idMarca = (col: string, docId: string) => `${col}_${docId}`;
