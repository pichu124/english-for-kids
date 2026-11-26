import { Bix } from '../art/bix';
import { storyById, topicById } from '../content';
import { h } from '../lib/dom';
import { REVIEW_ID, buildReview } from '../lib/review';
import { currentLevel } from '../lib/level';
import { sfx } from '../lib/sfx';
import { getState, update } from '../lib/storage';
import { completeTodayStep, currentStep, finishToday, resolveFun, startTodayStep, todayPlan, type TodayStep } from '../lib/today';
import { limitReached } from '../lib/usage';
import type { Ctx } from '../router';
import phonics from '../../content/phonics.json';
import talk from '../../content/talk.json';
import { confetti, homeButton } from './widgets';

const GAME_NAME: Record<string, string> = { memory: 'Memory', balloons: 'Balloons', colour: 'Colour', who: 'Who Is Who?', riddle: 'Riddles' };

function label(st: TodayStep): { icon: string; text: string; say: string } {
  if (st.kind === 'review') return { icon: '🔁', text: 'Review', say: 'review your words' };
  if (st.kind === 'lesson') {
    const t = topicById(st.id ?? '');
    if (st.part === 2) return { icon: '📖', text: `${t?.title ?? 'Lesson'} · Read`, say: `read and write ${t?.title ?? ''}` };
    return { icon: t?.icon ?? '⭐', text: t?.title ?? 'Lesson', say: `learn ${t?.title ?? 'a new lesson'}` };
  }
  if (st.kind === 'talk') {
    const [k, id] = (st.id ?? '').split(':');
    if (k === 'phonics') return { icon: '🔊', text: phonics.sets.find((x) => x.id === id)?.title ?? 'Sounds', say: 'learn some letter sounds' };
    if (k === 'chat') {
      const c = talk.chats.find((x) => x.id === id);
      return { icon: c?.icon ?? '💬', text: c?.title ?? 'Talk', say: 'talk with me' };
    }
    return { icon: '🎓', text: 'Speaking practice', say: 'practise speaking' };
  }
  const [kind, id] = (st.id ?? '').split(':');
  if (kind === 'story') return { icon: '📚', text: storyById(id)?.title ?? 'Story', say: 'read a story' };
  if (kind === 'game') return { icon: '🎮', text: GAME_NAME[id] ?? 'Game', say: 'play a game' };
  return { icon: '🎲', text: 'Story or game', say: 'play' };
}

/** The day's path: cards with ✓ for what is done, a big ▶ for what is next, a prize at the end. */
export function todayScreen(ctx: Ctx): HTMLElement {
  if (limitReached()) {
    queueMicrotask(() => ctx.go('rest'));
    return h('main');
  }
  const plan = todayPlan();
  const justFinished = finishToday();
  const finished = !!getState().today?.finished;
  const i = currentStep(plan);
  const bix = new Bix({ size: 'md' }).setMood(finished ? 'happy' : 'hello');

  const cards = plan.steps.map((st, k) => {
    const l = label(st);
    return h(
      'div',
      { class: `today-card ${st.done ? 'is-done' : k === i ? 'is-now' : 'is-later'}`, 'data-kind': st.kind },
      h('span', { class: 'today-icon', 'aria-hidden': 'true' }, l.icon),
      h('span', { class: 'today-label' }, l.text),
      st.done ? h('span', { class: 'today-check', 'aria-label': 'done' }, '✓') : null,
    );
  });
  const prize = h('div', { class: `today-card today-prize ${finished ? 'is-done' : 'is-later'}` }, h('span', { class: 'today-icon', 'aria-hidden': 'true' }, finished ? '🌟' : '🎁'), h('span', { class: 'today-label' }, 'Prize'));

  const start = () => {
    const st = plan.steps[i];
    sfx.tap();
    startTodayStep(i);
    if (st.kind === 'review') {
      if (!buildReview(currentLevel().id)) {
        completeTodayStep(); // nothing due any more: skip it
        return ctx.go('today');
      }
      return ctx.go('lesson', { topic: REVIEW_ID });
    }
    if (st.kind === 'lesson') return ctx.go('lesson', st.part === 2 ? { topic: st.id!, part: '2' } : { topic: st.id! });
    if (st.kind === 'talk') {
      const [k, id] = (st.id ?? '').split(':');
      if (k === 'phonics') return ctx.go('phonics', { set: id });
      return ctx.go('talk', k === 'chat' ? { chat: id } : { mode: 'practice' });
    }
    const fun = st.id ?? resolveFun(plan);
    update((s) => (s.today!.steps[i].id = fun));
    const [kind, id] = fun.split(':');
    if (kind === 'story') return ctx.go('story', { story: id });
    return ctx.go('games', { game: id });
  };

  const go = finished
    ? h('button', { class: 'btn btn-good today-go', 'aria-label': 'Home', onclick: () => (sfx.tap(), ctx.go('home')) }, h('span', { class: 'icon-home', style: 'width:40px' }), 'Home')
    : h('button', { class: 'btn btn-good today-go', 'aria-label': 'Go', onclick: start }, '▶ Go!');

  setTimeout(async () => {
    if (!ctx.alive()) return;
    if (finished) {
      if (justFinished) {
        sfx.reward();
        confetti(document.body, 60);
      }
      const days = getState().todayDays ?? 1;
      await bix.talk(justFinished ? `Hooray! You did everything today! That is ${days} ${days === 1 ? 'day' : 'days'}! See you tomorrow!` : 'You did everything today! Super!', 'happy', justFinished ? '🌟 You did it!' : '🌟 Done!');
      return;
    }
    const l = label({ ...plan.steps[i], id: plan.steps[i].id ?? (plan.steps[i].kind === 'fun' ? resolveFun(plan) : undefined) });
    const line = i === 0 ? `Here is today's plan! First, let's ${l.say}!` : `Great job! Next, let's ${l.say}!`;
    await bix.talk(line, 'happy', i === 0 ? "Today's plan!" : 'Next! ▶');
  }, 300);

  return h(
    'main',
    { class: 'today' },
    h('header', { class: 'book-top' }, homeButton(ctx), h('h1', { class: 'world-title' }, 'Today'), h('div', { class: 'book-count' }, `⭐ ${getState().todayDays ?? 0}`)),
    h('div', { class: 'today-body' }, h('div', { class: 'today-bix' }, bix.el), h('div', { class: 'today-main' }, h('div', { class: 'today-path' }, [...cards, prize]), go)),
  );
}

/** "▶ Next" for the end of an activity started from Today (lesson, review, story, game). */
export function todayNextButton(ctx: Ctx): HTMLElement {
  return h(
    'button',
    {
      class: 'btn btn-good today-next',
      'aria-label': 'Next',
      onclick: () => {
        sfx.tap();
        completeTodayStep();
        ctx.go('today');
      },
    },
    '▶ Next',
  );
}
