/**
 * Reading aloud: which words of a sentence did the recognizer hear?
 * Lenient on purpose (children, accents, a cheap microphone): a word counts when any
 * alternative contains it, a close spelling of it, or a word that sounds the same.
 */
import { levenshtein, normalize, soundKey } from './match';

export const sentenceWords = (sentence: string) => normalize(sentence).split(' ').filter(Boolean);

export function wordHits(sentence: string, alternatives: readonly string[]): boolean[] {
  const heard = alternatives.map((a) => normalize(a).split(' ').filter(Boolean));
  return sentenceWords(sentence).map((w) =>
    heard.some((alt) => alt.some((h) => h === w || (w.length >= 4 && levenshtein(h, w) <= 1) || (w.length >= 3 && soundKey(h) === soundKey(w)))),
  );
}

/** Share of the sentence's words that were heard (0–1). Tiny words (a, the…) count too. */
export const readScore = (hits: boolean[]) => (hits.length ? hits.filter(Boolean).length / hits.length : 0);
