/**
 * El Espejo: tu reflejo en 3D, estilo papel facetado. Usa una malla humana libre (MakeHuman, CC0)
 * ya simplificada y con sus deformaciones (peso, músculo, cara), preparada en herramientas/espejo/armar.py.
 * Todo se calcula en el celular: los deslizantes mueven los vértices al instante.
 */
import * as THREE from 'three';

export type Cara = 'ovalada' | 'redonda' | 'cuadrada' | 'triangular';
export type Pelo = 'corto' | 'rulos' | 'rapado' | 'calvo';
export type Barba = 'ninguna' | 'corta' | 'larga';
export type Nariz = 'chica' | 'media' | 'grande';

export interface Reflejo {
  /** 0 = muy delgado · 0,5 = normal · 1 = mucha grasa */
  grasa: number;
  /** 0 = poco músculo · 1 = mucho */
  musculo: number;
  /** 0 = encorvado · 1 = erguido */
  postura: number;
  cara: Cara;
  nariz: Nariz;
  pelo: Pelo;
  barba: Barba;
  lentes: boolean;
  piel: string;
  colorPelo: string;
  remera: string;
  pantalon: string;
}

export const PIELES = ['#f3d6c1' /* familia-ok: ilustración de El Espejo */, '#e8bf9f', '#d39b74', '#b07650', '#8a5636', '#5e3a24'];
export const COLORES_PELO = ['#2b211b' /* familia-ok: ilustración de El Espejo */, '#4a3222', '#7a5233', '#b48a5a', '#d8c3a0', '#8f8f8f'];
export const COLORES_ROPA = ['#f4f1ea' /* familia-ok: ilustración de El Espejo */, '#2f2f33', '#c8302c', '#2f4f7f', '#3f6b45', '#c9a24a', '#7a4a8c'];

export const REFLEJO_INICIAL: Reflejo = {
  grasa: 0.5,
  musculo: 0.4,
  postura: 0.8,
  cara: 'ovalada',
  nariz: 'media',
  pelo: 'corto',
  barba: 'ninguna',
  lentes: false,
  piel: PIELES[2],
  colorPelo: COLORES_PELO[0],
  remera: COLORES_ROPA[0],
  pantalon: COLORES_ROPA[2],
};

export interface Datos {
  nV: number;
  nF: number;
  base: Float32Array;
  caras: Uint16Array;
  zona: Uint8Array;
  formas: Record<string, Float32Array>;
  capas: Record<string, { caras: Uint16Array; borde: Uint16Array }>;
  puntos: Record<string, number[]>;
  piso: number;
  altura: number;
  /** 1 = vértice del brazo o la mano (para que el manto no los envuelva). */
  brazo: Uint8Array | null;
}

const cache = new Map<string, Promise<Datos>>();

/** Descarga y lee el cuerpo (una vez; después queda en la memoria y en la caché del navegador). */
export function cargarCuerpo(url = '/espejo/cuerpo.bin'): Promise<Datos> {
  const previo = cache.get(url);
  if (previo) return previo;
  const promesa = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error('No se pudo cargar tu reflejo.');
      return r.arrayBuffer();
    })
    .then((buf) => {
      const dv = new DataView(buf);
      const largo = dv.getUint32(0, true);
      const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, largo))) as {
        vertices: number;
        caras: number;
        formas: Array<{ nombre: string; escala: number }>;
        capas: Record<string, { caras: number; borde: number }>;
        puntos: Record<string, number[]>;
        piso: number;
        altura: number;
      };
      let o = 4 + largo;
      o += (4 - (o % 4)) % 4;
      const nV = meta.vertices;
      const nF = meta.caras;
      const base = new Float32Array(buf.slice(o, o + nV * 12));
      o += nV * 12;
      const caras = new Uint16Array(buf.slice(o, o + nF * 6));
      o += nF * 6;
      const zona = new Uint8Array(buf.slice(o, o + nF));
      o += nF;
      o += (4 - (nF % 4)) % 4;
      const formas: Record<string, Float32Array> = {};
      for (const f of meta.formas) {
        const crudo = new Int16Array(buf.slice(o, o + nV * 6));
        o += nV * 6;
        const d = new Float32Array(nV * 3);
        for (let i = 0; i < d.length; i++) d[i] = crudo[i] * f.escala;
        formas[f.nombre] = d;
      }
      const capas: Datos['capas'] = {};
      for (const [k, c] of Object.entries(meta.capas)) {
        const cs = new Uint16Array(buf.slice(o, o + c.caras * 2));
        o += c.caras * 2;
        const b = new Uint16Array(buf.slice(o, o + c.borde * 2));
        o += c.borde * 2;
        capas[k] = { caras: cs, borde: b };
      }
      const brazo = buf.byteLength - o >= nV ? new Uint8Array(buf.slice(o, o + nV)) : null;
      return { nV, nF, base, caras, zona, formas, capas, puntos: meta.puntos, piso: meta.piso, altura: meta.altura, brazo };
    });
  cache.set(url, promesa);
  promesa.catch(() => cache.delete(url));
  return promesa;
}

