/**
 * Procedural fruit artwork.
 * Every fruit is drawn with canvas primitives then baked into offscreen sprites
 * (whole + half cross-section) so the render loop is pure drawImage calls.
 */

const TAU = Math.PI * 2;

export type FruitKey =
  | "watermelon"
  | "orange"
  | "lemon"
  | "apple"
  | "greenapple"
  | "kiwi"
  | "strawberry"
  | "pineapple"
  | "dragonfruit"
  | "plum"
  | "coconut"
  | "bomb"
  | "frost"
  | "star";

export type FruitDef = {
  key: FruitKey;
  points: number;
  radius: number;
  pad: number;
  juice: string;
  juice2: string;
  whole: (ctx: CanvasRenderingContext2D, r: number) => void;
  cross: (ctx: CanvasRenderingContext2D, r: number) => void;
};

/* ------------------------------------------------------------------ utils */

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function mk(w: number, h = w) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

function ball(ctx: CanvasRenderingContext2D, r: number, light: string, dark: string) {
  const g = ctx.createRadialGradient(-r * 0.34, -r * 0.4, r * 0.08, 0, 0, r * 1.18);
  g.addColorStop(0, light);
  g.addColorStop(0.62, light);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
}

function gloss(ctx: CanvasRenderingContext2D, r: number, a = 0.22, y = -0.38) {
  ctx.save();
  ctx.translate(-r * 0.33, r * y);
  ctx.rotate(-0.5);
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.3, r * 0.15, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function ring(ctx: CanvasRenderingContext2D, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
}

function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, a: string, b: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const g = ctx.createLinearGradient(0, 0, len, 0);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.42, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.42, 0, 0);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = Math.max(1, len * 0.035);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len, 0);
  ctx.stroke();
  ctx.restore();
}

function stem(ctx: CanvasRenderingContext2D, r: number, len: number, color = "#6b4423") {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.11);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.9);
  ctx.quadraticCurveTo(r * 0.1, -r - len * 0.7, r * 0.26, -r - len);
  ctx.stroke();
}

function wedges(ctx: CanvasRenderingContext2D, _r: number, n: number, inner: number, outer: number, color: string) {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU + 0.045;
    const a1 = ((i + 1) / n) * TAU - 0.045;
    ctx.beginPath();
    ctx.arc(0, 0, outer, a0, a1);
    ctx.arc(0, 0, inner, a1, a0, true);
    ctx.closePath();
    ctx.fill();
  }
}

function seedsRing(
  ctx: CanvasRenderingContext2D,
  _r: number,
  n: number,
  rad: number,
  size: number,
  color: string,
  stretch = 1.7,
) {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    ctx.save();
    ctx.translate(Math.cos(a) * rad, Math.sin(a) * rad);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * stretch, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

function scatter(
  ctx: CanvasRenderingContext2D,
  _r: number,
  n: number,
  seed: number,
  rad: number,
  size: number,
  color: string,
) {
  const rand = rng(seed);
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const a = rand() * TAU;
    const d = Math.sqrt(rand()) * rad;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, size, size * 1.5, a, 0, TAU);
    ctx.fill();
  }
}

/* --------------------------------------------------------------- fruits */

