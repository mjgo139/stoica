import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { haceCuanto, type Cuenta, type Metricas } from '@core/admin';
import { fechaCorta } from '@core/fechas';
import { useSesion } from '@/app/sesion';
import { uidActual } from '@/app/datos';
import { obtenerDriver } from '@/data';
import { useConsulta } from '@/data/hooks';
import { mensajeDeError, type ConId } from '@/data/tipos';
import { Confirmar } from '@/ui/Hoja';
import { useAvisos } from '@/ui/avisos';

type Filtro = 'todas' | 'activas7' | 'inactivas' | 'suspendidas';

/** Panel tipo CRM. Solo ve datos no privados: nunca hábitos, registros, exámenes ni mediciones. */
export function Admin() {
  const perfil = useSesion((s) => s.perfil);
  const zona = perfil?.zonaHoraria ?? 'America/Asuncion';
  const mostrar = useAvisos((s) => s.mostrar);
  const { datos: cuentas, error } = useConsulta<Cuenta>(perfil?.rol === 'admin' ? { ruta: 'accounts', orden: ['alta', 'desc'], limite: 500 } : null);
  const { datos: metricas } = useConsulta<Metricas>(perfil?.rol === 'admin' ? { ruta: 'metrics', orden: ['fecha', 'desc'], limite: 30 } : null);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [accion, setAccion] = useState<{ tipo: 'suspender' | 'reactivar' | 'borrar' | 'clave'; c: ConId<Cuenta> } | null>(null);
  const [calculando, setCalculando] = useState(false);
  const ahora = Date.now();

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return cuentas
      .filter((c) => !q || c.nombre.toLowerCase().includes(q) || c.correo.toLowerCase().includes(q))
      .filter((c) => {
        const dias = (ahora - (c.ultimoAcceso || c.alta)) / 864e5;
        if (filtro === 'activas7') return dias <= 7;
        if (filtro === 'inactivas') return dias > 30;
        if (filtro === 'suspendidas') return c.suspendida;
        return true;
      });
  }, [cuentas, busqueda, filtro, ahora]);

  if (perfil?.rol !== 'admin') return <Navigate to="/" replace />;
  const m = metricas[0];

  const calcular = async () => {
    setCalculando(true);
    try {
      await (await obtenerDriver()).llamar('adminCalcularMetricas');
      mostrar('Métricas actualizadas.');
    } catch (e) {
      mostrar(mensajeDeError(e));
    } finally {
      setCalculando(false);
    }
  };

  const ejecutar = async () => {
    if (!accion) return;
    const { tipo, c } = accion;
    setAccion(null);
    try {
      const d = await obtenerDriver();
      if (tipo === 'clave') {
        await d.recuperarContrasena(c.correo);
        mostrar(`Enviamos el correo para cambiar la contraseña a ${c.correo}.`);
      } else if (tipo === 'borrar') {
        await d.llamar('adminBorrarCuenta', { uid: c.id });
        mostrar('Cuenta borrada.');
      } else {
        await d.llamar('adminSuspender', { uid: c.id, suspender: tipo === 'suspender' });
        mostrar(tipo === 'suspender' ? 'Cuenta suspendida.' : 'Cuenta reactivada.');
      }
    } catch (e) {
      mostrar(mensajeDeError(e));
    }
  };

  const Tarjeta = ({ titulo, valor, detalle }: { titulo: string; valor: string | number; detalle?: string }) => (
    <div className="panel" style={{ padding: '16px 18px' }}>
      <div className="cap mu2" style={{ fontSize: 10.5 }}>
        {titulo}
      </div>
      <div className="num" style={{ fontSize: 30, marginTop: 4 }}>
        {valor}
      </div>
      {detalle && (
        <div className="mu2" style={{ fontSize: 12, fontWeight: 600 }}>
          {detalle}
        </div>
      )}
    </div>
  );

  const totalTipos = m ? m.porTipo.sino + m.porTipo.cantidad + m.porTipo.medicion : 0;

  return (
    <div className="entra">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="cap gold">Administración</div>
          <h1 className="titulo">Panel</h1>
          <p className="lead">Solo datos de cuentas y totales. Los hábitos, registros y exámenes de cada persona son privados.</p>
        </div>
        <button type="button" className="ghost" disabled={calculando} onClick={calcular}>
          {calculando ? 'Calculando…' : 'Recalcular métricas'}
        </button>
      </div>

      <div className="cap mu2" style={{ marginTop: 18, fontSize: 10.5 }}>
        {m ? `Métricas del ${fechaCorta(m.fecha)} · se calculan solas cada noche` : 'Todavía no hay métricas: tocá Recalcular.'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginTop: 10 }}>
        <Tarjeta titulo="Cuentas" valor={m?.total ?? cuentas.length} detalle={m ? `${m.suspendidas} suspendidas` : undefined} />
        <Tarjeta titulo="Activos hoy" valor={m?.activosHoy ?? '—'} />
        <Tarjeta titulo="Activos 7 días" valor={m?.activos7 ?? '—'} />
        <Tarjeta titulo="Activos 30 días" valor={m?.activos30 ?? '—'} />
        <Tarjeta titulo="Altas" valor={m?.altas7 ?? '—'} detalle={m ? `${m.altasHoy} hoy · ${m.altas30} en 30 días` : undefined} />
        <Tarjeta titulo="Retención 7 días" valor={m ? `${m.retencion7}%` : '—'} detalle="cuentas con +7 días que volvieron" />
      </div>

      <div className="cols" style={{ marginTop: 18 }}>
        <div className="panel">
          <div className="grp cap" style={{ marginTop: 0 }}>
            <span>Uso por tipo de hábito</span>
          </div>
          {m &&
            (
              [
                ['Sí / No', m.porTipo.sino],
                ['Cantidad', m.porTipo.cantidad],
                ['Medición', m.porTipo.medicion],
              ] as Array<[string, number]>
            ).map(([n, v]) => (
              <div key={n} style={{ padding: '8px 0' }}>
                <div style={{ display: 'flex', fontWeight: 600 }}>
                  <span style={{ flex: 1 }}>{n}</span>
                  <span className="num">{v}</span>
                </div>
                <div className="barra-prog" style={{ marginTop: 6 }}>
                  <i style={{ width: `${totalTipos ? (v / totalTipos) * 100 : 0}%`, background: 'var(--gold)' }} />
                </div>
              </div>
            ))}
        </div>
        <div className="panel">
          <div className="grp cap" style={{ marginTop: 0 }}>
            <span>Plataformas</span>
          </div>
          {m &&
            Object.entries(m.porPlataforma)
              .sort((a, b) => b[1] - a[1])
              .map(([p, n]) => (
                <div key={p} className="srow">
                  <span style={{ flex: 1, fontWeight: 600 }}>{p}</span>
                  <span className="num">{n}</span>
                </div>
              ))}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="grp cap" style={{ marginTop: 0, flex: 1, minWidth: 140 }}>
            <span>Cuentas · {lista.length}</span>
          </div>
          <input className="fi" style={{ maxWidth: 280 }} placeholder="Buscar por nombre o correo" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar cuentas" />
        </div>
        <div className="chips" style={{ marginTop: 10 }}>
          {(
            [
              ['todas', 'Todas'],
              ['activas7', 'Activas 7 días'],
              ['inactivas', 'Inactivas +30 días'],
              ['suspendidas', 'Suspendidas'],
            ] as Array<[Filtro, string]>
          ).map(([f, n]) => (
            <button key={f} type="button" aria-pressed={filtro === f} className={`chip ${filtro === f ? 'on' : ''}`} onClick={() => setFiltro(f)}>
              {n}
            </button>
          ))}
        </div>
        {error && <p className="err">{error}</p>}
        <div style={{ overflowX: 'auto', marginTop: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr className="cap mu2" style={{ fontSize: 10.5, textAlign: 'left' }}>
                <th style={{ padding: '8px 6px' }}>Nombre</th>
                <th style={{ padding: '8px 6px' }}>Correo</th>
                <th style={{ padding: '8px 6px' }}>Alta</th>
                <th style={{ padding: '8px 6px' }}>Último acceso</th>
                <th style={{ padding: '8px 6px' }}>Plataforma</th>
                <th style={{ padding: '8px 6px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} style={{ borderTop: '1px solid var(--ln2)', opacity: c.suspendida ? 0.6 : 1 }}>
                  <td style={{ padding: '10px 6px', fontWeight: 700 }}>
                    {c.nombre || '—'}
                    {c.rol === 'admin' && <span className="cap gold" style={{ fontSize: 9.5 }}> · admin</span>}
                    {c.suspendida && <span className="cap" style={{ fontSize: 9.5, color: 'var(--miss)' }}> · suspendida</span>}
                  </td>
                  <td style={{ padding: '10px 6px' }}>{c.correo}</td>
                  <td style={{ padding: '10px 6px', whiteSpace: 'nowrap' }}>{haceCuanto(c.alta, ahora, zona)}</td>
                  <td style={{ padding: '10px 6px', whiteSpace: 'nowrap' }}>{haceCuanto(c.ultimoAcceso, ahora, zona)}</td>
                  <td style={{ padding: '10px 6px', whiteSpace: 'nowrap' }}>{c.plataforma || '—'}</td>
                  <td style={{ padding: '6px', whiteSpace: 'nowrap' }}>
                    {c.id !== uidActual() && (
                      <>
                        <button type="button" className="link" style={{ minHeight: 36 }} onClick={() => setAccion({ tipo: 'clave', c })}>
                          Contraseña
                        </button>
                        <button type="button" className="link" style={{ minHeight: 36 }} onClick={() => setAccion({ tipo: c.suspendida ? 'reactivar' : 'suspender', c })}>
                          {c.suspendida ? 'Reactivar' : 'Suspender'}
                        </button>
                        <button type="button" className="link" style={{ minHeight: 36, color: 'var(--cor)' }} onClick={() => setAccion({ tipo: 'borrar', c })}>
                          Borrar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Confirmar
        abierto={!!accion}
        titulo={
          accion?.tipo === 'borrar' ? '¿Borrar esta cuenta?' : accion?.tipo === 'suspender' ? '¿Suspender esta cuenta?' : accion?.tipo === 'reactivar' ? '¿Reactivar esta cuenta?' : '¿Enviar cambio de contraseña?'
        }
        texto={
          accion?.tipo === 'borrar' ? (
            <>Se borra {accion.c.nombre} ({accion.c.correo}) con todos sus datos. No se puede deshacer.</>
          ) : accion?.tipo === 'suspender' ? (
            <>{accion.c.nombre} no va a poder entrar hasta que la reactives. Sus datos se conservan.</>
          ) : accion?.tipo === 'reactivar' ? (
            <>{accion.c.nombre} va a poder volver a entrar.</>
          ) : (
            <>Le llega a {accion?.c.correo} un enlace para crear una contraseña nueva.</>
          )
        }
        accion={accion?.tipo === 'borrar' ? 'Borrar' : accion?.tipo === 'suspender' ? 'Suspender' : accion?.tipo === 'reactivar' ? 'Reactivar' : 'Enviar'}
        peligro={accion?.tipo === 'borrar' || accion?.tipo === 'suspender'}
        alCerrar={() => setAccion(null)}
        alConfirmar={ejecutar}
      />
    </div>
  );
}
