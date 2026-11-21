import { useMemo, useState, type ReactNode } from "react";
import { CabeceraPagina } from '../../../familia/react';
import { Link } from "react-router-dom";
import { DIAS_LETRA, diaSemanaDeClave, sumarDias } from "@core/fechas";
import {
  estadoDia,
  NOMBRE_TIPO,
  NOMBRE_VIRTUD,
  porcentaje,
  racha,
  type Habito,
} from "@core/habitos";
import { aRomano } from "@core/romanos";
import {
  archivarHabito,
  registrosDe,
  useDatos,
  useHoy,
  VENTANA_DIAS,
} from "@/app/datos";
import { IconoHabito } from "@/ui/IconoHabito";
import { Icono } from "@/ui/Iconos";
import { Plantillas } from "./Editor";

export function ListaHabitos() {
  const habitos = useDatos((s) => s.habitos);
  const registros = useDatos((s) => s.registros);
  const listo = useDatos((s) => s.listo);
  const hoy = useHoy();
  const [verArchivados, setVerArchivados] = useState(false);
  const activos = habitos.filter((h) => !h.archivado);
  const archivados = habitos.filter((h) => h.archivado);
  const lista = verArchivados ? archivados : activos;

  return (
    <div className="entra">
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <CabeceraPagina etiqueta="Tus prácticas" titulo="Hábitos" linea="Cada hábito cultiva una virtud." />
        </div>
        <Link
          to="/habitos/nuevo"
          className="btn"
          style={{ width: "auto", padding: "0 24px", textDecoration: "none" }}
        >
          <Icono nombre="mas" tam={16} /> Nuevo hábito
        </Link>
      </div>

      {archivados.length > 0 && (
        <div className="solapas" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!verArchivados}
            className={!verArchivados ? "on" : ""}
            onClick={() => setVerArchivados(false)}
          >
            Activos · {activos.length}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={verArchivados}
            className={verArchivados ? "on" : ""}
            onClick={() => setVerArchivados(true)}
          >
            Archivados · {archivados.length}
          </button>
        </div>
      )}

      {listo && lista.length === 0 && !verArchivados && (
        <div className="card vacio" style={{ marginTop: 22 }}>
          <IconoHabito icono="read" virtud="sabiduria" grande />
          <div className="serif" style={{ fontSize: 20, marginTop: 12 }}>
            Todavía no tenés hábitos
          </div>
          <p>Creá uno desde cero o empezá con una plantilla.</p>
          <div style={{ textAlign: "left" }}>
            <Plantillas />
          </div>
        </div>
      )}

      <div className="tarjetas" style={{ marginTop: 22 }}>
        {lista.map((h) => (
          <TarjetaHabito
            key={h.id}
            h={h}
            hoy={hoy}
            regs={registrosDe(registros, h.id)}
            archivado={verArchivados}
          />
        ))}
      </div>
    </div>
  );
}

/** Tarjeta de un hábito con su semana. `accion` se muestra junto a la racha (por ejemplo, el rombo para marcar hoy). */
export function TarjetaHabito({
  h,
  hoy,
  regs,
  archivado = false,
  accion,
}: {
  h: Habito;
  hoy: string;
  regs: ReturnType<typeof registrosDe>;
  archivado?: boolean;
  accion?: ReactNode;
}) {
  const dias = useMemo(
    () => [-6, -5, -4, -3, -2, -1, 0].map((o) => sumarDias(hoy, o)),
    [hoy],
  );
  const r = racha(h, regs, hoy, VENTANA_DIAS);
  const p = porcentaje(h, regs, sumarDias(hoy, -29), hoy);
  return (
    <div className="card tarjeta-h">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link
          to={`/habitos/${h.id}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            textDecoration: "none",
            color: "inherit",
            flex: 1,
            minWidth: 0,
          }}
        >
          <IconoHabito icono={h.icono} virtud={h.virtud} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="nm">{h.nombre}</span>
            <span className={`sub v-${h.virtud} vt`}>
              {NOMBRE_VIRTUD[h.virtud]}{" "}
              <span className="mu2">· {NOMBRE_TIPO[h.tipo]}</span>
            </span>
          </span>
          <span style={{ textAlign: "right" }}>
            <span
              className="num gold"
              style={{ fontSize: 20, display: "block" }}
            >
              {aRomano(r)}
            </span>
            <span className="cap mu2" style={{ fontSize: 11 }}>
              racha
            </span>
          </span>
        </Link>
        {accion}
      </div>
      <div
        className="semana"
        style={{ marginTop: 16 }}
        aria-label="Últimos 7 días"
      >
        {dias.map((d) => {
          const e = estadoDia(h, regs, d, hoy);
          return (
            <div
              key={d}
              className={`${e === "ok" ? "ok" : e === "mal" ? "mal" : e === "inactivo" ? "inactivo" : ""} ${d === hoy ? "hoy" : ""}`}
            >
              <span className="cp" />
              <span className="bx">
                {e === "ok" ? "✓" : e === "mal" ? "×" : ""}
              </span>
              <span className="lb">{DIAS_LETRA[diaSemanaDeClave(d)]}</span>
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          borderTop: "1px solid var(--ln2)",
          marginTop: 14,
          paddingTop: 10,
        }}
      >
        <span className="cap mu" style={{ fontSize: 11, flex: 1 }}>
          30 días · {p}%
        </span>
        {archivado ? (
          <button
            type="button"
            className="link"
            onClick={() => archivarHabito(h, false)}
          >
            Restaurar
          </button>
        ) : (
          <Link
            to={`/habitos/${h.id}`}
            className="link"
            style={{
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Ver detalle
          </Link>
        )}
      </div>
    </div>
  );
}
