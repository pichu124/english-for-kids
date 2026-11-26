import { Bix } from '../art/bix';
import { kidSVG } from '../art/kids';
import type { Word } from '../content';
import { fromHTML, h } from '../lib/dom';
import { spellOut } from '../lib/letters';
import { buildTest, passed, saveResult, shields, TEST_NAME, TEST_PARTS, type Part, type Question, type Score } from '../lib/mocktest';
import { currentLevel } from '../lib/level';
import { letterName } from '../lib/letters';
import { sfx } from '../lib/sfx';
import { say } from '../lib/tts';
import { limitReached } from '../lib/usage';
import type { Ctx } from '../router';
import { wordPicture } from './lesson/shared';
import { confetti, homeButton } from './widgets';

const PART_EN: Record<Part, { icon: string; name: string }> = {
  listening: { icon: '🎧', name: 'Listening' },
  spelling: { icon: '🔤', name: 'Spelling' },
  writing: { icon: '✏️', name: 'Writing' },
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
  const level = currentLevel().id in TEST_PARTS ? currentLevel().id : 'L2';
  const parts = TEST_PARTS[level];
  const qs = buildTest(level);
  const score: Score = Object.fromEntries(parts.map((p) => [p, [0, 0]]));
  const bix = new Bix({ size: 'md' }).setMood('hello');
  const stage = h('section', { class: 'test-stage' });
  const dots = h('div', { class: 'test-dots', 'aria-hidden': 'true' }, qs.map(() => h('span')));
  const partTag = h('div', { class: 'test-part' });
  const el = h(
    'main',
    { class: 'test' },
    h('header', { class: 'book-top' }, homeButton(ctx), h('h1', { class: 'world-title' }, TEST_NAME[level]), partTag, dots),
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
      const intro = q.kind === 'type-word' && q.def ? 'Part two. Read and write the word.' : { listening: 'Part one. Listen and touch the picture.', spelling: 'Part two. Listen to the letters. Find the word.', writing: 'Part two. Look and write the word.', reading: 'Part three. Look and read.' }[q.part];
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
    if (q.kind === 'find-kid') {
      const cards = q.kids.map((k) => h('button', { class: 'kid pop', 'data-word': k.name, 'aria-label': `${k.shirt.name} T-shirt, ${k.doing.says}` }, fromHTML(kidSVG(k))));
      stage.replaceChildren(h('div', { class: 'test-q test-kids', 'data-answer': q.target.name }, h('div', { class: 'kid-row' }, cards), hear(() => q.prompt)));
      void bix.talk(q.prompt, 'idle', '👂');
      return (await choose(cards)).dataset.word === q.target.name;
    }
    if (q.kind === 'pick-spelled') {
      const spelled = spellOut(q.target.text);
      const cards = q.options.map(wordCard);
      stage.replaceChildren(h('div', { class: 'test-q', 'data-answer': q.target.text }, h('div', { class: 'read-choices test-words' }, cards), hear(() => spelled)));
      void bix.talk(spelled, 'idle', '🔤 👂');
      return (await choose(cards)).dataset.word === q.target.text;
    }
    if (q.kind === 'type-word') {
      // First try counts: correct only if typed with no slip (a wrong key types nothing, no hints).
      const word = q.target.text.toLowerCase();
      const boxes = word.split('').map(() => h('span', { class: 'spell-slot wr-box' }));
      const keys = 'abcdefghijklmnopqrstuvwxyz'.split('').map((c) => h('button', { class: 'wr-key', 'data-key': c, 'aria-label': c, lang: 'en' }, c));
      stage.replaceChildren(h('div', { class: 'test-q write', 'data-answer': word }, h('div', { class: 'spell-top' }, q.def ? h('p', { class: 'def-card', lang: 'en' }, q.def) : h('div', { class: 'read-pic spell-pic' }, wordPicture(q.target))), h('div', { class: `spell-slots ${word.length > 6 ? 'is-long' : ''}` }, boxes), h('div', { class: 'wr-keys' }, keys)));
      if (q.def) void say(q.def);
      let slips = 0;
      for (let i = 0; i < word.length; ) {
        const k = await choose(keys);
        if (!ctx.alive()) return false;
        if (k.dataset.key === word[i]) {
          boxes[i].textContent = word[i];
          boxes[i].classList.add('is-filled');
          void say(letterName(word[i]));
          i++;
        } else {
          slips++;
          sfx.soft();
          k.classList.remove('shake');
          void k.offsetWidth;
          k.classList.add('shake');
        }
      }
      return slips === 0;
    }
    if (q.kind === 'text-q') {
      const opts = q.q.options.map((o, k) => h('button', { class: 'read-choice tx-opt pop', 'data-word': String(k), 'aria-label': o, lang: 'en' }, o));
      stage.replaceChildren(
        h('div', { class: 'test-q text-read', 'data-answer': String(q.q.answer) }, h('article', { class: 'tx-card' }, h('h3', { class: 'tx-title' }, q.text.title), q.text.lines.map((l) => h('p', { class: 'tx-line', lang: 'en' }, l))), h('div', { class: 'tx-q' }, h('p', { class: 'tx-ask', lang: 'en' }, q.q.q), h('div', { class: 'tx-opts' }, opts))),
      );
      void say(q.q.q);
      return Number((await choose(opts)).dataset.word) === q.q.answer;
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
    saveResult(score, level);
    dots.querySelectorAll('span').forEach((d) => d.classList.add('on'));
    const ok = passed(score);
    const rows = parts.map((p) => {
      const n = shields(score[p] ?? [0, 0]);
      return h('div', { class: 'test-row', 'data-part': p }, h('span', { class: 'test-row-name' }, `${PART_EN[p].icon} ${PART_EN[p].name}`), h('span', { class: 'test-shields', 'aria-label': `${n} of 5` }, Array.from({ length: 5 }, (_, k) => h('span', { class: k < n ? 'on' : '' }, '🛡️'))));
    });
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
      const sc = (score[q.part] ??= [0, 0]);
      sc[1]++;
      if (right) sc[0]++;
      sfx.tap();
      bix.setMood('happy');
      await bix.talk('OK!', 'idle'); // the same for right and wrong: results come at the end, never "wrong"
    }
    if (ctx.alive()) await finish();
  }, 300);
  return el;
}
