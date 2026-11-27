import { describe, expect, it } from 'vitest';
import { normalizeLine, splitSentences } from '../src/lib/voice';

describe('recorded voice lines', () => {
  it('normalises text so a line finds its recording', () => {
    expect(normalizeLine("Hello, Bix! It’s HOT!")).toBe("hello bix it's hot");
    expect(normalizeLine('  This is a dog.  ')).toBe('this is a dog');
  });
  it('splits a line into sentences', () => {
    expect(splitSentences('Great job! Find the cat. Where is it?')).toEqual(['Great job!', 'Find the cat.', 'Where is it?']);
    expect(splitSentences('cat')).toEqual(['cat']);
    expect(splitSentences('… ')).toEqual([]);
  });
});
