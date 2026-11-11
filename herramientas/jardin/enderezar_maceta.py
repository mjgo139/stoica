"""
Endereza la maceta (public/jardin/maceta.webp): la de ChatGPT está dibujada vista desde la izquierda
(la parte de arriba corrida ~55 px a la derecha de la base y con la cara del costado visible).
Corrige la inclinación (la boca queda centrada sobre la base) y recorta la cara del costado.
Uso: python3 -I herramientas/jardin/enderezar_maceta.py public/jardin/maceta.webp public/jardin/maceta-recta.webp
"""
import sys
import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
m = Image.open(src).convert('RGBA')
w, h = m.size  # 416 × 320
BASE = 300  # fila del pie de la maceta
CORRIMIENTO = 55  # cuánto está corrida la boca respecto de la base
k = CORRIMIENTO / BASE
# x_entrada = x_salida + k·(BASE − y)
recta = m.transform((w, h), Image.AFFINE, (1, -k, CORRIMIENTO, 0, 1, 0), resample=Image.BICUBIC)
a = np.array(recta)
# Recortar la cara del costado: todo lo que queda a la derecha del borde frontal derecho
for y in range(h):
    borde = int(345 + (372 - 345) * min(1, y / BASE))
    a[y, borde:, 3] = 0
out = Image.fromarray(a, 'RGBA')
out = out.crop(out.getbbox())
# Simetría perfecta: el borde de mármol de la mitad izquierda se refleja a la derecha;
# la tierra queda la original (reflejada se vería como una mariposa).
derecha_original = out
mitad = out.width // 2
izq = out.crop((0, 0, mitad, out.height))
out = Image.new('RGBA', (mitad * 2, out.height))
out.paste(izq, (0, 0))
out.paste(izq.transpose(Image.FLIP_LEFT_RIGHT), (mitad, 0))
tierra = (40, 36, 300, 204)  # boca de la maceta (sin el borde derecho original, que quedaba corrido)
out.paste(derecha_original.crop(tierra), tierra[:2])
out.save(dst, 'WEBP', quality=84, method=6)
print(out.size)
