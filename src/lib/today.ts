/**
 * "Today": one guided path of about ten minutes, so a child never wonders where
 * to start — review (if words are due) → the next lesson → a story or a game → a
 * prize for the day. The plan is kept per child and per day.
 */
import phonics from '../../content/phonics.json';
import talk from '../../content/talk.json';
import { hasPart2, LEVELS, levelById, storiesOfLevel, topicsOfLevel, type Topic } from '../content';
import { currentLevel } from './level';
import { buildReview } from './review';
import { getState, today, update } from './storage';

export type TodayStep = { kind: 'hello' | 'review' | 'lesson' | 'talk' | 'fun'; id?: string; part?: 1 | 2; done?: boolean };
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
  // Hello! first: day, weather, how are you (about 30 seconds)
  const steps: TodayStep[] = [{ kind: 'hello' }];
  if (buildReview(level)) steps.push({ kind: 'review' });
  // Starters: a unit already heard but not yet read & written comes first (so days
  // alternate: new unit → its Read & Write → next unit …); otherwise the next unit.
  const st = getState();
  const toRead = topicsOfLevel(level).find((u) => hasPart2(u) && (st.topics[u.id]?.completed ?? 0) > 0 && !st.topics[u.id]?.readDone);
  const t = suggestedTopic(level);
  if (toRead) steps.push({ kind: 'lesson', id: toRead.id, part: 2 });
  else if (t) steps.push({ kind: 'lesson', id: t.id });
  const speak = speakingStep(level);
  if (speak) steps.push({ kind: 'talk', id: speak });
  steps.push({ kind: 'fun' });
  const plan = { day: today(), steps };
  update((st) => (st.today = plan));
  return plan;
}

/**
 * A speaking/reading moment for the day: the next phonics set for young readers (until all
 * sets are done), otherwise a chat with Bix not yet done, or the level's speaking practice.
 * Returns 'phonics:p2', 'chat:food' or 'practice'; nothing for pre-readers (level 0).
 */
export function speakingStep(levelId: string): string | undefined {
  const level = levelById(levelId);
  if (!level || levelId === 'L0') return undefined;
  const s = getState();
  const idx = LEVELS.findIndex((l) => l.id === levelId);
  if (levelId === 'L1' || levelId === 'L2') {
    const next = phonics.sets.find((st) => !s.phonics?.[st.id]);
    if (next) return `phonics:${next.id}`;
  }
  const chats = talk.chats.filter((c) => LEVELS.findIndex((l) => l.id === c.level) <= idx);
  const practice = levelId in talk.practice;
  // alternate by day between a chat and the speaking test practice (when the level has one)
  if (practice && (Number(today().slice(-2)) % 2 === 0 || !chats.length)) return 'practice';
  const fresh = chats.find((c) => !s.talk?.[`chat-${c.id}`]);
  const pick = fresh ?? chats[Number(today().slice(-2)) % Math.max(1, chats.length)];
  return pick ? `chat:${pick.id}` : practice ? 'practice' : undefined;
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
  const lv = currentLevel().id;
  const games = ['game:memory', 'game:balloons', 'game:colour'];
  if (lv !== 'L0') games.push('game:pairs'); // words that sound alike (ship / sheep)
  if (!['L0', 'L1'].includes(lv)) games.push('game:who', 'game:clock');
  // the spelling game only once the child has done some Read & Write (not on day 1)
  if (!['L0', 'L1'].includes(lv) && (lv !== 'L2' || Object.values(s.topics).some((t) => (t.readDone ?? 0) > 0))) games.push('game:tower');
  if (lv === 'L4') games.push('game:riddle'); // Flyers words have definitions
  games.push('game:maths', 'game:sort');
  if (!['L0', 'L1'].includes(lv)) games.push('game:grammar');
  return games[Number(today().slice(-2)) % games.length];
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
