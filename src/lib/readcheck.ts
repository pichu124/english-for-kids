/**
 * Reading aloud: which words of a sentence did the recognizer hear?
 * Lenient on purpose (children, accents, a cheap microphone): a word counts when any
 * alternative contains it, a close spelling of it, or a word that sounds the same.
 */
import { levenshtein, normalize, soundKey } from './match';

export const sentenceWords = (sentence: string) => normalize(sentence).split(' ').filter(Boolean);

const heardWords = (alternatives: readonly string[]) => alternatives.map((a) => normalize(a).split(' ').filter(Boolean));
const wasHeard = (heard: string[][], w: string) =>
  heard.some((alt) => alt.some((h) => h === w || (w.length >= 4 && levenshtein(h, w) <= 1) || (w.length >= 3 && soundKey(h) === soundKey(w))));

export function wordHits(sentence: string, alternatives: readonly string[]): boolean[] {
  const heard = heardWords(alternatives);
  return sentenceWords(sentence).map((w) => wasHeard(heard, w));
}

/**
 * Per word *as shown on screen* (one entry per display token, e.g. "It's", "ball!"):
 * true when every word inside it was heard, false when not, null for tokens with no word (a dash).
 * Contractions are expanded by normalize(), so "It's" is heard as "it is" — this keeps the
 * green highlights on the right buttons.
 */
export function tokenHits(tokens: readonly string[], alternatives: readonly string[]): (boolean | null)[] {
  const heard = heardWords(alternatives);
  return tokens.map((tok) => {
    const ws = normalize(tok).split(' ').filter(Boolean);
    return ws.length ? ws.every((w) => wasHeard(heard, w)) : null;
  });
}

/** Share of the sentence's words that were heard (0–1). Tiny words (a, the…) count too. */
export const readScore = (hits: boolean[]) => (hits.length ? hits.filter(Boolean).length / hits.length : 0);
