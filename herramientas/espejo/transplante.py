"""Transplante: deforma la estatua base (Atlética) hasta calzar en cada otra estatua de Meshy.
Ajuste no rígido simple: punto más cercano + suavizado fuerte del desplazamiento, de grueso a fino."""
import sys, numpy as np, trimesh, scipy.sparse as sp
from scipy.spatial import cKDTree
import os
D = os.environ.get('MODELOS', 'modelos/')  # carpeta con <nombre>.s.glb (ya simplificados)
OUT = os.environ.get('SALIDA', 'salida/')

def cargar(n):
    m = trimesh.load(D + n + '.s.glb', force='mesh')
    v = m.vertices.copy()
    lo, hi = v.min(0), v.max(0)
    v -= [(lo[0]+hi[0])/2, lo[1], (lo[2]+hi[2])/2]
    v *= 10 / (hi[1]-lo[1])
    return trimesh.Trimesh(v, m.faces, process=False)

base = cargar('athletic')
V0 = base.vertices.copy(); F = base.faces
n = len(V0)
# adyacencia
e = np.vstack([F[:, [0,1]], F[:, [1,2]], F[:, [2,0]]])
A = sp.coo_matrix((np.ones(len(e)*2), (np.r_[e[:,0], e[:,1]], np.r_[e[:,1], e[:,0]])), shape=(n, n)).tocsr()
A.data[:] = 1
deg = np.asarray(A.sum(1)).ravel(); deg[deg == 0] = 1
M = sp.diags(1/deg) @ A
def suavizar(d, k):
    for _ in range(k): d = 0.5*d + 0.5*(M @ d)
    return d

np.save(OUT + 'base_v.npy', V0); np.save(OUT + 'base_f.npy', F)
for nombre in sys.argv[1:]:
    t = cargar(nombre)
    pts, fi = trimesh.sample.sample_surface(t, 1200000)
    nt = t.face_normals[fi]
    arbol = cKDTree(pts)
    cur = V0.copy()
    for it, (k, paso) in enumerate([(400,1),(250,1),(150,1),(100,1),(70,1),(50,1),(40,1),(40,1)]):
        cm = trimesh.Trimesh(cur, F, process=False)
        nc = cm.vertex_normals
        dist, idx = arbol.query(cur, k=8)
        # elegir, entre los 8 vecinos, el que tenga la normal más parecida
        cand = pts[idx]; ncand = nt[idx]
        acuerdo = np.einsum('ijk,ik->ij', ncand, nc)
        mejor = np.argmax(acuerdo - dist*0.5, axis=1)
        cp = cand[np.arange(n), mejor]
        ok = acuerdo[np.arange(n), mejor] > 0.3
        d = (cp - cur) * ok[:, None]
        # Al revés: cada punto de la estatua destino tira del punto más cercano de la base (así ningún brazo queda "sin dueño").
        arbol_b = cKDTree(cur)
        sub = np.random.default_rng(it).choice(len(pts), 300000, replace=False)
        dist_b, j = arbol_b.query(pts[sub])
        okb = np.einsum('ij,ij->i', nt[sub], nc[j]) > 0.3
        acc = np.zeros_like(cur); cnt = np.zeros(n)
        np.add.at(acc, j[okb], pts[sub][okb] - cur[j[okb]])
        np.add.at(cnt, j[okb], 1)
        tiene = cnt > 0
        d[tiene] = 0.5 * d[tiene] + 0.5 * acc[tiene] / cnt[tiene, None]
        ok = ok | tiene
        w = suavizar(ok.astype(float)[:, None], k); w[w < 1e-3] = 1e-3
        d = suavizar(d, k) / w
        cur = cur + paso * d
        err = np.median(np.linalg.norm(cp - cur, axis=1))
        print(nombre, it, 'error mediano', round(float(err), 4), flush=True)
    d = suavizar(cur - V0, 25)
    # La cabeza no se deforma (cara y rulos intactos): solo acompaña al cuello.
    y = V0[:, 1]
    cuello = (y > 8.15) & (y < 8.4)
    t = np.clip((y - 8.4) / 0.3, 0, 1)[:, None]
    d = (1 - t) * d + t * d[cuello].mean(0)
    np.save(OUT + f'morph_{nombre}.npy', d.astype(np.float32))
