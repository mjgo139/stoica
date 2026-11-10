/**
 * Sonido del jardín, generado en el momento con Web Audio (sin archivos de audio):
 * fuente de agua y brisa siempre; pájaros de día; grillos y algún búho de noche;
 * chapoteo al regar y una nota de lira cuando una planta crece.
 */
export interface SonidoJardin {
  noche(es: boolean): void;
  regar(): void;
  lira(): void;
  detener(): void;
}

function ruido(ctx: AudioContext, segundos = 4): AudioBuffer {
  const b = ctx.createBuffer(1, ctx.sampleRate * segundos, ctx.sampleRate);
  const d = b.getChannelData(0);
  // Ruido "rosado" aproximado (más suave que el blanco)
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
  }
  return b;
}

export function crearSonido(): SonidoJardin {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const maestro = ctx.createGain();
  maestro.gain.value = 0;
  // Volumen bajo: es un fondo, no tiene que tapar nada.
  maestro.gain.linearRampToValueAtTime(0.28, ctx.currentTime + 2.5);
  maestro.connect(ctx.destination);
  const buf = ruido(ctx);

  const fuenteRuido = (filtro: BiquadFilterType, f: number, q: number, vol: number) => {
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    const bq = ctx.createBiquadFilter();
    bq.type = filtro;
    bq.frequency.value = f;
    bq.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = vol;
    s.connect(bq).connect(g).connect(maestro);
    s.start();
    return { s, g, bq };
  };

  // Fuente: agua que cae (banda media) con un leve vaivén
  const agua = fuenteRuido('bandpass', 900, 0.6, 0.22);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.23;
  const lfoG = ctx.createGain();
  lfoG.gain.value = 0.05;
  lfo.connect(lfoG).connect(agua.g.gain);
  lfo.start();
  const chorrito = fuenteRuido('highpass', 3200, 0.5, 0.035);
  // Brisa: grave, que sube y baja despacio
  const brisa = fuenteRuido('lowpass', 380, 0.7, 0.07);
  const lfo2 = ctx.createOscillator();
  lfo2.frequency.value = 0.07;
  const lfo2G = ctx.createGain();
  lfo2G.gain.value = 0.05;
  lfo2.connect(lfo2G).connect(brisa.g.gain);
  lfo2.start();

  let esNoche = false;
  let vivo = true;
  const timers: number[] = [];
  const despues = (ms: number, f: () => void) => {
    timers.push(window.setTimeout(() => vivo && f(), ms));
  };

  const pio = (t: number, f0: number, f1: number, dur: number, vol: number) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner();
    p.pan.value = Math.random() * 1.6 - 0.8;
    o.connect(g).connect(p).connect(maestro);
    o.start(t);
    o.stop(t + dur + 0.05);
  };

  // Pájaros (día): frases cortas de 2 a 5 trinos
  const pajaro = () => {
    if (!esNoche) {
      let t = ctx.currentTime + 0.05;
      const base = 2400 + Math.random() * 1800;
      const n = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        pio(t, base * (0.9 + Math.random() * 0.3), base * (1.15 + Math.random() * 0.4), 0.07 + Math.random() * 0.08, 0.05);
        t += 0.09 + Math.random() * 0.1;
      }
    }
    despues(2500 + Math.random() * 6000, pajaro);
  };
  // Grillos (noche): pulsos agudos en ráfagas
  const grillo = () => {
    if (esNoche) {
      let t = ctx.currentTime + 0.02;
      const f = 4200 + Math.random() * 500;
      for (let i = 0; i < 3; i++) {
        pio(t, f, f * 0.98, 0.035, 0.018);
        t += 0.055;
      }
    }
    despues(700 + Math.random() * 900, grillo);
  };
  // Búho (noche, de vez en cuando)
  const buho = () => {
    if (esNoche && Math.random() < 0.6) {
      const t = ctx.currentTime + 0.05;
      pio(t, 420, 380, 0.35, 0.05);
      pio(t + 0.55, 430, 360, 0.6, 0.05);
    }
    despues(14000 + Math.random() * 20000, buho);
  };
  pajaro();
  grillo();
  despues(8000, buho);

  return {
    noche(es) {
      esNoche = es;
      chorrito.g.gain.setTargetAtTime(es ? 0.02 : 0.035, ctx.currentTime, 1);
    },
    regar() {
      if (ctx.state === 'suspended') void ctx.resume();
      const t = ctx.currentTime;
      const s = ctx.createBufferSource();
      s.buffer = buf;
      const bq = ctx.createBiquadFilter();
      bq.type = 'bandpass';
      bq.frequency.value = 1800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
      s.connect(bq).connect(g).connect(maestro);
      s.start(t);
      s.stop(t + 1.4);
      // Gotitas
      for (let i = 0; i < 7; i++) pio(t + 0.1 + Math.random() * 1, 900 + Math.random() * 900, 1800 + Math.random() * 900, 0.05, 0.04);
    },
    lira() {
      // Arpegio de lira (dórico): notas que se apagan como cuerdas pulsadas
      const notas = [293.66, 349.23, 440, 523.25];
      notas.forEach((f, i) => {
        const t = ctx.currentTime + i * 0.12;
        [1, 2, 3].forEach((arm, k) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'triangle';
          o.frequency.value = f * arm;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.06 / (k + 1), t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
          o.connect(g).connect(maestro);
          o.start(t);
          o.stop(t + 1.7);
        });
      });
    },
    detener() {
      vivo = false;
      timers.forEach(clearTimeout);
      maestro.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      window.setTimeout(() => void ctx.close(), 600);
    },
  };
}