export const suave = (x: number, a: number, b: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Posiciones del cuerpo para un reflejo (deformaciones + ropa holgada + postura). */
function deformar(d: Datos, r: Reflejo): Float32Array {
  const p = new Float32Array(d.base);
  const pesos: Record<string, number> = {
    pesoMenos: Math.max(0, (0.5 - r.grasa) * 2),
    pesoMas: Math.max(0, (r.grasa - 0.5) * 2),
    obeso: Math.max(0, (r.grasa - 0.5) * 2) ** 1.3,
    flaco: Math.max(0, (0.5 - r.grasa) * 2),
    atletico: Math.max(0, (r.musculo - 0.5) * 2),
    muscMenos: Math.max(0, (0.5 - r.musculo) * 2),
    muscMas: Math.max(0, (r.musculo - 0.5) * 2),
    papada: Math.max(0, (r.grasa - 0.6) * 2),
    caraRedonda: r.cara === 'redonda' ? 0.7 : 0,
    caraCuadrada: r.cara === 'cuadrada' ? 0.7 : 0,
    caraOvalada: r.cara === 'ovalada' ? 0.5 : 0,
    caraTriangular: r.cara === 'triangular' ? 0.7 : 0,
    narizGrande: r.nariz === 'grande' ? 0.8 : 0,
    narizChica: r.nariz === 'chica' ? 0.7 : 0,
  };
  for (const [k, w] of Object.entries(pesos)) {
    const f = d.formas[k];
    if (!f || w === 0) continue;
    for (let i = 0; i < p.length; i++) p[i] += f[i] * w;
  }
  // Pantalón holgado: se separa del eje de cada pierna, más abajo más ancho.
  const cad = d.puntos['l-upper-leg'];
  const tob = d.puntos['l-ankle'];
  const enPantalon = new Uint8Array(d.nV);
  for (let f = 0; f < d.nF; f++) if (d.zona[f] === 2) for (let k = 0; k < 3; k++) enPantalon[d.caras[f * 3 + k]] = 1;
  for (let i = 0; i < d.nV; i++) {
    if (!enPantalon[i]) continue;
    const y = p[i * 3 + 1];
    const lado = p[i * 3] >= 0 ? 1 : -1;
    const t = Math.min(1, Math.max(0, (cad[1] - y) / (cad[1] - tob[1])));
    const ex = lado * (cad[0] + (tob[0] - cad[0]) * t);
    const ez = cad[2] + (tob[2] - cad[2]) * t;
    const dx = p[i * 3] - ex;
    const dz = p[i * 3 + 2] - ez;
    const r0 = Math.hypot(dx, dz) || 1;
    const extra = 0.08 + 0.32 * t * t * suave(y, tob[1] - 0.4, tob[1] + 0.6);
    p[i * 3] += (dx / r0) * extra;
    p[i * 3 + 2] += (dz / r0) * extra;
  }
  // Postura: el torso se inclina hacia adelante desde la cintura y la cabeza un poco más.
  const ang = (1 - r.postura) * 0.42;
  if (ang > 0.001) {
    const piv = 1.2;
    for (let i = 0; i < d.nV; i++) {
      const y = p[i * 3 + 1];
      const w = suave(y, piv, 5.8) + 0.5 * suave(y, 5.6, 7.2);
      if (w <= 0) continue;
      const a = ang * w;
      const yy = y - piv;
      const zz = p[i * 3 + 2];
      p[i * 3 + 1] = piv + yy * Math.cos(a) - zz * Math.sin(a);
      p[i * 3 + 2] = yy * Math.sin(a) + zz * Math.cos(a);
    }
  }
  return p;
}

/** Normales suaves por vértice (para sacar el pelo hacia afuera). */
export function normales(d: Datos, p: Float32Array): Float32Array {
  const n = new Float32Array(p.length);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let f = 0; f < d.nF; f++) {
    const i0 = d.caras[f * 3];
    const i1 = d.caras[f * 3 + 1];
    const i2 = d.caras[f * 3 + 2];
    a.fromArray(p, i0 * 3);
    b.fromArray(p, i1 * 3).sub(a);
    c.fromArray(p, i2 * 3).sub(a);
    b.cross(c);
    for (const i of [i0, i1, i2]) {
      n[i * 3] += b.x;
      n[i * 3 + 1] += b.y;
      n[i * 3 + 2] += b.z;
    }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l;
    n[i + 1] /= l;
    n[i + 2] /= l;
  }
  return n;
}

