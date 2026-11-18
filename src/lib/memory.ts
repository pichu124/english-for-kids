/** What Bix "remembers" about the child — all of it stays on this device. */
import { topics, topicsOfLevel, type Level, type Topic } from '../content';
import { getState, today, update } from './storage';

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** The unit finished most recently (any level), with the day it was done. */
export function lastLesson(): { topic: Topic; day: string } | null {
  const s = getState();
  let best: { topic: Topic; day: string } | null = null;
  for (const t of topics) {
    const day = s.topics[t.id]?.lastDone;
    if (day && (!best || day > best.day)) best = { topic: t, day };
  }
  return best;
}

/** First line of the day/session, depending on what happened before. */
export function greeting(hi: string): string {
  const last = lastLesson();
  if (!last) return `${hi} I am Bix. Let's play!`;
  const gap = daysBetween(last.day, today());
  if (gap <= 0) return `${hi} Let's learn more!`;
  if (gap >= 4) return `${hi} I missed you! Last time we learned ${last.topic.title}!`;
  return `${hi} Welcome back! Last time we learned ${last.topic.title}!`;
}

/** A level whose islands are all done and that Bix has not cheered for yet. */
export function levelToCelebrate(level: Level): boolean {
  const s = getState();
  const list = topicsOfLevel(level.id);
  return list.length > 0 && list.every((t) => (s.topics[t.id]?.completed ?? 0) > 0) && !(s.celebrated ?? []).includes(level.id);
}
export const markCelebrated = (level: Level) => update((s) => (s.celebrated = [...(s.celebrated ?? []), level.id]));

/** One chat question a day, about a unit the child has done, not asked in the last week. */
export function chatToday(): Topic | null {
  const s = getState();
  const chats = s.chats ?? {};
  if (Object.values(chats).includes(today())) return null;
  const done = topics
    .filter((t) => t.chat && s.topics[t.id]?.lastDone)
    .filter((t) => !chats[t.id] || daysBetween(chats[t.id], today()) >= 7)
    .sort((a, b) => (s.topics[b.id].lastDone ?? '').localeCompare(s.topics[a.id].lastDone ?? ''));
  return done[0] ?? null;
}

export function answerChat(t: Topic, answer: 'yes' | 'no' | null): void {
  update((s) => {
    (s.chats ??= {})[t.id] = today();
    if (answer) (s.chatAnswers ??= {})[t.id] = answer;
  });
}
