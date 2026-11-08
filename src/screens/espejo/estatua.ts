/**
 * El Espejo: tu reflejo como estatua de mármol, armado con formas simples (sin modelos descargados).
 * Todo se calcula en el celular: los parámetros (grasa, músculo, postura y rasgos) deforman el cuerpo.
 */
import * as THREE from 'three';

export type Cara = 'ovalada' | 'redonda' | 'cuadrada';
export type Pelo = 'corto' | 'rulos' | 'largo' | 'calvo';
export type Barba = 'ninguna' | 'corta' | 'larga';

export interface Reflejo {
  /** 0 = muy delgado · 0,5 = normal · 1 = mucha grasa */
  grasa: number;
  /** 0 = sin músculo marcado · 1 = muy musculoso */
  musculo: number;
  /** 0 = encorvado · 1 = erguido */
  postura: number;
  cara: Cara;
  pelo: Pelo;
  barba: Barba;
  lentes: boolean;
}

export const REFLEJO_INICIAL: Reflejo = { grasa: 0.5, musculo: 0.3, postura: 0.6, cara: 'ovalada', pelo: 'corto', barba: 'ninguna', lentes: false };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Textura de mármol: fondo cálido con vetas suaves (se dibuja una vez). */
function texturaMarmol(): THREE.CanvasTexture {
  const tam = 512;
  const lienzo = document.createElement('canvas');
  lienzo.width = tam;
  lienzo.height = tam;
  const ctx = lienzo.getContext('2d')!;
  ctx.fillStyle = '#efe9df';
  ctx.fillRect(0, 0, tam, tam);
  let semilla = 7;
  const azar = () => {
    semilla = (semilla * 16807) % 2147483647;
    return semilla / 2147483647;
  };
  // Manchas muy suaves
  for (let i = 0; i < 40; i++) {
    const g = ctx.createRadialGradient(azar() * tam, azar() * tam, 0, azar() * tam, azar() * tam, 60 + azar() * 120);
    g.addColorStop(0, 'rgba(214,204,188,0.25)');
    g.addColorStop(1, 'rgba(214,204,188,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, tam, tam);
  }
  // Vetas
  for (let i = 0; i < 14; i++) {
    ctx.strokeStyle = `rgba(150,140,128,${0.12 + azar() * 0.2})`;
    ctx.lineWidth = 0.6 + azar() * 1.6;
    ctx.beginPath();
    let x = azar() * tam;
    let y = 0;
    ctx.moveTo(x, y);
    while (y < tam) {
      x += (azar() - 0.5) * 40;
      y += 10 + azar() * 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(lienzo);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Torso: perfil girado (como en un torno) y después deformado (panza al frente, pecho, ancho de espalda). */
function torso(r: Reflejo, mat: THREE.Material): THREE.Mesh {
  const g = r.grasa;
  const m = r.musculo;
  const hombro = lerp(0.16, 0.2, g) + m * 0.04;
  const cuello = 0.058 + g * 0.03 + m * 0.01;
  const alturas = [0, 0.08, 0.18, 0.28, 0.36, 0.42, 0.47, 0.51, 0.54];
  const radios = [
    lerp(0.13, 0.22, g), // cadera
    lerp(0.12, 0.23, g), // bajo vientre
    lerp(0.11, 0.24, g) - m * 0.01, // cintura
    lerp(0.13, 0.22, g) + m * 0.02, // estómago
    lerp(0.15, 0.21, g) + m * 0.035, // pecho
    hombro, // hombros
    lerp(hombro, cuello, 0.35), // caída de los hombros (trapecio)
    lerp(hombro, cuello, 0.75),
    cuello, // base del cuello
  ];
  const puntos = alturas.map((y, i) => new THREE.Vector2(radios[i], y));
  const geo = new THREE.LatheGeometry(new THREE.SplineCurve(puntos).getPoints(40), 48);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const frente = Math.max(0, v.z / Math.max(0.0001, Math.hypot(v.x, v.z))); // 1 al frente
    // Panza: crece al frente entre el bajo vientre y el estómago.
    const panza = Math.exp(-((v.y - 0.2) ** 2) / 0.008) * g * g * 0.14 * frente ** 1.5;
    // Pecho: un poco hacia adelante con músculo.
    const pecho = Math.exp(-((v.y - 0.39) ** 2) / 0.003) * m * 0.03 * frente;
    const escalaX = 1.3 + m * 0.12 - g * 0.05; // hombros anchos con músculo
    v.x *= escalaX;
    v.z = v.z * (0.72 + g * 0.18) + (panza + pecho);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

/** Manto (himation) de la cintura a los pies, con pliegues. */
function manto(r: Reflejo, mat: THREE.Material): THREE.Mesh {
  const g = r.grasa;
  const puntos = [
    new THREE.Vector2(lerp(0.15, 0.25, g), 0.95),
    new THREE.Vector2(lerp(0.17, 0.27, g), 0.82),
    new THREE.Vector2(lerp(0.18, 0.27, g), 0.55),
    new THREE.Vector2(lerp(0.2, 0.28, g), 0.25),
    new THREE.Vector2(lerp(0.24, 0.3, g), 0.06),
    new THREE.Vector2(lerp(0.25, 0.31, g), 0.0),
  ];
  const geo = new THREE.LatheGeometry(new THREE.SplineCurve(puntos).getPoints(30), 64);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const ang = Math.atan2(v.z, v.x);
    const caida = 1 - v.y / 0.95; // más pliegue abajo
    const pliegue = 1 + Math.sin(ang * 9 + v.y * 4) * 0.045 * caida + Math.sin(ang * 23) * 0.012 * caida;
    pos.setXYZ(i, v.x * pliegue * 1.15, v.y, v.z * pliegue * 0.85);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

function capsula(radio: number, largo: number, mat: THREE.Material) {
  return new THREE.Mesh(new THREE.CapsuleGeometry(radio, largo, 8, 16), mat);
}

/** Cabeza con rasgos: forma de cara, cachetes y papada según la grasa, pelo, barba y lentes. */
function cabeza(r: Reflejo, mat: THREE.Material, oscuro: THREE.Material): THREE.Group {
  const g = r.grasa;
  const grupo = new THREE.Group();
  const anchoCara = { ovalada: 1, redonda: 1.1, cuadrada: 1.06 }[r.cara] + g * 0.14;
  const altoCara = { ovalada: 1.22, redonda: 1.08, cuadrada: 1.14 }[r.cara];
  const craneo = new THREE.Mesh(new THREE.SphereGeometry(0.105, 40, 32), mat);
  craneo.scale.set(anchoCara, altoCara, 1.05 + g * 0.06);
  grupo.add(craneo);

  // Mandíbula: más marcada en cara cuadrada, más blanda con grasa.
  const mandibula = new THREE.Mesh(new THREE.SphereGeometry(0.08, 32, 24), mat);
  mandibula.position.set(0, -0.06, 0.022);
  mandibula.scale.set(anchoCara * (r.cara === 'cuadrada' ? 1.18 : 1.02), 0.85, 1);
  grupo.add(mandibula);

  // Cachetes y papada
  if (g > 0.45) {
    const t = (g - 0.45) / 0.55;
    for (const lado of [-1, 1]) {
      const cachete = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 16), mat);
      cachete.position.set(lado * 0.052 * anchoCara, -0.04, 0.062);
      cachete.scale.set(0.55 + t * 0.45, 0.5 + t * 0.4, 0.5 + t * 0.35);
      grupo.add(cachete);
    }
    const papada = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 16), mat);
    papada.position.set(0, -0.115, 0.03);
    papada.scale.set(1.2 + t * 0.5, 0.45 + t * 0.4, 0.9 + t * 0.3);
    grupo.add(papada);
  }

  // Nariz, cejas, ojos (como en las estatuas: sin pupila, apenas una sombra) y orejas.
  const nariz = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 12), mat);
  nariz.position.set(0, -0.005, 0.112);
  nariz.rotation.x = Math.PI * 0.42;
  grupo.add(nariz);
  for (const lado of [-1, 1]) {
    const ojo = new THREE.Mesh(new THREE.SphereGeometry(0.013, 16, 12), oscuro);
    ojo.position.set(lado * 0.04, 0.025, 0.093);
    ojo.scale.set(1.4, 0.7, 0.5);
    grupo.add(ojo);
    const ceja = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.035, 4, 8), mat);
    ceja.position.set(lado * 0.042, 0.048, 0.098);
    ceja.rotation.z = Math.PI / 2 - lado * 0.06;
    grupo.add(ceja);
    const oreja = new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 12), mat);
    oreja.position.set(lado * 0.105 * anchoCara, 0.005, -0.005);
    oreja.scale.set(0.45, 1.1, 0.8);
    grupo.add(oreja);
  }
  const boca = new THREE.Mesh(new THREE.CapsuleGeometry(0.005, 0.03, 4, 8), oscuro);
  boca.position.set(0, -0.06, 0.098);
  boca.rotation.z = Math.PI / 2;
  grupo.add(boca);

  // Pelo
  if (r.pelo === 'corto' || r.pelo === 'largo') {
    const casco = new THREE.Mesh(new THREE.SphereGeometry(0.112, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.5), mat);
    casco.scale.set(anchoCara * 1.02, altoCara * 1.0, 1.08);
    casco.position.y = 0.012;
    casco.rotation.x = -0.25;
    grupo.add(casco);
    if (r.pelo === 'largo') {
      const melena = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.2, 32, 1, true, Math.PI * 0.6, Math.PI * 0.8), mat);
      melena.material = mat;
      melena.position.set(0, -0.06, -0.01);
      melena.scale.x = anchoCara;
      grupo.add(melena);
    }
  } else if (r.pelo === 'rulos') {
    // Rulos como en los bustos griegos: bolitas sobre la cabeza.
    let semilla = 3;
    const azar = () => ((semilla = (semilla * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 70; i++) {
      const tita = azar() * Math.PI * 2;
      const fi = azar() * Math.PI * 0.42;
      const rulo = new THREE.Mesh(new THREE.SphereGeometry(0.022 + azar() * 0.008, 10, 8), mat);
      const x = Math.sin(fi) * Math.cos(tita);
      const z = Math.sin(fi) * Math.sin(tita);
      const y = Math.cos(fi);
      if (z > 0.55 && y < 0.75) continue; // la frente queda libre
      rulo.position.set(x * 0.108 * anchoCara, y * 0.108 * altoCara + 0.01, z * 0.11 - 0.008);
      grupo.add(rulo);
    }
  }

  // Barba
  if (r.barba !== 'ninguna') {
    const larga = r.barba === 'larga';
    const barba = new THREE.Mesh(new THREE.SphereGeometry(0.095, 32, 24, 0, Math.PI * 2, Math.PI * 0.58, Math.PI * 0.42), mat);
    barba.position.set(0, -0.02, 0.028);
    barba.scale.set(anchoCara * 1.04, larga ? 2.1 : 1.25, 1.1);
    grupo.add(barba);
    const bigote = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.045, 4, 8), mat);
    bigote.position.set(0, -0.045, 0.104);
    bigote.rotation.z = Math.PI / 2;
    grupo.add(bigote);
  }

  // Lentes
  if (r.lentes) {
    for (const lado of [-1, 1]) {
      const aro = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.004, 8, 24), oscuro);
      aro.position.set(lado * 0.042, 0.022, 0.112);
      grupo.add(aro);
      const patilla = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.1, 6), oscuro);
      patilla.rotation.x = Math.PI / 2;
      patilla.position.set(lado * 0.075 * anchoCara, 0.024, 0.06);
      grupo.add(patilla);
    }
    const puente = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.03, 6), oscuro);
    puente.rotation.z = Math.PI / 2;
    puente.position.set(0, 0.026, 0.114);
    grupo.add(puente);
  }
  return grupo;
}

