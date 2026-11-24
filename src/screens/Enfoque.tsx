import { useEffect, useState } from 'react';
import { Grupo } from '../../familia/react';
import { fechaCorta } from '@core/fechas';
import { mmss, NOMBRE_ENFOQUE, restante, TIPOS_ENFOQUE, type TipoEnfoque } from '@core/rutina';
import { guardarSesionEnfoque, hoyActual, useDatos, useHoy } from '@/app/datos';
import { useAvisos } from '@/ui/avisos';
import { Link } from 'react-router-dom';
import { Icono } from '@/ui/Iconos';

const CLAVE = 'stoica.temporizador';
const OPCIONES: Record<TipoEnfoque, number[]> = { enfoque: [25, 50, 90], descanso: [5, 10, 15], meditacion: [5, 10, 20] };

interface Temporizador {
  tipo: TipoEnfoque;
  minutos: number;
  etiqueta: string;
  inicio: number; // ms
  pausadoEn: number | null;
  pausaAcumulada: number;
}

const leer = (): Temporizador | null => {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
  } catch {
    return null;
  }
};
const escribir = (t: Temporizador | null) => {
  try {
    if (t) localStorage.setItem(CLAVE, JSON.stringify(t));
    else localStorage.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento: el temporizador vive solo en esta pestaña */
  }
};

