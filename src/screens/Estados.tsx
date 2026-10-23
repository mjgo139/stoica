import { Laurel } from '@/ui/Laurel';
import { Icono } from '@/ui/Iconos';

function Centro({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-contenido sin-nav" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div className="entra" style={{ maxWidth: 380 }}>
        {children}
      </div>
    </div>
  );
}

export function Cargando() {
  return (
    <Centro>
      <Laurel ancho={80} alto={73} />
      <div className="cap gold" style={{ marginTop: 14 }} role="status">
        Preparando tu día…
      </div>
    </Centro>
  );
}

export function SinConexion() {
  return (
    <Centro>
      <span className="ico ring" style={{ width: 64, height: 64 }}>
        <Icono nombre="nube" tam={28} />
      </span>
      <h1 className="serif" style={{ fontSize: 28, fontWeight: 700, margin: '16px 0 0' }}>
        Sin conexión
      </h1>
      <p className="mu" style={{ fontWeight: 500, marginTop: 8 }}>
        Para entrar por primera vez necesitás internet. Cuando ya entraste, Stoica funciona sin conexión.
      </p>
      <button type="button" className="ghost" style={{ marginTop: 18 }} onClick={() => location.reload()}>
        Reintentar
      </button>
    </Centro>
  );
}

export function PantallaError({ mensaje }: { mensaje: string }) {
  return (
    <Centro>
      <Laurel ancho={80} alto={73} />
      <h1 className="serif" style={{ fontSize: 26, fontWeight: 700, margin: '16px 0 0' }}>
        Algo no salió bien
      </h1>
      <p className="mu" style={{ fontWeight: 500, marginTop: 8 }}>
        {mensaje || 'No pudimos abrir Stoica.'}
      </p>
      <button type="button" className="btn" style={{ marginTop: 18 }} onClick={() => location.reload()}>
        Reintentar
      </button>
    </Centro>
  );
}
