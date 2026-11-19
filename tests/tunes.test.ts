import { describe, expect, it } from 'vitest';
import { melody, parseNote, TUNES, tuneFor } from '../src/lib/tunes';

describe('tunes', () => {
  it('parses note names, octaves and lengths', () => {
    expect(parseNote('C')).toEqual({ midi: 60, units: 1 });
    expect(parseNote('G3:2')).toEqual({ midi: 55, units: 2 });
    expect(parseNote('A:0.5')).toEqual({ midi: 69, units: 0.5 });
    expect(parseNote('R:2')).toEqual({ midi: null, units: 2 });
    expect(() => parseNote('H')).toThrow();
  });

  for (const t of TUNES) {
    it(`${t.name}: chords cover the melody, notes in a child-friendly range`, () => {
      const { notes, length } = melody(t);
      expect(notes.length).toBeGreaterThan(8);
      expect(t.chords.split(/\s+/).length * t.chordEvery).toBe(length);
      expect(length % t.beatEvery).toBe(0);
      for (const n of notes) {
        expect(n.midi).toBeGreaterThanOrEqual(53);
        expect(n.midi).toBeLessThanOrEqual(76);
      }
    });
  }

  it('gives every unit a stable tune, honouring an explicit choice', () => {
    expect(tuneFor('l1-farm').id).toBe(tuneFor('l1-farm').id);
    expect(tuneFor('l1-farm', 'oldmac').id).toBe('oldmac');
    expect(tuneFor('x', 'nope').id).toBeTruthy();
  });
});
