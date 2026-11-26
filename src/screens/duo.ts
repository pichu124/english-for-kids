import { Bix } from '../art/bix';
import { playPromptFor, topicsOfLevel, type Level, type Word } from '../content';
import { h, shuffle, wait } from '../lib/dom';
import { currentLevel } from '../lib/level';
import { practicePool } from '../lib/progress';
import { sfx } from '../lib/sfx';
import { getState, profileAnimal, profiles } from '../lib/storage';
import { todayRunning } from '../lib/today';
import { say } from '../lib/tts';
import type { Ctx } from '../router';
import { actOut, pick, PRAISE, wordPicture } from './lesson/shared';
import { todayNextButton } from './today';
import { confetti, homeButton } from './widgets';

/**
 * "Play Together": two players on one device, the child (left) and Mum, Dad or a friend (right).
 * Bix is the host and says whose turn it is. Three modes, 6 rounds each:
 *  - Quick Tap: Bix names a picture, the first to press "I know!" picks; a miss passes the turn.
 *  - You Be Bix: one player sees a secret picture and gives clues out loud, the other finds it.
 *  - Say It!: Bix says a word, one player says it, the other judges with 👍 / "Again!".
 * Nobody loses: the end screen praises both players ("Great team!") and gives both a star.
 */

export const DUO_MODES = ['tap', 'describe', 'say'] as const;
export type DuoMode = (typeof DUO_MODES)[number];
const ROUNDS = 6;

type Player = {
  n: 1 | 2;
  name: string;
  icon: string;
  stars: number;
  side: HTMLElement;
  score: HTMLElement;
  /** Mode-specific controls on this player's side (buzzer, judge buttons…). */
  slot: HTMLElement;
};

/* ---------- Player 2: Mum, Dad or a friend (remembered on this device) ---------- */
const P2_KINDS = [
  { id: 'mum', name: 'Mum', icon: '👩' },
  { id: 'dad', name: 'Dad', icon: '👨' },
  { id: 'friend', name: 'Friend', icon: '🧑' },
] as const;
const P2_KEY = 'efk.duo.p2';
function p2Kind(): (typeof P2_KINDS)[number] {
  let id = '';
  try {
    id = localStorage.getItem(P2_KEY) ?? '';
  } catch {
    /* private mode: default */
  }
  return P2_KINDS.find((k) => k.id === id) ?? P2_KINDS[0];
}
function setP2Kind(id: string): void {
  try {
    localStorage.setItem(P2_KEY, id);
  } catch {
    /* keep the default */
  }
}

function makePlayers(): [Player, Player] {
  const child = getState().childName.trim();
  const active = profiles().find((p) => p.active);
  const k = p2Kind();
  const make = (n: 1 | 2, name: string, icon: string): Player => {
    const score = h('div', { class: 'duo-score', 'data-stars': '0', 'aria-label': '0 stars' }, h('span', { class: 'duo-star', 'aria-hidden': 'true' }, '★'), h('b', {}, '0'));
    const slot = h('div', { class: 'duo-slot' });
    const side = h(
      'section',
      { class: `duo-side duo-p${n}`, 'data-player': n, 'aria-label': name },
      h('div', { class: 'duo-who' }, h('span', { class: 'duo-avatar', 'aria-hidden': 'true' }, icon), h('span', { class: 'duo-name' }, name)),
      score,
      slot,
    );
    return { n, name, icon, stars: 0, side, score, slot };
  };
  return [make(1, child || 'Player 1', active ? profileAnimal(active.id) : '🧒'), make(2, k.name, k.icon)];
}

function addStar(p: Player): void {
  p.stars++;
  p.score.dataset.stars = String(p.stars);
  p.score.setAttribute('aria-label', `${p.stars} stars`);
  p.score.querySelector('b')!.textContent = String(p.stars);
  p.score.classList.remove('pop');
  void p.score.offsetWidth;
  p.score.classList.add('pop');
}

function setTurn(players: Player[], who: Player | null): void {
  for (const p of players) p.side.classList.toggle('is-turn', p === who);
}

