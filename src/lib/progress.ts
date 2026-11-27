/** What the child has learned, for the Word Book and other rewards. */
import { topics, topicsOfLevel, type Topic, type Word } from '../content';
import { getState, today, update, wordKey, type WordStatus } from './storage';

export function markKnown(topicId: string, wordId: string): void {
  update((s) => {
    const ws = (s.words[wordKey(topicId, wordId)] ??= { said: false, tries: 0 });
    ws.known = true;
    ws.firstAt ??= today();
  });
}

/** A round on this word needed more than one try (key = "unit/word"). */
export function noteSlip(key: string): void {
  if (!key) return;
  update((s) => {
    const ws = (s.words[key] ??= { said: false, tries: 0 });
    ws.slips = (ws.slips ?? 0) + 1;
    ws.slipAt = today();
  });
}

export function markSpelled(topicId: string, wordId: string): void {
  update((s) => {
    const ws = (s.words[wordKey(topicId, wordId)] ??= { said: false, tries: 0 });
    ws.spelled = true;
    ws.known = true;
    ws.firstAt ??= today();
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
  return Object.values(getState().topics).reduce((n, t) => n + (t.completed ?? 0) + (t.readDone ?? 0), 0);
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

// ---------------------------------------------------------------- weekly report

export type WeekReport = {
  from: string;
  to: string;
  days: { day: string; lessons: number; minutes: number }[];
  learnedDays: number;
  minutes: number;
  lessons: number;
  newWords: { topic: Topic; word: Word }[];
  practise: { topic: Topic; word: Word; slips: number }[];
  recentTopics: Topic[];
  spoken: { auto: number; parent: number; miss: number };
  /** This week: phonics sets finished, pages the child read aloud, chats/speaking practice done. */
  extra: { sounds: number; read: number; talk: number; duo: number; sheets: number; letters: number };
  /** Hello! (first step of Today): how the child said they felt, by day. */
  feelings: { day: string; feel?: string; weather?: string }[];
};

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The last 7 days (today included), for the parent area and the printable report. */
export function weekReport(): WeekReport {
  const s = getState();
  const now = new Date();
  const list = Array.from({ length: 7 }, (_, i) => isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + i)));
  const from = list[0];
  const days = list.map((day) => ({ day, lessons: s.days[day]?.lessons ?? 0, minutes: Math.round((s.days[day]?.seconds ?? 0) / 60) }));
  const inWeek = (d?: string) => !!d && d >= from;
  const seen = new Set<string>();
  const newWords: WeekReport['newWords'] = [];
  const practise: WeekReport['practise'] = [];
  for (const t of topics) {
    for (const w of t.words) {
      const ws = s.words[wordKey(t.id, w.id)];
      if (!ws) continue;
      if (isLearned(ws) && inWeek(ws.firstAt) && !seen.has(w.text)) {
        seen.add(w.text);
        newWords.push({ topic: t, word: w });
      }
      if ((ws.slips ?? 0) > 0 && inWeek(ws.slipAt)) practise.push({ topic: t, word: w, slips: ws.slips! });
    }
  }
  practise.sort((a, b) => b.slips - a.slips);
  const uniqPractise = practise.filter((p, i) => practise.findIndex((q) => q.word.text === p.word.text) === i).slice(0, 8);
  const recentTopics = topics
    .filter((t) => inWeek(s.topics[t.id]?.lastDone))
    .sort((a, b) => (s.topics[b.id].lastDone ?? '').localeCompare(s.topics[a.id].lastDone ?? ''));
  const spoken = list.reduce((acc, d) => ({ auto: acc.auto + (s.days[d]?.auto ?? 0), parent: acc.parent + (s.days[d]?.parent ?? 0), miss: acc.miss + (s.days[d]?.miss ?? 0) }), { auto: 0, parent: 0, miss: 0 });
  return {
    from,
    to: list[6],
    days,
    learnedDays: days.filter((d) => d.lessons > 0).length,
    minutes: days.reduce((n, d) => n + d.minutes, 0),
    lessons: days.reduce((n, d) => n + d.lessons, 0),
    newWords,
    feelings: list.filter((d) => s.days[d]?.circle).map((d) => ({ day: d, feel: s.days[d].circle!.feel, weather: s.days[d].circle!.weather })),
    practise: uniqPractise,
    recentTopics,
    spoken,
    extra: list.reduce(
      (acc, d) => {
        const x = s.days[d];
        return { sounds: acc.sounds + (x?.sounds ?? 0), read: acc.read + (x?.read ?? 0), talk: acc.talk + (x?.talk ?? 0), duo: acc.duo + (x?.duo ?? 0), sheets: acc.sheets + (x?.sheets ?? 0), letters: acc.letters + (x?.letters ?? 0) };
      },
      { sounds: 0, read: 0, talk: 0, duo: 0, sheets: 0, letters: 0 },
    ),
  };
}
