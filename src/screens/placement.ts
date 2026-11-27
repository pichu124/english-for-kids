import { Bix } from '../art/bix';
import { LEVELS, topicsOfLevel, type Word } from '../content';
import { h, shuffle, wait } from '../lib/dom';
import { testResults, passed, hasTest } from '../lib/mocktest';
import { levelDone } from '../lib/progress';
import { sfx } from '../lib/sfx';
import { getState, today, update } from '../lib/storage';
import { say } from '../lib/tts';
import type { Ctx } from '../router';
import { once } from './games2';
import { wordPicture } from './lesson/shared';
import { homeButton } from './widgets';
import { limitReached } from '../lib/usage';

/**
 * Placement quiz (parent area → "Bé nên học bậc nào?", about 3 minutes, played by the child):
 * 4 questions per level, from 4–5 years up. Every level: hear a word, touch its picture; from
 * Starters on, 2 of the 4 are reading (see a picture, touch its word). A level with 3 of 4 right
 * opens the next one; the first level that is not yet easy is the one to learn.
 * The child is never told right or wrong (just "Thank you!"); the result is for the parents.
 */
const TRY = ['L1', 'L2', 'L3', 'L4'];
const PER_LEVEL = 4;

/** Words that belong to this level (not seen in the levels before), one per picture. */
export function placementWords(levelId: string): Word[] {
  const idx = LEVELS.findIndex((l) => l.id === levelId);
  const before = new Set(LEVELS.slice(0, idx).flatMap((l) => topicsOfLevel(l.id).flatMap((t) => t.words.map((w) => w.text.toLowerCase()))));
  const seen = new Set<string>();
  const out: Word[] = [];
  for (const t of topicsOfLevel(levelId)) {
    for (const w of t.words) {
      const pic = JSON.stringify(w.image);
      if (before.has(w.text.toLowerCase()) || seen.has(w.text.toLowerCase()) || seen.has(pic) || w.image.text || w.image.clock) continue;
      seen.add(w.text.toLowerCase());
      seen.add(pic);
      out.push(w);
    }
  }
  return out;
}

/** The level to learn: the first one not yet easy (3 of 4); 4–5 years with 0–1 right → 3–4 years. */
export function suggestFrom(score: Record<string, [number, number]>): string {
  for (const l of TRY) {
    const sc = score[l];
    if (!sc) return l;
    if (sc[0] < 3) return l === 'L1' && sc[0] <= 1 ? 'L0' : l;
  }
  return 'L4';
}

/** Why this child may be ready for the next level (null if not, or already at Flyers). */
export function levelUpReason(levelId: string): { next: string; why: string } | null {
  const idx = LEVELS.findIndex((l) => l.id === levelId);
  const next = LEVELS[idx + 1];
  if (!next || !topicsOfLevel(next.id).length) return null;
  if (hasTest(levelId)) {
    const all = testResults(levelId);
    const last = all[all.length - 1];
    if (last && passed(last.score)) return { next: next.id, why: `đạt bài thi thử ${LEVELS[idx].name} ngày ${last.day.split('-').reverse().slice(0, 2).join('/')}` };
  }
  if (levelDone(levelId)) return { next: next.id, why: `đã học xong mọi bài của bậc ${LEVELS[idx].name}` };
  return null;
}

