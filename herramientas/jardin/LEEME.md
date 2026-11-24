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

## Jardín v2: terraza acomodable

- `preparar_terraza.py <carpeta de ChatGPT> public/jardin` genera: terrazas sin maceteros (`terraza-*.webp`), la maceta,
  los 12 adornos (`adorno-*.webp`, más el brasero apagado), el granado (`granado-0..5.webp`) y el fuego animado (`fuego.webp`).
- La cuadrícula del piso, los pasillos (camino del filósofo) y las zonas bloqueadas están en `src/screens/jardin/terreno.ts`;
  sus pruebas (`terreno.test.ts`) verifican que el filósofo llega a cualquier lugar sin pisar nada.
- Medidas de la maceta, el fuego y los adornos (y con cuántas medallas se desbloquea cada uno): `disposicion.ts`.
- Lo que acomoda cada persona, el riego, la dificultad y la noche del fuego se guardan en `users/{uid}/jardin/config`.

## Jardín v3: repisa, braseros fijos y filósofos animados

- `armar_filosofos.py <carpeta> public/jardin` arma `marco-v2.webp` (camina, habla en 4 direcciones, antorcha) y
  `epicteto-v1.webp` (camina y habla) a la misma escala, más `repisa-v1.webp` y `regadera-v1.webp`.
  Las medidas de las hojas están en `src/screens/jardin/filosofos.ts`.
- Una sola terraza (la vertical) para celular y computadora. Repisa de logros contra la baranda (`REPISA` en
  `disposicion.ts`); 4 braseros fijos en las esquinas, al final de los pasillos (`BRASEROS` en `terreno.ts`).

## Jardín v4: recortes limpios (carpeta "asset Estoico" del usuario, en OneDrive)

- `actualizar_assets_v4.py "<asset Estoico>" public/jardin` reemplaza las plantas (`<planta>-0..5.webp`), los adornos,
  el fuego y arma `marco-v3.webp` (caminata nueva de `soldado/`, hablar y antorcha de `marco-v2.webp`).
  Imprime las medidas para `SPRITES`, `ADORNOS`, `FUEGO` (disposicion.ts) y `MARCO` (filosofos.ts).
- `marco-v3.webp` (caminata del soldado) se probó y se descartó: se veía peor. La app usa `marco-v2.webp`.
- No se usan los fondos nuevos (`jardin.png`, `terraza.png`): sus baldosas y perspectiva no coinciden con la cuadrícula de `terreno.ts`.
- El brasero sigue siendo el de v2 (el nuevo es igual, y su versión apagada salía con restos de llama).
- Las plantas del widget de Android (`planta_*`) son copias de las de la web.

## v2.8.0: plantas al doble

- Las plantas se volvieron a cortar con la misma lógica de `actualizar_assets_v4.py` pero **sin achicar** (`ESCALA_PLANTA = 1`): los archivos son el doble de los números de `SPRITES` (que no se tocaron: la escena usa proporciones). También las `planta_*` del widget.