/** Cáscara (pelo o barba) sobre la piel: capa exterior + borde que la cierra. */
export function cascara(capa: { caras: Uint16Array; borde: Uint16Array }, p: Float32Array, n: Float32Array, grosor: (i: number) => number, color: THREE.Color, caida: (i: number) => number = () => 0): THREE.BufferGeometry {
  const pos: number[] = [];
  const fuera = (i: number) => {
    const g = grosor(i);
    const c = caida(i);
    return [p[i * 3] + n[i * 3] * g, p[i * 3 + 1] + n[i * 3 + 1] * g - c, p[i * 3 + 2] + n[i * 3 + 2] * g + c * 0.25];
  };
  const dentro = (i: number) => [p[i * 3] + n[i * 3] * 0.01, p[i * 3 + 1] + n[i * 3 + 1] * 0.01, p[i * 3 + 2] + n[i * 3 + 2] * 0.01];
  for (let k = 0; k < capa.caras.length; k += 3) {
    pos.push(...fuera(capa.caras[k]), ...fuera(capa.caras[k + 1]), ...fuera(capa.caras[k + 2]));
  }
  for (let k = 0; k < capa.borde.length; k += 2) {
    const a = capa.borde[k];
    const b = capa.borde[k + 1];
    const A = fuera(a);
    const B = fuera(b);
    const a0 = dentro(a);
    const b0 = dentro(b);
    pos.push(...a0, ...B, ...A, ...a0, ...b0, ...B);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const col = new Float32Array(pos.length);
  for (let i = 0; i < col.length; i += 3) {
    // un poco de variación por cara, como papel
    const v = 0.92 + ((i * 7919) % 97) / 97 * 0.16;
    col[i] = color.r * v;
    col[i + 1] = color.g * v;
    col[i + 2] = color.b * v;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** Ruido fijo por vértice (para los rulos). */
export const ruido = (i: number) => {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

/** Arma (o rearma) las mallas del reflejo. */
function construir(d: Datos, r: Reflejo): THREE.Group {
  const p = deformar(d, r);
  // Centro de la cabeza (para la vista de cerca)
  let cx = 0;
  let cy = 0;
  let cz = 0;
  let k = 0;
  const altoCabeza = (d.puntos.neck?.[1] ?? 5.9) + 0.5;
  for (let i = 0; i < d.nV; i++) {
    if (d.base[i * 3 + 1] < altoCabeza) continue;
    cx += p[i * 3];
    cy += p[i * 3 + 1];
    cz += p[i * 3 + 2];
    k++;
  }
  const n = normales(d, p);
  const grupo = new THREE.Group();
  grupo.userData.cabeza = k ? new THREE.Vector3(cx / k, cy / k, cz / k) : null;
  const colores = [new THREE.Color(r.piel), new THREE.Color(r.remera), new THREE.Color(r.pantalon), new THREE.Color('#f2f2ef' /* familia-ok: ilustración de El Espejo */), new THREE.Color('#2a2420'), new THREE.Color(r.colorPelo).lerp(new THREE.Color(r.piel), 0.25), new THREE.Color(r.piel).multiplyScalar(0.8)];
  colores.forEach((c) => c.convertSRGBToLinear());

  // Cuerpo: cada cara con su color (sin compartir vértices, así queda facetado).
  const pos = new Float32Array(d.nF * 9);
  const col = new Float32Array(d.nF * 9);
  for (let f = 0; f < d.nF; f++) {
    const c = colores[d.zona[f]] ?? colores[0];
    const v = 0.95 + ((f * 7919) % 89) / 89 * 0.1;
    for (let k = 0; k < 3; k++) {
      const i = d.caras[f * 3 + k];
      pos[f * 9 + k * 3] = p[i * 3];
      pos[f * 9 + k * 3 + 1] = p[i * 3 + 1];
      pos[f * 9 + k * 3 + 2] = p[i * 3 + 2];
      col[f * 9 + k * 3] = c.r * v;
      col[f * 9 + k * 3 + 1] = c.g * v;
      col[f * 9 + k * 3 + 2] = c.b * v;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 });
  const cuerpo = new THREE.Mesh(g, mat);
  cuerpo.castShadow = true;
  grupo.add(cuerpo);

  const colorPelo = new THREE.Color(r.colorPelo).convertSRGBToLinear();
  if (r.pelo !== 'calvo') {
    const grosor = r.pelo === 'rapado' ? () => 0.035 : r.pelo === 'rulos' ? (i: number) => 0.2 + ruido(i) * 0.16 : (i: number) => 0.13 + ruido(i) * 0.03;
    const m = new THREE.Mesh(cascara(d.capas.pelo, p, n, grosor, colorPelo), mat);
    m.castShadow = true;
    grupo.add(m);
  }
  if (r.barba !== 'ninguna') {
    const larga = r.barba === 'larga';
    const barbilla = d.puntos.jaw?.[1] ?? 6.2;
    const grosor = (i: number) => (larga ? 0.09 : 0.055) + ruido(i) * 0.02;
    // La barba larga cae hacia abajo desde el mentón (no se infla hacia los costados).
    const caida = (i: number) => (larga ? 0.55 * suave(barbilla + 0.45 - d.base[i * 3 + 1], 0, 0.5) * suave(d.base[i * 3 + 2], 0.6, 1.3) : 0);
    const m = new THREE.Mesh(cascara(d.capas.barba, p, n, grosor, colorPelo, caida), mat);
    grupo.add(m);
  }
  if (r.lentes) {
    const oscuro = new THREE.MeshStandardMaterial({ color: 0x1d1b19, roughness: 0.5, flatShading: true });
    const ojoI = d.puntos['l-eye'];
    const ojoD = d.puntos['r-eye'];
    const inclin = (1 - r.postura) * 0.42 * 1.5;
    const lentes = new THREE.Group();
    for (const o of [ojoI, ojoD]) {
      const aro = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 10), oscuro);
      aro.position.set(o[0], o[1], o[2] + 0.24);
      lentes.add(aro);
      const patilla = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 1.1), oscuro);
      patilla.position.set(o[0] * 2.5, o[1] + 0.03, o[2] - 0.32);
      lentes.add(patilla);
    }
    const puente = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.03), oscuro);
    puente.position.set(0, ojoI[1] + 0.04, ojoI[2] + 0.26);
    lentes.add(puente);
    // Siguen la inclinación de la cabeza
    const piv = 1.2;
    lentes.position.set(0, piv, 0);
    lentes.children.forEach((c) => (c.position.y -= piv));
    lentes.rotation.x = inclin;
    grupo.add(lentes);
  }
  return grupo;
}

