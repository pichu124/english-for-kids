import { Bix } from '../art/bix';
import type { Word } from '../content';
import { h } from '../lib/dom';
import { spellOut } from '../lib/letters';
import { buildTest, passed, saveResult, shields, type Part, type Question, type Score } from '../lib/mocktest';
import { sfx } from '../lib/sfx';
import { say } from '../lib/tts';
import { limitReached } from '../lib/usage';
import type { Ctx } from '../router';
import { wordPicture } from './lesson/shared';
import { confetti, homeButton } from './widgets';

const PART_EN: Record<Part, { icon: string; name: string }> = {
  listening: { icon: '🎧', name: 'Listening' },
  spelling: { icon: '🔤', name: 'Spelling' },
  reading: { icon: '📖', name: 'Reading' },
};

/**
 * Starters practice test. Like the real one: the first answer counts and there are
 * no hints — but a wrong answer is never called wrong; Bix just says "OK!" and goes on.
 */
export function testScreen(ctx: Ctx): HTMLElement {
  if (limitReached()) {
    queueMicrotask(() => ctx.go('rest'));
    return h('main');
  }
  const qs = buildTest('L2');
  const score: Score = { listening: [0, 0], spelling: [0, 0], reading: [0, 0] };
  const bix = new Bix({ size: 'md' }).setMood('hello');
  const stage = h('section', { class: 'test-stage' });
  const dots = h('div', { class: 'test-dots', 'aria-hidden': 'true' }, qs.map(() => h('span')));
  const partTag = h('div', { class: 'test-part' });
  const el = h(
    'main',
    { class: 'test' },
    h('header', { class: 'book-top' }, homeButton(ctx), h('h1', { class: 'world-title' }, 'Starters Test'), partTag, dots),
    h('div', { class: 'test-body' }, h('div', { class: 'test-bix' }, bix.el), stage),
  );

  const choose = <T extends HTMLElement>(els: T[]) =>
    new Promise<T>((resolve) => {
      const off = () => els.forEach((e) => (e.onclick = null));
      els.forEach((e) => (e.onclick = () => (off(), resolve(e))));
    });
  const picCard = (w: Word) => h('button', { class: 'test-card pop', 'data-word': w.text, 'aria-label': w.text }, wordPicture(w));
  const wordCard = (w: Word) => h('button', { class: 'read-choice pop', 'data-word': w.text, 'aria-label': w.text, lang: 'en' }, w.text);
  const hear = (text: () => string) => h('button', { class: 'btn btn-round btn-sun btn-ear', 'aria-label': 'Listen again', onclick: () => (sfx.tap(), void say(text())) }, h('span', { class: 'icon-speaker' }));

  let lastPart: Part | null = null;
  const ask = async (q: Question, i: number): Promise<boolean> => {
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k < i));
    dots.children[i]?.classList.add('now');
    partTag.textContent = `${PART_EN[q.part].icon} ${PART_EN[q.part].name}`;
    if (q.part !== lastPart) {
      lastPart = q.part;
      const intro = { listening: 'Part one. Listen and touch the picture.', spelling: 'Part two. Listen to the letters. Find the word.', reading: 'Part three. Look and read.' }[q.part];
      stage.replaceChildren(h('div', { class: 'test-intro pop' }, h('span', { 'aria-hidden': 'true' }, PART_EN[q.part].icon), PART_EN[q.part].name));
      await bix.talk(intro, 'happy', PART_EN[q.part].name);
      if (!ctx.alive()) return false;
    }
    if (q.kind === 'pick-picture') {
      const cards = q.options.map(picCard);
      stage.replaceChildren(h('div', { class: 'test-q', 'data-answer': q.target.text }, h('div', { class: 'play-cards' }, cards), hear(() => q.prompt)));
      void bix.talk(q.prompt, 'idle', '👂');
      return (await choose(cards)).dataset.word === q.target.text;
    }
    if (q.kind === 'pick-spelled') {
      const spelled = spellOut(q.target.text);
      const cards = q.options.map(wordCard);
      stage.replaceChildren(h('div', { class: 'test-q', 'data-answer': q.target.text }, h('div', { class: 'read-choices test-words' }, cards), hear(() => spelled)));
      void bix.talk(spelled, 'idle', '🔤 👂');
      return (await choose(cards)).dataset.word === q.target.text;
    }
    if (q.kind === 'yes-no') {
      const yes = h('button', { class: 'yn-btn yn-yes pop', 'aria-label': 'Yes', 'data-word': 'yes' }, h('span', { 'aria-hidden': 'true' }, '👍'), 'Yes');
      const no = h('button', { class: 'yn-btn yn-no pop', 'aria-label': 'No', 'data-word': 'no' }, h('span', { 'aria-hidden': 'true' }, '👎'), 'No');
      stage.replaceChildren(
        h('div', { class: 'test-q yesno', 'data-answer': q.truth ? 'yes' : 'no' }, h('div', { class: 'read-pic' }, wordPicture(q.shown)), h('div', { class: 'yn-side' }, h('p', { class: 'yn-text', lang: 'en' }, q.sentence), h('div', { class: 'yn-buttons' }, yes, no))),
      );
      return (await choose([yes, no])) === (q.truth ? yes : no);
    }
    const cards = q.options.map(wordCard);
    stage.replaceChildren(h('div', { class: 'test-q read', 'data-answer': q.target.text }, h('div', { class: 'read-pic' }, wordPicture(q.target)), h('div', { class: 'read-choices' }, cards)));
    return (await choose(cards)).dataset.word === q.target.text;
  };

  const finish = async () => {
    saveResult(score);
    dots.querySelectorAll('span').forEach((d) => d.classList.add('on'));
    const ok = passed(score);
    const rows = (Object.keys(PART_EN) as Part[]).map((p) =>
      h('div', { class: 'test-row', 'data-part': p }, h('span', { class: 'test-row-name' }, `${PART_EN[p].icon} ${PART_EN[p].name}`), h('span', { class: 'test-shields', 'aria-label': `${shields(score[p])} of 5` }, Array.from({ length: 5 }, (_, k) => h('span', { class: k < shields(score[p]) ? 'on' : '' }, '🛡️')))),
    );
    const again = h('button', { class: 'btn btn-sun', 'aria-label': 'Again', onclick: () => (sfx.tap(), ctx.go('test', { t: String(Date.now()) })) }, '🔁 Again');
    const home = h('button', { class: 'btn btn-good', 'aria-label': 'Home', onclick: () => (sfx.tap(), ctx.go('home')) }, h('span', { class: 'icon-home', style: 'width:36px' }), 'Home');
    partTag.textContent = '';
    stage.replaceChildren(h('div', { class: 'test-result pop' }, h('div', { class: 'test-medal', 'aria-hidden': 'true' }, ok ? '🏆' : '🌟'), rows, h('div', { class: 'reward-actions' }, again, home)));
    sfx.reward();
    confetti(document.body, ok ? 60 : 30);
    await bix.talk(ok ? 'Wow! You did a great job! You are ready for the next level!' : 'Well done! Keep practising and you will get more shields!', 'happy', ok ? '🏆 Great job!' : '🌟 Well done!');
  };

  setTimeout(async () => {
    if (!ctx.alive()) return;
    await bix.talk("This is a little test. Do your best! Let's start!", 'happy', 'Do your best! ⭐');
    for (const [i, q] of qs.entries()) {
      if (!ctx.alive()) return;
      const right = await ask(q, i);
      if (!ctx.alive()) return;
      score[q.part][1]++;
      if (right) score[q.part][0]++;
      sfx.tap();
      bix.setMood('happy');
      await bix.talk('OK!', 'idle'); // the same for right and wrong: results come at the end, never "wrong"
    }
    if (ctx.alive()) await finish();
  }, 300);
  return el;
}
