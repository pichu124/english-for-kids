import { Bix } from '../art/bix';
import { h } from '../lib/dom';
import { say } from '../lib/tts';
import type { Ctx } from '../router';
import { parentButton } from './widgets';

/** Shown when today's time limit is used up. */
export function restScreen(ctx: Ctx): HTMLElement {
  const bix = new Bix({ size: 'lg' }).setMood('sleep');
  bix.show('Time to rest! See you tomorrow!');
  setTimeout(() => {
    if (ctx.alive()) void say('Time to rest! See you tomorrow!');
  }, 400);
  return h(
    'main',
    { class: 'rest' },
    parentButton(ctx),
    h('div', { class: 'rest-wrap' }, bix.el),
    h('p', { class: 'parent-note' }, 'Hết giờ học hôm nay. Bố mẹ có thể thêm giờ trong khu vực bố mẹ.'),
  );
}
