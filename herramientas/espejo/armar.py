"""
Arma public/espejo/cuerpo.bin para El Espejo a partir de la malla base de MakeHuman (CC0).
Pasos: cuerpo masculino promedio → pose con brazos abajo → simplificar (look facetado) →
transferir las deformaciones (peso, músculo, cara) → zonas (piel, remera, pantalón, zapatos, pelo, barba...).
Uso: python3 herramientas/espejo/armar.py   (necesita el repo de MakeHuman clonado; ver MH en mh.py)
"""
import json, struct, sys, os
import numpy as np
import trimesh, fast_simplification
sys.path.insert(0, os.path.dirname(__file__))
from mh import leer_obj, leer_target, triangulos, joint, MH

SALIDA = os.path.join(os.path.dirname(__file__), '../../public/espejo')
# ESTATUA=1 arma la versión "estatua griega": más detalle, liso, solo deformaciones de cuerpo (peso).
ESTATUA = os.environ.get('ESTATUA') == '1'
CARAS_OBJETIVO = int(os.environ.get('CARAS', '16000' if ESTATUA else '9000'))
ARCHIVO = 'estatua.bin' if ESTATUA else 'cuerpo.bin'

vs, grupos = leer_obj()
n = len(vs)
T = lambda r: leer_target(r, n)
M = 'macrodetails/universal-male-young-'
base = vs + T(M + 'averagemuscle-averageweight.target')
if ESTATUA:
    # Pecho de estatua masculina: sin "punta" y con pectoral marcado.
    base = base + T('breast/breast-point-decr.target') + 0.45 * T('torso/torso-muscle-pectoral-incr.target') + 0.3 * T('breast/breast-volume-vert-up.target')

formas = {
    'pesoMenos': T(M + 'averagemuscle-minweight.target'),
    'pesoMas': T(M + 'averagemuscle-maxweight.target'),
    'muscMenos': T(M + 'minmuscle-averageweight.target'),
    'muscMas': T(M + 'maxmuscle-averageweight.target'),
}
avg = T(M + 'averagemuscle-averageweight.target')
formas = {k: v - avg for k, v in formas.items()}
suma = lambda *rs: sum(T(r) for r in rs)
formas.update({
    'caraRedonda': T('head/head-round.target'),
    'caraCuadrada': T('head/head-square.target'),
    'caraOvalada': T('head/head-oval.target'),
    'caraTriangular': T('head/head-triangular.target'),
    'narizGrande': suma('nose/nose-scale-horiz-incr.target', 'nose/nose-scale-vert-incr.target', 'nose/nose-scale-depth-incr.target'),
    'narizChica': suma('nose/nose-scale-horiz-decr.target', 'nose/nose-scale-vert-decr.target', 'nose/nose-scale-depth-decr.target'),
    'papada': T('neck/neck-double-incr.target'),
    'menton': T('chin/chin-prominent-incr.target'),
    'mandibula': T('chin/chin-width-incr.target'),
})
# Exagerar los extremos (el "maxweight" de MakeHuman es apenas rellenito).
def mezcla(**k):
    return sum(T(r.replace('__', '/') + '.target') * w for r, w in k.items())
formas['obeso'] = mezcla(**{
    'stomach__stomach-pregnant-incr': 0.55, 'measure__measure-waist-circ-incr': 1.0, 'measure__measure-hips-circ-incr': 0.6,
    'measure__measure-bust-circ-incr': 0.55, 'measure__measure-underbust-circ-incr': 0.6, 'measure__measure-upperarm-circ-incr': 0.7,
    'measure__measure-thigh-circ-incr': 0.6, 'measure__measure-neck-circ-incr': 0.6, 'measure__measure-calf-circ-incr': 0.3,
    'bodyshapes__bodyshapes-elvs-man-apple': 0.5, 'head__head-fat-incr': 0.7,
})
formas['flaco'] = mezcla(**{
    'measure__measure-waist-circ-decr': 0.7, 'measure__measure-hips-circ-decr': 0.4, 'measure__measure-upperarm-circ-decr': 0.5,
    'measure__measure-thigh-circ-decr': 0.5, 'measure__measure-bust-circ-decr': 0.3, 'head__head-fat-decr': 0.5,
})
formas['atletico'] = mezcla(**{
    'torso__torso-muscle-pectoral-incr': 0.35, 'measure__measure-bust-circ-decr': 0.25, 'torso__torso-muscle-dorsi-incr': 0.8, 'torso__torso-vshape-incr': 0.7,
    'measure__measure-upperarm-circ-incr': 0.4, 'measure__measure-shoulder-dist-incr': 0.4, 'stomach__stomach-tone-incr': 0.6,
})

