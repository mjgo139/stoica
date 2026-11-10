"""
Jardín estoico v2: prepara las imágenes de la terraza sin maceteros (para acomodar macetas y adornos).

Uso:  python3 -I herramientas/jardin/preparar_terraza.py <carpeta con los PNG de ChatGPT> <carpeta public/jardin>

- Fondos sin maceteros  -> terraza-vertical.webp / terraza-horizontal.webp
- Maceta (la 1.ª de la columna de 5) -> maceta.webp  (+ medidas de la tierra)
- 12 adornos (2 hojas de 6)          -> adorno-<id>.webp
- Brasero apagado (sin la llama)     -> adorno-brasero-apagado.webp
- Granado (6 etapas)                 -> granado-0..5.webp (+ medidas para SPRITES)
- Fuego animado (GIF)                -> fuego.webp (WebP animado)
Imprime en JSON las medidas que van a src/screens/jardin/disposicion.ts.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

src, dst = Path(sys.argv[1]), Path(sys.argv[2])
dst.mkdir(parents=True, exist_ok=True)
medidas = {}


def piezas(path, minfrac=0.01):
    im = Image.open(path).convert('RGBA')
    a = np.array(im)[:, :, 3] > 40
    lab, n = ndimage.label(ndimage.binary_closing(a, iterations=3))
    sl = ndimage.find_objects(lab)
    sizes = ndimage.sum(a, lab, range(1, n + 1))
    grandes = [i for i in range(n) if sizes[i] > a.sum() * minfrac]
    # Cada pieza chica se suma a la grande más cercana
    caja = {i: [sl[i][1].start, sl[i][0].start, sl[i][1].stop, sl[i][0].stop] for i in grandes}
    for i in range(n):
        if i in caja or sizes[i] < 30:
            continue
        cy, cx = (sl[i][0].start + sl[i][0].stop) / 2, (sl[i][1].start + sl[i][1].stop) / 2
        j = min(grandes, key=lambda g: ((caja[g][0] + caja[g][2]) / 2 - cx) ** 2 + ((caja[g][1] + caja[g][3]) / 2 - cy) ** 2)
        c = caja[j]
        caja[j] = [min(c[0], sl[i][1].start), min(c[1], sl[i][0].start), max(c[2], sl[i][1].stop), max(c[3], sl[i][0].stop)]
    out = []
    for i in grandes:
        x0, y0, x1, y1 = caja[i]
        recorte = Image.fromarray(np.where((lab[y0:y1, x0:x1] > 0)[..., None] | (np.array(im)[y0:y1, x0:x1, 3:4] > 0), np.array(im)[y0:y1, x0:x1], 0).astype('uint8'), 'RGBA')
        out.append(((y0 + y1) / 2, x0, recorte))
    return out


def filas(lista, n_filas):
    lista = sorted(lista, key=lambda t: t[0])
    por = len(lista) // n_filas
    res = []
    for f in range(n_filas):
        res += sorted(lista[f * por:(f + 1) * por], key=lambda t: t[1])
    return [t[2] for t in res]


def guardar(im, nombre, maximo=None, calidad=82):
    if maximo and max(im.size) > maximo:
        im = im.copy()
        im.thumbnail((maximo, maximo), Image.LANCZOS)
    im.save(dst / nombre, 'WEBP', quality=calidad, method=6)
    return im


# Fondos
guardar(Image.open(src / 'Terraza griega soleada y vacía.png').convert('RGB'), 'terraza-vertical.webp', calidad=80)
guardar(Image.open(src / 'Terraza clásica con fuente y glicinas.png').convert('RGB'), 'terraza-horizontal.webp', calidad=80)

# Maceta: medidas de la tierra (para apoyar la planta)
maceta = filas([(y, x, im) for y, x, im in piezas(src / 'Columna de Cinco Jardineras Griegas.png')], 5)[0]
m = guardar(maceta, 'maceta.webp', maximo=420)
# La tierra se midió a ojo sobre maceta.webp (la detección por color confunde la tierra con las vetas doradas).
medidas['maceta'] = {'w': m.width, 'h': m.height, 'tierra': {'x': 48.6, 'y': 35.0, 'w': 71.0, 'h': 59.0}}

# Adornos
ids1 = ['reloj-arena', 'brasero', 'cojin-laurel', 'pergaminos', 'lira', 'esfera']
ids2 = ['farol', 'pergamino', 'corona', 'flores', 'reloj-sol', 'libros']
medidas['adornos'] = {}
for hoja, ids in (('Colección de objetos grecorromanos ornamentales.png', ids1), ('Pegatinas de jardín griego ornamental (1).png', ids2)):
    for nombre, im in zip(ids, filas([(y, x, im) for y, x, im in piezas(src / hoja)], 2)):
        g = guardar(im, f'adorno-{nombre}.webp', maximo=260)
        medidas['adornos'][nombre] = {'w': g.width, 'h': g.height}
        if nombre == 'brasero':
            # Brasero apagado: se borra la llama (colores de fuego por encima del aro de brasas, en la franja central)
            a = np.array(g).astype(int)
            r, gg, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
            borde = int(g.height * 0.375)  # el aro de brasas empieza a ~97 px de 260
            x0, x1 = int(g.width * 0.28), int(g.width * 0.72)
            fuego = (r > 170) & (b < 170) & (r - b > 60)
            zona = np.zeros_like(fuego)
            zona[:borde, x0:x1] = True
            quitar = ndimage.binary_dilation(fuego & zona, iterations=1) & zona
            quitar[:borde - 4, x0:x1] = True  # arriba del aro solo había llama
            a[quitar, 3] = 0
            Image.fromarray(a.astype('uint8'), 'RGBA').save(dst / 'adorno-brasero-apagado.webp', 'WEBP', quality=82, method=6)
            medidas['adornos'][nombre]['llama'] = {'x': 50.0, 'y': round(borde / g.height * 100, 1), 'w': round((x1 - x0) / g.width * 100, 1)}

# Granado (como las otras plantas: a la mitad de tamaño)
etapas = sorted(piezas(src / 'granada.png', 0.005), key=lambda t: t[1])
medidas['granado'] = []
for i, (_, _, im) in enumerate(etapas):
    im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    im.save(dst / f'granado-{i}.webp', 'WEBP', quality=82, method=6)
    a = np.array(im)[:, :, 3] > 40
    base = a[int(im.height * 0.92):, :].any(axis=0)
    xs = np.nonzero(base)[0]
    medidas['granado'].append({'w': im.width, 'h': im.height, 'ax': round(float((xs.min() + xs.max()) / 2), 1), 'base': float(xs.max() - xs.min())})

# Fuego animado: GIF -> WebP animado
gif = Image.open(src / 'Animación de llama danzante.gif')
cuadros, tiempos = [], []
for k in range(gif.n_frames):
    gif.seek(k)
    c = gif.convert('RGBA')
    cuadros.append(c)
    tiempos.append(gif.info.get('duration', 100))
caja = None
for c in cuadros:
    bb = c.getbbox()
    caja = bb if caja is None else (min(caja[0], bb[0]), min(caja[1], bb[1]), max(caja[2], bb[2]), max(caja[3], bb[3]))
cuadros = [c.crop(caja) for c in cuadros]
cuadros[0].save(dst / 'fuego.webp', 'WEBP', save_all=True, append_images=cuadros[1:], duration=tiempos, loop=0, quality=80, method=6)
medidas['fuego'] = {'w': cuadros[0].width, 'h': cuadros[0].height}

print(json.dumps(medidas, ensure_ascii=False, indent=1))
