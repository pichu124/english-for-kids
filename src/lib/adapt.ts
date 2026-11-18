/**
 * Gentle adaptive difficulty for picture games, from the last few rounds:
 * often wrong → one picture fewer and an earlier hint; almost always right
 * first time → one picture more. Never below 2 or above 4 pictures.
 */
import type { Level } from '../content';
import { getState, update } from './storage';

const KEEP = 12;

export function recordTap(firstTry: boolean): void {
  update((s) => {
    const r = (s.adapt ??= { recent: [] }).recent;
    r.push(firstTry);
    if (r.length > KEEP) r.splice(0, r.length - KEEP);
  });
}

/** -1 = make it easier, 0 = as the level says, +1 = a bit harder. */
export function adjustment(): -1 | 0 | 1 {
  const r = getState().adapt?.recent ?? [];
  if (r.length < 6) return 0;
  const rate = r.filter(Boolean).length / r.length;
  if (rate < 0.5) return -1;
  if (r.length >= 8 && rate >= 0.9) return 1;
  return 0;
}

export function choicesFor(level: Level, nWords: number): number {
  return Math.max(2, Math.min(4, nWords, level.choices + adjustment()));
}

/** Misses before the right picture starts glowing. */
export const hintAfter = () => (adjustment() < 0 ? 1 : 2);

export const ADJUST_LABEL = { '-1': 'đang giảm bớt (bé hay chọn nhầm)', '0': 'theo bậc học', '1': 'đang tăng thêm (bé làm đúng liên tục)' } as const;
