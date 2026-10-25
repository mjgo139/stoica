import { useMemo, useState, type FormEvent } from 'react';
import { fechaCorta, partesDeClave } from '@core/fechas';
import { calcularVida, diasHasta, ESPERANZA_DEFECTO, finDeAnio, MAX_CONTADORES, proximoCumple, SEMANAS_POR_ANIO, validarContador, validarEsperanza, validarNacimiento, type ContadorPropio } from '@core/memento';
import type { CambiosPerfil } from '@core/perfil';
import { limpiarNombre } from '@core/validaciones';
import { useSesion } from '@/app/sesion';
import { useHoy } from '@/app/datos';
import { obtenerDriver } from '@/data';
import { mensajeDeError } from '@/data/tipos';
import { Confirmar, Hoja } from '@/ui/Hoja';
import { Icono } from '@/ui/Iconos';
import { useAvisos } from '@/ui/avisos';

const mil = (n: number) => n.toLocaleString('es-PY');

async function guardarPerfil(c: CambiosPerfil) {
  const uid = useSesion.getState().usuario!.uid;
  await (await obtenerDriver()).actualizarPerfil(uid, c);
}

/** Memento mori: lo vivido, lo que probablemente queda y contadores propios. Se calcula todo en el dispositivo. */
export function MementoMori() {
  const perfil = useSesion((s) => s.perfil)!;
  const hoy = useHoy();
  const [configurando, setConfigurando] = useState(false);
  const nacimiento = perfil.nacimiento ?? null;
  const esperanza = perfil.esperanzaVida ?? ESPERANZA_DEFECTO;
  const fin = finDeAnio(hoy);

  return (
    <div className="entra" style={{ maxWidth: 980, marginInline: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div className="cap gold">Memento mori</div>
          <h1 className="titulo">Recordá que vas a morir</h1>
          <p className="quote" style={{ fontSize: 17, marginTop: 6 }}>
            “No vivas como si fueras a vivir diez mil años. La muerte pende sobre ti: mientras vivas, mientras puedas, sé bueno.” — Marco Aurelio
          </p>
        </div>
        {nacimiento && (
          <button type="button" className="ghost" onClick={() => setConfigurando(true)}>
            Ajustes
          </button>
        )}
      </div>

      {!nacimiento ? (
        <div className="panel" style={{ marginTop: 22, maxWidth: 560 }}>
          <div className="grp cap" style={{ marginTop: 0 }}>
            <span>Para empezar</span>
          </div>
          <p className="mu" style={{ fontWeight: 500, marginTop: 0 }}>
            Con tu fecha de nacimiento calculamos cuánto viviste y cuánto te queda probablemente. Es privada: no la ve nadie, ni el administrador, ni tus grupos.
          </p>
          <FormVida inicial={null} esperanzaInicial={esperanza} hoy={hoy} alGuardar={() => undefined} />
          <div className="grp cap">
            <span>Mientras tanto</span>
          </div>
          <Contador titulo={`Faltan para ${fin.anio}`} valor={mil(fin.dias)} detalle={fin.dias === 1 ? 'día' : 'días'} />
        </div>
      ) : (
        <Panel nacimiento={nacimiento} esperanza={esperanza} hoy={hoy} contadores={perfil.contadores ?? []} />
      )}

      <Hoja titulo="Ajustes del memento mori" abierta={configurando} alCerrar={() => setConfigurando(false)}>
        <FormVida inicial={nacimiento} esperanzaInicial={esperanza} hoy={hoy} alGuardar={() => setConfigurando(false)} />
      </Hoja>
    </div>
  );
}

function FormVida({ inicial, esperanzaInicial, hoy, alGuardar }: { inicial: string | null; esperanzaInicial: number; hoy: string; alGuardar: () => void }) {
  const mostrar = useAvisos((s) => s.mostrar);
  const [fecha, setFecha] = useState(inicial ?? '');
  const [esperanza, setEsperanza] = useState(String(esperanzaInicial));
  const [error, setError] = useState('');
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const err = validarNacimiento(fecha, hoy) ?? validarEsperanza(Number(esperanza));
    if (err) return setError(err);
    try {
      await guardarPerfil({ nacimiento: fecha, esperanzaVida: Number(esperanza) });
      alGuardar();
    } catch (er) {
      mostrar(mensajeDeError(er));
    }
  };
  return (
    <form onSubmit={enviar} noValidate>
      <label className="lbl cap" htmlFor="mm-nac">
        Fecha de nacimiento
      </label>
      <input id="mm-nac" type="date" className="fi" max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} />
      <label className="lbl cap" htmlFor="mm-esp">
        Esperanza de vida (años)
      </label>
      <input id="mm-esp" className="fi" inputMode="numeric" style={{ maxWidth: 140 }} value={esperanza} onChange={(e) => setEsperanza(e.target.value.replace(/\D/g, '').slice(0, 3))} />
      <p className="mu" style={{ fontSize: 12.5, fontWeight: 500 }}>
        En Paraguay es de unos {ESPERANZA_DEFECTO} años (INE). Podés cambiarla.
      </p>
      <div className="err" role="alert">
        {error}
      </div>
      <button className="btn" type="submit" style={{ marginTop: 6 }}>
        Guardar
      </button>
    </form>
  );
}

