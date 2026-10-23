import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DIAS_CORTOS, HORAS_15, MOMENTOS } from '@core/fechas';
import {
  aNumero,
  DIRECCIONES,
  GRUPOS_ICONOS,
  LIMITES_HABITO,
  NOMBRE_TIPO,
  NOMBRE_VIRTUD,
  PLANTILLAS,
  TIPOS,
  validarHabito,
  VIRTUDES,
  type Direccion,
  type Habito,
  type Momento,
  type Plantilla,
  type TipoHabito,
  type Virtud,
} from '@core/habitos';
import { limpiarNombre } from '@core/validaciones';
import { guardarHabito, hoyActual, useDatos } from '@/app/datos';
import { Glifo } from '@/ui/IconoHabito';
import { useAvisos } from '@/ui/avisos';
import { Icono } from '@/ui/Iconos';

interface VarForm {
  id: string;
  nombre: string;
  unidad: string;
  inicial: string;
  meta: string;
  direccion: Direccion;
}

interface Form {
  nombre: string;
  tipo: TipoHabito;
  virtud: Virtud;
  icono: string;
  momento: Momento;
  dias: number[];
  meta: string;
  unidad: string;
  variables: VarForm[];
  recordatorio: string;
}

const TODOS = [0, 1, 2, 3, 4, 5, 6];
const vacio: Form = { nombre: '', tipo: 'sino', virtud: 'sabiduria', icono: 'med', momento: 0, dias: TODOS, meta: '8', unidad: '', variables: [], recordatorio: '' };
const nuevaVariable = (i: number): VarForm => ({ id: `v${Date.now().toString(36)}${i}`, nombre: '', unidad: '', inicial: '', meta: '', direccion: 'bajar' });
const aTexto = (n: number) => String(n).replace('.', ',');

const NOMBRE_DIRECCION: Record<Direccion, string> = { bajar: 'Bajar', subir: 'Subir', mantener: 'Mantener' };

