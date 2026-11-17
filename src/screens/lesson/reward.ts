import { blockSVG } from '../../art/blocks';
import { fromHTML, h } from '../../lib/dom';
import { sfx } from '../../lib/sfx';
import { dayLog, today, update } from '../../lib/storage';
import { confetti } from '../widgets';
import type { LessonUI } from './shared';

/** Step 4 — Reward: one building block for "My World". */
export async function runReward(ui: LessonUI): Promise<void> {
  ui.setStep(3);
  const t = ui.topic;
  update((s) => {
    const tp = (s.topics[t.id] ??= { completed: 0 });
    tp.completed++;
    tp.lastDone = today();
    s.blocks.inventory[t.id] = (s.blocks.inventory[t.id] ?? 0) + 1;
    s.blocks.totalEarned++;
    dayLog().lessons++;
  });

  const block = h('div', { class: 'reward-block' }, fromHTML(blockSVG(t.block.style, t.block.color)));
  const chest = h('div', { class: 'reward-chest', 'aria-hidden': 'true' }, h('div', { class: 'chest-lid' }), h('div', { class: 'chest-box' }));
  const world = h('button', { class: 'btn btn-sun', 'aria-label': 'My World' }, '🧱 My World');
  const home = h('button', { class: 'btn btn-good', 'aria-label': 'Home' }, h('span', { class: 'icon-home', style: 'width:36px' }), 'Home');
  const actions = h('div', { class: 'reward-actions', hidden: true }, world, home);
  ui.stage.replaceChildren(h('div', { class: 'reward' }, h('div', { class: 'reward-stage' }, chest, block), h('div', { class: 'reward-name' }, t.block.name), actions));

  sfx.reward();
  confetti(document.body, 40);
  await ui.pause(150);
  chest.classList.add('is-open');
  block.classList.add('is-out');
  await ui.talk('You did it! Here is a block for you!', 'happy', 'You did it!');
  actions.hidden = false;
  actions.classList.add('pop');

  const tapped = await ui.tapAny([world, home]);
  sfx.tap();
  ui.ctx.go(tapped === world ? 'world' : 'home', tapped === world ? { fresh: t.id } : {});
}