function Contador({ titulo, valor, detalle, clase }: { titulo: string; valor: string; detalle?: string; clase?: string }) {
  return (
    <div className={`panel ${clase ?? ''}`} data-contador={titulo}>
      <div className="cap mu2" style={{ fontSize: 10.5 }}>
        {titulo}
      </div>
      <div className="num" style={{ fontSize: 30, marginTop: 6, lineHeight: 1.1 }}>
        {valor}
      </div>
      {detalle && (
        <div className="mu" style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>
          {detalle}
        </div>
      )}
    </div>
  );
}

function Panel({ nacimiento, esperanza, hoy, contadores }: { nacimiento: string; esperanza: number; hoy: string; contadores: ContadorPropio[] }) {
  const v = calcularVida(nacimiento, hoy, esperanza);
  const cumple = proximoCumple(nacimiento, hoy);
  const fin = finDeAnio(hoy);
  const [editando, setEditando] = useState<ContadorPropio | 'nuevo' | null>(null);
  const plural = (n: number, s: string, p: string) => `${mil(n)} ${n === 1 ? s : p}`;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 22 }}>
        <Contador titulo="Ya viviste" valor={plural(v.anios, 'año', 'años')} detalle={`${plural(v.meses, 'mes', 'meses')} y ${plural(v.dias, 'día', 'días')} · ${mil(v.diasVividos)} días · ${mil(v.semanasVividas)} semanas`} />
        <Contador titulo="Probablemente te quedan" valor={`~${v.aniosRestantes.toLocaleString('es-PY')} años`} detalle={`${mil(v.diasRestantes)} días · hasta los ${esperanza}`} />
        <Contador titulo={`Faltan para ${fin.anio}`} valor={plural(fin.dias, 'día', 'días')} detalle={`1 de enero de ${fin.anio}`} />
        <Contador titulo="Tu próximo cumpleaños" valor={cumple.dias === 0 ? '¡Hoy!' : plural(cumple.dias, 'día', 'días')} detalle={`Cumplís ${cumple.cumple} · ${fechaCorta(cumple.fecha)}`} />
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="num" style={{ fontSize: 26 }}>
            {v.porcentaje.toLocaleString('es-PY')}%
          </span>
          <span className="mu" style={{ fontWeight: 600 }}>
            de tu vida probable ya pasó. Lo que queda, usalo bien.
          </span>
        </div>
        <span className="barra-prog" style={{ display: 'block', marginTop: 10 }}>
          <i style={{ width: `${v.porcentaje}%`, background: 'var(--gold)' }} />
        </span>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div className="grp cap" style={{ marginTop: 0, flex: 1 }}>
            <span>Tus contadores</span>
          </div>
          {contadores.length < MAX_CONTADORES && (
            <button type="button" className="link" onClick={() => setEditando('nuevo')}>
              + Agregar
            </button>
          )}
        </div>
        {contadores.length === 0 && <p className="vacio-mini">Agregá fechas que te importan: un viaje, un examen, un aniversario. Hasta {MAX_CONTADORES}.</p>}
        {contadores.map((c) => {
          const d = diasHasta(c.fecha, hoy);
          return (
            <button key={c.id} type="button" className="srow" onClick={() => setEditando(c)} data-contador-propio={c.nombre}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700 }}>{c.nombre}</span>
                <span className="mu2" style={{ fontSize: 12.5, fontWeight: 600 }}>
                  {fechaCorta(c.fecha)} {partesDeClave(c.fecha).anio}
                </span>
              </span>
              <span style={{ textAlign: 'right' }}>
                <span className="num" style={{ fontSize: 20, display: 'block' }}>
                  {d === 0 ? 'Hoy' : mil(Math.abs(d))}
                </span>
                {d !== 0 && (
                  <span className="cap mu2" style={{ fontSize: 9.5 }}>
                    {d > 0 ? (d === 1 ? 'día falta' : 'días faltan') : d === -1 ? 'día pasó' : 'días pasaron'}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <GrillaSemanas vividas={v.semanasVividas} anios={esperanza} nacimiento={nacimiento} />

      <EditorContador contador={editando === 'nuevo' ? null : editando} abierto={editando !== null} contadores={contadores} alCerrar={() => setEditando(null)} hoy={hoy} />
    </>
  );
}

/** Tu vida en semanas: una fila por año, 52 casilleros por fila. */
function GrillaSemanas({ vividas, anios, nacimiento }: { vividas: number; anios: number; nacimiento: string }) {
  const celda = 8;
  const hueco = 2;
  const izq = 22;
  const ancho = izq + SEMANAS_POR_ANIO * (celda + hueco);
  const alto = anios * (celda + hueco);
  const actual = vividas;
  const filas = useMemo(() => Array.from({ length: anios }, (_, a) => a), [anios]);
  const anioNac = partesDeClave(nacimiento).anio;
  return (
    <div className="panel" style={{ marginTop: 18 }}>
      <div className="grp cap" style={{ marginTop: 0 }}>
        <span>Tu vida en semanas</span>
      </div>
      <p className="mu" style={{ fontSize: 13, fontWeight: 500, marginTop: 0 }}>
        Cada casillero es una semana; cada fila, un año. Las doradas ya las viviste; la que brilla es esta.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${ancho} ${alto}`} style={{ width: '100%', minWidth: 320, maxWidth: 720, display: 'block' }} role="img" aria-label={`${vividas} semanas vividas de ${anios * SEMANAS_POR_ANIO}`}>
          {filas.map((a) => (
            <g key={a}>
              {a % 10 === 0 && (
                <text x={0} y={a * (celda + hueco) + celda - 1} fontSize={7} fill="var(--mu2)">
                  {a}
                </text>
              )}
              {Array.from({ length: SEMANAS_POR_ANIO }, (_, s) => {
                const n = a * SEMANAS_POR_ANIO + s;
                const estilo = n < actual ? { fill: 'var(--gold)' } : n === actual ? { fill: 'var(--ok)' } : { fill: 'none', stroke: 'var(--ln3)', strokeWidth: 0.8 };
                return <rect key={s} x={izq + s * (celda + hueco)} y={a * (celda + hueco)} width={celda} height={celda} rx={1.5} {...estilo} />;
              })}
            </g>
          ))}
        </svg>
      </div>
      <p className="mu2" style={{ fontSize: 12, fontWeight: 600, marginTop: 8 }}>
        Desde {anioNac} hasta {anioNac + anios} · los números de la izquierda son tu edad.
      </p>
    </div>
  );
}

function EditorContador({ contador, abierto, contadores, alCerrar, hoy }: { contador: ContadorPropio | null; abierto: boolean; contadores: ContadorPropio[]; alCerrar: () => void; hoy: string }) {
  const mostrar = useAvisos((s) => s.mostrar);
  const [nombre, setNombre] = useState('');
  const [fecha, setFecha] = useState(hoy);
  const [error, setError] = useState('');
  const [antes, setAntes] = useState(false);
  const [borrando, setBorrando] = useState(false);
  if (abierto && !antes) {
    setAntes(true);
    setNombre(contador?.nombre ?? '');
    setFecha(contador?.fecha ?? hoy);
    setError('');
  }
  if (!abierto && antes) setAntes(false);

  const guardarLista = async (lista: ContadorPropio[]) => {
    try {
      await guardarPerfil({ contadores: lista });
      alCerrar();
    } catch (e) {
      mostrar(mensajeDeError(e));
    }
  };
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const c = { id: contador?.id ?? `c${Date.now().toString(36)}`, nombre: limpiarNombre(nombre), fecha };
    const err = validarContador(c);
    if (err) return setError(err);
    await guardarLista(contador ? contadores.map((x) => (x.id === c.id ? c : x)) : [...contadores, c].slice(0, MAX_CONTADORES));
  };
  return (
    <Hoja titulo={contador ? 'Editar contador' : 'Nuevo contador'} abierta={abierto} alCerrar={alCerrar}>
      <form onSubmit={enviar} noValidate>
        <label className="lbl cap" htmlFor="ct-nombre">
          Nombre
        </label>
        <input id="ct-nombre" className="inp" maxLength={40} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Por ejemplo: Viaje a Encarnación" />
        <label className="lbl cap" htmlFor="ct-fecha">
          Fecha
        </label>
        <input id="ct-fecha" type="date" className="fi" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        <div className="err" role="alert">
          {error}
        </div>
        <button className="btn" type="submit" style={{ marginTop: 6 }}>
          {contador ? 'Guardar' : 'Agregar'}
        </button>
        {contador && (
          <button type="button" className="ghost peligro" style={{ width: '100%', marginTop: 10 }} onClick={() => setBorrando(true)}>
            <Icono nombre="craneo" tam={16} /> Borrar contador
          </button>
        )}
      </form>
      <Confirmar
        abierto={borrando}
        titulo="¿Borrar el contador?"
        texto={contador?.nombre ?? ''}
        accion="Borrar"
        peligro
        alCerrar={() => setBorrando(false)}
        alConfirmar={() => {
          setBorrando(false);
          if (contador) void guardarLista(contadores.filter((x) => x.id !== contador.id));
        }}
      />
    </Hoja>
  );
}
