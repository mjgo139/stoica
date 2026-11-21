import { useEffect, useMemo, useState } from 'react';
import { Grupo } from '../../../familia/react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DIAS_LETRA, fechaCorta, fechaLargaDeClave, MESES_NOMBRE, MOMENTOS, partesDeClave, sumarDias } from '@core/fechas';
import {
  conSigno,
  cumplido,
  estadoDia,
  formatoNumero,
  itemsHechos,
  porcentajeItems,
  mejorRacha,
  NOMBRE_TIPO,
  NOMBRE_VIRTUD,
  porcentaje,
  proyectar,
  racha,
  serieDeVariable,
  type Habito,
  type Punto,
  type Registro,
  type Variable,
} from '@core/habitos';
import { aRomano } from '@core/romanos';
import { alternarItemLista, alternarSiNo, archivarHabito, borrarHabito, guardarNota, sumar, uidActual, useDatos, useHoy } from '@/app/datos';
import { useConsulta } from '@/data/hooks';
import { IconoHabito, Trazo } from '@/ui/IconoHabito';
import { Icono } from '@/ui/Iconos';
import { Confirmar } from '@/ui/Hoja';
import { HojaMedir } from './HojaMedir';
import { esMetaGrande, HojaCantidad } from './HojaCantidad';

export function Detalle() {
  const { id } = useParams();
  const navegar = useNavigate();
  const hoy = useHoy();
  const h = useDatos((s) => s.habitos.find((x) => x.id === id));
  const listo = useDatos((s) => s.listo);
  const recientes = useDatos((s) => (id ? s.registros.get(id) : undefined));
  const uid = uidActual();
  // Historial completo de este hábito (para calendario y gráficos más allá de la ventana reciente).
  const { datos: historial } = useConsulta<Registro>(id && uid ? { ruta: `users/${uid}/logs`, filtros: [['habitId', '==', id]] } : null);
  const { datos: hitos } = useConsulta<{ habitId: string; dias: number; fecha: string }>(id && uid ? { ruta: `users/${uid}/milestones`, filtros: [['habitId', '==', id]] } : null);
  const regs = useMemo(() => {
    const m = new Map<string, Registro>(historial.map((r) => [r.fecha, r]));
    for (const [f, r] of recientes ?? []) m.set(f, r); // lo optimista/local gana
    return m;
  }, [historial, recientes]);
  const [borrando, setBorrando] = useState(false);

  if (!h) return listo ? <NoExiste /> : null;
  const rHoy = regs.get(hoy);
  // Secciones numeradas: primero los paneles del hábito (ítems o variables), después la nota y los hitos
  const nNota = (h.tipo === 'lista' ? 1 : h.tipo === 'medicion' ? h.variables.length : 0) + 1;
  const ok = cumplido(h, rHoy);
  const r = racha(h, regs, hoy, 2000);
  const mejor = mejorRacha(h, regs, hoy, 2000);
  const p30 = porcentaje(h, regs, sumarDias(hoy, -29), hoy);
  const total = [...regs.values()].filter((x) => cumplido(h, x)).length;

  return (
    <div className="entra">
      <button type="button" className="link" style={{ paddingLeft: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => navegar(-1)}>
        <Icono nombre="atras" tam={18} /> Volver
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
        <IconoHabito icono={h.icono} virtud={h.virtud} tam={56} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className={`cap v-${h.virtud} vt`}>
            {NOMBRE_VIRTUD[h.virtud]} · {NOMBRE_TIPO[h.tipo]} · {MOMENTOS[h.momento].split(' · ')[1]}
          </div>
          <h1 className="titulo" style={{ marginTop: 4 }}>
            {h.nombre}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to={`/habitos/${h.id}/editar`} className="ghost" style={{ textDecoration: 'none' }}>
            Editar
          </Link>
          <button type="button" className="ghost" onClick={() => archivarHabito(h, !h.archivado)}>
            {h.archivado ? 'Restaurar' : 'Archivar'}
          </button>
          <button type="button" className="ghost peligro" onClick={() => setBorrando(true)}>
            Borrar
          </button>
        </div>
      </div>

      <div className="cols c64" style={{ marginTop: 24 }}>
        <div>
          <CajaHoy h={h} r={rHoy} ok={ok} hoy={hoy} />
          <div className="stats">
            <div>
              <div className="cap mu2" style={{ fontSize: 11 }}>
                Racha actual
              </div>
              <div className="v num gold">{aRomano(r)}</div>
              <div className="r">
                {r} {r === 1 ? 'día' : 'días'}
              </div>
            </div>
            <div>
              <div className="cap mu2" style={{ fontSize: 11 }}>
                Mejor racha
              </div>
              <div className="v num">{aRomano(mejor)}</div>
              <div className="r">
                {mejor} {mejor === 1 ? 'día' : 'días'}
              </div>
            </div>
            <div>
              <div className="cap mu2" style={{ fontSize: 11 }}>
                Últimos 30 días
              </div>
              <div className="v num">{p30}%</div>
              <div className="r">de los días activos</div>
            </div>
            <div>
              <div className="cap mu2" style={{ fontSize: 11 }}>
                Total cumplido
              </div>
              <div className="v num">{total}</div>
              <div className="r">desde {fechaCorta(h.inicio)}</div>
            </div>
          </div>
          {h.tipo === 'lista' && <PanelItems n={1} h={h} regs={regs} hoy={hoy} />}
          {h.tipo === 'medicion' && h.variables.map((v, i) => <PanelVariable key={v.id} n={i + 1} v={v} serie={serieDeVariable(v.id, [...regs.values()])} hoy={hoy} />)}
          <Nota n={nNota} h={h} r={rHoy} hoy={hoy} />
        </div>
        <div>
          <Calendario h={h} regs={regs} hoy={hoy} />
          <Grupo n={nNota + 1} className="sep-grupo">Hitos · Victoria sobre ti mismo</Grupo>
          {hitos.length === 0 ? (
            <p className="vacio-mini">El primer hito llega a los 3 días seguidos.</p>
          ) : (
            [...hitos]
              .sort((a, b) => b.dias - a.dias)
              .map((x) => (
                <div key={x.id} className="srow">
                  <span className="num gold" style={{ fontSize: 20, width: 64 }}>
                    {aRomano(x.dias)}
                  </span>
                  <span style={{ flex: 1, fontWeight: 600 }}>{x.dias} días seguidos</span>
                  <span className="mu2" style={{ fontSize: 13.5, fontWeight: 600 }}>
                    {fechaCorta(x.fecha)}
                  </span>
                </div>
              ))
          )}
        </div>
      </div>

      <Confirmar
        abierto={borrando}
        titulo="¿Borrar este hábito?"
        texto={<>Se borra {h.nombre} con todo su historial. No se puede deshacer. Si solo querés pausarlo, archivalo.</>}
        accion="Borrar"
        peligro
        alCerrar={() => setBorrando(false)}
        alConfirmar={async () => {
          setBorrando(false);
          await borrarHabito(h);
          navegar('/habitos', { replace: true });
        }}
      />
    </div>
  );
}

function NoExiste() {
  return (
    <div className="card vacio">
      <div className="serif" style={{ fontSize: 20 }}>
        Este hábito ya no existe
      </div>
      <p>Puede que lo hayas borrado desde otro dispositivo.</p>
      <Link to="/habitos" className="ghost" style={{ textDecoration: 'none' }}>
        Ver mis hábitos
      </Link>
    </div>
  );
}

function CajaHoy({ h, r, ok, hoy }: { h: Habito; r: Registro | undefined; ok: boolean; hoy: string }) {
  const [midiendo, setMidiendo] = useState(false);
  const [rebote, setRebote] = useState(0);
  const valor = r?.valor ?? 0;
  return (
    <div className={`card caja-hoy ${ok ? 'ok' : ''}`}>
      <div className="cap gold" style={{ fontSize: 11 }}>
        Hoy · {fechaLargaDeClave(hoy)}
      </div>
      {h.tipo === 'sino' && (
        <>
          <button type="button" key={rebote} className={`bigplus ${rebote ? 'rebote' : ''}`} style={{ marginTop: 18 }} aria-pressed={ok} aria-label={ok ? 'Desmarcar hoy' : 'Marcar hoy como cumplido'} onClick={() => (setRebote((n) => n + 1), alternarSiNo(h, hoy))}>
            <Trazo d="check" tam={34} />
          </button>
          <div className="serif" style={{ fontSize: 20, marginTop: 16 }}>
            {ok ? 'Cumplido' : 'Tocá para marcar'}
          </div>
        </>
      )}
      {h.tipo === 'cantidad' && esMetaGrande(h) && (
        <>
          <div className="num" style={{ fontSize: 36, marginTop: 18 }}>
            {formatoNumero(valor)}
            <span className="mu2" style={{ fontSize: 20 }}>
              {' '}
              / {formatoNumero(h.meta)}
            </span>
          </div>
          <div className="mu" style={{ fontWeight: 600 }}>
            {h.unidad || 'unidades'} · {ok ? '¡meta cumplida!' : `faltan ${formatoNumero(h.meta - valor)}`}
          </div>
          <button type="button" className="btn" style={{ marginTop: 14, maxWidth: 300 }} onClick={() => setMidiendo(true)}>
            Registrar {h.unidad || 'cantidad'}
          </button>
          <HojaCantidad h={h} fecha={hoy} abierta={midiendo} alCerrar={() => setMidiendo(false)} />
        </>
      )}
      {h.tipo === 'cantidad' && !esMetaGrande(h) && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, marginTop: 18 }}>
            <button type="button" className="bigmenos" disabled={valor <= 0} aria-label="Restar uno" onClick={() => sumar(h, hoy, -1)}>
              <Trazo d="menos" tam={22} />
            </button>
            <button type="button" key={rebote} className={`bigplus ${rebote ? 'rebote' : ''}`} aria-label="Sumar uno" onClick={() => (setRebote((n) => n + 1), sumar(h, hoy, 1))}>
              {ok ? <Trazo d="check" tam={34} /> : <Trazo d="mas" tam={34} />}
            </button>
            <span style={{ width: 52 }} />
          </div>
          <div className="num" style={{ fontSize: 36, marginTop: 14 }}>
            {valor}
            <span className="mu2" style={{ fontSize: 20 }}>
              {' '}
              / {h.meta}
            </span>
          </div>
          <div className="mu" style={{ fontWeight: 600 }}>
            {h.unidad || 'unidades'} · {ok ? '¡meta cumplida!' : `faltan ${h.meta - valor}`}
          </div>
        </>
      )}
      {h.tipo === 'lista' && (
        <>
          <div className="lista-items" role="group" aria-label={`Ítems de ${h.nombre}`} style={{ justifyContent: 'center', padding: 0, marginTop: 18 }}>
            {h.variables.map((v) => {
              const si = itemsHechos(h, r).includes(v.id);
              return (
                <button key={v.id} type="button" className={`chip-item grande ${si ? 'ok' : ''}`} aria-pressed={si} onClick={() => alternarItemLista(h, hoy, v.id)}>
                  <i aria-hidden="true">
                    <svg width="10" height="10" viewBox="0 0 24 24">
                      <path d="M5 12l4 4 10-10" />
                    </svg>
                  </i>
                  {v.nombre}
                </button>
              );
            })}
          </div>
          <div className="num" style={{ fontSize: 36, marginTop: 14 }}>
            {valor}
            <span className="mu2" style={{ fontSize: 20 }}>
              {' '}
              / {h.variables.length}
            </span>
          </div>
          <div className="mu" style={{ fontWeight: 600 }}>
            {ok ? '¡día cumplido!' : `faltan ${Math.max(0, h.meta - valor)} para cumplir`}
            {h.meta < h.variables.length ? ` · alcanza con ${h.meta}` : ''}
          </div>
        </>
      )}
      {h.tipo === 'medicion' && (
        <>
          <div className="serif" style={{ fontSize: 20, marginTop: 14 }}>
            {ok ? 'Medición de hoy registrada' : 'Todavía no mediste hoy'}
          </div>
          {ok && (
            <div className="mu" style={{ fontWeight: 600, marginTop: 6 }}>
              {h.variables
                .filter((v) => r?.medidas[v.id] !== undefined)
                .map((v) => `${v.nombre}: ${formatoNumero(r!.medidas[v.id])} ${v.unidad}`)
                .join(' · ')}
            </div>
          )}
          <button type="button" className="btn" style={{ marginTop: 16, maxWidth: 300 }} onClick={() => setMidiendo(true)}>
            {ok ? 'Corregir medición' : 'Registrar medición'}
          </button>
          <HojaMedir h={h} fecha={hoy} abierta={midiendo} alCerrar={() => setMidiendo(false)} />
        </>
      )}
    </div>
  );
}

