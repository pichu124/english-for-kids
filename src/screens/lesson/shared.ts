import type { Bix } from '../../art/bix';
import { isoCube } from '../../art/cube';
import type { Topic, Word } from '../../content';
import { fromHTML, h, wait } from '../../lib/dom';
import type { Ctx } from '../../router';

export class Aborted extends Error {}

export type LessonUI = {
  ctx: Ctx;
  topic: Topic;
  bix: Bix;
  stage: HTMLElement;
  /** Small area under the stage for the parent fallback buttons. */
  parentBar: HTMLElement;
  setStep(i: 0 | 1 | 2 | 3): void;
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

export function makeUI(base: Omit<LessonUI, 'guard' | 'tap' | 'tapAny' | 'pause' | 'talk'>): LessonUI {
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
  if (w.image.color) {
    return h('div', { class: `pic pic-color ${cls}` }, fromHTML(isoCube(w.image.color)));
  }
  return h('div', { class: `pic pic-emoji ${cls}`, 'aria-hidden': 'true' }, w.image.emoji ?? '❓');
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
