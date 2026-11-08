/**
 * El Espejo · Estatua: un mismo personaje para todos, estilo escultura griega de mármol,
 * que cambia con el peso (de atlético a obeso). Usa la malla libre de MakeHuman (CC0) con más detalle
 * (public/espejo/estatua.bin) y le agrega en el celular: manto, banda cruzada, rulos, barba y laurel.
 */
import * as THREE from 'three';
import { cargarCuerpo, normales, ruido, suave, type Datos } from './avatar';

export interface Estatua {
  /** 0 = atlético · 0,5 = normal · 1 = obeso */
  peso: number;
  barba: boolean;
  laurel: boolean;
}

export const ESTATUA_INICIAL: Estatua = { peso: 0.45, barba: true, laurel: false };

/** Las 7 etapas de la lámina (de atlético a obeso). */
export const ETAPAS_PESO = [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const MARMOL = new THREE.Color('#efe9df').convertSRGBToLinear();
const VETA = new THREE.Color('#9d958a').convertSRGBToLinear();

/** Pinta vetas de mármol según la posición (no hace falta textura). */
function marmolizar(g: THREE.BufferGeometry, tono = 1) {
  const pos = g.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const f = Math.abs(Math.sin((x * 0.9 + y * 0.35 + z * 0.6) * 2.4 + 2.2 * Math.sin(x * 1.7 + z * 1.3) + 1.5 * Math.sin(y * 0.9)));
    const veta = 1 - suave(f, 0, 0.07);
    const mancha = 0.96 + 0.04 * Math.sin(x * 3.1 + y * 2.3) * Math.sin(z * 2.7 - y * 1.9);
    c.copy(MARMOL).lerp(VETA, veta * 0.55).multiplyScalar(mancha * tono);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

/** Posiciones del cuerpo para un peso. */
function deformar(d: Datos, e: Estatua): Float32Array {
  const grasa = lerp(0.2, 1, e.peso);
  const musculo = lerp(0.95, 0.15, e.peso);
  const postura = lerp(1, 0.6, suave(e.peso, 0.5, 1));
  const p = new Float32Array(d.base);
  const pesos: Record<string, number> = {
    pesoMenos: Math.max(0, (0.5 - grasa) * 2),
    pesoMas: Math.max(0, (grasa - 0.5) * 2),
    obeso: Math.max(0, (grasa - 0.5) * 2) ** 1.3,
    flaco: Math.max(0, (0.5 - grasa) * 2) * 0.5,
    muscMenos: Math.max(0, (0.5 - musculo) * 2),
    muscMas: Math.max(0, (musculo - 0.5) * 2),
    atletico: Math.max(0, (musculo - 0.5) * 2),
    papada: Math.max(0, (grasa - 0.6) * 2),
  };
  for (const [k, w] of Object.entries(pesos)) {
    const f = d.formas[k];
    if (!f || w === 0) continue;
    for (let i = 0; i < p.length; i++) p[i] += f[i] * w;
  }
  const ang = (1 - postura) * 0.42;
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

/** Manto de la cintura a media pierna: se calcula con el ancho real del cuerpo en cada altura (crece con el peso). */
function manto(d: Datos, p: Float32Array): THREE.BufferGeometry {
  const arriba = 1.25;
  const abajo = -5.7;
  const anillos = 26;
  const lados = 72;
  const rx: number[] = [];
  const rz: number[] = [];
  const cx: number[] = [];
  const cz: number[] = [];
  const alturas: number[] = [];
  for (let k = 0; k < anillos; k++) {
    const h = lerp(arriba, abajo, k / (anillos - 1));
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < d.nV; i++) {
      if (d.brazo?.[i]) continue;
      const y = p[i * 3 + 1];
      if (Math.abs(y - h) > 0.22) continue;
      const x = p[i * 3];
      const z = p[i * 3 + 2];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    if (!Number.isFinite(minX)) {
      minX = -1.2;
      maxX = 1.2;
      minZ = -0.8;
      maxZ = 0.8;
    }
    const t = k / (anillos - 1);
    // La tela cae: nunca se angosta hacia abajo y se abre un poco.
    const ax = Math.max((maxX - minX) / 2 + 0.14 + t * 0.35, k ? rx[k - 1] : 0);
    const az = Math.max((maxZ - minZ) / 2 + 0.14 + t * 0.3, k ? rz[k - 1] * 0.98 : 0);
    rx.push(ax);
    rz.push(az);
    cx.push(k ? lerp(cx[k - 1], (maxX + minX) / 2, 0.3) : (maxX + minX) / 2);
    cz.push(k ? lerp(cz[k - 1], (maxZ + minZ) / 2, 0.3) : (maxZ + minZ) / 2);
    alturas.push(h);
  }
  const pos: number[] = [];
  for (let k = 0; k < anillos; k++) {
    const t = k / (anillos - 1);
    for (let j = 0; j <= lados; j++) {
      const a = (j / lados) * Math.PI * 2;
      const pliegue = 1 + (Math.sin(a * 9 + t * 3) * 0.05 + Math.sin(a * 23 + 1.3) * 0.015) * suave(t, 0.05, 0.6);
      // la tela del frente cuelga un poco más baja en el centro
      const caida = t > 0.95 ? Math.cos(a) * 0.0 : 0;
      pos.push(cx[k] + Math.cos(a) * rx[k] * pliegue, alturas[k] + caida, cz[k] + Math.sin(a) * rz[k] * pliegue);
    }
  }
  const idx: number[] = [];
  for (let k = 0; k < anillos - 1; k++) {
    for (let j = 0; j < lados; j++) {
      const a = k * (lados + 1) + j;
      const b = a + lados + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  // Rollo de tela en la cintura (el borde de arriba del manto, enrollado).
  const base = anillos * (lados + 1);
  const seccion = 10;
  const grosor = 0.22;
  for (let j = 0; j <= lados; j++) {
    const a = (j / lados) * Math.PI * 2;
    const giro = Math.sin(a * 5) * 0.4;
    for (let q = 0; q <= seccion; q++) {
      const b = (q / seccion) * Math.PI * 2;
      const r = 1 + (Math.cos(b + giro) * grosor) / Math.max(rx[0], rz[0]);
      pos.push(cx[0] + Math.cos(a) * (rx[0] + 0.02) * r, alturas[0] + 0.05 + Math.sin(b + giro) * grosor, cz[0] + Math.sin(a) * (rz[0] + 0.02) * r);
    }
  }
  for (let j = 0; j < lados; j++) {
    for (let q = 0; q < seccion; q++) {
      const a = base + j * (seccion + 1) + q;
      const b = a + seccion + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Rulos (bolitas) sobre una capa: cabeza o barba, como en los bustos griegos. */
function rulos(capa: { caras: Uint16Array }, p: Float32Array, n: Float32Array, radio: number, salida: number, mat: THREE.Material, cada = 1): THREE.InstancedMesh {
  const usados = [...new Set(capa.caras)].filter((_, k) => k % cada === 0);
  const geo = new THREE.IcosahedronGeometry(radio, 1);
  const m = new THREE.InstancedMesh(geo, mat, usados.length);
  const o = new THREE.Object3D();
  usados.forEach((i, k) => {
    const s = 0.75 + ruido(i) * 0.5;
    o.position.set(p[i * 3] + n[i * 3] * salida, p[i * 3 + 1] + n[i * 3 + 1] * salida, p[i * 3 + 2] + n[i * 3 + 2] * salida);
    o.scale.setScalar(s);
    o.rotation.set(ruido(i + 3) * 6, ruido(i + 7) * 6, 0);
    o.updateMatrix();
    m.setMatrixAt(k, o.matrix);
  });
  m.castShadow = true;
  return m;
}

/** Corona de laurel alrededor de la cabeza. */
function laurel(centro: THREE.Vector3, radio: number, mat: THREE.Material): THREE.InstancedMesh {
  const hojas = 46;
  const geo = new THREE.SphereGeometry(0.16, 8, 6);
  geo.scale(0.42, 1, 0.22);
  const m = new THREE.InstancedMesh(geo, mat, hojas);
  const o = new THREE.Object3D();
  for (let k = 0; k < hojas; k++) {
    const lado = k % 2 ? 1 : -1;
    const a = Math.PI * 0.5 + Math.PI * 0.16 + (Math.floor(k / 2) / (hojas / 2 - 1)) * Math.PI * 1.68; // abierta adelante
    o.position.set(centro.x + Math.cos(a) * radio, centro.y + 0.32 + lado * 0.05, centro.z + Math.sin(a) * radio);
    o.rotation.set(0, -a, lado * 0.9);
    o.updateMatrix();
    m.setMatrixAt(k, o.matrix);
  }
  return m;
}

function pedestal(piso: number, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const partes: Array<[number, number, number, number]> = [
    [2.6, 2.7, 0.5, -0.25],
    [2.75, 2.75, 0.18, -0.59],
    [2.9, 3.0, 0.3, -0.83],
  ];
  for (const [r1, r2, alto, y] of partes) {
    const geo = new THREE.CylinderGeometry(r1, r2, alto, 64);
    marmolizar(geo, 0.97);
    const m = new THREE.Mesh(geo, mat);
    m.position.y = piso + y;
    m.receiveShadow = true;
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

function construir(d: Datos, e: Estatua, mat: THREE.Material, matLiso: THREE.Material): THREE.Group {
  const p = deformar(d, e);
  const n = normales(d, p);
  const grupo = new THREE.Group();

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setIndex(new THREE.BufferAttribute(d.caras, 1));
  g.computeVertexNormals();
  marmolizar(g);
  const cuerpo = new THREE.Mesh(g, mat);
  cuerpo.castShadow = true;
  cuerpo.receiveShadow = true;
  grupo.add(cuerpo);

  const tela = manto(d, p);
  marmolizar(tela, 0.98);
  const mTela = new THREE.Mesh(tela, mat);
  mTela.castShadow = true;
  mTela.receiveShadow = true;
  grupo.add(mTela);

  grupo.add(rulos(d.capas.pelo, p, n, 0.13, 0.08, matLiso));
  if (e.barba) grupo.add(rulos(d.capas.barba, p, n, 0.09, 0.05, matLiso));

  // Centro de la cabeza (para el laurel y la vista de cerca)
  let cx = 0;
  let cy = 0;
  let cz = 0;
  let k = 0;
  let maxY = -Infinity;
  const cuello = (d.puntos.neck?.[1] ?? 5.9) + 0.5;
  for (let i = 0; i < d.nV; i++) {
    if (d.base[i * 3 + 1] < cuello) continue;
    cx += p[i * 3];
    cy += p[i * 3 + 1];
    cz += p[i * 3 + 2];
    maxY = Math.max(maxY, p[i * 3 + 1]);
    k++;
  }
  const centro = new THREE.Vector3(cx / k, cy / k, cz / k);
  grupo.userData.cabeza = centro;
  if (e.laurel) grupo.add(laurel(new THREE.Vector3(centro.x, lerp(centro.y, maxY, 0.38), centro.z - 0.08), 1.18, matLiso));

  grupo.add(pedestal(d.piso, mat));
  return grupo;
}

export interface EscenaEstatua {
  actualizar(e: Estatua): void;
  enfocar(v: 'cuerpo' | 'cara'): void;
  /** Fotos de varias etapas (para la tira de evolución). */
  fotos(etapas: Estatua[], ancho: number, alto: number): string[];
  destruir(): void;
}

/** Escena de museo: fondo oscuro, luz cálida de costado y contraluz fría. */
export async function crearEstatua(lienzo: HTMLCanvasElement, inicial: Estatua): Promise<EscenaEstatua> {
  const datos = await cargarCuerpo('/espejo/estatua.bin');
  const render = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true });
  render.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  render.shadowMap.enabled = true;
  render.shadowMap.type = THREE.PCFSoftShadowMap;
  render.outputColorSpace = THREE.SRGBColorSpace;
  render.toneMapping = THREE.ACESFilmicToneMapping;
  render.toneMappingExposure = 1.15;

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(28, 1, 1, 200);
  const centroY = datos.piso + datos.altura * 0.44;

  escena.add(new THREE.HemisphereLight(0xfff3e2, 0x2a2420, 0.9));
  const clave = new THREE.DirectionalLight(0xffe2bd, 3.2);
  clave.position.set(-14, 20, 16);
  clave.castShadow = true;
  clave.shadow.mapSize.set(2048, 2048);
  Object.assign(clave.shadow.camera, { left: -10, right: 10, top: 12, bottom: -12, near: 1, far: 80 });
  clave.shadow.normalBias = 0.04;
  escena.add(clave);
  const contra = new THREE.DirectionalLight(0xbfd0ff, 1.6);
  contra.position.set(14, 10, -14);
  escena.add(contra);
  const relleno = new THREE.DirectionalLight(0xffffff, 0.45);
  relleno.position.set(10, 4, 18);
  escena.add(relleno);

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0 });
  const matLiso = new THREE.MeshStandardMaterial({ color: new THREE.Color('#e9e2d6'), roughness: 0.5, metalness: 0 });
  const pivote = new THREE.Group();
  escena.add(pivote);
  let actual: THREE.Group | null = null;
  const liberar = (o: THREE.Object3D) =>
    o.traverse((x) => {
      if (x instanceof THREE.Mesh) x.geometry.dispose();
    });
  const actualizar = (e: Estatua) => {
    if (actual) {
      pivote.remove(actual);
      liberar(actual);
    }
    actual = construir(datos, e, mat, matLiso);
    pivote.add(actual);
  };

  let vista: 'cuerpo' | 'cara' = 'cuerpo';
  const ubicarCamara = () => {
    if (vista === 'cara' && actual?.userData.cabeza) {
      const c = pivote.localToWorld((actual.userData.cabeza as THREE.Vector3).clone());
      const dist = Math.max(9.5, 9.5 * (0.75 / camara.aspect));
      camara.position.set(c.x, c.y + 0.3, c.z + dist);
      camara.lookAt(c.x, c.y - 0.1, c.z);
    } else {
      const dist = Math.max(46, 46 * (0.78 / camara.aspect));
      camara.position.set(0, centroY + 2, dist);
      camara.lookAt(0, centroY, 0);
    }
  };
  const ajustar = () => {
    const ancho = lienzo.clientWidth || 300;
    const alto = lienzo.clientHeight || 400;
    render.setSize(ancho, alto, false);
    camara.aspect = ancho / alto;
    camara.updateProjectionMatrix();
    ubicarCamara();
  };
  actualizar(inicial);
  ajustar();
  const obs = new ResizeObserver(ajustar);
  obs.observe(lienzo);

  let giro = 0.35;
  let arrastrando = false;
  let ultimoX = 0;
  let quieto = 0;
  const abajo = (ev: PointerEvent) => {
    arrastrando = true;
    ultimoX = ev.clientX;
    lienzo.setPointerCapture(ev.pointerId);
  };
  const mover = (ev: PointerEvent) => {
    if (!arrastrando) return;
    giro += (ev.clientX - ultimoX) * 0.01;
    ultimoX = ev.clientX;
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
    if (!arrastrando && ahora - quieto > 2500) giro += dt * 0.22;
    pivote.rotation.y = giro;
    ubicarCamara();
    render.render(escena, camara);
    cuadro = requestAnimationFrame(animar);
  };
  cuadro = requestAnimationFrame(animar);

  return {
    actualizar,
    enfocar(v) {
      vista = v;
      ubicarCamara();
    },
    fotos(etapas, ancho, alto) {
      // Se dibuja cada etapa de frente y se guarda como imagen; después vuelve todo como estaba.
      const guardado = actual;
      const giroAntes = pivote.rotation.y;
      const vistaAntes = vista;
      const tam = new THREE.Vector2();
      render.getSize(tam);
      const aspecto = camara.aspect;
      if (guardado) pivote.remove(guardado);
      render.setSize(ancho, alto, false);
      camara.aspect = ancho / alto;
      camara.updateProjectionMatrix();
      vista = 'cuerpo';
      pivote.rotation.y = 0.25;
      camara.position.set(0, centroY + 1.5, 39);
      camara.lookAt(0, centroY - 0.2, 0);
      const salida: string[] = [];
      for (const e of etapas) {
        const g = construir(datos, e, mat, matLiso);
        pivote.add(g);
        render.render(escena, camara);
        salida.push(lienzo.toDataURL('image/png'));
        pivote.remove(g);
        liberar(g);
      }
      if (guardado) pivote.add(guardado);
      pivote.rotation.y = giroAntes;
      vista = vistaAntes;
      render.setSize(tam.x, tam.y, false);
      camara.aspect = aspecto;
      camara.updateProjectionMatrix();
      ubicarCamara();
      render.render(escena, camara);
      return salida;
    },
    destruir() {
      cancelAnimationFrame(cuadro);
      obs.disconnect();
      lienzo.removeEventListener('pointerdown', abajo);
      lienzo.removeEventListener('pointermove', mover);
      lienzo.removeEventListener('pointerup', soltar);
      lienzo.removeEventListener('pointercancel', soltar);
      if (actual) liberar(actual);
      mat.dispose();
      matLiso.dispose();
      render.dispose();
    },
  };
}
