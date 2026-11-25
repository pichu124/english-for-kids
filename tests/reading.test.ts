import { describe, expect, it } from 'vitest';
import alphabet from '../content/alphabet.json';
import { buildable, firstSentence, hasPart2, partSteps, sentenceCount, sentenceEnd, spellable, topics, topicsOfLevel, yesNoAble } from '../src/content';
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
      expect(t.steps.includes('sentence'), t.id).toBe(sentenceCount(t.words) > 0);
      expect(hasPart2(t), t.id).toBe(true);
      expect(partSteps(t, 1).some((st) => ['read', 'spell', 'sentence'].includes(st)), t.id).toBe(false);
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
  it('sentences: first sentence, its punctuation, buildable and yes/no patterns', () => {
    const w = (text: string, sentence: string) => ({ id: text, text, sentence, image: { emoji: 'x' } }) as never;
    expect(firstSentence(w('dog', 'This is a dog. It says woof!'))).toBe('This is a dog');
    expect(sentenceEnd(w('how are you', 'How are you? I am fine.'))).toBe('?');
    expect(buildable(w('dog', 'This is a dog. It says woof!'))).toBe(true);
    expect(buildable(w('dog', 'Dog!'))).toBe(false);
    expect(yesNoAble(w('elephant', 'This is an elephant. It is big.'))).toBe(true);
    expect(yesNoAble(w('grapes', 'These are grapes.'))).toBe(false);
    expect(topicsOfLevel('L2').every((t) => sentenceCount(t.words) > 0)).toBe(true);
  });
});
