// Arma el GLB de una etapa: su malla + un morph hacia cada vecina. Uso: node armar-etapa.mjs <carpeta> <etapa> <vecina...> <salida.glb>
import { Document, NodeIO } from '@gltf-transform/core';
import fs from 'fs';
const [dir, etapa, ...resto] = process.argv.slice(2);
const salida = resto.pop();
const leer = (p, T) => { const b = fs.readFileSync(p); return new T(b.buffer, b.byteOffset, b.byteLength / T.BYTES_PER_ELEMENT).slice(); };
const doc = new Document(); const buf = doc.createBuffer();
const prim = doc.createPrimitive()
  .setAttribute('POSITION', doc.createAccessor('p').setType('VEC3').setArray(leer(`${dir}/${etapa}_v.bin`, Float32Array)).setBuffer(buf))
  .setIndices(doc.createAccessor('i').setType('SCALAR').setArray(leer(`${dir}/${etapa}_f.bin`, Uint32Array)).setBuffer(buf));
for (const v of resto) prim.addTarget(doc.createPrimitiveTarget(v).setAttribute('POSITION', doc.createAccessor(v).setType('VEC3').setArray(leer(`${dir}/${etapa}__${v}.bin`, Float32Array)).setBuffer(buf)));
const mesh = doc.createMesh(etapa).addPrimitive(prim).setWeights(resto.map(() => 0)).setExtras({ targetNames: resto });
doc.createScene().addChild(doc.createNode(etapa).setMesh(mesh));
await new NodeIO().write(salida, doc);
