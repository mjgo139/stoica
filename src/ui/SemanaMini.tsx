import { DIAS_LETRA, diaSemanaDeClave, fechaLargaDeClave, sumarDias } from '@core/fechas';

/**
 * Últimos 7 días en rombos chicos: verde = cumplió, vacío = no, punteado = sin dato.
 * Con `conFoto` y `alTocar`, los días que tienen foto llevan un puntito y se pueden tocar para verla.
 */
export function SemanaMini({ dias, hoy, etiqueta, conFoto, alTocar }: { dias: Array<boolean | null>; hoy: string; etiqueta: string; conFoto?: Set<string>; alTocar?: (dia: string) => void }) {
  const hechos = dias.filter(Boolean).length;
  const tocable = !!alTocar && !!conFoto && conFoto.size > 0;
  return (
    <div className="semana-mini" role={tocable ? 'group' : 'img'} aria-label={`${etiqueta}: ${hechos} de 7 días cumplidos`}>
      {dias.map((d, i) => {
        const dia = sumarDias(hoy, i - 6);
        const clase = `${d === true ? 'ok' : d === null ? 'nd' : ''} ${i === 6 ? 'hoy' : ''}`;
        const contenido = (
          <>
            <i />
            <b>{DIAS_LETRA[diaSemanaDeClave(dia)]}</b>
          </>
        );
        if (tocable && conFoto!.has(dia)) {
          return (
            <button key={dia} type="button" className={`${clase} con-foto`} onClick={() => alTocar!(dia)} aria-label={`Ver la foto del ${i === 6 ? 'día de hoy' : fechaLargaDeClave(dia)}`}>
              {contenido}
            </button>
          );
        }
        return (
          <span key={dia} className={clase}>
            {contenido}
          </span>
        );
      })}
    </div>
  );
}
