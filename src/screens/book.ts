import { topicsOfLevel } from '../content';
import { h } from '../lib/dom';
import { currentLevel } from '../lib/level';
import { isLearned, stickerCount } from '../lib/progress';
import { sfx } from '../lib/sfx';
import { getState, wordKey } from '../lib/storage';
import { say } from '../lib/tts';
import type { Ctx } from '../router';
import { actOut, wordPicture } from './lesson/shared';
import { homeButton } from './widgets';

/** "My Words": a sticker album — every word the child has learned, by unit. */
export function bookScreen(ctx: Ctx): HTMLElement {
  const level = currentLevel();
  const s = getState();
  const { got, total } = stickerCount(level.id);

  const pages = topicsOfLevel(level.id).map((t) =>
    h(
      'section',
      { class: 'book-page' },
      h('h2', { class: 'book-title' }, h('span', { 'aria-hidden': 'true' }, t.icon), ` ${t.title}`),
      h(
        'div',
        { class: 'book-grid' },
        t.words.map((w) => {
          const ok = isLearned(s.words[wordKey(t.id, w.id)]);
          const sticker = h(
            'button',
            { class: `sticker ${ok ? 'is-got' : 'is-locked'}`, 'aria-label': ok ? w.text : 'Not yet' },
            wordPicture(w),
            ok && level.showText ? h('span', { class: 'sticker-label' }, w.text) : null,
            ok ? null : h('span', { class: 'sticker-q', 'aria-hidden': 'true' }, '?'),
          );
          sticker.addEventListener('click', () => {
            if (!ok) {
              sfx.soft();
              void say('Not yet! Learn it and get this sticker!');
              return;
            }
            sfx.pop();
            actOut(sticker, w);
            void say(w.text);
          });
          return sticker;
        }),
      ),
    ),
  );

  setTimeout(() => {
    if (ctx.alive()) void say(got ? `You have ${got} stickers! Tap one!` : 'Learn words and collect stickers!');
  }, 400);

  return h(
    'main',
    { class: 'book' },
    h('header', { class: 'book-top' }, homeButton(ctx), h('h1', { class: 'world-title' }, 'My Words'), h('div', { class: 'book-count' }, `⭐ ${got} / ${total}`)),
    h('div', { class: 'book-pages' }, pages),
  );
}
