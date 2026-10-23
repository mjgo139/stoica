import { create } from 'zustand';
import type { Perfil } from '@core/perfil';
import type { UsuarioSesion } from '@/data/tipos';

export type EstadoSesion = 'cargando' | 'fuera' | 'dentro' | 'error';

interface Sesion {
  estado: EstadoSesion;
  usuario: UsuarioSesion | null;
  perfil: Perfil | null;
  error: string;
  poner: (p: Partial<Omit<Sesion, 'poner'>>) => void;
}

export const useSesion = create<Sesion>((set) => ({
  estado: 'cargando',
  usuario: null,
  perfil: null,
  error: '',
  poner: (p) => set(p),
}));