# ---------- Pose: brazos abajo y piernas más juntas ----------
J = {k: joint(base, grupos, k) for k in ['l-shoulder', 'l-elbow', 'r-shoulder', 'r-elbow', 'l-upper-leg', 'r-upper-leg', 'l-ankle', 'l-eye', 'r-eye', 'neck', 'head', 'head-2', 'jaw']}

def rot_z(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])

def suave(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

# Pesos del esqueleto de MakeHuman (CC0): cuánto sigue cada vértice a cada hueso.
_esq = json.load(open(f'{MH}/rigs/default.mhskel'))
_pes = json.load(open(f'{MH}/rigs/default_weights.mhw'))['weights']
def _descendientes(raiz):
    hijos = {}
    for nb, b in _esq['bones'].items():
        hijos.setdefault(b['parent'], []).append(nb)
    out, pila = [], [raiz]
    while pila:
        b = pila.pop(); out.append(b); pila += hijos.get(b, [])
    return out
def _peso(raiz, extra=None):
    w = np.zeros(n)
    for b in _descendientes(raiz):
        for i, v in _pes.get(b, []): w[i] += v
    for b, f in (extra or {}).items():
        for i, v in _pes.get(b, []): w[i] += v * f
    return np.clip(w, 0, 1)
def _articulacion(nombre, p):
    return p[_esq['joints'][nombre]].mean(axis=0)
PESO = {lado: {'brazo': _peso(f'upperarm01.{lado}', {f'shoulder01.{lado}': 0.25}), 'pierna': _peso(f'upperleg01.{lado}')} for lado in ('L', 'R')}

def posar(p):
    p = p.copy()
    for lado, sg in (('L', 1), ('R', -1)):
        h = _articulacion(f'upperarm01.{lado}____head', p)
        w = PESO[lado]['brazo']
        R = rot_z(-sg * np.radians(44))
        p = p + (((p - h) @ R.T + h) - p) * w[:, None]
        c = _articulacion(f'upperleg01.{lado}____head', p)
        w2 = PESO[lado]['pierna']
        R2 = rot_z(-sg * np.radians(6))
        p = p + (((p - c) @ R2.T + c) - p) * w2[:, None]
    return p

caras_cuerpo = triangulos(grupos['body'])
usados = np.unique(caras_cuerpo)
mapa = -np.ones(n, dtype=int); mapa[usados] = np.arange(len(usados))
tri = mapa[caras_cuerpo]
P0 = posar(base)[usados]
D = {k: posar(base + d)[usados] - P0 for k, d in formas.items()}
Jsin = dict(J)
_posada = posar(base)
J = {k: joint(_posada, grupos, k) for k in J}

# ---------- Simplificar (facetado tipo papel) ----------
pts, fs = fast_simplification.simplify(P0.astype(np.float32), tri.astype(np.int32), target_count=CARAS_OBJETIVO)
orig = trimesh.Trimesh(P0, tri, process=False)
simp = trimesh.Trimesh(pts, fs, process=False)
print('caras', len(fs), 'vértices', len(pts))

# Transferir deformaciones: punto más cercano en la malla original (baricéntrico).
cerca, _, tid = trimesh.proximity.closest_point(orig, pts)
bar = trimesh.triangles.points_to_barycentric(orig.triangles[tid], cerca)
def transferir(d):
    return (d[tri[tid]] * bar[:, :, None]).sum(axis=1)
DS = {k: transferir(d) for k, d in D.items()}
# Coordenadas sin posar (pose A original): sirven para separar bien brazos, manos y piernas al pintar zonas.
U0 = transferir(base[usados])
# Pesos de brazo y antebrazo (del esqueleto) en la malla simplificada
_brazo = transferir(np.stack([PESO['L']['brazo'] + PESO['R']['brazo']] * 3, 1)[usados])[:, 0]
_ante = transferir(np.stack([_peso('lowerarm01.L') + _peso('lowerarm01.R')] * 3, 1)[usados])[:, 0]

# ---------- Ojos (icosferas) ----------
ojos_v, ojos_f = [], []
for lado in ('l', 'r'):
    s = trimesh.creation.icosphere(subdivisions=1, radius=0.135)
    v = s.vertices * np.array([1.0, 0.75, 0.55]) + J[f'{lado}-eye'] + np.array([0, 0, 0.0])
    ojos_f.append(s.faces + len(pts) + sum(len(x) for x in ojos_v)); ojos_v.append(v)
ojos_v = np.vstack(ojos_v); ojos_f = np.vstack(ojos_f)
# los ojos siguen a la cara
_, _, tid2 = trimesh.proximity.closest_point(orig, ojos_v)
bar2 = np.full((len(ojos_v), 3), 1 / 3)
for k in DS:
    DS[k] = np.vstack([DS[k], (D[k][tri[tid2]] * bar2[:, :, None]).sum(axis=1)])
V = np.vstack([pts, ojos_v]); F = np.vstack([fs, ojos_f])
U = np.vstack([U0, ojos_v])
W_brazo = np.concatenate([_brazo, np.zeros(len(ojos_v))])
W_ante = np.concatenate([_ante, np.zeros(len(ojos_v))])
n_cuerpo = len(fs)

# ---------- Zonas por cara ----------
ZONAS = ['piel', 'remera', 'pantalon', 'zapato', 'ojo', 'ceja', 'labio']
c = U[F].mean(axis=1)
zona = np.zeros(len(F), dtype=np.uint8)
x, y, z = c[:, 0], c[:, 1], c[:, 2]
ax = np.abs(x)
# En pose A: el brazo es lo que queda afuera de la línea hombro-axila.
sh = Jsin['l-shoulder']; el = Jsin['l-elbow']
eje = el - sh; largo = np.linalg.norm(eje); eje = eje / largo
tl = ((np.stack([ax, y, z], 1) - sh) @ eje) / largo
wb = W_brazo[F].mean(axis=1); wa = W_ante[F].mean(axis=1)
es_brazo = wb > 0.5
remera = (y > 0.75) & (y < 5.6) & ~es_brazo
remera |= es_brazo & (tl < 0.42) & (wa < 0.2)
remera &= ~((y > 5.2) & (z > 0.45) & (ax < 0.8))  # escote
pantalon = (y <= 0.75) & (y > -7.25) & ~es_brazo
zapato = (y <= -7.25)
zona[remera] = 1; zona[pantalon] = 2; zona[zapato] = 3
zona[n_cuerpo:] = 4
# Suavizar bordes de la ropa: cada cara toma la zona de la mayoría de sus vecinas (2 pasadas).
from collections import Counter
vecinas = [[] for _ in range(n_cuerpo)]
por_arista = {}
for i, f in enumerate(F[:n_cuerpo]):
    for a, b in ((f[0], f[1]), (f[1], f[2]), (f[2], f[0])):
        por_arista.setdefault((min(a, b), max(a, b)), []).append(i)
for caras_a in por_arista.values():
    for i in caras_a:
        vecinas[i] += [j for j in caras_a if j != i]
for _ in range(2):
    nueva = zona.copy()
    for i in range(n_cuerpo):
        if zona[i] > 3: continue
        cuenta = Counter(zona[j] for j in vecinas[i] if zona[j] <= 3)
        if cuenta:
            z_mas, veces = cuenta.most_common(1)[0]
            if veces >= 2 and z_mas != zona[i]: nueva[i] = z_mas
    zona = nueva
for lado in (1, -1):
    ojo = Jsin['l-eye'] * np.array([lado, 1, 1])
    ceja = ((x - lado * 0.37) / 0.16) ** 2 + ((y - 7.545) / 0.045) ** 2 < 1
    sel = ceja & (z > ojo[2] - 0.02) & (np.abs(x) > 0.17)
    sel[n_cuerpo:] = False
    zona[sel] = 5
labio = ((x / 0.24) ** 2 + ((y - 6.62) / 0.07) ** 2 < 1) & (z > 1.3)
labio[n_cuerpo:] = False
zona[labio] = 6

# ---------- Máscaras para pelo y barba (por vértice) ----------
vx, vy, vz = U[:, 0], U[:, 1], U[:, 2]
cab = J['head']
pelo = (vy > 7.62) | ((vy > 6.55) & (vz < 0.55)) 
pelo &= ~((np.abs(vx) > 0.78) & (vy < 7.45) & (vz > -0.35))  # orejas
pelo &= ~((vz > 0.9) & (vy < 7.82))  # frente
pelo &= vy > 6.4
pelo[len(pts):] = False
barba = (vz > 0.25) & (vy > 6.1) & (vy < 6.95) & (np.abs(vx) < 0.8)
barba &= ~((vy > 6.48) & (vy < 6.76) & (np.abs(vx) < 0.36) & (vz > 1.15))  # boca libre
barba[len(pts):] = False

def capa(mascara, nombre):
    """Cáscara (pelo o barba): caras cuyos 3 vértices están en la máscara, más el borde para cerrarla."""
    caras = F[:n_cuerpo][mascara[F[:n_cuerpo]].all(axis=1)]
    aristas = {}
    for f in caras:
        for a, b in ((f[0], f[1]), (f[1], f[2]), (f[2], f[0])):
            k = (min(a, b), max(a, b))
            aristas[k] = aristas.get(k, 0) + 1
    borde = set()
    for f in caras:
        for a, b in ((f[0], f[1]), (f[1], f[2]), (f[2], f[0])):
            if aristas[(min(a, b), max(a, b))] == 1:
                borde.add((a, b))
    print(nombre, 'caras', len(caras), 'borde', len(borde))
    return {'caras': caras.flatten().tolist(), 'borde': [i for e in borde for i in e]}

capas = {'pelo': capa(pelo, 'pelo'), 'barba': capa(barba, 'barba')}
if ESTATUA:
    # Banda del manto: cruza el torso del hombro izquierdo a la cadera derecha (adelante y atrás).
    a = np.array([1.35, 5.35]); b = np.array([-1.25, 0.9])
    d = (b - a) / np.linalg.norm(b - a); nrm = np.array([-d[1], d[0]])
    dist = (np.stack([vx, vy], 1) - (a + b) / 2) @ nrm
    banda = (np.abs(dist) < 0.5) & (vy > 0.7) & (vy < 5.7) & (W_brazo < 0.35)
    banda[len(pts):] = False
    capas['banda'] = capa(banda, 'banda')
    # Sin ojos pintados: en las estatuas el ojo es del mismo mármol.
    formas_estatua = ['pesoMenos', 'pesoMas', 'muscMenos', 'muscMas', 'obeso', 'flaco', 'atletico', 'papada']
    DS = {k: v for k, v in DS.items() if k in formas_estatua}

# ---------- Guardar ----------
os.makedirs(SALIDA, exist_ok=True)
nombres = list(DS.keys())
escala = {k: float(np.abs(DS[k]).max() / 32767 or 1) for k in nombres}
meta = {
    'vertices': len(V), 'caras': len(F), 'zonas': ZONAS, 'formas': [{'nombre': k, 'escala': escala[k]} for k in nombres],
    'capas': {k: {'caras': len(v['caras']), 'borde': len(v['borde'])} for k, v in capas.items()},
    'altura': float(V[:, 1].max() - V[:, 1].min()), 'piso': float(V[:, 1].min()),
    'puntos': {k: [round(float(a), 4) for a in v] for k, v in J.items()},
}
cab = json.dumps(meta).encode()
brazo_v = (W_brazo > 0.5).astype('<u1')
meta['brazo'] = True
with open(f'{SALIDA}/{ARCHIVO}', 'wb') as f:
    f.write(struct.pack('<I', len(cab))); f.write(cab)
    f.write(b'\0' * ((4 - (4 + len(cab)) % 4) % 4))
    f.write(V.astype('<f4').tobytes())
    f.write(F.astype('<u2').tobytes())
    f.write(zona.astype('<u1').tobytes())
    f.write(b'\0' * ((4 - len(F) % 4) % 4))
    for k in nombres:
        f.write(np.round(DS[k] / escala[k]).astype('<i2').tobytes())
    for k in capas:
        f.write(np.array(capas[k]['caras'], dtype='<u2').tobytes())
        f.write(np.array(capas[k]['borde'], dtype='<u2').tobytes())
    f.write(brazo_v.tobytes())
print('listo', ARCHIVO, os.path.getsize(f'{SALIDA}/{ARCHIVO}') // 1024, 'KB')
