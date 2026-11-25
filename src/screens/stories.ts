import { Bix } from '../art/bix';
import { levelById, storiesOfLevel, storyById, topicById, type Story, type Word } from '../content';
import { h, shuffle, wait } from '../lib/dom';
import { currentLevel } from '../lib/level';
import { markKnown } from '../lib/progress';
import { choicesFor, hintAfter, recordTap } from '../lib/adapt';
import { sfx } from '../lib/sfx';
import { getState, update } from '../lib/storage';
import { say } from '../lib/tts';
import { limitReached } from '../lib/usage';
import type { Ctx } from '../router';
import { actOut, pick, PRAISE, wordCard } from './lesson/shared';
import { confetti, homeButton } from './widgets';
import { todayRunning } from '../lib/today';
import { todayNextButton } from './today';

/** A story opens once its unit has been finished — the words are already known. */
export const storyOpen = (s: Story) => (getState().topics[s.unit]?.completed ?? 0) > 0;

/** Shelf of stories for the current level. */
export function storiesScreen(ctx: Ctx): HTMLElement {
  const list = storiesOfLevel(currentLevel().id);
  const read = getState().storiesRead ?? {};
  const bix = new Bix({ size: 'sm' }).setMood('hello');
  const books = list.map((s) => {
    const open = storyOpen(s);
    const unit = topicById(s.unit);
    const b = h(
      'button',
      { class: `story-book ${open ? '' : 'is-locked'} ${read[s.id] ? 'is-read' : ''}`, 'aria-label': open ? s.title : 'Locked', 'data-story': s.id },
      h('span', { class: 'story-cover', 'aria-hidden': 'true' }, s.icon),
      h('span', { class: 'story-title' }, open ? s.title : `🔒 ${unit?.icon ?? ''}`),
      read[s.id] ? h('span', { class: 'story-star', 'aria-hidden': 'true' }, '⭐') : null,
    );
    b.addEventListener('click', () => {
      if (!open) {
        sfx.soft();
        void bix.talk(`Finish the lesson ${unit?.title ?? ''} first!`, 'encourage', `${unit?.icon ?? ''} first!`);
        return;
      }
      sfx.tap();
      ctx.go('story', { story: s.id });
    });
    return b;
  });
  setTimeout(() => {
    if (!ctx.alive()) return;
    if (!list.length) void bix.talk('Stories are coming soon!', 'idle');
    else if (list.some(storyOpen)) void bix.talk('Pick a story!', 'happy');
    else void bix.talk('Finish a lesson to open a story!', 'idle', 'Finish a lesson!');
  }, 300);
  return h(
    'main',
    { class: 'stories' },
    h('header', { class: 'book-top' }, homeButton(ctx), h('h1', { class: 'world-title' }, 'Stories'), h('div', { class: 'stories-bix' }, bix.el)),
    h('div', { class: 'story-shelf' }, books),
  );
}

