import { useState } from 'react';
import { Link } from 'react-router-dom';
import { minutoUTC } from '@core/fechas';
import type { CambiosPerfil } from '@core/perfil';
import { useSesion } from '@/app/sesion';
import { hoyActual } from '@/app/datos';
import { obtenerDriver } from '@/data';
import { mensajeDeError } from '@/data/tipos';
import { Interruptor } from '@/ui/Interruptor';
import { useAvisos } from '@/ui/avisos';
import { Hoja } from '@/ui/Hoja';
import { esAndroid, esIOS, esInstalada } from '@/pwa/instalar';

const CLAVE_DISPOSITIVO = 'stoica.dispositivo';

/** Id corto y estable para el documento del dispositivo (no guarda el token en el id). */
function idDispositivo(token: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0;
  for (let i = 0; i < token.length; i++) {
    h1 = Math.imul(h1 ^ token.charCodeAt(i), 16777619) >>> 0;
    h2 = (h2 * 31 + token.charCodeAt(i)) >>> 0;
  }
  return `d${h1.toString(36)}${h2.toString(36)}`;
}

async function actualizar(c: CambiosPerfil) {
  const uid = useSesion.getState().usuario!.uid;
  await (await obtenerDriver()).actualizarPerfil(uid, c);
}

/** ¿Este dispositivo está registrado para recibir avisos? (la cuenta puede tenerlos en otro dispositivo). */
function dispositivoRegistrado(): boolean {
  try {
    if (!localStorage.getItem(CLAVE_DISPOSITIVO)) return false;
    // En modo prueba el registro es simulado: no depende del permiso real del navegador.
    if (import.meta.env.MODE === 'prueba') return true;
    return typeof Notification !== 'undefined' && Notification.permission === 'granted';
  } catch {
    return false;
  }
}

/**
 * Activar o apagar los avisos en ESTE dispositivo. El navegador solo muestra la pregunta de permiso
 * cuando la persona toca un botón; por eso esto se usa desde Perfil y desde la invitación en Hoy.
 */
export function useNotificacionesDispositivo() {
  const perfil = useSesion((s) => s.perfil)!;
  const uid = useSesion((s) => s.usuario!.uid);
  const mostrar = useAvisos((s) => s.mostrar);
  const [ocupado, setOcupado] = useState(false);
  const [, refrescar] = useState(0);
  const soportado = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
  const bloqueado = soportado && Notification.permission === 'denied';
  const activa = !!perfil.notificaciones && dispositivoRegistrado();

  const activar = async (si: boolean) => {
    setOcupado(true);
    try {
      const d = await obtenerDriver();
      if (si) {
        const r = await d.activarNotificaciones();
        if ('error' in r) {
          mostrar(r.error);
          return;
        }
        const id = idDispositivo(r.token);
        await d.guardar(`users/${uid}/devices/${id}`, { token: r.token, plataforma: navigator.userAgent.includes('Mobile') ? 'celular' : 'computadora', actualizado: Date.now(), actualizadoPor: uid });
        try {
          localStorage.setItem(CLAVE_DISPOSITIVO, id);
        } catch {
          /* nada */
        }
        await actualizar({ notificaciones: true, examenSlot: null, examenMin: perfil.examenHora ? minutoUTC(perfil.examenHora, perfil.zonaHoraria) : null });
        mostrar('Notificaciones activadas en este dispositivo.');
      } else {
        let id: string | null = null;
        try {
          id = localStorage.getItem(CLAVE_DISPOSITIVO);
        } catch {
          /* nada */
        }
        if (id) await d.borrar(`users/${uid}/devices/${id}`);
        await d.desactivarNotificaciones();
        try {
          localStorage.removeItem(CLAVE_DISPOSITIVO);
        } catch {
          /* nada */
        }
        // Si quedan otros dispositivos registrados, la cuenta sigue recibiendo avisos en ellos.
        const otros = await d.leerLista({ ruta: `users/${uid}/devices` }).catch(() => []);
        if (otros.length === 0) await actualizar({ notificaciones: false });
        mostrar('Notificaciones desactivadas.');
      }
    } catch (e) {
      mostrar(mensajeDeError(e));
    } finally {
      setOcupado(false);
      refrescar((n) => n + 1);
    }
  };

  return { activa, ocupado, activar, soportado, bloqueado };
}

