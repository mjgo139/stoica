/**
 * El Espejo · Estatua viva: tus 8 estatuas de Meshy unidas en un camino continuo.
 * En cada etapa se ve la estatua real de Meshy (con su cara y su cuerpo). Entre dos etapas, cada estatua se
 * deforma hacia la otra (morphs calculados ajustando una sobre otra: herramientas/espejo/pares.py) y se
 * funden a mitad de camino, así no hay saltos.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { vetas } from './marmol';

const BASE = '/espejo/viva/';

/** Camino del peso (desde Atlético hacia los dos lados) y camino del músculo (sale de Atlético). */
export const ETAPAS_PESO = [
  { id: 'lean', nombre: 'Delgado' },
  { id: 'athletic', nombre: 'Atlético' },
  { id: 'stocky', nombre: 'Fornido' },
  { id: 'overweight', nombre: 'Con sobrepeso' },
  { id: 'obese', nombre: 'Obeso' },
  { id: 'extra_obese', nombre: 'Muy obeso' },
];
export const ETAPAS_MUSCULO = [
  { id: 'athletic', nombre: 'Normal' },
  { id: 'heavy_muscular', nombre: 'Musculoso' },
  { id: 'bodybuilder', nombre: 'Fisicoculturista' },
];
/** Posición del Atlético en el camino del peso (el músculo solo se suma desde ahí). */
export const PESO_ATLETICO = 1 / (ETAPAS_PESO.length - 1);

export interface Forma {
  /** 0 a 1 a lo largo de ETAPAS_PESO */
  peso: number;
  /** 0 a 1 a lo largo de ETAPAS_MUSCULO (si es mayor a 0, el peso queda en Atlético) */
  musculo: number;
}
export const FORMA_INICIAL: Forma = { peso: PESO_ATLETICO, musculo: 0 };

export const nombreDe = (etapas: { nombre: string }[], x: number) => etapas[Math.round(Math.min(1, Math.max(0, x)) * (etapas.length - 1))].nombre;

/** En qué tramo del camino estamos: estatua A, estatua B y cuánto se avanzó de A a B (0 a 1). */
function tramo(f: Forma): { a: string; b: string; t: number } {
  const camino = f.musculo > 0.001 ? ETAPAS_MUSCULO : ETAPAS_PESO;
  const x = Math.min(1, Math.max(0, f.musculo > 0.001 ? f.musculo : f.peso)) * (camino.length - 1);
  const i = Math.min(camino.length - 2, Math.floor(x));
  return { a: camino[i].id, b: camino[i + 1].id, t: x - i };
}

interface Datos {
  base: Float32Array;
  morphs: Map<string, Float32Array>;
  indice: THREE.BufferAttribute;
}

const cache = new Map<string, Promise<Datos>>();
function cargar(id: string): Promise<Datos> {
  const previo = cache.get(id);
  if (previo) return previo;
  const cargador = new GLTFLoader();
  cargador.setMeshoptDecoder(MeshoptDecoder);
  const p = cargador.loadAsync(`${BASE}${id}.glb`).then((gltf) => {
    let malla: THREE.Mesh | null = null;
    gltf.scene.traverse((o) => {
      if (!malla && o instanceof THREE.Mesh) malla = o;
    });
    if (!malla) throw new Error('sin malla');
    const m = malla as THREE.Mesh;
    const g = m.geometry as THREE.BufferGeometry;
    // La compresión guarda escala y desplazamiento en el nodo: se aplican a la malla (completo) y a los morphs (solo escala).
    gltf.scene.updateMatrixWorld(true);
    const mat = m.matrixWorld;
    const lineal = new THREE.Matrix3().setFromMatrix4(mat);
    const v = new THREE.Vector3();
    const aFloat = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, completa: boolean) => {
      const out = new Float32Array(a.count * 3);
      for (let i = 0; i < a.count; i++) {
        v.set(a.getComponent(i, 0), a.getComponent(i, 1), a.getComponent(i, 2));
        if (completa) v.applyMatrix4(mat);
        else v.applyMatrix3(lineal);
        out[i * 3] = v.x;
        out[i * 3 + 1] = v.y;
        out[i * 3 + 2] = v.z;
      }
      return out;
    };
    const base = aFloat(g.getAttribute('position'), true);
    const morphs = new Map<string, Float32Array>();
    const lista = g.morphAttributes.position ?? [];
    for (const [nombre, i] of Object.entries(m.morphTargetDictionary ?? {})) if (lista[i]) morphs.set(nombre, aFloat(lista[i], false));
    return { base, morphs, indice: g.getIndex()!.clone() };
  });
  cache.set(id, p);
  p.catch(() => cache.delete(id));
  return p;
}