function Calendario({ h, regs, hoy }: { h: Habito; regs: Map<string, Registro>; hoy: string }) {
  const [desfase, setDesfase] = useState(0);
  const { anio, mes } = partesDeClave(hoy);
  const fecha = new Date(Date.UTC(anio, mes - 1 + desfase, 1));
  const a = fecha.getUTCFullYear();
  const m = fecha.getUTCMonth();
  const primero = `${a}-${String(m + 1).padStart(2, '0')}-01`;
  const diasMes = new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
  const blancos = (new Date(Date.UTC(a, m, 1)).getUTCDay() + 6) % 7; // semana empieza el lunes
  const celdas = Array.from({ length: diasMes }, (_, i) => sumarDias(primero, i));
  return (
    <div className="panel">
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button type="button" className="ico" aria-label="Mes anterior" onClick={() => setDesfase((d) => d - 1)}>
          <Icono nombre="atras" />
        </button>
        <div className="serif" style={{ flex: 1, textAlign: 'center', fontSize: 20 }}>
          {MESES_NOMBRE[m].charAt(0).toUpperCase() + MESES_NOMBRE[m].slice(1)} {a}
        </div>
        <button type="button" className="ico" aria-label="Mes siguiente" disabled={desfase >= 0} onClick={() => setDesfase((d) => d + 1)} style={{ transform: 'scaleX(-1)' }}>
          <Icono nombre="atras" />
        </button>
      </div>
      <div className="calh" role="grid" aria-label="Calendario del mes">
        {[1, 2, 3, 4, 5, 6, 0].map((d, i) => (
          <span key={i} className="cap">
            {DIAS_LETRA[d]}
          </span>
        ))}
        {Array.from({ length: blancos }, (_, i) => (
          <span key={`b${i}`} />
        ))}
        {celdas.map((d) => {
          const e = estadoDia(h, regs, d, hoy);
          return (
            <span key={d} className={`celda ${e} ${d === hoy ? 'hoy' : ''}`} aria-label={`${fechaLargaDeClave(d)}: ${e === 'ok' ? 'cumplido' : e === 'mal' ? 'no cumplido' : e === 'pendiente' ? 'pendiente' : e === 'inactivo' ? 'sin práctica' : 'futuro'}`}>
              {partesDeClave(d).dia}
              <span className="mk">{e === 'ok' ? '✓' : (e === 'mal' || e === 'pendiente') && h.tipo === 'lista' && (regs.get(d)?.valor ?? 0) > 0 ? `${regs.get(d)!.valor}/${h.variables.length}` : e === 'mal' ? '×' : ''}</span>
            </span>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
        <span className="mu" style={{ fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <i style={{ width: 12, height: 12, borderRadius: 3, background: 'color-mix(in srgb, var(--verde) 16%, transparent)', border: '1px solid var(--verde)' }} /> Cumplido
        </span>
        <span className="mu" style={{ fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <i style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--missbg)', border: '1px solid var(--miss)' }} /> No cumplido
        </span>
      </div>
    </div>
  );
}

function PanelVariable({ n, v, serie, hoy }: { n: number; v: Variable; serie: Punto[]; hoy: string }) {
  const p = proyectar(v, serie, hoy);
  return (
    <div className="panel" style={{ marginTop: 18 }}>
      <Grupo n={n} className="sep-grupo sin-arriba">{v.nombre} {v.unidad && `(${v.unidad})`}</Grupo>
      <Grafico serie={serie} meta={v.meta} inicial={v.inicial} />
      <div className="stats" style={{ marginTop: 8 }}>
        <div>
          <div className="cap mu2" style={{ fontSize: 11 }}>
            Actual
          </div>
          <div className="v num">{formatoNumero(p.actual)}</div>
          <div className="r">
            inicio {formatoNumero(v.inicial)} · meta {formatoNumero(v.meta)}
          </div>
        </div>
        <div>
          <div className="cap mu2" style={{ fontSize: 11 }}>
            Cambio
          </div>
          <div className="v num" style={{ color: p.cambio === null ? undefined : (v.direccion === 'bajar' ? (p.cambio ?? 0) <= 0 : (p.cambio ?? 0) >= 0) ? 'var(--verde)' : 'var(--miss)' }}>
            {conSigno(p.cambio)}
          </div>
          <div className="r">{p.faltan !== null && !p.alcanzada ? `faltan ${formatoNumero(p.faltan)} ${v.unidad}` : p.alcanzada ? 'meta alcanzada' : 'sin datos'}</div>
        </div>
        <div>
          <div className="cap mu2" style={{ fontSize: 11 }}>
            Ritmo semanal
          </div>
          <div className="v num">{conSigno(p.ritmoSemanal)}</div>
          <div className="r">{v.unidad} por semana</div>
        </div>
        <div>
          <div className="cap mu2" style={{ fontSize: 11 }}>
            Fecha estimada
          </div>
          <div className="v num" style={{ fontSize: 20 }}>
            {p.alcanzada ? '✓' : p.fechaEstimada ? fechaCorta(p.fechaEstimada) : '—'}
          </div>
          <div className="r">{p.alcanzada ? '¡lo lograste!' : p.fechaEstimada ? 'a este ritmo' : 'faltan datos o tendencia'}</div>
        </div>
      </div>
      <div className="barra-prog" style={{ marginTop: 14 }} aria-label={`Avance ${Math.round(p.avance * 100)}%`}>
        <i style={{ width: `${p.avance * 100}%` }} />
      </div>
    </div>
  );
}

/** Gráfico de línea simple en SVG, con la meta punteada. */
function Grafico({ serie, meta, inicial }: { serie: Punto[]; meta: number; inicial: number }) {
  if (serie.length === 0) return <p className="vacio-mini">Registrá tu primera medición para ver el gráfico.</p>;
  const W = 520, H = 180, P = 28;
  const ys = [...serie.map((s) => s.valor), meta, inicial];
  const min = Math.min(...ys), max = Math.max(...ys);
  const rango = max - min || 1;
  const x = (i: number) => P + (serie.length === 1 ? (W - 2 * P) / 2 : (i / (serie.length - 1)) * (W - 2 * P));
  const y = (v: number) => H - P - ((v - min) / rango) * (H - 2 * P);
  const linea = serie.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s.valor).toFixed(1)}`).join(' ');
  return (
    <svg className="grafico" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Evolución: de ${formatoNumero(serie[0].valor)} a ${formatoNumero(serie[serie.length - 1].valor)}`}>
      <line x1={P} x2={W - P} y1={y(meta)} y2={y(meta)} stroke="var(--verde)" strokeDasharray="5 5" strokeWidth="1.5" />
      <text x={W - P} y={y(meta) - 6} textAnchor="end">
        meta {formatoNumero(meta)}
      </text>
      <path d={linea} fill="none" stroke="var(--gold)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {serie.map((s, i) => (
        <circle key={s.fecha} cx={x(i)} cy={y(s.valor)} r={serie.length > 30 ? 2 : 3.5} fill="var(--sf)" stroke="var(--gold)" strokeWidth="2" />
      ))}
      <text x={P} y={H - 8}>
        {fechaCorta(serie[0].fecha)}
      </text>
      <text x={W - P} y={H - 8} textAnchor="end">
        {fechaCorta(serie[serie.length - 1].fecha)}
      </text>
    </svg>
  );
}

