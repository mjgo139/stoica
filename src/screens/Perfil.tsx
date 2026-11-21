import { useState, type FormEvent } from 'react';
import { Avatar, BotonFoto, CabeceraPagina, ElegirTema, Grupo, TarjetaPerfil } from '../../familia/react';
import { useMutation } from '@tanstack/react-query';
import type { CambiosPerfil } from '@core/perfil';
import { limpiarNombre, validarContrasena, validarNombre } from '@core/validaciones';
import { useSesion } from '@/app/sesion';
import { esPruebaPorEnlace, salirDelModoPrueba, esModoPrueba, obtenerDriver } from '@/data';
import { mensajeDeError } from '@/data/tipos';
import { Icono } from '@/ui/Iconos';
import { NOVEDADES } from '@/app/novedades';
import { Hoja } from '@/ui/Hoja';
import { Interruptor } from '@/ui/Interruptor';
import { useAvisos } from '@/ui/avisos';
import { BotonInstalar } from './Instalar';
import { Accesos, MisDatos, Notificaciones } from './PerfilExtra';
import { AppAndroid } from '@/nativo/AppAndroid';


function useActualizarPerfil() {
  const uid = useSesion((s) => s.usuario?.uid);
  const mostrar = useAvisos((s) => s.mostrar);
  return useMutation({
    mutationFn: async (c: CambiosPerfil) => (await obtenerDriver()).actualizarPerfil(uid!, c),
    onError: (e) => mostrar(mensajeDeError(e)),
  });
}