/** Arma la estatua entera para un reflejo. */
function estatua(r: Reflejo, mat: THREE.Material, oscuro: THREE.Material): THREE.Group {
  const g = r.grasa;
  const m = r.musculo;
  const raiz = new THREE.Group();

  // Pedestal
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.12, 64), mat);
  pedestal.position.y = -0.06;
  raiz.add(pedestal);
  const zocalo = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.48, 0.04, 64), mat);
  zocalo.position.y = -0.14;
  raiz.add(zocalo);

  raiz.add(manto(r, mat));

  // Parte de arriba (se inclina con la postura).
  const arriba = new THREE.Group();
  arriba.position.y = 0.93;
  const inclinacion = (1 - r.postura) * 0.32;
  arriba.rotation.x = inclinacion;
  raiz.add(arriba);
  arriba.add(torso(r, mat));

  // Brazos
  const anchoHombro = (lerp(0.16, 0.2, g) + m * 0.04) * (1.3 + m * 0.12 - g * 0.05);
  for (const lado of [-1, 1]) {
    const brazo = new THREE.Group();
    brazo.position.set(lado * (anchoHombro - 0.012), 0.41, -0.005);
    brazo.rotation.z = lado * (0.12 + g * 0.18); // los brazos se separan más con más cuerpo
    brazo.rotation.x = -inclinacion * 0.6 - (1 - r.postura) * 0.15;
    const hombro = new THREE.Mesh(new THREE.SphereGeometry(0.05 + g * 0.022 + m * 0.022, 20, 16), mat);
    hombro.scale.set(1, 0.85, 0.95);
    brazo.add(hombro);
    const sup = capsula(0.042 + g * 0.03 + m * 0.018, 0.2, mat);
    sup.position.y = -0.14;
    brazo.add(sup);
    const inf = capsula(0.034 + g * 0.022 + m * 0.012, 0.19, mat);
    inf.position.set(0, -0.37, 0.02);
    inf.rotation.x = -0.08;
    brazo.add(inf);
    const mano = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 12), mat);
    mano.position.set(0, -0.5, 0.03);
    mano.scale.set(0.8, 1.2, 0.6);
    brazo.add(mano);
    arriba.add(brazo);
  }

  // Cuello y cabeza (la cabeza baja un poco si la postura es mala)
  const cuello = new THREE.Mesh(new THREE.CylinderGeometry(0.048 + g * 0.025, 0.06 + g * 0.03 + m * 0.01, 0.1, 24), mat);
  cuello.position.y = 0.56;
  arriba.add(cuello);
  const cab = cabeza(r, mat, oscuro);
  cab.position.set(0, 0.7, 0.01);
  cab.rotation.x = (1 - r.postura) * 0.25;
  arriba.add(cab);

  raiz.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true; // solo proyecta sombra en el piso (sombras propias dejaban manchas)
    }
  });
  return raiz;
}

