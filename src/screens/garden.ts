import { Bix } from '../art/bix';
import { h } from '../lib/dom';
import { learningDays } from '../lib/progress';
import { sfx } from '../lib/sfx';
import { getState, today, update } from '../lib/storage';
import { say } from '../lib/tts';
import type { Ctx } from '../router';
import { homeButton } from './widgets';

/**
 * "My Garden": one plant for every day the child finished a lesson.
 * A gentle habit loop — days off cost nothing, nothing ever wilts.
 */
export const PLANTS = [
  { emoji: '🌷', name: 'a tulip' },
  { emoji: '🌻', name: 'a sunflower' },
  { emoji: '🌼', name: 'a daisy' },
  { emoji: '🌹', name: 'a rose' },
  { emoji: '🌸', name: 'a pink flower' },
  { emoji: '🍄', name: 'a mushroom' },
  { emoji: '🌳', name: 'a tree' },
  { emoji: '🌵', name: 'a cactus' },
  { emoji: '🍀', name: 'a clover' },
  { emoji: '🌴', name: 'a palm tree' },
];

/** The n-th learning day always grows the same plant (days only ever get added). */
export const plantFor = (n: number) => PLANTS[n % PLANTS.length];

export function gardenHasNew(): boolean {
  const s = getState();
  return (s.days[today()]?.lessons ?? 0) > 0 && s.gardenSeen !== today();
}

export function gardenScreen(ctx: Ctx): HTMLElement {
  const days = learningDays();
  const isNew = gardenHasNew();
  const grewToday = days.includes(today());
  update((s) => (s.gardenSeen = today()));
  const bix = new Bix({ size: 'sm' }).setMood('hello');

  const plots = days.map((d, i) => {
    const p = plantFor(i);
    const fresh = d === today() && isNew;
    const b = h(
      'button',
      { class: `plot ${fresh ? 'is-fresh' : ''}`, 'aria-label': p.name },
      h('span', { class: 'plot-soil', 'aria-hidden': 'true' }),
      h('span', { class: 'plot-plant', 'aria-hidden': 'true' }, p.emoji),
    );
    b.addEventListener('click', () => {
      sfx.pop();
      b.classList.remove('is-wiggle');
      void b.offsetWidth;
      b.classList.add('is-wiggle');
      void say(`${p.name[0].toUpperCase()}${p.name.slice(1)}!`);
    });
    return b;
  });
  if (!grewToday) {
    plots.push(
      h(
        'button',
        {
          class: 'plot is-empty',
          'aria-label': 'Plant a flower today',
          onclick: () => {
            sfx.soft();
            void bix.talk('Finish a lesson and a new plant will grow here!', 'encourage', 'Finish a lesson!');
          },
        },
        h('span', { class: 'plot-soil', 'aria-hidden': 'true' }),
        h('span', { class: 'plot-plant', 'aria-hidden': 'true' }, '🌱'),
      ),
    );
  }

  const n = days.length;
  const friends = [n >= 3 ? '🦋' : '', n >= 6 ? '🐝' : '', n >= 10 ? '🐞' : '', n >= 15 ? '🐦' : ''].filter(Boolean);

  setTimeout(() => {
    if (!ctx.alive()) return;
    if (isNew) void bix.talk('Look! A new plant! You learned today!', 'happy', 'A new plant!');
    else if (n) void bix.talk(`Your garden has ${n} ${n === 1 ? 'plant' : 'plants'}!`, 'happy');
    else void bix.talk('Finish a lesson to plant your first flower!', 'idle', 'Plant a flower!');
  }, 400);

  return h(
    'main',
    { class: 'garden' },
    h('header', { class: 'book-top' }, homeButton(ctx), h('h1', { class: 'world-title' }, 'My Garden'), h('div', { class: 'book-count' }, `🌱 ${n}`)),
    h('div', { class: 'garden-bix' }, bix.el),
    h('div', { class: 'garden-friends', 'aria-hidden': 'true' }, friends.map((f, i) => h('span', { class: 'garden-friend', style: `--i:${i}` }, f))),
    h('div', { class: 'garden-field' }, plots),
  );
}
