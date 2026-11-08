import { FRUITS, getSprite, makeBlobSprite, prepareSprites, type FruitKey, type Sprite } from "./art";
import { LEVELS, MAX_VW, MIN_VW, TUNING, VH, levelAt, type LevelDef } from "./levels";
import { sfx } from "./sfx";

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const pick = <T,>(arr: T[]) => arr[(Math.random() * arr.length) | 0];

export type GameState = "menu" | "playing" | "paused" | "levelclear" | "gameover";

export type Hud = {
  state: GameState;
  score: number;
  lives: number;
  level: number;
  levelName: string;
  levelSub: string;
  progress: number;
  combo: number;
  multiplier: number;
  focus: number;
  fruits: number;
  bestCombo: number;
  lastLevelScore: number;
  perfect: boolean;
};

type Kind = "fruit" | "bomb" | "frost" | "star";

type Fruit = {
  key: FruitKey;
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  vrot: number;
  born: number;
  delay: number;
  sliced: boolean;
};

type Piece = {
  key: FruitKey;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  angle: number;
  life: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: "drop" | "spark" | "chunk";
  rot: number;
  vrot: number;
  grav: number;
};

type Popup = { x: number; y: number; text: string; color: string; life: number; max: number; size: number; vy: number };
type Slash = { x: number; y: number; a: number; len: number; life: number; color: string };
type TrailPt = { x: number; y: number; t: number };

function segCircle(x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, r: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let t = 0;
  if (l2 > 0.0001) {
    t = ((cx - x1) * dx + (cy - y1) * dy) / l2;
    t = clamp(t, 0, 1);
  }
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  const ex = cx - px;
  const ey = cy - py;
  return ex * ex + ey * ey <= r * r;
}

