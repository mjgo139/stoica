"""
Arma las hojas de animación de los filósofos del jardín (todas a la misma escala, pies a la misma altura)
y prepara la repisa y la regadera.

Uso: python3 -I herramientas/jardin/armar_filosofos.py <carpeta con marco-habla.png, marco-antorcha.png,
     epicteto.png, repisa.png, regadera.png> public/jardin
Imprime en JSON las medidas para src/screens/jardin/filosofos.ts y disposicion.ts.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

src, dst = Path(sys.argv[1]), Path(sys.argv[2])
ALTO = 220  # alto de la figura parada, en px
MARGEN = 6


def figuras(im, minfrac=0.004):
    """Figuras sueltas de una hoja (componentes grandes + pedacitos pegados a la más cercana)."""
    a = np.array(im)[:, :, 3] > 60
    lab, n = ndimage.label(ndimage.binary_closing(a, iterations=2))
    sl = ndimage.find_objects(lab)
    tam = ndimage.sum(a, lab, range(1, n + 1))
    grandes = [i for i in range(n) if tam[i] > a.sum() * minfrac]
    cajas = {i: [sl[i][1].start, sl[i][0].start, sl[i][1].stop, sl[i][0].stop] for i in grandes}
    duenio = {i: i for i in grandes}
    for i in range(n):
        if i in cajas or tam[i] < 15:
            continue
        cy, cx = (sl[i][0].start + sl[i][0].stop) / 2, (sl[i][1].start + sl[i][1].stop) / 2
        j = min(grandes, key=lambda g: max(0, cajas[g][0] - cx, cx - cajas[g][2]) ** 2 + max(0, cajas[g][1] - cy, cy - cajas[g][3]) ** 2)
        if max(0, cajas[j][0] - cx, cx - cajas[j][2]) + max(0, cajas[j][1] - cy, cy - cajas[j][3]) > 40:
            continue
        duenio[i] = j
        c = cajas[j]
        cajas[j] = [min(c[0], sl[i][1].start), min(c[1], sl[i][0].start), max(c[2], sl[i][1].stop), max(c[3], sl[i][0].stop)]
    arr = np.array(im)
    out = []
    for g in grandes:
        x0, y0, x1, y1 = cajas[g]
        ids = [i + 1 for i, d in duenio.items() if d == g]
        m = np.isin(lab[y0:y1, x0:x1], ids)
        recorte = arr[y0:y1, x0:x1].copy()
        recorte[~m, 3] = 0
        out.append({'x': (x0 + x1) / 2, 'y': (y0 + y1) / 2, 'im': Image.fromarray(recorte, 'RGBA')})
    return out


def en_filas(figs, n_filas):
    figs = sorted(figs, key=lambda f: f['y'])
    # agrupar por y
    filas, actual = [], [figs[0]]
    for f in figs[1:]:
        if abs(f['y'] - np.mean([g['y'] for g in actual])) < figs[0]['im'].height * 0.4:
            actual.append(f)
        else:
            filas.append(actual)
            actual = [f]
    filas.append(actual)
    assert len(filas) == n_filas, f'esperaba {n_filas} filas y hay {len(filas)}'
    return [[f['im'] for f in sorted(fila, key=lambda f: f['x'])] for fila in filas]


def ancla(im):
    """x de los pies: centro de la masa en el 30 % de abajo."""
    a = np.array(im)[:, :, 3] > 60
    abajo = a[int(im.height * 0.7):, :]
    xs = np.nonzero(abajo)[1]
    return float(xs.mean()) if len(xs) else im.width / 2


def hoja(secuencias, escala_por_seq, nombre):
    """secuencias: {nombre: [imágenes]}; arma una fila por secuencia con celdas iguales."""
    escaladas = {}
    for k, ims in secuencias.items():
        e = escala_por_seq[k]
        escaladas[k] = [im.resize((max(1, round(im.width * e)), max(1, round(im.height * e))), Image.LANCZOS) for im in ims]
    medio = 0
    alto = 0
    for ims in escaladas.values():
        for im in ims:
            ax = ancla(im)
            medio = max(medio, ax, im.width - ax)
            alto = max(alto, im.height)
    w = int(np.ceil(medio * 2)) + MARGEN * 2
    h = alto + MARGEN * 2
    cols = max(len(v) for v in escaladas.values())
    lienzo = Image.new('RGBA', (w * cols, h * len(escaladas)), (0, 0, 0, 0))
    filas = {}
    for f, (k, ims) in enumerate(escaladas.items()):
        filas[k] = {'fila': f, 'cuadros': len(ims)}
        for c, im in enumerate(ims):
            x = c * w + round(w / 2 - ancla(im))
            y = f * h + h - MARGEN - im.height
            lienzo.alpha_composite(im, (x, y))
    lienzo.save(dst / nombre, 'WEBP', quality=84, method=6)
    return {'archivo': f'/jardin/{nombre}', 'celda': [w, h], 'columnas': cols, 'ancho': lienzo.width, 'alto': lienzo.height, 'filas': filas}


medidas = {}

# ----- Marco: camina (hoja vieja 3×4), habla (2×4), antorcha (3) -----
vieja = Image.open(dst / 'marco-4dir.webp').convert('RGBA')
caminar = [[vieja.crop((c * 157, f * 224, (c + 1) * 157, (f + 1) * 224)) for c in range(3)] for f in range(4)]
caminar = [[im.crop(im.getbbox()) for im in fila] for fila in caminar]
alto_cam = caminar[0][1].height
habla = en_filas(figuras(Image.open(src / 'marco-habla.png').convert('RGBA')), 4)
antorcha = en_filas(figuras(Image.open(src / 'marco-antorcha.png').convert('RGBA')), 1)[0]
DIRS = ['abajo', 'izquierda', 'derecha', 'arriba']
seqs, esc = {}, {}
for i, d in enumerate(DIRS):
    seqs[f'caminar_{d}'] = caminar[i]
    esc[f'caminar_{d}'] = ALTO / alto_cam
for i, d in enumerate(DIRS):
    seqs[f'hablar_{d}'] = habla[i]
    esc[f'hablar_{d}'] = ALTO / np.median([im.height for im in habla[i]])
seqs['antorcha'] = antorcha
esc['antorcha'] = ALTO / antorcha[0].height
medidas['marco'] = hoja(seqs, esc, 'marco-v2.webp')

# ----- Epicteto: camina 6 cuadros × 4 direcciones y habla 5 cuadros (de frente) -----
filas = en_filas(figuras(Image.open(src / 'epicteto.png').convert('RGBA')), 5)
seqs, esc = {}, {}
ALTO_E = ALTO * 0.94  # un poco más bajo que Marco
for i, d in enumerate(DIRS):
    seqs[f'caminar_{d}'] = filas[i]
    esc[f'caminar_{d}'] = ALTO_E / np.median([im.height for im in filas[i]])
seqs['hablar_abajo'] = filas[4]
esc['hablar_abajo'] = ALTO_E / np.median([im.height for im in filas[4]])
medidas['epicteto'] = hoja(seqs, esc, 'epicteto-v1.webp')

# ----- Repisa (2 filas × 9 nichos) -----
rep = Image.open(src / 'repisa.png').convert('RGBA')
rep = rep.crop(rep.getbbox())
rep.thumbnail((1400, 1400), Image.LANCZOS)
rep.save(dst / 'repisa-v1.webp', 'WEBP', quality=84, method=6)
medidas['repisa'] = {'w': rep.width, 'h': rep.height}

# ----- Regadera -----
reg = Image.open(src / 'regadera.png').convert('RGBA')
reg = reg.crop(reg.getbbox())
reg.thumbnail((360, 360), Image.LANCZOS)
reg.save(dst / 'regadera-v1.webp', 'WEBP', quality=84, method=6)
medidas['regadera'] = {'w': reg.width, 'h': reg.height}

print(json.dumps(medidas, indent=1))
