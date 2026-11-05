import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { inicial } from '@core/perfil';
import { useSesion } from './sesion';
import { Laurel } from '@/ui/Laurel';
import { Icono, type NombreIcono } from '@/ui/Iconos';
import { useEnLinea } from '@/pwa/conexion';
import { Sincronizar } from './datos';
import { SincronizarComunidad } from './comunidad';
import { Celebracion } from '@/screens/habitos/Celebracion';
import { AvisoApkNueva } from '@/nativo/AppAndroid';
import { prepararNativo } from '@/nativo/nativo';
import { useWidgetHoy } from '@/nativo/widget';
import { useAvisos } from '@/ui/avisos';

const SECCIONES: Array<{ ruta: string; nombre: string; icono: NombreIcono }> = [
  { ruta: '/', nombre: 'Hoy', icono: 'hoy' },
  { ruta: '/habitos', nombre: 'Hábitos', icono: 'habitos' },
  { ruta: '/tareas', nombre: 'Tareas', icono: 'tareas' },

  { ruta: '/examen', nombre: 'Examen', icono: 'examen' },
  { ruta: '/memento', nombre: 'Memento', icono: 'craneo' },
];

/** Estructura de la app: barra inferior en el celular, barra lateral oscura en escritorio. */
export function Shell() {
  const perfil = useSesion((s) => s.perfil)!;
  const enLinea = useEnLinea();
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  // Dentro de la APK: canales de aviso, toques en los avisos y botón atrás de Android.
  const navegar = useNavigate();
  const mostrar = useAvisos((s) => s.mostrar);
  useEffect(() => {
    void prepararNativo((url) => navegar(url), mostrar);
  }, [navegar, mostrar]);
  useWidgetHoy();

  return (
    <>
      <nav className="nav-tab" aria-label="Principal">
        <div className="marca">
          <Laurel ancho={34} alto={31} completo={false} grosor={3} />
          <span className="serif" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '.18em' }}>
            STOICA
          </span>
        </div>
        <div className="items" style={{ ['--tabs' as string]: SECCIONES.length + 1 }}>
          {SECCIONES.map((s) => (
            <NavLink key={s.ruta} to={s.ruta} end={s.ruta === '/'} className={({ isActive }) => (isActive ? 'on' : '')}>
              <Icono nombre={s.icono} tam={22} className="" />
              <span className="et">{s.nombre}</span>
            </NavLink>
          ))}
          {/* En el celular, Comunidad va en la barra inferior; en escritorio, en su propia sección. */}
          <NavLink to="/comunidad" className={({ isActive }) => `solo-cel ${isActive || pathname.startsWith('/unirse') ? 'on' : ''}`}>
            <Icono nombre="grupo" tam={22} className="" />
            <span className="et">Comunidad</span>
          </NavLink>
        </div>
        <div className="items solo-esc" style={{ marginTop: 18, borderTop: '1px solid var(--ln)', paddingTop: 14 }}>
          <NavLink to="/comunidad" className={({ isActive }) => (isActive ? 'on' : '')}>
            <Icono nombre="grupo" tam={22} className="" />
            Comunidad
          </NavLink>
          {perfil.rol === 'admin' && (
            <NavLink to="/admin" className={({ isActive }) => (isActive ? 'on' : '')}>
              <Icono nombre="panel" tam={22} className="" />
              Admin
            </NavLink>
          )}
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
      <Sincronizar />
      <SincronizarComunidad />
      <Celebracion />
      <main className="app-contenido" key={pathname}>
        <AvisoApkNueva />
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
