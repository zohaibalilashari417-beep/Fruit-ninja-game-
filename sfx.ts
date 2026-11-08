/** Tiny procedural sound engine — no assets, all synthesized Web Audio. */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = false;
let lastSlice = 0;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 0.4);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function now() {
  return ctx ? ctx.currentTime : 0;
}

function env(node: AudioNode, a: number, d: number, peak: number) {
  if (!ctx || !master) return null;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now());
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now() + a);
  g.gain.exponentialRampToValueAtTime(0.0001, now() + a + d);
  node.connect(g);
  g.connect(master);
  return g;
}

export const sfx = {
  get muted() {
    return muted;
  },
  toggle() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  },
  unlock() {
    ensure();
  },
  slice(pitch = 1) {
    const c = ensure();
    if (!c || muted || !noiseBuf) return;
    const t = now();
    if (t - lastSlice < 0.02) return;
    lastSlice = t;
    // airy "shhk"
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(1600 * pitch, t);
    bp.frequency.exponentialRampToValueAtTime(5200 * pitch, t + 0.09);
    bp.Q.value = 1.4;
    src.connect(bp);
    env(bp, 0.005, 0.11, 0.24);
    src.start(t);
    src.stop(t + 0.2);
    // wet body
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(420 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.13);
    env(o, 0.004, 0.13, 0.16);
    o.start(t);
    o.stop(t + 0.22);
  },
  combo(n: number) {
    const c = ensure();
    if (!c || muted) return;
    const t = now();
    const base = 520 + Math.min(6, n) * 90;
    [0, 0.055, 0.11].forEach((d, i) => {
      const o = c.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(base * Math.pow(1.26, i), t + d);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.16, t + d + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.16);
      o.connect(g);
      g.connect(master!);
      o.start(t + d);
      o.stop(t + d + 0.2);
    });
  },
  bomb() {
    const c = ensure();
    if (!c || muted || !noiseBuf) return;
    const t = now();
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = 0.5;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(1800, t);
    lp.frequency.exponentialRampToValueAtTime(120, t + 0.5);
    src.connect(lp);
    env(lp, 0.005, 0.55, 0.55);
    src.start(t);
    src.stop(t + 0.7);
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.5);
    env(o, 0.005, 0.5, 0.6);
    o.start(t);
    o.stop(t + 0.7);
  },
  miss() {
    const c = ensure();
    if (!c || muted) return;
    const t = now();
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(260, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.32);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    o.connect(lp);
    env(lp, 0.01, 0.32, 0.2);
    o.start(t);
    o.stop(t + 0.4);
  },
  power(kind: "frost" | "star") {
    const c = ensure();
    if (!c || muted) return;
    const t = now();
    const o = c.createOscillator();
    o.type = kind === "frost" ? "sine" : "square";
    const f0 = kind === "frost" ? 700 : 480;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(kind === "frost" ? 2600 : 1500, t + 0.3);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2400;
    o.connect(lp);
    env(lp, 0.01, 0.36, 0.16);
    o.start(t);
    o.stop(t + 0.45);
  },
  ui(up = true) {
    const c = ensure();
    if (!c || muted) return;
    const t = now();
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(up ? 420 : 300, t);
    o.frequency.exponentialRampToValueAtTime(up ? 700 : 190, t + 0.09);
    env(o, 0.005, 0.1, 0.12);
    o.start(t);
    o.stop(t + 0.16);
  },
  levelUp() {
    const c = ensure();
    if (!c || muted) return;
    const t = now();
    [523, 659, 784, 1046].forEach((f, i) => {
      const o = c.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      const g = c.createGain();
      const d = t + i * 0.09;
      g.gain.setValueAtTime(0.0001, d);
      g.gain.exponentialRampToValueAtTime(0.18, d + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, d + 0.28);
      o.connect(g);
      g.connect(master!);
      o.start(d);
      o.stop(d + 0.34);
    });
  },
};
