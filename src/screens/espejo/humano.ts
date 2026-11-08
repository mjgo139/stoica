/**
 * "Tu cuerpo": cuerpo humano realista estilo escaneo (malla completa de MakeHuman, CC0, sin simplificar),
 * gris liso con luz de estudio. Se deforma de forma continua con peso, músculo y altura.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { cargarCuerpo, type Datos } from './avatar';

export interface Cuerpo {
  /** 0 = muy delgado · 0,5 = normal · 1 = obeso */
  peso: number;
  /** 0 = poco músculo · 1 = mucho */
  musculo: number;
  /** 0 = bajo · 0,5 = medio · 1 = alto */
  altura: number;
}

export const CUERPO_INICIAL: Cuerpo = { peso: 0.5, musculo: 0.45, altura: 0.5 };

function deformar(d: Datos, c: Cuerpo): Float32Array {
  const p = new Float32Array(d.base);
  const w: Record<string, number> = {
    pesoMenos: Math.max(0, (0.5 - c.peso) * 2),
    pesoMas: Math.max(0, (c.peso - 0.5) * 2),
    obeso: Math.max(0, (c.peso - 0.5) * 2) ** 1.4 * 0.9,
    flaco: Math.max(0, (0.5 - c.peso) * 2) * 0.6,
    papada: Math.max(0, (c.peso - 0.65) * 2) * 0.8,
    muscMenos: Math.max(0, (0.5 - c.musculo) * 2),
    muscMas: Math.max(0, (c.musculo - 0.5) * 2),
    atletico: Math.max(0, (c.musculo - 0.5) * 2),
    altoMas: Math.max(0, (c.altura - 0.5) * 2),
    altoMenos: Math.max(0, (0.5 - c.altura) * 2),
  };
  for (const [k, v] of Object.entries(w)) {
    const f = d.formas[k];
    if (!f || v === 0) continue;
    for (let i = 0; i < p.length; i++) p[i] += f[i] * v;
  }
  return p;
}

/** Cuánto de "ropa interior" tiene cada vértice (0 a 1), con bordes rectos y suaves (no serruchados). */
const tintes = new WeakMap<Datos, Float32Array>();
function tinte(d: Datos): Float32Array {
  const previo = tintes.get(d);
  if (previo) return previo;
  // Altura de la cintura y del corte de la pierna, sacadas de la zona que armó la herramienta.
  const ys: number[] = [];
  for (let f = 0; f < d.nF; f++) if (d.zona[f] === 2) for (let k = 0; k < 3; k++) ys.push(d.base[d.caras[f * 3 + k] * 3 + 1]);
  ys.sort((a, b) => a - b);
  const abajo = (ys[Math.floor(ys.length * 0.03)] ?? 0) - 1.1; // tipo bóxer: baja hasta medio muslo
  const arriba = (ys[Math.floor(ys.length * 0.97)] ?? 1) - 0.05;
  const ancho = 0.05;
  const t = new Float32Array(d.nV);
  for (let i = 0; i < d.nV; i++) {
    if (d.brazo?.[i]) continue;
    const y = d.base[i * 3 + 1];
    const s = (x: number) => Math.min(1, Math.max(0, x));
    t[i] = s((y - abajo) / ancho + 0.5) * s((arriba - y) / ancho + 0.5);
  }
  tintes.set(d, t);
  return t;
}

