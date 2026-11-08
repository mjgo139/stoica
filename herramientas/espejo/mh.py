"""Lectura de la malla base de MakeHuman (CC0) y sus targets."""
import numpy as np, os
MH = '/home/claude/makehumancommunity/makehuman/makehuman/data'

def leer_obj():
    vs = []; caras = {}; grupo = None
    with open(f'{MH}/3dobjs/base.obj') as f:
        for l in f:
            if l.startswith('v '):
                vs.append([float(x) for x in l.split()[1:4]])
            elif l.startswith('g '):
                grupo = l.split()[1]
            elif l.startswith('f '):
                idx = [int(p.split('/')[0]) - 1 for p in l.split()[1:]]
                caras.setdefault(grupo, []).append(idx)
    return np.array(vs, dtype=np.float64), caras

def leer_target(ruta, n):
    d = np.zeros((n, 3))
    with open(f'{MH}/targets/{ruta}') as f:
        for l in f:
            if not l.strip() or l.startswith('#'): continue
            p = l.split()
            d[int(p[0])] = [float(p[1]), float(p[2]), float(p[3])]
    return d

def triangulos(caras):
    t = []
    for c in caras:
        for k in range(1, len(c) - 1):
            t.append([c[0], c[k], c[k + 1]])
    return np.array(t)

def joint(vs, caras, nombre):
    idx = sorted({i for c in caras[f'joint-{nombre}'] for i in c})
    return vs[idx].mean(axis=0)
