import { useResumenEscritorio } from './escritorio';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, type MouseEvent } from 'react';
import { AvisoPrueba, Avatar, BarraLateral, Pestanas, type Seccion } from '../../familia/react';
import { primerNombre } from '@core/perfil';
import { useSesion } from './sesion';
import { Icono } from '@/ui/Iconos';
import { EmblemaStoaHabit } from '@/ui/Marca';
import { AvisoMudanza } from '@/ui/AvisoMudanza';
import { useEnLinea } from '@/pwa/conexion';
import { esModoPrueba } from '@/data';
import { Sincronizar } from './datos';
import { SincronizarComunidad } from './comunidad';
import { Celebracion } from '@/screens/habitos/Celebracion';
import { AvisoApkNueva } from '@/nativo/AppAndroid';
import { prepararNativo } from '@/nativo/nativo';
import { useWidgetHoy } from '@/nativo/widget';
import { useAvisos } from '@/ui/avisos';

/** Secciones de StoaHabit (íconos de la familia). En el celular van las 6 primeras como pestañas. */
const SECCIONES = [
  { href: '/', icono: 'hoy', texto: 'Hoy' },
  { href: '/habitos', icono: 'check', texto: 'Hábitos' },
  { href: '/tareas', icono: 'nota', texto: 'Tareas' },
  { href: '/examen', icono: 'luna', texto: 'Examen' },
  { href: '/memento', icono: 'calavera', texto: 'Memento' },
  { href: '/comunidad', icono: 'clientes', texto: 'Comunidad' },
];
const ADMIN = [
  { href: '/admin', icono: 'barras', texto: 'Admin' },
  { href: '/espejo', icono: 'cuerpo', texto: 'El Espejo' },
];
const JARDIN = { href: '/jardin', icono: 'brote', texto: 'Jardín' };

const activa = (href: string, ruta: string) => (href === '/' ? ruta === '/' : ruta === href || ruta.startsWith(href + '/') || (href === '/comunidad' && ruta.startsWith('/unirse')));

/** Estructura de la app (familia estoica): pestañas abajo en el celular y barra lateral en la PC. */
export function Shell() {
  const perfil = useSesion((s) => s.perfil)!;
  const usuario = useSesion((s) => s.usuario);
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
  useResumenEscritorio();

  const ir = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    navegar(href);
  };
  const marcar = (s: { href: string; icono: string; texto: string }): Seccion => ({ ...s, activa: activa(s.href, pathname) });
  const lateral = [...SECCIONES, ...(perfil.rol === 'admin' ? ADMIN : []), JARDIN].map(marcar);
  const prueba = esModoPrueba();

  return (
    <div className="con-lateral">
      <BarraLateral
        emblema={<EmblemaStoaHabit size={40} />}
        nombreApp="StoaHabit"
        secciones={lateral}
        ir={ir}
        persona={{ avatar: <Avatar foto={perfil.foto} nombre={perfil.nombre} />, nombre: primerNombre(perfil.nombre) || perfil.nombre, detalle: usuario?.proveedor === 'invitado' ? 'Modo invitado' : usuario?.correo || perfil.correo, href: '/perfil' }}
        nota={prueba ? 'Modo prueba' : 'Hábitos · Disciplina · Serenidad'}
      />
      <Sincronizar />
      <SincronizarComunidad />
      <Celebracion />
      <main className="app-contenido" key={pathname}>
        <AvisoMudanza />
        {prueba && <AvisoPrueba />}
        <AvisoApkNueva />
        {!enLinea && (
          <div className="franja info" role="status" style={{ marginBottom: 18 }}>
            <Icono nombre="nube" tam={16} /> Sin conexión. Podés seguir usando StoaHabit: los cambios se envían cuando vuelva internet.
          </div>
        )}
        <div className="pagina">
          <Outlet />
        </div>
      </main>
      <Pestanas secciones={SECCIONES.map(marcar)} ir={ir} />
    </div>
  );
}
