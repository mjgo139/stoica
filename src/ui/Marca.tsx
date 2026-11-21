import { Emblema } from '../../familia/react';
import { FIGURAS } from '../../familia/figuras';

/** Emblema de StoaHabit: el laurel de la familia con el check al centro */
export const EmblemaStoaHabit = ({ size = 34 }: { size?: number }) => <Emblema size={size} figura={FIGURAS.check} />;

/** Emblema + "StoaHabit" en Cinzel (barra lateral, portada) */
export function Marca({ grande = false }: { grande?: boolean }) {
  return (
    <span className="marca-app" data-grande={grande || undefined}>
      <EmblemaStoaHabit size={grande ? 92 : 34} />
      <span className="marca oro">StoaHabit</span>
    </span>
  );
}
