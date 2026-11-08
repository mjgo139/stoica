/**
 * El Espejo · Estatua viva: UNA estatua de Meshy (la Atlética) que se deforma de forma continua hacia las
 * otras 7 que hiciste en Meshy. Las deformaciones (morphs) se calcularon ajustando la Atlética sobre cada una
 * (herramientas/espejo/transplante.py): solo se transfiere el volumen; la cara, el pelo y la tela quedan nítidos.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { vetas } from './marmol';

const ARCHIVO = '/espejo/marmol/estatua-viva.glb';

/** Etapas del eje de peso (en orden) y del eje de músculo. '' = la estatua base (Atlética). */
export const ETAPAS_PESO = [
  { morph: 'lean', nombre: 'Delgado' },
  { morph: '', nombre: 'Atlético' },
  { morph: 'stocky', nombre: 'Fornido' },
  { morph: 'overweight', nombre: 'Con sobrepeso' },
  { morph: 'obese', nombre: 'Obeso' },
  { morph: 'extra_obese', nombre: 'Muy obeso' },
];
export const ETAPAS_MUSCULO = [
  { morph: '', nombre: 'Normal' },
  { morph: 'heavy_muscular', nombre: 'Musculoso' },
  { morph: 'bodybuilder', nombre: 'Fisicoculturista' },
];

export interface Forma {
  /** 0 a 1 a lo largo de ETAPAS_PESO */
  peso: number;
  /** 0 a 1 a lo largo de ETAPAS_MUSCULO */
  musculo: number;
}
export const FORMA_INICIAL: Forma = { peso: 0.2, musculo: 0 };

/** Pesos de cada morph para un punto de un eje (interpolación entre las dos etapas vecinas). */
function mezcla(etapas: { morph: string }[], x: number, w: Map<string, number>) {
  const t = Math.min(1, Math.max(0, x)) * (etapas.length - 1);
  const i = Math.min(etapas.length - 2, Math.floor(t));
  const f = t - i;
  const sumar = (m: string, v: number) => m && v > 0 && w.set(m, (w.get(m) ?? 0) + v);
  sumar(etapas[i].morph, 1 - f);
  sumar(etapas[i + 1].morph, f);
}

export const nombreDe = (etapas: { nombre: string }[], x: number) => etapas[Math.round(Math.min(1, Math.max(0, x)) * (etapas.length - 1))].nombre;

interface Datos {
  base: Float32Array;
  morphs: Map<string, Float32Array>;
  indice: THREE.BufferAttribute;
}

let cache: Promise<Datos> | null = null;
function cargar(): Promise<Datos> {
  if (cache) return cache;
  const cargador = new GLTFLoader();
  cargador.setMeshoptDecoder(MeshoptDecoder);
  cache = cargador.loadAsync(ARCHIVO).then((gltf) => {
    let malla: THREE.Mesh | null = null;
    gltf.scene.traverse((o) => {
      if (!malla && o instanceof THREE.Mesh) malla = o;
    });
    if (!malla) throw new Error('sin malla');
    const m = malla as THREE.Mesh;
    const g = m.geometry as THREE.BufferGeometry;
    // Las posiciones vienen comprimidas (enteros): se pasan a decimales.
    const aFloat = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
      const out = new Float32Array(a.count * 3);
      for (let i = 0; i < a.count; i++) for (let k = 0; k < 3; k++) out[i * 3 + k] = a.getComponent(i, k);
      return out;
    };
    // La compresión guarda una escala/desplazamiento en el nodo: se aplica a la base (completa) y a los morphs (solo escala).
    gltf.scene.updateMatrixWorld(true);
    const mat = m.matrixWorld;
    const lineal = new THREE.Matrix3().setFromMatrix4(mat);
    const v = new THREE.Vector3();
    const transformar = (a: Float32Array, completa: boolean) => {
      for (let i = 0; i < a.length; i += 3) {
        v.set(a[i], a[i + 1], a[i + 2]);
        if (completa) v.applyMatrix4(mat);
        else v.applyMatrix3(lineal);
        a[i] = v.x;
        a[i + 1] = v.y;
        a[i + 2] = v.z;
      }
      return a;
    };
    const base = transformar(aFloat(g.getAttribute('position')), true);
    const nombres: string[] = (m.geometry.userData.targetNames as string[] | undefined) ?? (m.userData.targetNames as string[] | undefined) ?? Object.keys(m.morphTargetDictionary ?? {});
    const morphs = new Map<string, Float32Array>();
    const lista = g.morphAttributes.position ?? [];
    const dic = m.morphTargetDictionary ?? {};
    for (const n of nombres) {
      const i = dic[n];
      if (i !== undefined && lista[i]) morphs.set(n, transformar(aFloat(lista[i]), false));
    }
    return { base, morphs, indice: g.getIndex()!.clone() };
  });
  cache.catch(() => (cache = null));
  return cache;
}

