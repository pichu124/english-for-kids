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
 * Memory (find the pairs, every flip says the word), Balloons (pop the one Bix names)
 * Colour (Cambridge-style "listen and colour": colour the dog blue)
 * and Who Is Who? ("listen and draw lines": find Tom, he's got a blue T-shirt).
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
  if (game === 'colour') return colour(ctx);
  if (game === 'who') return whoIsWho(ctx);

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
    h('div', { class: 'games-body' }, h('div', { class: 'games-bix' }, bix.el), h('div', { class: 'games-list' }, card('memory', '🃏', 'Memory'), card('balloons', '🎈', 'Balloons'), card('colour', '🖍️', 'Colour'), card('who', '🧒', 'Who Is Who?'))),
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

/* ---------- Colour: "Colour the dog blue!" — pick the crayon, then tap the thing ---------- */
const PAINTS = [
  { name: 'red', c: '#ef476f' },
  { name: 'blue', c: '#4cc9f0' },
  { name: 'green', c: '#06d6a0' },
  { name: 'yellow', c: '#ffd166' },
  { name: 'purple', c: '#9b5de5' },
];

function colour(ctx: Ctx): HTMLElement {
  const level = currentLevel();
  const names = PAINTS.map((p) => p.name);
  // Things to colour: never a colour word or a colour block (that would give the answer away).
  const things = shuffle(practicePool(level.id, 10).filter((w) => !w.image.color && !names.includes(w.text.toLowerCase()))).slice(0, 4);
  const paints = shuffle(PAINTS).slice(0, things.length);
  const ROUNDS = things.length;
  const bix = new Bix({ size: 'sm', bubble: false }).setMood('idle');
  const stars = h('div', { class: 'play-stars balloon-stars', 'aria-hidden': 'true' }, Array.from({ length: ROUNDS }, () => h('span', {}, '★')));
  const again = h('button', { class: 'btn btn-round btn-sun btn-ear balloon-ear', 'aria-label': 'Listen again' }, h('span', { class: 'icon-speaker' }));
  let brush: (typeof PAINTS)[number] | null = null;
  let r = 0;
  let busy = false;

  const prompt = () => `Colour the ${things[r].text} ${paints[r].name}!`;
  const wiggle = (el: HTMLElement) => {
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  };

  const crayons = PAINTS.map((p) => {
    const b = h('button', { class: 'crayon', 'aria-label': p.name, 'data-colour': p.name, style: `--c:${p.c}` }, h('span', { class: 'crayon-tip', 'aria-hidden': 'true' }));
    b.addEventListener('click', () => {
      if (busy || !ctx.alive()) return;
      sfx.tap();
      brush = p;
      for (const c of crayons) c.classList.toggle('is-on', c === b);
      void say(p.name);
    });
    return b;
  });

  const tiles = things.map((w) => {
    const t = h('button', { class: 'paint-tile', 'aria-label': w.text }, h('span', { class: 'paint-pic' }, wordPicture(w)));
    t.addEventListener('click', async () => {
      if (busy || !ctx.alive() || r >= ROUNDS || t.classList.contains('is-painted')) return;
      if (!brush) {
        sfx.soft();
        for (const c of crayons) wiggle(c);
        void say(`Pick a colour! ${prompt()}`);
        return;
      }
      if (w !== things[r] || brush !== paints[r]) {
        sfx.soft();
        wiggle(t);
        void say(`Try again! ${prompt()}`);
        return;
      }
      busy = true;
      sfx.pop();
      t.style.setProperty('--paint', brush.c);
      t.classList.add('is-painted');
      stars.children[r]?.classList.add('on');
      bix.setMood('happy');
      await say(`${pick(PRAISE)} A ${brush.name} ${w.text}!`);
      if (!ctx.alive()) return;
      bix.setMood('idle');
      r++;
      brush = null;
      for (const c of crayons) c.classList.remove('is-on');
      busy = false;
      if (r >= ROUNDS) {
        again.hidden = true;
        finish(ctx, host, bix, 'colour');
      } else void say(prompt());
    });
    return t;
  });

  const host = h(
    'div',
    { class: 'game-body colour-body' },
    stars,
    again,
    h('div', { class: 'paint-grid' }, tiles),
    h('div', { class: 'crayon-box', role: 'group', 'aria-label': 'Colours' }, crayons),
  );
  again.onclick = () => (sfx.tap(), r < ROUNDS && void say(prompt()));
  setTimeout(() => ctx.alive() && ROUNDS && void say(prompt()), 400);
  return shell(ctx, 'colour', 'Colour', host, bix);
}

/* ---------- Who Is Who?: "Find Tom. He's got a blue T-shirt and he's reading a book." ---------- */
const BOYS = ['Tom', 'Sam', 'Ben', 'Nick', 'Dan'];
const GIRLS = ['Anna', 'Lucy', 'May', 'Grace', 'Kim'];
const DOING = [
  { emoji: '📖', says: 'reading a book' },
  { emoji: '⚽', says: 'playing football' },
  { emoji: '🎸', says: 'playing the guitar' },
  { emoji: '🍦', says: 'eating an ice cream' },
  { emoji: '🎈', says: 'holding a balloon' },
  { emoji: '🍎', says: 'eating an apple' },
  { emoji: '📷', says: 'taking a photo' },
];
const HAIR = ['#8d5a2b', '#f4c95d', '#1d2440', '#a0522d', '#5c4033'];

type Kid = { name: string; girl: boolean; shirt: (typeof PAINTS)[number]; hair: string; doing: (typeof DOING)[number] };

function kidSVG(k: Kid): string {
  const ink = 'stroke="#1d2440" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"';
  return `<svg class="kid-svg" viewBox="0 0 78 112" aria-hidden="true">
    ${k.girl ? `<path d="M20 30 Q18 6 35 6 Q52 6 50 30 L52 46 H18 Z" fill="${k.hair}" ${ink}/>` : ''}
    <path d="M22 84 V106 M48 84 V106" stroke="#1d2440" stroke-width="9" stroke-linecap="round"/>
    <path d="M22 84 V105 M48 84 V105" stroke="#577590" stroke-width="5" stroke-linecap="round"/>
    <path d="M16 86 Q14 50 35 48 Q56 50 54 86 Z" fill="${k.shirt.c}" ${ink}/>
    <path d="M18 56 L8 74 M52 56 L60 70" stroke="#1d2440" stroke-width="6" stroke-linecap="round"/>
    <path d="M18 56 L8 74 M52 56 L60 70" stroke="#f6c89f" stroke-width="3" stroke-linecap="round"/>
    <circle cx="35" cy="28" r="15" fill="#f6c89f" ${ink}/>
    <circle cx="30" cy="28" r="1.8" fill="#1d2440"/><circle cx="40" cy="28" r="1.8" fill="#1d2440"/>
    <path d="M30 34 Q35 38 40 34" stroke="#1d2440" stroke-width="2" fill="none" stroke-linecap="round"/>
    ${k.girl ? `<path d="M20 24 Q35 6 50 24 Q42 16 35 18 Q28 16 20 24 Z" fill="${k.hair}" ${ink}/>` : `<path d="M20 26 Q20 10 35 10 Q50 10 50 26 Q44 17 35 18 Q26 17 20 26 Z" fill="${k.hair}" ${ink}/>`}
    <text x="64" y="76" font-size="24" text-anchor="middle" dominant-baseline="middle">${k.doing.emoji}</text>
  </svg>`;
}

function whoIsWho(ctx: Ctx): HTMLElement {
  const level = currentLevel();
  const simple = level.id === 'L0' || level.id === 'L1';
  const shirts = shuffle(PAINTS);
  const doings = shuffle(DOING);
  const boys = shuffle(BOYS);
  const girls = shuffle(GIRLS);
  const kids: Kid[] = shuffle([true, true, false, false, Math.random() < 0.5]).map((girl, i) => ({
    name: girl ? girls.pop()! : boys.pop()!,
    girl,
    shirt: shirts[i],
    hair: HAIR[i % HAIR.length],
    doing: doings[i],
  }));
  // Like the Cambridge picture, one child is left over.
  const order = shuffle(kids).slice(0, 4);
  const ROUNDS = order.length;
  const bix = new Bix({ size: 'sm', bubble: false }).setMood('idle');
  const stars = h('div', { class: 'play-stars balloon-stars', 'aria-hidden': 'true' }, Array.from({ length: ROUNDS }, () => h('span', {}, '★')));
  const again = h('button', { class: 'btn btn-round btn-sun btn-ear balloon-ear', 'aria-label': 'Listen again' }, h('span', { class: 'icon-speaker' }));
  let r = 0;
  let busy = false;

  const describe = (k: Kid) => {
    const he = k.girl ? 'She' : 'He';
    return simple
      ? `Where is ${k.name}? ${he}'s got a ${k.shirt.name} T-shirt.`
      : `Find ${k.name}. ${he}'s got a ${k.shirt.name} T-shirt and ${he.toLowerCase()}'s ${k.doing.says}.`;
  };

  const buttons = kids.map((k) => {
    const tag = h('span', { class: 'kid-name' }, '');
    const b = h(
      'button',
      { class: 'kid', 'data-name': k.name, 'aria-label': `${k.shirt.name} T-shirt, ${k.doing.says}` },
      fromSVG(kidSVG(k)),
      tag,
    );
    b.addEventListener('click', async () => {
      if (busy || !ctx.alive() || r >= ROUNDS || b.classList.contains('is-named')) return;
      const want = order[r];
      if (k !== want) {
        sfx.soft();
        b.classList.remove('shake');
        void b.offsetWidth;
        b.classList.add('shake');
        void say(`Try again! ${describe(want)}`);
        return;
      }
      busy = true;
      sfx.pop();
      tag.textContent = k.name;
      b.classList.add('is-named');
      stars.children[r]?.classList.add('on');
      bix.setMood('happy');
      await say(`${pick(PRAISE)} This is ${k.name}!`);
      if (!ctx.alive()) return;
      bix.setMood('idle');
      r++;
      busy = false;
      if (r >= ROUNDS) {
        again.hidden = true;
        finish(ctx, host, bix, 'who');
      } else void say(describe(order[r]));
    });
    return b;
  });

  const host = h('div', { class: 'game-body who-body' }, stars, again, h('div', { class: 'kid-row' }, buttons));
  again.onclick = () => (sfx.tap(), r < ROUNDS && void say(describe(order[r])));
  setTimeout(() => ctx.alive() && void say(describe(order[0])), 400);
  return shell(ctx, 'whois', 'Who Is Who?', host, bix);
}

function fromSVG(markup: string): Element {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild!;
}
