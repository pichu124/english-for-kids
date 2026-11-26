/**
 * Printable worksheets ("Phiếu bài tập in"): exercises generated from a unit's own
 * words, sentences and text — no hand-written worksheet data. The exercises follow
 * the child's level (pictures only for pre-readers, Cambridge-style "look and write",
 * gap fill and reading for Movers/Flyers). The same unit on the same day always
 * gives the same sheet (seeded shuffle), so a reprint matches the answer key.
 */
import { gappable, levelById, topicsOfLevel, type Level, type ReadingText, type Topic, type Word } from '../content';
import { getState, today } from './storage';

// ---------------------------------------------------------------- seeded randomness

/** A small fast PRNG (mulberry32) seeded from a string. */
export function seededRandom(seed: string): () => number {
  let a = 0x9e3779b9;
  for (let i = 0; i < seed.length; i++) a = Math.imul(a ^ seed.charCodeAt(i), 0x85ebca6b) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(arr: readonly T[], rnd: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A shuffle where (when possible) no item stays in its place — so matching is not just "straight across". */
function derange<T>(arr: readonly T[], rnd: () => number): T[] {
  if (arr.length < 2) return arr.slice();
  let best = seededShuffle(arr, rnd);
  for (let k = 0; k < 20 && best.some((x, i) => x === arr[i]); k++) best = seededShuffle(arr, rnd);
  return best;
}

// ---------------------------------------------------------------- sections

export type WriteItem = { word: Word; /** letters already written in (Starters: the first one) */ given: number };
export type SearchPlacement = { word: string; row: number; col: number; dir: 'across' | 'down' };
export type GapRow = { before: string; after: string; answer: string };

export type Section =
  | { kind: 'colour'; words: Word[] }
  | { kind: 'same'; left: Word[]; right: Word[] }
  | { kind: 'circle'; rows: { options: Word[]; answer: Word }[] }
  | { kind: 'match'; pictures: Word[]; words: Word[] }
  | { kind: 'trace'; words: Word[] }
  | { kind: 'write'; items: WriteItem[] }
  | { kind: 'search'; grid: string[][]; placed: SearchPlacement[] }
  | { kind: 'gaps'; rows: GapRow[]; bank: string[] }
  | { kind: 'define'; rows: { def: string; answer: string }[]; bank: string[] }
  | { kind: 'text'; text: ReadingText };

export type Worksheet = { topic: Topic; level: Level; day: string; sections: Section[] };

/** One picture per meaning: words with the same text appear once. */
const uniqueWords = (words: Word[]) => words.filter((w, i) => words.findIndex((x) => x.text.toLowerCase() === w.text.toLowerCase()) === i);
const isSingle = (w: Word) => /^[a-z]+$/i.test(w.text);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Words for writing: single words first (shortest first for Starters), then short phrases. */
function forWriting(words: Word[], rnd: () => number, n: number, maxLen: number): Word[] {
  const ok = words.filter((w) => w.text.replace(/[^a-z]/gi, '').length >= 2 && w.text.length <= maxLen);
  const single = seededShuffle(ok.filter(isSingle), rnd);
  const other = seededShuffle(ok.filter((w) => !isSingle(w)), rnd);
  return single.concat(other).slice(0, n);
}

/**
 * A word search: the unit's one-word words (A–Z) placed across (→) or down (↓),
 * other cells filled with random letters. Words that do not fit are left out.
 */
export function wordSearch(words: string[], rnd: () => number, size = 8): { grid: string[][]; placed: SearchPlacement[] } {
  const list = [...new Set(words.map((w) => w.toUpperCase()).filter((w) => /^[A-Z]{3,}$/.test(w) && w.length <= size))]
    .sort((a, b) => b.length - a.length)
    .slice(0, 7);
  const grid: string[][] = Array.from({ length: size }, () => Array<string>(size).fill(''));
  const placed: SearchPlacement[] = [];
  for (const word of list) {
    for (let attempt = 0; attempt < 300; attempt++) {
      const dir = rnd() < 0.5 ? 'across' : 'down';
      const row = Math.floor(rnd() * (dir === 'down' ? size - word.length + 1 : size));
      const col = Math.floor(rnd() * (dir === 'across' ? size - word.length + 1 : size));
      const cells = [...word].map((_, i) => (dir === 'across' ? [row, col + i] : [row + i, col]));
      if (cells.every(([r, c], i) => grid[r][c] === '' || grid[r][c] === word[i])) {
        cells.forEach(([r, c], i) => (grid[r][c] = word[i]));
        placed.push({ word, row, col, dir });
        break;
      }
    }
  }
  const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const r of grid) for (let c = 0; c < size; c++) if (!r[c]) r[c] = ABC[Math.floor(rnd() * 26)];
  return { grid, placed };
}

/** Gap-fill rows: the unit's hand-written gaps, or its example sentences when the unit allows it. */
function gapRows(t: Topic, rnd: () => number): { rows: GapRow[]; bank: string[] } | null {
  if (t.gaps?.length) {
    const gaps = seededShuffle(t.gaps, rnd).slice(0, 5);
    const rows = gaps.map((g) => {
      const [before, after] = g.s.split('___');
      return { before, after, answer: g.answer };
    });
    const answers = rows.map((r) => r.answer);
    const extra = seededShuffle([...new Set(gaps.flatMap((g) => g.options))].filter((o) => !answers.some((a) => a.toLowerCase() === o.toLowerCase())), rnd).slice(0, 2);
    return { rows, bank: seededShuffle([...new Set([...answers, ...extra])], rnd) };
  }
  if (!t.steps.includes('gap')) return null;
  const ws = seededShuffle(uniqueWords(t.words).filter(gappable), rnd).slice(0, 4);
  if (ws.length < 2) return null;
  const rows = ws.map((w) => {
    const first = w.sentence.split(/(?<=[.!?])\s+/).find((s) => new RegExp(`\\b${esc(w.text)}\\b`, 'i').test(s)) ?? w.sentence;
    const m = first.match(new RegExp(`\\b${esc(w.text)}\\b`, 'i'))!;
    return { before: first.slice(0, m.index), after: first.slice(m.index! + m[0].length), answer: m[0] };
  });
  return { rows, bank: seededShuffle(rows.map((r) => r.answer), rnd) };
}

export function buildWorksheet(t: Topic, day = today()): Worksheet {
  const level = levelById(t.level)!;
  const rnd = seededRandom(`${t.id}|${day}`);
  const words = uniqueWords(t.words);
  const sections: Section[] = [];
  const lv = Number(t.level.slice(1));

  if (lv <= 1) {
    // Pre-readers: pictures only.
    sections.push({ kind: 'colour', words: seededShuffle(words, rnd).slice(0, 2) });
    const same = seededShuffle(words, rnd).slice(0, 4);
    sections.push({ kind: 'same', left: same, right: derange(same, rnd) });
    const targets = seededShuffle(words, rnd).slice(0, 4);
    sections.push({
      kind: 'circle',
      rows: targets.map((answer) => ({ answer, options: seededShuffle([answer, ...seededShuffle(words.filter((w) => w !== answer), rnd).slice(0, 2)], rnd) })),
    });
  } else if (lv === 2) {
    const m = seededShuffle(words, rnd).slice(0, 6);
    sections.push({ kind: 'match', pictures: m, words: derange(m, rnd) });
    sections.push({ kind: 'trace', words: forWriting(words, rnd, 4, 12) });
    sections.push({ kind: 'write', items: forWriting(words, rnd, 6, 10).map((word) => ({ word, given: 1 })) });
    const ws = wordSearch(words.filter(isSingle).map((w) => w.text), rnd);
    if (ws.placed.length >= 2) sections.push({ kind: 'search', ...ws });
  } else {
    sections.push({ kind: 'write', items: forWriting(words, rnd, lv === 3 ? 6 : 4, 14).map((word) => ({ word, given: 0 })) });
    const gaps = gapRows(t, rnd);
    if (gaps) sections.push({ kind: 'gaps', ...gaps });
    if (lv >= 4) {
      const defs = seededShuffle(words.filter((w) => w.def), rnd).slice(0, 5);
      if (defs.length >= 2) {
        const extra = seededShuffle(words.filter((w) => !defs.includes(w)), rnd).slice(0, 2);
        sections.push({ kind: 'define', rows: defs.map((w) => ({ def: w.def!, answer: w.text })), bank: seededShuffle([...defs, ...extra].map((w) => w.text), rnd) });
      }
    }
    if (t.text) sections.push({ kind: 'text', text: t.text });
    // A short unit (no gaps, no text): a word search keeps the sheet worth printing.
    if (sections.length < 3) {
      const size = Math.min(10, Math.max(8, ...words.filter(isSingle).map((w) => w.text.length)));
      const ws = wordSearch(words.filter(isSingle).map((w) => w.text), rnd, size);
      if (ws.placed.length >= 2) sections.push({ kind: 'search', ...ws });
    }
    // Still short (phrases like "seven o'clock" do not go in a word search): match pictures and words.
    if (sections.length < 3) {
      const m = seededShuffle(words, rnd).slice(0, 6);
      sections.unshift({ kind: 'match', pictures: m, words: derange(m, rnd) });
    }
  }
  return { topic: t, level, day, sections };
}

/** The unit to suggest: the one of this level the child studied most recently, else the first. */
export function defaultUnit(level: string): Topic | undefined {
  const st = getState().topics;
  const list = topicsOfLevel(level);
  let best: Topic | undefined;
  for (const t of list) {
    const d = st[t.id]?.lastDone;
    if (d && (!best || d >= (st[best.id]?.lastDone ?? ''))) best = t;
  }
  return best ?? list[0];
}
