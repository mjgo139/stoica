import { useEffect, useRef, type ReactNode } from 'react';

/** Hoja que sube desde abajo en el celular; diálogo centrado en escritorio. */
export function Hoja({ titulo, abierta, alCerrar, children }: { titulo: string; abierta: boolean; alCerrar: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const cerrar = useRef(alCerrar);
  cerrar.current = alCerrar;

  useEffect(() => {
    if (!abierta) return;
    const previo = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && cerrar.current();
    document.addEventListener('keydown', tecla);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = '';
      previo?.focus?.();
    };
  }, [abierta]);

  if (!abierta) return null;
  return (
    <div className="capa">
      <div className="fondo-capa" onClick={() => cerrar.current()} />
      <div className="hoja" role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1} ref={ref}>
        <div className="agarre" />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <h2 className="serif" style={{ fontSize: 24, fontWeight: 700, margin: 0, flex: 1 }}>
            {titulo}
          </h2>
          <button type="button" className="ico" aria-label="Cerrar" onClick={() => cerrar.current()} style={{ marginTop: -8, marginRight: -10 }}>
            <svg className="uic" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 7l10 10M17 7L7 17" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Diálogo de confirmación centrado (borrar, salir, etc.). */
export function Confirmar({ abierto, titulo, texto, accion, peligro = false, alConfirmar, alCerrar }: { abierto: boolean; titulo: string; texto: ReactNode; accion: string; peligro?: boolean; alConfirmar: () => void; alCerrar: () => void }) {
  const cerrar = useRef(alCerrar);
  cerrar.current = alCerrar;
  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && cerrar.current();
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [abierto]);
  if (!abierto) return null;
  return (
    <div className="capa centro">
      <div className="fondo-capa" onClick={() => cerrar.current()} />
      <div className="dialogo" role="alertdialog" aria-modal="true" aria-label={titulo}>
        <h2 className="serif" style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          {titulo}
        </h2>
        <div className="mu" style={{ fontWeight: 500, marginTop: 10 }}>
          {texto}
        </div>
        <div className="g2" style={{ marginTop: 22 }}>
          <button type="button" className="ghost" onClick={() => cerrar.current()}>
            Cancelar
          </button>
          <button type="button" className={peligro ? 'ghost peligro' : 'btn'} style={peligro ? { background: 'var(--missbg)' } : { height: 44 }} onClick={alConfirmar}>
            {accion}
          </button>
        </div>
      </div>
    </div>
  );
}