/** "👈 🦊 Shin" / "Mum 👩 👉": who plays now, readable for pre-readers by the arrow and the animal. */
function turnBanner(p: Player | null, text?: string): HTMLElement {
  if (!p) return h('div', { class: 'duo-turn is-both' }, h('span', { 'aria-hidden': 'true' }, '🔔'), h('span', {}, text ?? 'Who knows?'));
  const label = h('span', { class: 'duo-turn-name' }, text ?? `${p.name}'s turn`);
  const icon = h('span', { class: 'duo-turn-icon', 'aria-hidden': 'true' }, p.icon);
  return p.n === 1
    ? h('div', { class: 'duo-turn is-p1', 'data-turn': '1' }, h('span', { class: 'duo-arrow', 'aria-hidden': 'true' }, '👈'), icon, label)
    : h('div', { class: 'duo-turn is-p2', 'data-turn': '2' }, label, icon, h('span', { class: 'duo-arrow', 'aria-hidden': 'true' }, '👉'));
}

const wiggle = (el: HTMLElement) => {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
};

/** 6 target words, no word twice in a row, with 3 other pictures for each round. */
function roundWords(level: Level, from?: Word[]): { pool: Word[]; order: Word[] } {
  const pool = from ?? practicePool(level.id, 8);
  let order: Word[] = [];
  while (order.length < ROUNDS && pool.length) {
    for (const w of shuffle(pool)) if (pool.length < 2 || order[order.length - 1]?.text !== w.text) order.push(w);
  }
  return { pool, order: order.slice(0, ROUNDS) };
}
/** The unit's own way of asking for a word ("Where is the cat?", "Which picture shows \"happy\"?") — never "Find the happy". */
const askFor = (level: Level, w: Word) => {
  const t = topicsOfLevel(level.id).find((x) => x.words.some((y) => y.text === w.text));
  return t ? playPromptFor(t, w) : `Find "${w.text}"!`;
};
const choicesFor = (pool: Word[], target: Word) => shuffle([target, ...shuffle(pool.filter((w) => w.text !== target.text)).slice(0, 3)]);

const picButton = (w: Word) => h('button', { class: 'duo-pic pop', 'data-word': w.text, 'aria-label': w.text }, wordPicture(w));

function duoShell(ctx: Ctx, cls: string, title: string, body: HTMLElement, bix: Bix, backTo: 'games' | 'duo'): HTMLElement {
  const back =
    backTo === 'games'
      ? h('button', { class: 'btn btn-round btn-sun', 'aria-label': 'Games', onclick: () => (sfx.tap(), ctx.go('games')) }, '🎮')
      : h('button', { class: 'btn btn-round btn-sun duo-back', 'aria-label': 'Play Together', onclick: () => (sfx.tap(), ctx.go('games', { game: 'duo' })) }, h('span', { class: 'duo-back-icon', 'aria-hidden': 'true' }, '🧒👩'));
  return h(
    'main',
    { class: `game duo ${cls}` },
    h('header', { class: 'book-top' }, homeButton(ctx), back, h('h1', { class: 'world-title' }, title), h('div', { class: 'game-bix' }, bix.el)),
    body,
  );
}

/** Bix talks: mouth moves while speaking, settles back to idle. */
function host(ctx: Ctx, bix: Bix) {
  return async (text: string, mood: 'idle' | 'happy' = 'idle') => {
    if (!ctx.alive()) return;
    bix.setMood('talk');
    await say(text);
    if (ctx.alive()) bix.setMood(mood);
  };
}

/** The happy end: both players praised, a team star for each, then Again / Home (or Today ▶ Next). */
function duoEnd(ctx: Ctx, body: HTMLElement, bix: Bix, players: [Player, Player], mode: DuoMode): void {
  if (!ctx.alive()) return;
  sfx.reward();
  confetti(document.body, 40);
  bix.setMood('happy');
  const [a, b] = players;
  const card = (p: Player) =>
    h(
      'div',
      { class: `duo-end-card duo-p${p.n}`, 'data-player': p.n },
      h('span', { class: 'duo-avatar', 'aria-hidden': 'true' }, p.icon),
      h('span', { class: 'duo-name' }, p.name),
      h('span', { class: 'duo-end-stars', 'aria-label': `${p.stars + 1} stars` }, h('span', { class: 'duo-star' }, '★'), h('b', {}, String(p.stars + 1))),
    );
  const again = h('button', { class: 'btn btn-sun', 'aria-label': 'Play again', onclick: () => (sfx.tap(), ctx.go('games', { game: 'duo', mode })) }, '🔁 Again');
  const home = h('button', { class: 'btn btn-good', 'aria-label': 'Home', onclick: () => (sfx.tap(), ctx.go('home')) }, h('span', { class: 'icon-home', style: 'width:36px' }), 'Home');
  body.replaceChildren(
    h(
      'div',
      { class: 'duo-end pop' },
      h('h2', { class: 'duo-end-title' }, 'Great team!'),
      h('div', { class: 'duo-end-players' }, card(a), h('span', { class: 'duo-end-mid', 'aria-hidden': 'true' }, '🤝'), card(b)),
      h('div', { class: 'game-done duo-done' }, todayRunning() ? todayNextButton(ctx) : [again, home]),
    ),
  );
  void bix.talk(`Great team! ${a.name} and ${b.name}, you both get a star! High five!`, 'happy', 'Great team!');
}

