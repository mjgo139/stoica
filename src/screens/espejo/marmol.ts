/**
 * El Espejo · Mármol: estatuas hechas en Meshy (una por etapa física), optimizadas para el celular
 * (public/espejo/marmol/*.glb, comprimidas con meshopt). La app muestra la de tu etapa con mármol y luz
 * de museo, y al cambiar de etapa pasa de una a otra con un fundido.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface EtapaMarmol {
  archivo: string;
  nombre: string;
  orden: number;
}

const BASE = '/espejo/marmol/';
const ALTO = 10; // todas las estatuas se escalan a esta altura

export async function cargarIndice(): Promise<EtapaMarmol[]> {
  const r = await fetch(`${BASE}indice.json`, { cache: 'no-cache' });
  if (!r.ok) throw new Error('No se pudo cargar la lista de estatuas.');
  const j = (await r.json()) as { hombre?: EtapaMarmol[] };
  return (j.hombre ?? []).sort((a, b) => a.orden - b.orden);
}

const suave = (x: number, a: number, b: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Vetas de mármol pintadas en los vértices (no hace falta textura). */
function vetas(g: THREE.BufferGeometry) {
  const pos = g.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const base = new THREE.Color('#f1ece4').convertSRGBToLinear();
  const veta = new THREE.Color('#9a9288').convertSRGBToLinear();
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) * 1.6;
    const y = pos.getY(i) * 1.6;
    const z = pos.getZ(i) * 1.6;
    const f = Math.abs(Math.sin((x * 0.9 + y * 0.35 + z * 0.6) * 2.4 + 2.2 * Math.sin(x * 1.7 + z * 1.3) + 1.5 * Math.sin(y * 0.9)));
    const v = 1 - suave(f, 0, 0.06);
    const mancha = 0.965 + 0.035 * Math.sin(x * 3.1 + y * 2.3) * Math.sin(z * 2.7 - y * 1.9);
    c.copy(base).lerp(veta, v * 0.5).multiplyScalar(mancha);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

const cache = new Map<string, Promise<THREE.BufferGeometry>>();

/** Descarga una estatua y la deja parada en el piso, centrada y a la misma altura que las demás. */
function cargarGeometria(archivo: string): Promise<THREE.BufferGeometry> {
  const previo = cache.get(archivo);
  if (previo) return previo;
  const cargador = new GLTFLoader();
  cargador.setMeshoptDecoder(MeshoptDecoder);
  const p = cargador.loadAsync(BASE + archivo).then((gltf) => {
    const partes: THREE.BufferGeometry[] = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        // Las posiciones vienen comprimidas (enteros cuantizados): se pasan a decimales antes de mover.
        const src = o.geometry as THREE.BufferGeometry;
        const g = new THREE.BufferGeometry();
        const aFloat = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
          const out = new Float32Array(a.count * a.itemSize);
          for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
          return new THREE.BufferAttribute(out, a.itemSize);
        };
        g.setAttribute('position', aFloat(src.getAttribute('position')));
        if (src.getIndex()) g.setIndex(src.getIndex()!.clone());
        g.applyMatrix4(o.matrixWorld);
        g.computeVertexNormals();
        partes.push(g);
      }
    });
    const g = partes[0];
    g.computeBoundingBox();
    const caja = g.boundingBox!;
    const escala = ALTO / (caja.max.y - caja.min.y);
    g.translate(-(caja.min.x + caja.max.x) / 2, -caja.min.y, -(caja.min.z + caja.max.z) / 2);
    g.scale(escala, escala, escala);
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    vetas(g);
    return g;
  });
  cache.set(archivo, p);
  p.catch(() => cache.delete(archivo));
  return p;
}

export interface EscenaMarmol {
  mostrar(archivo: string): Promise<void>;
  enfocar(v: 'cuerpo' | 'cara'): void;
  destruir(): void;
}

export async function crearMarmol(lienzo: HTMLCanvasElement, inicial: string): Promise<EscenaMarmol> {
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
  // Piso invisible que solo recibe la sombra (grande, para que no se corte).
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.32 }));
  piso.rotation.x = -Math.PI / 2;
  piso.receiveShadow = true;
  escena.add(piso);

  const pivote = new THREE.Group();
  escena.add(pivote);
  let actual: THREE.Mesh | null = null;
  const nuevaMalla = (g: THREE.BufferGeometry) => {
    const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.5, transparent: true, opacity: 1 }));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  let vista: 'cuerpo' | 'cara' = 'cuerpo';
  // Girar, acercar y alejar libremente (con el dedo, pellizcando o con la rueda del mouse).
  const controles = new OrbitControls(camara, lienzo);
  controles.enableDamping = true;
  controles.dampingFactor = 0.08;
  controles.enablePan = false;
  controles.minDistance = 2.5;
  controles.maxDistance = 45;
  controles.minPolarAngle = 0.15;
  controles.maxPolarAngle = Math.PI * 0.53; // no meterse debajo del piso
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

  // Fundido entre estatuas
  let saliente: THREE.Mesh | null = null;
  let fundido = 1;
  const mostrar = async (archivo: string) => {
    const g = await cargarGeometria(archivo);
    if (saliente) {
      pivote.remove(saliente);
      (saliente.material as THREE.Material).dispose();
    }
    saliente = actual;
    actual = nuevaMalla(g);
    (actual.material as THREE.MeshPhysicalMaterial).opacity = saliente ? 0 : 1;
    pivote.add(actual);
    fundido = saliente ? 0 : 1;
  };
  await mostrar(inicial);

  let cuadro = 0;
  let antes = performance.now();
  const animar = (ahora: number) => {
    const dt = Math.min(0.05, (ahora - antes) / 1000);
    antes = ahora;
    controles.update();
    if (fundido < 1 && actual) {
      fundido = Math.min(1, fundido + dt / 0.8);
      (actual.material as THREE.MeshPhysicalMaterial).opacity = fundido;
      if (saliente) (saliente.material as THREE.MeshPhysicalMaterial).opacity = 1 - fundido;
      if (fundido >= 1 && saliente) {
        pivote.remove(saliente);
        (saliente.material as THREE.Material).dispose();
        saliente = null;
      }
    }
    render.render(escena, camara);
    cuadro = requestAnimationFrame(animar);
  };
  cuadro = requestAnimationFrame(animar);

  return {
    mostrar,
    enfocar(v) {
      vista = v;
      ubicar();
    },
    destruir() {
      cancelAnimationFrame(cuadro);
      obs.disconnect();
      controles.dispose();
      for (const m of [actual, saliente]) if (m) (m.material as THREE.Material).dispose();
      render.dispose();
    },
  };
}
