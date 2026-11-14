"""
Jardín v4: reemplaza plantas, adornos, fuego y la caminata de Marco por las versiones corregidas
(recorte limpio, sin bordes blancos) de la carpeta "asset Estoico".

Uso: python3 -I herramientas/jardin/actualizar_assets_v4.py <carpeta "asset Estoico"> <salida (public/jardin)>

- assets-corregidos-v2/{granada,laurel,lavanda,olivo,planta}.png -> <planta>-0..5.webp (+ SPRITES)
- assets-corregidos-v2/{ornamentos,pegatinas}.png               -> adorno-*.webp, adorno-brasero-apagado.webp
- assets-corregidos-v2/llama.png (8 cuadros)                    -> fuego.webp animado
- soldado/{frente,izquierda,derecha,espalda}/01..04.png         -> marco-v3.webp (caminar 4 cuadros;
  hablar y antorcha se toman de marco-v2.webp)
Los fondos nuevos (jardin.png, terraza.png) NO se usan: el piso tiene otra perspectiva y otras baldosas
que la cuadrícula calibrada en terreno.ts.
Imprime en JSON las medidas para disposicion.ts y filosofos.ts.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

src, dst = Path(sys.argv[1]), Path(sys.argv[2])
v2 = src / 'assets-corregidos-v2'
medidas = {}


def piezas(path, minfrac=0.01):
    im = Image.open(path).convert('RGBA')
    arr = np.array(im)
    a = arr[:, :, 3] > 40
    lab, n = ndimage.label(ndimage.binary_closing(a, iterations=3))
    sl = ndimage.find_objects(lab)
    sizes = ndimage.sum(a, lab, range(1, n + 1))
    grandes = [i for i in range(n) if sizes[i] > a.sum() * minfrac]
    caja = {i: [sl[i][1].start, sl[i][0].start, sl[i][1].stop, sl[i][0].stop] for i in grandes}
    duenio = {i: i for i in grandes}
    for i in range(n):
        if i in caja or sizes[i] < 30:
            continue
        cy, cx = (sl[i][0].start + sl[i][0].stop) / 2, (sl[i][1].start + sl[i][1].stop) / 2
        j = min(grandes, key=lambda g: ((caja[g][0] + caja[g][2]) / 2 - cx) ** 2 + ((caja[g][1] + caja[g][3]) / 2 - cy) ** 2)
        duenio[i] = j
        c = caja[j]
        caja[j] = [min(c[0], sl[i][1].start), min(c[1], sl[i][0].start), max(c[2], sl[i][1].stop), max(c[3], sl[i][0].stop)]
    out = []
    for g in grandes:
        x0, y0, x1, y1 = caja[g]
        ids = [i + 1 for i, d in duenio.items() if d == g]
        # Solo lo de esta pieza (sin pedacitos de la vecina) y nada casi transparente
        m = np.isin(lab[y0:y1, x0:x1], ids) & (arr[y0:y1, x0:x1, 3] > 8)
        m = ndimage.binary_dilation(m, iterations=1) & (arr[y0:y1, x0:x1, 3] > 8)
        recorte = arr[y0:y1, x0:x1].copy()
        recorte[~m, 3] = 0
        im2 = Image.fromarray(recorte, 'RGBA')
        out.append(((y0 + y1) / 2, x0, im2.crop(im2.getbbox())))
    return out


def filas(lista, n_filas):
    lista = sorted(lista, key=lambda t: t[0])
    por = len(lista) // n_filas
    res = []
    for f in range(n_filas):
        res += sorted(lista[f * por:(f + 1) * por], key=lambda t: t[1])
    return [t[2] for t in res]


def guardar(im, nombre, maximo=None, calidad=84):
    if maximo and max(im.size) > maximo:
        im = im.copy()
        im.thumbnail((maximo, maximo), Image.LANCZOS)
    im.save(dst / nombre, 'WEBP', quality=calidad, method=6)
    return im


# ----- Plantas: 6 etapas por hoja, a la mitad del tamaño (como las de antes) -----
PLANTAS = {'granada': 'granado', 'laurel': 'laurel', 'lavanda': 'lavanda', 'olivo': 'olivo', 'planta': 'lirio'}
ESCALA_PLANTA = 0.5
medidas['plantas'] = {}
for archivo, nombre in PLANTAS.items():
    etapas = sorted(piezas(v2 / f'{archivo}.png', 0.004), key=lambda t: t[1])
    assert len(etapas) == 6, f'{archivo}: {len(etapas)} etapas'
    lista = []
    for i, (_, _, im) in enumerate(etapas):
        im = im.resize((max(1, round(im.width * ESCALA_PLANTA)), max(1, round(im.height * ESCALA_PLANTA))), Image.LANCZOS)
        guardar(im, f'{nombre}-{i}.webp')
        a = np.array(im)[:, :, 3] > 60
        base = a[int(im.height * 0.9):, :].any(axis=0)
        xs = np.nonzero(base)[0]
        lista.append({'w': im.width, 'h': im.height, 'ax': round(float((xs.min() + xs.max()) / 2), 1), 'base': float(xs.max() - xs.min())})
    medidas['plantas'][nombre] = lista

# ----- Adornos (2 hojas de 6) -----
ids1 = ['reloj-arena', 'brasero', 'cojin-laurel', 'pergaminos', 'lira', 'esfera']
ids2 = ['farol', 'pergamino', 'corona', 'flores', 'reloj-sol', 'libros']
medidas['adornos'] = {}
for hoja, ids in (('ornamentos.png', ids1), ('pegatinas.png', ids2)):
    for nombre, im in zip(ids, filas(piezas(v2 / hoja), 2)):
        g = guardar(im, f'adorno-{nombre}.webp', maximo=260)
        medidas['adornos'][nombre] = {'w': g.width, 'h': g.height}
        if nombre == 'brasero':
            # Brasero apagado: se borra todo lo que tiene color de fuego arriba del borde de la copa
            a = np.array(g).astype(int)
            r, gg, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
            fuego = (r > 200) & (gg > 60) & (b < 120) & (r - b > 110)
            filas_fuego = np.nonzero(fuego.any(axis=1))[0]
            # La copa: primera fila (de arriba) donde el ancho opaco supera el 45 % del total
            opaco = a[:, :, 3] > 100
            anchos = opaco.sum(axis=1)
            copa = int(np.argmax(anchos > g.width * 0.45))
            borde = copa + 6
            x0, x1 = int(g.width * 0.25), int(g.width * 0.75)
            quitar = np.zeros_like(fuego)
            quitar[:copa, x0:x1] = True  # arriba de la copa solo hay llama
            zona = np.zeros_like(fuego)
            zona[copa:borde, x0:x1] = True
            quitar |= ndimage.binary_dilation(fuego & zona, iterations=1) & zona
            a[quitar, 3] = 0
            ap = Image.fromarray(a.astype('uint8'), 'RGBA')
            ap = ap.crop((0, 0, g.width, g.height))
            ap.save(dst / 'adorno-brasero-apagado.webp', 'WEBP', quality=84, method=6)
            medidas['adornos'][nombre]['llama'] = {'copa_y': round(copa / g.height * 100, 1), 'ancho': round((x1 - x0) / g.width * 100, 1),
                                                   'fuego_desde': int(filas_fuego.min()) if len(filas_fuego) else None}

# ----- Fuego: 8 cuadros (4×2) -> WebP animado -----
ll = Image.open(v2 / 'llama.png').convert('RGBA')
cw, ch = ll.width // 4, ll.height // 2
cuadros = [ll.crop((c * cw, f * ch, (c + 1) * cw, (f + 1) * ch)) for f in range(2) for c in range(4)]
caja = None
for c in cuadros:
    a = np.array(c)[:, :, 3] > 20
    ys, xs = np.nonzero(a)
    bb = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    caja = bb if caja is None else (min(caja[0], bb[0]), min(caja[1], bb[1]), max(caja[2], bb[2]), max(caja[3], bb[3]))
cuadros = [c.crop(caja) for c in cuadros]
alto = 276
cuadros = [c.resize((round(c.width * alto / c.height), alto), Image.LANCZOS) for c in cuadros]
cuadros[0].save(dst / 'fuego.webp', 'WEBP', save_all=True, append_images=cuadros[1:], duration=95, loop=0, quality=82, method=6)
medidas['fuego'] = {'w': cuadros[0].width, 'h': cuadros[0].height}

# ----- Marco v3: caminata nueva de 4 cuadros + hablar y antorcha de marco-v2 -----
ALTO = 220
MARGEN = 6


def ancla(im):
    a = np.array(im)[:, :, 3] > 60
    xs = np.nonzero(a[int(im.height * 0.7):, :])[1]
    return float(xs.mean()) if len(xs) else im.width / 2


def recortar(im):
    a = np.array(im)[:, :, 3] > 60
    ys, xs = np.nonzero(a)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


vieja = Image.open(dst / 'marco-v2.webp').convert('RGBA')
VW, VH = 235, 237
VIEJAS = {'hablar_abajo': (4, 2), 'hablar_izquierda': (5, 2), 'hablar_derecha': (6, 2), 'hablar_arriba': (7, 2), 'antorcha': (8, 3)}
DIRS = {'abajo': 'frente', 'izquierda': 'izquierda', 'derecha': 'derecha', 'arriba': 'espalda'}
seqs = {}
for d, carpeta in DIRS.items():
    ims = [recortar(Image.open(src / 'soldado' / carpeta / f'0{k}.png').convert('RGBA')) for k in range(1, 5)]
    e = ALTO / np.median([im.height for im in ims])
    seqs[f'caminar_{d}'] = [im.resize((round(im.width * e), round(im.height * e)), Image.LANCZOS) for im in ims]
for k, (fila, n) in VIEJAS.items():
    seqs[k] = [recortar(vieja.crop((c * VW, fila * VH, (c + 1) * VW, (fila + 1) * VH))) for c in range(n)]
medio = max(max(ancla(im), im.width - ancla(im)) for ims in seqs.values() for im in ims)
alto_max = max(im.height for ims in seqs.values() for im in ims)
w, h = int(np.ceil(medio * 2)) + MARGEN * 2, alto_max + MARGEN * 2
cols = max(len(v) for v in seqs.values())
lienzo = Image.new('RGBA', (w * cols, h * len(seqs)), (0, 0, 0, 0))
info = {}
for f, (k, ims) in enumerate(seqs.items()):
    info[k] = {'fila': f, 'cuadros': len(ims)}
    for c, im in enumerate(ims):
        lienzo.alpha_composite(im, (c * w + round(w / 2 - ancla(im)), f * h + h - MARGEN - im.height))
lienzo.save(dst / 'marco-v3.webp', 'WEBP', quality=84, method=6)
medidas['marco'] = {'archivo': '/jardin/marco-v3.webp', 'celda': [w, h], 'ancho': lienzo.width, 'alto': lienzo.height, 'filas': info}

print(json.dumps(medidas, ensure_ascii=False, indent=1))
