import { create } from 'zustand';

interface Avisos {
  texto: string;
  mostrar: (t: string) => void;
}

let temporizador: ReturnType<typeof setTimeout> | undefined;

export const useAvisos = create<Avisos>((set) => ({
  texto: '',
  mostrar: (texto) => {
    clearTimeout(temporizador);
    set({ texto });
    temporizador = setTimeout(() => set({ texto: '' }), 2800);
  },
}));

export function Aviso() {
  const texto = useAvisos((s) => s.texto);
  if (!texto) return null;
  return (
    <div className="aviso" role="status" aria-live="polite">
      {texto}
    </div>
  );
}