export type Vista = 'cuerpo' | 'cara';

export interface Escena {
  actualizar(r: Reflejo): void;
  /** Cuerpo entero o la cara de cerca. */
  enfocar(v: Vista): void;
  destruir(): void;
}

/** Escena del espejo: luz suave de estudio, sombra en el piso, giro con el dedo. */
export async function crearEscena(lienzo: HTMLCanvasElement, inicial: Reflejo, vistaInicial: Vista = 'cuerpo'): Promise<Escena> {
  const datos = await cargarCuerpo();
  const render = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true });
  render.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  render.shadowMap.enabled = true;
  render.shadowMap.type = THREE.PCFSoftShadowMap;
  render.outputColorSpace = THREE.SRGBColorSpace;
  render.toneMapping = THREE.ACESFilmicToneMapping;
  render.toneMappingExposure = 1.1;

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(28, 1, 1, 200);
  const centroY = datos.piso + datos.altura * 0.5;
  camara.position.set(0, centroY + 1.5, 40);
  camara.lookAt(0, centroY, 0);

  escena.add(new THREE.HemisphereLight(0xffffff, 0xb8b0a4, 1.5));
  const clave = new THREE.DirectionalLight(0xfff4e6, 2.4);
  clave.position.set(14, 22, 18);
  clave.castShadow = true;
  clave.shadow.mapSize.set(1024, 1024);
  const sc = clave.shadow.camera;
  sc.left = -10;
  sc.right = 10;
  sc.top = 12;
  sc.bottom = -12;
  sc.near = 1;
  sc.far = 80;
  clave.shadow.normalBias = 0.05;
  escena.add(clave);
  const relleno = new THREE.DirectionalLight(0xe8eeff, 0.8);
  relleno.position.set(-16, 8, 10);
  escena.add(relleno);

  const piso = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.ShadowMaterial({ opacity: 0.18 }));
  piso.rotation.x = -Math.PI / 2;
  piso.position.y = datos.piso - 0.02;
  piso.receiveShadow = true;
  escena.add(piso);

  const pivote = new THREE.Group();
  escena.add(pivote);
  let actual: THREE.Group | null = null;
  const liberar = (o: THREE.Object3D) =>
    o.traverse((x) => {
      if (x instanceof THREE.Mesh) {
        x.geometry.dispose();
        (x.material as THREE.Material).dispose();
      }
    });
  const actualizar = (r: Reflejo) => {
    if (actual) {
      pivote.remove(actual);
      liberar(actual);
    }
    actual = construir(datos, r);
    pivote.add(actual);
    if (vista === 'cara') ajustar();
  };

  let vista: Vista = vistaInicial;
  const cabezaY = (datos.puntos.head?.[1] ?? 7) + 0.2;
  const ajustar = () => {
    const ancho = lienzo.clientWidth || 300;
    const alto = lienzo.clientHeight || 400;
    render.setSize(ancho, alto, false);
    camara.aspect = ancho / alto;
    if (vista === 'cara') {
      const c = (actual?.userData.cabeza as THREE.Vector3 | null) ?? new THREE.Vector3(0, cabezaY, 0);
      const dist = Math.max(9, 9 * (0.75 / camara.aspect));
      camara.position.set(0, c.y + 0.2, dist);
      camara.lookAt(0, c.y - 0.1, 0);
    } else {
      // Que entre entero también en pantallas angostas.
      const dist = Math.max(40, 40 * (0.75 / camara.aspect));
      camara.position.set(0, centroY + 1.5, dist);
      camara.lookAt(0, centroY, 0);
    }
    camara.updateProjectionMatrix();
  };
  actualizar(inicial);
  ajustar();
  const obs = new ResizeObserver(ajustar);
  obs.observe(lienzo);

  let giro = 0.4;
  let arrastrando = false;
  let ultimoX = 0;
  let quieto = 0;
  const abajo = (e: PointerEvent) => {
    arrastrando = true;
    ultimoX = e.clientX;
    lienzo.setPointerCapture(e.pointerId);
  };
  const mover = (e: PointerEvent) => {
    if (!arrastrando) return;
    giro += (e.clientX - ultimoX) * 0.01;
    ultimoX = e.clientX;
    quieto = performance.now();
  };
  const soltar = () => {
    arrastrando = false;
    quieto = performance.now();
  };
  lienzo.addEventListener('pointerdown', abajo);
  lienzo.addEventListener('pointermove', mover);
  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', soltar);

  let cuadro = 0;
  let antes = performance.now();
  const animar = (ahora: number) => {
    const dt = Math.min(0.05, (ahora - antes) / 1000);
    antes = ahora;
    if (!arrastrando && ahora - quieto > 2500) giro += dt * 0.25;
    pivote.rotation.y = giro;
    if (vista === 'cara' && actual?.userData.cabeza) {
      // La cámara sigue a la cabeza (aunque la postura la incline o gire).
      const c = pivote.localToWorld((actual.userData.cabeza as THREE.Vector3).clone());
      const dist = Math.max(9, 9 * (0.75 / camara.aspect));
      camara.position.set(c.x, c.y + 0.2, c.z + dist);
      camara.lookAt(c.x, c.y - 0.05, c.z);
    }
    render.render(escena, camara);
    cuadro = requestAnimationFrame(animar);
  };
  cuadro = requestAnimationFrame(animar);

  return {
    actualizar,
    enfocar(v) {
      vista = v;
      ajustar();
    },
    destruir() {
      cancelAnimationFrame(cuadro);
      obs.disconnect();
      lienzo.removeEventListener('pointerdown', abajo);
      lienzo.removeEventListener('pointermove', mover);
      lienzo.removeEventListener('pointerup', soltar);
      lienzo.removeEventListener('pointercancel', soltar);
      if (actual) liberar(actual);
      render.dispose();
    },
  };
}
