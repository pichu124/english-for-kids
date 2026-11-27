import { Bix } from '../art/bix';
import { clockSVG } from '../art/clock';
import { LEVELS, writable, type Word } from '../content';
import { fromHTML, h, shuffle, wait } from '../lib/dom';
import { currentLevel } from '../lib/level';
import { spellOut } from '../lib/letters';
import { practicePool } from '../lib/progress';
import { sfx } from '../lib/sfx';
import { say } from '../lib/tts';
import type { Ctx } from '../router';
import { pick, PRAISE, wordPicture } from './lesson/shared';
import { confetti, homeButton } from './widgets';
import { todayRunning } from '../lib/today';
import { todayNextButton } from './today';

/**
 * More games (Games screen):
 *  - Bix's Tower: guess the word letter by letter (each right letter adds a block; a letter not in
 *    the word is just "not in this word" — nobody loses). Starters on.
 *  - What time is it?: hear a time, find the clock (o'clock; half past from Movers, quarters from Flyers).
 *  - Which one?: hear one of two words that sound alike (ship / sheep), touch its picture —
 *    the sounds Vietnamese children most often mix up (long/short vowels, last sounds, l/n, th).
 */

function shell(ctx: Ctx, cls: string, title: string, body: HTMLElement, bix: Bix): HTMLElement {
  const back = h('button', { class: 'btn btn-round btn-sun', 'aria-label': 'Games', onclick: () => (sfx.tap(), ctx.go('games')) }, '🎮');
  return h(
    'main',
    { class: `game ${cls}` },
    h('header', { class: 'book-top' }, homeButton(ctx), back, h('h1', { class: 'world-title' }, title), h('div', { class: 'game-bix' }, bix.el)),
    body,
  );
}

function finish(ctx: Ctx, host: HTMLElement, bix: Bix, game: string, line = 'You did it! Play again?'): void {
  host.classList.add('is-finished');
  sfx.reward();
  confetti(document.body, 40);
  bix.setMood('happy');
  void bix.talk(line, 'happy', 'You did it!');
  const again = h('button', { class: 'btn btn-sun', 'aria-label': 'Play again', onclick: () => (sfx.tap(), ctx.go('games', { game, n: String(Date.now()) })) }, '🔁 Again');
  const home = h('button', { class: 'btn btn-good', 'aria-label': 'Home', onclick: () => (sfx.tap(), ctx.go('home')) }, h('span', { class: 'icon-home', style: 'width:36px' }), 'Home');
  host.appendChild(h('div', { class: 'game-done pop' }, todayRunning() ? todayNextButton(ctx) : [again, home]));
}

/**
 * The next tap on one of `els`. A tap on a button that has only just appeared (under the finger
 * that tapped the button before it) is ignored, so one tap never counts twice.
 */
const firstSeen = new WeakMap<HTMLElement, number>();
const once = <T extends HTMLElement>(els: T[]) =>
  new Promise<T>((resolve) => {
    const now = Date.now();
    els.forEach((e) => firstSeen.has(e) || firstSeen.set(e, now));
    const off = () => els.forEach((e) => e.removeEventListener('click', on));
    const on = (e: Event) => {
      if (Date.now() - (firstSeen.get(e.currentTarget as HTMLElement) ?? 0) < 400) return;
      off();
      resolve(e.currentTarget as T);
    };
    els.forEach((e) => e.addEventListener('click', on));
  });

/* ---------- Bix's Tower: guess the word ---------- */
export const towerWords = (levelId: string): Word[] => {
  const maxLen = levelId === 'L2' ? 6 : 8;
  return practicePool(levelId, 12).filter((w) => writable(w) && w.text.length <= maxLen);
};

