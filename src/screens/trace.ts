import { Bix } from '../art/bix';
import { h } from '../lib/dom';
import { wordEmoji } from '../lib/emoji';
import { letterName } from '../lib/letters';
import { sfx } from '../lib/sfx';
import { getState, update } from '../lib/storage';
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

/** The next letter to write: the first one in this case not written yet. */
export function nextToTrace(upper = false): string {
  const done = getState().traced ?? {};
  const pool = ORDER.map((c) => (upper ? c.toUpperCase() : c));
  return pool.find((c) => !done[c]) ?? pool[0];
}

export function traceScreen(ctx: Ctx): HTMLElement {
  const ch = STROKES[ctx.params.trace] ? ctx.params.trace : nextToTrace();
  const upper = ch !== ch.toLowerCase();
  const lower = ch.toLowerCase();
  const info = LETTERS.find((l) => l.letter.toLowerCase() === lower)!;
  const i = ORDER.indexOf(lower);
  const color = COLORS[i % COLORS.length];
  const bix = new Bix({ size: 'sm', bubble: false }).setMood('hello');

  // the writing board: guide lines, the letter in grey, then each stroke filling in colour
  const board = svg('svg', { viewBox: '0 0 100 120', class: 'tr-board', role: 'img', 'aria-label': `Write ${ch}` });
  for (const [k, y] of Object.entries(GUIDES)) board.append(svg('line', { x1: 2, x2: 98, y1: y, y2: y, class: `tr-guide tr-guide-${k}` }));
  const strokes = STROKES[ch].map((d) => {
    const ghost = svg('path', { d, class: 'tr-ghost' });
    const ink = svg('path', { d, class: 'tr-ink', stroke: color });
    board.append(ghost);
    return { d, ghost, ink };
  });
  strokes.forEach((s) => board.append(s.ink));
  const startDot = svg('circle', { r: 6, class: 'tr-start' });
  const startNum = svg('text', { class: 'tr-start-n', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
  const guideBall = svg('circle', { r: 4.5, class: 'tr-ball' });
  const finger = svg('circle', { r: 5, class: 'tr-finger' });
  board.append(startDot, startNum, guideBall, finger);

  // sample each stroke into points (the browser measures the path for us)
  const sampled = strokes.map((s) => {
    const len = s.ink.getTotalLength?.() ?? 0;
    const n = Math.max(2, Math.ceil(len / 2));
    const pts: Pt[] = [];
    for (let k = 0; k <= n; k++) {
      const p = s.ink.getPointAtLength((len * k) / n);
      pts.push({ x: p.x, y: p.y });
    }
    s.ink.style.visibility = 'hidden';
    return { len, pts, dot: len < 3 };
  });

  let cur = 0;
  let at = 0;
  let finished = false;
  let drawing = false;
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
    const p0 = s.pts[0];
    startDot.setAttribute('cx', String(p0.x));
    startDot.setAttribute('cy', String(p0.y));
    startNum.setAttribute('x', String(p0.x));
    startNum.setAttribute('y', String(p0.y));
    startNum.textContent = String(cur + 1);
    [startDot, startNum].forEach((e) => e.setAttribute('visibility', at > 0 ? 'hidden' : 'visible'));
  };

  /** The little ball runs along the stroke to show the way (again after a pause). */
  const showWay = () => {
    const my = ++demo;
    const s = sampled[cur];
    if (!s || finished) return;
    let k = 0;
    guideBall.setAttribute('visibility', 'visible');
    const stepBall = () => {
      if (my !== demo || !ctx.alive() || drawing || finished) return guideBall.setAttribute('visibility', 'hidden');
      const p = s.pts[Math.min(k, s.pts.length - 1)];
      guideBall.setAttribute('cx', String(p.x));
      guideBall.setAttribute('cy', String(p.y));
      k += 1;
      if (k <= s.pts.length + 15) requestAnimationFrame(stepBall);
      else setTimeout(() => my === demo && showWay(), 900);
    };
    stepBall();
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
    update((st) => (st.traced = { ...(st.traced ?? {}), [ch]: (st.traced?.[ch] ?? 0) + 1 }));
    sfx.success();
    confetti(document.body, 24);
    bix.setMood('happy');
    side.classList.add('is-done');
    nextBtn.classList.add('pop', 'is-ready');
    await say(`${pick(PRAISE)} ${letterName(lower)}! ${letterName(lower)} is for ${info.word}!`);
  };

  const move = (e: PointerEvent) => {
    const p = toBoard(e);
    if (!p || finished) return;
    finger.setAttribute('cx', String(p.x));
    finger.setAttribute('cy', String(p.y));
    const s = sampled[cur];
    if (s.dot) {
      if (Math.hypot(s.pts[0].x - p.x, s.pts[0].y - p.y) < 14) void strokeFinished();
      return;
    }
    // (re)start only at the point reached so far (the green dot at first); wandering off stops it
    const here = Math.hypot(s.pts[at].x - p.x, s.pts[at].y - p.y);
    if (!onTrack) {
      if (here > 13) return;
      onTrack = true;
    }
    const next = advance(s.pts, at, p);
    if (next === at && here > 16) {
      onTrack = false;
      return;
    }
    if (next !== at) {
      at = next;
      paint();
      if (strokeDone(s.pts, at)) void strokeFinished();
    }
  };
  board.addEventListener('pointerdown', (e) => {
    if (finished) return;
    drawing = true;
    onTrack = false;
    demo++;
    guideBall.setAttribute('visibility', 'hidden');
    board.setPointerCapture?.(e.pointerId);
    finger.setAttribute('visibility', 'visible');
    move(e);
  });
  board.addEventListener('pointermove', (e) => drawing && move(e));
  const up = () => {
    if (!drawing) return;
    drawing = false;
    finger.setAttribute('visibility', 'hidden');
    // lifted halfway: keep what was done (the child carries on from there), show the way again
    if (!finished) setTimeout(() => !drawing && showWay(), 600);
  };
  board.addEventListener('pointerup', up);
  board.addEventListener('pointercancel', up);
  finger.setAttribute('visibility', 'hidden');

  const go = (c: string) => (sfx.tap(), ctx.go('abc', { trace: c }));
  const prev = h('button', { class: 'btn btn-round btn-sun tr-prev', 'aria-label': 'Previous letter', onclick: () => go(ORDER[(i + 25) % 26][upper ? 'toUpperCase' : 'toLowerCase']()) }, '◀');
  const nextBtn = h('button', { class: 'btn btn-good tr-next', 'aria-label': 'Next letter', onclick: () => go(ORDER[(i + 1) % 26][upper ? 'toUpperCase' : 'toLowerCase']()) }, '▶');
  const caseBtn = h('button', { class: 'btn btn-round btn-sun tr-case', 'aria-label': upper ? 'Small letters' : 'Big letters', onclick: () => go(upper ? lower : lower.toUpperCase()) }, upper ? lower : lower.toUpperCase());
  const again = h('button', { class: 'btn btn-round btn-sun tr-again', 'aria-label': 'Write again', onclick: () => go(ch) }, '🔁');
  const hear = h('button', { class: 'btn btn-round btn-sun btn-ear', 'aria-label': 'Listen', onclick: () => (sfx.tap(), void say(`${letterName(lower)} is for ${info.word}.`)) }, h('span', { class: 'icon-speaker' }));
  const side = h(
    'div',
    { class: 'tr-side' },
    h('div', { class: 'tr-pic', 'aria-hidden': 'true' }, wordEmoji(info.emoji) ?? ''),
    h('div', { class: 'tr-word', lang: 'en' }, h('b', { style: `color:${color}` }, info.word.slice(0, 1)), info.word.slice(1)),
    h('div', { class: 'tr-btns' }, hear, again),
  );
  const done = getState().traced ?? {};
  const back = h('button', { class: 'btn btn-round btn-sun', 'aria-label': 'ABC', onclick: () => (sfx.tap(), ctx.go('abc')) }, '🔤');
  const el = h(
    'main',
    { class: 'abc trace' },
    h('header', { class: 'book-top' }, homeButton(ctx), back, h('h1', { class: 'world-title' }, 'Write'), caseBtn, h('div', { class: 'game-bix' }, bix.el)),
    h('div', { class: 'tr-body' }, prev, h('div', { class: `tr-paper ${done[ch] ? 'was-done' : ''}` }, board), side, nextBtn),
  );
  paint();
  setTimeout(() => {
    if (!ctx.alive()) return;
    showWay();
    void say(`Let's write ${letterName(lower)}! Start at the green dot.`);
  }, 300);
  ctx.onCleanup(() => demo++);
  return el;
}
