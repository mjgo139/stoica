import { useEffect, useRef, type ReactNode } from 'react';

/** Hoja que sube desde abajo en el celular; diálogo centrado en escritorio. */
export function Hoja({ titulo, abierta, alCerrar, children }: { titulo: string; abierta: boolean; alCerrar: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierta) return;
    const previo = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar();
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('keydown', tecla);
      previo?.focus?.();
    };
  }, [abierta, alCerrar]);
  if (!abierta) return null;
  return (
    <div className="capa">
      <div className="fondo-capa" onClick={alCerrar} />
      <div className="hoja" role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1} ref={ref}>
        <div className="agarre" />
        <h2 className="serif" style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          {titulo}
        </h2>
        {children}
      </div>
    </div>
  );
}