export function Perfil() {
  const perfil = useSesion((s) => s.perfil)!;
  const usuario = useSesion((s) => s.usuario)!;
  const actualizar = useActualizarPerfil();
  const mostrar = useAvisos((s) => s.mostrar);
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(perfil.nombre);
  const [error, setError] = useState('');
  const [cambiandoClave, setCambiandoClave] = useState(false);

  const guardarNombre = (e: FormEvent) => {
    e.preventDefault();
    const v = validarNombre(nombre);
    if (!v.ok) return setError(v.error);
    actualizar.mutate({ nombre: limpiarNombre(nombre) }, { onSuccess: () => mostrar('Nombre guardado.') });
    setEditando(false);
  };

  const salir = async () => {
    try {
      await (await obtenerDriver()).salir();
    } catch (e) {
      mostrar(mensajeDeError(e));
    }
  };

  return (
    <div className="entra">
      <CabeceraPagina etiqueta="Tu cuenta" titulo="Perfil" />

      <div className="cols" style={{ marginTop: 24 }}>
        <TarjetaPerfil
          avatar={<Avatar foto={perfil.foto} nombre={perfil.nombre} />}
          nombre={perfil.nombre}
          correo={usuario.proveedor === 'invitado' ? undefined : usuario.correo || perfil.correo}
          detalle={
            <>
              {usuario.proveedor === 'google' ? 'Entra con Google' : usuario.proveedor === 'prueba' ? 'Cuenta de prueba' : usuario.proveedor === 'invitado' ? 'Modo invitado' : 'Entra con correo'}
              {perfil.rol === 'admin' ? ' · Admin' : ''}
            </>
          }
          acciones={
            <>
              <BotonFoto alElegir={(foto) => actualizar.mutate({ foto }, { onSuccess: () => mostrar('Foto guardada.') })} alFallar={() => mostrar('No se pudo abrir esa imagen.')}>
                Cambiar foto
              </BotonFoto>
              {perfil.foto && (
                <button type="button" className="btn-borde" onClick={() => actualizar.mutate({ foto: null }, { onSuccess: () => mostrar('Foto quitada.') })}>
                  Quitar foto
                </button>
              )}
              <button
                type="button"
                className="btn-borde"
                onClick={() => {
                  setNombre(perfil.nombre);
                  setError('');
                  setEditando(true);
                }}
              >
                Cambiar nombre
              </button>
            </>
          }
        />

        <div className="panel">
          <Grupo n={1} className="sep-grupo sin-arriba">Apariencia</Grupo>
          <div style={{ marginTop: 12 }}>
            <ElegirTema valor={perfil.tema} cambiar={(t) => actualizar.mutate({ tema: t })} />
          </div>
          <p className="mu" style={{ fontSize: 13.5, fontWeight: 500, marginTop: 8 }}>
            Noche romana es el tema de la familia estoica. Sistema sigue el modo de tu celular o tu PC.
          </p>

          <Grupo n={2} className="sep-grupo">Ajustes</Grupo>
          <Interruptor etiqueta="Memento mori" detalle="Mostrar los días que quedan del año" activo={perfil.mementoMori} alCambiar={(v) => actualizar.mutate({ mementoMori: v })} />
          <div className="fila" style={{ cursor: 'default' }}>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block' }}>Zona horaria</span>
              <span className="mu" style={{ display: 'block', fontSize: 13.5, fontWeight: 500, marginTop: 2 }}>
                {perfil.zonaHoraria.replace('_', ' ')}
              </span>
            </span>
          </div>
          <Notificaciones n={3} />
          <AppAndroid />
          <Accesos n={4} />
          <MisDatos n={5} />
          {perfil.rol === 'admin' && <VersionYNovedades />}
          <Grupo n={6} className="sep-grupo">Sesión</Grupo>
          <BotonInstalar estilo="fila" />
          {usuario.proveedor === 'invitado' && <GuardarInvitado />}
          {esPruebaPorEnlace() && (
            <button type="button" className="fila" onClick={salirDelModoPrueba}>
              <Icono nombre="salir" />
              <span style={{ flex: 1 }}>Salir del modo prueba</span>
            </button>
          )}
          {(usuario.proveedor === 'password' || usuario.proveedor === 'prueba') && (
            <button type="button" className="fila" onClick={() => setCambiandoClave(true)}>
              <Icono nombre="llave" />
              <span style={{ flex: 1 }}>Cambiar contraseña</span>
            </button>
          )}
          <button type="button" className="fila" onClick={salir} style={{ color: 'var(--miss)' }}>
            <Icono nombre="salir" />
            <span style={{ flex: 1 }}>Cerrar sesión</span>
          </button>
          <p className="cap mu2" style={{ marginTop: 18, fontSize: 11 }}>
            StoaHabit v{__VERSION__}
            {esModoPrueba() ? ' · modo prueba' : ''}
          </p>
        </div>
      </div>

      <Hoja titulo="Cambiar nombre" abierta={editando} alCerrar={() => setEditando(false)}>
        <form onSubmit={guardarNombre} noValidate>
          <label className="lbl cap" htmlFor="nuevo-nombre">
            Nombre
          </label>
          <input id="nuevo-nombre" className="inp" maxLength={40} autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <div className="err" role="alert">
            {error}
          </div>
          <button className="btn" type="submit" style={{ marginTop: 8 }}>
            Guardar
          </button>
        </form>
      </Hoja>
      <HojaContrasena abierta={cambiandoClave} alCerrar={() => setCambiandoClave(false)} correo={usuario.correo} />
    </div>
  );
}

/** Cambiar la contraseña: pide la actual (Firebase lo exige para confirmar que sos vos) y la nueva dos veces. */
function HojaContrasena({ abierta, alCerrar, correo }: { abierta: boolean; alCerrar: () => void; correo: string }) {
  const mostrar = useAvisos((s) => s.mostrar);
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cerrar = () => {
    setActual('');
    setNueva('');
    setRepetir('');
    setError('');
    alCerrar();
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!actual) return setError('Escribí tu contraseña actual.');
    const v = validarContrasena(nueva);
    if (!v.ok) return setError(v.error);
    if (nueva !== repetir) return setError('Las dos contraseñas nuevas no coinciden.');
    if (nueva === actual) return setError('La nueva tiene que ser distinta a la actual.');
    setOcupado(true);
    try {
      await (await obtenerDriver()).cambiarContrasena(actual, nueva);
      mostrar('Contraseña cambiada.');
      cerrar();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setOcupado(false);
    }
  };

  const olvide = async () => {
    try {
      await (await obtenerDriver()).recuperarContrasena(correo);
      mostrar(`Te mandamos un correo a ${correo} para crear una contraseña nueva.`);
      cerrar();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  return (
    <Hoja titulo="Cambiar contraseña" abierta={abierta} alCerrar={cerrar}>
      <form onSubmit={guardar} noValidate>
        <label className="lbl cap" htmlFor="clave-actual">
          Contraseña actual
        </label>
        <input id="clave-actual" className="inp" type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} />
        <label className="lbl cap" htmlFor="clave-nueva" style={{ marginTop: 14 }}>
          Contraseña nueva
        </label>
        <input id="clave-nueva" className="inp" type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        <label className="lbl cap" htmlFor="clave-repetir" style={{ marginTop: 14 }}>
          Repetí la nueva
        </label>
        <input id="clave-repetir" className="inp" type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} />
        <div className="err" role="alert">
          {error}
        </div>
        <button className="btn" type="submit" style={{ marginTop: 8 }} disabled={ocupado}>
          {ocupado ? 'Guardando…' : 'Guardar contraseña'}
        </button>
        <button type="button" className="ghost" style={{ width: '100%', marginTop: 10 }} onClick={olvide}>
          No recuerdo la actual: mandame un correo
        </button>
      </form>
    </Hoja>
  );
}