/* ---------- the Play Together menu ---------- */
export function duoScreen(ctx: Ctx): HTMLElement {
  const mode = ctx.params.mode as DuoMode | undefined;
  if (mode === 'tap') return quickTap(ctx);
  if (mode === 'describe') return youBeBix(ctx);
  if (mode === 'say') return sayIt(ctx);

  const bix = new Bix({ size: 'sm', bubble: false }).setMood('hello');
  const [p1] = makePlayers();
  const kind = p2Kind();
  const p2Buttons = P2_KINDS.map((k) => {
    const b = h(
      'button',
      { class: `duo-p2-pick ${k.id === kind.id ? 'is-on' : ''}`, 'data-p2': k.id, 'aria-label': k.name, 'aria-pressed': String(k.id === kind.id) },
      h('span', { class: 'duo-avatar', 'aria-hidden': 'true' }, k.icon),
      h('span', { class: 'duo-name' }, k.name),
    );
    b.addEventListener('click', () => {
      sfx.tap();
      setP2Kind(k.id);
      for (const o of p2Buttons) {
        o.classList.toggle('is-on', o === b);
        o.setAttribute('aria-pressed', String(o === b));
      }
      void say(`Hello, ${k.name}!`);
    });
    return b;
  });
  const modeCard = (id: DuoMode, icon: string, label: string, vi: string) =>
    h(
      'button',
      { class: 'game-pick duo-mode', 'data-mode': id, 'aria-label': label, onclick: () => (sfx.tap(), ctx.go('games', { game: 'duo', mode: id })) },
      h('span', { class: 'game-pick-icon', 'aria-hidden': 'true' }, icon),
      h('span', {}, label),
      h('span', { class: 'duo-mode-vi', lang: 'vi' }, vi),
    );
  const body = h(
    'div',
    { class: 'game-body duo-menu' },
    h(
      'div',
      { class: 'duo-team' },
      h('div', { class: 'duo-p1-card', 'data-player': '1' }, h('span', { class: 'duo-avatar', 'aria-hidden': 'true' }, p1.icon), h('span', { class: 'duo-name' }, p1.name)),
      h('span', { class: 'duo-plus', 'aria-hidden': 'true' }, '+'),
      h('div', { class: 'duo-p2-row', role: 'group', 'aria-label': 'Player 2' }, p2Buttons),
    ),
    h(
      'div',
      { class: 'duo-modes' },
      modeCard('tap', '🔔', 'Quick Tap', 'Ai nhanh tay bấm "I know!"'),
      modeCard('describe', '🤫', 'You Be Bix', 'Tả bằng tiếng Anh, người kia đoán'),
      modeCard('say', '👍', 'Say It!', 'Nói từ, người kia chấm'),
    ),
    h('p', { class: 'duo-vi', lang: 'vi' }, 'Hai người chơi chung một máy: bé bên trái, bố/mẹ bên phải. Không ai thua!'),
  );
  setTimeout(() => ctx.alive() && void bix.talk("Let's play together! Pick a game!", 'happy'), 300);
  return duoShell(ctx, 'duo-home', 'Play Together', body, bix, 'games');
}