export function Notificaciones() {
  const perfil = useSesion((s) => s.perfil)!;
  const mostrar = useAvisos((s) => s.mostrar);
  const { activa, ocupado, activar, soportado, bloqueado } = useNotificacionesDispositivo();

  const [probando, setProbando] = useState(false);
  const probar = async () => {
    setProbando(true);
    mostrar('En 10 segundos te llega. Salí de la app o bloqueá el celular para verlo como le llegaría a cualquiera.');
    try {
      const d = await obtenerDriver();
      const r = await d.llamar<{ enviados: number; dispositivos: number }>('probarNotificacion');
      if (r.dispositivos === 0) mostrar('No hay dispositivos registrados. Apagá y prendé las notificaciones en este dispositivo.');
      else if (r.enviados === 0) mostrar('No se pudo entregar. Apagá y prendé las notificaciones para registrar este dispositivo de nuevo.');
      else mostrar('Aviso enviado.');
    } catch (e) {
      mostrar(mensajeDeError(e));
    } finally {
      setProbando(false);
    }
  };

  return (
    <>
      <div className="grp cap">
        <span>Notificaciones</span>
      </div>
      <Interruptor etiqueta="Recordatorios y examen" detalle="Avisos de tus hábitos (si todavía no cumpliste) y del examen nocturno" activo={activa} alCambiar={(v) => !ocupado && activar(v)} />
      {esIOS() && !esInstalada() && (
        <p className="mu" style={{ fontSize: 13, fontWeight: 500, margin: '8px 0' }}>
          En iPhone las notificaciones funcionan solo con la app instalada (Compartir › Agregar a pantalla de inicio).
        </p>
      )}
      {bloqueado && (
        <p className="mu" style={{ fontSize: 13, fontWeight: 500, margin: '8px 0' }}>
          Este navegador tiene los avisos bloqueados para Stoica. Tocá el candado o los tres puntos junto a la dirección › <b>Permisos</b> › <b>Notificaciones</b> › <b>Permitir</b>, y después prendé el interruptor.
        </p>
      )}
      {!soportado && (
        <p className="mu" style={{ fontSize: 13, fontWeight: 500, margin: '8px 0' }}>
          Este navegador no permite avisos. Usá Chrome o instalá la app.
        </p>
      )}
      {activa && esAndroid() && (
        <details className="mu" style={{ fontSize: 13, fontWeight: 500, margin: '8px 0' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>¿Te llegan sin sonido o sin ventana?</summary>
          <ol style={{ margin: '6px 0 0', paddingLeft: 18, display: 'grid', gap: 4 }}>
            <li>
              En Samsung, primero activá las categorías: <b>Ajustes › Notificaciones › Ajustes avanzados › Administrar categorías de notificaciones por aplic.</b>
            </li>
            <li>
              Volvé a <b>Notificaciones › Notificaciones de aplicaciones</b> y buscá <b>{esInstalada() ? 'Stoica' : 'Chrome'}</b>.
            </li>
            <li>
              Entrá a <b>Categorías de notificación › General</b> y elegí <b>Alerta</b>, con <b>Mostrar como ventana emergente</b> activado.
            </li>
          </ol>
          <p style={{ margin: '6px 0 0' }}>Se hace una sola vez. En otros Android las categorías aparecen directamente en la app.</p>
        </details>
      )}
      {activa && (
        <button type="button" className="ghost" style={{ margin: '6px 0 4px' }} disabled={probando} onClick={probar}>
          {probando ? 'Llega en 10 segundos…' : 'Mandarme un aviso de prueba'}
        </button>
      )}
      <label className="fila" style={{ cursor: 'default' }}>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block' }}>Aviso del examen</span>
          <span className="mu" style={{ display: 'block', fontSize: 13, fontWeight: 500, marginTop: 2 }}>
            Hora en que te recordamos el examen nocturno
          </span>
        </span>
        <input
          type="time"
          className="fi"
          style={{ width: 130 }}
          value={perfil.examenHora ?? ''}
          aria-label="Hora del aviso del examen"
          onChange={(e) => {
            const h = e.target.value || null;
            actualizar({ examenHora: h, examenSlot: null, examenMin: h ? minutoUTC(h, perfil.zonaHoraria) : null }).catch((er) => mostrar(mensajeDeError(er)));
          }}
        />
      </label>
      <Interruptor etiqueta="Reacciones de mis grupos" detalle="Aviso cuando alguien reacciona a tu día" activo={perfil.notifReacciones} alCambiar={(v) => actualizar({ notifReacciones: v }).catch((er) => mostrar(mensajeDeError(er)))} />
      <Interruptor etiqueta="Cuando un compañero cumple" detalle="Aviso cuando alguien de tus grupos cumple un hábito que comparte" activo={perfil.notifCumplidos !== false} alCambiar={(v) => actualizar({ notifCumplidos: v }).catch((er) => mostrar(mensajeDeError(er)))} />
      <Interruptor etiqueta="Fotos de mis grupos" detalle="Aviso cuando alguien sube la foto de su hábito" activo={perfil.notifFotos !== false} alCambiar={(v) => actualizar({ notifFotos: v }).catch((er) => mostrar(mensajeDeError(er)))} />
      <Interruptor etiqueta="Comentarios en fotos" detalle="Aviso cuando comentan tu foto o una foto donde comentaste" activo={perfil.notifMensajes !== false} alCambiar={(v) => actualizar({ notifMensajes: v }).catch((er) => mostrar(mensajeDeError(er)))} />
    </>
  );
}

export function Accesos() {
  const rol = useSesion((s) => s.perfil?.rol);
  return (
    <>
      <div className="grp cap">
        <span>Más</span>
      </div>
      <Link to="/comunidad" className="fila" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span style={{ flex: 1 }}>Comunidad</span>
        <span className="mu2">›</span>
      </Link>
      {rol === 'admin' && (
        <Link to="/admin" className="fila" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span style={{ flex: 1 }}>Panel de admin</span>
          <span className="mu2">›</span>
        </Link>
      )}
    </>
  );
}

const COLECCIONES_PROPIAS = ['habits', 'logs', 'tasks', 'taskDone', 'focus', 'journal', 'milestones'] as const;

export function MisDatos() {
  const uid = useSesion((s) => s.usuario!.uid);
  const perfil = useSesion((s) => s.perfil)!;
  const mostrar = useAvisos((s) => s.mostrar);
  const [borrando, setBorrando] = useState(false);
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const exportar = async () => {
    setOcupado(true);
    try {
      const d = await obtenerDriver();
      const datos: Record<string, unknown> = { app: 'Stoica', version: __VERSION__, exportado: new Date().toISOString(), perfil };
      for (const c of COLECCIONES_PROPIAS) datos[c] = await d.leerLista({ ruta: `users/${uid}/${c}` });
      const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `stoica-${hoyActual()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      mostrar('Descargamos tus datos.');
    } catch (e) {
      mostrar(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };

  const borrarCuenta = async () => {
    setOcupado(true);
    try {
      const d = await obtenerDriver();
      await d.llamar('borrarMiCuenta');
      await d.salir().catch(() => undefined);
    } catch (e) {
      mostrar(mensajeDeError(e));
      setOcupado(false);
    }
  };

  return (
    <>
      <div className="grp cap">
        <span>Tus datos</span>
      </div>
      <button type="button" className="fila" onClick={exportar} disabled={ocupado}>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block' }}>Exportar mis datos</span>
          <span className="mu" style={{ display: 'block', fontSize: 13, fontWeight: 500, marginTop: 2 }}>
            Un archivo JSON con tus hábitos, registros, tareas, enfoque y exámenes
          </span>
        </span>
      </button>
      <button type="button" className="fila" onClick={() => (setTexto(''), setBorrando(true))} style={{ color: 'var(--cor)' }}>
        <span style={{ flex: 1 }}>Borrar mi cuenta</span>
      </button>
      <Hoja titulo="Borrar mi cuenta" abierta={borrando} alCerrar={() => setBorrando(false)}>
        <p className="mu" style={{ fontWeight: 500, marginTop: 10 }}>
          Se borran tu cuenta y todos tus datos: hábitos, registros, tareas, enfoque, exámenes y lo que compartías en grupos. No se puede deshacer. Si querés, exportá tus datos antes.
        </p>
        <label className="lbl cap" htmlFor="confirmar-borrar">
          Escribí BORRAR para confirmar
        </label>
        <input id="confirmar-borrar" className="inp" autoComplete="off" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <button type="button" className="ghost peligro" style={{ width: '100%', marginTop: 18, background: 'var(--missbg)' }} disabled={texto.trim().toUpperCase() !== 'BORRAR' || ocupado} onClick={borrarCuenta}>
          {ocupado ? 'Borrando…' : 'Borrar definitivamente'}
        </button>
      </Hoja>
    </>
  );
}
