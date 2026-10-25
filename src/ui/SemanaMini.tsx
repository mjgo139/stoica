import { DIAS_LETRA, diaSemanaDeClave, sumarDias } from '@core/fechas';

/** Últimos 7 días en rombos chicos: verde = cumplió, vacío = no, punteado = sin dato. */
export function SemanaMini({ dias, hoy, etiqueta }: { dias: Array<boolean | null>; hoy: string; etiqueta: string }) {
  const hechos = dias.filter(Boolean).length;
  return (
    <div className="semana-mini" role="img" aria-label={`${etiqueta}: ${hechos} de 7 días cumplidos`}>
      {dias.map((d, i) => {
        const dia = sumarDias(hoy, i - 6);
        return (
          <span key={dia} className={`${d === true ? 'ok' : d === null ? 'nd' : ''} ${i === 6 ? 'hoy' : ''}`}>
            <i />
            <b>{DIAS_LETRA[diaSemanaDeClave(dia)]}</b>
          </span>
        );
      })}
    </div>
  );
}
