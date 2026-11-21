import { useSesion } from '@/app/sesion';

/**
 * Elegir una o varias horas a cualquier minuto (07:40, 13:05…). Usa el selector de hora del sistema.
 * `max` = cuántas horas se pueden poner.
 */
export function Horas({ valores, alCambiar, max = 3, etiqueta, idBase }: { valores: string[]; alCambiar: (v: string[]) => void; max?: number; etiqueta: string; idBase: string }) {
  const notificaciones = useSesion((s) => s.perfil?.notificaciones);
  const poner = (i: number, v: string) => alCambiar(valores.map((x, j) => (j === i ? v : x)));
  return (
    <div>
      {valores.map((v, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: i ? 8 : 0 }}>
          <input id={`${idBase}-${i}`} type="time" className="fi" style={{ flex: 1, maxWidth: 200 }} value={v} aria-label={`${etiqueta} ${i + 1}`} onChange={(e) => poner(i, e.target.value)} />
          <button type="button" className="link" style={{ color: 'var(--serie-2)' }} aria-label={`Quitar ${etiqueta.toLowerCase()} ${i + 1}`} onClick={() => alCambiar(valores.filter((_, j) => j !== i))}>
            Quitar
          </button>
        </div>
      ))}
      {valores.length < max && (
        <button type="button" className="ghost" style={{ marginTop: valores.length ? 10 : 0 }} onClick={() => alCambiar([...valores, valores.length ? '' : '08:00'])}>
          + {valores.length ? 'Otra hora' : 'Agregar aviso'}
        </button>
      )}
      {valores.length > 0 && !notificaciones && (
        <p className="mu" style={{ fontSize: 13.5, fontWeight: 500, marginTop: 6 }}>
          Para que te llegue, activá las notificaciones en Perfil.
        </p>
      )}
    </div>
  );
}
