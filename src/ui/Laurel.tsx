/** El laurel de Stoica (mismo dibujo que la versión anterior). */
export function Laurel({ ancho = 96, alto = 88, completo = true, grosor = 1.6, className }: { ancho?: number; alto?: number; completo?: boolean; grosor?: number; className?: string }) {
  return (
    <svg width={ancho} height={alto} viewBox="0 0 132 120" aria-hidden="true" className={`laurel ${className ?? ''}`}>
      <g fill="none" stroke="var(--gold)" strokeWidth={grosor} strokeLinecap="round">
        <path d="M58 108C26 98 12 66 20 24" />
        <path d="M74 108c32-10 46-42 38-84" />
      </g>
      <g fill="var(--gold)">
        <ellipse cx="13" cy="34" rx="4" ry="9.5" transform="rotate(-25 13 34)" />
        <ellipse cx="12" cy="54" rx="4" ry="9.5" transform="rotate(-50 12 54)" />
        <ellipse cx="17" cy="73" rx="4" ry="9.5" transform="rotate(-65 17 73)" />
        <ellipse cx="28" cy="89" rx="4" ry="9.5" transform="rotate(-80 28 89)" />
        <ellipse cx="119" cy="34" rx="4" ry="9.5" transform="rotate(25 119 34)" />
        <ellipse cx="120" cy="54" rx="4" ry="9.5" transform="rotate(50 120 54)" />
        <ellipse cx="115" cy="73" rx="4" ry="9.5" transform="rotate(65 115 73)" />
        <ellipse cx="104" cy="89" rx="4" ry="9.5" transform="rotate(80 104 89)" />
        {completo && (
          <>
            <ellipse cx="29" cy="42" rx="3.5" ry="8" transform="rotate(25 29 42)" />
            <ellipse cx="31" cy="62" rx="3.5" ry="8" transform="rotate(10 31 62)" />
            <ellipse cx="103" cy="42" rx="3.5" ry="8" transform="rotate(-25 103 42)" />
            <ellipse cx="101" cy="62" rx="3.5" ry="8" transform="rotate(-10 101 62)" />
          </>
        )}
      </g>
    </svg>
  );
}
