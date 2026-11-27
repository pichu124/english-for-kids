import { describe, expect, it } from 'vitest';
import { advance, strokeDone, STROKES } from '../src/lib/strokes';

const line = (n: number) => Array.from({ length: n }, (_, i) => ({ x: 10 + i * 2, y: 50 }));

describe('letter strokes', () => {
  it('has every letter, small and big', () => {
    for (let i = 0; i < 26; i++) {
      const c = String.fromCharCode(97 + i);
      expect(STROKES[c]?.length, c).toBeGreaterThan(0);
      expect(STROKES[c.toUpperCase()]?.length, c.toUpperCase()).toBeGreaterThan(0);
    }
    for (const d of Object.values(STROKES).flat()) expect(d).toMatch(/^M[\d. ]+[LAQ]/);
  });
  it('moves on when the finger follows the stroke', () => {
    const pts = line(40);
    let at = 0;
    for (let x = 10; x <= 88; x += 2) at = advance(pts, at, { x, y: 52 });
    expect(strokeDone(pts, at)).toBe(true);
  });
  it('does not move for a finger far away, or going backwards', () => {
    const pts = line(40);
    expect(advance(pts, 0, { x: 50, y: 90 })).toBe(0);
    let at = 20;
    for (let x = 50; x >= 10; x -= 2) at = advance(pts, at, { x, y: 50 });
    expect(at).toBe(20);
  });
  it('cannot jump far ahead in one go', () => {
    expect(advance(line(40), 0, { x: 80, y: 50 })).toBe(0);
  });
});
