import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { inicial } from '@core/perfil';
import { useSesion } from './sesion';
import { Laurel } from '@/ui/Laurel';
import { Icono, type NombreIcono } from '@/ui/Iconos';
import { useEnLinea } from '@/pwa/conexion';

const SECCIONES: Array<{ ruta: string; nombre: string; icono: NombreIcono }> = [
  { ruta: '/', nombre: 'Hoy', icono: 'hoy' },
  { ruta: '/habitos', nombre: 'Hábitos', icono: 'habitos' },
  { ruta: '/tareas', nombre: 'Tareas', icono: 'tareas' },
  { ruta: '/enfoque', nombre: 'Enfoque', icono: 'enfoque' },
  { ruta: '/examen', nombre: 'Examen', icono: 'examen' },
];

/** Estructura de la app: barra inferior en el celular, barra lateral oscura en escritorio. */
export function Shell() {
  const perfil = useSesion((s) => s.perfil)!;
  const enLinea = useEnLinea();
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <>
      <nav className="nav-tab" aria-label="Principal">
        <div className="marca">
          <Laurel ancho={34} alto={31} completo={false} grosor={3} />
          <span className="serif" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '.18em' }}>
            STOICA
          </span>
        </div>
        <div className="items">
          {SECCIONES.map((s) => (
            <NavLink key={s.ruta} to={s.ruta} end={s.ruta === '/'} className={({ isActive }) => (isActive ? 'on' : '')}>
              <Icono nombre={s.icono} tam={22} className="" />
              {s.nombre}
            </NavLink>
          ))}
        </div>
        <div className="yo">
          <NavLink to="/perfil" className={({ isActive }) => (isActive ? 'on' : '')}>
            <span className="avatar" style={{ width: 30, height: 30, fontSize: 14 }}>
              {inicial(perfil.nombre)}
            </span>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{perfil.nombre}</span>
          </NavLink>
        </div>
      </nav>
      <main className="app-contenido" key={pathname}>
        {!enLinea && (
          <div className="franja info" role="status" style={{ marginBottom: 18 }}>
            <Icono nombre="nube" tam={18} /> Sin conexión. Podés seguir usando Stoica: los cambios se envían cuando vuelva internet.
          </div>
        )}
        <Outlet />
      </main>
    </>
  );
}
