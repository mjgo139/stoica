import { useState, type FormEvent } from 'react';
import { estadoPlan, type EstadoPlan } from '@core/plan';
import type { Grupo } from '@core/comunidad';
import { canjearCodigo, useDiasGracia } from '@/app/plan';
import { Hoja } from '@/ui/Hoja';
import { useAvisos } from '@/ui/avisos';

export const fechaPlan = (ms: number) => new Date(ms).toLocaleDateString('es-PY', { day: 'numeric', month: 'long', year: 'numeric' });

/** Estado del plan de un grupo (con los días de espera que definió el admin). */
export function usePlan(grupo: Pick<Grupo, 'premiumHasta'> | undefined): EstadoPlan {
  const gracia = useDiasGracia();
  return estadoPlan(grupo?.premiumHasta, Date.now(), gracia);
}

/** Hoja para pegar el código de habilitación. Cualquier integrante puede hacerlo. */
export function HojaCodigo({ grupoId, abierta, alCerrar }: { grupoId: string; abierta: boolean; alCerrar: () => void }) {
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const mostrar = useAvisos((s) => s.mostrar);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError('');
    const r = await canjearCodigo(grupoId, codigo);
    setEnviando(false);
    if ('error' in r) return setError(r.error);
    setCodigo('');
    alCerrar();
    mostrar(`Listo: fotos y chat activos hasta el ${fechaPlan(r.hasta)}.`);
  };
  return (
    <Hoja titulo="Activar fotos y chat" abierta={abierta} alCerrar={alCerrar}>
      <form onSubmit={enviar} noValidate>
        <p className="mu" style={{ fontWeight: 500, marginTop: 8 }}>
          Con el plan, cada desafío del grupo tiene fotos del día y un chat corto. Lo activa cualquier integrante y vale para todo el grupo. Si ya está activo, el código suma tiempo.
        </p>
        <label className="lbl cap" htmlFor="codigo-plan">
          Código de habilitación
        </label>
        <input id="codigo-plan" className="inp" autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="STOA-XXXX-XXXX" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} />
        <div className="err" role="alert">
          {error}
        </div>
        <button className="btn" type="submit" style={{ marginTop: 8 }} disabled={enviando || codigo.replace(/[^A-Z0-9]/g, '').length < 8}>
          {enviando ? 'Activando…' : 'Activar'}
        </button>
      </form>
    </Hoja>
  );
}

/** Panel del grupo: estado del plan y botón para activarlo o renovarlo. */
export function PanelPlan({ grupoId, plan }: { grupoId: string; plan: EstadoPlan }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <div className="panel" data-plan={plan.estado}>
      <div className="grp cap" style={{ marginTop: 0 }}>
        <span>Fotos y chat</span>
      </div>
      {plan.estado === 'activo' && (
        <p className="mu" style={{ fontSize: 13.5, fontWeight: 500, margin: 0 }}>
          Activo hasta el <b>{fechaPlan(plan.hasta)}</b>
          {plan.diasRestantes <= 7 && ` (quedan ${plan.diasRestantes} ${plan.diasRestantes === 1 ? 'día' : 'días'})`}. Cada uno sube la foto de hoy desde su hábito y escriben en el chat del grupo.
        </p>
      )}
      {plan.estado === 'gracia' && <AvisoBorrado plan={plan} />}
      {(plan.estado === 'sin' || plan.estado === 'borrado') && (
        <p className="mu" style={{ fontSize: 13.5, fontWeight: 500, margin: 0 }}>
          Sumá la foto de hoy en cada hábito compartido (cumplido o no) y un chat del grupo. Se activa con un código para todo el grupo.
        </p>
      )}
      <button type="button" className={plan.estado === 'activo' ? 'ghost' : 'btn'} style={{ marginTop: 12, ...(plan.estado === 'activo' ? {} : { height: 44 }) }} onClick={() => setAbierta(true)}>
        {plan.estado === 'sin' || plan.estado === 'borrado' ? 'Activar con un código' : 'Renovar con un código'}
      </button>
      <HojaCodigo grupoId={grupoId} abierta={abierta} alCerrar={() => setAbierta(false)} />
    </div>
  );
}

export function AvisoBorrado({ plan }: { plan: Extract<EstadoPlan, { estado: 'gracia' }> }) {
  return (
    <div className="franja" role="status" style={{ display: 'block', fontWeight: 600 }}>
      El plan venció el {fechaPlan(plan.hasta)}. Las fotos y el chat se pueden ver, pero se borran definitivamente el <b>{fechaPlan(plan.borraEn)}</b>
      {plan.diasParaBorrar <= 1 ? ' (mañana)' : ` (en ${plan.diasParaBorrar} días)`}. Renovalo con un código para conservarlos.
    </div>
  );
}
