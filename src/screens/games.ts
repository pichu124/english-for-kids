import { Bix } from '../art/bix';
import type { Word } from '../content';
import { h, reducedMotion, shuffle, wait } from '../lib/dom';
import { currentLevel } from '../lib/level';
import { practicePool } from '../lib/progress';
import { choicesFor } from '../lib/adapt';
import { sfx } from '../lib/sfx';
import { say } from '../lib/tts';
import { limitReached } from '../lib/usage';
import type { Ctx } from '../router';
import { actOut, pick, PRAISE, wordPicture } from './lesson/shared';
import { confetti, homeButton } from './widgets';
import { todayRunning } from '../lib/today';
import { todayNextButton } from './today';

/**
 * Mini-games that replay words the child already learned:
 * Memory (find the pairs, every flip says the word) and Balloons (pop the one Bix names).
 * No time pressure, no "wrong" — they give practice, not blocks.
 */
export function gamesScreen(ctx: Ctx): HTMLElement {
  if (limitReached()) {
    queueMicrotask(() => ctx.go('rest'));
    return h('main');
  }
  const game = ctx.params.game;
  if (game === 'memory') return memory(ctx);
  if (game === 'balloons') return balloons(ctx);

  const bix = new Bix({ size: 'md' }).setMood('hello');
  const card = (id: string, icon: string, label: string) =>
    h(
      'button',
      { class: 'game-pick', 'aria-label': label, 'data-game': id, onclick: () => (sfx.tap(), ctx.go('games', { game: id })) },
      h('span', { class: 'game-pick-icon', 'aria-hidden': 'true' }, icon),
      h('span', {}, label),
    );
  setTimeout(() => ctx.alive() && void bix.talk('Pick a game!', 'happy'), 300);
  return h(
    'main',
    { class: 'games' },
    h('header', { class: 'book-top' }, homeButton(ctx), h('h1', { class: 'world-title' }, 'Games')),
    h('div', { class: 'games-body' }, h('div', { class: 'games-bix' }, bix.el), h('div', { class: 'games-list' }, card('memory', '🃏', 'Memory'), card('balloons', '🎈', 'Balloons'))),
  );
}

function shell(ctx: Ctx, cls: string, title: string, body: HTMLElement, bix: Bix): HTMLElement {
  const back = h('button', { class: 'btn btn-round btn-sun', 'aria-label': 'Games', onclick: () => (sfx.tap(), ctx.go('games')) }, '🎮');
  return h(
    'main',
    { class: `game ${cls}` },
    h('header', { class: 'book-top' }, homeButton(ctx), back, h('h1', { class: 'world-title' }, title), h('div', { class: 'game-bix' }, bix.el)),
    body,
  );
}

function finish(ctx: Ctx, host: HTMLElement, bix: Bix, game: string): void {
  sfx.reward();
  confetti(document.body, 40);
  bix.setMood('happy');
  void bix.talk('You did it! Play again?', 'happy', 'You did it!');
  const again = h('button', { class: 'btn btn-sun', 'aria-label': 'Play again', onclick: () => (sfx.tap(), ctx.go('games', { game })) }, '🔁 Again');
  const home = h('button', { class: 'btn btn-good', 'aria-label': 'Home', onclick: () => (sfx.tap(), ctx.go('home')) }, h('span', { class: 'icon-home', style: 'width:36px' }), 'Home');
  host.appendChild(h('div', { class: 'game-done pop' }, todayRunning() ? todayNextButton(ctx) : [again, home]));
}