export interface EscenaViva {
  actualizar(f: Forma): void;
  enfocar(v: 'cuerpo' | 'cara'): void;
  destruir(): void;
}

const ALTO = 10;

export async function crearViva(lienzo: HTMLCanvasElement, inicial: Forma): Promise<EscenaViva> {
  const d = await cargar();
  const render = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true });
  render.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  render.shadowMap.enabled = true;
  render.shadowMap.type = THREE.PCFSoftShadowMap;
  render.outputColorSpace = THREE.SRGBColorSpace;
  render.toneMapping = THREE.ACESFilmicToneMapping;
  render.toneMappingExposure = 1.1;

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  escena.add(new THREE.HemisphereLight(0xfff3e2, 0x2a2420, 0.85));
  const clave = new THREE.DirectionalLight(0xffe3c2, 3.0);
  clave.position.set(-8, 12, 9);
  clave.castShadow = true;
  clave.shadow.mapSize.set(2048, 2048);
  Object.assign(clave.shadow.camera, { left: -14, right: 14, top: 16, bottom: -8, near: 1, far: 60 });
  clave.shadow.normalBias = 0.02;
  escena.add(clave);
  const contra = new THREE.DirectionalLight(0xbfd0ff, 1.5);
  contra.position.set(8, 6, -8);
  escena.add(contra);
  const relleno = new THREE.DirectionalLight(0xffffff, 0.4);
  relleno.position.set(6, 3, 10);
  escena.add(relleno);
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.32 }));
  piso.rotation.x = -Math.PI / 2;
  piso.receiveShadow = true;
  escena.add(piso);

  // Geometría propia: la deformación se calcula en el celular cuando movés el deslizante.
  const pos = new Float32Array(d.base);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(d.indice);
  g.computeVertexNormals();
  vetas(g);
  const malla = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.5 }));
  malla.castShadow = true;
  malla.receiveShadow = true;
  escena.add(malla);

  const actualizar = (f: Forma) => {
    const w = new Map<string, number>();
    mezcla(ETAPAS_PESO, f.peso, w);
    mezcla(ETAPAS_MUSCULO, f.musculo, w);
    pos.set(d.base);
    for (const [n, v] of w) {
      const m = d.morphs.get(n);
      if (!m) continue;
      for (let i = 0; i < pos.length; i++) pos[i] += m[i] * v;
    }
    g.getAttribute('position').needsUpdate = true;
    g.computeVertexNormals();
    g.computeBoundingSphere();
  };
  actualizar(inicial);

  let vista: 'cuerpo' | 'cara' = 'cuerpo';
  const controles = new OrbitControls(camara, lienzo);
  controles.enableDamping = true;
  controles.dampingFactor = 0.08;
  controles.enablePan = false;
  controles.minDistance = 2.5;
  controles.maxDistance = 45;
  controles.minPolarAngle = 0.15;
  controles.maxPolarAngle = Math.PI * 0.53;
  const ubicar = () => {
    if (vista === 'cara') {
      const dist = Math.max(6.5, 6.5 * (0.75 / camara.aspect));
      controles.target.set(0, ALTO * 0.86, 0);
      camara.position.set(dist * 0.35, ALTO * 0.88, dist * 0.94);
    } else {
      const dist = Math.max(25, 25 * (0.72 / camara.aspect));
      controles.target.set(0, ALTO * 0.46, 0);
      camara.position.set(dist * 0.38, ALTO * 0.55, dist * 0.92);
    }
    controles.update();
  };
  const ajustar = () => {
    const ancho = lienzo.clientWidth || 300;
    const alto = lienzo.clientHeight || 400;
    render.setSize(ancho, alto, false);
    camara.aspect = ancho / alto;
    camara.updateProjectionMatrix();
  };
  ajustar();
  ubicar();
  const obs = new ResizeObserver(ajustar);
  obs.observe(lienzo);

  let cuadro = 0;
  const animar = () => {
    controles.update();
    render.render(escena, camara);
    cuadro = requestAnimationFrame(animar);
  };
  cuadro = requestAnimationFrame(animar);

  return {
    actualizar,
    enfocar(v) {
      vista = v;
      ubicar();
    },
    destruir() {
      cancelAnimationFrame(cuadro);
      obs.disconnect();
      controles.dispose();
      g.dispose();
      (malla.material as THREE.Material).dispose();
      render.dispose();
    },
  };
}
