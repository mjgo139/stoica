import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { esCodigo, MAX_MIEMBROS, normalizarCodigo, validarNombreGrupo } from '@core/comunidad';
import { crearGrupo, unirseAGrupo, useComunidad } from '@/app/comunidad';
import { Hoja } from '@/ui/Hoja';
import { Icono } from '@/ui/Iconos';

export function Comunidad() {
  const grupos = useComunidad((s) => s.grupos);
  const listo = useComunidad((s) => s.listo);
  const navegar = useNavigate();
  const [hoja, setHoja] = useState<'crear' | 'unirse' | null>(null);

  return (
    <div className="entra">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="cap gold">Comunidad</div>
          <h1 className="titulo">Grupos</h1>
          <p className="lead">Pequeños grupos privados para acompañarse. Solo reacciones, sin chat.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="ghost" onClick={() => setHoja('unirse')}>
            Unirme con código
          </button>
          <button type="button" className="btn" style={{ width: 'auto', padding: '0 22px', height: 44 }} onClick={() => setHoja('crear')}>
            <Icono nombre="mas" tam={16} /> Crear grupo
          </button>
        </div>
      </div>

      {listo && grupos.size === 0 && (
        <div className="card vacio" style={{ marginTop: 22 }}>
          <div className="serif" style={{ fontSize: 22 }}>
            Todavía no estás en ningún grupo
          </div>
          <p>Creá uno e invitá hasta {MAX_MIEMBROS - 1} personas con un código, o unite al de alguien más. Cada uno elige qué hábitos comparte.</p>
        </div>
      )}

      <div className="tarjetas" style={{ marginTop: 22 }}>
        {[...grupos.values()].map(({ grupo, yo, desafios }) => (
          <Link key={grupo.id} to={`/comunidad/${grupo.id}`} className="card tarjeta-h">
            <div className="serif" style={{ fontSize: 22 }}>
              {grupo.nombre}
            </div>
            <div className="mu" style={{ fontWeight: 600, marginTop: 6 }}>
              {grupo.miembros.length} {grupo.miembros.length === 1 ? 'integrante' : 'integrantes'} · {desafios.length} {desafios.length === 1 ? 'desafío' : 'desafíos'}
            </div>
            <div className="cap mu2" style={{ fontSize: 10.5, marginTop: 12 }}>
              {yo?.compartidos.length ? `Compartís ${yo.compartidos.length} ${yo.compartidos.length === 1 ? 'hábito' : 'hábitos'}` : 'Todavía no compartís hábitos'}
            </div>
          </Link>
        ))}
      </div>

      <HojaCrear abierta={hoja === 'crear'} alCerrar={() => setHoja(null)} alCrear={(id) => navegar(`/comunidad/${id}`)} />
      <HojaUnirse abierta={hoja === 'unirse'} alCerrar={() => setHoja(null)} alUnirse={(id) => navegar(`/comunidad/${id}`)} />
    </div>
  );
}

function HojaCrear({ abierta, alCerrar, alCrear }: { abierta: boolean; alCerrar: () => void; alCrear: (id: string) => void }) {
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const err = validarNombreGrupo(nombre);
    if (err) return setError(err);
    setOcupado(true);
    const r = await crearGrupo(nombre);
    setOcupado(false);
    if (r) {
      setNombre('');
      alCerrar();
      alCrear(r.id);
    }
  };
  return (
    <Hoja titulo="Crear grupo" abierta={abierta} alCerrar={alCerrar}>
      <form onSubmit={enviar} noValidate>
        <label className="lbl cap" htmlFor="g-nombre">
          Nombre del grupo
        </label>
        <input id="g-nombre" className="inp" maxLength={40} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Por ejemplo: El Pórtico" />
        <p className="mu" style={{ fontSize: 13, fontWeight: 500, marginTop: 10 }}>
          Después te damos un código para invitar. Máximo {MAX_MIEMBROS} integrantes.
        </p>
        <div className="err" role="alert">
          {error}
        </div>
        <button className="btn" type="submit" disabled={ocupado} style={{ marginTop: 8 }}>
          Crear
        </button>
      </form>
    </Hoja>
  );
}

function HojaUnirse({ abierta, alCerrar, alUnirse, codigoInicial = '' }: { abierta: boolean; alCerrar: () => void; alUnirse: (id: string) => void; codigoInicial?: string }) {
  const [codigo, setCodigo] = useState(codigoInicial);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const c = normalizarCodigo(codigo);
    if (!esCodigo(c)) return setError('El código tiene 8 letras y números (sin 0, O, 1 ni I).');
    setOcupado(true);
    const r = await unirseAGrupo(c);
    setOcupado(false);
    if (r) {
      alCerrar();
      alUnirse(r.id);
    }
  };
  return (
    <Hoja titulo="Unirme a un grupo" abierta={abierta} alCerrar={alCerrar}>
      <form onSubmit={enviar} noValidate>
        <label className="lbl cap" htmlFor="g-codigo">
          Código de invitación
        </label>
        <input id="g-codigo" className="inp" autoCapitalize="characters" autoComplete="off" maxLength={12} value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="ABCD2345" style={{ letterSpacing: '.2em', fontWeight: 700 }} />
        <div className="err" role="alert">
          {error}
        </div>
        <button className="btn" type="submit" disabled={ocupado} style={{ marginTop: 8 }}>
          Unirme
        </button>
      </form>
    </Hoja>
  );
}

/** Enlace de invitación: /unirse/CODIGO */
export function Unirse() {
  const { codigo = '' } = useParams();
  const navegar = useNavigate();
  return (
    <div className="entra">
      <div className="cap gold">Invitación</div>
      <h1 className="titulo">Unirte a un grupo</h1>
      <HojaUnirse abierta codigoInicial={normalizarCodigo(codigo)} alCerrar={() => navegar('/comunidad', { replace: true })} alUnirse={(id) => navegar(`/comunidad/${id}`, { replace: true })} />
    </div>
  );
}