/** Read one story: Bix reads each page, every word can be tapped, then 2 picture questions. */
export function storyScreen(ctx: Ctx): HTMLElement {
  const story = storyById(ctx.params.story ?? '');
  if (!story || limitReached()) {
    queueMicrotask(() => ctx.go(story ? 'rest' : 'stories'));
    return h('main');
  }
  const unit = topicById(story.unit)!;
  const level = levelById(unit.level)!;
  let page = 0;

  const stage = h('section', { class: 'story-stage' });
  const dots = h('div', { class: 'story-dots', 'aria-hidden': 'true' }, story.pages.map(() => h('span')));
  const back = h('button', { class: 'btn btn-round btn-sun', 'aria-label': 'Stories', onclick: () => (sfx.tap(), ctx.go('stories')) }, '📚');
  const el = h(
    'main',
    { class: 'story' },
    h('header', { class: 'book-top' }, homeButton(ctx), back, h('h1', { class: 'world-title story-h1' }, story.title), dots),
    stage,
  );

  const readPage = async (words: HTMLElement[], text: string) => {
    const starts: number[] = [];
    let at = 0;
    for (const w of words) {
      at = text.indexOf(w.textContent ?? '', at);
      starts.push(at);
      at += (w.textContent ?? '').length;
    }
    stage.classList.add('is-reading');
    await say(text, {
      onWord: (i) => {
        let k = starts.findIndex((s, j) => i >= s && (j === starts.length - 1 || i < starts[j + 1]));
        if (k < 0) k = 0;
        words.forEach((w, j) => w.classList.toggle('is-now', j === k));
      },
    });
    words.forEach((w) => w.classList.remove('is-now'));
    stage.classList.remove('is-reading');
  };

  const showPage = () => {
    const p = story.pages[page];
    [...dots.children].forEach((d, i) => d.classList.toggle('on', i <= page));
    const words = p.text.split(/\s+/).map((tok) => {
      const clean = tok.replace(/^[^\w']+|[^\w']+$/g, '');
      const b = h('button', { class: 'story-word', 'aria-label': clean || tok }, tok);
      b.addEventListener('click', () => {
        if (!clean) return;
        sfx.tap();
        b.classList.remove('is-tapped');
        void b.offsetWidth;
        b.classList.add('is-tapped');
        void say(clean);
      });
      return b;
    });
    const bix = p.bix ? new Bix({ size: 'sm', bubble: false }).setMood(page === story.pages.length - 1 ? 'happy' : 'hello') : null;
    const again = h('button', { class: 'btn btn-round btn-sun btn-ear', 'aria-label': 'Read again', onclick: () => (sfx.tap(), void readPage(words, p.text)) }, h('span', { class: 'icon-speaker' }));
    const prev = h('button', { class: 'btn btn-round story-nav', 'aria-label': 'Back', disabled: page === 0, onclick: () => (sfx.tap(), page--, showPage()) }, '◀');
    const next = h('button', { class: 'btn btn-round btn-good story-nav story-next', 'aria-label': 'Next', onclick: () => (sfx.tap(), page++, page < story.pages.length ? showPage() : void quiz()) }, '▶');
    stage.replaceChildren(
      h('div', { class: 'story-page pop' }, h('div', { class: 'story-scene' }, bix ? h('div', { class: 'story-bix' }, bix.el) : null, h('span', { class: 'story-emoji', 'aria-hidden': 'true' }, p.scene)), h('p', { class: 'story-text', lang: 'en' }, words)),
      h('div', { class: 'story-controls' }, prev, again, next),
    );
    void readPage(words, p.text);
  };

  const quiz = async () => {
    const bix = new Bix({ size: 'sm' }).setMood('happy');
    for (const [qi, q] of story.questions.entries()) {
      if (!ctx.alive()) return;
      const others = shuffle(unit.words.filter((w) => w.id !== q.answer.id)).slice(0, choicesFor(level, unit.words.length) - 1);
      const cards = shuffle<Word>([q.answer, ...others]).map((w) => {
        const c = wordCard(w, { label: false, cls: 'word-card-play pop' });
        c.dataset.id = w.id;
        return c;
      });
      const again = h('button', { class: 'btn btn-round btn-sun btn-ear', 'aria-label': 'Listen again' }, h('span', { class: 'icon-speaker' }));
      stage.replaceChildren(h('div', { class: 'story-quiz' }, h('div', { class: 'story-quiz-bix' }, bix.el), h('div', { class: 'play-cards' }, cards), again));
      again.onclick = () => (sfx.tap(), void bix.talk(q.ask, 'idle'));
      await bix.talk(qi === 0 ? `Let's see! ${q.ask}` : q.ask, 'idle', q.ask);
      let misses = 0;
      const right = await new Promise<HTMLElement>((resolve) => {
        for (const c of cards) {
          c.addEventListener('click', () => {
            if (!ctx.alive()) return;
            if (c.dataset.id === q.answer.id) return resolve(c);
            sfx.soft();
            misses++;
            c.classList.remove('shake');
            void c.offsetWidth;
            c.classList.add('shake');
            if (misses >= hintAfter()) cards.find((x) => x.dataset.id === q.answer.id)?.classList.add('is-hint');
            void bix.talk(`Try again! ${q.ask}`, 'encourage', 'Try again!');
          });
        }
      });
      if (!ctx.alive()) return;
      sfx.success();
      right.classList.add('is-right');
      cards.forEach((c) => c !== right && c.classList.add('is-faded'));
      actOut(right, q.answer);
      if (misses === 0) markKnown(unit.id, q.answer.id);
      recordTap(misses === 0);
      await bix.talk(`${pick(PRAISE)} ${q.answer.text}!`, 'happy');
      await wait(400);
    }
    end();
  };

  const end = () => {
    if (!ctx.alive()) return;
    update((s) => {
      s.storiesRead ??= {};
      s.storiesRead[story.id] = (s.storiesRead[story.id] ?? 0) + 1;
    });
    sfx.reward();
    confetti(document.body, 40);
    const again = h('button', { class: 'btn btn-sun', 'aria-label': 'Read again', onclick: () => (sfx.tap(), ctx.go('story', { story: story.id })) }, '🔁 Again');
    const shelf = h('button', { class: 'btn btn-good', 'aria-label': 'Stories', onclick: () => (sfx.tap(), ctx.go('stories')) }, '📚 Stories');
    const actions = todayRunning() ? [todayNextButton(ctx)] : [again, shelf];
    stage.replaceChildren(h('div', { class: 'story-end pop' }, h('div', { class: 'review-star' }, '🌟'), h('div', { class: 'reward-name' }, 'The End'), h('div', { class: 'reward-actions' }, actions)));
    void say('The end! Great reading!');
  };

  setTimeout(() => ctx.alive() && showPage(), 300);
  return el;
}
