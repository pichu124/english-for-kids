import { describe, expect, it } from 'vitest';
import { matchSpeech, normalize, soundKey } from '../src/lib/match';

const m = (target: string, alts: string[], accepts: string[] = []) => matchSpeech(target, accepts, alts).ok;

describe('normalize', () => {
  it('lowercases, strips punctuation, expands contractions', () => {
    expect(normalize("I'm Fine!")).toBe('i am fine');
    expect(normalize('I’m fine.')).toBe('i am fine');
    expect(normalize('How R U?')).toBe('how are you');
  });
});

describe('matchSpeech', () => {
  it('accepts exact and contained words', () => {
    expect(m('dog', ['dog'])).toBe(true);
    expect(m('dog', ['a dog'])).toBe(true);
    expect(m('dog', ['the', 'it is a dog'])).toBe(true);
    expect(m('ice cream', ['I like ice cream'])).toBe(true);
    expect(m('ice cream', ['icecream'])).toBe(true);
    expect(m("I'm fine", ['i am fine thank you'])).toBe(true);
  });

  it('accepts near misses typical of kids', () => {
    expect(m('cat', ['cut'])).toBe(true);
    expect(m('banana', ['bananas'])).toBe(true);
    expect(m('yellow', ['hello'])).toBe(true); // lenient on purpose
    expect(m('grandma', ['grammar'])).toBe(true);
    expect(m('brother', ['bruder'])).toBe(true);
    expect(m('thank you', ['tank you'])).toBe(true);
    expect(m('good morning', ['good mooning'])).toBe(true);
  });

  it('uses accepted variants', () => {
    expect(m('mum', ['mom'], ['mom', 'mommy'])).toBe(true);
    expect(m('thank you', ['thanks'], ['thanks'])).toBe(true);
  });

  it('does not accept unrelated speech', () => {
    expect(m('elephant', ['dog'])).toBe(false);
    expect(m('banana', ['red car'])).toBe(false);
    expect(m('good morning', ['hello'])).toBe(false);
    expect(m('dog', [])).toBe(false);
    expect(m('egg', ['zebra on a skateboard'], ['ag', 'ack'])).toBe(false);
    expect(m('I\'m fine', ['i like a fish'])).toBe(false);
  });

  it('checks every alternative, not just the first', () => {
    expect(m('fish', ['fitch', 'fist', 'fish'])).toBe(true);
  });
});

describe('soundKey', () => {
  it('merges look-alike sounds', () => {
    expect(soundKey('cat')).toBe(soundKey('kat'));
    expect(soundKey('phish')).toBe(soundKey('fish'));
  });
});
