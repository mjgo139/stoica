export function Interruptor({ etiqueta, detalle, activo, alCambiar }: { etiqueta: string; detalle?: string; activo: boolean; alCambiar: (v: boolean) => void }) {
  return (
    <button type="button" className="fila" role="switch" aria-checked={activo} onClick={() => alCambiar(!activo)}>
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block' }}>{etiqueta}</span>
        {detalle && (
          <span className="mu" style={{ display: 'block', fontSize: 13, fontWeight: 500, marginTop: 2 }}>
            {detalle}
          </span>
        )}
      </span>
      <span className={`sw ${activo ? 'on' : ''}`} />
    </button>
  );
}