function construir(d: Datos, c: Cuerpo, mat: THREE.Material, ojo: THREE.Material): THREE.Group {
  const p = deformar(d, c);
  const grupo = new THREE.Group();
  const iCuerpo: number[] = [];
  const iOjos: number[] = [];
  for (let f = 0; f < d.nF; f++) (d.zona[f] === 4 ? iOjos : iCuerpo).push(d.caras[f * 3], d.caras[f * 3 + 1], d.caras[f * 3 + 2]);
  const pos = new THREE.BufferAttribute(p, 3);
  // Color por vértice: piel gris claro y ropa interior gris oscuro.
  const t = tinte(d);
  const col = new Float32Array(d.nV * 3);
  const piel = new THREE.Color('#b9b9b9').convertSRGBToLinear();
  const ropa = new THREE.Color('#62656b').convertSRGBToLinear();
  const c0 = new THREE.Color();
  for (let i = 0; i < d.nV; i++) {
    c0.copy(piel).lerp(ropa, t[i]);
    col[i * 3] = c0.r;
    col[i * 3 + 1] = c0.g;
    col[i * 3 + 2] = c0.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', pos);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(iCuerpo);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  grupo.add(m);
  if (iOjos.length) {
    const go = new THREE.BufferGeometry();
    go.setAttribute('position', pos);
    go.setIndex(iOjos);
    go.computeVertexNormals();
    grupo.add(new THREE.Mesh(go, ojo));
  }
  return grupo;
}

export interface EscenaHumano {
  /** Uno o dos cuerpos (hoy y meta), lado a lado. */
  actualizar(cuerpos: Cuerpo[]): void;
  destruir(): void;
}

export async function crearHumano(lienzo: HTMLCanvasElement, cuerpos: Cuerpo[]): Promise<EscenaHumano> {
  const datos = await cargarCuerpo('/espejo/humano.bin');
  const render = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true });
  render.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  render.shadowMap.enabled = true;
  render.shadowMap.type = THREE.PCFSoftShadowMap;
  render.outputColorSpace = THREE.SRGBColorSpace;
  render.toneMapping = THREE.ACESFilmicToneMapping;
  render.toneMappingExposure = 1.0;

  const escena = new THREE.Scene();
  // Luz ambiente de "estudio" (reflejos suaves en toda la superficie)
  const pmrem = new THREE.PMREMGenerator(render);
  const entorno = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  escena.environment = entorno;
  escena.environmentIntensity = 0.35;

  const camara = new THREE.PerspectiveCamera(26, 1, 0.5, 300);
  const clave = new THREE.DirectionalLight(0xfff6ea, 2.6);
  clave.position.set(-10, 18, 16);
  clave.castShadow = true;
  clave.shadow.mapSize.set(2048, 2048);
  Object.assign(clave.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 80 });
  clave.shadow.normalBias = 0.03;
  escena.add(clave);
  const contra = new THREE.DirectionalLight(0xdfe8ff, 1.8);
  contra.position.set(12, 10, -14);
  escena.add(contra);
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ opacity: 0.25 }));
  piso.rotation.x = -Math.PI / 2;
  piso.position.y = datos.piso;
  piso.receiveShadow = true;
  escena.add(piso);

  // Acabado "de escaneo": gris mate con un brillo muy suave en los bordes.
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.7, metalness: 0 });
  const ojo = new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: 0.35 });

  const raiz = new THREE.Group();
  escena.add(raiz);
  let figuras: THREE.Group[] = [];
  const actualizar = (cs: Cuerpo[]) => {
    for (const f of figuras) {
      raiz.remove(f);
      f.traverse((o) => o instanceof THREE.Mesh && o.geometry.dispose());
    }
    const sep = 7.5;
    figuras = cs.map((c, i) => {
      const f = construir(datos, c, mat, ojo);
      f.position.x = (i - (cs.length - 1) / 2) * sep;
      raiz.add(f);
      return f;
    });
  };
  actualizar(cuerpos);

  const controles = new OrbitControls(camara, lienzo);
  controles.enableDamping = true;
  controles.enablePan = false;
  controles.minDistance = 6;
  controles.maxDistance = 90;
  controles.maxPolarAngle = Math.PI * 0.53;
  const centroY = datos.piso + datos.altura * 0.5;
  const ajustar = () => {
    const ancho = lienzo.clientWidth || 300;
    const alto = lienzo.clientHeight || 400;
    render.setSize(ancho, alto, false);
    camara.aspect = ancho / alto;
    camara.updateProjectionMatrix();
  };
  ajustar();
  // Encuadrar: que entren todos los cuerpos, de frente y un poco de costado.
  const tan = Math.tan(THREE.MathUtils.degToRad(camara.fov / 2));
  const anchoTotal = (figuras.length - 1) * 7.5 + 7;
  const dist = 1.12 * Math.max(datos.altura / 2 / tan, anchoTotal / 2 / (tan * camara.aspect));
  controles.target.set(0, centroY, 0);
  camara.position.set(dist * 0.18, centroY + 0.5, dist * 0.98);
  controles.update();
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
    destruir() {
      cancelAnimationFrame(cuadro);
      obs.disconnect();
      controles.dispose();
      entorno.dispose();
      pmrem.dispose();
      render.dispose();
      render.forceContextLoss();
    },
  };
}