export function Editor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navegar = useNavigate();
  const habitos = useDatos((s) => s.habitos);
  const listo = useDatos((s) => s.listo);
  const mostrar = useAvisos((s) => s.mostrar);
  const existente = useMemo(() => habitos.find((h) => h.id === id), [habitos, id]);
  const [f, setF] = useState<Form>(vacio);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    if (cargado || !existente) return;
    setF({
      nombre: existente.nombre,
      tipo: existente.tipo,
      virtud: existente.virtud,
      icono: existente.icono,
      momento: existente.momento,
      dias: existente.dias,
      meta: String(existente.meta),
      unidad: existente.unidad,
      variables: existente.variables.map((v) => ({ ...v, inicial: aTexto(v.inicial), meta: aTexto(v.meta) })),
      recordatorio: existente.recordatorio ?? '',
    });
    setCargado(true);
  }, [existente, cargado]);

  useEffect(() => {
    const p = PLANTILLAS.find((x) => x.id === params.get('plantilla'));
    if (!id && p) usarPlantilla(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const poner = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));
  const usarPlantilla = (p: Plantilla) =>
    setF({
      ...vacio,
      ...p.datos,
      meta: String(p.datos.meta),
      dias: p.id === 'peso' ? [1, 4] : TODOS,
      variables: p.datos.variables.map((v, i) => ({ ...nuevaVariable(i), ...v, id: v.nombre.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '') || `v${i}`, inicial: '', meta: '' })),
      recordatorio: '',
    });

  const armar = (): Omit<Habito, 'creado' | 'actualizado' | 'actualizadoPor' | 'recordatorioSlot'> & { creado?: number } => ({
    id: existente?.id ?? '',
    nombre: limpiarNombre(f.nombre),
    tipo: f.tipo,
    virtud: f.virtud,
    icono: f.icono,
    momento: f.momento,
    dias: [...f.dias].sort(),
    meta: f.tipo === 'cantidad' ? Math.round(aNumero(f.meta)) : 1,
    unidad: f.tipo === 'cantidad' ? limpiarNombre(f.unidad) : '',
    variables: f.tipo === 'medicion' ? f.variables.map((v) => ({ id: v.id, nombre: limpiarNombre(v.nombre), unidad: limpiarNombre(v.unidad), inicial: aNumero(v.inicial), meta: aNumero(v.meta), direccion: v.direccion })) : [],
    recordatorio: f.recordatorio || null,
    inicio: existente?.inicio ?? hoyActual(),
    archivado: existente?.archivado ?? false,
    orden: existente?.orden ?? habitos.length,
    racha: existente?.racha ?? 0,
    mejorRacha: existente?.mejorRacha ?? 0,
    creado: existente?.creado,
  });

  const guardar = async () => {
    const h = armar();
    const err = validarHabito(h);
    if (err) return setError(err);
    if (!existente && habitos.length >= LIMITES_HABITO.habitosMax) return setError(`Podés tener hasta ${LIMITES_HABITO.habitosMax} hábitos.`);
    setError('');
    setGuardando(true);
    try {
      const nuevoId = await guardarHabito(h);
      mostrar(existente ? 'Cambios guardados.' : 'Hábito creado.');
      navegar(existente ? `/habitos/${nuevoId}` : '/', { replace: true });
    } catch {
      /* el aviso ya se mostró */
    } finally {
      setGuardando(false);
    }
  };

  if (id && listo && !existente) return <p className="vacio-mini">Ese hábito no existe.</p>;

  return (
    <div className="entra" style={{ maxWidth: 760, marginInline: 'auto' }}>
      <button type="button" className="link" style={{ paddingLeft: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => navegar(-1)}>
        <Icono nombre="atras" tam={18} /> Volver
      </button>
      <div className="cap gold">{existente ? 'Editar' : 'Nueva práctica'}</div>
      <h1 className="titulo">{existente ? existente.nombre : 'Nuevo hábito'}</h1>

      {!existente && (
        <div style={{ marginTop: 18 }}>
          <Plantillas alElegir={usarPlantilla} />
        </div>
      )}

      <div className="panel" style={{ marginTop: 20 }}>
        <label className="fl" htmlFor="h-nombre">
          Nombre
        </label>
        <input id="h-nombre" className="fi" maxLength={LIMITES_HABITO.nombreMax} value={f.nombre} onChange={(e) => poner({ nombre: e.target.value })} placeholder="Por ejemplo: Meditar 10 minutos" />

        <div className="fl" style={{ marginTop: 20 }}>
          Tipo
        </div>
        <div className="seg3" role="radiogroup" aria-label="Tipo de hábito">
          {TIPOS.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={f.tipo === t}
              className={f.tipo === t ? 'on' : ''}
              disabled={!!existente && existente.tipo !== t}
              onClick={() => poner({ tipo: t, variables: t === 'medicion' && f.variables.length === 0 ? [nuevaVariable(0)] : f.variables })}
            >
              {NOMBRE_TIPO[t]}
            </button>
          ))}
        </div>
        <p className="mu" style={{ fontSize: 13, fontWeight: 500, marginTop: 8 }}>
          {f.tipo === 'sino' && 'Se marca con un rombo: lo hiciste o no.'}
          {f.tipo === 'cantidad' && 'Sumás de a uno hasta llegar a la meta del día.'}
          {f.tipo === 'medicion' && 'Registrás valores (peso, cintura…) y ves cómo avanzás hacia la meta.'}
          {existente && ' El tipo no se puede cambiar una vez creado.'}
        </p>

        {f.tipo === 'cantidad' && (
          <div className="g2" style={{ marginTop: 16 }}>
            <div>
              <label className="fl" htmlFor="h-meta">
                Meta por día
              </label>
              <input id="h-meta" className="fi" inputMode="numeric" value={f.meta} onChange={(e) => poner({ meta: e.target.value.replace(/[^0-9]/g, '') })} />
            </div>
            <div>
              <label className="fl" htmlFor="h-unidad">
                Unidad
              </label>
              <input id="h-unidad" className="fi" maxLength={LIMITES_HABITO.unidadMax} value={f.unidad} onChange={(e) => poner({ unidad: e.target.value })} placeholder="vasos, páginas…" />
            </div>
          </div>
        )}

        {f.tipo === 'medicion' && (
          <div style={{ marginTop: 16 }}>
            {f.variables.map((v, i) => (
              <fieldset key={v.id} style={{ border: '1px solid var(--ln2)', borderRadius: 12, padding: '12px 14px', margin: '0 0 12px' }}>
                <legend className="cap gold" style={{ padding: '0 6px', fontSize: 10.5 }}>
                  Variable {i + 1}
                </legend>
                <div className="g2">
                  <div>
                    <label className="fl" htmlFor={`vn-${v.id}`}>
                      Qué medís
                    </label>
                    <input id={`vn-${v.id}`} className="fi" maxLength={24} value={v.nombre} onChange={(e) => poner({ variables: f.variables.map((x) => (x.id === v.id ? { ...x, nombre: e.target.value } : x)) })} placeholder="Peso" />
                  </div>
                  <div>
                    <label className="fl" htmlFor={`vu-${v.id}`}>
                      Unidad
                    </label>
                    <input id={`vu-${v.id}`} className="fi" maxLength={LIMITES_HABITO.unidadMax} value={v.unidad} onChange={(e) => poner({ variables: f.variables.map((x) => (x.id === v.id ? { ...x, unidad: e.target.value } : x)) })} placeholder="kg" />
                  </div>
                  <div>
                    <label className="fl" htmlFor={`vi-${v.id}`}>
                      Valor inicial
                    </label>
                    <input id={`vi-${v.id}`} className="fi" inputMode="decimal" value={v.inicial} onChange={(e) => poner({ variables: f.variables.map((x) => (x.id === v.id ? { ...x, inicial: e.target.value } : x)) })} placeholder="86" />
                  </div>
                  <div>
                    <label className="fl" htmlFor={`vm-${v.id}`}>
                      Meta
                    </label>
                    <input id={`vm-${v.id}`} className="fi" inputMode="decimal" value={v.meta} onChange={(e) => poner({ variables: f.variables.map((x) => (x.id === v.id ? { ...x, meta: e.target.value } : x)) })} placeholder="78" />
                  </div>
                </div>
                <div className="seg3" role="radiogroup" aria-label={`Dirección de ${v.nombre || 'la variable'}`} style={{ marginTop: 12 }}>
                  {DIRECCIONES.map((d) => (
                    <button key={d} type="button" role="radio" aria-checked={v.direccion === d} className={v.direccion === d ? 'on' : ''} onClick={() => poner({ variables: f.variables.map((x) => (x.id === v.id ? { ...x, direccion: d } : x)) })}>
                      {NOMBRE_DIRECCION[d]}
                    </button>
                  ))}
                </div>
                {f.variables.length > 1 && (
                  <button type="button" className="link" style={{ color: 'var(--cor)', paddingLeft: 0, marginTop: 6 }} onClick={() => poner({ variables: f.variables.filter((x) => x.id !== v.id) })}>
                    Quitar variable
                  </button>
                )}
              </fieldset>
            ))}
            {f.variables.length < LIMITES_HABITO.variablesMax && (
              <button type="button" className="ghost" onClick={() => poner({ variables: [...f.variables, nuevaVariable(f.variables.length)] })}>
                + Agregar variable
              </button>
            )}
          </div>
        )}
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <div className="fl">Virtud que cultiva</div>
        <div className="chips" role="radiogroup" aria-label="Virtud">
          {VIRTUDES.map((v) => (
            <button key={v} type="button" role="radio" aria-checked={f.virtud === v} className={`chip v-${v} ${f.virtud === v ? 'on' : ''}`} style={f.virtud === v ? { background: 'var(--vc)', borderColor: 'var(--vc)' } : { color: 'var(--vc)' }} onClick={() => poner({ virtud: v })}>
              {NOMBRE_VIRTUD[v]}
            </button>
          ))}
        </div>

        <div className="fl" style={{ marginTop: 20 }}>
          Ícono
        </div>
        {GRUPOS_ICONOS.map(([grupo, lista]) => (
          <div key={grupo} style={{ marginBottom: 10 }}>
            <div className="mu2" style={{ fontSize: 12, fontWeight: 700, margin: '6px 0' }}>
              {grupo}
            </div>
            <div className="icgrid" role="radiogroup" aria-label={grupo}>
              {lista.map(([idIcono, nombre]) => (
                <button key={idIcono} type="button" role="radio" aria-checked={f.icono === idIcono} aria-label={nombre} title={nombre} className={f.icono === idIcono ? 'on' : ''} onClick={() => poner({ icono: idIcono })}>
                  <Glifo icono={idIcono} tam={22} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <div className="fl">Momento del día</div>
        <div className="seg3" role="radiogroup" aria-label="Momento del día">
          {([0, 1, 2] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={f.momento === m} className={f.momento === m ? 'on' : ''} onClick={() => poner({ momento: m })}>
              {MOMENTOS[m].split(' · ')[1]}
            </button>
          ))}
        </div>

        <div className="fl" style={{ marginTop: 20 }}>
          Días
        </div>
        <div className="chips" role="group" aria-label="Días de la semana">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <button key={d} type="button" aria-pressed={f.dias.includes(d)} className={`chip ${f.dias.includes(d) ? 'on' : ''}`} style={{ minWidth: 48, justifyContent: 'center' }} onClick={() => poner({ dias: f.dias.includes(d) ? f.dias.filter((x) => x !== d) : [...f.dias, d] })}>
              {DIAS_CORTOS[d]}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button type="button" className="link" style={{ paddingLeft: 0 }} onClick={() => poner({ dias: TODOS })}>
            Todos los días
          </button>
          <button type="button" className="link" onClick={() => poner({ dias: [1, 2, 3, 4, 5] })}>
            Lunes a viernes
          </button>
        </div>

        <label className="fl" htmlFor="h-rec" style={{ marginTop: 16 }}>
          Recordatorio
        </label>
        <select id="h-rec" className="fi" value={f.recordatorio} onChange={(e) => poner({ recordatorio: e.target.value })}>
          <option value="">Sin recordatorio</option>
          {HORAS_15.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <p className="mu" style={{ fontSize: 13, fontWeight: 500, marginTop: 6 }}>
          Llega como notificación si las activaste en Perfil. Si ya cumpliste, no te avisa.
        </p>
      </div>

      <div className="err" role="alert">
        {error}
      </div>
      <button type="button" className="btn" style={{ marginTop: 8, maxWidth: 420 }} disabled={guardando} onClick={guardar}>
        {existente ? 'Guardar cambios' : 'Crear hábito'}
      </button>
    </div>
  );
}

export function Plantillas({ alElegir, compacta = false }: { alElegir?: (p: Plantilla) => void; compacta?: boolean }) {
  const navegar = useNavigate();
  return (
    <div>
      <div className="fl">Empezar desde una plantilla</div>
      <div className="chips">
        {PLANTILLAS.slice(0, compacta ? 6 : undefined).map((p) => (
          <button key={p.id} type="button" className="chip" title={p.detalle} onClick={() => (alElegir ? alElegir(p) : navegar(`/habitos/nuevo?plantilla=${p.id}`))}>
            <Glifo icono={p.datos.icono} tam={16} />
            {p.nombre}
          </button>
        ))}
      </div>
    </div>
  );
}
