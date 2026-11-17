import { Bix } from '../art/bix';
import { h } from '../lib/dom';
import { sfx } from '../lib/sfx';
import { say } from '../lib/tts';
import { limitReached, setCounting } from '../lib/usage';
import type { Ctx } from '../router';

/** First screen: one big Play button. The tap also unlocks audio + speech on Android. */
export function startScreen(ctx: Ctx): HTMLElement {
  const bix = new Bix({ size: 'lg', bubble: false }).setMood('hello');
  const play = h(
    'button',
    {
      class: 'btn btn-play',
      'aria-label': 'Play',
      onclick: () => {
        sfx.unlock();
        sfx.tap();
        void say(' '); // warm up speechSynthesis inside the user gesture
        setCounting(true);
        ctx.go(limitReached() ? 'rest' : 'home');
      },
    },
    h('span', { class: 'play-icon', 'aria-hidden': 'true' }),
  );
  return h(
    'main',
    {},
    h('div', { class: 'start-wrap' }, bix.el, h('div', { class: 'start-side' }, h('h1', { class: 'logo' }, 'Bix', h('span', {}, 'English')), play)),
  );
}