/* ---------- Mode 1: Quick Tap — "Find the cat!", the first "I know!" picks ---------- */
function quickTap(ctx: Ctx): HTMLElement {
  const level = currentLevel();
  const { pool, order } = roundWords(level);
  const bix = new Bix({ size: 'sm', bubble: false }).setMood('idle');
  const talk = host(ctx, bix);
  const players = makePlayers();
  const [p1, p2] = players;
  const other = (p: Player) => (p === p1 ? p2 : p1);
  const banner = h('div', { class: 'duo-banner' });
  const ear = h('button', { class: 'btn btn-round btn-sun btn-ear duo-ear', 'aria-label': 'Listen again' }, h('span', { class: 'icon-speaker' }));
  const grid = h('div', { class: 'duo-grid' });
  const stage = h('div', { class: 'duo-stage' }, h('div', { class: 'duo-bar' }, banner, ear), grid);
  const body = h('div', { class: 'game-body duo-body duo-tap' }, p1.side, stage, p2.side);
  let r = 0;
  let picker: Player | null = null;
  let done = false;

  const buzzers = players.map((p) => {
    const b = h('button', { class: 'btn btn-accent duo-buzz', 'data-player': p.n, 'aria-label': 'I know!', disabled: true }, h('span', { class: 'duo-buzz-icon', 'aria-hidden': 'true' }, '🔔'), h('span', {}, 'I know!'));
    b.addEventListener('click', () => {
      if (done || picker || !ctx.alive() || r >= ROUNDS) return;
      sfx.pop();
      picker = p;
      b.classList.add('is-on');
      for (const o of buzzers) o.disabled = true;
      grid.classList.remove('is-locked');
      setTurn(players, p);
      banner.replaceChildren(turnBanner(p));
      void talk(`${p.name}! ${askFor(level, order[r])}`);
    });
    p.slot.appendChild(b);
    return b;
  });

  const round = () => {
    if (!ctx.alive()) return;
    if (r >= ROUNDS) return duoEnd(ctx, body, bix, players, 'tap');
    const target = order[r];
    stage.dataset.answer = target.text;
    picker = null;
    done = false;
    setTurn(players, null);
    banner.replaceChildren(turnBanner(null));
    for (const b of buzzers) {
      b.disabled = false;
      b.classList.remove('is-on');
    }
    grid.classList.add('is-locked');
    const items = choicesFor(pool, target).map((w) => {
      const b = picButton(w);
      b.addEventListener('click', async () => {
        if (done || !ctx.alive() || b.classList.contains('is-faded')) return;
        if (!picker) {
          // Pictures wait for a buzzer: the buzzers wiggle to show what to press.
          sfx.soft();
          buzzers.forEach(wiggle);
          void talk('Who knows? Press the bell!');
          return;
        }
        if (w.text !== target.text) {
          sfx.soft();
          wiggle(b);
          b.classList.add('is-faded');
          picker = other(picker);
          setTurn(players, picker);
          banner.replaceChildren(turnBanner(picker));
          void talk(`Try again! ${picker.name}'s turn! ${askFor(level, target)}`);
          return;
        }
        done = true;
        sfx.success();
        b.classList.add('is-right');
        actOut(b, w);
        addStar(picker);
        await talk(`${pick(PRAISE)} ${target.text}!`, 'happy');
        if (!ctx.alive()) return;
        await wait(300);
        r++;
        round();
      });
      return b;
    });
    grid.replaceChildren(...items);
    void talk(askFor(level, target));
  };
  ear.onclick = () => (sfx.tap(), r < ROUNDS && void talk(askFor(level, order[r])));
  setTimeout(round, 400);
  return duoShell(ctx, 'duo-game', 'Quick Tap', body, bix, 'duo');
}

