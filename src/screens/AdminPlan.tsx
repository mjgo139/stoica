import { useState } from 'react';
import { MESES_PLAN, textoMeses, type CodigoPlan } from '@core/plan';
import { useDiasGracia } from '@/app/plan';
import { obtenerDriver } from '@/data';
import { useConsulta } from '@/data/hooks';
import { mensajeDeError, type ConId } from '@/data/tipos';
import { useAvisos } from '@/ui/avisos';

interface Reporte {
  ruta: string;
  grupoNombre: string;
  autor: string;
  tipo: 'texto' | 'foto';
  texto: string;
  miniUrl: string | null;
  fotoUrl: string | null;
  motivo: string;
  creado: number;
}

const fecha = (ms: number) => new Date(ms).toLocaleDateString('es-PY', { day: 'numeric', month: 'short', year: 'numeric' });

/** Admin: códigos del plan de fotos y chat, días de espera antes del borrado y reportes. */
export function AdminPlan() {
  const mostrar = useAvisos((s) => s.mostrar);
  const { datos: codigos } = useConsulta<CodigoPlan>({ ruta: 'codigos', orden: ['creado', 'desc'], limite: 100 });
  const { datos: reportes } = useConsulta<Reporte>({ ruta: 'reportes', orden: ['creado', 'desc'], limite: 50 });
  const graciaActual = useDiasGracia();
  const [meses, setMeses] = useState<number>(1);
  const [cantidad, setCantidad] = useState('1');
  const [nota, setNota] = useState('');
  const [nuevos, setNuevos] = useState<string[]>([]);
  const [gracia, setGracia] = useState<string | null>(null);
  const [verUsados, setVerUsados] = useState(false);

  const llamar = async <T,>(nombre: Parameters<Awaited<ReturnType<typeof obtenerDriver>>['llamar']>[0], datos: Record<string, unknown>) => {
    try {
      return await (await obtenerDriver()).llamar<T>(nombre, datos);
    } catch (e) {
      mostrar(mensajeDeError(e));
      return null;
    }
  };

  const generar = async () => {
    const r = await llamar<{ codigos: string[] }>('adminCrearCodigos', { meses, cantidad: Number(cantidad), nota });
    if (r) {
      setNuevos(r.codigos);
      setNota('');
    }
  };
  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      mostrar('Copiado.');
    } catch {
      mostrar(texto);
    }
  };
  const guardarGracia = async () => {
    const n = Math.round(Number(gracia));
    if (!(n >= 0 && n <= 60)) return mostrar('Elegí entre 0 y 60 días.');
    try {
      await (await obtenerDriver()).guardar('config/plan', { diasGracia: n });
      setGracia(null);
      mostrar(`Listo: ${n} días de espera antes del borrado.`);
    } catch (e) {
      mostrar(mensajeDeError(e));
    }
  };

  const sinUsar = codigos.filter((c) => !c.usado);
  const usados = codigos.filter((c) => c.usado);
  const fila = (c: ConId<CodigoPlan>) => (
    <tr key={c.id}>
      <td className="num" style={{ letterSpacing: '.06em' }}>{c.id}</td>
      <td>{textoMeses(c.meses)}</td>
      <td>{c.usado ? `${c.grupoNombre ?? 'Grupo'} · ${c.usadoEn ? fecha(c.usadoEn) : ''}` : c.nota || '—'}</td>
      <td style={{ textAlign: 'right' }}>
        {!c.usado && (
          <button type="button" className="link" style={{ minHeight: 36 }} onClick={() => copiar(c.id)}>
            Copiar
          </button>
        )}
      </td>
    </tr>
  );

  return (
    <div className="cols" style={{ marginTop: 18 }} data-admin="plan">
      <div className="panel">
        <div className="grp cap" style={{ marginTop: 0 }}>
          <span>Códigos de fotos y chat</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ flex: '1 1 120px' }}>
            <span className="fl">Duración</span>
            <select className="fi" value={meses} onChange={(e) => setMeses(Number(e.target.value))} aria-label="Duración del código">
              {MESES_PLAN.map((m) => (
                <option key={m} value={m}>
                  {textoMeses(m)}
                </option>
              ))}
            </select>
          </label>
          <label style={{ flex: '0 1 90px' }}>
            <span className="fl">Cantidad</span>
            <input className="fi" inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value.replace(/\D/g, '').slice(0, 2))} aria-label="Cantidad de códigos" />
          </label>
          <label style={{ flex: '2 1 180px' }}>
            <span className="fl">Nota (para vos)</span>
            <input className="fi" maxLength={60} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: pagó por transferencia" aria-label="Nota del código" />
          </label>
        </div>
        <button type="button" className="btn" style={{ marginTop: 12, height: 44 }} onClick={generar}>
          Generar código
        </button>
        {nuevos.length > 0 && (
          <div className="franja info" style={{ display: 'block', marginTop: 12 }}>
            <div style={{ marginBottom: 6 }}>Códigos nuevos (mandalos a quien pagó):</div>
            {nuevos.map((c) => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="num" data-codigo-nuevo style={{ flex: 1, letterSpacing: '.08em' }}>
                  {c}
                </span>
                <button type="button" className="link" onClick={() => copiar(c)}>
                  Copiar
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="grp cap">
          <span>Sin usar ({sinUsar.length})</span>
        </div>
        {sinUsar.length === 0 ? <p className="vacio-mini">No hay códigos disponibles.</p> : <table className="tabla"><tbody>{sinUsar.map(fila)}</tbody></table>}
        {usados.length > 0 && (
          <>
            <button type="button" className="link" style={{ paddingLeft: 0, marginTop: 8 }} onClick={() => setVerUsados(!verUsados)}>
              {verUsados ? 'Ocultar usados' : `Ver usados (${usados.length})`}
            </button>
            {verUsados && <table className="tabla"><tbody>{usados.map(fila)}</tbody></table>}
          </>
        )}
      </div>

      <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
        <div className="panel">
          <div className="grp cap" style={{ marginTop: 0 }}>
            <span>Al vencer el plan</span>
          </div>
          <p className="mu" style={{ fontSize: 13.5, fontWeight: 500, margin: 0 }}>
            Días en que las fotos y el chat se pueden ver (sin agregar nada) antes de borrarse definitivamente. A los integrantes se les avisa al vencer y el día anterior al borrado.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
            <input className="fi" inputMode="numeric" style={{ width: 90 }} aria-label="Días de espera" value={gracia ?? String(graciaActual)} onChange={(e) => setGracia(e.target.value.replace(/\D/g, '').slice(0, 2))} />
            <span className="mu" style={{ fontWeight: 600 }}>días</span>
            {gracia !== null && Number(gracia) !== graciaActual && (
              <button type="button" className="btn" style={{ width: 'auto', padding: '0 18px', height: 44 }} onClick={guardarGracia}>
                Guardar
              </button>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="grp cap" style={{ marginTop: 0 }}>
            <span>Reportes ({reportes.length})</span>
          </div>
          {reportes.length === 0 && <p className="vacio-mini">Nadie reportó nada.</p>}
          {reportes.map((r) => (
            <div key={r.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--ln2)' }}>
              {r.miniUrl && <img src={r.miniUrl} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                  {r.autor} · {r.grupoNombre}
                </div>
                <div style={{ fontSize: 14, overflowWrap: 'anywhere' }}>{r.texto || (r.tipo === 'foto' ? 'Foto sin comentario' : '')}</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button type="button" className="link" style={{ paddingLeft: 0, color: 'var(--cor)' }} onClick={() => llamar('adminResolverReporte', { reporteId: r.id, borrar: true }).then((x) => x && mostrar('Publicación borrada.'))}>
                    Borrar publicación
                  </button>
                  <button type="button" className="link" onClick={() => llamar('adminResolverReporte', { reporteId: r.id, borrar: false }).then((x) => x && mostrar('Reporte descartado.'))}>
                    Descartar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