export function tower(ctx: Ctx): HTMLElement {
  const level = currentLevel();
  const ROUNDS = 4;
  const words = shuffle(towerWords(level.id)).slice(0, ROUNDS);
  const bix = new Bix({ size: 'sm', bubble: false }).setMood('idle');
  const stage = h('div', { class: 'tw-stage' });
  const blocks = h('div', { class: 'tw-tower', 'aria-hidden': 'true' });
  const host = h('div', { class: 'game-body tw-body' }, h('div', { class: 'tw-side' }, blocks), stage);
  const COLORS = ['#ef476f', '#ff924c', '#ffd166', '#06d6a0', '#4cc9f0', '#9b5de5'];
  let placed = 0;
  const addBlock = () => {
    const b = h('span', { class: 'tw-block pop', style: `--c:${COLORS[placed % COLORS.length]}` });
    blocks.prepend(b);
    placed++;
  };

  const round = async (r: number) => {
    if (!ctx.alive()) return;
    if (r >= words.length) return finish(ctx, host, bix, 'tower', `Look at your tower! ${placed} blocks! Play again?`);
    const w = words[r];
    const word = w.text.toLowerCase();
    const slots = [...word].map(() => h('span', { class: 'spell-slot tw-slot' }));
    const keys = 'abcdefghijklmnopqrstuvwxyz'.split('').map((c) => h('button', { class: 'wr-key tw-key', 'data-key': c, 'aria-label': c, lang: 'en' }, c));
    const hear = h('button', { class: 'btn btn-round btn-sun btn-ear', 'aria-label': 'Listen', onclick: () => (sfx.tap(), void say(w.text)) }, h('span', { class: 'icon-speaker' }));
    stage.replaceChildren(
      h(
        'div',
        { class: 'write tw-round', 'data-word': word },
        h('div', { class: 'spell-top' }, h('div', { class: 'read-pic spell-pic tw-pic' }, wordPicture(w)), hear),
        h('div', { class: `spell-slots ${word.length > 6 ? 'is-long' : ''}` }, slots),
        h('div', { class: 'wr-keys' }, keys),
      ),
    );
    void bix.talk(`What's the word? ${w.text}! Find the letters!`, 'idle'); // the keys work while Bix talks
    let misses = 0;
    for (;;) {
      if (!ctx.alive()) return;
      const left = keys.filter((k) => !k.classList.contains('is-used'));
      const k = await once(left);
      if (!ctx.alive()) return;
      const c = k.dataset.key!;
      k.classList.add('is-used');
      k.setAttribute('disabled', '');
      if (word.includes(c)) {
        sfx.pop();
        [...word].forEach((ch, i) => {
          if (ch === c) {
            slots[i].textContent = c;
            slots[i].classList.add('is-filled', 'pop');
            addBlock();
          }
        });
        k.classList.add('is-in');
        void say(c === 'a' ? 'ay' : c);
        if (slots.every((s) => s.textContent)) break;
      } else {
        sfx.soft();
        k.classList.add('is-out');
        misses++;
        void bix.talk(`Not in this word! Try another letter.`, 'encourage');
        // after a few, the next missing letter glows
        if (misses >= 3) {
          const next = [...word].find((_, i) => !slots[i].textContent);
          keys.find((x) => x.dataset.key === next)?.classList.add('is-hint');
        }
      }
    }
    sfx.success();
    bix.setMood('happy');
    await bix.talk(`${pick(PRAISE)} ${spellOut(word)}. ${w.text}!`, 'happy', `${w.text}!`);
    bix.setMood('idle');
    await wait(300);
    void round(r + 1);
  };
  setTimeout(() => void round(0), 300);
  return shell(ctx, 'tower', "Bix's Tower", host, bix);
}

/* ---------- What time is it? ---------- */
const NUM = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
/** 3:00 → "three o'clock", 3:30 → "half past three", 3:15 → "quarter past three", 3:45 → "quarter to four". */
export function timeWords(hh: number, mm: number): string {
  if (mm === 0) return `${NUM[hh]} o'clock`;
  if (mm === 30) return `half past ${NUM[hh]}`;
  if (mm === 15) return `quarter past ${NUM[hh]}`;
  return `quarter to ${NUM[hh === 12 ? 1 : hh + 1]}`;
}

