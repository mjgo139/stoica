# El Espejo: cómo se arma el cuerpo 3D

`public/espejo/cuerpo.bin` sale de la malla humana de **MakeHuman** (assets CC0, dominio público:
https://github.com/makehumancommunity/makehuman). Para volver a generarlo:

1. Clonar MakeHuman (sin archivos grandes): `GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 https://github.com/makehumancommunity/makehuman`
2. Ajustar la ruta `MH` en `mh.py` si hace falta.
3. `pip install trimesh fast-simplification rtree scipy` y `python3 herramientas/espejo/armar.py`

El archivo trae: la malla simplificada (look facetado), las deformaciones (peso, músculo, forma de cara,
nariz, papada…), las zonas de color (piel, remera, pantalón, zapatos, ojos, cejas, labios) y las
cáscaras de pelo y barba. La app (src/screens/espejo/avatar.ts) mezcla todo en el celular.