function tintBlob(blob: HTMLCanvasElement, color: string) {
  const c = document.createElement("canvas");
  c.width = c.height = blob.width;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(blob, 0, 0);
  return c;
}

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dpr = 1;
  scale = 1;
  quality = 1;
  view = { w: 1280, h: VH };
  css = { w: 1280, h: 720 };

  state: GameState = "menu";
  onHud: (h: Hud) => void = () => {};
  onState: (s: GameState) => void = () => {};

  // gameplay
  levelIndex = 0;
  level!: LevelDef;
  score = 0;
  levelScore = 0;
  lastLevelScore = 0;
  lives = TUNING.lives;
  fruitsSliced = 0;
  bestCombo = 0;
  combo = 0;
  comboT = 0;
  multiplier = 1;
  starT = 0;
  slowT = 0;
  focusT = 0;
  perfect = true;
  waveQueue: number[] = [];
  waveTimer = 0;
  spawnedTotal = 0;
  spawnedCount = 0;
  progressCount = 0;
  runId = 0;
  clearDelay = 0;
  bannerT = 0;
  bannerText = "";
  bannerSub = "";

  // entities
  fruits: Fruit[] = [];
  pieces: Piece[] = [];
  parts: Particle[] = [];
  pops: Popup[] = [];
  slashes: Slash[] = [];
  trail: TrailPt[] = [];

  // fx
  shake = 0;
  flash = 0;
  flashColor = "255,80,60";
  hitStop = 0;
  punch = 0;
  timeScale = 1;
  tFrozen = 0;

  // input
  blade = { x: 0, y: 0, px: 0, py: 0, speed: 0, active: false, source: "none" as "mouse" | "touch" | "keys" | "none" };
  keys = new Set<string>();
  pending: { x1: number; y1: number; x2: number; y2: number; sp: number }[] = [];
  hintSlices = 0;
  private lastMoveT = 0;

  private bg: HTMLCanvasElement | null = null;
  private stain: HTMLCanvasElement | null = null;
  private blob = makeBlobSprite();
  private glows: Record<string, HTMLCanvasElement> = {};
  private raf = 0;
  private last = 0;
  private lastHud = "";
  private time = 0;
  private running = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    prepareSprites();
    this.glows.warm = tintBlob(this.blob, "#ff8a3d");
    this.glows.cool = tintBlob(this.blob, "#7ee8ff");
    this.glows.gold = tintBlob(this.blob, "#ffd166");
    this.glows.white = tintBlob(this.blob, "#ffffff");
    this.level = LEVELS[0];
    this.blade.x = this.blade.px = 640;
    this.blade.y = this.blade.py = 360;
  }

  /* --------------------------------------------------------------- setup */

  resize(cssW: number, cssH: number, dprIn: number) {
    if (cssW < 2 || cssH < 2) return;
    this.css.w = cssW;
    this.css.h = cssH;
    let dpr = clamp(dprIn, 1, 2);
    const maxPix = 4_400_000;
    if (cssW * cssH * dpr * dpr > maxPix) dpr = Math.max(1, Math.sqrt(maxPix / (cssW * cssH)));
    this.dpr = dpr;
    this.scale = Math.max(Math.min(cssH / VH, cssW / MIN_VW), cssW / MAX_VW);
    this.view.w = cssW / this.scale;
    this.view.h = cssH / this.scale;
    // narrow viewports (phones) get a lighter particle budget to hold 60fps
    this.quality = this.view.w < 780 ? 0.62 : 1;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.buildBackground();
    this.stain = null;
    this.blade.x = clamp(this.blade.x, 0, this.view.w);
  }

  private buildBackground() {
    const p = this.level.palette;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, w * 0.35, h);
    g.addColorStop(0, p.top);
    g.addColorStop(1, p.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const S = this.scale * this.dpr;
    const glow = (x: number, y: number, r: number, color: string, a: number) => {
      const rad = r * S;
      const rg = ctx.createRadialGradient(x * S, y * S, 0, x * S, y * S, rad);
      rg.addColorStop(0, `rgba(${color},${a})`);
      rg.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = rg;
      ctx.fillRect(x * S - rad, y * S - rad, rad * 2, rad * 2);
    };
    glow(this.view.w * 0.5, this.view.h * 0.34, 520, hexA(p.glow), 0.5);
    glow(this.view.w * 0.12, this.view.h * 0.78, 340, hexA(p.glow), 0.34);
    glow(this.view.w * 0.88, this.view.h * 0.72, 320, hexA(p.accent), 0.3);

    // subtle vertical blinds, gives the dojo some structure
    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    ctx.lineWidth = Math.max(1, 26 * S);
    const step = 150 * S;
    for (let x = -step; x < w + step; x += step * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 120 * S, h);
      ctx.stroke();
    }
    // vignette
    const v = ctx.createRadialGradient(w / 2, h * 0.48, Math.min(w, h) * 0.28, w / 2, h * 0.5, Math.max(w, h) * 0.78);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.62)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
    this.bg = c;
  }

  private stainLayer() {
    if (!this.stain || this.stain.width !== this.canvas.width) {
      const c = document.createElement("canvas");
      c.width = this.canvas.width;
      c.height = this.canvas.height;
      this.stain = c;
    }
    return this.stain;
  }

  start() {
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.05) dt = 0.05;
      if (dt <= 0) dt = 1 / 120;
      this.frame(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /* --------------------------------------------------------- state flow */

  private setState(s: GameState) {
    this.state = s;
    this.onState(s);
    this.pushHud(true);
  }

  private loadLevel(index: number) {
    this.levelIndex = index;
    this.level = levelAt(index);
    this.waveQueue = [];
    for (let i = 0; i < this.level.waves; i++) {
      const [lo, hi] = this.level.perWave;
      this.waveQueue.push(Math.round(rand(lo, hi)));
    }
    this.spawnedTotal = this.waveQueue.reduce((a, b) => a + b, 0);
    this.spawnedCount = 0;
    this.progressCount = 0;
    this.runId++;
    this.waveTimer = 0.35;
    this.levelScore = 0;
    this.clearDelay = 0;
    this.perfect = true;
    this.fruits.length = 0;
    this.pieces.length = 0;
    this.parts.length = 0;
    this.combo = 0;
    this.comboT = 0;
    this.multiplier = 1;
    this.starT = 0;
    this.slowT = 0;
    this.bannerText = `LEVEL ${index + 1}`;
    this.bannerSub = this.level.name;
    this.bannerT = 1.9;
    this.buildBackground();
    this.stain = null;
  }

  newGame() {
    this.score = 0;
    this.lastLevelScore = 0;
    this.lives = TUNING.lives;
    this.fruitsSliced = 0;
    this.bestCombo = 0;
    this.hintSlices = 0;
    this.pops.length = 0;
    this.slashes.length = 0;
    this.loadLevel(0);
    this.setState("playing");
  }

  nextLevel() {
    this.loadLevel(this.levelIndex + 1);
    this.setState("playing");
  }

  retry() {
    this.newGame();
  }

  toMenu() {
    this.fruits.length = 0;
    this.pieces.length = 0;
    this.parts.length = 0;
    this.pops.length = 0;
    this.slashes.length = 0;
    this.level = LEVELS[0];
    this.levelIndex = 0;
    this.buildBackground();
    this.setState("menu");
  }

  pause() {
    if (this.state === "playing") this.setState("paused");
  }

  resume() {
    if (this.state === "paused") {
      this.last = performance.now();
      this.setState("playing");
    }
  }

  togglePause() {
    if (this.state === "playing") this.pause();
    else if (this.state === "paused") this.resume();
  }

  /* -------------------------------------------------------------- input */

  private toVirtual(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / this.scale,
      y: (clientY - rect.top) / this.scale,
    };
  }

  pointerDown(clientX: number, clientY: number, type: "mouse" | "touch") {
    sfx.unlock();
    this.lastMoveT = performance.now();
    const p = this.toVirtual(clientX, clientY);
    this.blade.x = p.x;
    this.blade.y = p.y;
    this.blade.px = p.x;
    this.blade.py = p.y;
    this.blade.active = true;
    this.blade.source = type;
    this.trail.length = 0;
    this.trail.push({ x: p.x, y: p.y, t: this.time });
  }

  pointerMove(clientX: number, clientY: number, type: "mouse" | "touch", down: boolean) {
    const p = this.toVirtual(clientX, clientY);
    const b = this.blade;
    if (type === "mouse" || down) {
      if (!b.active || b.source === "keys") {
        b.active = true;
        b.x = b.px = p.x;
        b.y = b.py = p.y;
        b.source = type;
        this.trail.length = 0;
        this.lastMoveT = performance.now();
      }
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.6) {
        const nowT = performance.now();
        const dte = clamp((nowT - this.lastMoveT) / 1000, 0.006, 0.033);
        this.lastMoveT = nowT;
        const sp = dist / dte;
        if (sp > TUNING.bladeMinSpeed) this.pending.push({ x1: b.x, y1: b.y, x2: p.x, y2: p.y, sp });
        b.px = b.x;
        b.py = b.y;
        b.x = p.x;
        b.y = p.y;
        b.speed = sp;
        this.trail.push({ x: p.x, y: p.y, t: this.time });
      }
    } else if (b.source === type) {
      b.active = false;
      b.speed = 0;
    }
  }

  pointerUp(type: "mouse" | "touch") {
    if (this.blade.source === type) {
      this.blade.active = false;
      this.blade.speed = 0;
    }
  }

  keyDown(code: string) {
    sfx.unlock();
    this.keys.add(code);
    if (code === "Space") this.tryFocus();
  }

  keyUp(code: string) {
    this.keys.delete(code);
  }

  tryFocus() {
    if (this.state !== "playing") return;
    if (this.focusT > 0) return;
    this.focusT = TUNING.focusCooldown;
    this.slowT = Math.max(this.slowT, TUNING.focusDuration);
    this.flashColor = "126,232,255";
    this.flash = 0.55;
    this.shake = Math.max(this.shake, 7);
    this.addPopup(this.view.w / 2, this.view.h * 0.42, "FOCUS", "#7ee8ff", 54, -40);
    sfx.power("frost");
  }

  /* -------------------------------------------------------------- spawn */

  private spawnWave(count: number) {
    const view = this.view;
    for (let i = 0; i < count; i++) {
      const delay = i * rand(0.04, 0.14);
      const r = rand(0.08, 0.92);
      const x = view.w * r;
      const key = pick(this.level.fruits);
      const kind: Kind =
        key === "bomb" ? "bomb" : key === "frost" ? "frost" : key === "star" ? "star" : "fruit";
      const bombRoll = kind === "fruit" && Math.random() < this.level.bomb;
      const useKey: FruitKey = bombRoll ? "bomb" : key;
      const useDef = FRUITS[useKey];
      const apexY = rand(view.h * 0.05, view.h * 0.4);
      const startY = view.h + useDef.radius * 1.15;
      const rise = Math.max(120, startY - apexY);
      const vy = -Math.sqrt(2 * TUNING.gravity * rise);
      const t = Math.abs(vy) / TUNING.gravity;
      const targetX = clamp(x + rand(-view.w * 0.24, view.w * 0.24), view.w * 0.12, view.w * 0.88);
      let vx = (targetX - x) / Math.max(0.4, t * 1.55);
      vx = clamp(vx, -view.w * 0.4, view.w * 0.4);
      this.fruits.push({
        key: useKey,
        kind: bombRoll ? "bomb" : kind,
        x,
        y: startY,
        vx,
        vy,
        r: useDef.radius,
        rot: rand(0, TAU),
        vrot: rand(-2.6, 2.6),
        born: this.time,
        delay,
        sliced: false,
      });
    }
    this.spawnedCount += count;
  }

  /* -------------------------------------------------------------- slice */

  private slice(f: Fruit, angle: number) {
    f.sliced = true;
    const def = FRUITS[f.key];
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    const kick = TUNING.pieceKick;

    for (const dir of [1, -1]) {
      this.pieces.push({
        key: f.key,
        x: f.x + nx * dir * 3,
        y: f.y + ny * dir * 3,
        vx: f.vx * 0.72 + nx * dir * kick + rand(-25, 25),
        vy: f.vy * 0.72 + ny * dir * kick - rand(20, 110),
        rot: angle + (dir < 0 ? Math.PI : 0),
        vrot: f.vrot * 0.6 + dir * rand(1.4, 3.4),
        angle,
        life: 2.6,
      });
    }

    this.slashes.push({ x: f.x, y: f.y, a: angle, len: f.r * 2.7, life: 0.19, color: "255,255,255" });
    this.juice(f, angle, def.juice, def.juice2);

    if (f.kind === "bomb") {
      this.bombHit(f);
      return;
    }

    this.fruitsSliced++;
    this.progressCount++;
    this.hintSlices++;

    if (f.kind === "frost") {
      this.slowT = Math.max(this.slowT, 2.2);
      this.flashColor = "126,232,255";
      this.flash = 0.6;
      this.shake = Math.max(this.shake, 10);
      this.addPopup(f.x, f.y - f.r, "FROZEN!", "#7ee8ff", 40, -50);
      sfx.power("frost");
    } else if (f.kind === "star") {
      this.starT = TUNING.starDuration;
      this.multiplier = 2;
      this.flashColor = "255,209,102";
      this.flash = 0.45;
      this.shake = Math.max(this.shake, 8);
      this.addPopup(f.x, f.y - f.r, "DOUBLE POINTS!", "#ffd166", 36, -50);
      sfx.power("star");
    }

    this.combo++;
    this.comboT = TUNING.comboWindow;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;

    const comboBonus = this.combo > 1 ? (this.combo - 1) * 5 : 0;
    const gained = (def.points + comboBonus) * this.multiplier;
    this.score += gained;
    this.levelScore += gained;

    const c = this.combo;
    this.addPopup(
      f.x,
      f.y - f.r * 0.5,
      `+${gained}`,
      this.multiplier > 1 ? "#ffd166" : "#ffffff",
      c >= 3 ? 30 + Math.min(18, c * 2) : 26,
      -70,
    );
    if (c >= 3) {
      this.addPopup(f.x, f.y - f.r - 26, `COMBO x${c}`, "#ff5c8a", 26 + Math.min(14, c), -30);
      sfx.combo(c);
      this.shake = Math.max(this.shake, 5 + Math.min(10, c));
      this.punch = Math.min(1, this.punch + 0.35);
      if (c % 4 === 0) this.hitStop = 0.07;
    } else {
      this.shake = Math.max(this.shake, 3.2);
      this.punch = Math.min(1, this.punch + 0.14);
    }
    sfx.slice(1 + Math.min(0.5, f.r / 140));
    this.pushHud();
  }

  private bombHit(f: Fruit) {
    this.shake = 34;
    this.flashColor = "255,72,48";
    this.flash = 1;
    this.hitStop = 0.14;
    this.punch = 1;
    this.slowT = Math.max(this.slowT, 0.35);
    this.addPopup(f.x, f.y - f.r, "BOOM!", "#ff7b3d", 52, -30);
    const boomN = Math.round(46 * this.quality);
    for (let i = 0; i < boomN; i++) {
      const a = rand(0, TAU);
      const sp = rand(160, 900);
      this.parts.push({
        x: f.x,
        y: f.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 120,
        life: rand(0.35, 0.95),
        max: 0.95,
        size: rand(4, 15),
        color: i % 3 === 0 ? "#ffd166" : i % 3 === 1 ? "#ff7b3d" : "#ff3b3b",
        kind: "spark",
        rot: a,
        vrot: 0,
        grav: 700,
      });
    }
    this.stainSplat(f.x, f.y, f.r * 1.5, "rgba(30,16,10,0.5)");
    sfx.bomb();
    this.loseLife(true);
  }

  private juice(f: Fruit, angle: number, c1: string, c2: string) {
    const n = Math.round((16 + f.r / 5) * this.quality);
    for (let i = 0; i < n; i++) {
      const a = angle + rand(-1.15, 1.15) + (Math.random() < 0.5 ? Math.PI : 0);
      const sp = rand(90, 620);
      this.parts.push({
        x: f.x + rand(-f.r * 0.4, f.r * 0.4),
        y: f.y + rand(-f.r * 0.4, f.r * 0.4),
        vx: Math.cos(a) * sp + f.vx * 0.25,
        vy: Math.sin(a) * sp + f.vy * 0.2 - 60,
        life: rand(0.4, 1.0),
        max: 1.0,
        size: rand(4, 13) * (0.7 + f.r / 100),
        color: Math.random() < 0.3 ? c2 : c1,
        kind: "drop",
        rot: 0,
        vrot: 0,
        grav: TUNING.gravity * 0.72,
      });
    }
    for (let i = 0; i < 6; i++) {
      const a = angle + rand(-0.5, 0.5);
      this.parts.push({
        x: f.x,
        y: f.y,
        vx: Math.cos(a) * rand(60, 260),
        vy: Math.sin(a) * rand(60, 260) - 80,
        life: rand(0.5, 0.9),
        max: 0.9,
        size: rand(5, 11),
        color: c1,
        kind: "chunk",
        rot: rand(0, TAU),
        vrot: rand(-9, 9),
        grav: TUNING.gravity * 0.8,
      });
    }
    this.stainSplat(f.x, f.y, f.r, c1);
    if (this.parts.length > TUNING.maxParticles) {
      this.parts.splice(0, this.parts.length - TUNING.maxParticles);
    }
  }

  private addPopup(x: number, y: number, text: string, color: string, size: number, vy: number) {
    this.pops.push({
      x: clamp(x, 60, this.view.w - 60),
      y: clamp(y, 40, this.view.h - 20),
      text,
      color,
      life: 0.95,
      max: 0.95,
      size,
      vy,
    });
    if (this.pops.length > 22) this.pops.shift();
  }

  private stainSplat(x: number, y: number, r: number, color: string) {
    const layer = this.stainLayer();
    const ctx = layer.getContext("2d")!;
    const S = this.scale * this.dpr;
    ctx.save();
    ctx.translate(x * S, y * S);
    ctx.globalAlpha = 0.5;
    const blobs = 5;
    for (let i = 0; i < blobs; i++) {
      const a = (i / blobs) * TAU + rand(0, 1);
      const d = rand(0.15, 1.05) * r;
      const s = rand(0.35, 0.95) * r * 2 * S;
      ctx.save();
      ctx.translate(Math.cos(a) * d * S, Math.sin(a) * d * S);
      ctx.rotate(rand(0, TAU));
      ctx.globalAlpha = rand(0.22, 0.45);
      ctx.drawImage(this.blob, -s / 2, -s / 2, s, s);
      ctx.restore();
    }
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.32;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.8 * S, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  private loseLife(bomb: boolean) {
    if (this.state !== "playing" || this.lives <= 0) return;
    this.lives--;
    this.perfect = false;
    this.combo = 0;
    this.pushHud(true);
    if (this.lives <= 0) {
      this.lives = 0;
      this.lastLevelScore = this.levelScore;
      const id = this.runId;
      window.setTimeout(() => {
        if (this.runId === id && this.state === "playing") {
          this.setState("gameover");
        }
      }, bomb ? 460 : 130);
    }
  }

  /* --------------------------------------------------------------- loop */

  private frame(dtRaw: number) {
    this.time += dtRaw;
    // fx decay runs on real time
    this.shake *= Math.pow(0.0016, dtRaw);
    if (this.shake < 0.15) this.shake = 0;
    this.flash = Math.max(0, this.flash - dtRaw * 2.6);
    this.punch = Math.max(0, this.punch - dtRaw * 3.2);
    this.bannerT = Math.max(0, this.bannerT - dtRaw);

    const active = this.state === "playing";
    let target = 1;
    if (this.hitStop > 0) {
      this.hitStop -= dtRaw;
      target = 0.08;
    } else if (this.slowT > 0) {
      this.slowT -= dtRaw;
      target = TUNING.focusScale;
    }
    if (!active) target = this.state === "menu" ? 0.55 : 0;
    this.timeScale += (target - this.timeScale) * Math.min(1, dtRaw * 14);
    const dt = dtRaw * this.timeScale;

    if (active) {
      this.updateKeys(dtRaw);
      this.processCuts();
      this.updateSpawner(dt);
      this.updateFruits(dt);
      this.updatePieces(dt);
      this.comboT -= dtRaw;
      if (this.comboT <= 0 && this.combo !== 0) {
        this.combo = 0;
        this.pushHud();
      }
      if (this.starT > 0) {
        this.starT -= dtRaw;
        if (this.starT <= 0) {
          this.multiplier = 1;
          this.pushHud();
        }
      }
      if (this.focusT > 0) {
        this.focusT = Math.max(0, this.focusT - dtRaw);
        this.pushHud();
      }
      this.checkLevelClear(dtRaw);
    } else if (this.state === "menu") {
      this.updateMenuBounce(dt);
    }

    this.updateParticles(active || this.state === "menu" ? dt : dtRaw);
    this.updateEffects(dtRaw);
    this.render();
  }

  private updateMenuBounce(dt: number) {
    for (const f of this.fruits) {
      f.vy += TUNING.gravity * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.vrot * dt;
    }
    this.fruits = this.fruits.filter((f) => f.y < this.view.h + 200);
    if (this.fruits.length < 5 && Math.random() < dt * 1.6) {
      const keys: FruitKey[] = ["watermelon", "orange", "apple", "kiwi", "strawberry", "dragonfruit", "pineapple", "lemon"];
      const key = pick(keys);
      const def = FRUITS[key];
      this.fruits.push({
        key,
        kind: "fruit",
        x: rand(this.view.w * 0.1, this.view.w * 0.9),
        y: this.view.h + def.radius,
        vx: rand(-60, 60),
        vy: -rand(760, 1080),
        r: def.radius,
        rot: rand(0, TAU),
        vrot: rand(-2, 2),
        born: this.time,
        delay: 0,
        sliced: false,
      });
    }
  }

  private updateKeys(dt: number) {
    const k = this.keys;
    let ax = 0;
    let ay = 0;
    if (k.has("ArrowLeft") || k.has("KeyA")) ax -= 1;
    if (k.has("ArrowRight") || k.has("KeyD")) ax += 1;
    if (k.has("ArrowUp") || k.has("KeyW")) ay -= 1;
    if (k.has("ArrowDown") || k.has("KeyS")) ay += 1;
    if (ax || ay) {
      const m = Math.hypot(ax, ay) || 1;
      ax /= m;
      ay /= m;
    }
    const b = this.blade;
    if (b.source !== "keys" && (ax || ay)) {
      b.source = "keys";
      b.active = true;
      b.px = b.x;
      b.py = b.y;
    }
    if (b.source !== "keys") return;

    const accel = 6800;
    const maxSp = 1500;
    let vx = (b.x - b.px) / Math.max(0.001, dt);
    let vy = (b.y - b.py) / Math.max(0.001, dt);
    vx += ax * accel * dt;
    vy += ay * accel * dt;
    if (!ax && !ay) {
      const damp = Math.pow(0.0000004, dt);
      vx *= damp;
      vy *= damp;
    }
    const sp = Math.hypot(vx, vy);
    if (sp > maxSp) {
      vx = (vx / sp) * maxSp;
      vy = (vy / sp) * maxSp;
    }
    const nx = clamp(b.x + vx * dt, 12, this.view.w - 12);
    const ny = clamp(b.y + vy * dt, 12, this.view.h - 12);
    b.px = b.x;
    b.py = b.y;
    b.x = nx;
    b.y = ny;
    b.speed = Math.hypot(vx, vy);
    if (b.speed > 40) this.trail.push({ x: nx, y: ny, t: this.time });
    if (b.speed > TUNING.bladeMinSpeed) {
      this.pending.push({ x1: b.px, y1: b.py, x2: b.x, y2: b.y, sp: b.speed });
    }
  }

  private processCuts() {
    if (!this.pending.length) return;
    const segs = this.pending;
    this.pending = [];
    for (const s of segs) {
      const a = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      for (let i = this.fruits.length - 1; i >= 0; i--) {
        const f = this.fruits[i];
        if (f.sliced) continue;
        if (this.time - f.born < 0.05) continue;
        if (segCircle(s.x1, s.y1, s.x2, s.y2, f.x, f.y, f.r * 0.95)) {
          this.slice(f, a);
          this.fruits.splice(i, 1);
        }
      }
    }
  }

  private updateSpawner(dt: number) {
    if (this.waveQueue.length === 0) return;
    this.waveTimer -= dt;
    if (this.waveTimer <= 0) {
      const n = this.waveQueue.shift()!;
      this.spawnWave(n);
      const base = this.level.waveDelay;
      const remaining = this.waveQueue.length;
      this.waveTimer = remaining > 0 ? base + (remaining % 2 === 0 ? rand(0, 0.35) : rand(0, 0.15)) : 999;
    }
  }

  private updateFruits(dt: number) {
    const floor = this.view.h + 90;
    for (let i = this.fruits.length - 1; i >= 0; i--) {
      const f = this.fruits[i];
      if (this.time - f.born < f.delay) continue;
      f.vy += TUNING.gravity * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.vrot * dt;
      if (f.x < f.r * 0.35 && f.vx < 0) f.vx *= -0.86;
      if (f.x > this.view.w - f.r * 0.35 && f.vx > 0) f.vx *= -0.86;
      if (f.y > floor && f.vy > 0) {
        this.fruits.splice(i, 1);
        if (f.kind === "bomb") {
          this.progressCount++;
        } else {
          this.missFruit(f);
        }
      }
    }
  }

  private missFruit(f: Fruit) {
    const def = FRUITS[f.key];
    for (let i = 0; i < 10; i++) {
      const a = rand(-Math.PI * 0.9, -Math.PI * 0.1);
      this.parts.push({
        x: f.x,
        y: this.view.h - 6,
        vx: Math.cos(a) * rand(50, 240),
        vy: Math.sin(a) * rand(90, 320),
        life: rand(0.3, 0.6),
        max: 0.6,
        size: rand(4, 10),
        color: def.juice,
        kind: "drop",
        rot: 0,
        vrot: 0,
        grav: TUNING.gravity,
      });
    }
    this.addPopup(clamp(f.x, 70, this.view.w - 70), this.view.h - 70, "MISS", "#ff5c8a", 30, -50);
    this.flashColor = "255,60,110";
    this.flash = Math.max(this.flash, 0.32);
    this.shake = Math.max(this.shake, 6);
    sfx.miss();
    this.loseLife(false);
  }

  private updatePieces(dt: number) {
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const p = this.pieces[i];
      p.vy += TUNING.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
      p.life -= dt;
      if (p.life <= 0 || p.y > this.view.h + 220) this.pieces.splice(i, 1);
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.parts.splice(i, 1);
        continue;
      }
      p.vy += p.grav * dt;
      if (p.kind === "drop") {
        p.vx *= Math.pow(0.35, dt);
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
      if (p.y > this.view.h + 40 && p.vy > 0) this.parts.splice(i, 1);
    }
  }

  private updateEffects(dt: number) {
    const life = TUNING.trailLife;
    while (this.trail.length && this.time - this.trail[0].t > life) this.trail.shift();
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.life -= dt;
      p.y += p.vy * dt;
      p.vy *= Math.pow(0.2, dt);
      if (p.life <= 0) this.pops.splice(i, 1);
    }
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      this.slashes[i].life -= dt;
      if (this.slashes[i].life <= 0) this.slashes.splice(i, 1);
    }
    if (this.stain) {
      const ctx = this.stain.getContext("2d")!;
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = `rgba(0,0,0,${Math.min(0.5, dt * 0.55)})`;
      ctx.fillRect(0, 0, this.stain.width, this.stain.height);
      ctx.restore();
    }
  }

  private checkLevelClear(dt: number) {
    if (this.waveQueue.length > 0 || this.fruits.length > 0 || this.pieces.length > 0) {
      this.clearDelay = 0;
      return;
    }
    this.clearDelay += dt;
    if (this.clearDelay < 0.55) return;
    const lifeBonus = this.lives * 100;
    const clearBonus = 250 * (this.levelIndex + 1);
    const perfectBonus = this.perfect ? 500 : 0;
    this.score += lifeBonus + clearBonus + perfectBonus;
    this.lastLevelScore = this.levelScore;
    this.addPopup(
      this.view.w / 2,
      this.view.h * 0.45,
      `LEVEL CLEAR +${lifeBonus + clearBonus + perfectBonus}`,
      "#7ee787",
      44,
      -40,
    );
    if (perfectBonus) {
      this.addPopup(this.view.w / 2, this.view.h * 0.54, "PERFECT!", "#ffd166", 40, -34);
      this.flashColor = "255,209,102";
      this.flash = 0.4;
    }
    sfx.levelUp();
    this.setState("levelclear");
  }

  private pushHud(force = false) {
    const h: Hud = {
      state: this.state,
      score: this.score,
      lives: this.lives,
      level: this.levelIndex + 1,
      levelName: this.level.name,
      levelSub: this.level.sub,
      progress: this.spawnedTotal ? clamp(this.progressCount / this.spawnedTotal, 0, 1) : 0,
      combo: this.combo,
      multiplier: this.multiplier,
      focus: 1 - this.focusT / TUNING.focusCooldown,
      fruits: this.fruitsSliced,
      bestCombo: this.bestCombo,
      lastLevelScore: this.lastLevelScore,
      perfect: this.perfect,
    };
    const key = `${h.state}|${h.score}|${h.lives}|${h.level}|${h.combo}|${h.multiplier}|${Math.round(h.progress * 60)}|${Math.round(h.focus * 25)}|${h.fruits}|${h.perfect}`;
    if (force || key !== this.lastHud) {
      this.lastHud = key;
      this.onHud(h);
    }
  }

  /* ------------------------------------------------------------- render */

  private render() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const S = this.scale * this.dpr;
    const sh = this.shake;
    const ox = (Math.random() * 2 - 1) * sh * this.dpr;
    const oy = (Math.random() * 2 - 1) * sh * this.dpr;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!this.bg) this.buildBackground();
    ctx.fillStyle = this.level.palette.bottom;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(this.bg!, ox - 8 * this.dpr, oy - 8 * this.dpr, W + 16 * this.dpr, H + 16 * this.dpr);

    if (this.stain) {
      ctx.globalAlpha = 0.85;
      ctx.drawImage(this.stain, ox, oy);
      ctx.globalAlpha = 1;
    }

    // world transform (+ punch zoom)
    const punch = 1 + this.punch * 0.018;
    const cx = (this.view.w / 2) * S + ox;
    const cy = (this.view.h / 2) * S + oy;
    ctx.setTransform(S * punch, 0, 0, S * punch, cx - (this.view.w / 2) * S * punch, cy - (this.view.h / 2) * S * punch);

    this.drawSlashes(ctx);
    this.drawPieces(ctx);
    this.drawFruits(ctx);
    this.drawParticles(ctx);
    this.drawTrail(ctx);
    this.drawPopups(ctx);
    if (this.state === "playing" && this.blade.source === "keys") this.drawReticle(ctx);

    // full-screen overlays
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.flash > 0.01) {
      ctx.fillStyle = `rgba(${this.flashColor},${Math.min(0.5, this.flash * 0.42)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.slowT > 0) {
      const a = Math.min(0.22, this.slowT * 0.12);
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, "rgba(126,232,255,0)");
      g.addColorStop(1, `rgba(80,190,255,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.lives === 1 && this.state === "playing") {
      const pulse = 0.1 + Math.sin(this.time * 6) * 0.05;
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.72);
      g.addColorStop(0, "rgba(255,40,80,0)");
      g.addColorStop(1, `rgba(255,40,80,${pulse})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    this.drawBanner(ctx, S);
    if (this.state === "playing" && this.hintSlices < 3) this.drawHint(ctx);
    this.pushHud();
  }

  private drawSprite(ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number, rot: number, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.drawImage(s.canvas, -s.size / 2, -s.size / 2, s.size, s.size);
    ctx.restore();
  }

  private drawFruits(ctx: CanvasRenderingContext2D) {
    for (const f of this.fruits) {
      const spr = getSprite(f.key).whole;
      if (f.kind === "bomb") {
        const pulse = 0.55 + Math.sin(this.time * 13) * 0.45;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.45 + pulse * 0.4;
        const gs = f.r * 6;
        ctx.drawImage(this.glows.warm, f.x - gs / 2, f.y - gs / 2, gs, gs);
        ctx.restore();
      } else if (f.kind === "star" || f.kind === "frost") {
        const pulse = 0.5 + Math.sin(this.time * 7) * 0.5;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.3 + pulse * 0.35;
        const gs = f.r * 5.4;
        ctx.drawImage(f.kind === "star" ? this.glows.gold : this.glows.cool, f.x - gs / 2, f.y - gs / 2, gs, gs);
        ctx.restore();
      }
      const pop = Math.min(1, (this.time - f.born) * 6);
      const sc = 0.7 + pop * 0.3 + Math.sin(this.time * 5 + f.born * 8) * 0.018;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      ctx.scale(sc, sc);
      ctx.drawImage(spr.canvas, -spr.size / 2, -spr.size / 2, spr.size, spr.size);
      ctx.restore();
    }
  }

  private drawPieces(ctx: CanvasRenderingContext2D) {
    for (const p of this.pieces) {
      const spr = getSprite(p.key).half;
      const fade = clamp(p.life / 0.5, 0, 1);
      this.drawSprite(ctx, spr, p.x, p.y, p.rot, fade);
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.parts) {
      const t = p.life / p.max;
      const a = clamp(t * 1.4, 0, 1);
      if (p.kind === "spark") {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, p.size * 0.35);
        ctx.lineCap = "round";
        const l = p.size * 1.6;
        const m = Math.hypot(p.vx, p.vy) || 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - (p.vx / m) * l, p.y - (p.vy / m) * l);
        ctx.stroke();
        ctx.restore();
      } else if (p.kind === "chunk") {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 0.6, p.size * 0.42, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size * (0.55 + t * 0.45), p.size * (0.75 + t * 0.25), 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  private drawTrail(ctx: CanvasRenderingContext2D) {
    const pts = this.trail;
    if (pts.length < 2) return;
    const life = TUNING.trailLife;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // soft outer glow
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1];
        const p1 = pts[i];
        const age = (this.time - p1.t) / life;
        if (age > 1) continue;
        const w = (pass === 0 ? 26 : 11) * Math.pow(1 - age, 1.5);
        if (w < 0.6) continue;
        ctx.strokeStyle = pass === 0 ? `rgba(120,200,255,${0.1 * (1 - age)})` : `rgba(220,245,255,${0.4 * (1 - age)})`;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    }
    // bright core
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const age = (this.time - p1.t) / life;
      if (age > 1) continue;
      const w = 5.5 * Math.pow(1 - age, 1.1);
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - age)})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    const head = pts[pts.length - 1];
    const hage = (this.time - head.t) / life;
    if (hage < 0.4) {
      const gs = 74 * (1 - hage);
      ctx.globalAlpha = 0.55 * (1 - hage);
      ctx.drawImage(this.glows.white, head.x - gs / 2, head.y - gs / 2, gs, gs);
    }
    ctx.restore();
  }

  private drawSlashes(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const s of this.slashes) {
      const t = s.life / 0.19;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.a);
      const w = s.len * (1 + (1 - t) * 0.35);
      const h = 8 + (1 - t) * 26;
      const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      g.addColorStop(0, `rgba(${s.color},0)`);
      g.addColorStop(0.5, `rgba(${s.color},${0.75 * t})`);
      g.addColorStop(1, `rgba(${s.color},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, w / 2, h, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  private drawPopups(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const p of this.pops) {
      const t = p.life / p.max;
      const sc = t > 0.75 ? 1 + (1 - t) * 2.4 : 1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(sc, sc);
      ctx.globalAlpha = clamp(t * 1.6, 0, 1);
      ctx.font = `900 ${p.size}px Rubik, Baloo 2, system-ui, sans-serif`;
      ctx.lineWidth = Math.max(3, p.size * 0.16);
      ctx.strokeStyle = "rgba(20,8,30,0.8)";
      ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  private drawReticle(ctx: CanvasRenderingContext2D) {
    const b = this.blade;
    const r = 26 + Math.min(16, b.speed / 90);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const gs = r * 5;
    ctx.globalAlpha = 0.5;
    ctx.drawImage(this.glows.cool, b.x - gs / 2, b.y - gs / 2, gs, gs);
    ctx.restore();
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(this.time * 1.4);
    ctx.strokeStyle = "rgba(230,250,255,0.9)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      ctx.beginPath();
      ctx.arc(0, 0, r, a + 0.22, a + Math.PI / 2 - 0.22);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x - r * 0.5, b.y);
    ctx.lineTo(b.x + r * 0.5, b.y);
    ctx.moveTo(b.x, b.y - r * 0.5);
    ctx.lineTo(b.x, b.y + r * 0.5);
    ctx.stroke();
    ctx.restore();
  }

  private drawBanner(ctx: CanvasRenderingContext2D, S: number) {
    if (this.bannerT <= 0) return;
    const t = 1 - this.bannerT / 1.9;
    let a = 1;
    let sc = 1;
    if (t < 0.18) {
      a = t / 0.18;
      sc = 0.7 + (t / 0.18) * 0.4;
    } else if (t > 0.72) {
      a = 1 - (t - 0.72) / 0.28;
      sc = 1 + ((t - 0.72) / 0.28) * 0.25;
    }
    ctx.save();
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.translate(this.view.w / 2, this.view.h * 0.3);
    ctx.scale(sc, sc);
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 68px Rubik, Baloo 2, system-ui, sans-serif`;
    ctx.lineWidth = 12;
    ctx.strokeStyle = "rgba(20,6,30,0.75)";
    ctx.strokeText(this.bannerText, 0, 0);
    const g = ctx.createLinearGradient(0, -34, 0, 34);
    g.addColorStop(0, "#fff8e1");
    g.addColorStop(0.55, "#ffd166");
    g.addColorStop(1, "#ff8a3d");
    ctx.fillStyle = g;
    ctx.fillText(this.bannerText, 0, 0);
    ctx.font = `700 30px Baloo 2, system-ui, sans-serif`;
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(20,6,30,0.7)";
    ctx.strokeText(this.bannerSub, 0, 52);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText(this.bannerSub, 0, 52);
    ctx.restore();
  }

  private drawHint(ctx: CanvasRenderingContext2D) {
    const S = this.scale * this.dpr;
    ctx.save();
    ctx.setTransform(S, 0, 0, S, 0, 0);
    const a = 0.55 + Math.sin(this.time * 4) * 0.25;
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.textAlign = "center";
    ctx.font = `700 26px Baloo 2, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillText("Hold + swipe to slice  ·  WASD / arrows + Space to focus", this.view.w / 2, this.view.h - 44);
    ctx.restore();
  }
}

function hexA(hex: string) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