export interface Escena {
  actualizar(r: Reflejo): void;
  destruir(): void;
}

/** Escena del espejo sobre un canvas: luz cálida, giro con el dedo y giro lento solo. */
export function crearEscena(lienzo: HTMLCanvasElement, inicial: Reflejo): Escena {
  const render = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true });
  render.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  render.shadowMap.enabled = true;
  render.shadowMap.type = THREE.PCFSoftShadowMap;
  render.outputColorSpace = THREE.SRGBColorSpace;
  render.toneMapping = THREE.ACESFilmicToneMapping;
  render.toneMappingExposure = 1.05;

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camara.position.set(0, 1.05, 4.3);
  camara.lookAt(0, 0.85, 0);

  escena.add(new THREE.HemisphereLight(0xfff6e8, 0x5a5040, 0.9));
  const clave = new THREE.DirectionalLight(0xffe7c4, 2.2);
  clave.position.set(2.2, 3.5, 2.6);
  clave.castShadow = true;
  clave.shadow.mapSize.set(1024, 1024);
  clave.shadow.camera.left = -1.2;
  clave.shadow.camera.right = 1.2;
  clave.shadow.camera.top = 2.2;
  clave.shadow.camera.bottom = -0.4;
  clave.shadow.bias = -0.0002;
  clave.shadow.normalBias = 0.025;
  escena.add(clave);
  const contra = new THREE.DirectionalLight(0xc8d6ff, 0.9);
  contra.position.set(-2.5, 2, -2.5);
  escena.add(contra);

  // Sombra en el piso
  const piso = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48), new THREE.ShadowMaterial({ opacity: 0.22 }));
  piso.rotation.x = -Math.PI / 2;
  piso.position.y = -0.16;
  piso.receiveShadow = true;
  escena.add(piso);

  const mapa = texturaMarmol();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: mapa, roughness: 0.42, metalness: 0 });
  const oscuro = new THREE.MeshStandardMaterial({ color: 0x8c8274, roughness: 0.7 });

  const pivote = new THREE.Group();
  escena.add(pivote);
  let actual: THREE.Group | null = null;

  const liberar = (o: THREE.Object3D) =>
    o.traverse((x) => {
      if (x instanceof THREE.Mesh) x.geometry.dispose();
    });

  const actualizar = (r: Reflejo) => {
    if (actual) {
      pivote.remove(actual);
      liberar(actual);
    }
    actual = estatua(r, mat, oscuro);
    pivote.add(actual);
  };
  actualizar(inicial);

  // Tamaño
  const ajustar = () => {
    const ancho = lienzo.clientWidth || 300;
    const alto = lienzo.clientHeight || 400;
    render.setSize(ancho, alto, false);
    camara.aspect = ancho / alto;
    camara.updateProjectionMatrix();
  };
  ajustar();
  const obs = new ResizeObserver(ajustar);
  obs.observe(lienzo);

  // Girar con el dedo o el mouse; si lo soltás, sigue girando despacio.
  let giro = 0.35;
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
  const arriba = () => {
    arrastrando = false;
    quieto = performance.now();
  };
  lienzo.addEventListener('pointerdown', abajo);
  lienzo.addEventListener('pointermove', mover);
  lienzo.addEventListener('pointerup', arriba);
  lienzo.addEventListener('pointercancel', arriba);

  let cuadro = 0;
  let antes = performance.now();
  const animar = (ahora: number) => {
    const dt = Math.min(0.05, (ahora - antes) / 1000);
    antes = ahora;
    if (!arrastrando && ahora - quieto > 2500) giro += dt * 0.25;
    pivote.rotation.y = giro;
    render.render(escena, camara);
    cuadro = requestAnimationFrame(animar);
  };
  cuadro = requestAnimationFrame(animar);

  return {
    actualizar,
    destruir() {
      cancelAnimationFrame(cuadro);
      obs.disconnect();
      lienzo.removeEventListener('pointerdown', abajo);
      lienzo.removeEventListener('pointermove', mover);
      lienzo.removeEventListener('pointerup', arriba);
      lienzo.removeEventListener('pointercancel', arriba);
      if (actual) liberar(actual);
      mapa.dispose();
      mat.dispose();
      oscuro.dispose();
      render.dispose();
    },
  };
}