/* ---------- Mode 2: You Be Bix — one sees a secret picture and gives clues, the other finds it ---------- */
function youBeBix(ctx: Ctx): HTMLElement {
  const level = currentLevel();
  const readsDef = level.id === 'L3' || level.id === 'L4';
  // Movers/Flyers: words with a definition, so the parent has a clue to read out.
  const defs = readsDef ? practicePool(level.id, 60).filter((w) => !!w.def) : [];
  const { pool, order } = roundWords(level, defs.length >= 4 ? defs : undefined);
  const bix = new Bix({ size: 'sm', bubble: false }).setMood('idle');
  const talk = host(ctx, bix);
  const players = makePlayers();
  const [p1, p2] = players;
  const stage = h('div', { class: 'duo-stage' });
  const body = h('div', { class: 'game-body duo-body duo-describe' }, p1.side, stage, p2.side);
  let r = 0;

  /** "Turn the tablet to Shin!" — the other player looks away while it is handed over. */
  const handOver = (to: Player, away: Player, sub: string, speech: string, next: () => void) => {
    if (!ctx.alive()) return;
    setTurn(players, to);
    delete stage.dataset.answer;
    const ready = h('button', { class: 'btn btn-good duo-ready', 'aria-label': "I'm ready!" }, "👍 I'm ready!");
    ready.addEventListener('click', () => {
      if (!ctx.alive()) return;
      sfx.tap();
      next();
    });
    stage.replaceChildren(
      h(
        'div',
        { class: `duo-hand pop duo-hand-to${to.n}`, 'data-to': to.n },
        h(
          'div',
          { class: 'duo-hand-big', 'aria-hidden': 'true' },
          to.n === 1 ? h('span', { class: 'duo-arrow' }, '👈') : null,
          h('span', { class: 'duo-hand-icon' }, '📱'),
          h('span', { class: 'duo-hand-avatar' }, to.icon),
          to.n === 2 ? h('span', { class: 'duo-arrow' }, '👉') : null,
        ),
        h('p', { class: 'duo-hand-title' }, `Pass it to ${to.name}!`),
        h('p', { class: 'duo-hand-sub' }, h('span', { 'aria-hidden': 'true' }, `🙈 ${away.icon} `), sub),
        ready,
      ),
    );
    void talk(speech);
  };

  const round = () => {
    if (!ctx.alive()) return;
    if (r >= ROUNDS) return duoEnd(ctx, body, bix, players, 'describe');
    const target = order[r];
    const describer = players[r % 2];
    const guesser = players[(r + 1) % 2];
    handOver(describer, guesser, `${guesser.name}, close your eyes!`, `${describer.name}, you be Bix! ${guesser.name}, close your eyes!`, () => secret(target, describer, guesser));
  };

  /** Only the describer looks: the picture (+ the word for readers and the parent, + a definition at Movers/Flyers). */
  const secret = (target: Word, describer: Player, guesser: Player) => {
    const showWord = level.showText || describer.n === 2;
    const got = h('button', { class: 'btn btn-sun duo-got', 'aria-label': 'Got it!' }, '🤫 Got it!');
    got.addEventListener('click', () => {
      if (!ctx.alive()) return;
      sfx.tap();
      handOver(guesser, describer, `${describer.name}, give clues!`, `${guesser.name}, listen to ${describer.name}! Find it!`, () => guess(target, describer, guesser));
    });
    const helper =
      describer.n === 2
        ? h('p', { class: 'duo-vi', lang: 'vi' }, 'Tả bằng tiếng Anh, đừng nói tên từ: "It\'s big. It can…"')
        : h('p', { class: 'duo-vi', lang: 'vi' }, target.image.color ? 'Bố mẹ gợi ý con nói: "It\'s a colour. It\'s like the sky / a banana…"' : 'Bố mẹ gợi ý con nói: "It\'s… It has… It can…"');
    stage.replaceChildren(
      h(
        'div',
        { class: 'duo-secret pop', 'data-word': target.text },
        h('div', { class: 'duo-secret-pic' }, wordPicture(target), showWord ? h('p', { class: 'duo-secret-word', lang: 'en' }, target.text) : null),
        h(
          'div',
          { class: 'duo-secret-info' },
          h('p', { class: 'duo-secret-say' }, h('span', { 'aria-hidden': 'true' }, '🤫 '), "Shh! Don't say it!"),
          readsDef && target.def ? h('p', { class: 'def-card duo-def', lang: 'en' }, target.def) : null,
          level.showText
            ? h('div', { class: 'duo-starters', lang: 'en' }, (target.image.color ? ["It's a colour.", "It's like…"] : ["It's…", 'It has…', 'It can…']).map((x) => h('span', {}, x)))
            : null,
          helper,
          got,
        ),
      ),
    );
    void talk(`Shh! ${describer.name}, look! Don't say it!`);
  };

  const guess = (target: Word, describer: Player, guesser: Player) => {
    stage.dataset.answer = target.text;
    setTurn(players, guesser);
    let done = false;
    const grid = h('div', { class: 'duo-grid' });
    const items = choicesFor(pool, target).map((w) => {
      const b = picButton(w);
      b.addEventListener('click', async () => {
        if (done || !ctx.alive() || b.classList.contains('is-faded')) return;
        if (w.text !== target.text) {
          sfx.soft();
          wiggle(b);
          b.classList.add('is-faded');
          void talk(`Try again! ${describer.name}, more clues, please!`);
          return;
        }
        done = true;
        sfx.success();
        b.classList.add('is-right');
        actOut(b, w);
        // A good clue and a good guess: a star for both.
        addStar(describer);
        addStar(guesser);
        await talk(`${pick(PRAISE)} ${target.text}! Great clues, ${describer.name}!`, 'happy');
        if (!ctx.alive()) return;
        await wait(300);
        r++;
        round();
      });
      return b;
    });
    grid.replaceChildren(...items);
    stage.replaceChildren(h('div', { class: 'duo-bar' }, h('div', { class: 'duo-banner' }, turnBanner(guesser, `${guesser.name}, find it!`))), grid);
  };

  setTimeout(round, 400);
  return duoShell(ctx, 'duo-game', 'You Be Bix', body, bix, 'duo');
}

