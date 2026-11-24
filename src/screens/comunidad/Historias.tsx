/**
 * Fotos del grupo como historias (v2.8.0, pedido del dueño, estilo Instagram):
 * pantalla completa, barritas de avance arriba, pasa sola cada 5 s, tocar a la derecha = siguiente,
 * a la izquierda = anterior, mantener apretado = pausa, deslizar hacia abajo o Escape = cerrar.
 * Las ya vistas se recuerdan en este teléfono (anillo gris en la tira de arriba).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { inicial } from '@core/perfil';
import { fotoCumplida, type FotoHabito } from '@core/plan';
import type { Miembro } from '@core/comunidad';
import type { ConId } from '@/data/tipos';
import { Icono } from '@/ui/Iconos';

const DURACION = 5000;
const CLAVE_VISTAS = 'stoica.historiasVistas';

export function leerVistas(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CLAVE_VISTAS) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function marcarVista(id: string) {
  try {
    const v = [...leerVistas()].filter((x) => x !== id);
    v.push(id);
    localStorage.setItem(CLAVE_VISTAS, JSON.stringify(v.slice(-300)));
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

/** Hora corta de la foto ("hace 5 min", "14:32"). */
function hace(ms: number): string {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function Historias({
  fotos,
  miembros,
  inicio,
  uid,
  alCerrar,
  alComentar,
}: {
  fotos: Array<ConId<FotoHabito>>;
  miembros: Array<ConId<Miembro>>;
  inicio: number;
  uid: string;
  alCerrar: () => void;
  alComentar: (f: ConId<FotoHabito>) => void;
}) {
  const [i, setI] = useState(inicio);
  const [avance, setAvance] = useState(0);
  const [pausa, setPausa] = useState(false);
  const [cargada, setCargada] = useState(false);
  const toque = useRef<{ t: number; x: number; y: number } | null>(null);
  const actual = fotos[i];

  const siguiente = useCallback(() => {
    setAvance(0);
    setCargada(false);
    if (i + 1 >= fotos.length) alCerrar();
    else setI(i + 1);
  }, [i, fotos.length, alCerrar]);
  const anterior = useCallback(() => {
    setAvance(0);
    if (i > 0) {
      setCargada(false);
      setI(i - 1);
    }
  }, [i]);

  useEffect(() => {
    if (actual) marcarVista(actual.id);
  }, [actual]);

  // Avance de la barrita (se frena con la pausa o mientras carga la foto)
  useEffect(() => {
    if (pausa || !cargada) return;
    let ultimo = performance.now();
    let id = 0;
    const paso = (t: number) => {
      setAvance((a) => {
        const n = a + (t - ultimo) / DURACION;
        ultimo = t;
        return n;
      });
      id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [pausa, cargada, i]);
  useEffect(() => {
    if (avance >= 1) siguiente();
  }, [avance, siguiente]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar();
      if (e.key === 'ArrowRight') siguiente();
      if (e.key === 'ArrowLeft') anterior();
    };
    window.addEventListener('keydown', tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', tecla);
      document.body.style.overflow = antes;
    };
  }, [alCerrar, siguiente, anterior]);

  if (!actual) return null;
  const m = miembros.find((x) => x.id === actual.de);
  const ok = fotoCumplida(actual, m);
  const esYo = actual.de === uid;

  return createPortal(
    <div className="historias" role="dialog" aria-modal="true" aria-label="Historias del grupo" data-historias>
      <div className="historias-caja">
        <div className="historias-barras" aria-hidden="true">
          {fotos.map((f, j) => (
            <span key={f.id}>
              <i style={{ width: `${j < i ? 100 : j > i ? 0 : Math.min(100, avance * 100)}%` }} />
            </span>
          ))}
        </div>
        <div className="historias-cabeza">
          <span className="historias-avatar">{inicial(actual.nombre)}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <b>{esYo ? 'Vos' : actual.nombre}</b> <span className="historias-hora">{hace(actual.actualizado)}</span>
            <span className="historias-habito">
              {ok ? '✓ ' : ''}
              {actual.habito}
            </span>
          </span>
          <button type="button" className="historias-cerrar" aria-label="Cerrar historias" onClick={alCerrar}>
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div
          className="historias-foto"
          onPointerDown={(e) => {
            toque.current = { t: Date.now(), x: e.clientX, y: e.clientY };
            setPausa(true);
          }}
          onPointerUp={(e) => {
            const t = toque.current;
            toque.current = null;
            setPausa(false);
            if (!t) return;
            if (e.clientY - t.y > 90) return alCerrar(); // deslizar hacia abajo
            if (Date.now() - t.t > 350) return; // mantener apretado = solo pausa
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            if (e.clientX - r.left < r.width * 0.33) anterior();
            else siguiente();
          }}
          onPointerCancel={() => {
            toque.current = null;
            setPausa(false);
          }}
        >
          <img src={actual.miniUrl} alt="" aria-hidden="true" className="historias-fondo" />
          <img key={actual.id} src={actual.fotoUrl} alt={actual.texto || `Foto de ${actual.habito}`} onLoad={() => setCargada(true)} onError={() => setCargada(true)} draggable={false} />
        </div>
        <div className="historias-pie">
          {actual.texto && <p className="historias-texto">{actual.texto}</p>}
          <button type="button" className="historias-comentar" onClick={() => alComentar(actual)}>
            <Icono nombre="comentario" tam={20} />
            {actual.comentarios ? `${actual.comentarios} ${actual.comentarios === 1 ? 'comentario' : 'comentarios'}` : 'Comentar'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
