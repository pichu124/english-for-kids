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

export function readDeepLink(): void {
  try {
    const q = new URLSearchParams(location.search);
    const unit = q.get('unit');
    const level = q.get('level');
    if (unit && topicById(unit)) {
      pendingUnit = unit;
      setLevel(topicById(unit)!.level);
    } else if (level && levelById(level)) {
      setLevel(level);
    }
    if (unit || level) history.replaceState(null, '', location.pathname);
  } catch {
    /* ignore malformed links */
  }
}

/** The unit a link asked for (once). */
export function takePendingUnit(): string | null {
  const u = pendingUnit;
  pendingUnit = null;
  return u;
}
