import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useSesion } from './sesion';
import { Shell } from './Shell';
import { Acceso } from '@/screens/Acceso';
import { Hoy } from '@/screens/Hoy';
import { Perfil } from '@/screens/Perfil';
import { ListaHabitos } from '@/screens/habitos/Lista';
import { Detalle } from '@/screens/habitos/Detalle';
import { Editor } from '@/screens/habitos/Editor';
import { Tareas } from '@/screens/Tareas';
import { Proyecto } from '@/screens/Proyecto';
import { Enfoque } from '@/screens/Enfoque';
import { Examen } from '@/screens/Examen';
import { MementoMori } from '@/screens/MementoMori';
import { Comunidad, Unirse } from '@/screens/comunidad/Comunidad';
import { Grupo } from '@/screens/comunidad/Grupo';
import { Desafio } from '@/screens/comunidad/Desafio';
import { Admin } from '@/screens/Admin';
// El Espejo trae el motor 3D: se carga solo al entrar.
const Jardin = lazy(() => import('@/screens/jardin/Jardin').then((m) => ({ default: m.Jardin })));
const Espejo = lazy(() => import('@/screens/espejo/Espejo').then((m) => ({ default: m.Espejo })));
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
        <Route path="habitos" element={<ListaHabitos />} />
        <Route path="habitos/nuevo" element={<Editor />} />
        <Route path="habitos/:id" element={<Detalle />} />
        <Route path="habitos/:id/editar" element={<Editor />} />
        <Route path="comunidad" element={<Comunidad />} />
        <Route path="comunidad/:id" element={<Grupo />} />
        <Route path="comunidad/:id/desafio/:cid" element={<Desafio />} />
        <Route path="unirse/:codigo" element={<Unirse />} />
        <Route path="admin" element={<Admin />} />
        <Route path="tareas" element={<Tareas />} />
        <Route path="tareas/proyecto/:id" element={<Proyecto />} />
        <Route path="tareas/enfoque" element={<Enfoque />} />
        <Route path="enfoque" element={<Navigate to="/tareas/enfoque" replace />} />
        <Route path="memento" element={<MementoMori />} />
        <Route path="examen" element={<Examen />} />
        <Route
          path="espejo"
          element={
            <Suspense fallback={<Cargando />}>
              <Espejo />
            </Suspense>
          }
        />
        <Route
          path="jardin"
          element={
            <Suspense fallback={<Cargando />}>
              <Jardin />
            </Suspense>
          }
        />
        <Route path="perfil" element={<Perfil />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
