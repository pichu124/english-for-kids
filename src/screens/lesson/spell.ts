import { spellable, type Word } from '../../content';
import { h, shuffle } from '../../lib/dom';
import { markSpelled, noteSlip } from '../../lib/progress';
import { wordKey } from '../../lib/storage';
import { sfx } from '../../lib/sfx';
import { say } from '../../lib/tts';
import { letterName, spellOut } from '../../lib/letters';
import { confetti } from '../widgets';
import { actOut, pick, PRAISE, wordPicture, type LessonUI } from './shared';

export const SPELL_WORDS = 3;
const EXTRA = 'aeiou' + 'bcdfghlmnprst';

/** The (up to 3) words to spell: short single words first, so it starts easy. */
export function spellWords(words: Word[]): Word[] {
  const ok = words.filter((w) => spellable(w));
  return shuffle(ok)
    .sort((a, b) => a.text.length - b.text.length)
    .slice(0, SPELL_WORDS);
}

/**
 * Step "spell": a picture, empty boxes, letter tiles. The child taps the letters in
 * order; Bix names each letter. A wrong tile just wiggles; after two slips the right
 * one glows. Two extra letters make it a little puzzle (none for very short words).
 */
export async function runSpell(ui: LessonUI): Promise<void> {
  const list = spellWords(ui.topic.words);
  if (!list.length) return;
  await ui.talk("Let's spell! Tap the letters.", 'happy', 'Spell it! 🔤');

  for (const target of list) {
    const word = target.text.toLowerCase();
    const letters = word.split('');
    const extras = shuffle(EXTRA.split('').filter((c) => !word.includes(c))).slice(0, word.length <= 3 ? 1 : 2);
    const slots = letters.map(() => h('span', { class: 'spell-slot' }));
    const tiles = shuffle([...letters, ...extras]).map((c) => h('button', { class: 'spell-tile pop', 'aria-label': c, lang: 'en' }, c));
    const pic = h('div', { class: 'read-pic spell-pic' }, wordPicture(target));
    const hear = h('button', { class: 'btn btn-round btn-sun btn-ear', 'aria-label': 'Listen' }, h('span', { class: 'icon-speaker' }));
    ui.stage.replaceChildren(
      h(
        'div',
        { class: 'spell', 'data-word': word },
        h('div', { class: 'spell-top' }, pic, hear),
        h('div', { class: 'spell-slots', 'aria-label': 'Word' }, slots),
        h('div', { class: 'spell-tiles' }, tiles),
      ),
    );
    await ui.talk(target.text, 'idle');

    let slips = 0;
    let missesHere = 0;
    for (let i = 0; i < letters.length; ) {
      const open = tiles.filter((t) => !t.classList.contains('is-used'));
      const tapped = await ui.tapAny<HTMLElement>([...open, hear]);
      if (tapped === hear) {
        sfx.tap();
        await say(target.text);
        continue;
      }
      if (tapped.textContent === letters[i]) {
        sfx.pop();
        tapped.classList.add('is-used');
        tiles.forEach((t) => t.classList.remove('is-hint'));
        slots[i].textContent = letters[i];
        slots[i].classList.add('is-filled', 'pop');
        void say(letterName(letters[i]));
        i++;
        missesHere = 0;
        continue;
      }
      sfx.soft();
      slips++;
      missesHere++;
      tapped.classList.remove('shake');
      void tapped.offsetWidth;
      tapped.classList.add('shake');
      if (missesHere >= 2) open.find((t) => t.textContent === letters[i])?.classList.add('is-hint');
    }
    ui.guard();
    sfx.success();
    confetti(document.body, 14);
    actOut(pic, target);
    if (slips === 0) markSpelled(ui.topic.id, target.id);
    else noteSlip(wordKey(ui.topic.id, target.id));
    await ui.pause(250);
    await ui.talk(`${spellOut(word)}. ${target.text}! ${pick(PRAISE)}`, 'happy', `${target.text}! ⭐`);
    await ui.pause(300);
    ui.tick();
  }
}