export function clockGame(ctx: Ctx): HTMLElement {
  const lv = LEVELS.findIndex((l) => l.id === currentLevel().id);
  // Starters: o'clock; Movers: + half past; Flyers: + quarter past / to
  const minutes = lv >= 4 ? [0, 30, 15, 45] : lv >= 3 ? [0, 30] : [0];
  const ROUNDS = 6;
  const bix = new Bix({ size: 'sm', bubble: false }).setMood('idle');
  const stage = h('div', { class: 'ck-stage' });
  const host = h('div', { class: 'game-body ck-body' }, stage);
  const stars = h('div', { class: 'play-stars ck-stars', 'aria-hidden': 'true' }, Array.from({ length: ROUNDS }, () => h('span', {}, '★')));
  const used = new Set<string>();

  const round = async (r: number) => {
    if (!ctx.alive()) return;
    if (r >= ROUNDS) return finish(ctx, host, bix, 'clock', 'You can tell the time! Play again?');
    let hh = 1;
    let mm = 0;
    do {
      hh = 1 + Math.floor(Math.random() * 12);
      mm = minutes[Math.floor(Math.random() * minutes.length)];
    } while (used.has(`${hh}:${mm}`));
    used.add(`${hh}:${mm}`);
    // the other clocks: another hour, and (from Movers) the same hour at another time — look closely
    const others: [number, number][] = [];
    const sameHour = minutes.filter((m) => m !== mm).map((m) => [hh, m] as [number, number]);
    if (sameHour.length) others.push(shuffle(sameHour)[0]);
    while (others.length < 2) {
      const o: [number, number] = [1 + Math.floor(Math.random() * 12), mm];
      if (o[0] !== hh && !others.some((x) => x[0] === o[0] && x[1] === o[1])) others.push(o);
    }
    const pad = (m: number) => String(m).padStart(2, '0');
    const options = shuffle([[hh, mm] as [number, number], ...others]).map(([a, b]) =>
      h('button', { class: 'ck-clock pop', 'data-time': `${a}:${pad(b)}`, 'aria-label': timeWords(a, b) }, fromHTML(clockSVG(`${a}:${pad(b)}`))),
    );
    const hear = h('button', { class: 'btn btn-round btn-sun btn-ear', 'aria-label': 'Listen again' }, h('span', { class: 'icon-speaker' }));
    stage.replaceChildren(h('div', { class: 'ck-round', 'data-answer': `${hh}:${pad(mm)}` }, h('div', { class: 'ck-clocks' }, options), hear));
    const prompt = `It's ${timeWords(hh, mm)}. Find the clock!`;
    void bix.talk(prompt, 'idle', 'What time is it? 🕐');
    for (;;) {
      const t = await once([...options, hear]);
      if (!ctx.alive()) return;
      if (t === hear) {
        sfx.tap();
        void bix.talk(prompt, 'idle');
        continue;
      }
      if (t.dataset.time === `${hh}:${pad(mm)}`) {
        sfx.success();
        t.classList.add('is-right');
        options.forEach((o) => o !== t && o.classList.add('is-faded'));
        stars.children[r]?.classList.add('on');
        await bix.talk(`${pick(PRAISE)} It's ${timeWords(hh, mm)}!`, 'happy');
        break;
      }
      sfx.soft();
      t.classList.remove('shake');
      void t.offsetWidth;
      t.classList.add('shake');
      // say what that clock shows, so the child hears the difference
      const [a, b] = t.dataset.time!.split(':').map(Number);
      void bix.talk(`That's ${timeWords(a, b)}. Try again!`, 'encourage', 'Try again!'); // 🔊 says the time again
    }
    void round(r + 1);
  };
  setTimeout(() => void round(0), 300);
  const el = shell(ctx, 'clock', 'What time is it?', host, bix);
  el.querySelector('.book-top')?.appendChild(stars);
  return el;
}