function Nota({ n, h, r, hoy }: { n: number; h: Habito; r: Registro | undefined; hoy: string }) {
  const [texto, setTexto] = useState(r?.nota ?? '');
  useEffect(() => setTexto(r?.nota ?? ''), [r?.nota]);
  return (
    <div className="panel" style={{ marginTop: 18 }}>
      <Grupo n={n} className="sep-grupo sin-arriba">Nota de hoy</Grupo>
      <textarea
        id="nota"
        aria-label="Nota de hoy"
        className="ta"
        maxLength={500}
        placeholder="Algo que quieras recordar de hoy sobre este hábito"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => texto !== (r?.nota ?? '') && guardarNota(h, hoy, texto)}
      />
    </div>
  );
}

/** Lista: qué ítem cuesta más (porcentaje de los últimos 30 días). */
function PanelItems({ n, h, regs, hoy }: { n: number; h: Habito; regs: Map<string, Registro>; hoy: string }) {
  const filas = porcentajeItems(h, regs, sumarDias(hoy, -29), hoy);
  return (
    <div className="panel" style={{ marginTop: 18 }} data-items>
      <Grupo n={n} className="sep-grupo sin-arriba">Por ítem · últimos 30 días</Grupo>
      {filas.map((f) => (
        <div key={f.id} style={{ padding: '8px 0' }}>
          <div style={{ display: 'flex', fontWeight: 600 }}>
            <span style={{ flex: 1 }}>{f.nombre}</span>
            <span className="num">{f.porcentaje}%</span>
          </div>
          <div className="barra-prog" style={{ marginTop: 6 }}>
            <i style={{ width: `${f.porcentaje}%`, background: f.porcentaje >= 80 ? 'var(--verde)' : 'var(--gold)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
