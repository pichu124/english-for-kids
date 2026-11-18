import { describe, expect, it } from 'vitest';
import { contentProblems, LEVELS, topics, topicsOfLevel } from '../src/content';

describe('content (format v2)', () => {
  it('has no problems', () => {
    expect(contentProblems).toEqual([]);
  });

  it('keeps the original unit ids, so existing progress is not lost', () => {
    for (const id of ['colors', 'animals', 'food', 'family', 'hello']) {
      expect(topics.find((t) => t.id === id)?.level).toBe('L2');
    }
  });

  it('has units for Early Years and Starters', () => {
    expect(topicsOfLevel('L0').length).toBeGreaterThan(0);
    expect(topicsOfLevel('L1').length).toBeGreaterThan(0);
    expect(topicsOfLevel('L2').length).toBeGreaterThanOrEqual(5);
  });

  it('every unit has enough words for its tap game and a casa age group matching its level', () => {
    for (const t of topics) {
      const level = LEVELS.find((l) => l.id === t.level)!;
      expect(t.words.length, t.id).toBeGreaterThanOrEqual(level.choices);
      if (t.casa?.luaTuoi) expect(t.casa.luaTuoi, t.id).toBe(level.casaLuaTuoi);
    }
  });

  it('unit-level sentences override the word bank', () => {
    const cat = topics.find((t) => t.id === 'l0-animals')!.words.find((w) => w.id === 'cat')!;
    expect(cat.sentence).toBe('Meow, meow! A cat!');
    const cat2 = topics.find((t) => t.id === 'animals')!.words.find((w) => w.id === 'cat')!;
    expect(cat2.sentence).toMatch(/^This is a cat/);
  });
});