/* ---------- Which one? Two words that sound alike ---------- */
type PairWord = { text: string; emoji?: string; num?: string };
/** Sounds Vietnamese children often mix up: long/short vowels, last sounds, b/p, k/g, l/n, th, s/z. */
export const SOUND_PAIRS: [PairWord, PairWord][] = [
  [{ text: 'ship', emoji: '🚢' }, { text: 'sheep', emoji: '🐑' }],
  [{ text: 'cat', emoji: '🐱' }, { text: 'cap', emoji: '🧢' }],
  [{ text: 'pen', emoji: '🖊️' }, { text: 'pan', emoji: '🍳' }],
  [{ text: 'cap', emoji: '🧢' }, { text: 'cup', emoji: '☕' }],
  [{ text: 'coat', emoji: '🧥' }, { text: 'goat', emoji: '🐐' }],
  [{ text: 'bear', emoji: '🐻' }, { text: 'pear', emoji: '🍐' }],
  [{ text: 'mouse', emoji: '🐭' }, { text: 'mouth', emoji: '👄' }],
  [{ text: 'ten', emoji: '🔟' }, { text: 'tent', emoji: '⛺' }],
  [{ text: 'ice', emoji: '🧊' }, { text: 'eyes', emoji: '👀' }],
  [{ text: 'light', emoji: '💡' }, { text: 'night', emoji: '🌙' }],
  [{ text: 'three', num: '3' }, { text: 'tree', emoji: '🌳' }],
  [{ text: 'sheep', emoji: '🐑' }, { text: 'jeep', emoji: '🚙' }],
  [{ text: 'bag', emoji: '👜' }, { text: 'bat', emoji: '🦇' }],
  [{ text: 'van', emoji: '🚐' }, { text: 'fan', emoji: '🪭' }],
];

export function pairsGame(ctx: Ctx): HTMLElement {
  const ROUNDS = 8;
  const order = shuffle(SOUND_PAIRS).slice(0, ROUNDS);
  const bix = new Bix({ size: 'sm', bubble: false }).setMood('idle');
  const stage = h('div', { class: 'wp-stage' });
  const host = h('div', { class: 'game-body wp-body' }, stage);
  const stars = h('div', { class: 'play-stars wp-stars', 'aria-hidden': 'true' }, order.map(() => h('span', {}, '★')));
  const pic = (w: PairWord) => (w.num ? h('span', { class: 'wp-num' }, w.num) : h('span', { class: 'wp-emoji' }, w.emoji!));

  const round = async (r: number) => {
    if (!ctx.alive()) return;
    if (r >= order.length) return finish(ctx, host, bix, 'pairs', 'Super listening! Play again?');
    const pair = order[r];
    const target = pair[Math.floor(Math.random() * 2)];
    const other = pair[0] === target ? pair[1] : pair[0];
    const cards = shuffle([...pair]).map((w) => h('button', { class: 'wp-card pop', 'data-word': w.text, 'aria-label': w.text }, pic(w)));
    const hear = h('button', { class: 'btn btn-round btn-sun btn-ear', 'aria-label': 'Listen again' }, h('span', { class: 'icon-speaker' }));
    stage.replaceChildren(h('div', { class: 'wp-round', 'data-answer': target.text }, h('div', { class: 'wp-cards' }, cards), hear));
    const prompt = `Listen… ${target.text}! Which one?`;
    void bix.talk(prompt, 'idle', 'Which one? 👂');
    for (;;) {
      const t = await once([...cards, hear]);
      if (!ctx.alive()) return;
      if (t === hear) {
        sfx.tap();
        void say(`${target.text}… ${target.text}!`);
        continue;
      }
      if (t.dataset.word === target.text) {
        sfx.success();
        t.classList.add('is-right');
        stars.children[r]?.classList.add('on');
        // both words, one after the other: the child hears the difference
        await bix.talk(`${pick(PRAISE)} ${target.text}! Not ${other.text}. ${target.text}… ${other.text}.`, 'happy', `${target.text}! ✓`);
        break;
      }
      sfx.soft();
      t.classList.remove('shake');
      void t.offsetWidth;
      t.classList.add('shake');
      void bix.talk(`That's ${other.text}. Listen… ${target.text}!`, 'encourage', 'Try again!');
    }
    void round(r + 1);
  };
  setTimeout(() => void round(0), 300);
  const el = shell(ctx, 'pairs', 'Which one?', host, bix);
  el.querySelector('.book-top')?.appendChild(stars);
  return el;
}
