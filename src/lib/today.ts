/**
 * "Today": one guided path of about ten minutes, so a child never wonders where
 * to start — review (if words are due) → the next lesson → a story or a game → a
 * prize for the day. The plan is kept per child and per day.
 */
import { hasPart2, storiesOfLevel, topicsOfLevel, type Topic } from '../content';
import { currentLevel } from './level';
import { buildReview } from './review';
import { getState, today, update } from './storage';

export type TodayStep = { kind: 'review' | 'lesson' | 'fun'; id?: string; part?: 1 | 2; done?: boolean };
export type TodayPlan = { day: string; steps: TodayStep[]; finished?: boolean };

/** First unit not done yet, else the one practised least. */
export function suggestedTopic(levelId: string): Topic | undefined {
  const s = getState();
  const list = topicsOfLevel(levelId);
  return list.find((t) => !s.topics[t.id]?.completed) ?? [...list].sort((a, b) => (s.topics[a.id]?.completed ?? 0) - (s.topics[b.id]?.completed ?? 0))[0];
}

/** Today's plan for the current child (made on first use each day). */
export function todayPlan(): TodayPlan {
  const s = getState();
  if (s.today?.day === today()) return s.today;
  const level = currentLevel().id;
  const steps: TodayStep[] = [];
  if (buildReview(level)) steps.push({ kind: 'review' });
  // Starters: a unit already heard but not yet read & written comes first (so days
  // alternate: new unit → its Read & Write → next unit …); otherwise the next unit.
  const st = getState();
  const toRead = topicsOfLevel(level).find((u) => hasPart2(u) && (st.topics[u.id]?.completed ?? 0) > 0 && !st.topics[u.id]?.readDone);
  const t = suggestedTopic(level);
  if (toRead) steps.push({ kind: 'lesson', id: toRead.id, part: 2 });
  else if (t) steps.push({ kind: 'lesson', id: t.id });
  steps.push({ kind: 'fun' });
  const plan = { day: today(), steps };
  update((st) => (st.today = plan));
  return plan;
}

export const currentStep = (p: TodayPlan) => p.steps.findIndex((x) => !x.done);
export const todayFinished = () => getState().today?.day === today() && !!getState().today?.finished;

/** A story the child can read now and has not read yet (the lesson's own story first), else a game. */
export function resolveFun(p: TodayPlan): string {
  const s = getState();
  const lesson = p.steps.find((x) => x.kind === 'lesson')?.id;
  const open = storiesOfLevel(currentLevel().id).filter((st) => (s.topics[st.unit]?.completed ?? 0) > 0 && !s.storiesRead?.[st.id]);
  const story = open.find((st) => st.unit === lesson) ?? open[0];
  if (story) return `story:${story.id}`;
  return ['game:memory', 'game:balloons', 'game:colour'][Number(today().slice(-2)) % 3];
}

// The step being played right now (only while the child came from the Today screen).
let running: number | null = null;
export const startTodayStep = (i: number) => (running = i);
export const todayRunning = () => running !== null && getState().today?.day === today();
export const stopTodayRun = () => (running = null);

/** The activity launched from Today is over: tick it off. */
export function completeTodayStep(): void {
  const i = running;
  running = null;
  if (i === null) return;
  update((s) => {
    if (s.today?.day === today() && s.today.steps[i]) s.today.steps[i].done = true;
  });
}

/** All steps ticked: the day is done (counted once). */
export function finishToday(): boolean {
  const p = getState().today;
  if (!p || p.day !== today() || p.finished || p.steps.some((x) => !x.done)) return false;
  update((s) => {
    s.today!.finished = true;
    s.todayDays = (s.todayDays ?? 0) + 1;
  });
  return true;
}
