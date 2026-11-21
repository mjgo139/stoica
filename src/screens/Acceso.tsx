import { useState, type FormEvent } from 'react';
import { validarContrasena, validarCorreo, validarNombre, limpiarNombre } from '@core/validaciones';
import { obtenerDriver, esModoPrueba, esPruebaPorEnlace, salirDelModoPrueba } from '@/data';
import { mensajeDeError } from '@/data/tipos';
import { Marca } from '@/ui/Marca';
import { LogoGoogle } from '@/ui/Iconos';
import { esNativo } from '@/nativo/nativo';
import { BotonInstalar } from './Instalar';

type Modo = 'entrar' | 'crear' | 'recuperar';

export function Acceso() {
  const [modo, setModo] = useState<Modo>('entrar');
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cambiar = (m: Modo) => {
    setModo(m);
    setError('');
    setOk('');
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setOk('');
    const chequeos = [
      modo === 'crear' ? validarNombre(nombre) : { ok: true as const },
      validarCorreo(correo),
      modo !== 'recuperar' ? (modo === 'crear' ? validarContrasena(contrasena) : contrasena ? { ok: true as const } : { ok: false as const, error: 'Escribí tu contraseña.' }) : { ok: true as const },
    ];
    const falla = chequeos.find((c) => !c.ok);
    if (falla && !falla.ok) return setError(falla.error);
    setOcupado(true);
    try {
      const d = await obtenerDriver();
      if (modo === 'entrar') await d.entrar(correo, contrasena);
      else if (modo === 'crear') await d.registrar(limpiarNombre(nombre), correo, contrasena);
      else {
        await d.recuperarContrasena(correo);
        setOk('Si hay una cuenta con ese correo, te llegó un enlace para crear una contraseña nueva. Revisá también la carpeta de spam.');
      }
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setOcupado(false);
    }
  };

  const comoInvitado = async () => {
    setError('');
    setOcupado(true);
    try {
      await (await obtenerDriver()).entrarComoInvitado();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setOcupado(false);
    }
  };
  const conEjemplo = async () => {
    setError('');
    setOcupado(true);
    try {
      await (await obtenerDriver()).entrar('prueba@stoica.app', 'stoica');
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setOcupado(false);
    }
  };

  const conGoogle = async () => {
    setError('');
    setOcupado(true);
    try {
      await (await obtenerDriver()).entrarConGoogle();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <main className="entra" style={{ maxWidth: 420, margin: '0 auto', paddingTop: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ margin: 0 }} aria-label="StoaHabit">
          <Marca grande />
        </h1>
        <p className="lead" style={{ fontFamily: 'var(--f-display)', fontSize: 18, fontWeight: 600 }}>
          Hábitos. Disciplina. Una vida más serena.
        </p>
      </div>

      {modo !== 'recuperar' ? (
        <div className="seg3" role="tablist" style={{ marginTop: 30 }}>
          <button type="button" role="tab" aria-selected={modo === 'entrar'} className={modo === 'entrar' ? 'on' : ''} onClick={() => cambiar('entrar')}>
            Entrar
          </button>
          <button type="button" role="tab" aria-selected={modo === 'crear'} className={modo === 'crear' ? 'on' : ''} onClick={() => cambiar('crear')}>
            Crear cuenta
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 30 }}>
          <div className="cap gold">Recuperar acceso</div>
          <p className="mu" style={{ fontWeight: 500, marginTop: 6 }}>
            Te mandamos un correo con un enlace para crear una contraseña nueva.
          </p>
        </div>
      )}

      <form onSubmit={enviar} noValidate>
        {modo === 'crear' && (
          <>
            <label className="lbl cap" htmlFor="nombre">
              Nombre
            </label>
            <input id="nombre" className="inp" autoComplete="name" maxLength={40} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Cómo querés que te llamemos" />
          </>
        )}
        <label className="lbl cap" htmlFor="correo">
          Correo
        </label>
        <input id="correo" className="inp" type="email" inputMode="email" autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="tu@correo.com" />
        {modo !== 'recuperar' && (
          <>
            <label className="lbl cap" htmlFor="contrasena">
              Contraseña
            </label>
            <input
              id="contrasena"
              className="inp"
              type="password"
              autoComplete={modo === 'crear' ? 'new-password' : 'current-password'}
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder={modo === 'crear' ? 'Mínimo 6 caracteres' : 'Tu contraseña'}
            />
          </>
        )}
        <div className="err" role="alert">
          {error}
        </div>
        {ok && (
          <div className="okmsg" role="status">
            {ok}
          </div>
        )}
        <button className="btn" type="submit" disabled={ocupado} style={{ marginTop: 8 }}>
          {modo === 'entrar' ? 'Entrar' : modo === 'crear' ? 'Crear cuenta' : 'Enviar enlace'}
        </button>
      </form>

      {modo === 'entrar' && (
        <div style={{ textAlign: 'center', marginTop: 6 }}>
          <button type="button" className="link" onClick={() => cambiar('recuperar')}>
            Olvidé mi contraseña
          </button>
        </div>
      )}
      {modo === 'recuperar' && (
        <div style={{ textAlign: 'center', marginTop: 6 }}>
          <button type="button" className="link" onClick={() => cambiar('entrar')}>
            Volver a entrar
          </button>
        </div>
      )}

      {modo !== 'recuperar' && (
        <>
          <div className="sep cap">o</div>
          <button type="button" className="btn-google" onClick={conGoogle} disabled={ocupado}>
            <LogoGoogle /> Continuar con Google
          </button>
          <button type="button" className="btn-sec invitado" onClick={comoInvitado} disabled={ocupado}>
            Continuar como invitado
          </button>
          <p className="mu2 nota-invitado">Sin correo: después podés guardar tu cuenta desde Perfil sin perder nada.</p>
        </>
      )}

      {!esNativo() && <BotonInstalar estilo="discreto" />}

      {esModoPrueba() && (
        <div className="franja info modo-prueba" style={{ marginTop: 22 }}>
          <span>Modo prueba: nada se guarda en Firebase. Entrá con la cuenta de ejemplo (prueba@stoica.app · stoica) o creá una cuenta inventada.</span>
          <span className="acciones-prueba">
            <button type="button" className="btn" onClick={conEjemplo} disabled={ocupado}>
              Entrar con la cuenta de ejemplo
            </button>
            {esPruebaPorEnlace() && (
              <button type="button" className="link" onClick={salirDelModoPrueba}>
                Salir del modo prueba
              </button>
            )}
          </span>
        </div>
      )}
    </main>
  );
}
