import { useEffect, useMemo, useState } from 'react';
import { obtenerDriver } from '.';
import { mensajeDeError, type ConId, type Consulta } from './tipos';

export interface Resultado<T> {
  datos: T;
  cargando: boolean;
  error: string;
}

/** Lista en vivo de una colección. Con `null` no consulta nada. */
export function useConsulta<T>(c: Consulta | null): Resultado<Array<ConId<T>>> {
  const clave = c ? JSON.stringify(c) : '';
  const [estado, setEstado] = useState<Resultado<Array<ConId<T>>>>({ datos: [], cargando: !!c, error: '' });
  useEffect(() => {
    if (!clave) {
      setEstado({ datos: [], cargando: false, error: '' });
      return;
    }
    const consulta = JSON.parse(clave) as Consulta;
    let cancelar: (() => void) | undefined;
    let vivo = true;
    setEstado((e) => ({ ...e, cargando: true }));
    obtenerDriver().then((d) => {
      if (!vivo) return;
      cancelar = d.observarLista<T>(
        consulta,
        (datos) => setEstado({ datos, cargando: false, error: '' }),
        (e) => setEstado({ datos: [], cargando: false, error: mensajeDeError(e) }),
      );
    });
    return () => {
      vivo = false;
      cancelar?.();
    };
  }, [clave]);
  return estado;
}

/** Un documento en vivo. */
export function useDocumento<T>(ruta: string | null): Resultado<ConId<T> | null> {
  const [estado, setEstado] = useState<Resultado<ConId<T> | null>>({ datos: null, cargando: !!ruta, error: '' });
  useEffect(() => {
    if (!ruta) {
      setEstado({ datos: null, cargando: false, error: '' });
      return;
    }
    let cancelar: (() => void) | undefined;
    let vivo = true;
    obtenerDriver().then((d) => {
      if (!vivo) return;
      cancelar = d.observarDoc<T>(
        ruta,
        (datos) => setEstado({ datos, cargando: false, error: '' }),
        (e) => setEstado({ datos: null, cargando: false, error: mensajeDeError(e) }),
      );
    });
    return () => {
      vivo = false;
      cancelar?.();
    };
  }, [ruta]);
  return estado;
}

/** Agrupa una lista por un campo (por ejemplo, registros por fecha). */
export function useAgrupar<T, K extends keyof T>(lista: T[], campo: K): Map<T[K], T> {
  return useMemo(() => new Map(lista.map((x) => [x[campo], x])), [lista, campo]);
}
