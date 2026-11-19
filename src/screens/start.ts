import { Bix } from '../art/bix';
import { h } from '../lib/dom';
import { sfx } from '../lib/sfx';
import { takePendingUnit } from '../lib/level';
import { limitReached, setCounting } from '../lib/usage';
import type { Ctx } from '../router';
import { getState, profileAnimal, profiles, switchProfile } from '../lib/storage';

/** First screen: one big Play button. The tap also unlocks audio + speech on Android. */
export function startScreen(ctx: Ctx): HTMLElement {
  const bix = new Bix({ size: 'lg', bubble: false }).setMood('hello');
  const start = () => {
    // Installed app / fullscreen: keep it sideways (ignored where not allowed).
    try {
      void (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape')?.catch(() => {});
    } catch {
      /* not supported */
    }
    sfx.unlock();
    sfx.tap();
    setCounting(true);
    if (limitReached()) return ctx.go('rest');
    const unit = takePendingUnit();
    ctx.go(unit ? 'lesson' : 'home', unit ? { topic: unit } : {});
  };
  const kids = profiles();
  // Several children on this device: each taps their own animal to start.
  const play =
    kids.length > 1
      ? h(
          'div',
          { class: 'who' },
          kids.map((k, i) =>
            h(
              'button',
              {
                class: 'who-btn',
                'aria-label': k.name || `Player ${i + 1}`,
                'data-profile': k.id,
                onclick: () => {
                  switchProfile(k.id);
                  bix.wear(getState().outfit ?? {});
                  start();
                },
              },
              h('span', { class: 'who-animal', 'aria-hidden': 'true' }, profileAnimal(k.id)),
              h('span', { class: 'who-name' }, k.name || `Player ${i + 1}`),
            ),
          ),
        )
      : h('button', { class: 'btn btn-play', 'aria-label': 'Play', onclick: start }, h('span', { class: 'play-icon', 'aria-hidden': 'true' }));
  return h(
    'main',
    {},
    h('div', { class: 'start-wrap' }, bix.el, h('div', { class: 'start-side' }, h('h1', { class: 'logo' }, 'Bix', h('span', {}, 'English')), play)),
  );
}
