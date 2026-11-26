/** Which level the child is on, and deep links (?unit=… / ?level=…) from casa-mamnon. */
import { DEFAULT_LEVEL, levelById, levelsWithContent, topicById, type Level } from '../content';
import { getState, update } from './storage';

export function currentLevel(): Level {
  const want = levelById(getState().settings.level ?? DEFAULT_LEVEL);
  const withContent = levelsWithContent();
  if (want && withContent.some((l) => l.id === want.id)) return want;
  return withContent.find((l) => l.id === DEFAULT_LEVEL) ?? withContent[0] ?? levelById(DEFAULT_LEVEL)!;
}

export function setLevel(id: string): void {
  if (levelById(id)) update((s) => (s.settings.level = id));
}

/**
 * A link like https://…/?unit=l1-body opens that unit right after the child taps
 * Play (audio needs that first tap). Read once at start-up, then removed from the
 * address bar so a reload goes back to the normal home screen.
 */
let pendingUnit: string | null = null;
let pendingPart: string | null = null;
let pendingLevel: string | null = null;

export function readDeepLink(): void {
  try {
    const q = new URLSearchParams(location.search);
    const unit = q.get('unit');
    const level = q.get('level');
    if (unit && topicById(unit)) {
      pendingUnit = unit;
      pendingPart = q.get('part') === '2' ? '2' : null;
      pendingLevel = topicById(unit)!.level;
    } else if (level && levelById(level)) {
      pendingLevel = level;
    }
    if (unit || level) history.replaceState(null, '', location.pathname);
  } catch {
    /* ignore malformed links */
  }
}

/**
 * The level a link asked for, applied when a child taps Play — on several-children
 * devices that is after they picked their animal, so it lands on the right child.
 */
export function applyPendingLevel(): void {
  if (pendingLevel) setLevel(pendingLevel);
  pendingLevel = null;
}

/** The unit (and part, for ?part=2) a link asked for (once). */
export function takePendingUnit(): string | null {
  const u = pendingUnit;
  pendingUnit = null;
  return u;
}
export function takePendingPart(): string | null {
  const p = pendingPart;
  pendingPart = null;
  return p;
}
