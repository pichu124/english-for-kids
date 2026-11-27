/**
 * How to write each letter: the strokes in order, as SVG paths, for finger tracing (ABC → ✏️ Write).
 * Simple print letters ("ball and stick") and numbers, in a 100 × 120 box with four guide lines:
 * top 10 (tall letters and capitals), middle 45 (small letters), base 85, tail 115 (g j p q y).
 * Each stroke starts where the child's finger starts. A stroke shorter than 3 is a dot (tap it).
 */
export const GUIDES = { top: 10, mid: 45, base: 85, tail: 115 } as const;

const RING_A = 'M70 65 A20 20 0 1 0 30 65 A20 20 0 1 0 70 65'; // a d g q: round, anticlockwise from the right
const RING_B = 'M30 65 A20 20 0 1 1 70 65 A20 20 0 1 1 30 65'; // b p: round, clockwise from the stick
const BIG_O = 'M50 10 Q22 10 22 47.5 Q22 85 50 85 Q78 85 78 47.5 Q78 10 50 10';
const DOT = (x: number) => `M${x} 27 L${x} 28`;

export const STROKES: Record<string, string[]> = {
  a: [RING_A, 'M70 45 L70 85'],
  b: ['M30 10 L30 85', RING_B],
  c: ['M65 52 A20 20 0 1 0 65 78'],
  d: [RING_A, 'M70 10 L70 85'],
  e: ['M30 65 L70 65 A20 20 0 1 0 65 78'],
  f: ['M66 16 Q40 2 40 30 L40 85', 'M25 45 L58 45'],
  g: [RING_A, 'M70 45 L70 100 Q70 115 50 115 Q36 115 30 106'],
  h: ['M30 10 L30 85', 'M30 60 Q30 45 50 45 Q70 45 70 60 L70 85'],
  i: ['M50 45 L50 85', DOT(50)],
  j: ['M58 45 L58 102 Q58 115 45 115 Q36 115 32 108', DOT(58)],
  k: ['M32 10 L32 85', 'M66 45 L32 68 L68 85'],
  l: ['M50 10 L50 85'],
  m: ['M25 45 L25 85', 'M25 58 Q25 45 37 45 Q50 45 50 58 L50 85', 'M50 58 Q50 45 62 45 Q75 45 75 58 L75 85'],
  n: ['M32 45 L32 85', 'M32 60 Q32 45 50 45 Q68 45 68 60 L68 85'],
  o: ['M50 45 A20 20 0 1 0 50 85 A20 20 0 1 0 50 45'],
  p: ['M30 45 L30 115', RING_B],
  q: [RING_A, 'M70 45 L70 115'],
  r: ['M35 45 L35 85', 'M35 62 Q35 45 52 45 Q62 45 68 50'],
  s: ['M66 50 Q60 45 50 45 Q33 45 33 55 Q33 64 50 65 Q67 66 67 75 Q67 85 50 85 Q38 85 32 79'],
  t: ['M48 18 L48 76 Q48 85 58 85 Q64 85 67 82', 'M33 45 L64 45'],
  u: ['M30 45 L30 70 Q30 85 50 85 Q70 85 70 70', 'M70 45 L70 85'],
  v: ['M30 45 L50 85 L70 45'],
  w: ['M22 45 L36 85 L50 55 L64 85 L78 45'],
  x: ['M32 45 L68 85', 'M68 45 L32 85'],
  y: ['M30 45 L50 85', 'M70 45 L40 115'],
  z: ['M32 45 L68 45 L32 85 L68 85'],

  A: ['M50 10 L25 85', 'M50 10 L75 85', 'M34 58 L66 58'],
  B: ['M30 10 L30 85', 'M30 10 L52 10 Q70 10 70 28.5 Q70 47 52 47 L30 47', 'M30 47 L55 47 Q74 47 74 66 Q74 85 55 85 L30 85'],
  C: ['M72 22 Q60 10 48 10 Q22 10 22 47.5 Q22 85 48 85 Q60 85 72 73'],
  D: ['M30 10 L30 85', 'M30 10 L45 10 Q74 10 74 47.5 Q74 85 45 85 L30 85'],
  E: ['M32 10 L32 85', 'M32 10 L70 10', 'M32 47 L64 47', 'M32 85 L70 85'],
  F: ['M32 10 L32 85', 'M32 10 L70 10', 'M32 47 L64 47'],
  G: ['M72 22 Q60 10 48 10 Q22 10 22 47.5 Q22 85 48 85 Q72 85 73 58 L54 58'],
  H: ['M28 10 L28 85', 'M72 10 L72 85', 'M28 47 L72 47'],
  I: ['M50 10 L50 85', 'M36 10 L64 10', 'M36 85 L64 85'],
  J: ['M62 10 L62 66 Q62 85 45 85 Q32 85 28 74'],
  K: ['M30 10 L30 85', 'M70 10 L30 52', 'M44 40 L72 85'],
  L: ['M32 10 L32 85 L70 85'],
  M: ['M22 85 L22 10 L50 55 L78 10 L78 85'],
  N: ['M28 85 L28 10 L72 85 L72 10'],
  O: [BIG_O],
  P: ['M30 10 L30 85', 'M30 10 L52 10 Q72 10 72 30 Q72 50 52 50 L30 50'],
  Q: [BIG_O, 'M56 66 L76 88'],
  R: ['M30 10 L30 85', 'M30 10 L52 10 Q72 10 72 30 Q72 50 52 50 L30 50', 'M48 50 L72 85'],
  S: ['M70 20 Q62 10 50 10 Q28 10 28 28 Q28 44 50 47 Q72 50 72 67 Q72 85 50 85 Q34 85 28 75'],
  T: ['M24 10 L76 10', 'M50 10 L50 85'],
  U: ['M28 10 L28 60 Q28 85 50 85 Q72 85 72 60 L72 10'],
  V: ['M26 10 L50 85 L74 10'],
  W: ['M16 10 L32 85 L50 30 L68 85 L84 10'],
  X: ['M28 10 L72 85', 'M72 10 L28 85'],
  Y: ['M28 10 L50 47', 'M72 10 L50 47 L50 85'],
  Z: ['M28 10 L72 10 L28 85 L72 85'],

  // numbers, as tall as capitals
  '0': ['M50 10 Q25 10 25 47.5 Q25 85 50 85 Q75 85 75 47.5 Q75 10 50 10'],
  '1': ['M36 24 L52 10 L52 85'],
  '2': ['M28 27 Q30 10 50 10 Q72 10 72 30 Q72 46 28 85 L74 85'],
  '3': ['M30 18 Q40 10 51 10 Q70 10 70 28 Q70 46 48 46 Q74 46 74 66 Q74 85 50 85 Q36 85 28 76'],
  '4': ['M60 10 L24 62 L78 62', 'M60 32 L60 85'],
  '5': ['M34 10 L31 44 Q42 38 52 38 Q74 38 74 61 Q74 85 50 85 Q35 85 28 77', 'M34 10 L70 10'],
  '6': ['M67 15 Q59 10 50 10 Q26 10 26 50 Q26 85 50 85 Q74 85 74 63 Q74 42 50 42 Q31 42 27 58'],
  '7': ['M26 10 L74 10 L42 85'],
  '8': ['M64 18 Q57 10 50 10 Q30 10 30 28 Q30 44 50 47 Q72 50 72 67 Q72 85 50 85 Q28 85 28 67 Q28 50 50 47 Q70 44 70 28 Q70 14 58 11'],
  '9': ['M72 30 Q72 10 50 10 Q28 10 28 30 Q28 50 50 50 Q72 50 72 30 L72 85'],
};

export type Pt = { x: number; y: number };

/**
 * Follow the finger along one stroke. `points` is the stroke sampled every ~2 units.
 * The finger moves the progress on only when it is near the next part of the stroke,
 * so scribbling elsewhere or jumping ahead does nothing (and nothing is ever "wrong").
 * Returns the new progress index.
 */
export function advance(points: Pt[], at: number, finger: Pt, tolerance = 13, lookahead = 6): number {
  // the point just ahead that is NEAREST the finger: moving along the stroke moves it on,
  // going back the wrong way never does (the nearest point is then behind)
  let best = at;
  let bestD = tolerance;
  for (let i = at; i < Math.min(points.length, at + lookahead + 1); i++) {
    const d = Math.hypot(points[i].x - finger.x, points[i].y - finger.y);
    if (d <= bestD) {
      best = i;
      bestD = d;
    }
  }
  return best;
}

/** A stroke is done when the finger reached (almost) its end. */
export const strokeDone = (points: Pt[], at: number): boolean => at >= points.length - 2;
