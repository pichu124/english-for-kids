/**
 * "Starters practice test": 15 questions in the three parts of the real exam —
 * Listening (pictures), Spelling (letters said one by one → the written word),
 * Reading (yes/no sentences, picture → word). First answer counts, no hints.
 */
import { spellable, topicsOfLevel, yesNoAble, type Topic, type Word } from '../content';
import { shuffle } from './dom';
import { isLearned } from './progress';
import { getState, today, update, wordKey } from './storage';

export type Part = 'listening' | 'spelling' | 'reading';
export type Question =
  | { part: 'listening'; kind: 'pick-picture'; target: Word; options: Word[]; prompt: string }
  | { part: 'spelling'; kind: 'pick-spelled'; target: Word; options: Word[] }
  | { part: 'reading'; kind: 'yes-no'; shown: Word; sentence: string; truth: boolean }
  | { part: 'reading'; kind: 'pick-word'; target: Word; options: Word[] };

export const PART_LABEL: Record<Part, string> = { listening: 'Nghe', spelling: 'Đánh vần', reading: 'Đọc' };
export const PASS = 0.8;

type Item = { topic: Topic; word: Word };
const article = (x: string) => (/^[aeiou]/i.test(x) ? 'an' : 'a');
const picturable = (w: Word) => !!(w.image.emoji || w.image.color);

/** Words of the level with a picture, learned ones first, one per spelling. */
function pool(level: string): Item[] {
  const s = getState();
  const seen = new Set<string>();
  const learned: Item[] = [];
  const rest: Item[] = [];
  for (const topic of topicsOfLevel(level)) {
    for (const word of topic.words) {
      if (!picturable(word) || seen.has(word.text)) continue;
      seen.add(word.text);
      (isLearned(s.words[wordKey(topic.id, word.id)]) ? learned : rest).push({ topic, word });
    }
  }
  return [...shuffle(learned), ...shuffle(rest)];
}

/** Other words of the same unit first (harder, like the real test), then any. */
function distractors(it: Item, all: Item[], n: number, ok: (w: Word) => boolean = () => true): Word[] {
  const same = shuffle(it.topic.words.filter((w) => w.text !== it.word.text && picturable(w) && ok(w)));
  const any = shuffle(all.map((x) => x.word).filter((w) => w.text !== it.word.text && ok(w) && !same.includes(w)));
  return [...same, ...any].slice(0, n);
}

export function buildTest(level = 'L2'): Question[] {
  const all = pool(level);
  const used = new Set<string>();
  const take = (ok: (it: Item) => boolean, n: number) => {
    const out: Item[] = [];
    for (const it of all) {
      if (out.length >= n) break;
      if (!used.has(it.word.text) && ok(it)) {
        used.add(it.word.text);
        out.push(it);
      }
    }
    return out;
  };
  const qs: Question[] = [];
  for (const it of take(() => true, 5)) {
    qs.push({ part: 'listening', kind: 'pick-picture', target: it.word, options: shuffle([it.word, ...distractors(it, all, 3)]), prompt: it.word.play ?? `Where is the ${it.word.text}?` });
  }
  const short = (w: Word) => spellable(w, 5);
  for (const it of take((x) => short(x.word), 3)) {
    qs.push({ part: 'spelling', kind: 'pick-spelled', target: it.word, options: shuffle([it.word, ...distractors(it, all, 2, short)]) });
  }
  for (const it of take((x) => yesNoAble(x.word), 4)) {
    const other = distractors(it, all, 1, yesNoAble)[0];
    const truth = !other || Math.random() < 0.5;
    const named = truth ? it.word : other;
    qs.push({ part: 'reading', kind: 'yes-no', shown: it.word, sentence: `This is ${article(named.text)} ${named.text}.`, truth });
  }
  for (const it of take(() => true, 3)) {
    qs.push({ part: 'reading', kind: 'pick-word', target: it.word, options: shuffle([it.word, ...distractors(it, all, 2)]) });
  }
  return qs;
}

export type Score = Record<Part, [number, number]>;
export type TestResult = { day: string; score: Score };

/** 1–5 shields per part, like the Cambridge Starters report. */
export const shields = ([got, total]: [number, number]) => (total ? Math.max(1, Math.round((got / total) * 5)) : 0);
export const passed = (s: Score) => {
  const got = s.listening[0] + s.spelling[0] + s.reading[0];
  const total = s.listening[1] + s.spelling[1] + s.reading[1];
  return total > 0 && got / total >= PASS;
};

export function saveResult(score: Score): void {
  update((s) => {
    s.tests = [...(s.tests ?? []), { day: today(), score }].slice(-10);
  });
}
export const testResults = (): TestResult[] => getState().tests ?? [];
