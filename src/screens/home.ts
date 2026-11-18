import { blockSVG } from '../art/blocks';
import { Bix } from '../art/bix';
import { islandSVG } from '../art/cube';
import { topicsOfLevel } from '../content';
import { currentLevel } from '../lib/level';
import { fromHTML, h } from '../lib/dom';
import { sfx } from '../lib/sfx';
import { getState } from '../lib/storage';
import { say } from '../lib/tts';
import { limitReached } from '../lib/usage';
import type { Ctx } from '../router';
import { parentButton } from './widgets';

let greetedThisSession = false;

export function homeScreen(ctx: Ctx): HTMLElement {
  if (limitReached()) {
    queueMicrotask(() => ctx.go('rest'));
    return h('main');
  }
  const s = getState();
  const level = currentLevel();
  const topics = topicsOfLevel(level.id);
  const name = s.childName.trim();
  const bix = new Bix({ size: 'md' }).setMood('hello');
  const hi = name ? `Hi, ${name}!` : 'Hi there!';
  bix.show(hi);

  // Suggest the first topic not yet done, else the least practiced one.
  const next =
    topics.find((t) => !s.topics[t.id]?.completed) ??
    [...topics].sort((a, b) => (s.topics[a.id]?.completed ?? 0) - (s.topics[b.id]?.completed ?? 0))[0];

  const islands = topics.map((t, i) => {
    const done = (s.topics[t.id]?.completed ?? 0) > 0;
    const btn = h(
      'button',
      {
        class: `island ${done ? 'is-done' : ''} ${t === next ? 'is-next' : ''}`,
        style: `--i:${i}`,
        'aria-label': t.title,
        onclick: () => {
          sfx.tap();
          ctx.go('lesson', { topic: t.id });
        },
      },
      fromHTML(islandSVG(t.color)),
      h('span', { class: 'island-icon', 'aria-hidden': 'true' }, t.icon),
      done ? h('span', { class: 'island-star', 'aria-label': 'done' }, '⭐') : null,
      h('span', { class: 'island-name' }, t.title),
    );
    return btn;
  });

  const totalBlocks = s.blocks.totalEarned;
  const world = h(
    'button',
    {
      class: 'btn btn-world',
      'aria-label': 'My World',
      onclick: () => {
        sfx.tap();
        ctx.go('world');
      },
    },
    h('span', { class: 'btn-world-blocks', html: blockSVG('grass', '#6cc04a') + blockSVG('brick', '#e2553f') }),
    h('span', {}, 'My World'),
    totalBlocks ? h('span', { class: 'badge' }, String(totalBlocks)) : null,
  );

  const el = h(
    'main',
    { class: 'home' },
    h('header', { class: 'home-top' }, h('div', { class: 'home-bix', onclick: () => void say(hi) }, bix.el), world, parentButton(ctx)),
    h('section', { class: `map map-n${Math.min(topics.length, 6)} ${topics.length >= 8 ? 'map-many' : ''}`, 'aria-label': 'Topics', style: `--n:${topics.length}` }, h('div', { class: 'map-path', 'aria-hidden': 'true' }), islands),
    h('div', { class: 'home-level', 'aria-label': 'Level' }, level.name),
  );

  requestAnimationFrame(() => el.querySelector('.island.is-next')?.scrollIntoView({ inline: 'center', block: 'nearest' }));
  setTimeout(async () => {
    if (!ctx.alive()) return;
    const line = greetedThisSession ? `${hi} Pick an island!` : `${hi} I am Bix. Let's play!`;
    greetedThisSession = true;
    await bix.talk(line, 'idle', hi);
  }, 350);

  return el;
}
