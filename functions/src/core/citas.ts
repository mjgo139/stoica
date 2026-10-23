export interface Cita {
  texto: string;
  autor: 'Epicteto' | 'Marco Aurelio' | 'Séneca';
}

/** Citas de respaldo. En la v0.4 se leen de catalog/quotes (las edita el admin). */
export const CITAS: Cita[] = [
  { texto: 'No controlas lo que sucede, pero sí cómo respondes.', autor: 'Epicteto' },
  { texto: 'Tienes poder sobre tu mente, no sobre los acontecimientos.', autor: 'Marco Aurelio' },
  { texto: 'Sufrimos más a menudo en la imaginación que en la realidad.', autor: 'Séneca' },
  { texto: 'La felicidad de tu vida depende de la calidad de tus pensamientos.', autor: 'Marco Aurelio' },
  { texto: 'No es pobre el que tiene poco, sino el que mucho desea.', autor: 'Séneca' },
  { texto: 'Primero di qué quieres ser; luego haz lo que debas hacer.', autor: 'Epicteto' },
  { texto: 'Mientras aplazamos, la vida pasa.', autor: 'Séneca' },
  { texto: 'La mejor venganza es no ser como tu enemigo.', autor: 'Marco Aurelio' },
  { texto: 'Ningún gran logro surge de repente.', autor: 'Epicteto' },
];

/** Una cita fija por día: el mismo día muestra la misma cita en todos los dispositivos. */
export function citaDelDia(clave: string, lista: Cita[] = CITAS): Cita {
  let h = 0;
  for (const ch of clave) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return lista[h % lista.length];
}
