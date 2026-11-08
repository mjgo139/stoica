# Jardín estoico: imágenes

- Fondos: `public/jardin/fondo-vertical.webp` (celular) y `fondo-horizontal.webp` (pantallas anchas), generados en ChatGPT y pasados a WebP (calidad 80).
- Plantas: una hoja PNG transparente por planta con 6 etapas en fila (semilla, brote, chica, grande, florecida, marchita).
  Se cortan por "manchas" conectadas del canal alfa (6 grandes, las chicas se suman a la más cercana), a la mitad de tamaño,
  y se guardan como `public/jardin/<planta>-<etapa>.webp`. Sus medidas (ancho, alto, centro y ancho de la tierra) van a `SPRITES`
  en `src/screens/jardin/disposicion.ts`.
- Maceteros: se detectan buscando el color de la tierra (muestra de un macetero, desenfoque, distancia de color < 45, cierre/apertura)
  y se guardan en `MACETEROS` como % del fondo.
- Plantas por virtud: `PLANTA_DE_VIRTUD` en `functions/src/core/jardin.ts`. Para sumar el granado: generar su hoja, cortarla igual
  (`granado-0..5.webp`), agregar sus medidas a `SPRITES` y cambiar `justicia` a `{ id: 'granado', nombre: 'Granado' }`.