export const FRUITS: Record<FruitKey, FruitDef> = {
  watermelon: {
    key: "watermelon",
    points: 10,
    radius: 62,
    pad: 0.14,
    juice: "#ff4b5c",
    juice2: "#ff9aa5",
    whole(ctx, r) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.clip();
      ball(ctx, r, "#8ade57", "#1d6b30");
      ctx.fillStyle = "rgba(18,84,34,0.9)";
      for (let i = 0; i < 6; i++) {
        const x = -r + (i + 0.5) * (2 * r) / 6;
        ctx.beginPath();
        ctx.moveTo(x - r * 0.1, -r * 1.1);
        ctx.quadraticCurveTo(x + r * 0.2, 0, x - r * 0.1, r * 1.1);
        ctx.lineTo(x + r * 0.12, r * 1.1);
        ctx.quadraticCurveTo(x + r * 0.42, 0, x + r * 0.12, -r * 1.1);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      gloss(ctx, r, 0.2);
    },
    cross(ctx, r) {
      ring(ctx, r, "#2f8f3f");
      ring(ctx, r * 0.93, "#e6f6d5");
      ring(ctx, r * 0.86, "#ff4b5c");
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.05, 0, 0, r);
      g.addColorStop(0, "rgba(255,255,255,0.16)");
      g.addColorStop(1, "rgba(120,0,20,0.14)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.86, 0, TAU);
      ctx.fill();
      seedsRing(ctx, r, 9, r * 0.56, r * 0.05, "#241521");
      seedsRing(ctx, r, 5, r * 0.3, r * 0.04, "#241521");
    },
  },

  orange: {
    key: "orange",
    points: 10,
    radius: 45,
    pad: 0.42,
    juice: "#ffa62b",
    juice2: "#ffd88a",
    whole(ctx, r) {
      ball(ctx, r, "#ffc244", "#e07612");
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.99, 0, TAU);
      ctx.clip();
      const rand = rng(7);
      ctx.fillStyle = "rgba(180,90,10,0.22)";
      for (let i = 0; i < 46; i++) {
        const a = rand() * TAU;
        const d = Math.sqrt(rand()) * r;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, r * 0.035, r * 0.028, a, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      gloss(ctx, r, 0.26);
      stem(ctx, r, r * 0.16, "#5f8f34");
      leaf(ctx, r * 0.06, -r * 0.96, r * 0.5, -0.35, "#7ec850", "#3f8f34");
    },
    cross(ctx, r) {
      ring(ctx, r, "#ffb43a");
      ring(ctx, r * 0.9, "#ffe3a8");
      wedges(ctx, r, 9, r * 0.07, r * 0.84, "#ff9f1c");
      ring(ctx, r * 0.07, "#fff3d4");
    },
  },

  lemon: {
    key: "lemon",
    points: 10,
    radius: 41,
    pad: 0.4,
    juice: "#ffe45c",
    juice2: "#fff7c2",
    whole(ctx, r) {
      ctx.save();
      ctx.scale(1.18, 0.93);
      ball(ctx, r, "#ffe45c", "#dc9c00");
      ctx.restore();
      ctx.fillStyle = "#e8b400";
      ctx.beginPath();
      ctx.ellipse(-r * 1.16, 0, r * 0.11, r * 0.075, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(r * 1.16, 0, r * 0.11, r * 0.075, 0, 0, TAU);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.17, r * 0.92, 0, 0, TAU);
      ctx.clip();
      const rand = rng(21);
      ctx.fillStyle = "rgba(190,130,0,0.2)";
      for (let i = 0; i < 30; i++) {
        const a = rand() * TAU;
        const d = Math.sqrt(rand()) * r;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, r * 0.04, r * 0.03, a, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      gloss(ctx, r * 0.95, 0.28);
      leaf(ctx, 0, -r * 0.8, r * 0.45, -0.7, "#9ede54", "#4d9a30");
    },
    cross(ctx, r) {
      ring(ctx, r, "#f6cf3d");
      ring(ctx, r * 0.9, "#fff6c2");
      wedges(ctx, r, 8, r * 0.06, r * 0.83, "#ffe066");
      ring(ctx, r * 0.06, "#fffbe6");
    },
  },

  apple: {
    key: "apple",
    points: 10,
    radius: 46,
    pad: 0.52,
    juice: "#ff5a63",
    juice2: "#ffd0d3",
    whole(ctx, r) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.78);
      ctx.bezierCurveTo(-r * 0.55, -r * 1.14, -r * 1.2, -r * 0.7, -r * 1.02, r * 0.16);
      ctx.bezierCurveTo(-r * 0.88, r * 0.92, -r * 0.3, r * 1.12, 0, r * 1.0);
      ctx.bezierCurveTo(r * 0.3, r * 1.12, r * 0.88, r * 0.92, r * 1.02, r * 0.16);
      ctx.bezierCurveTo(r * 1.2, -r * 0.7, r * 0.55, -r * 1.14, 0, -r * 0.78);
      ctx.closePath();
      ctx.clip();
      ball(ctx, r * 1.05, "#f5503f", "#8d0f1c");
      ctx.fillStyle = "rgba(255,220,120,0.24)";
      ctx.beginPath();
      ctx.ellipse(-r * 0.42, r * 0.24, r * 0.24, r * 0.4, 0.3, 0, TAU);
      ctx.fill();
      ctx.restore();
      gloss(ctx, r * 0.9, 0.26);
      stem(ctx, r, r * 0.42, "#6b4423");
      leaf(ctx, r * 0.18, -r * 1.04, r * 0.52, -0.25, "#a5e04f", "#4d8f2a");
    },
    cross(ctx, r) {
      ring(ctx, r, "#e8453f");
      ring(ctx, r * 0.92, "#f6e6c8");
      const g = ctx.createRadialGradient(0, 0, r * 0.05, 0, 0, r * 0.92);
      g.addColorStop(0, "#fffaf0");
      g.addColorStop(1, "#f0dcb4");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.92, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#6b3a1e";
      ctx.save();
      ctx.rotate(0.4);
      ctx.beginPath();
      ctx.ellipse(-r * 0.16, 0, r * 0.07, r * 0.15, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(r * 0.16, 0, r * 0.07, r * 0.15, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    },
  },

  greenapple: {
    key: "greenapple",
    points: 10,
    radius: 44,
    pad: 0.52,
    juice: "#b6e84a",
    juice2: "#eaffc2",
    whole(ctx, r) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.78);
      ctx.bezierCurveTo(-r * 0.55, -r * 1.14, -r * 1.2, -r * 0.7, -r * 1.02, r * 0.16);
      ctx.bezierCurveTo(-r * 0.88, r * 0.92, -r * 0.3, r * 1.12, 0, r * 1.0);
      ctx.bezierCurveTo(r * 0.3, r * 1.12, r * 0.88, r * 0.92, r * 1.02, r * 0.16);
      ctx.bezierCurveTo(r * 1.2, -r * 0.7, r * 0.55, -r * 1.14, 0, -r * 0.78);
      ctx.closePath();
      ctx.clip();
      ball(ctx, r * 1.05, "#bdea52", "#4e8b1f");
      ctx.fillStyle = "rgba(240,255,160,0.26)";
      ctx.beginPath();
      ctx.ellipse(-r * 0.4, r * 0.24, r * 0.22, r * 0.38, 0.3, 0, TAU);
      ctx.fill();
      ctx.restore();
      gloss(ctx, r * 0.9, 0.3);
      stem(ctx, r, r * 0.4, "#6b4423");
      leaf(ctx, r * 0.18, -r * 1.0, r * 0.5, -0.2, "#c6ef6a", "#4d8f2a");
    },
    cross(ctx, r) {
      ring(ctx, r, "#9cc94a");
      ring(ctx, r * 0.92, "#f4fbe0");
      scatter(ctx, r, 8, 3, r * 0.5, r * 0.045, "#6b3a1e");
    },
  },

  kiwi: {
    key: "kiwi",
    points: 15,
    radius: 40,
    pad: 0.2,
    juice: "#8ec73f",
    juice2: "#d9f0a8",
    whole(ctx, r) {
      ctx.save();
      ctx.scale(0.95, 1.14);
      ball(ctx, r, "#a4835a", "#59422a");
      ctx.restore();
      const rand = rng(99);
      ctx.strokeStyle = "rgba(60,42,24,0.5)";
      ctx.lineWidth = 1.3;
      for (let i = 0; i < 54; i++) {
        const a = rand() * TAU;
        const d = r * 0.98;
        const x = Math.cos(a) * d * 0.95;
        const y = Math.sin(a) * d * 1.09;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * r * 0.12, y + Math.sin(a) * r * 0.12);
        ctx.stroke();
      }
      gloss(ctx, r * 0.92, 0.18);
    },
    cross(ctx, r) {
      ring(ctx, r, "#7a5c3a");
      ring(ctx, r * 0.95, "#8bc34a");
      ctx.strokeStyle = "rgba(240,255,200,0.5)";
      ctx.lineWidth = r * 0.02;
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
        ctx.lineTo(Math.cos(a) * r * 0.88, Math.sin(a) * r * 0.88);
        ctx.stroke();
      }
      ring(ctx, r * 0.3, "#f2f7d8");
      seedsRing(ctx, r, 16, r * 0.48, r * 0.032, "#20160c", 1.6);
    },
  },

  strawberry: {
    key: "strawberry",
    points: 15,
    radius: 41,
    pad: 0.45,
    juice: "#ff3f6b",
    juice2: "#ffb3c6",
    whole(ctx, r) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, r * 1.1);
      ctx.bezierCurveTo(-r * 1.02, r * 0.5, -r * 0.98, -r * 0.82, 0, -r * 0.72);
      ctx.bezierCurveTo(r * 0.98, -r * 0.82, r * 1.02, r * 0.5, 0, r * 1.1);
      ctx.closePath();
      ctx.clip();
      ball(ctx, r, "#f4325c", "#9c0a2c");
      ctx.restore();
      const rand = rng(5);
      ctx.fillStyle = "#ffe08a";
      for (let i = 0; i < 16; i++) {
        const a = rand() * TAU;
        const d = Math.sqrt(rand()) * r * 0.8;
        const y = Math.sin(a) * d * 0.95;
        if (y < -r * 0.6) continue;
        ctx.save();
        ctx.translate(Math.cos(a) * d * 0.85, y);
        ctx.rotate(rand() * 1.2 - 0.6);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.045, r * 0.07, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      gloss(ctx, r * 0.88, 0.3, -0.42);
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.52;
        leaf(ctx, 0, -r * 0.6, r * 0.56, a - Math.PI, "#7ed14f", "#2f7a28");
      }
      stem(ctx, r * 0.6, r * 0.3, "#4d8f2a");
    },
    cross(ctx, r) {
      ring(ctx, r, "#e0244a");
      ring(ctx, r * 0.9, "#ff9fb2");
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = r * 0.035;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2);
        ctx.lineTo(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86);
        ctx.stroke();
      }
      ring(ctx, r * 0.2, "#fff0f3");
    },
  },

  pineapple: {
    key: "pineapple",
    points: 20,
    radius: 48,
    pad: 1.12,
    juice: "#ffcf4d",
    juice2: "#fff0b8",
    whole(ctx, r) {
      ctx.save();
      ctx.translate(0, r * 0.16);
      ctx.scale(0.86, 1.08);
      ball(ctx, r, "#f7c53d", "#a56a14");
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, r * 0.16, r * 0.86, r * 1.06, 0, 0, TAU);
      ctx.clip();
      ctx.strokeStyle = "rgba(140,86,14,0.55)";
      ctx.lineWidth = 2.2;
      for (let i = -4; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-r, r * 0.16 + i * r * 0.3 - r * 0.9);
        ctx.lineTo(r, r * 0.16 + i * r * 0.3 + r * 0.9);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r, r * 0.16 + i * r * 0.3 + r * 0.9);
        ctx.lineTo(r, r * 0.16 + i * r * 0.3 - r * 0.9);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = "#8a5a12";
      const rand = rng(13);
      for (let i = 0; i < 22; i++) {
        const a = rand() * TAU;
        const d = Math.sqrt(rand()) * 0.8;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * r * d * 0.85, r * 0.16 + Math.sin(a) * r * d, 1.6, 2.4, a, 0, TAU);
        ctx.fill();
      }
      for (let i = 0; i < 7; i++) {
        const t = (i - 3) / 3;
        ctx.save();
        ctx.translate(t * r * 0.5, -r * 0.85);
        ctx.rotate(t * 0.55 - Math.PI / 2);
        const g = ctx.createLinearGradient(0, 0, r * 1.15, 0);
        g.addColorStop(0, "#8ed35a");
        g.addColorStop(1, "#2f7a2a");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(r * 0.5, -r * 0.16, r * 1.15, -r * 0.05);
        ctx.quadraticCurveTo(r * 0.5, r * 0.16, 0, 0);
        ctx.fill();
        ctx.restore();
      }
      gloss(ctx, r * 0.8, 0.18);
    },
    cross(ctx, r) {
      ring(ctx, r, "#e0a92a");
      ring(ctx, r * 0.93, "#f9df85");
      ctx.strokeStyle = "rgba(200,150,40,0.7)";
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.24, Math.sin(a) * r * 0.24);
        ctx.lineTo(Math.cos(a) * r * 0.88, Math.sin(a) * r * 0.88);
        ctx.stroke();
      }
      ring(ctx, r * 0.24, "#fff4c8");
    },
  },

  dragonfruit: {
    key: "dragonfruit",
    points: 20,
    radius: 46,
    pad: 0.55,
    juice: "#ff4f9a",
    juice2: "#ffe0f0",
    whole(ctx, r) {
      ball(ctx, r, "#ff5f9e", "#a80f57");
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + 0.3;
        const bx = Math.cos(a) * r * 0.72;
        const by = Math.sin(a) * r * 0.72;
        const tipx = Math.cos(a) * r * 1.34;
        const tipy = Math.sin(a) * r * 1.34;
        const g = ctx.createLinearGradient(bx, by, tipx, tipy);
        g.addColorStop(0, "#3fae4a");
        g.addColorStop(1, "#9be36a");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(bx - Math.sin(a) * r * 0.15, by + Math.cos(a) * r * 0.15);
        ctx.quadraticCurveTo(tipx - Math.sin(a) * r * 0.02, tipy + Math.cos(a) * r * 0.02, tipx, tipy);
        ctx.quadraticCurveTo(tipx + Math.sin(a) * r * 0.02, tipy - Math.cos(a) * r * 0.02, bx + Math.sin(a) * r * 0.15, by - Math.cos(a) * r * 0.15);
        ctx.closePath();
        ctx.fill();
      }
      gloss(ctx, r * 0.86, 0.26);
    },
    cross(ctx, r) {
      ring(ctx, r, "#f5257f");
      ring(ctx, r * 0.9, "#fdf3ff");
      scatter(ctx, r, 22, 42, r * 0.72, r * 0.035, "#241521");
    },
  },

  plum: {
    key: "plum",
    points: 15,
    radius: 38,
    pad: 0.42,
    juice: "#a86ff0",
    juice2: "#e3d0ff",
    whole(ctx, r) {
      ball(ctx, r, "#a97cf0", "#43207c");
      ctx.strokeStyle = "rgba(40,12,70,0.45)";
      ctx.lineWidth = r * 0.06;
      ctx.beginPath();
      ctx.moveTo(-r * 0.1, -r * 0.86);
      ctx.quadraticCurveTo(-r * 0.5, 0, -r * 0.16, r * 0.86);
      ctx.stroke();
      gloss(ctx, r, 0.3);
      stem(ctx, r, r * 0.34, "#5b3a1c");
    },
    cross(ctx, r) {
      ring(ctx, r, "#7a48c0");
      ring(ctx, r * 0.9, "#f2b544");
      ctx.fillStyle = "#8a5a24";
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.22, r * 0.3, 0.3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(120,70,20,0.4)";
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.1, r * 0.16, 0.3, 0, TAU);
      ctx.fill();
    },
  },

  coconut: {
    key: "coconut",
    points: 20,
    radius: 42,
    pad: 0.2,
    juice: "#f6ecd8",
    juice2: "#d8c3a5",
    whole(ctx, r) {
      ball(ctx, r, "#9a6537", "#3d2312");
      const rand = rng(31);
      ctx.strokeStyle = "rgba(50,28,12,0.55)";
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 34; i++) {
        const a = rand() * TAU;
        const d = Math.sqrt(rand()) * r * 0.95;
        const len = r * (0.14 + rand() * 0.16);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d);
        ctx.lineTo(Math.cos(a) * (d + len), Math.sin(a) * (d + len));
        ctx.stroke();
      }
      ctx.fillStyle = "#2a1608";
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i - 1) * 0.55;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * r * 0.34, Math.sin(a) * r * 0.34 - r * 0.1, r * 0.075, r * 0.055, a, 0, TAU);
        ctx.fill();
      }
      gloss(ctx, r * 0.95, 0.16);
    },
    cross(ctx, r) {
      ring(ctx, r, "#6b4426");
      ring(ctx, r * 0.9, "#fbf4e6");
      ring(ctx, r * 0.55, "#e6d5bb");
      ring(ctx, r * 0.42, "#c9b191");
      ctx.strokeStyle = "rgba(120,90,60,0.35)";
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58);
        ctx.lineTo(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86);
        ctx.stroke();
      }
    },
  },

  bomb: {
    key: "bomb",
    points: 0,
    radius: 40,
    pad: 0.62,
    juice: "#ff7b3d",
    juice2: "#ffd166",
    whole(ctx, r) {
      ball(ctx, r, "#5c6474", "#101319");
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.98, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#8b93a5";
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.94, r * 0.24, r * 0.14, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "#c9a06a";
      ctx.lineWidth = r * 0.1;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.98);
      ctx.quadraticCurveTo(r * 0.4, -r * 1.3, r * 0.62, -r * 1.05);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,90,90,0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = "#ff3b3b";
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.2, 0, TAU);
      ctx.fill();
      gloss(ctx, r * 0.9, 0.22);
    },
    cross(ctx, r) {
      ring(ctx, r, "#3a4150");
      scatter(ctx, r, 16, 77, r * 0.7, r * 0.05, "#ff7b3d");
      ring(ctx, r * 0.3, "#ff3b3b");
    },
  },

  frost: {
    key: "frost",
    points: 25,
    radius: 38,
    pad: 0.34,
    juice: "#7ee8ff",
    juice2: "#e6fbff",
    whole(ctx, r) {
      ctx.save();
      ctx.rotate(Math.PI / 6);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(-r, -r, r, r);
      g.addColorStop(0, "#eafcff");
      g.addColorStop(0.5, "#6fd8ff");
      g.addColorStop(1, "#2b7fd4");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42);
        ctx.lineTo(Math.cos(a) * r * 0.66, Math.sin(a) * r * 0.66);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.14, 0, TAU);
      ctx.fill();
    },
    cross(ctx, r) {
      ring(ctx, r, "#2b7fd4");
      ring(ctx, r * 0.8, "#a8ecff");
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 2.2;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * r * 0.76, Math.sin(a) * r * 0.76);
        ctx.stroke();
      }
      ring(ctx, r * 0.16, "#ffffff");
    },
  },

  star: {
    key: "star",
    points: 30,
    radius: 40,
    pad: 0.42,
    juice: "#ffd166",
    juice2: "#fff3c4",
    whole(ctx, r) {
      ctx.save();
      ctx.rotate(-Math.PI / 2);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU;
        const rad = i % 2 === 0 ? r * 1.2 : r * 0.52;
        ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(-r, -r, r, r);
      g.addColorStop(0, "#fff6cf");
      g.addColorStop(0.45, "#ffd166");
      g.addColorStop(1, "#f08a00");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = "rgba(140,70,0,0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.ellipse(-r * 0.24, -r * 0.3, r * 0.14, r * 0.26, -0.5, 0, TAU);
      ctx.fill();
    },
    cross(ctx, r) {
      ring(ctx, r, "#f0a000");
      ring(ctx, r * 0.85, "#ffe9a8");
      wedges(ctx, r, 10, r * 0.14, r * 0.8, "#ffc93c");
      ring(ctx, r * 0.14, "#fff8dc");
    },
  },
};

