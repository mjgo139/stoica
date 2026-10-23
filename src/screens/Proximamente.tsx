import type { ReactNode } from 'react';
import { Icono, type NombreIcono } from '@/ui/Iconos';

interface Props {
  seccion: string;
  titulo: string;
  lema: string;
  icono: NombreIcono;
  version: string;
  queTrae: ReactNode[];
}

/** Pantallas que se completan en versiones siguientes: muestran qué traen y cuándo. */
export function Proximamente({ seccion, titulo, lema, icono, version, queTrae }: Props) {
  return (
    <div className="entra">
      <div className="cap gold">{seccion}</div>
      <h1 className="titulo">{titulo}</h1>
      <p className="lead">{lema}</p>
      <div className="cols c64" style={{ marginTop: 24 }}>
        <div className="card vacio">
          <span className="ico ring" style={{ width: 56, height: 56 }}>
            <Icono nombre={icono} tam={24} />
          </span>
          <div className="serif" style={{ fontSize: 22, marginTop: 14 }}>
            Llega en la {version}
          </div>
          <p>Esta sección se está construyendo. La base ya está lista: tu cuenta, tu perfil y la app instalable.</p>
        </div>
        <div className="panel">
          <div className="grp cap" style={{ marginTop: 0 }}>
            <span>Qué vas a poder hacer</span>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {queTrae.map((t, i) => (
              <li key={i} style={{ display: 'flex', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--ln2)', fontWeight: 500 }}>
                <span className="rombo" style={{ width: 9, height: 9, borderWidth: 1.5, marginTop: 6, flex: 'none', borderColor: 'var(--gold)' }} />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export const Habitos = () => (
  <Proximamente
    seccion="Tus prácticas"
    titulo="Hábitos"
    lema="Cada hábito cultiva una virtud."
    icono="habitos"
    version="v0.2"
    queTrae={[
      <><strong>Sí/No</strong>: se marca con un rombo.</>,
      <><strong>Cantidad</strong>: sumás de a uno hasta la meta (8 vasos, 20 páginas).</>,
      <><strong>Medición</strong>: peso, cintura o lo que quieras, con gráfico y fecha estimada de meta.</>,
      <>Rachas en números romanos e hitos: <strong>Victoria sobre ti mismo</strong>.</>,
    ]}
  />
);

export const Tareas = () => (
  <Proximamente
    seccion="Lo que hay que hacer"
    titulo="Tareas"
    lema="Ocupate de lo que depende de ti."
    icono="tareas"
    version="v0.4"
    queTrae={[
      <>Tareas con la pregunta <strong>¿depende de ti?</strong></>,
      <>Ordenadas por momento del día.</>,
      <>Las que no dependen de vos, se sueltan.</>,
    ]}
  />
);

export const Enfoque = () => (
  <Proximamente
    seccion="Atención plena"
    titulo="Enfoque"
    lema="Una cosa por vez, con toda la atención."
    icono="enfoque"
    version="v0.4"
    queTrae={[<>Temporizador de enfoque y descanso.</>, <>Meditación guiada por tiempo.</>, <>Registro de tus sesiones.</>]}
  />
);

export const Examen = () => (
  <Proximamente
    seccion="Al anochecer"
    titulo="Examen"
    lema="Las tres preguntas de Séneca."
    icono="examen"
    version="v0.4"
    queTrae={[<>¿Qué mal he corregido hoy?</>, <>¿Qué impulso he resistido?</>, <>¿En qué soy hoy mejor que ayer?</>, <>Balance de las cuatro virtudes.</>]}
  />
);
