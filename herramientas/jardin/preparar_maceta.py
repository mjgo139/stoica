"""Prepara la maceta de frente (generada con ChatGPT, ver PROMPTS.md → "Maceta de frente").

- Recorta el espacio transparente.
- La suaviza un poco (menos nitidez, contraste y saturación) para que combine con el fondo pintado.
- Mide dónde está la tierra (en % de la maceta) para disposicion.ts → MACETA.tierra.

Uso: python3 -I herramientas/jardin/preparar_maceta.py ORIGEN.png SALIDA_WEB.webp SALIDA_WIDGET.webp
"""
import sys
from PIL import Image, ImageEnhance, ImageFilter

ANCHO = 480


def suavizar(im: Image.Image) -> Image.Image:
    rgb, a = im.convert('RGB'), im.getchannel('A')
    rgb = rgb.filter(ImageFilter.GaussianBlur(0.7))
    rgb = ImageEnhance.Contrast(rgb).enhance(0.9)
    rgb = ImageEnhance.Color(rgb).enhance(0.88)
    # Un toque cálido, como la luz de la terraza
    r, g, b = rgb.split()
    r = r.point(lambda v: min(255, int(v * 1.02)))
    b = b.point(lambda v: int(v * 0.96))
    rgb = Image.merge('RGB', (r, g, b))
    out = rgb.convert('RGBA')
    out.putalpha(a.filter(ImageFilter.GaussianBlur(0.4)))
    return out


def tierra(im: Image.Image):
    """Caja de la tierra: píxeles marrón oscuro (rojo > verde > azul y poco brillo)."""
    px = im.load()
    w, h = im.size
    xs, ys = [], []
    for y in range(int(h * 0.6)):  # la guarda dorada de abajo no cuenta
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 200 and r < 150 and r > g * 1.25 and g >= b and r + g + b < 330:
                xs.append(x)
                ys.append(y)
    xs.sort(); ys.sort()
    q = lambda v, f: v[int(len(v) * f)]
    x0, x1, y0, y1 = q(xs, 0.01), q(xs, 0.99), q(ys, 0.01), q(ys, 0.99)
    return ((x0 + x1) / 2 / w * 100, (y0 + y1) / 2 / h * 100, (x1 - x0) / w * 100, (y1 - y0) / h * 100)


def main(origen: str, web: str, widget: str) -> None:
    im = Image.open(origen).convert('RGBA')
    im = im.crop(im.getchannel('A').getbbox())
    alto = round(ANCHO * im.height / im.width)
    im = im.resize((ANCHO, alto), Image.LANCZOS)
    t = tierra(im)
    im = suavizar(im)
    im.save(web, 'WEBP', quality=88, method=6)
    im.resize((240, round(240 * alto / ANCHO)), Image.LANCZOS).save(widget, 'WEBP', quality=85, method=6)
    print(f"w: {ANCHO}, h: {alto}, tierra: {{ x: {t[0]:.1f}, y: {t[1]:.1f}, w: {t[2]:.1f}, h: {t[3]:.1f} }}")


if __name__ == '__main__':
    main(*sys.argv[1:4])
