import { useEffect, type ReactNode } from 'react';
import { claveDia, ZONA_POR_DEFECTO } from '@core/fechas';
import { completarPerfil, perfilInicial, plataformaDe } from '@core/perfil';
import { obtenerDriver } from '@/data';
import { mensajeDeError } from '@/data/tipos';
import { useSesion } from './sesion';
import { aplicarTema, TEMA_PREDETERMINADO } from './tema';
import { esInstalada } from '@/pwa/instalar';
import { esNativo } from '@/nativo/nativo';

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
    .then((d) => d.registrarAcceso(uid, plataformaDe(navigator.userAgent, esInstalada() || esNativo())))
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
    let refrescado = false;
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
            // Una vez por dispositivo: que el servidor revise el rol (cuentas creadas antes del servidor,
            // o el correo del admin configurado después). Si cambia, llega por el perfil y se refresca el token.
            if (p.rol !== 'admin') revisarCuenta(usuario.uid, () => d.llamar('asegurarCuenta'));
            registrarAccesoDelDia(usuario.uid, p.zonaHoraria);
            // El perfil se mostró al instante (desde el dispositivo); ahora se refresca con lo del servidor,
            // sin pisar un cambio hecho acá que sea más nuevo.
            if (!refrescado) {
              refrescado = true;
              void d.perfilDelServidor(usuario.uid).then((fresco) => {
                const actual = useSesion.getState().perfil;
                if (!fresco || !actual || useSesion.getState().usuario?.uid !== usuario.uid) return;
                if ((fresco.actualizado ?? 0) > (actual.actualizado ?? 0)) poner({ perfil: completarPerfil(fresco) });
              });
            }
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
    aplicarTema(tema ?? TEMA_PREDETERMINADO);
  }, [tema]);

  return <>{children}</>;
}

function revisarCuenta(uid: string, llamar: () => Promise<unknown>) {
  const clave = `stoica.cuentaRevisada.${uid}`;
  try {
    if (localStorage.getItem(clave)) return;
    localStorage.setItem(clave, '1');
  } catch {
    return;
  }
  llamar().catch(() => {
    try {
      localStorage.removeItem(clave);
    } catch {
      /* nada */
    }
  });
}