/* ---------- Memory: flip two cards, find the pairs ---------- */
function memory(ctx: Ctx): HTMLElement {
  const level = currentLevel();
  const pairs = level.id === 'L0' ? 3 : level.id === 'L1' ? 4 : 6;
  const words = shuffle(practicePool(level.id, pairs)).slice(0, pairs);
  const bix = new Bix({ size: 'sm', bubble: false }).setMood('idle');
  const grid = h('div', { class: `mem-grid mem-${words.length * 2}` });
  const host = h('div', { class: 'game-body' }, grid);
  let open: HTMLElement[] = [];
  let found = 0;
  let busy = false;

  for (const w of shuffle([...words, ...words])) {
    const c = h(
      'button',
      { class: 'mem-card', 'aria-label': 'Card', 'data-id': w.id + '|' + w.text },
      h('span', { class: 'mem-back', 'aria-hidden': 'true' }, '?'),
      h('span', { class: 'mem-front' }, wordPicture(w)),
    );
    c.addEventListener('click', async () => {
      if (busy || c.classList.contains('is-up') || !ctx.alive()) return;
      sfx.tap();
      c.classList.add('is-up');
      c.setAttribute('aria-label', w.text);
      void say(w.text);
      open.push(c);
      if (open.length < 2) return;
      const [a, b] = open;
      open = [];
      if (a.dataset.id === b.dataset.id) {
        found++;
        await wait(350);
        sfx.success();
        a.classList.add('is-done');
        b.classList.add('is-done');
        actOut(a, w);
        actOut(b, w);
        bix.setMood('happy');
        await say(`${pick(PRAISE)} ${w.text}!`);
        bix.setMood('idle');
        if (found === words.length && ctx.alive()) finish(ctx, host, bix, 'memory');
      } else {
        busy = true;
        await wait(1100);
        a.classList.remove('is-up');
        b.classList.remove('is-up');
        a.setAttribute('aria-label', 'Card');
        b.setAttribute('aria-label', 'Card');
        busy = false;
      }
    });
    grid.appendChild(c);
  }
  setTimeout(() => ctx.alive() && void say('Find the pairs!'), 300);
  return shell(ctx, 'memory', 'Memory', host, bix);
}

/* ---------- Balloons: pop the balloon Bix names ---------- */
const BALLOON_COLORS = ['#ef476f', '#4cc9f0', '#ffd166', '#06d6a0', '#9b5de5', '#ff924c'];

function balloons(ctx: Ctx): HTMLElement {
  const level = currentLevel();
  const n = Math.max(3, choicesFor(level, 6));
  const pool = practicePool(level.id, 6);
  const ROUNDS = 5;
  const bix = new Bix({ size: 'sm', bubble: false }).setMood('idle');
  const sky = h('div', { class: `balloon-sky ${reducedMotion() ? 'is-still' : ''}` });
  const stars = h('div', { class: 'play-stars balloon-stars', 'aria-hidden': 'true' }, Array.from({ length: ROUNDS }, () => h('span', {}, '★')));
  const again = h('button', { class: 'btn btn-round btn-sun btn-ear balloon-ear', 'aria-label': 'Listen again' }, h('span', { class: 'icon-speaker' }));
  const host = h('div', { class: 'game-body' }, sky, stars, again);

  let order: Word[] = [];
  while (order.length < ROUNDS) order = order.concat(shuffle(pool));
  order = order.slice(0, ROUNDS);

  const round = (r: number) => {
    if (!ctx.alive()) return;
    if (r >= ROUNDS) {
      sky.replaceChildren();
      again.hidden = true;
      finish(ctx, host, bix, 'balloons');
      return;
    }
    const target = order[r];
    const others = shuffle(pool.filter((w) => w.text !== target.text)).slice(0, n - 1);
    const prompt = `Pop the ${target.text}!`;
    let done = false;
    const items = shuffle([target, ...others]).map((w, i, all) => {
      const b = h(
        'button',
        {
          class: 'balloon',
          'aria-label': w.text,
          style: `--c:${BALLOON_COLORS[(r + i) % BALLOON_COLORS.length]}; --x:${((i + 0.5) / all.length) * 100}%; --d:${9 + Math.random() * 3}s; --delay:${-Math.random() * 4 - 1}s`,
        },
        h('span', { class: 'balloon-pic' }, wordPicture(w)),
      );
      b.addEventListener('click', async () => {
        if (done || !ctx.alive()) return;
        if (w.text !== target.text) {
          sfx.soft();
          b.classList.remove('shake');
          void b.offsetWidth;
          b.classList.add('shake');
          void say(`Try again! ${prompt}`);
          return;
        }
        done = true;
        sfx.pop();
        b.classList.add('is-popped');
        stars.children[r]?.classList.add('on');
        bix.setMood('happy');
        await say(`${pick(PRAISE)} ${target.text}!`);
        bix.setMood('idle');
        round(r + 1);
      });
      return b;
    });
    sky.replaceChildren(...items);
    again.onclick = () => (sfx.tap(), void say(prompt));
    void say(prompt);
  };
  setTimeout(() => round(0), 400);
  return shell(ctx, 'balloons', 'Balloons', host, bix);
}
