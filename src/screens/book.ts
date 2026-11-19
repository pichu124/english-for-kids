import { levelsWithContent, topicsOfLevel } from '../content';
import { h } from '../lib/dom';
import { currentLevel } from '../lib/level';
import { isLearned, levelDone, levelProgress, stickerCount, unitBadge } from '../lib/progress';
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
      { class: 'book-page', 'data-unit': t.id },
      h(
        'h2',
        { class: 'book-title' },
        h('span', { 'aria-hidden': 'true' }, t.icon),
        t.title,
        (() => {
          const tier = unitBadge(t);
          const m = h('button', { class: `medal medal-${tier}`, 'aria-label': tier === 'none' ? 'No badge yet' : `${tier} badge`, 'data-tier': tier }, tier === 'none' ? '🔒' : t.icon);
          m.addEventListener('click', () => {
            sfx.pop();
            const line = { none: 'Finish this lesson to get a badge!', bronze: 'A bronze badge! Collect all the stickers for silver!', silver: 'A silver badge! Play it three times for gold!', gold: 'A gold badge! Wow!' }[tier];
            void say(line);
          });
          return m;
        })(),
      ),
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
    h(
      'div',
      { class: 'book-trophies' },
      levelsWithContent().map((l) => {
        const done = levelDone(l.id);
        const p = levelProgress(l.id);
        const b = h(
          'button',
          { class: `trophy ${done ? 'is-got' : 'is-locked'}`, 'aria-label': done ? `${l.name} certificate` : `${l.name}: ${p.done} of ${p.total}`, 'data-level': l.id },
          h('span', { class: 'trophy-icon', 'aria-hidden': 'true' }, '🏆'),
          `${l.name} ${done ? '' : `${p.done}/${p.total}`}`,
        );
        b.addEventListener('click', () => {
          if (done) return sfx.tap(), ctx.go('certificate', { level: l.id, from: 'book' });
          sfx.soft();
          void say(`Finish all the ${l.name} islands to get a certificate!`);
        });
        return b;
      }),
    ),
    h('div', { class: 'book-pages' }, pages),
  );
}
