/** What the child has learned, for the Word Book and other rewards. */
import { topics, topicsOfLevel, type Topic, type Word } from '../content';
import { getState, update, wordKey, type WordStatus } from './storage';

export function markKnown(topicId: string, wordId: string): void {
  update((s) => {
    const ws = (s.words[wordKey(topicId, wordId)] ??= { said: false, tries: 0 });
    ws.known = true;
  });
}

export function markSpelled(topicId: string, wordId: string): void {
  update((s) => {
    const ws = (s.words[wordKey(topicId, wordId)] ??= { said: false, tries: 0 });
    ws.spelled = true;
    ws.known = true;
  });
}

/** A word becomes a sticker once the child said it or picked it right first time. */
export const isLearned = (ws?: WordStatus) => !!ws && (ws.said || !!ws.known);

export function learnedIn(t: Topic): Word[] {
  const s = getState();
  return t.words.filter((w) => isLearned(s.words[wordKey(t.id, w.id)]));
}

export function stickerCount(level?: string): { got: number; total: number } {
  const list = level ? topicsOfLevel(level) : topics;
  let got = 0;
  let total = 0;
  for (const t of list) {
    total += t.words.length;
    got += learnedIn(t).length;
  }
  return { got, total };
}

/** Lessons finished, summed over all units (drives Bix's wardrobe). */
export function lessonsDone(): number {
  return Object.values(getState().topics).reduce((n, t) => n + (t.completed ?? 0), 0);
}

/** Distinct days with at least one finished lesson (the garden). */
export function learningDays(): string[] {
  return Object.entries(getState().days)
    .filter(([, d]) => (d.lessons ?? 0) > 0)
    .map(([day]) => day)
    .sort();
}

/**
 * Words for mini-games: learned words of this level first (one per spelling),
 * topped up from the level's units in map order so a new child can play too.
 */
export function practicePool(level: string, min: number): Word[] {
  const s = getState();
  const seen = new Set<string>();
  const learned: Word[] = [];
  const rest: Word[] = [];
  for (const t of topicsOfLevel(level)) {
    for (const w of t.words) {
      if (seen.has(w.text)) continue;
      seen.add(w.text);
      (isLearned(s.words[wordKey(t.id, w.id)]) ? learned : rest).push(w);
    }
  }
  return learned.length >= min ? learned : learned.concat(rest.slice(0, min - learned.length));
}

// ---------------------------------------------------------------- badges & certificates

export type Tier = 'none' | 'bronze' | 'silver' | 'gold';
export const TIER_NAME: Record<Tier, string> = { none: '', bronze: 'bronze', silver: 'silver', gold: 'gold' };

/**
 * A badge per unit: bronze = finished once, silver = every word is a sticker,
 * gold = every word a sticker and the unit finished 3 times.
 */
export function unitBadge(t: Topic): Tier {
  const done = getState().topics[t.id]?.completed ?? 0;
  if (!done) return 'none';
  const all = learnedIn(t).length === t.words.length;
  if (all && done >= 3) return 'gold';
  return all ? 'silver' : 'bronze';
}

export function levelProgress(level: string): { done: number; total: number } {
  const list = topicsOfLevel(level);
  const s = getState();
  return { done: list.filter((t) => (s.topics[t.id]?.completed ?? 0) > 0).length, total: list.length };
}
export const levelDone = (level: string) => {
  const p = levelProgress(level);
  return p.total > 0 && p.done === p.total;
};

/** Day the last unit of a level was finished (the certificate date). */
export function levelDoneOn(level: string): string {
  const s = getState();
  return topicsOfLevel(level).reduce((d, t) => ((s.topics[t.id]?.lastDone ?? '') > d ? s.topics[t.id].lastDone! : d), '');
}
