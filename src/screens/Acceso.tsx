import { useState } from 'react';
import { validarContrasena, validarCorreo, validarNombre, limpiarNombre } from '@core/validaciones';
import { obtenerDriver, esModoPrueba } from '@/data';
import { ErrorStoica, mensajeDeError } from '@/data/tipos';
import { esNativo } from '@/nativo/nativo';
import { AvisoMudanza } from '@/ui/AvisoMudanza';
import { EmblemaStoaHabit } from '@/ui/Marca';
import { DescargarApp, Emblema, FormularioAcceso, PantallaAcceso, PortadaAcceso, type VistaAcceso } from '../../familia/react';
import { FIGURAS } from '../../familia/figuras';
import { Icono } from '../../familia/iconos';
import portada from '../../familia/portada-filosofo.webp';
import { BotonInstalar } from './Instalar';

/** Lanza el error de la validación (lo muestra el formulario de la familia) */
const exigir = (r: { ok: true } | { ok: false; error: string }) => {
  if (!r.ok) throw new ErrorStoica(r.error, 'invalido');
};

/** Funciones de StoaHabit para el formulario de acceso de la familia (con las validaciones de siempre) */
export const accionesAcceso = {
  ingresar: async (email: string, clave: string) => {
    exigir(validarCorreo(email));
    if (!clave) throw new ErrorStoica('Escribí tu contraseña.', 'invalido');
    await (await obtenerDriver()).entrar(email, clave);
  },
  registrar: async (nombre: string, email: string, clave: string) => {
    exigir(validarNombre(nombre));
    exigir(validarCorreo(email));
    exigir(validarContrasena(clave));
    await (await obtenerDriver()).registrar(limpiarNombre(nombre), email, clave);
  },
  recuperar: async (email: string) => {
    exigir(validarCorreo(email));
    await (await obtenerDriver()).recuperarContrasena(email);
  },
  google: async () => {
    await (await obtenerDriver()).entrarConGoogle();
  },
};

/** Acceso: la portada de la familia (filósofo sentado) y, al tocar Iniciar sesión o Crear cuenta, la pantalla completa de la familia. */
export function Acceso() {
  const [vista, setVista] = useState<VistaAcceso | null>(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const hacer = async (f: () => Promise<unknown>) => {
    setError('');
    setOcupado(true);
    try {
      await f();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setOcupado(false);
    }
  };
  const comoInvitado = () => hacer(async () => (await obtenerDriver()).entrarComoInvitado());
  const conEjemplo = () => hacer(async () => (await obtenerDriver()).entrar('prueba@stoica.app', 'stoica'));

  if (vista) {
    return (
      <PantallaAcceso emblema={<EmblemaStoaHabit size={72} />} nombre="StoaHabit" alVolver={() => setVista(null)}>
        <FormularioAcceso vista={vista} alCambiarVista={setVista} mensajeError={mensajeDeError} acciones={accionesAcceso} />
      </PantallaAcceso>
    );
  }

  return (
    <PortadaAcceso
      imagen={portada}
      emblema={<Emblema figura={FIGURAS.check} size={92} />}
      nombre="StoaHabit"
      lema="Hábitos · Disciplina · Serenidad"
      frase="Cumplí tus prácticas de cada día y construí, paso a paso, una vida más serena."
      aviso={<AvisoMudanza />}
    >
      <button type="button" className="btn" onClick={() => setVista('ingresar')}>
        <Icono n="corona" size={20} />
        Iniciar sesión
      </button>
      <button type="button" className="btn-sec" onClick={() => setVista('registrar')}>
        Crear cuenta
      </button>
      <button type="button" className="portada-invitado" onClick={comoInvitado} disabled={ocupado}>
        Continuar como invitado
      </button>
      {error && (
        <div className="err" role="alert">
          {error}
        </div>
      )}
      <DescargarApp apk="/descargas/stoica.apk" />
      {!esNativo() && <BotonInstalar estilo="discreto" />}
      {esModoPrueba() && (
        <div className="franja info modo-prueba">
          <span>Modo prueba: nada se guarda en Firebase. Entrá con la cuenta de ejemplo (prueba@stoica.app · stoica) o creá una cuenta inventada.</span>
          <span className="acciones-prueba">
            <button type="button" className="btn" onClick={conEjemplo} disabled={ocupado}>
              Entrar con la cuenta de ejemplo
            </button>
          </span>
        </div>
      )}
    </PortadaAcceso>
  );
}
