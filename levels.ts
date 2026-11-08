import type { FruitKey } from "./art";

/** Virtual resolution: height is always 720, width adapts to the viewport. */
export const VH = 720;
export const MIN_VW = 430;
export const MAX_VW = 1500;

export const TUNING = {
  gravity: 1560,
  /** Minimum blade speed (virtual px/sec) required to cut. */
  bladeMinSpeed: 340,
  trailLife: 0.2,
  comboWindow: 0.5,
  pieceKick: 190,
  maxParticles: 460,
  lives: 3,
  focusDuration: 1.7,
  focusCooldown: 9,
  focusScale: 0.22,
  starDuration: 7,
};

export type LevelDef = {
  name: string;
  sub: string;
  waves: number;
  perWave: [number, number];
  bomb: number;
  waveDelay: number;
  fruits: FruitKey[];
  palette: { top: string; bottom: string; glow: string; accent: string };
};

const P = {
  dojo: { top: "#2a1445", bottom: "#0d0718", glow: "#ff7a3d", accent: "#ffd166" },
  sunset: { top: "#5a1b46", bottom: "#160a1c", glow: "#ff5c8a", accent: "#ffb3c6" },
  jungle: { top: "#0f3a2e", bottom: "#06170f", glow: "#7ee787", accent: "#c6ef6a" },
  ocean: { top: "#0e3050", bottom: "#050e1c", glow: "#7ee8ff", accent: "#a8ecff" },
  storm: { top: "#2b2145", bottom: "#080610", glow: "#a86ff0", accent: "#e3d0ff" },
  ember: { top: "#4a1420", bottom: "#140608", glow: "#ff4b2b", accent: "#ffcf4d" },
};

export const LEVELS: LevelDef[] = [
  {
    name: "Warm Up",
    sub: "Hold & swipe to slice",
    waves: 5,
    perWave: [2, 3],
    bomb: 0,
    waveDelay: 1.15,
    fruits: ["watermelon", "orange", "apple"],
    palette: P.dojo,
  },
  {
    name: "Citrus Rush",
    sub: "Chain slices for combos",
    waves: 6,
    perWave: [3, 4],
    bomb: 0,
    waveDelay: 1.0,
    fruits: ["orange", "lemon", "apple", "watermelon", "greenapple"],
    palette: P.sunset,
  },
  {
    name: "Berry Patch",
    sub: "Careful — bombs!",
    waves: 7,
    perWave: [3, 5],
    bomb: 0.07,
    waveDelay: 0.92,
    fruits: ["strawberry", "plum", "kiwi", "orange", "apple", "watermelon"],
    palette: P.jungle,
  },
  {
    name: "Tropic Storm",
    sub: "Frost berries freeze time",
    waves: 8,
    perWave: [4, 5],
    bomb: 0.1,
    waveDelay: 0.86,
    fruits: ["pineapple", "coconut", "dragonfruit", "kiwi", "lemon", "frost", "orange"],
    palette: P.ocean,
  },
  {
    name: "Orchard Blitz",
    sub: "Faster. Tighter. Juicier.",
    waves: 9,
    perWave: [4, 6],
    bomb: 0.13,
    waveDelay: 0.78,
    fruits: ["apple", "greenapple", "plum", "strawberry", "watermelon", "star", "orange", "kiwi"],
    palette: P.storm,
  },
  {
    name: "Ember Dojo",
    sub: "Gold star doubles your score",
    waves: 10,
    perWave: [5, 6],
    bomb: 0.16,
    waveDelay: 0.72,
    fruits: ["watermelon", "dragonfruit", "pineapple", "coconut", "strawberry", "plum", "star", "frost", "lemon"],
    palette: P.ember,
  },
  {
    name: "Fruit Frenzy",
    sub: "Everything, everywhere",
    waves: 11,
    perWave: [5, 7],
    bomb: 0.19,
    waveDelay: 0.66,
    fruits: [
      "watermelon",
      "orange",
      "lemon",
      "apple",
      "greenapple",
      "kiwi",
      "strawberry",
      "pineapple",
      "dragonfruit",
      "plum",
      "coconut",
      "star",
      "frost",
    ],
    palette: P.dojo,
  },
  {
    name: "Blade Master",
    sub: "Prove it.",
    waves: 12,
    perWave: [6, 8],
    bomb: 0.22,
    waveDelay: 0.6,
    fruits: [
      "watermelon",
      "orange",
      "lemon",
      "apple",
      "greenapple",
      "kiwi",
      "strawberry",
      "pineapple",
      "dragonfruit",
      "plum",
      "coconut",
      "star",
      "frost",
    ],
    palette: P.storm,
  },
];

export type WaveSpec = { count: number; delay: number; bomb: number };

export function levelCount() {
  return LEVELS.length;
}

export function levelAt(index: number): LevelDef {
  if (index < LEVELS.length) return LEVELS[index];
  const base = LEVELS[LEVELS.length - 1];
  const over = index - LEVELS.length + 1;
  return {
    ...base,
    name: `Endless +${over}`,
    sub: "How long can you last?",
    waves: 14,
    perWave: [6, 9],
    bomb: Math.min(0.3, 0.22 + over * 0.02),
    waveDelay: Math.max(0.42, 0.6 - over * 0.03),
  };
}
