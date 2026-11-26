import alphabet from '../../content/alphabet.json';
import { Bix } from '../art/bix';
import { choicesFor, hintAfter, recordTap } from '../lib/adapt';
import { h, shuffle } from '../lib/dom';
import { letterName } from '../lib/letters';
import { wordEmoji } from '../lib/emoji';
import { currentLevel } from '../lib/level';
import { sfx } from '../lib/sfx';
import { getState, update } from '../lib/storage';
import { say } from '../lib/tts';
import { limitReached } from '../lib/usage';
import type { Ctx } from '../router';
import { pick, PRAISE } from './lesson/shared';
import { confetti, homeButton } from './widgets';

export type Letter = { letter: string; word: string; emoji: string; note?: string };
export const LETTERS: Letter[] = (alphabet as { letters: Letter[] }).letters;
/** The picture for a letter's word, or '' when this phone cannot draw it (the word is shown anyway). */
const pic = (l: Letter) => wordEmoji(l.emoji) ?? '';
const COLORS = ['#ef476f', '#ff924c', '#ffca3a', '#8ac926', '#4cc9f0', '#7b6cf6'];

/** "ay. ay is for apple." — letter names as sounds, see lib/letters. */
const line = (l: Letter) => `${letterName(l.letter)}. ${l.note ? `${l.word}. ${l.note.replace(/^X/, letterName('x'))}` : `${letterName(l.letter)} is for ${l.word}`}.`;

/** Alphabet: tap a letter to hear its name and a word; or play "find the letter". */
export function abcScreen(ctx: Ctx): HTMLElement {
  if (limitReached()) {
    queueMicrotask(() => ctx.go('rest'));
    return h('main');
  }
  return ctx.params.game ? letterGame(ctx) : alphabetBoard(ctx);
}

function alphabetBoard(ctx: Ctx): HTMLElement {
  const stars = getState().letters ?? {};
  const bix = new Bix({ size: 'sm' }).setMood('hello');
  const big = h('div', { class: 'abc-big', hidden: true });
  const show = (l: Letter, tile: HTMLElement) => {
    sfx.pop();
    tile.classList.remove('is-tapped');
    void tile.offsetWidth;
    tile.classList.add('is-tapped');
    big.hidden = false;
    big.replaceChildren(
      h('div', { class: 'abc-big-letter' }, `${l.letter} ${l.letter.toLowerCase()}`),
      h('div', { class: 'abc-big-pic', 'aria-hidden': 'true' }, pic(l)),
      h('div', { class: 'abc-big-word', lang: 'en' }, l.word),
    );
    big.classList.remove('pop');
    void big.offsetWidth;
    big.classList.add('pop');
    void bix.talk(line(l), 'happy', l.note ? `${l.letter}: ${l.word}` : `${l.letter} is for ${l.word}`);
  };
  const tiles = LETTERS.map((l, i) => {
    const t = h(
      'button',
      { class: 'abc-tile', 'aria-label': l.letter, 'data-letter': l.letter, style: `--c:${COLORS[i % COLORS.length]}` },
      h('span', { class: 'abc-up' }, l.letter),
      h('span', { class: 'abc-low' }, l.letter.toLowerCase()),
      stars[l.letter] ? h('span', { class: 'abc-star', 'aria-hidden': 'true' }, '⭐') : null,
    );
    t.addEventListener('click', () => show(l, t));
    return t;
  });
  big.addEventListener('click', () => {
    const l = LETTERS.find((x) => big.textContent?.startsWith(x.letter + ' '));
    if (l) void say(line(l));
  });
  const game = h('button', { class: 'btn btn-sun abc-game-btn', 'aria-label': 'Letter game', onclick: () => (sfx.tap(), ctx.go('abc', { game: '1' })) }, '🎯 Letter game');
  const sounds = h('button', { class: 'btn btn-good abc-sounds-btn', 'aria-label': 'Sounds', onclick: () => (sfx.tap(), ctx.go('phonics')) }, '🔊 Sounds');
  setTimeout(() => ctx.alive() && void bix.talk('A, B, C! Tap a letter!', 'happy'), 300);
  return h(
    'main',
    { class: 'abc' },
    h('header', { class: 'book-top' }, homeButton(ctx), h('h1', { class: 'world-title' }, 'ABC'), game, sounds, h('div', { class: 'abc-bix' }, bix.el)),
    h('div', { class: 'abc-body' }, h('div', { class: 'abc-grid' }, tiles), big),
  );
}

