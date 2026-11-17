import { Bix } from '../../art/bix';
import { topicById } from '../../content';
import { h } from '../../lib/dom';
import type { Ctx } from '../../router';
import { homeButton } from '../widgets';
import { runListen } from './listen';
import { PLAY_ROUNDS, runPlay } from './play';
import { runReward } from './reward';
import { Aborted, makeUI } from './shared';
import { runSpeak } from './speak';

export function lessonScreen(ctx: Ctx): HTMLElement {
  const topic = topicById(ctx.params.topic ?? '');
  if (!topic) {
    queueMicrotask(() => ctx.go('home'));
    return h('main');
  }

  const total = topic.words.length * 2 + PLAY_ROUNDS;
  let done = 0;
  const fill = h('div', { class: 'progress-fill' });
  const stepIcons = ['👂', '🎤', '🎯', '🎁'].map((icon) => h('span', { class: 'progress-step' }, icon));
  const bar = h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total }, h('div', { class: 'progress-track' }, fill), h('div', { class: 'progress-steps' }, stepIcons));
  const bix = new Bix({ size: 'md' }).setMood('hello');
  const stage = h('section', { class: 'stage' });
  const parentBar = h('div', { class: 'parent-slot' });

  const el = h(
    'main',
    { class: 'lesson', style: `--topic:${topic.color}` },
    h('header', { class: 'lesson-top' }, homeButton(ctx), bar, h('div', { class: 'lesson-topic' }, topic.icon)),
    h('div', { class: 'lesson-body' }, h('div', { class: 'lesson-bix' }, bix.el), stage),
    parentBar,
  );

  const ui = makeUI({
    ctx,
    topic,
    bix,
    stage,
    parentBar,
    setStep(i) {
      stepIcons.forEach((s, j) => {
        s.classList.toggle('is-current', j === i);
        s.classList.toggle('is-past', j < i);
      });
    },
    tick() {
      done = Math.min(total, done + 1);
      fill.style.width = `${(done / total) * 100}%`;
      bar.setAttribute('aria-valuenow', String(done));
    },
  });

  (async () => {
    try {
      await ui.pause(300);
      await runListen(ui);
      await runSpeak(ui);
      await runPlay(ui);
      await runReward(ui);
    } catch (e) {
      if (!(e instanceof Aborted)) console.error(e);
    }
  })();

  return el;
}
