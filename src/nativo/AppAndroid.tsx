import { useEffect, useState } from 'react';
import { esAndroid } from '@/pwa/instalar';
import { abrirAfuera, esNativo, versionApk } from './nativo';

/** /android-version.json lo genera GitHub al compilar la APK: número, nombre y dónde bajarla. */
interface VersionPublicada {
  codigo: number;
  nombre: string;
  url: string;
}

const RUTA_APK = '/descargas/stoica.apk';

async function leerPublicada(): Promise<VersionPublicada | null> {
  try {
    const r = await fetch('/android-version.json', { cache: 'no-store' });
    if (!r.ok) return null;
    const v = (await r.json()) as VersionPublicada;
    return typeof v.codigo === 'number' ? { ...v, url: new URL(v.url || RUTA_APK, location.origin).href } : null;
  } catch {
    return null;
  }
}

/** En la APK: ¿hay una APK más nueva publicada? (una lectura de un archivo chico al abrir, sin Firebase) */
export function useApkNueva() {
  const [estado, setEstado] = useState<{ instalada: { codigo: number; nombre: string } | null; publicada: VersionPublicada | null }>({ instalada: null, publicada: null });
  useEffect(() => {
    if (!esNativo() && !esAndroid()) return;
    let vivo = true;
    void Promise.all([versionApk(), leerPublicada()]).then(([instalada, publicada]) => vivo && setEstado({ instalada, publicada }));
    return () => {
      vivo = false;
    };
  }, []);
  const hayNueva = !!estado.instalada && !!estado.publicada && estado.publicada.codigo > estado.instalada.codigo;
  return { ...estado, hayNueva };
}

/** Cartel arriba de todo cuando hay una APK nueva (solo dentro de la APK). */
export function AvisoApkNueva() {
  const { hayNueva, publicada } = useApkNueva();
  const [cerrado, setCerrado] = useState(false);
  if (!hayNueva || cerrado || !publicada) return null;
  return (
    <div className="aviso-apk" role="status">
      <span style={{ flex: 1 }}>Hay una versión nueva de la app ({publicada.nombre}).</span>
      <button type="button" className="link" onClick={() => abrirAfuera(publicada.url)}>
        Descargar
      </button>
      <button type="button" className="link" aria-label="Cerrar" onClick={() => setCerrado(true)}>
        ×
      </button>
    </div>
  );
}

/** En Perfil: versión de la APK, o el enlace para bajarla si estás en Android desde el navegador. */
export function AppAndroid() {
  const { instalada, publicada, hayNueva } = useApkNueva();
  if (esNativo()) {
    return (
      <div className="fila" style={{ cursor: 'default' }} data-app-android>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block' }}>App de Android (prueba)</span>
          <span className="mu" style={{ display: 'block', fontSize: 13.5, fontWeight: 500, marginTop: 2 }}>
            Versión {instalada?.nombre ?? '…'}
            {hayNueva ? ` · hay una nueva (${publicada?.nombre})` : ' · al día'}
          </span>
        </span>
        {hayNueva && publicada && (
          <button type="button" className="ghost" onClick={() => abrirAfuera(publicada.url)}>
            Actualizar
          </button>
        )}
      </div>
    );
  }
  if (!esAndroid() || !publicada) return null;
  return (
    <a className="fila" href={publicada.url} download data-app-android style={{ textDecoration: 'none', color: 'inherit' }}>
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block' }}>Bajar la app de Android (prueba)</span>
        <span className="mu" style={{ display: 'block', fontSize: 13.5, fontWeight: 500, marginTop: 2 }}>
          Avisos con sonido y ventana sin configurar nada. Versión {publicada.nombre}.
        </span>
      </span>
      <span className="gold" aria-hidden="true">
        ›
      </span>
    </a>
  );
}
