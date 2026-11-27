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
  // one entry per spelling: the same word can be due from two units, and two words can
  // share a spelling (orange the colour / the fruit) — both pictures would then be right
  const seen = new Set<string>();
  const pickd = due.filter((d) => (seen.has(d.word.text) ? false : (seen.add(d.word.text), true))).slice(0, MAX_WORDS);
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

/**
 * "Practice before the test": the words this child found hardest in the level (rounds that
 * needed more than one try, most first), then words of finished units not learned yet.
 * Played like a review: hear the words again, then find each picture.
 */
export const PREP_ID = 'prep';
export function buildPrep(level: LevelId): { topic: Topic; keys: Map<string, string> } | null {
  const s = getState();
  const seen = new Set<string>();
  const items: { key: string; topic: Topic; word: Word; score: number }[] = [];
  for (const t of topicsOfLevel(level)) {
    const finished = (s.topics[t.id]?.completed ?? 0) > 0;
    for (const w of t.words) {
      const key = wordKey(t.id, w.id);
      const ws = s.words[key];
      const slips = ws?.slips ?? 0;
      const learned = !!ws && (ws.said || !!ws.known);
      const score = slips > 0 ? 10 + slips : finished && !learned ? 1 : 0;
      if (score > 0) items.push({ key, topic: t, word: w, score });
    }
  }
  items.sort((a, b) => b.score - a.score);
  const pickd = items.filter((d) => (seen.has(d.word.text) ? false : (seen.add(d.word.text), true))).slice(0, 8);
  if (pickd.length < MIN_WORDS) return null;
  const topic: Topic = {
    id: PREP_ID,
    level,
    topic: 'review',
    order: 0,
    title: 'Practice',
    titleVi: 'Ôn trước khi thi',
    icon: '🎯',
    color: '#9bf6ff',
    intro: "Let's practise the tricky words!",
    playPrompt: '{word}',
    block: { name: 'Practice', style: 'gold', color: '#ffc93c' },
    // listen once more, then find each picture (marks go to each word's own unit, like a review)
    steps: ['listen', 'tap-picture'],
    playRounds: pickd.length,
    actions: [],
    words: pickd.map((d) => ({ ...d.word, play: playPromptFor(d.topic, d.word) })),
  };
  return { topic, keys: new Map(pickd.map((d) => [d.word.id, d.key])) };
}
