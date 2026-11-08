import { Document, NodeIO } from '@gltf-transform/core';
import fs from 'fs';
const T = process.argv[2];
const NOMBRES = ['lean','heavy_muscular','bodybuilder','stocky','overweight','obese','extra_obese'];
const f32 = (p) => { const b = fs.readFileSync(p); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4).slice(); };
const v = f32(T + '/base_v.bin');
const fb = fs.readFileSync(T + '/base_f.bin'); const f = new Uint32Array(fb.buffer, fb.byteOffset, fb.byteLength / 4).slice();
const doc = new Document(); const buf = doc.createBuffer();
const pos = doc.createAccessor('position').setType('VEC3').setArray(v).setBuffer(buf);
const idx = doc.createAccessor('indices').setType('SCALAR').setArray(f).setBuffer(buf);
const nor = doc.createAccessor('normal').setType('VEC3').setArray(f32(T + '/base_n.bin')).setBuffer(buf);
const prim = doc.createPrimitive().setAttribute('POSITION', pos).setIndices(idx);
for (const n of NOMBRES) {
  const t = doc.createPrimitiveTarget(n).setAttribute('POSITION', doc.createAccessor(n).setType('VEC3').setArray(f32(`${T}/m_${n}.bin`)).setBuffer(buf));
  prim.addTarget(t);
}
const mesh = doc.createMesh('estatua').addPrimitive(prim).setWeights(NOMBRES.map(() => 0)).setExtras({ targetNames: NOMBRES });
doc.createScene().addChild(doc.createNode('estatua').setMesh(mesh));
await new NodeIO().write(process.argv[3], doc);
