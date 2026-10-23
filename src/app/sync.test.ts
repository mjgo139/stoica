import { beforeEach, describe, expect, it } from 'vitest';
import { Coleccion } from './sync';
import type { Consulta, Driver } from '@/data/tipos';

// localStorage mínimo para Node
const almacen = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => almacen.get(k) ?? null,
  setItem: (k: string, v: string) => void almacen.set(k, v),
  removeItem: (k: string) => void almacen.delete(k),
};

type Doc = { id: string; fecha: string; actualizado: number };

function driverFalso(cache: Doc[], servidor: Doc[]) {
  const consultas: Consulta[] = [];
  let emitir: ((d: Doc[], info: { desdeServidor: boolean }) => void) | null = null;
  const d = {
    nombre: 'firebase',
    leerListaLocal: async () => cache,
    observarLista: (c: Consulta, cb: (d: Doc[], i: { desdeServidor: boolean }) => void) => {
      consultas.push(c);
      emitir = cb;
      const desde = c.filtros?.find((f) => f[0] === 'actualizado')?.[2] as number | undefined;
      cb(desde === undefined ? servidor : servidor.filter((x) => x.actualizado >= desde), { desdeServidor: true });
      return () => undefined;
    },
  } as unknown as Driver;
  return { d, consultas, emitir: (docs: Doc[]) => emitir?.(docs, { desdeServidor: true }) };
}

describe('sincronización incremental', () => {
  beforeEach(() => almacen.clear());

  it('la primera vez descarga la ventana completa', async () => {
    const { d, consultas } = driverFalso([], [{ id: 'a', fecha: '2026-10-20', actualizado: 1 }]);
    let vistos: Doc[] = [];
    await new Coleccion<Doc>(d, 'u', 'logs', [['fecha', '>=', '2026-07-01']], () => true, (x) => (vistos = x), () => undefined).iniciar();
    expect(consultas[0].filtros).toEqual([['fecha', '>=', '2026-07-01']]);
    expect(vistos.map((x) => x.id)).toEqual(['a']);
    expect(Number(almacen.get('stoica.sync.logs.u'))).toBeGreaterThan(0);
  });

  it('después pide al servidor solo lo que cambió y usa la caché para el resto', async () => {
    const ahora = Date.now();
    almacen.set('stoica.sync.logs.u', String(ahora - 3600_000));
    const viejo = { id: 'viejo', fecha: '2026-10-01', actualizado: ahora - 10 * 864e5 };
    const nuevo = { id: 'nuevo', fecha: '2026-10-22', actualizado: ahora - 60_000 };
    const { d, consultas } = driverFalso([viejo], [viejo, nuevo]);
    let vistos: Doc[] = [];
    await new Coleccion<Doc>(d, 'u', 'logs', [['fecha', '>=', '2026-07-01']], () => true, (x) => (vistos = x), () => undefined).iniciar();
    expect(consultas[0].filtros?.[0][0]).toBe('actualizado'); // consulta incremental
    expect(vistos.map((x) => x.id).sort()).toEqual(['nuevo', 'viejo']); // el viejo sale de la caché, sin lectura
  });

  it('cada 30 días vuelve a descargar todo', async () => {
    almacen.set('stoica.sync.logs.u', String(Date.now() - 31 * 864e5));
    const { d, consultas } = driverFalso([{ id: 'a', fecha: '2026-10-20', actualizado: 1 }], []);
    await new Coleccion<Doc>(d, 'u', 'logs', [['fecha', '>=', '2026-07-01']], () => true, () => undefined, () => undefined).iniciar();
    expect(consultas[0].filtros).toEqual([['fecha', '>=', '2026-07-01']]);
  });

  it('las marcas de borrado quitan documentos aunque sigan en la caché', async () => {
    almacen.set('stoica.sync.tasks.u', String(Date.now() - 3600_000));
    const { d, emitir } = driverFalso([{ id: 't1', fecha: '', actualizado: 1 }, { id: 't2', fecha: '', actualizado: 1 }], []);
    let vistos: Doc[] = [];
    const c = new Coleccion<Doc>(d, 'u', 'tasks', [], () => true, (x) => (vistos = x), () => undefined);
    await c.iniciar();
    c.quitar(['t1']);
    expect(vistos.map((x) => x.id)).toEqual(['t2']);
    emitir([{ id: 't1', fecha: '', actualizado: 2 }]); // aunque vuelva a llegar, sigue quitado
    expect(vistos.map((x) => x.id)).toEqual(['t2']);
  });
});
