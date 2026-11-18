/**
 * Spaced review (Leitner boxes). Finishing a unit puts its words in box 1, due
 * tomorrow. In a review session a word answered right first time moves up a box
 * (due later); a miss sends it back to box 1. Intervals in days per box:
 */
import { topicById, topicsOfLevel, type LevelId, type Topic, type Word, playPromptFor } from '../content';
import { getState, today, update, wordKey } from './storage';

export const INTERVALS = [1, 2, 4, 7, 14];
export const REVIEW_ID = 'review';
const MAX_WORDS = 6;
export const MIN_WORDS = 3;

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const x = new Date(y, m - 1, d + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

/** After a unit is finished: start reviewing words that are not scheduled yet. */
export function scheduleUnit(t: Topic): void {
  if (t.id === REVIEW_ID) return;
  update((s) => {
    for (const w of t.words) {
      const k = wordKey(t.id, w.id);
      if (!s.review[k]) s.review[k] = { box: 1, due: addDays(today(), INTERVALS[0]) };
    }
  });
}

/** Record one review answer. */
export function recordReview(key: string, firstTry: boolean): void {
  update((s) => {
    const r = s.review[key] ?? { box: 1, due: today() };
    r.box = firstTry ? Math.min(INTERVALS.length, r.box + 1) : 1;
    r.due = addDays(today(), INTERVALS[r.box - 1]);
    s.review[key] = r;
  });
}

type Due = { key: string; topic: Topic; word: Word; due: string };

/** Words of this level whose review is due, oldest first. */
export function dueWords(level: LevelId): Due[] {
  const s = getState();
  const ids = new Set(topicsOfLevel(level).map((t) => t.id));
  const out: Due[] = [];
  for (const [key, r] of Object.entries(s.review)) {
    const [tid, wid] = key.split('/');
    if (!ids.has(tid) || r.due > today()) continue;
    const t = topicById(tid);
    const w = t?.words.find((x) => x.id === wid);
    if (t && w) out.push({ key, topic: t, word: w, due: r.due });
  }
  return out.sort((a, b) => a.due.localeCompare(b.due));
}

/**
 * A playable review "unit" made of due words (tap game only). Each word keeps the
 * prompt of its own unit. Its id encodes the word keys so it survives navigation.
 */
export function buildReview(level: LevelId): { topic: Topic; keys: Map<string, string> } | null {
  const due = dueWords(level);
  // one entry per word id (the same word can be due from two units)
  const seen = new Set<string>();
  const pickd = due.filter((d) => (seen.has(d.word.id) ? false : (seen.add(d.word.id), true))).slice(0, MAX_WORDS);
  if (pickd.length < MIN_WORDS) return null;
  const keys = new Map(pickd.map((d) => [d.word.id, d.key]));
  const topic: Topic = {
    id: REVIEW_ID,
    level,
    topic: 'review',
    order: 0,
    title: 'Review',
    titleVi: 'Ôn bài',
    icon: '🔁',
    color: '#ffd166',
    intro: "Let's remember some words!",
    playPrompt: '{word}',
    block: { name: 'Review', style: 'gold', color: '#ffc93c' },
    steps: ['tap-picture'],
    playRounds: pickd.length,
    actions: [],
    words: pickd.map((d) => ({ ...d.word, play: playPromptFor(d.topic, d.word) })),
  };
  return { topic, keys };
}
