import { writable, type Word } from '../../content';
import { recordTap } from '../../lib/adapt';
import { h, shuffle } from '../../lib/dom';
import { letterName } from '../../lib/letters';
import { markSpelled, noteSlip } from '../../lib/progress';
import { sfx } from '../../lib/sfx';
import { wordKey } from '../../lib/storage';
import { say } from '../../lib/tts';
import { confetti } from '../widgets';
import { actOut, pick, PRAISE, wordPicture, type LessonUI } from './shared';

export const WRITE_WORDS = 3;
export const writeWords = (words: Word[]) => shuffle(words.filter(writable)).slice(0, WRITE_WORDS);
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

/**
 * Step "write" (Movers): look at the picture and type the word on a big a–z keyboard —
 * no letters given. A wrong letter is not typed; it wiggles. After two slips at the
 * same place the right key glows. 🔊 says the word.
 */
export async function runWrite(ui: LessonUI): Promise<void> {
  const list = writeWords(ui.topic.words);
  if (!list.length) return;
  await ui.talk("Let's write! Look and type the word.", 'happy', 'Write it! ⌨️');
  for (const target of list) {
    const word = target.text.toLowerCase();
    const boxes = word.split('').map(() => h('span', { class: 'spell-slot wr-box' }));
    const allKeys = LETTERS.map((c) => h('button', { class: 'wr-key', 'data-key': c, 'aria-label': c, lang: 'en' }, c));
    const pic = h('div', { class: 'read-pic spell-pic' }, wordPicture(target));
    const hear = h('button', { class: 'btn btn-round btn-sun btn-ear', 'aria-label': 'Listen' }, h('span', { class: 'icon-speaker' }));
    ui.stage.replaceChildren(
      h('div', { class: 'write', 'data-word': word }, h('div', { class: 'spell-top' }, pic, hear), h('div', { class: 'spell-slots' }, boxes), h('div', { class: 'wr-keys' }, allKeys)),
    );
    let slips = 0;
    let here = 0;
    for (let i = 0; i < word.length; ) {
      const tapped = await ui.tapAny<HTMLElement>([...allKeys, hear]);
      if (tapped === hear) {
        sfx.tap();
        await say(target.text);
        continue;
      }
      const c = tapped.dataset.key!;
      if (c === word[i]) {
        sfx.pop();
        allKeys.forEach((k) => k.classList.remove('is-hint'));
        boxes[i].textContent = c;
        boxes[i].classList.add('is-filled', 'pop');
        void say(letterName(c));
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
      if (here >= 2) allKeys.find((k) => k.dataset.key === word[i])?.classList.add('is-hint');
    }
    ui.guard();
    sfx.success();
    confetti(document.body, 14);
    actOut(pic, target);
    recordTap(slips === 0);
    if (slips === 0) markSpelled(ui.topic.id, target.id);
    else noteSlip(wordKey(ui.topic.id, target.id));
    await ui.talk(`${target.text}! ${pick(PRAISE)}`, 'happy', `${target.text}! ⭐`);
    await ui.pause(300);
    ui.tick();
  }
}
