import { describe, expect, it } from 'vitest';
import alphabet from '../content/alphabet.json';
import { spellable, topics, topicsOfLevel } from '../src/content';
import { letterName, spellOut } from '../src/lib/letters';

describe('reading & spelling', () => {
  it('alphabet has A–Z once, each word starts with its letter (X: fox, the x is at the end)', () => {
    const letters = alphabet.letters.map((l) => l.letter);
    expect(letters.join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    for (const l of alphabet.letters) {
      if (l.letter === 'X') expect(l.word.toUpperCase().includes('X')).toBe(true);
      else expect(l.word[0].toUpperCase()).toBe(l.letter);
      expect(l.emoji).toBeTruthy();
    }
  });

  it('says letter names, not lone letters', () => {
    expect(letterName('a')).toBe('ay');
    expect(letterName('W')).toBe('double you');
    expect(spellOut('cat')).toBe('see, ay, tee');
  });

  it('Starters units get read (and spell when there are words to spell); younger levels do not', () => {
    for (const t of topicsOfLevel('L2')) {
      expect(t.steps, t.id).toContain('read');
      const canSpell = t.words.filter((w) => spellable(w)).length >= 2;
      expect(t.steps.includes('spell'), t.id).toBe(canSpell);
    }
    for (const t of topics.filter((x) => x.level !== 'L2')) {
      expect(t.steps.includes('read') || t.steps.includes('spell'), t.id).toBe(false);
    }
  });

  it('spellable: single words of 2–6 letters', () => {
    const w = (text: string) => ({ id: text, text, sentence: text, image: { emoji: 'x' } }) as never;
    expect(spellable(w('cat'))).toBe(true);
    expect(spellable(w('ice cream'))).toBe(false);
    expect(spellable(w('T-shirt'))).toBe(false);
    expect(spellable(w('crocodile'))).toBe(false);
  });
});