/** Bix names a letter; the child finds it. Letters not yet starred come first. */
function letterGame(ctx: Ctx): HTMLElement {
  const ROUNDS = 6;
  const level = currentLevel();
  const stars = getState().letters ?? {};
  const fresh = shuffle(LETTERS.filter((l) => !stars[l.letter]));
  const order = [...fresh, ...shuffle(LETTERS.filter((l) => stars[l.letter]))].slice(0, ROUNDS);
  const bix = new Bix({ size: 'md' }).setMood('hello');
  const stage = h('div', { class: 'abc-stage' });
  const starRow = h('div', { class: 'play-stars balloon-stars', 'aria-hidden': 'true' }, order.map(() => h('span', {}, '★')));
  const back = h('button', { class: 'btn btn-round btn-sun', 'aria-label': 'ABC', onclick: () => (sfx.tap(), ctx.go('abc')) }, '🔤');
  const el = h(
    'main',
    { class: 'abc abc-play' },
    h('header', { class: 'book-top' }, homeButton(ctx), back, h('h1', { class: 'world-title' }, 'Letter game'), starRow),
    h('div', { class: 'abc-play-body' }, h('div', { class: 'abc-play-bix' }, bix.el), stage),
  );

  const round = async (r: number) => {
    if (!ctx.alive()) return;
    if (r >= order.length) {
      sfx.reward();
      confetti(document.body, 40);
      const again = h('button', { class: 'btn btn-sun', 'aria-label': 'Play again', onclick: () => (sfx.tap(), ctx.go('abc', { game: String(Date.now()) })) }, '🔁 Again');
      const abc = h('button', { class: 'btn btn-good', 'aria-label': 'ABC', onclick: () => (sfx.tap(), ctx.go('abc')) }, '🔤 ABC');
      stage.replaceChildren(h('div', { class: 'game-done-inline pop' }, h('div', { class: 'review-star' }, '🌟'), h('div', { class: 'reward-actions' }, again, abc)));
      void bix.talk('You know your letters! Great job!', 'happy', 'Great job!');
      return;
    }
    const target = order[r];
    const n = choicesFor(level, 26);
    const others = shuffle(LETTERS.filter((l) => l.letter !== target.letter)).slice(0, n - 1);
    let misses = 0;
    let done = false;
    const prompt = `Find the letter ${letterName(target.letter)}!`;
    const tiles = shuffle([target, ...others]).map((l, i) => {
      const t = h(
        'button',
        { class: 'abc-tile abc-choice pop', 'aria-label': l.letter, 'data-letter': l.letter, style: `--c:${COLORS[(i + r) % COLORS.length]}` },
        h('span', { class: 'abc-up' }, l.letter),
        h('span', { class: 'abc-low' }, l.letter.toLowerCase()),
      );
      t.addEventListener('click', async () => {
        if (done || !ctx.alive()) return;
        if (l.letter !== target.letter) {
          sfx.soft();
          misses++;
          t.classList.remove('shake');
          void t.offsetWidth;
          t.classList.add('shake');
          if (misses >= hintAfter()) tiles.find((x) => x.dataset.letter === target.letter)?.classList.add('is-hint');
          void bix.talk(`Try again! ${prompt}`, 'encourage', 'Try again!');
          return;
        }
        done = true;
        sfx.success();
        t.classList.add('is-right');
        tiles.forEach((x) => x !== t && x.classList.add('is-faded'));
        starRow.children[r]?.classList.add('on');
        recordTap(misses === 0);
        if (misses === 0) update((s) => ((s.letters ??= {})[target.letter] = true));
        await bix.talk(`${pick(PRAISE)} ${line(target)}`, 'happy', `${target.letter} ${pic(target)}`.trim());
        void round(r + 1);
      });
      return t;
    });
    const hear = h('button', { class: 'btn btn-round btn-sun btn-ear', 'aria-label': 'Listen again', onclick: () => (sfx.tap(), void bix.talk(prompt, 'idle')) }, h('span', { class: 'icon-speaker' }));
    stage.replaceChildren(h('div', { class: 'abc-choices' }, tiles), hear);
    await bix.talk(prompt, 'idle', 'Find the letter! 🔎');
  };
  setTimeout(() => void round(0), 300);
  return el;
}