export function placementScreen(ctx: Ctx): HTMLElement {
  if (limitReached()) {
    queueMicrotask(() => ctx.go('rest'));
    return h('main');
  }
  const bix = new Bix({ size: 'sm', bubble: false }).setMood('hello');
  const stage = h('div', { class: 'pl-stage' });
  const dots = h('div', { class: 'play-stars pl-dots', 'aria-hidden': 'true' });
  const score: Record<string, [number, number]> = {};
  const THANKS = ['Thank you!', 'OK!', 'Good!', 'Thanks!'];

  const ask = async (level: string, words: Word[], i: number): Promise<boolean> => {
    const target = words[i];
    const others = shuffle(words.filter((w) => w !== target)).slice(0, 3);
    const reading = level !== 'L1' && i % 2 === 1;
    const hear = h('button', { class: 'btn btn-round btn-sun btn-ear', 'aria-label': 'Listen again' }, h('span', { class: 'icon-speaker' }));
    let opts: HTMLElement[];
    if (reading) {
      opts = shuffle([target, ...others]).map((w) => h('button', { class: 'pl-word pop', 'data-word': w.text, lang: 'en' }, w.text));
      stage.replaceChildren(h('div', { class: 'pl-round', 'data-level': level, 'data-kind': 'read', 'data-answer': target.text }, h('div', { class: 'pl-pic' }, wordPicture(target)), h('div', { class: 'pl-words' }, opts)));
      void bix.talk('Look! Touch the word.', 'idle', 'Read 📖');
    } else {
      opts = shuffle([target, ...others]).map((w) => h('button', { class: 'pl-card pop', 'data-word': w.text, 'aria-label': 'picture' }, wordPicture(w)));
      stage.replaceChildren(h('div', { class: 'pl-round', 'data-level': level, 'data-kind': 'listen', 'data-answer': target.text }, h('div', { class: 'pl-cards' }, opts), hear));
      void bix.talk(`Where is the ${target.text}?`, 'idle', 'Listen 👂');
    }
    for (;;) {
      const t = await once(reading ? opts : [...opts, hear]);
      if (!ctx.alive()) return false;
      if (t === hear) {
        sfx.tap();
        void say(target.text);
        continue;
      }
      sfx.tap();
      t.classList.add('is-picked');
      dots.appendChild(h('span', { class: 'on' }, '★'));
      void bix.talk(THANKS[i % THANKS.length], 'happy');
      await wait(700);
      return t.dataset.word === target.text;
    }
  };

  setTimeout(async () => {
    if (!ctx.alive()) return;
    await bix.talk("Let's play a little game! Do your best. It's OK if you don't know!", 'happy', 'Do your best! ⭐');
    for (const level of TRY) {
      const words = shuffle(placementWords(level));
      if (words.length < PER_LEVEL) break;
      const sc: [number, number] = [0, 0];
      for (let i = 0; i < PER_LEVEL; i++) {
        const right = await ask(level, words, i);
        if (!ctx.alive()) return;
        sc[1]++;
        if (right) sc[0]++;
      }
      score[level] = sc;
      if (sc[0] < 3) break;
    }
    const level = suggestFrom(score);
    update((s) => (s.placement = { day: today(), level, score }));
    sfx.reward();
    const parent = h('button', { class: 'btn btn-good pl-parent', lang: 'vi', onclick: () => (sfx.tap(), ctx.go('parent')) }, '🔒 Bố mẹ xem kết quả');
    const home = h('button', { class: 'btn btn-sun', 'aria-label': 'Home', onclick: () => (sfx.tap(), ctx.go('home')) }, h('span', { class: 'icon-home', style: 'width:36px' }), 'Home');
    stage.replaceChildren(h('div', { class: 'pl-round pl-done pop', 'data-level': level }, h('div', { class: 'test-medal', 'aria-hidden': 'true' }, '🌟'), h('div', { class: 'reward-actions' }, home, parent)));
    await bix.talk('All done! Thank you! Now ask Mum or Dad to look.', 'happy', '🌟 Thank you!');
  }, 300);

  return h(
    'main',
    { class: 'game placement' },
    h('header', { class: 'book-top' }, homeButton(ctx), h('h1', { class: 'world-title' }, 'Little Quiz'), dots, h('div', { class: 'game-bix' }, bix.el)),
    h('div', { class: 'game-body pl-body' }, stage),
  );
}

/** Parent-area lines about the placement result (Vietnamese). */
export function placementSummary(): { level: string; text: string } | null {
  const p = getState().placement;
  if (!p) return null;
  const parts = TRY.filter((l) => p.score[l]).map((l) => `${LEVELS.find((x) => x.id === l)?.name}: ${p.score[l][0]}/${p.score[l][1]}`);
  const name = LEVELS.find((l) => l.id === p.level)?.nameVi ?? p.level;
  return { level: p.level, text: `Bài xếp bậc ngày ${p.day.split('-').reverse().join('/')} gợi ý bậc ${name} (${parts.join(' · ')}).` };
}
