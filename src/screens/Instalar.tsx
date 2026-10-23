import { useState } from 'react';
import { useInstalar } from '@/pwa/instalar';
import { Hoja } from '@/ui/Hoja';
import { Icono } from '@/ui/Iconos';
import { useAvisos } from '@/ui/avisos';

const PASOS_IPHONE = [
  <>Abrí Stoica en <strong>Safari</strong>.</>,
  <>Tocá el botón <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba).</>,
  <>Elegí <strong>Agregar a pantalla de inicio</strong>.</>,
  <>Tocá <strong>Agregar</strong>. El ícono del laurel aparece en tu inicio.</>,
];

export function BotonInstalar({ estilo = 'normal' }: { estilo?: 'normal' | 'discreto' | 'fila' }) {
  const { puedeInstalar, instalar } = useInstalar();
  const mostrar = useAvisos((s) => s.mostrar);
  const [pasos, setPasos] = useState(false);
  if (!puedeInstalar) return null;

  const tocar = async () => {
    const r = await instalar();
    if (r === 'pasos') setPasos(true);
    else if (r === 'aceptada') mostrar('Listo: Stoica quedó instalada.');
  };

  return (
    <>
      {estilo === 'fila' ? (
        <button type="button" className="fila" onClick={tocar}>
          <Icono nombre="instalar" />
          <span style={{ flex: 1 }}>Instalar la app</span>
        </button>
      ) : (
        <button type="button" className="ghost" onClick={tocar} style={{ width: '100%', marginTop: 12, borderColor: estilo === 'discreto' ? 'transparent' : undefined }}>
          <Icono nombre="instalar" tam={16} /> Instalar la app
        </button>
      )}
      <Hoja titulo="Instalar en iPhone" abierta={pasos} alCerrar={() => setPasos(false)}>
        <ol style={{ margin: '18px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 14 }}>
          {PASOS_IPHONE.map((p, i) => (
            <li key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', fontWeight: 500 }}>
              <span className="num gold" style={{ fontSize: 20, width: 20 }}>
                {i + 1}
              </span>
              <span>{p}</span>
            </li>
          ))}
        </ol>
        <button type="button" className="btn" style={{ marginTop: 24 }} onClick={() => setPasos(false)}>
          Entendido
        </button>
      </Hoja>
    </>
  );
}
