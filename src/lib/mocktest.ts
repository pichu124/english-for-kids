/**
 * "Starters practice test": 15 questions in the three parts of the real exam —
 * Listening (pictures + "who is who": find the child in the picture), Spelling (letters said one by one → the written word),
 * Reading (yes/no sentences, picture → word). First answer counts, no hints.
 */
import { buildable, definable, firstSentence, mentions, playPromptFor, sentenceEnd, spellable, topicsOfLevel, writable, yesNoAble, type ReadingText, type Topic, type Word } from '../content';
import { describeKid, makeKids, type Kid } from '../art/kids';
import { shuffle } from './dom';
import { isLearned } from './progress';
import { getState, today, update, wordKey } from './storage';

export type Part = 'listening' | 'spelling' | 'writing' | 'reading';
export type Question =
  | { part: 'listening'; kind: 'pick-picture'; target: Word; options: Word[]; prompt: string }
  | { part: 'listening'; kind: 'find-kid'; kids: Kid[]; target: Kid; prompt: string }
  | { part: 'spelling'; kind: 'pick-spelled'; target: Word; options: Word[] }
  | { part: 'writing'; kind: 'type-word'; target: Word; /** Flyers: read this definition instead of a picture */ def?: string }
  | { part: 'reading'; kind: 'yes-no'; shown: Word; sentence: string; truth: boolean }
  | { part: 'reading'; kind: 'pick-word'; target: Word; options: Word[] }
  | { part: 'reading'; kind: 'text-q'; text: ReadingText; q: ReadingText['questions'][number] };

export const PART_LABEL: Record<Part, string> = { listening: 'Nghe', spelling: 'Đánh vần', writing: 'Viết', reading: 'Đọc' };
/** Parts of the practice test per level (Starters / Movers), in order. */
export const TEST_PARTS: Record<string, Part[]> = { L2: ['listening', 'spelling', 'reading'], L3: ['listening', 'writing', 'reading'], L4: ['listening', 'writing', 'reading'] };
export const TEST_NAME: Record<string, string> = { L2: 'Starters Test', L3: 'Movers Test', L4: 'Flyers Test' };
export const hasTest = (level: string) => level in TEST_PARTS;
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
  for (const it of take(() => true, 3)) {
    qs.push({ part: 'listening', kind: 'pick-picture', target: it.word, options: shuffle([it.word, ...distractors(it, all, 3)]), prompt: playPromptFor(it.topic, it.word) }); // the unit's own question ("Find the red one!", not "Where is the red?")
  }
  // Part 1 of the real test: one picture of children, find who is who from what you hear.
  const kids = makeKids();
  for (const k of shuffle(kids).slice(0, 2)) qs.push({ part: 'listening', kind: 'find-kid', kids, target: k, prompt: describeKid(k) });
  const flyers = level === 'L4';
  const movers = level === 'L3' || flyers; // Flyers builds on the Movers test
  if (flyers) {
    // Flyers "read and write": a definition, then type the word.
    for (const it of take((x) => definable(x.word) && x.word.text.length <= 10, 3)) qs.push({ part: 'writing', kind: 'type-word', target: it.word, def: it.word.def });
  } else if (movers) {
    for (const it of take((x) => writable(x.word) && x.word.text.length <= 7, 3)) qs.push({ part: 'writing', kind: 'type-word', target: it.word });
  } else {
    const short = (w: Word) => spellable(w, 5);
    for (const it of take((x) => short(x.word), 3)) {
      qs.push({ part: 'spelling', kind: 'pick-spelled', target: it.word, options: shuffle([it.word, ...distractors(it, all, 2, short)]) });
    }
  }
  if (movers) {
    // Movers: a picture and a whole sentence — its own (yes) or another word's (no).
    for (const it of take((x) => buildable(x.word), 3)) {
      // the other word's sentence must not also describe this picture ("Grandma drinks a cup of tea." under tea)
      const other = distractors(it, all, 1, (w) => buildable(w) && !mentions(firstSentence(w), it.word.text))[0];
      const truth = !other || Math.random() < 0.5;
      const w = truth ? it.word : other;
      qs.push({ part: 'reading', kind: 'yes-no', shown: it.word, sentence: `${firstSentence(w)}${sentenceEnd(w)}`, truth });
    }
  } else {
    for (const it of take((x) => yesNoAble(x.word), 4)) {
      const other = distractors(it, all, 1, yesNoAble)[0];
      const truth = !other || Math.random() < 0.5;
      const named = truth ? it.word : other;
      qs.push({ part: 'reading', kind: 'yes-no', shown: it.word, sentence: `This is ${article(named.text)} ${named.text}.`, truth });
    }
  }
  const texts = topicsOfLevel(level).map((t) => t.text).filter((t): t is ReadingText => !!t);
  if (movers && texts.length) {
    const text = shuffle(texts)[0];
    for (const q of text.questions.slice(0, 3)) qs.push({ part: 'reading', kind: 'text-q', text, q });
  } else {
    for (const it of take(() => true, 3)) {
      qs.push({ part: 'reading', kind: 'pick-word', target: it.word, options: shuffle([it.word, ...distractors(it, all, 2)]) });
    }
  }
  return qs;
}

export type Score = Partial<Record<Part, [number, number]>>;
export type TestResult = { day: string; level?: string; score: Score };

/** 1–5 shields per part, like the Cambridge Starters report. */
export const shields = ([got, total]: [number, number]) => (total ? Math.max(1, Math.round((got / total) * 5)) : 0);
export const passed = (s: Score) => {
  const parts = Object.values(s).filter((x): x is [number, number] => !!x);
  const got = parts.reduce((n, p) => n + p[0], 0);
  const total = parts.reduce((n, p) => n + p[1], 0);
  return total > 0 && got / total >= PASS;
};

export function saveResult(score: Score, level = 'L2'): void {
  update((s) => {
    s.tests = [...(s.tests ?? []), { day: today(), level, score }].slice(-20);
  });
}
/** Results for one level (old results without a level were Starters). */
export const testResults = (level = 'L2'): TestResult[] => (getState().tests ?? []).filter((t) => (t.level ?? 'L2') === level);
