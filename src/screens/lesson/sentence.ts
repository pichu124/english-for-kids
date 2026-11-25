import { buildable, firstSentence, sentenceEnd, yesNoAble, type Word } from '../../content';
import { hintAfter, recordTap } from '../../lib/adapt';
import { h, shuffle } from '../../lib/dom';
import { markKnown } from '../../lib/progress';
import { sfx } from '../../lib/sfx';
import { say } from '../../lib/tts';
import { confetti } from '../widgets';
import { actOut, pick, PRAISE, wordPicture, type LessonUI } from './shared';

type Round =
  | { kind: 'build'; word: Word; sentence: string; end: string }
  | { kind: 'yesno'; word: Word; sentence: string; truth: boolean };

const article = (x: string) => (/^[aeiou]/i.test(x) ? 'an' : 'a');

/**
 * Up to 3 rounds: build a sentence from word tiles (Bix says it first), and one
 * Starters-style "look and read — yes or no?" in the middle.
 */
export function sentenceRounds(words: Word[]): Round[] {
  const builds: Round[] = shuffle(words.filter(buildable)).slice(0, 2).map((w) => ({ kind: 'build', word: w, sentence: firstSentence(w), end: sentenceEnd(w) }));
  const yn = shuffle(words.filter(yesNoAble));
  const rounds = [...builds];
  if (yn.length >= 2) {
    const [shown, other] = yn;
    const truth = Math.random() < 0.5;
    const named = truth ? shown : other;
    rounds.splice(1, 0, { kind: 'yesno', word: shown, sentence: `This is ${article(named.text)} ${named.text}`, truth });
  }
  return rounds;
}

/** Step "sentence" (part 2, Starters). */
export async function runSentence(ui: LessonUI): Promise<void> {
  const rounds = sentenceRounds(ui.topic.words);
  if (!rounds.length) return;
  await ui.talk("Let's make sentences!", 'happy', 'Sentences! ✍️');
  for (const r of rounds) {
    if (r.kind === 'build') await build(ui, r);
    else await yesNo(ui, r);
    ui.tick();
  }
}

async function build(ui: LessonUI, r: Extract<Round, { kind: 'build' }>): Promise<void> {
  const tokens = r.sentence.split(/\s+/);
  let order = shuffle(tokens.map((t, i) => ({ t, i })));
  for (let k = 0; k < 5 && order.every((o, j) => o.t === tokens[j]); k++) order = shuffle(order); // never already in order
  const placed = h('div', { class: 'sb-line', 'aria-label': 'Sentence' }, tokens.map(() => h('span', { class: 'sb-gap' })), h('span', { class: 'sb-dot' }, r.end));
  const gaps = [...placed.querySelectorAll<HTMLElement>('.sb-gap')];
  const tiles = order.map((o) => h('button', { class: 'sb-tile pop', 'aria-label': o.t, lang: 'en' }, o.t));
  const pic = h('div', { class: 'read-pic sb-pic' }, wordPicture(r.word));
  const hear = h('button', { class: 'btn btn-round btn-sun btn-ear', 'aria-label': 'Listen' }, h('span', { class: 'icon-speaker' }));
  ui.stage.replaceChildren(
    h('div', { class: 'sentence-build', 'data-sentence': r.sentence }, h('div', { class: 'spell-top' }, pic, hear), placed, h('div', { class: 'sb-tiles' }, tiles)),
  );
  await ui.talk(`Listen. ${r.sentence}${r.end}`, 'idle', 'Listen and make it! 👂');
  let slips = 0;
  let here = 0;
  for (let i = 0; i < tokens.length; ) {
    const open = tiles.filter((t) => !t.classList.contains('is-used'));
    const tapped = await ui.tapAny<HTMLElement>([...open, hear]);
    if (tapped === hear) {
      sfx.tap();
      await say(`${r.sentence}${r.end}`);
      continue;
    }
    if (tapped.textContent === tokens[i]) {
      sfx.pop();
      tapped.classList.add('is-used');
      tiles.forEach((t) => t.classList.remove('is-hint'));
      gaps[i].textContent = tokens[i];
      gaps[i].classList.add('is-filled', 'pop');
      i++;
      here = 0;
      continue;
    }
    sfx.soft();
    slips++;
    here++;
    tapped.classList.remove('shake');
    void tapped.offsetWidth;
    tapped.classList.add('shake');
    if (here >= 2) open.find((t) => t.textContent === tokens[i])?.classList.add('is-hint');
  }
  ui.guard();
  sfx.success();
  confetti(document.body, 14);
  actOut(pic, r.word);
  recordTap(slips === 0);
  await ui.talk(`${r.sentence}${r.end} ${pick(PRAISE)}`, 'happy', '⭐');
  await ui.pause(300);
}

async function yesNo(ui: LessonUI, r: Extract<Round, { kind: 'yesno' }>): Promise<void> {
  const pic = h('div', { class: 'read-pic' }, wordPicture(r.word));
  const yes = h('button', { class: 'yn-btn yn-yes pop', 'aria-label': 'Yes', 'data-answer': 'yes' }, h('span', { 'aria-hidden': 'true' }, '👍'), 'Yes');
  const no = h('button', { class: 'yn-btn yn-no pop', 'aria-label': 'No', 'data-answer': 'no' }, h('span', { 'aria-hidden': 'true' }, '👎'), 'No');
  const hear = h('button', { class: 'btn btn-round btn-sun btn-ear', 'aria-label': 'Listen' }, h('span', { class: 'icon-speaker' }));
  ui.stage.replaceChildren(
    h(
      'div',
      { class: 'yesno', 'data-truth': String(r.truth) },
      pic,
      h('div', { class: 'yn-side' }, h('p', { class: 'yn-text', lang: 'en' }, `${r.sentence}.`), h('div', { class: 'yn-buttons' }, yes, no, hear)),
    ),
  );
  await ui.talk('Look and read. Yes or no?', 'idle', 'Yes or no? 🤔');
  const right = r.truth ? yes : no;
  let misses = 0;
  let heard = false;
  for (;;) {
    const tapped = await ui.tapAny<HTMLElement>([yes, no, hear]);
    if (tapped === hear) {
      sfx.tap();
      heard = true;
      await say(`${r.sentence}.`);
      continue;
    }
    if (tapped === right) break;
    sfx.soft();
    misses++;
    tapped.classList.remove('shake');
    void tapped.offsetWidth;
    tapped.classList.add('shake');
    if (misses >= hintAfter()) right.classList.add('is-hint');
    await ui.talk('Look again!', 'encourage');
  }
  sfx.success();
  right.classList.add('is-right');
  actOut(pic, r.word);
  const alone = misses === 0 && !heard;
  recordTap(alone);
  if (alone) markKnown(ui.topic.id, r.word.id);
  const text = r.word.text;
  await ui.talk(r.truth ? `Yes! This is ${article(text)} ${text}!` : `That's right! No! This is ${article(text)} ${text}!`, 'happy');
  await ui.pause(300);
}
