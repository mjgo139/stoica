import { Link } from 'react-router-dom';
import { citaDelDia } from '@core/citas';
import { claveDia, diasRestantesDelAnio, fechaLarga, momentoDelDia, partesEnZona, saludo, MOMENTOS } from '@core/fechas';
import { inicial, primerNombre } from '@core/perfil';
import { useSesion } from '@/app/sesion';
import { Laurel } from '@/ui/Laurel';
import { Icono } from '@/ui/Iconos';

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const VIRTUDES = [
  { id: 'sabiduria', nombre: 'Sabiduría', detalle: 'Pensar con claridad, aprender, discernir', color: 'var(--sab)' },
  { id: 'coraje', nombre: 'Coraje', detalle: 'Hacer lo difícil, sostener el esfuerzo', color: 'var(--cor)' },
  { id: 'justicia', nombre: 'Justicia', detalle: 'Cumplir con los demás y con tu deber', color: 'var(--jus)' },
  { id: 'templanza', nombre: 'Templanza', detalle: 'Moderación, autocontrol, medida', color: 'var(--tem)' },
] as const;

export function Hoy() {
  const perfil = useSesion((s) => s.perfil)!;
  const ahora = new Date();
  const zona = perfil.zonaHoraria;
  const hoy = claveDia(ahora, zona);
  const { hora } = partesEnZona(ahora, zona);
  const nombre = primerNombre(perfil.nombre);
  const cita = citaDelDia(hoy);
  const quedan = diasRestantesDelAnio(ahora, zona);

  const semana = [-3, -2, -1, 0, 1, 2, 3].map((off) => {
    const f = new Date(ahora.getTime() + off * 864e5);
    const p = partesEnZona(f, zona);
    return { off, clave: claveDia(f, zona), dia: p.dia, corto: DIAS_CORTOS[p.diaSemana] };
  });

  return (
    <div className="entra">
      <section className="hero" aria-label="Bienvenida">
        <Laurel ancho={300} alto={272} completo={false} grosor={2} className="wm" />
        <div className="acciones">
          <Link to="/perfil" className="avatar solo-mov" aria-label="Perfil" style={{ textDecoration: 'none' }}>
            {inicial(perfil.nombre)}
          </Link>
        </div>
        <div style={{ position: 'relative', minWidth: 0, paddingRight: 60 }}>
          <div className="cap gold">Panel del día</div>
          <h1 className="titulo">
            {saludo(hora)}
            {nombre ? `, ${nombre}` : ''}
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            <span className="chip-fecha">
              <Icono nombre="sol" tam={15} />
              {fechaLarga(ahora, zona)}
            </span>
            {perfil.mementoMori && <span className="chip-fecha">Memento mori · {quedan} {quedan === 1 ? 'día' : 'días'}</span>}
          </div>
        </div>
        <figure className="hq" style={{ margin: 0 }}>
          <blockquote className="quote" style={{ margin: 0, fontSize: 18 }}>
            “{cita.texto}”
          </blockquote>
          <figcaption className="cap gold" style={{ marginTop: 8, fontSize: 11 }}>
            {cita.autor}
          </figcaption>
        </figure>
      </section>

      <div className="hoy-grilla" style={{ marginTop: 24 }}>
        <aside className="panel" aria-label="Semana">
          <div className="grp cap" style={{ marginTop: 0 }}>
            <span>Esta semana</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', borderBottom: '1px solid var(--ln)' }}>
            {semana.map((d) => (
              <div
                key={d.clave}
                aria-current={d.off === 0 ? 'date' : undefined}
                style={{ height: 72, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, position: 'relative', color: d.off === 0 ? 'var(--gold)' : d.off > 0 ? 'var(--mu3)' : 'var(--tx2)' }}
              >
                <span className="cap" style={{ fontSize: 10.5, letterSpacing: '.1em' }}>
                  {d.corto}
                </span>
                <span className="num" style={{ fontSize: 21 }}>
                  {d.dia}
                </span>
                {d.off === 0 && <span style={{ position: 'absolute', bottom: -1, left: '22%', right: '22%', height: 2, background: 'var(--gold)' }} />}
              </div>
            ))}
          </div>
          <p className="mu" style={{ fontSize: 13, fontWeight: 500, marginTop: 14 }}>
            Cada día cumplido se va a marcar con un rombo verde oliva.
          </p>
        </aside>

        <section aria-label="Prácticas de hoy">
          <div className="grp cap" style={{ marginTop: 0 }}>
            <span>{MOMENTOS[momentoDelDia(hora)]}</span>
          </div>
          <div className="card vacio">
            <span className="rombo" style={{ margin: '6px auto 0', display: 'flex' }} />
            <div className="serif" style={{ fontSize: 22, marginTop: 18 }}>
              Empezá por una práctica
            </div>
            <p>En la próxima versión vas a crear tus hábitos: algo que marcás, una cantidad que vas sumando o una medida como tu peso.</p>
            <Link to="/habitos" className="ghost" style={{ textDecoration: 'none' }}>
              Ver hábitos
            </Link>
          </div>
        </section>

        <aside className="panel" aria-label="Las cuatro virtudes">
          <div className="grp cap" style={{ marginTop: 0 }}>
            <span>Las cuatro virtudes</span>
          </div>
          {VIRTUDES.map((v) => (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--ln2)' }}>
              <span style={{ width: 10, height: 10, transform: 'rotate(45deg)', background: v.color, flex: 'none', margin: '0 6px' }} />
              <span style={{ minWidth: 0 }}>
                <strong style={{ display: 'block', color: v.color }}>{v.nombre}</strong>
                <span className="mu" style={{ fontSize: 13, fontWeight: 500 }}>
                  {v.detalle}
                </span>
              </span>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
