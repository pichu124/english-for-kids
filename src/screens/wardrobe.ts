import { Bix } from '../art/bix';
import { ITEMS, SLOTS, thumbSVG, fitThumbs, unlockedItems, type Item, type Outfit } from '../art/outfit';
import { h } from '../lib/dom';
import { lessonsDone } from '../lib/progress';
import { sfx } from '../lib/sfx';
import { getState, update } from '../lib/storage';
import type { Ctx } from '../router';
import { confetti, homeButton } from './widgets';

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Bix's wardrobe: dress Bix with things earned by finishing lessons. */
export function wardrobeScreen(ctx: Ctx): HTMLElement {
  const done = lessonsDone();
  const open = unlockedItems(done);
  const outfit: Outfit = { ...(getState().outfit ?? {}) };
  const fresh = new Set(open.slice(getState().outfitSeen ?? 0).map((i) => i.id));
  update((s) => (s.outfitSeen = open.length));

  const bix = new Bix({ size: 'lg' }).setMood('hello');
  bix.wear(outfit);

  const buttons = new Map<string, HTMLElement>();
  const refresh = () => {
    for (const [id, b] of buttons) b.classList.toggle('is-on', Object.values(outfit).includes(id));
  };

  const pick = (it: Item) => {
    const wearing = outfit[it.slot] === it.id;
    if (wearing) delete outfit[it.slot];
    else outfit[it.slot] = it.id;
    update((s) => (s.outfit = { ...outfit } as Record<string, string>));
    bix.wear(outfit);
    refresh();
    sfx.pop();
    if (wearing) {
      void bix.talk('Off it goes!', 'idle');
      return;
    }
    bix.setMood('happy');
    const line = it.slot === 'color' ? `Bix is ${it.name}!` : `Look! ${cap(it.name)}!`;
    void bix.talk(line, 'happy');
  };

  const button = (it: Item) => {
    const got = done >= it.at;
    const b = h(
      'button',
      {
        class: `ward-item ${got ? '' : 'is-locked'} ${fresh.has(it.id) ? 'is-new' : ''}`,
        'aria-label': got ? it.name : 'Locked',
        'data-item': it.id,
      },
      h('span', { class: 'ward-icon', html: thumbSVG(it) }),
      got ? null : h('span', { class: 'ward-lock' }, `🔒 ${it.at - done}`),
    );
    b.addEventListener('click', () => {
      if (!got) {
        sfx.soft();
        void bix.talk('Finish more lessons to get this!', 'encourage', 'More lessons!');
        return;
      }
      b.classList.remove('is-new');
      pick(it);
    });
    buttons.set(it.id, b);
    return b;
  };

  const shelves = SLOTS.map((slot) => h('div', { class: 'ward-shelf' }, ITEMS.filter((i) => i.slot === slot).map(button)));
  refresh();

  requestAnimationFrame(() => fitThumbs(document));
  setTimeout(() => {
    if (!ctx.alive()) return;
    if (fresh.size) {
      confetti(document.body, 30);
      void bix.talk('New clothes for me! Tap to dress me up!', 'happy', 'New clothes!');
    } else if (open.length) void bix.talk('Dress me up!', 'idle');
    else void bix.talk('Finish a lesson and get clothes for me!', 'idle', 'Finish a lesson!');
  }, 400);

  return h(
    'main',
    { class: 'wardrobe' },
    h('header', { class: 'book-top' }, homeButton(ctx), h('h1', { class: 'world-title' }, "Bix's Clothes")),
    h('div', { class: 'ward-body' }, h('div', { class: 'ward-bix' }, bix.el), h('div', { class: 'ward-shelves' }, shelves)),
  );
}