export function Enfoque() {
  const hoy = useHoy();
  const sesiones = useDatos((s) => s.enfoque);
  const mostrar = useAvisos((s) => s.mostrar);
  const [tipo, setTipo] = useState<TipoEnfoque>('enfoque');
  const [minutos, setMinutos] = useState(25);
  const [etiqueta, setEtiqueta] = useState('');
  const [t, setT] = useState<Temporizador | null>(leer);
  const [ahora, setAhora] = useState(Date.now());

  useEffect(() => {
    if (!t || t.pausadoEn) return;
    const i = setInterval(() => setAhora(Date.now()), 500);
    return () => clearInterval(i);
  }, [t]);

  const quedan = t ? restante(t.inicio, t.minutos, t.pausadoEn ?? ahora, t.pausaAcumulada) : minutos * 60;
  const total = (t?.minutos ?? minutos) * 60;

  useEffect(() => {
    if (!t || t.pausadoEn || quedan > 0) return;
    const fin = t;
    setT(null);
    escribir(null);
    guardarSesionEnfoque({ tipo: fin.tipo, minutos: fin.minutos, etiqueta: fin.etiqueta.slice(0, 60), fecha: hoyActual(), inicio: fin.inicio });
    mostrar(`${NOMBRE_ENFOQUE[fin.tipo]} terminado: ${fin.minutos} minutos.`);
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      /* nada */
    }
  }, [quedan, t, mostrar]);

  const iniciar = () => {
    const nuevo = { tipo, minutos, etiqueta, inicio: Date.now(), pausadoEn: null, pausaAcumulada: 0 };
    setT(nuevo);
    escribir(nuevo);
    setAhora(Date.now());
  };
  const pausar = () => {
    if (!t) return;
    const n = t.pausadoEn ? { ...t, pausaAcumulada: t.pausaAcumulada + (Date.now() - t.pausadoEn), pausadoEn: null } : { ...t, pausadoEn: Date.now() };
    setT(n);
    escribir(n);
    setAhora(Date.now());
  };
  const cancelar = () => {
    setT(null);
    escribir(null);
  };

  const deHoy = sesiones.filter((s) => s.fecha === hoy && s.tipo !== 'descanso');
  const minutosHoy = deHoy.reduce((a, s) => a + s.minutos, 0);
  const progreso = 1 - quedan / total;
  const R = 110;

  return (
    <div className="entra">
      <Link to="/tareas" className="link" style={{ paddingLeft: 0, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
        <Icono nombre="atras" tam={18} /> Tareas
      </Link>
      <div className="cap gold">Atención plena</div>
      <h1 className="titulo">Enfoque</h1>
      <p className="lead">Una cosa por vez, con toda la atención.</p>

      <div className="cols c64" style={{ marginTop: 24 }}>
        <div className="panel" style={{ textAlign: 'center' }}>
          {!t && (
            <>
              <div className="seg3" role="radiogroup" aria-label="Tipo de sesión">
                {TIPOS_ENFOQUE.map((x) => (
                  <button key={x} type="button" role="radio" aria-checked={tipo === x} className={tipo === x ? 'on' : ''} onClick={() => (setTipo(x), setMinutos(OPCIONES[x][0]))}>
                    {NOMBRE_ENFOQUE[x]}
                  </button>
                ))}
              </div>
              <div className="chips" style={{ justifyContent: 'center', marginTop: 14 }}>
                {OPCIONES[tipo].map((m) => (
                  <button key={m} type="button" aria-pressed={minutos === m} className={`chip ${minutos === m ? 'on' : ''}`} onClick={() => setMinutos(m)}>
                    {m} min
                  </button>
                ))}
              </div>
            </>
          )}
          <div style={{ position: 'relative', width: 260, height: 260, margin: '20px auto 0' }}>
            <svg width="260" height="260" viewBox="0 0 260 260" aria-hidden="true">
              <g className="ticks">
                {Array.from({ length: 60 }, (_, i) => {
                  const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
                  const largo = i % 5 === 0 ? 10 : 5;
                  return <line key={i} x1={130 + Math.cos(a) * R} y1={130 + Math.sin(a) * R} x2={130 + Math.cos(a) * (R - largo)} y2={130 + Math.sin(a) * (R - largo)} className={i / 60 < progreso ? 'lit' : ''} strokeWidth={i % 5 === 0 ? 2 : 1.2} />;
                })}
              </g>
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div className="num" style={{ fontSize: 48 }} role="timer" aria-live="off">
                {mmss(quedan)}
              </div>
              <div className="cap gold" style={{ marginTop: 4 }}>
                {t ? (t.pausadoEn ? 'En pausa' : NOMBRE_ENFOQUE[t.tipo]) : NOMBRE_ENFOQUE[tipo]}
              </div>
              {t?.etiqueta && (
                <div className="mu dos-lineas" style={{ fontWeight: 600, marginTop: 4, maxWidth: 220, marginInline: 'auto' }}>
                  {t.etiqueta}
                </div>
              )}
            </div>
          </div>
          {!t ? (
            <>
              <input className="fi" style={{ maxWidth: 320, margin: '18px auto 0', display: 'block', textAlign: 'center' }} maxLength={60} placeholder="¿En qué te vas a enfocar? (opcional)" value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} aria-label="Etiqueta" />
              <button type="button" className="btn" style={{ maxWidth: 320, marginTop: 14 }} onClick={iniciar}>
                Comenzar
              </button>
            </>
          ) : (
            <div className="g2" style={{ maxWidth: 360, margin: '18px auto 0' }}>
              <button type="button" className="ghost" onClick={cancelar}>
                Cancelar
              </button>
              <button type="button" className="btn" style={{ height: 44 }} onClick={pausar}>
                {t.pausadoEn ? 'Seguir' : 'Pausar'}
              </button>
            </div>
          )}
        </div>

        <div className="panel">
          <Grupo n={1} className="sep-grupo sin-arriba">Hoy</Grupo>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span className="num" style={{ fontSize: 40 }}>
              {minutosHoy}
            </span>
            <span className="mu" style={{ fontWeight: 600 }}>
              minutos de atención en {deHoy.length} {deHoy.length === 1 ? 'sesión' : 'sesiones'}
            </span>
          </div>
          <Grupo n={2} className="sep-grupo">Últimas sesiones</Grupo>
          {sesiones.length === 0 && <p className="vacio-mini">Tus sesiones terminadas aparecen acá.</p>}
          {sesiones.slice(0, 10).map((s) => (
            <div key={s.id} className="srow">
              <span className="cap gold" style={{ fontSize: 11, width: 92 }}>
                {NOMBRE_ENFOQUE[s.tipo]}
              </span>
              <span className="dos-lineas" style={{ flex: 1, fontWeight: 600, minWidth: 0 }}>{s.etiqueta || '—'}</span>
              <span className="mu" style={{ fontWeight: 600, fontSize: 13.5 }}>
                {s.minutos} min · {fechaCorta(s.fecha)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
