import { Bix } from '../../art/bix';
import { gapCount, hasPart2, levelById, partSteps, sentenceCount, topicById, type StepType } from '../../content';
import { h } from '../../lib/dom';
import { limitReached } from '../../lib/usage';
import { currentLevel } from '../../lib/level';
import { buildReview, recordReview, REVIEW_ID } from '../../lib/review';
import { markKnown, noteSlip } from '../../lib/progress';
import { wordKey } from '../../lib/storage';
import { runReviewReward } from './reward';
import type { Ctx } from '../../router';
import { homeButton } from '../widgets';
import { runListen } from './listen';
import { runPlay } from './play';
import { runDoIt } from './doit';
import { runChant } from './chant';
import { readRounds, runRead } from './read';
import { runSpell, spellWords } from './spell';
import { runSentence } from './sentence';
import { runWrite, writeWords } from './write';
import { runText } from './text';
import { runGap } from './gap';
import { runReward } from './reward';
import { Aborted, makeUI } from './shared';
import { runSpeak } from './speak';

export function lessonScreen(ctx: Ctx): HTMLElement {
  const review = ctx.params.topic === REVIEW_ID ? buildReview(currentLevel().id) : null;
  const topic = review ? review.topic : topicById(ctx.params.topic ?? '');
  if (!topic || limitReached()) {
    queueMicrotask(() => ctx.go(topic ? 'rest' : 'home'));
    return h('main');
  }

  const level = levelById(topic.level)!;
  // Starters units come in two parts: 1 = Listen & Say, 2 = Read & Write.
  const part: 1 | 2 = !review && ctx.params.part === '2' && hasPart2(topic) ? 2 : 1;
  const steps = review ? topic.steps : partSteps(topic, part);
  const STEP_ICON: Record<StepType, string> = { listen: '👂', say: '🎤', 'tap-picture': '🎯', 'do-it': '🤸', chant: '🥁', read: '📖', spell: '🔤', sentence: '✍️', write: '⌨️', text: '📃', gap: '🧩' };
  const STEP_UNITS: Record<StepType, number> = { listen: topic.words.length, say: topic.words.length, 'tap-picture': topic.playRounds ?? level.playRounds, 'do-it': topic.actions.length, chant: (topic.chant?.lines.length ?? 0) * 2, read: readRounds(topic.words), spell: spellWords(topic.words).length, sentence: sentenceCount(topic.words), write: writeWords(topic.words).length, text: topic.text?.questions.length ?? 0, gap: gapCount(topic.words) };
  const total = steps.reduce((n, s) => n + STEP_UNITS[s], 0);
  let done = 0;
  const fill = h('div', { class: 'progress-fill' });
  const stepIcons = [...steps.map((s) => STEP_ICON[s]), '🎁'].map((icon) => h('span', { class: 'progress-step' }, icon));
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
    level,
    bix,
    stage,
    parentBar,
    setStep(i) {
      stepIcons.forEach((s, j) => {
        s.classList.toggle('is-current', j === i);
        s.classList.toggle('is-past', j < i);
      });
    },
    onPlayResult: (w, firstTry) => {
      const key = review ? review.keys.get(w.id) ?? '' : wordKey(topic.id, w.id);
      if (!firstTry) noteSlip(key);
      if (review) recordReview(key, firstTry);
      else if (firstTry) markKnown(topic.id, w.id);
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
      const RUN: Record<StepType, (u: typeof ui) => Promise<void>> = { listen: runListen, say: runSpeak, 'tap-picture': runPlay, 'do-it': runDoIt, chant: runChant, read: runRead, spell: runSpell, sentence: runSentence, write: runWrite, text: runText, gap: runGap };
      for (const [i, step] of steps.entries()) {
        ui.setStep(i);
        await RUN[step](ui);
      }
      ui.setStep(steps.length);
      await (review ? runReviewReward(ui) : runReward(ui, part));
    } catch (e) {
      if (!(e instanceof Aborted)) console.error(e);
    }
  })();

  return el;
}
