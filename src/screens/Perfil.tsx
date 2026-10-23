import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { CambiosPerfil } from '@core/perfil';
import { inicial } from '@core/perfil';
import { limpiarNombre, validarNombre, type Tema } from '@core/validaciones';
import { useSesion } from '@/app/sesion';
import { esModoPrueba, obtenerDriver } from '@/data';
import { mensajeDeError } from '@/data/tipos';
import { Laurel } from '@/ui/Laurel';
import { Icono } from '@/ui/Iconos';
import { Hoja } from '@/ui/Hoja';
import { Interruptor } from '@/ui/Interruptor';
import { useAvisos } from '@/ui/avisos';
import { BotonInstalar } from './Instalar';
import { Accesos, MisDatos, Notificaciones } from './PerfilExtra';

const TEMAS: Array<{ id: Tema; nombre: string }> = [
  { id: 'claro', nombre: 'Claro' },
  { id: 'oscuro', nombre: 'Oscuro' },
  { id: 'sistema', nombre: 'Sistema' },
];

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
      <div className="cap gold">Tu cuenta</div>
      <h1 className="titulo">Perfil</h1>

      <div className="cols" style={{ marginTop: 24 }}>
        <div className="panel" style={{ textAlign: 'center', paddingBlock: 28 }}>
          <div style={{ position: 'relative', width: 112, height: 104, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ position: 'absolute', inset: 0 }}>
              <Laurel ancho={112} alto={104} />
            </span>
            <span className="serif" style={{ position: 'relative', width: 64, height: 64, borderRadius: '50%', background: 'var(--goldbg)', color: 'var(--goldtx)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, marginTop: -6 }}>
              {inicial(perfil.nombre)}
            </span>
          </div>
          <div className="serif" style={{ fontSize: 26, fontWeight: 700, marginTop: 10 }}>
            {perfil.nombre}
          </div>
          <div className="mu" style={{ fontWeight: 500, marginTop: 4, overflowWrap: 'anywhere' }}>
            {usuario.correo}
          </div>
          <div className="cap mu2" style={{ marginTop: 10, fontSize: 10.5 }}>
            {usuario.proveedor === 'google' ? 'Entra con Google' : usuario.proveedor === 'prueba' ? 'Cuenta de prueba' : 'Entra con correo'}
            {perfil.rol === 'admin' ? ' · Admin' : ''}
          </div>
          <button
            type="button"
            className="ghost"
            style={{ marginTop: 18 }}
            onClick={() => {
              setNombre(perfil.nombre);
              setError('');
              setEditando(true);
            }}
          >
            Cambiar nombre
          </button>
        </div>

        <div className="panel">
          <div className="grp cap" style={{ marginTop: 0 }}>
            <span>Apariencia</span>
          </div>
          <div className="seg3" role="radiogroup" aria-label="Tema" style={{ marginTop: 12 }}>
            {TEMAS.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={perfil.tema === t.id} className={perfil.tema === t.id ? 'on' : ''} onClick={() => actualizar.mutate({ tema: t.id })}>
                {t.nombre}
              </button>
            ))}
          </div>
          <p className="mu" style={{ fontSize: 13, fontWeight: 500, marginTop: 8 }}>
            Sistema sigue el modo de tu celular o tu PC.
          </p>

          <div className="grp cap">
            <span>Ajustes</span>
          </div>
          <Interruptor etiqueta="Memento mori" detalle="Mostrar los días que quedan del año" activo={perfil.mementoMori} alCambiar={(v) => actualizar.mutate({ mementoMori: v })} />
          <div className="fila" style={{ cursor: 'default' }}>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block' }}>Zona horaria</span>
              <span className="mu" style={{ display: 'block', fontSize: 13, fontWeight: 500, marginTop: 2 }}>
                {perfil.zonaHoraria.replace('_', ' ')}
              </span>
            </span>
          </div>
          <Notificaciones />
          <Accesos />
          <MisDatos />
          <div className="grp cap">
            <span>Sesión</span>
          </div>
          <BotonInstalar estilo="fila" />
          <button type="button" className="fila" onClick={salir} style={{ color: 'var(--cor)' }}>
            <Icono nombre="salir" />
            <span style={{ flex: 1 }}>Cerrar sesión</span>
          </button>
          <p className="cap mu2" style={{ marginTop: 18, fontSize: 10.5 }}>
            Stoica v{__VERSION__}
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
    </div>
  );
}
