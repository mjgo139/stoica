import { useEffect, type ReactNode } from 'react';
import { claveDia, ZONA_POR_DEFECTO } from '@core/fechas';
import { completarPerfil, perfilInicial, plataformaDe } from '@core/perfil';
import { obtenerDriver } from '@/data';
import { mensajeDeError } from '@/data/tipos';
import { useSesion } from './sesion';
import { aplicarTema } from './tema';
import { esInstalada } from '@/pwa/instalar';

const zonaDelDispositivo = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ZONA_POR_DEFECTO;
  } catch {
    return ZONA_POR_DEFECTO;
  }
};

/** Registra el último acceso una sola vez por día y por dispositivo (para no gastar escrituras). */
function registrarAccesoDelDia(uid: string, zona: string) {
  const clave = `stoica.acceso.${uid}`;
  const hoy = claveDia(new Date(), zona);
  try {
    if (localStorage.getItem(clave) === hoy) return;
  } catch {
    return;
  }
  obtenerDriver()
    .then((d) => d.registrarAcceso(uid, plataformaDe(navigator.userAgent, esInstalada())))
    .then(() => {
      try {
        localStorage.setItem(clave, hoy);
      } catch {
        /* nada */
      }
    })
    .catch(() => undefined); // si la cuenta todavía no existe en el servidor, se reintenta en la próxima apertura
}

export function Arranque({ children }: { children: ReactNode }) {
  const poner = useSesion((s) => s.poner);
  const usuario = useSesion((s) => s.usuario);
  const tema = useSesion((s) => s.perfil?.tema);

  useEffect(() => {
    let cancelar: (() => void) | undefined;
    obtenerDriver()
      .then((d) => {
        cancelar = d.observarSesion((u) => {
          if (!u) poner({ estado: 'fuera', usuario: null, perfil: null });
          else poner({ usuario: u });
        });
      })
      .catch((e) => poner({ estado: 'error', error: mensajeDeError(e) }));
    return () => cancelar?.();
  }, [poner]);

  useEffect(() => {
    if (!usuario) return;
    let creando = false;
    let cancelar: (() => void) | undefined;
    obtenerDriver().then((d) => {
      cancelar = d.observarPerfil(
        usuario.uid,
        (p) => {
          if (p) {
            const anterior = useSesion.getState().perfil?.rol;
            poner({ estado: 'dentro', perfil: completarPerfil(p) });
            // Si el servidor acaba de asignar el rol, pedimos un token nuevo para que las reglas lo vean.
            if (p.rol && p.rol !== anterior) d.refrescarToken();
            registrarAccesoDelDia(usuario.uid, p.zonaHoraria);
          } else if (!creando) {
            creando = true;
            const nuevo = perfilInicial(usuario.uid, usuario.nombre, usuario.correo, zonaDelDispositivo(), Date.now());
            d.crearPerfil(usuario.uid, nuevo).catch((e) => poner({ estado: 'error', error: mensajeDeError(e) }));
          }
        },
        (e) => poner({ estado: 'error', error: mensajeDeError(e) }),
      );
    });
    return () => cancelar?.();
  }, [usuario, poner]);

  useEffect(() => {
    aplicarTema(tema ?? 'sistema');
  }, [tema]);

  return <>{children}</>;
}
