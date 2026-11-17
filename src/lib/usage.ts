/** Counts minutes of kid-facing use per day and enforces the parent's daily limit. */
import { dayLog, getState, save, today } from './storage';

const TICK_S = 5;
let counting = false;

export function startUsageClock(isKidScreen: () => boolean): void {
  setInterval(() => {
    if (!counting || document.visibilityState !== 'visible' || !isKidScreen()) return;
    dayLog().seconds += TICK_S;
    save();
  }, TICK_S * 1000);
}

/** Only count once the child has actually started (tapped Play). */
export function setCounting(on: boolean): void {
  counting = on;
}

export function minutesToday(): number {
  return Math.floor((getState().days[today()]?.seconds ?? 0) / 60);
}

export function limitReached(): boolean {
  const s = getState();
  const limit = s.settings.dailyLimitMin;
  if (!limit) return false;
  const allowed = (limit + (s.bonus[today()] ?? 0)) * 60;
  return (s.days[today()]?.seconds ?? 0) >= allowed;
}
