import type { Word } from '../../content';
import { choicesFor, hintAfter, recordTap } from '../../lib/adapt';
import { h, shuffle } from '../../lib/dom';
import { markKnown, noteSlip } from '../../lib/progress';
import { wordKey } from '../../lib/storage';
import { sfx } from '../../lib/sfx';
import { say } from '../../lib/tts';
import { confetti } from '../widgets';
import { actOut, pick, PRAISE, wordPicture, type LessonUI } from './shared';

export const READ_ROUNDS = 4;
export const readRounds = (words: Word[]) => Math.min(READ_ROUNDS, words.length);

/**
 * Step "read": a picture, and written words to choose from — real reading, no sound.
 * Stuck? The 🔊 button says the word (that round then doesn't count as read alone).
 */
export async function runRead(ui: LessonUI): Promise<void> {
  const words = ui.topic.words;
  const rounds = shuffle(words).slice(0, readRounds(words));
  await ui.talk("Let's read! Look at the picture. Find the word!", 'happy', 'Read and find! 📖');

  for (const target of rounds) {
    const n = choicesFor(ui.level, words.length);
    const others = shuffle(words.filter((w) => w.id !== target.id && w.text !== target.text)).slice(0, n - 1);
    const choices = shuffle([target, ...others]).map((w) =>
      h('button', { class: `read-choice pop ${w.text.length > 7 ? 'is-long' : ''}`, 'data-word': w.text, 'aria-label': w.text, lang: 'en' }, w.text),
    );
    const pic = h('div', { class: 'read-pic' }, wordPicture(target));
    const hear = h('button', { class: 'btn btn-round btn-sun btn-ear', 'aria-label': 'Listen' }, h('span', { class: 'icon-speaker' }));
    ui.stage.replaceChildren(
      h('div', { class: 'read', 'data-answer': target.text }, pic, h('div', { class: 'read-side' }, h('div', { class: 'read-choices' }, choices), hear)),
    );
    let misses = 0;
    let heard = false;
    for (;;) {
      const tapped = await ui.tapAny<HTMLElement>([...choices, hear]);
      if (tapped === hear) {
        sfx.tap();
        heard = true;
        await say(target.text);
        continue;
      }
      if (tapped.dataset.word === target.text) {
        sfx.success();
        tapped.classList.add('is-right');
        choices.forEach((c) => c !== tapped && c.classList.add('is-faded'));
        actOut(pic, target);
        confetti(document.body, 10);
        const alone = misses === 0 && !heard;
        if (alone) markKnown(ui.topic.id, target.id);
        if (misses > 0) noteSlip(wordKey(ui.topic.id, target.id));
        recordTap(alone);
        await ui.talk(`${pick(PRAISE)} ${target.text}!`, 'happy');
        await ui.pause(300);
        break;
      }
      sfx.soft();
      misses++;
      tapped.classList.remove('shake');
      void tapped.offsetWidth;
      tapped.classList.add('shake');
      if (misses >= hintAfter()) choices.find((c) => c.dataset.word === target.text)?.classList.add('is-hint');
      await ui.talk('Try again!', 'encourage');
    }
    ui.tick();
  }
}