export interface EscenaViva {
  actualizar(f: Forma): Promise<void>;
  enfocar(v: 'cuerpo' | 'cara'): void;
  destruir(): void;
}

const ALTO = 10;

interface Figura {
  datos: Datos;
  pos: Float32Array;
  geo: THREE.BufferGeometry;
  mat: THREE.MeshPhysicalMaterial;
  malla: THREE.Mesh;
}

export async function crearViva(lienzo: HTMLCanvasElement, inicial: Forma): Promise<EscenaViva> {
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

  const figuras = new Map<string, Figura>();
  const figura = async (id: string): Promise<Figura> => {
    const ya = figuras.get(id);
    if (ya) return ya;
    const datos = await cargar(id);
    const otra = figuras.get(id);
    if (otra) return otra;
    const pos = new Float32Array(datos.base);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(datos.indice);
    geo.computeVertexNormals();
    vetas(geo);
    const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.5 });
    const malla = new THREE.Mesh(geo, mat);
    malla.castShadow = true;
    malla.receiveShadow = true;
    const f = { datos, pos, geo, mat, malla };
    figuras.set(id, f);
    return f;
  };
  /** Deforma una estatua hacia una vecina (peso 0 = la estatua tal cual). */
  const deformar = (f: Figura, hacia: string, peso: number) => {
    f.pos.set(f.datos.base);
    const m = f.datos.morphs.get(hacia);
    if (m && peso > 0) for (let i = 0; i < f.pos.length; i++) f.pos[i] += m[i] * peso;
    f.geo.getAttribute('position').needsUpdate = true;
    f.geo.computeVertexNormals();
    f.geo.computeBoundingSphere();
  };
  /** Opacidad: la que domina se dibuja entera; la otra encima, transparente. */
  const opacidad = (f: Figura, o: number, encima: boolean) => {
    f.mat.transparent = o < 1;
    f.mat.opacity = o;
    f.mat.depthWrite = !encima;
    f.mat.polygonOffset = encima;
    f.mat.polygonOffsetFactor = encima ? -1 : 0;
    f.malla.castShadow = !encima;
    f.malla.renderOrder = encima ? 1 : 0;
    f.mat.needsUpdate = true;
  };

  let pedido = 0;
  const actualizar = async (forma: Forma) => {
    const n = ++pedido;
    const { a, b, t } = tramo(forma);
    const [fa, fb] = await Promise.all([figura(a), figura(b)]);
    if (n !== pedido) return; // llegó un cambio más nuevo mientras cargaba
    for (const [id, f] of figuras) if (id !== a && id !== b) escena.remove(f.malla);
    // Fundido entre 30 % y 70 % del tramo (ahí las dos formas casi coinciden).
    const s = Math.min(1, Math.max(0, (t - 0.3) / 0.4));
    const fundido = s * s * (3 - 2 * s);
    const verA = fundido < 1;
    const verB = fundido > 0;
    if (verA) {
      deformar(fa, b, t);
      escena.add(fa.malla);
      opacidad(fa, fundido < 0.5 ? 1 : 2 * (1 - fundido), fundido >= 0.5);
    } else escena.remove(fa.malla);
    if (verB) {
      deformar(fb, a, 1 - t);
      escena.add(fb.malla);
      opacidad(fb, fundido >= 0.5 ? 1 : 2 * fundido, fundido < 0.5);
    } else escena.remove(fb.malla);
    // Precargar las vecinas para que el próximo tramo no espere.
    for (const c of [ETAPAS_PESO, ETAPAS_MUSCULO]) {
      const i = c.findIndex((e) => e.id === b);
      if (i >= 0 && c[i + 1]) void cargar(c[i + 1].id).catch(() => undefined);
    }
  };
  await actualizar(inicial);

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
      for (const f of figuras.values()) {
        f.geo.dispose();
        f.mat.dispose();
      }
      render.dispose();
    },
  };
}
