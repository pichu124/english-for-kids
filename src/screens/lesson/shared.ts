import type { Bix } from '../../art/bix';
import { isoCube } from '../../art/cube';
import { sceneSVG } from '../../art/positions';
import { clockSVG } from '../../art/clock';
import { bodySVG, iconSVG } from '../../art/drawings';
import { animFor, type Level, type Topic, type Word } from '../../content';
import { fromHTML, h, wait } from '../../lib/dom';
import type { Ctx } from '../../router';
import { fixEmoji, wordEmoji } from '../../lib/emoji';

export class Aborted extends Error {}

export type LessonUI = {
  ctx: Ctx;
  topic: Topic;
  level: Level;
  bix: Bix;
  stage: HTMLElement;
  /** Small area under the stage for the parent fallback buttons. */
  parentBar: HTMLElement;
  setStep(i: number): void;
  /** Called after each tap-game round (review sessions update their schedule). */
  onPlayResult?: (w: Word, firstTry: boolean) => void;
  tick(): void;
  /** Throw Aborted if the child left the lesson. */
  guard(): void;
  /** Resolve when `el` is tapped (or reject with Aborted on leave). */
  tap<T extends HTMLElement>(el: T): Promise<T>;
  /** Resolve with whichever element is tapped first. */
  tapAny<T extends HTMLElement>(els: T[]): Promise<T>;
  pause(ms: number): Promise<void>;
  /** Bix says a line, guarded. */
  talk(text: string, after?: Parameters<Bix['talk']>[1], bubble?: string): Promise<void>;
};

export function makeUI(base: Omit<LessonUI, 'guard' | 'tap' | 'tapAny' | 'pause' | 'talk' | 'onPlayResult'> & Pick<Partial<LessonUI>, 'onPlayResult'>): LessonUI {
  const pending = new Set<(e: Error) => void>();
  base.ctx.onCleanup(() => pending.forEach((rej) => rej(new Aborted())));
  const guard = () => {
    if (!base.ctx.alive()) throw new Aborted();
  };
  const tapAny = <T extends HTMLElement>(els: T[]) =>
    new Promise<T>((resolve, reject) => {
      const handlers = els.map((el) => {
        const fn = () => {
          cleanup();
          resolve(el);
        };
        el.addEventListener('click', fn);
        return [el, fn] as const;
      });
      const cleanup = () => {
        handlers.forEach(([el, fn]) => el.removeEventListener('click', fn));
        pending.delete(onAbort);
      };
      const onAbort = (e: Error) => {
        cleanup();
        reject(e);
      };
      pending.add(onAbort);
    });
  return {
    ...base,
    guard,
    tapAny,
    tap: (el) => tapAny([el]),
    pause: async (ms) => {
      await wait(ms);
      guard();
    },
    talk: async (text, after, bubble) => {
      guard();
      await base.bix.talk(text, after, bubble);
      guard();
    },
  };
}

/** The picture for a word: a big emoji, or a voxel cube in the word's color. */
export function wordPicture(w: Word, cls = ''): HTMLElement {
  if (w.image.body) return h('div', { class: `pic pic-drawing ${cls}` }, fromHTML(bodySVG(w.image.body)));
  if (w.image.icon) return h('div', { class: `pic pic-drawing ${cls}` }, fromHTML(iconSVG(w.image.icon)));
  if (w.image.clock) {
    return h('div', { class: `pic pic-clock ${cls}` }, fromHTML(clockSVG(w.image.clock)));
  }
  if (w.image.scene) {
    return h('div', { class: `pic pic-scene ${cls}` }, fromHTML(sceneSVG(w.image.scene)));
  }
  if (w.image.text) {
    return h('div', { class: `pic pic-text ${cls}`, 'aria-hidden': 'true' }, h('span', {}, w.image.text));
  }
  if (w.image.color) {
    return h('div', { class: `pic pic-color ${cls}` }, fromHTML(isoCube(w.image.color)));
  }
  const raw = w.image.emoji ?? '❓';
  const emoji = graphemes(raw) > 1 ? fixEmoji(raw) : wordEmoji(raw);
  // This phone cannot draw the emoji and there is no older look-alike: show the word.
  if (emoji === null) return h('div', { class: `pic pic-text pic-word ${cls}`, 'aria-hidden': 'true' }, h('span', { lang: 'en' }, w.text));
  const n = graphemes(emoji);
  return h('div', { class: `pic pic-emoji ${n > 1 ? `pic-multi pic-n${Math.min(n, 10)}` : ''} ${cls}`, 'aria-hidden': 'true' }, emoji);
}

/** Number of visible characters (an emoji with skin tone or ZWJ counts as one). */
export function graphemes(s: string): number {
  try {
    const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<unknown> } }).Segmenter;
    if (Seg) return [...new Seg(undefined, { granularity: 'grapheme' }).segment(s)].length;
  } catch {
    /* fall through */
  }
  return [...s].length;
}

/** Play the word's meaning animation on its picture (no-op with reduced motion). */
export function actOut(card: HTMLElement, w: Word): void {
  const pic = card.querySelector<HTMLElement>('.pic');
  if (!pic) return;
  const cls = `act-${animFor(w)}`;
  pic.classList.remove(cls);
  void pic.offsetWidth;
  pic.classList.add(cls);
  pic.addEventListener('animationend', () => pic.classList.remove(cls), { once: true });
}

export function wordCard(w: Word, opts: { label?: boolean; cls?: string } = {}): HTMLButtonElement {
  return h(
    'button',
    { class: `word-card ${opts.cls ?? ''}`, 'aria-label': w.text },
    wordPicture(w),
    opts.label !== false ? h('span', { class: 'word-label' }, w.text) : null,
  );
}

export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const PRAISE = ['Great job!', 'Super!', 'Wow!', 'Awesome!', 'Well done!', 'Yes! You did it!', 'Fantastic!'];
