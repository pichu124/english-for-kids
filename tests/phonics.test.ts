import { describe, expect, it } from 'vitest';
import phonics from '../content/phonics.json';

describe('phonics sets', () => {
  it('every blend word is made of sounds taught so far, and readers only use taught sounds + tricky words', () => {
    const taught: string[] = [];
    for (const set of phonics.sets) {
      taught.push(...set.sounds.map((s) => s.s));
      for (const w of set.words) {
        expect(w.parts.join(''), `${set.id} ${w.w}`).toBe(w.w);
        for (const p of w.parts) expect(taught, `${set.id} ${w.w}: sound "${p}" not taught yet`).toContain(p);
      }
      // a reader word is decodable if it can be split greedily into taught sounds (digraphs first)
      const sounds = [...taught].sort((a, b) => b.length - a.length);
      const decodable = (word: string): boolean => {
        if (!word) return true;
        return sounds.some((s) => word.startsWith(s) && decodable(word.slice(s.length)));
      };
      // the set's own little book and its extra books ("more", Little Books shelf)
      const books = [set.reader, ...((set as { more?: (typeof set.reader)[] }).more ?? [])];
      expect(books.length).toBeGreaterThan(0);
      for (const p of books.flatMap((b) => b.pages)) {
        for (const raw of p.text.split(/\s+/)) {
          const word = raw.replace(/[^a-zA-Z]/g, '');
          if (!word || phonics.tricky.includes(word)) continue;
          expect(decodable(word.toLowerCase()), `${set.id} reader: "${word}"`).toBe(true);
        }
      }
    }
  });
});
