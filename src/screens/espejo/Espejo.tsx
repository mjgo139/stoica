import { lazy, Suspense, useState } from "react";
import { Navigate } from "react-router-dom";
import { useSesion } from "@/app/sesion";
import { EspejoImagen } from "./EspejoImagen";

/** La versión con imágenes (IA) está pausada: no convenció. Para volver a mostrarla, poner esto en true (y ESPEJO_IMAGEN=si en el servidor). */
const CON_IMAGEN = false;

// El 3D trae su motor (three.js): se carga solo si elegís esa pestaña.
const Espejo3D = lazy(() =>
  import("./Espejo3D").then((m) => ({ default: m.Espejo3D })),
);

/** El Espejo (prueba, solo admin): versión con imágenes (nueva) y versión 3D. */
export function Espejo() {
  const perfil = useSesion((s) => s.perfil);
  const [version, setVersion] = useState<"imagen" | "3d">(
    CON_IMAGEN ? "imagen" : "3d",
  );
  if (perfil?.rol !== "admin") return <Navigate to="/" replace />;
  return (
    <div className="entra" style={{ maxWidth: 980, marginInline: "auto" }}>
      <div className="cap gold">El Espejo · prueba</div>
      <h1 className="titulo">Tu reflejo</h1>
      <p className="mu" style={{ marginTop: 4 }}>
        Solo vos lo ves por ahora.
      </p>
      {CON_IMAGEN && (
        <div
          className="seg3"
          role="radiogroup"
          aria-label="Versión del espejo"
          style={{ marginTop: 12, maxWidth: 360 }}
        >
          <button
            type="button"
            role="radio"
            aria-checked={version === "imagen"}
            className={version === "imagen" ? "on" : ""}
            onClick={() => setVersion("imagen")}
          >
            Imagen (nueva)
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={version === "3d"}
            className={version === "3d" ? "on" : ""}
            onClick={() => setVersion("3d")}
          >
            3D
          </button>
        </div>
      )}
      {version === "imagen" && CON_IMAGEN ? (
        <EspejoImagen />
      ) : (
        <Suspense
          fallback={
            <p className="mu" style={{ marginTop: 18 }}>
              Cargando…
            </p>
          }
        >
          <Espejo3D />
        </Suspense>
      )}
    </div>
  );
}
