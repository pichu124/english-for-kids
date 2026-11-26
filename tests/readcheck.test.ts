import { describe, expect, it } from 'vitest';
import { tokenHits, wordHits, readScore } from '../src/lib/readcheck';

describe('reading aloud', () => {
  it('lights the buttons shown on screen, contractions included', () => {
    const tokens = "It's a big red ball!".split(' ');
    expect(tokenHits(tokens, ['it is a big ball'])).toEqual([true, true, true, false, true]);
  });
  it('a dash is not a word', () => {
    expect(tokenHits(['Sam', '—', 'run'], ['sam run'])).toEqual([true, null, true]);
  });
  it('score counts every word', () => {
    expect(readScore(wordHits('The cat sat.', ['the cat']))).toBeCloseTo(2 / 3);
  });
});