/* --------------------------------------------------------------- baking */

const SS = 2; // supersample factor

export type Sprite = { canvas: HTMLCanvasElement; size: number; pad: number; r: number };
const cache = new Map<FruitKey, { whole: Sprite; half: Sprite }>();

export function prepareSprites() {
  (Object.keys(FRUITS) as FruitKey[]).forEach((k) => getSprite(k));
}

export function getSprite(key: FruitKey) {
  const hit = cache.get(key);
  if (hit) return hit;
  const def = FRUITS[key];
  const baked = { whole: bakeWhole(def), half: bakeHalf(def) };
  cache.set(key, baked);
  return baked;
}

function bakeWhole(def: FruitDef): Sprite {
  const r = def.radius;
  const pad = r * def.pad;
  const size = (r + pad) * 2 * SS;
  const c = mk(size);
  const ctx = c.getContext("2d")!;
  ctx.setTransform(SS, 0, 0, SS, size / 2, size / 2);
  def.whole(ctx, r);
  return { canvas: c, size: size / SS, pad, r };
}

function bakeHalf(def: FruitDef): Sprite {
  const r = def.radius;
  const pad = r * def.pad;
  const size = (r + pad) * 2 * SS;
  const c = mk(size);
  const ctx = c.getContext("2d")!;
  ctx.setTransform(SS, 0, 0, SS, size / 2, size / 2);
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI);
  ctx.closePath();
  ctx.clip();
  def.cross(ctx, r);
  ctx.restore();
  // cut-face shading + bright rim on the flat edge
  const g = ctx.createLinearGradient(0, r * 0.15, 0, r);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.18)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = Math.max(1.5, r * 0.045);
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.stroke();
  return { canvas: c, size: size / SS, pad, r };
}

/** Shared soft blob used for juice splats / particles. */
export function makeBlobSprite(): HTMLCanvasElement {
  const size = 96;
  const c = mk(size);
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.55, "rgba(255,255,255,0.85)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, TAU);
  ctx.fill();
  return c;
}
