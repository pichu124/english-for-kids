import { Bix } from '../art/bix';
import { h } from '../lib/dom';
import { wordEmoji } from '../lib/emoji';
import { letterName, spellOut } from '../lib/letters';
import { sfx } from '../lib/sfx';
import { dayLog, getState, update } from '../lib/storage';
import { advance, GUIDES, strokeDone, STROKES, type Pt } from '../lib/strokes';
import { say } from '../lib/tts';
import type { Ctx } from '../router';
import alphabet from '../../content/alphabet.json';
import { pick, PRAISE } from './lesson/shared';
import { confetti, homeButton } from './widgets';

/**
 * ✏️ Write: trace a letter with a finger, stroke by stroke. A green dot shows where to
 * start and a little ball shows the way; the stroke fills in as the finger follows it.
 * Going off the line just pauses the filling — there is no "wrong".
 */
const NS = 'http://www.w3.org/2000/svg';
const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
};
// (the alphabet straight from the content: abc.ts imports this file)
const LETTERS = (alphabet as { letters: { letter: string; word: string; emoji: string }[] }).letters;
const ORDER = LETTERS.map((l) => l.letter.toLowerCase());
const COLORS = ['#ef476f', '#ff924c', '#f4a300', '#4caf50', '#1fa2d6', '#7b6cf6'];
const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
/** Short words made only of sounds from the first phonics sets (the child can read them too). */
const WORDS: [string, string][] = [
  ['cat', '🐱'], ['dog', '🐶'], ['sun', '☀️'], ['pig', '🐷'], ['hat', '🎩'], ['bus', '🚌'], ['bed', '🛏️'], ['fox', '🦊'], ['hen', '🐔'], ['pen', '🖊️'],
  ['red', '🔴'], ['cap', '🧢'], ['box', '📦'], ['bag', '👜'], ['bug', '🐛'], ['ant', '🐜'], ['map', '🗺️'], ['van', '🚐'], ['jet', '✈️'], ['web', '🕸️'],
];

/** What can be written: small letters, big letters, numbers 0–10, short words. */
export type TraceKind = 'small' | 'big' | 'num' | 'word';
const LISTS: Record<TraceKind, string[]> = {
  small: ORDER,
  big: ORDER.map((c) => c.toUpperCase()),
  num: NUM_WORDS.map((_, n) => String(n)),
  word: WORDS.map(([w]) => `w:${w}`),
};
const kindOf = (key: string): TraceKind => (key.startsWith('w:') ? 'word' : /^\d+$/.test(key) ? 'num' : key === key.toLowerCase() ? 'small' : 'big');
const isTraceKey = (key: string) => Object.values(LISTS).some((l) => l.includes(key));

/** The next one to write in a kind: the first not written yet. */
export function nextToTrace(kind: TraceKind = 'small'): string {
  const done = getState().traced ?? {};
  return LISTS[kind].find((c) => !done[c]) ?? LISTS[kind][0];
}

type Item = { glyphs: string[]; color: string; intro: string; praise: () => string; listen: string; pic: HTMLElement; word: HTMLElement };
function itemFor(key: string): Item {
  const kind = kindOf(key);
  const idx = LISTS[kind].indexOf(key);
  const color = COLORS[idx % COLORS.length];
  if (kind === 'word') {
    const w = key.slice(2);
    const emoji = WORDS.find(([x]) => x === w)![1];
    return {
      glyphs: w.split(''),
      color,
      intro: `Let's write ${w}! Start at the green dot.`,
      praise: () => `${pick(PRAISE)} ${w}! ${spellOut(w)}. ${w}!`,
      listen: `${w}. ${spellOut(w)}. ${w}.`,
      pic: h('div', { class: 'tr-pic', 'aria-hidden': 'true' }, wordEmoji(emoji) ?? ''),
      word: h('div', { class: 'tr-word', lang: 'en' }, w),
    };
  }
  if (kind === 'num') {
    const n = Number(key);
    return {
      glyphs: key.split(''),
      color,
      intro: `Let's write ${NUM_WORDS[n]}! Start at the green dot.`,
      praise: () => `${pick(PRAISE)} ${NUM_WORDS[n]}!`,
      listen: `${NUM_WORDS[n]}.`,
      // count it: n apples (none for zero)
      pic: h('div', { class: 'tr-count', 'aria-hidden': 'true' }, n ? Array.from({ length: n }, () => h('span', {}, '🍎')) : h('span', { class: 'tr-zero' }, '🍽️')),
      word: h('div', { class: 'tr-word', lang: 'en' }, NUM_WORDS[n]),
    };
  }
  const lower = key.toLowerCase();
  const info = LETTERS.find((l) => l.letter.toLowerCase() === lower)!;
  return {
    glyphs: [key],
    color,
    intro: `Let's write ${letterName(lower)}! Start at the green dot.`,
    praise: () => `${pick(PRAISE)} ${letterName(lower)}! ${letterName(lower)} is for ${info.word}!`,
    listen: `${letterName(lower)} is for ${info.word}.`,
    pic: h('div', { class: 'tr-pic', 'aria-hidden': 'true' }, wordEmoji(info.emoji) ?? ''),
    word: h('div', { class: 'tr-word', lang: 'en' }, h('b', { style: `color:${color}` }, info.word.slice(0, 1)), info.word.slice(1)),
  };
}

