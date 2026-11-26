/**
 * Perfil → "Widget para Windows" (v2.9.0): activa el resumen para el escritorio y baja el paquete de Rainmeter
 * (StoaHabit.rmskin) con el código secreto adentro. "Cambiar el enlace" invalida el anterior; "Desactivar" lo borra.
 */
import { useState } from 'react';
import { obtenerDriver } from '@/data';
import { mensajeDeError } from '@/data/tipos';
import { useSesion } from '@/app/sesion';
import { useAvisos } from '@/ui/avisos';
import { armarTextoEscritorio, horaCorta, nuevoCodigoEscritorio, paqueteEscritorio, subirResumenEscritorio } from '@/app/escritorio';
import { registrosDe, useDatos, useHoy, VENTANA_DIAS } from '@/app/datos';
import { esNativo } from '@/nativo/nativo';
import { Hoja } from '@/ui/Hoja';

const PROYECTO = (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) || 'stoica-app';

function bajar(b: Blob, nombre: string) {
  const url = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function WidgetEscritorio() {
  const uid = useSesion((s) => s.usuario?.uid);
  const perfil = useSesion((s) => s.perfil);
  const mostrar = useAvisos((s) => s.mostrar);
  const habitos = useDatos((s) => s.habitos);
  const registros = useDatos((s) => s.registros);
  const hoy = useHoy();
  const [abierta, setAbierta] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  if (esNativo() || !uid || !perfil) return null;
  const codigo = perfil.escritorio ?? null;

  /** Crea (o cambia) el código, sube el resumen de hoy y baja el paquete. */
  const activar = async (nuevo: boolean) => {
    setOcupado(true);
    try {
      const d = await obtenerDriver();
      let c = codigo;
      if (!c || nuevo) {
        const anterior = c;
        c = nuevoCodigoEscritorio();
        const texto = armarTextoEscritorio(
          { nombre: perfil.nombre.split(' ')[0] ?? '', hoy, habitos, registros: (id) => registrosDe(registros, id), ventana: VENTANA_DIAS },
          horaCorta(),
        );
        await subirResumenEscritorio(c, uid, texto, true);
        await d.actualizarPerfil(uid, { escritorio: c });
        if (anterior) await d.borrar(`escritorio/${anterior}`).catch(() => undefined);
      }
      bajar(await paqueteEscritorio(PROYECTO, c), 'StoaHabit.rmskin');
      mostrar(nuevo ? 'Enlace nuevo: el widget anterior dejó de andar. Instalá el que se bajó.' : 'Se bajó StoaHabit.rmskin. Abrilo con doble clic.');
    } catch (e) {
      mostrar(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };

  const desactivar = async () => {
    if (!codigo) return;
    setOcupado(true);
    try {
      const d = await obtenerDriver();
      await d.borrar(`escritorio/${codigo}`);
      await d.actualizarPerfil(uid, { escritorio: null });
      mostrar('Widget de escritorio desactivado.');
      setAbierta(false);
    } catch (e) {
      mostrar(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <>
      <button type="button" className="fila" onClick={() => setAbierta(true)} data-widget-escritorio>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block' }}>Widget para Windows</span>
          <span className="mu" style={{ display: 'block', fontSize: 13.5, fontWeight: 500, marginTop: 2 }}>
            {codigo ? 'Activado · tus hábitos de hoy en el escritorio' : 'Tus hábitos de hoy y tu racha en el escritorio'}
          </span>
        </span>
        <span className="gold" aria-hidden="true">
          ›
        </span>
      </button>
      <Hoja titulo="Widget para Windows" abierta={abierta} alCerrar={() => setAbierta(false)}>
        <ol className="pasos-escritorio">
          <li>
            Instalá <b>Rainmeter</b> (gratis) desde{' '}
            <a href="https://www.rainmeter.net" target="_blank" rel="noreferrer" className="gold">
              rainmeter.net
            </a>
            .
          </li>
          <li>Tocá el botón de abajo: se baja StoaHabit.rmskin.</li>
          <li>Abrilo con doble clic y tocá <b>Install</b>. El widget aparece en tu escritorio; arrastralo a donde quieras.</li>
          <li>Clic derecho en la tarjeta: <b>Siguiente hábito</b> o <b>Agregar otra tarjeta</b> (una por hábito, con las últimas 5 semanas).</li>
        </ol>
        <p className="mu" style={{ fontSize: 13.5, fontWeight: 500 }}>
          Se actualiza cada 15 minutos con lo que marcás en la app (en el celular o en la PC). Muestra solo los nombres de tus hábitos de hoy y tu racha.
        </p>
        <button type="button" className="btn" style={{ width: '100%', marginTop: 14 }} onClick={() => activar(false)} disabled={ocupado}>
          {codigo ? 'Descargar de nuevo' : 'Activar y descargar'}
        </button>
        {codigo && (
          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn-borde" onClick={() => activar(true)} disabled={ocupado}>
              Cambiar el enlace
            </button>
            <button type="button" className="btn-borde peligro-txt" onClick={desactivar} disabled={ocupado}>
              Desactivar
            </button>
          </div>
        )}
      </Hoja>
    </>
  );
}
