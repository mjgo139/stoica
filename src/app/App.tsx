import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useSesion } from './sesion';
import { Shell } from './Shell';
import { Acceso } from '@/screens/Acceso';
import { Hoy } from '@/screens/Hoy';
import { Perfil } from '@/screens/Perfil';
import { Habitos, Tareas, Enfoque, Examen } from '@/screens/Proximamente';
import { Cargando, PantallaError, SinConexion } from '@/screens/Estados';
import { useEnLinea } from '@/pwa/conexion';

export function App() {
  const estado = useSesion((s) => s.estado);
  const error = useSesion((s) => s.error);
  const enLinea = useEnLinea();
  const sinNav = estado !== 'dentro';

  useEffect(() => {
    document.body.classList.toggle('sin-nav', sinNav);
  }, [sinNav]);

  if (estado === 'error') return <PantallaError mensaje={error} />;
  if (estado === 'cargando') return enLinea ? <Cargando /> : <SinConexion />;
  if (estado === 'fuera')
    return (
      <div className="app-contenido sin-nav">{enLinea ? <Acceso /> : <SinConexion />}</div>
    );

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Hoy />} />
        <Route path="habitos" element={<Habitos />} />
        <Route path="tareas" element={<Tareas />} />
        <Route path="enfoque" element={<Enfoque />} />
        <Route path="examen" element={<Examen />} />
        <Route path="perfil" element={<Perfil />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