export function traceScreen(ctx: Ctx): HTMLElement {
  const ch = isTraceKey(ctx.params.trace) ? ctx.params.trace : nextToTrace();
  const kind = kindOf(ch);
  const list = LISTS[kind];
  const i = list.indexOf(ch);
  const item = itemFor(ch);
  const color = item.color;
  const bix = new Bix({ size: 'sm', bubble: false }).setMood('hello');

  // the writing board: guide lines, the letters in grey, then each stroke filling in colour;
  // several letters (a word, 10) sit side by side
  const ADV = item.glyphs.length > 1 ? 66 : 100;
  const W = (item.glyphs.length - 1) * ADV + 100;
  const board = svg('svg', { viewBox: `0 0 ${W} 120`, class: 'tr-board', role: 'img', 'aria-label': `Write ${ch.replace(/^w:/, '')}` });
  for (const [k, y] of Object.entries(GUIDES)) board.append(svg('line', { x1: 2, x2: W - 2, y1: y, y2: y, class: `tr-guide tr-guide-${k}` }));
  const strokes = item.glyphs.flatMap((g, gi) =>
    STROKES[g].map((d) => {
      const dx = gi * ADV;
      const ghost = svg('path', { d, class: 'tr-ghost', transform: `translate(${dx} 0)` });
      const ink = svg('path', { d, class: 'tr-ink', stroke: color, transform: `translate(${dx} 0)` });
      board.append(ghost);
      return { d, dx, ghost, ink };
    }),
  );
  strokes.forEach((s) => board.append(s.ink));
  // a wide board (a word) is drawn smaller: keep the dots as big on screen
  const k = Math.max(1, W / 150);
  const startDot = svg('circle', { r: 6 * k, class: 'tr-start' });
  const startNum = svg('text', { class: 'tr-start-n', 'text-anchor': 'middle', 'dominant-baseline': 'central', style: `font-size:${7 * k}px` });
  const guideBall = svg('circle', { r: 4.5 * k, class: 'tr-ball' });
  const finger = svg('circle', { r: 5 * k, class: 'tr-finger' });
  board.append(guideBall, startDot, startNum, finger); // the start dot stays on top of the ball

  // sample each stroke into points (the browser measures the path for us)
  const sampled = strokes.map((s) => {
    const len = s.ink.getTotalLength?.() ?? 0;
    const n = Math.max(2, Math.ceil(len / 2));
    const pts: Pt[] = [];
    for (let k = 0; k <= n; k++) {
      const p = s.ink.getPointAtLength((len * k) / n);
      pts.push({ x: p.x + s.dx, y: p.y });
    }
    s.ink.style.visibility = 'hidden';
    return { len, pts, dot: len < 3 };
  });

  let cur = 0;
  let at = 0;
  let finished = false;
  let drawing = false;
  /** This finger stroke filled some of the line. */
  let moved = false;
  // Bix says where to go when a try fills nothing, or after a while with no try (never "wrong")
  let lastHint = 0;
  const hint = () => {
    if (finished || drawing || Date.now() - lastHint < 5000) return;
    lastHint = Date.now();
    startDot.classList.remove('is-hint');
    void startDot.getBoundingClientRect();
    startDot.classList.add('is-hint');
    void say(at > 0 ? 'Keep going from the green dot!' : 'Start at the green dot!');
  };
  const idle = (() => {
    let timer = 0;
    let times = 0;
    const reset = () => {
      clearTimeout(timer);
      if (times < 3) timer = window.setTimeout(() => (times++, hint(), reset()), 12000);
    };
    return { reset, stop: () => clearTimeout(timer) };
  })();
  /** The finger that is writing (a resting palm or a second finger is ignored). */
  let pointer: number | null = null;
  /** The finger is on the stroke: it got there at the point reached so far, and has not wandered off. */
  let onTrack = false;
  let demo = 0;

  const paint = () => {
    sampled.forEach((s, k) => {
      const shown = k < cur ? s.len + 1 : k === cur ? (s.len * at) / Math.max(1, s.pts.length - 1) : 0;
      strokes[k].ink.style.strokeDasharray = s.dot ? '1 0' : `${shown} ${s.len + 1}`;
      strokes[k].ink.classList.toggle('is-dot', s.dot);
      // a dash of length 0 still draws a round cap: hide strokes not started yet
      strokes[k].ink.style.visibility = (s.dot ? k < cur : shown > 0.5) ? 'visible' : 'hidden';
    });
    const s = sampled[cur];
    if (!s || finished) {
      [startDot, startNum, guideBall].forEach((e) => e.setAttribute('visibility', 'hidden'));
      return;
    }
    // the green dot: where to start, or after lifting the finger, where to carry on
    const p0 = s.pts[at];
    startDot.setAttribute('cx', String(p0.x));
    startDot.setAttribute('cy', String(p0.y));
    startNum.setAttribute('x', String(p0.x));
    startNum.setAttribute('y', String(p0.y));
    startNum.textContent = at > 0 ? '' : String(cur + 1);
    startDot.setAttribute('visibility', drawing ? 'hidden' : 'visible');
    startNum.setAttribute('visibility', drawing || at > 0 ? 'hidden' : 'visible');
  };

  /** The little ball runs along the stroke to show the way (again after a pause). */
  const showWay = () => {
    const my = ++demo;
    const s = sampled[cur];
    if (!s || finished) return;
    // from where the ink stopped to the end of the stroke in about 1.2 s, then it disappears
    // (it never rests on the end, where a child would start)
    const from = at;
    const t0 = performance.now();
    const ms = Math.max(700, Math.min(1400, (s.pts.length - from) * 18));
    guideBall.setAttribute('visibility', 'visible');
    const stepBall = (now: number) => {
      if (my !== demo || !ctx.alive() || drawing || finished) return guideBall.setAttribute('visibility', 'hidden');
      const f = Math.min(1, (now - t0) / ms);
      const p = s.pts[Math.round(from + (s.pts.length - 1 - from) * f)];
      guideBall.setAttribute('cx', String(p.x));
      guideBall.setAttribute('cy', String(p.y));
      if (f < 1) requestAnimationFrame(stepBall);
      else {
        guideBall.setAttribute('visibility', 'hidden');
        setTimeout(() => my === demo && showWay(), 1300);
      }
    };
    requestAnimationFrame(stepBall);
  };

  const toBoard = (e: PointerEvent): Pt | null => {
    const m = board.getScreenCTM();
    if (!m) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: pt.x, y: pt.y };
  };

  const strokeFinished = async () => {
    sfx.pop();
    cur++;
    at = 0;
    onTrack = false;
    if (cur < sampled.length) {
      paint();
      showWay();
      return;
    }
    finished = true;
    paint();
    board.classList.add('is-done');
    update((st) => {
      st.traced = { ...(st.traced ?? {}), [ch]: (st.traced?.[ch] ?? 0) + 1 };
      const d = dayLog();
      d.letters = (d.letters ?? 0) + 1;
    });
    sfx.success();
    confetti(document.body, 24);
    bix.setMood('happy');
    side.classList.add('is-done');
    nextBtn.classList.add('pop', 'is-ready');
    await say(item.praise());
  };

  const move = (e: PointerEvent) => {
    // all the points of a quick stroke, not only one per frame
    const all = e.getCoalescedEvents?.() ?? [];
    for (const ev of all.length ? all : [e]) {
      moveTo(ev);
      if (finished || (sampled[cur]?.dot ?? true)) break;
    }
  };
  /** How close the finger must be, in board units: at least ~35 px on screen (a small phone board too). */
  const tol = () => Math.max(13, 35 / (board.getScreenCTM()?.a || 1));
  const moveTo = (e: PointerEvent) => {
    const p = toBoard(e);
    if (!p || finished) return;
    const T = tol();
    finger.setAttribute('cx', String(p.x));
    finger.setAttribute('cy', String(p.y));
    const s = sampled[cur];
    if (s.dot) {
      if (Math.hypot(s.pts[0].x - p.x, s.pts[0].y - p.y) < T + 1) void strokeFinished();
      return;
    }
    // (re)start only at the point reached so far (the green dot at first); wandering off stops it
    const here = Math.hypot(s.pts[at].x - p.x, s.pts[at].y - p.y);
    if (!onTrack) {
      if (here > T) return;
      onTrack = true;
    }
    let next = advance(s.pts, at, p, T);
    // a quick finger can be further along: keep following while the line leads to it
    for (let k = advance(s.pts, next, p, T); k !== next; k = advance(s.pts, next, p, T)) next = k;
    if (next === at && here > T * 1.25) {
      onTrack = false;
      return;
    }
    if (next !== at) {
      at = next;
      moved = true;
      paint();
      if (strokeDone(s.pts, at)) void strokeFinished();
    }
  };
  board.addEventListener('pointerdown', (e) => {
    if (finished || (drawing && pointer !== e.pointerId)) return;
    pointer = e.pointerId;
    drawing = true;
    onTrack = false;
    moved = false;
    idle.reset();
    demo++;
    guideBall.setAttribute('visibility', 'hidden');
    board.setPointerCapture?.(e.pointerId);
    finger.setAttribute('visibility', 'visible');
    move(e);
  });
  board.addEventListener('pointermove', (e) => drawing && e.pointerId === pointer && move(e));
  const up = (e: PointerEvent) => {
    if (!drawing || e.pointerId !== pointer) return;
    drawing = false;
    pointer = null;
    finger.setAttribute('visibility', 'hidden');
    paint();
    // lifted halfway: keep what was done (the child carries on from the green dot), show the way again
    if (!finished) {
      if (!moved) hint(); // that try filled nothing: say where to go
      setTimeout(() => !drawing && showWay(), 600);
    }
  };
  board.addEventListener('pointerup', up);
  board.addEventListener('pointercancel', up);
  finger.setAttribute('visibility', 'hidden');

  const go = (c: string) => (sfx.tap(), ctx.go('abc', { trace: c }));
  const prev = h('button', { class: 'btn btn-round btn-sun tr-prev', 'aria-label': 'Previous', style: i === 0 ? 'visibility:hidden' : '', onclick: () => go(list[i - 1]) }, '◀');
  const nextBtn = h('button', { class: 'btn btn-good tr-next', 'aria-label': 'Next', onclick: () => go(list[(i + 1) % list.length]) }, '▶');
  // what to write: small letters, big letters, numbers, words
  const MODES: [TraceKind, string, string][] = [
    ['small', 'a', 'Small letters'],
    ['big', 'A', 'Big letters'],
    ['num', '123', 'Numbers'],
    ['word', 'cat', 'Words'],
  ];
  const modes = h(
    'div',
    { class: 'tr-modes' },
    MODES.map(([k, label, aria]) => h('button', { class: `btn btn-sun tr-mode ${k === kind ? 'is-on' : ''}`, 'data-mode': k, 'aria-label': aria, 'aria-pressed': String(k === kind), onclick: () => k !== kind && go(nextToTrace(k)) }, label)),
  );
  const again = h('button', { class: 'btn btn-round btn-sun tr-again', 'aria-label': 'Write again', onclick: () => go(ch) }, '🔁');
  const hear = h('button', { class: 'btn btn-round btn-sun btn-ear', 'aria-label': 'Listen', onclick: () => (sfx.tap(), void say(item.listen)) }, h('span', { class: 'icon-speaker' }));
  const side = h('div', { class: 'tr-side' }, item.pic, item.word, h('div', { class: 'tr-btns' }, hear, again));
  const done = getState().traced ?? {};
  const back = h('button', { class: 'btn btn-round btn-sun', 'aria-label': 'ABC', onclick: () => (sfx.tap(), ctx.go('abc')) }, '🔤');
  const el = h(
    'main',
    { class: `abc trace trace-${kind}` },
    h('header', { class: 'book-top' }, homeButton(ctx), back, h('h1', { class: 'world-title' }, 'Write'), modes, h('div', { class: 'game-bix' }, bix.el)),
    h('div', { class: 'tr-body' }, prev, h('div', { class: `tr-paper ${done[ch] ? 'was-done' : ''}`, style: `--w:${W}` }, board), side, nextBtn),
  );
  paint();
  setTimeout(() => {
    if (!ctx.alive()) return;
    showWay();
    void say(item.intro);
  }, 300);
  ctx.onCleanup(() => (demo++, idle.stop()));
  idle.reset();
  return el;
}