/* ---------- Mode 3: Say It! — one says the word, the other judges 👍 / "Again!" ---------- */
function sayIt(ctx: Ctx): HTMLElement {
  const level = currentLevel();
  const { order } = roundWords(level);
  const bix = new Bix({ size: 'sm', bubble: false }).setMood('idle');
  const talk = host(ctx, bix);
  const players = makePlayers();
  const [p1, p2] = players;
  const banner = h('div', { class: 'duo-banner' });
  const ear = h('button', { class: 'btn btn-round btn-sun btn-ear duo-ear', 'aria-label': 'Listen again' }, h('span', { class: 'icon-speaker' }));
  const card = h('div', { class: 'duo-say-card' });
  const stage = h('div', { class: 'duo-stage' }, h('div', { class: 'duo-bar' }, banner, ear), card);
  const body = h('div', { class: 'game-body duo-body duo-say' }, p1.side, stage, p2.side);
  let r = 0;
  let agains = 0;
  let busy = true;

  const speaker = () => players[r % 2];
  const judge = () => players[(r + 1) % 2];

  const judgeBox = players.map((p) => {
    const yes = h('button', { class: 'btn btn-good duo-yes', 'data-player': p.n, 'aria-label': 'Yes!' }, h('span', { class: 'duo-judge-icon', 'aria-hidden': 'true' }, '👍'), h('span', {}, 'Yes!'));
    const again = h('button', { class: 'btn btn-sun duo-again', 'data-player': p.n, 'aria-label': 'Again!' }, h('span', { class: 'duo-judge-icon', 'aria-hidden': 'true' }, '🔁'), h('span', {}, 'Again!'));
    const sayTag = h('div', { class: 'duo-say-tag', 'aria-hidden': 'true' }, h('span', { class: 'duo-judge-icon' }, '🗣️'), h('span', {}, 'Say it!'));
    const judging = h('div', { class: 'duo-judge' }, yes, again);
    yes.addEventListener('click', async () => {
      if (busy || !ctx.alive() || judge() !== p) return;
      busy = true;
      const s = speaker();
      sfx.success();
      addStar(s);
      const pic = card.querySelector<HTMLElement>('.duo-say-pic');
      if (pic) actOut(pic, order[r]);
      await talk(`${pick(PRAISE)} ${s.name}!`, 'happy');
      if (!ctx.alive()) return;
      await wait(300);
      r++;
      round();
    });
    again.addEventListener('click', async () => {
      if (busy || !ctx.alive() || judge() !== p) return;
      busy = true;
      sfx.tap();
      agains++;
      const s = speaker();
      const w = order[r];
      if (agains >= 3) {
        // Enough tries for one word: move on kindly.
        await talk(`Nice try, ${s.name}! Next one!`);
        if (!ctx.alive()) return;
        r++;
        round();
        return;
      }
      wiggle(card);
      await talk(`Listen! ${w.text}. ${s.name}, again!`);
      busy = false;
    });
    p.slot.append(judging, sayTag);
    return { judging, sayTag };
  });

  const round = () => {
    if (!ctx.alive()) return;
    if (r >= ROUNDS) return duoEnd(ctx, body, bix, players, 'say');
    const w = order[r];
    const s = speaker();
    agains = 0;
    stage.dataset.answer = w.text;
    setTurn(players, s);
    banner.replaceChildren(turnBanner(s));
    players.forEach((p, i) => {
      judgeBox[i].judging.hidden = p === s;
      judgeBox[i].sayTag.hidden = p !== s;
    });
    // Pre-readers see only the picture; the word is shown when a reader (or the parent) says it.
    const showWord = level.showText || s.n === 2;
    card.replaceChildren(h('div', { class: 'duo-say-pic pop', 'data-word': w.text }, wordPicture(w), showWord ? h('p', { class: 'duo-secret-word', lang: 'en' }, w.text) : null));
    busy = true;
    const now = r;
    void talk(`${w.text}! ${s.name}, say: ${w.text}!`).then(() => {
      if (r === now) busy = false;
    });
  };
  ear.onclick = () => {
    if (r >= ROUNDS) return;
    sfx.tap();
    void say(order[r].text);
  };
  setTimeout(round, 400);
  return duoShell(ctx, 'duo-game', 'Say It!', body, bix, 'duo');
}
