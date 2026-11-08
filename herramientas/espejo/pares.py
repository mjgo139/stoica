"""Ajusta cada estatua sobre sus vecinas (en los dos sentidos). Guarda, por estatua, su malla normalizada
y un desplazamiento hacia cada vecina."""
import sys, numpy as np, trimesh, scipy.sparse as sp, os
from scipy.spatial import cKDTree
D = os.environ.get('MODELOS', 'modelos/')
OUT = os.environ.get('SALIDA', 'salida/')
os.makedirs(OUT, exist_ok=True)
PARES = [('lean','athletic'),('athletic','normal'),('normal','rellenito'),('rellenito','sobrepeso'),('sobrepeso','obeso'),('obeso','muy_obeso'),('athletic','musculoso'),('musculoso','bodybuilder')]

def cargar(n):
    m = trimesh.load(D + n + '.s.glb', force='mesh')
    v = m.vertices.copy(); lo, hi = v.min(0), v.max(0)
    v -= [(lo[0]+hi[0])/2, lo[1], (lo[2]+hi[2])/2]; v *= 10 / (hi[1]-lo[1])
    return trimesh.Trimesh(v, m.faces, process=False)

mallas = {}
def malla(n):
    if n not in mallas:
        m = cargar(n); mallas[n] = m
        m.vertices.astype('<f4').tofile(OUT + f'{n}_v.bin'); m.faces.astype('<u4').tofile(OUT + f'{n}_f.bin')
    return mallas[n]

def suavizador(F, n):
    e = np.vstack([F[:, [0,1]], F[:, [1,2]], F[:, [2,0]]])
    A = sp.coo_matrix((np.ones(len(e)*2), (np.r_[e[:,0], e[:,1]], np.r_[e[:,1], e[:,0]])), shape=(n, n)).tocsr(); A.data[:] = 1
    deg = np.asarray(A.sum(1)).ravel(); deg[deg == 0] = 1
    M = sp.diags(1/deg) @ A
    def s(d, k):
        for _ in range(k): d = 0.5*d + 0.5*(M @ d)
        return d
    return s

def ajustar(a, b):
    base, t = malla(a), malla(b)
    V0, F = base.vertices.copy(), base.faces; n = len(V0)
    suavizar = suavizador(F, n)
    pts, fi = trimesh.sample.sample_surface(t, 1200000); nt = t.face_normals[fi]
    arbol = cKDTree(pts); cur = V0.copy()
    for it, k in enumerate([300, 150, 80, 40, 25, 15, 10, 10]):
        nc = trimesh.Trimesh(cur, F, process=False).vertex_normals
        dist, idx = arbol.query(cur, k=8)
        cand = pts[idx]; ncand = nt[idx]
        acuerdo = np.einsum('ijk,ik->ij', ncand, nc)
        mejor = np.argmax(acuerdo - dist*0.5, axis=1)
        cp = cand[np.arange(n), mejor]; ok = acuerdo[np.arange(n), mejor] > 0.3
        d = (cp - cur) * ok[:, None]
        arbol_b = cKDTree(cur)
        sub = np.random.default_rng(it).choice(len(pts), 300000, replace=False)
        _, j = arbol_b.query(pts[sub])
        okb = np.einsum('ij,ij->i', nt[sub], nc[j]) > 0.3
        acc = np.zeros_like(cur); cnt = np.zeros(n)
        np.add.at(acc, j[okb], pts[sub][okb] - cur[j[okb]]); np.add.at(cnt, j[okb], 1)
        tiene = cnt > 0
        d[tiene] = 0.5 * d[tiene] + 0.5 * acc[tiene] / cnt[tiene, None]
        ok = ok | tiene
        w = suavizar(ok.astype(float)[:, None], k); w[w < 1e-3] = 1e-3
        cur = cur + suavizar(d, k) / w
    d = suavizar(cur - V0, 8)
    print(a, '->', b, 'listo', flush=True)
    d.astype('<f4').tofile(OUT + f'{a}__{b}.bin')

for a, b in PARES:
    ajustar(a, b); ajustar(b, a)