/** Solo para el admin: qué versión está corriendo en este equipo y qué trae de nuevo. */
function VersionYNovedades() {
  const [abierta, setAbierta] = useState(false);
  const [actual, ...anteriores] = NOVEDADES;
  const armado = new Date(__ARMADO__);
  const cuando = isNaN(armado.getTime()) ? '' : armado.toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' });
  return (
    <div className="fila" style={{ cursor: 'default', flexDirection: 'column', alignItems: 'stretch' }} data-testid="version-admin">
      <button type="button" onClick={() => setAbierta((v) => !v)} aria-expanded={abierta} style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%' }}>
        <Icono nombre="info" />
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block' }}>Versión {__VERSION__}</span>
          <span className="mu" style={{ display: 'block', fontSize: 13.5, fontWeight: 500, marginTop: 2 }}>
            Armada {cuando} · {__COMMIT__} · solo la ves vos (admin)
          </span>
        </span>
        <span className="mu" aria-hidden="true">{abierta ? '▲' : '▼'}</span>
      </button>
      {abierta && (
        <div style={{ marginTop: 10, fontSize: 13.5 }}>
          <b>Novedades de la {actual.version}</b>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {actual.cambios.map((c) => (
              <li key={c} style={{ marginBottom: 4 }}>{c}</li>
            ))}
          </ul>
          {anteriores.map((n) => (
            <details key={n.version} style={{ marginTop: 8 }}>
              <summary className="mu">Versión {n.version} · {n.fecha}</summary>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {n.cambios.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

/** Cuenta de invitado: se guarda con correo y contraseña sin perder hábitos, registros ni grupos */
function GuardarInvitado() {
  const mostrar = useAvisos((x) => x.mostrar);
  const [abierta, setAbierta] = useState(false);
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setOcupado(true);
    try {
      await (await obtenerDriver()).guardarCuentaInvitado(correo, clave);
      setAbierta(false);
      mostrar('Cuenta guardada: ya podés entrar con tu correo.');
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <>
      <button type="button" className="fila" onClick={() => setAbierta(true)} data-testid="guardar-invitado">
        <Icono nombre="check" />
        <span style={{ flex: 1 }}>
          Guardar mi cuenta
          <span className="mu2" style={{ display: 'block', fontSize: 12.5, fontWeight: 500 }}>
            Sos invitado: agregá correo y contraseña para no perder nada si cambiás de celular.
          </span>
        </span>
      </button>
      <Hoja titulo="Guardar mi cuenta" abierta={abierta} alCerrar={() => setAbierta(false)}>
        <form onSubmit={guardar} noValidate>
          <label className="lbl cap" htmlFor="inv-correo">Correo</label>
          <input id="inv-correo" className="inp" type="email" inputMode="email" autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
          <label className="lbl cap" htmlFor="inv-clave">Contraseña</label>
          <input id="inv-clave" className="inp" type="password" autoComplete="new-password" placeholder="Mínimo 6 caracteres" value={clave} onChange={(e) => setClave(e.target.value)} />
          <div className="err" role="alert">{error}</div>
          <button type="submit" className="btn" disabled={ocupado} style={{ width: '100%', marginTop: 8 }}>
            Guardar
          </button>
        </form>
      </Hoja>
    </>
  );
}
