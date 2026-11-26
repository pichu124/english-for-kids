import { gappable } from '../../content';
import { hintAfter, recordTap } from '../../lib/adapt';
import { h, shuffle } from '../../lib/dom';
import { markKnown, noteSlip } from '../../lib/progress';
import { sfx } from '../../lib/sfx';
import { wordKey } from '../../lib/storage';
import { say } from '../../lib/tts';
import { confetti } from '../widgets';
import { pick, PRAISE, type LessonUI } from './shared';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Step "gap" (Movers): read a sentence with a missing word and choose it from three
 * words of the unit — no picture, so the sentence has to be understood.
 */
export async function runGap(ui: LessonUI): Promise<void> {
  const words = ui.topic.words;
  const rounds = shuffle(words.filter(gappable)).slice(0, 3);
  if (!rounds.length) return;
  await ui.talk('Read the sentence. Choose the missing word!', 'happy', 'Fill the gap! 🧩');
  for (const target of rounds) {
    const sentence = target.sentence;
    const re = new RegExp(`\\b${esc(target.text)}\\b`, 'i');
    const [before, after] = sentence.split(re);
    const others = shuffle(words.filter((w) => w.text !== target.text).map((w) => w.text).filter((t, i, a) => a.indexOf(t) === i)).slice(0, 2);
    const opts = shuffle([target.text, ...others]).map((t) => h('button', { class: 'read-choice gap-opt pop', 'data-word': t, 'aria-label': t, lang: 'en' }, t));
    const blank = h('span', { class: 'gap-blank' }, '?');
    const hear = h('button', { class: 'btn btn-round btn-sun btn-ear', 'aria-label': 'Listen' }, h('span', { class: 'icon-speaker' }));
    ui.stage.replaceChildren(
      h('div', { class: 'gap', 'data-answer': target.text }, h('p', { class: 'gap-sentence', lang: 'en' }, before, blank, after), h('div', { class: 'gap-opts' }, opts), hear),
    );
    let misses = 0;
    let heard = false;
    for (;;) {
      const tapped = await ui.tapAny<HTMLElement>([...opts, hear]);
      if (tapped === hear) {
        sfx.tap();
        heard = true;
        await say(sentence.replace(re, 'blank'));
        continue;
      }
      if (tapped.dataset.word === target.text) {
        sfx.success();
        tapped.classList.add('is-right');
        opts.forEach((o) => o !== tapped && o.classList.add('is-faded'));
        blank.textContent = target.text;
        blank.classList.add('is-filled', 'pop');
        confetti(document.body, 10);
        const alone = misses === 0 && !heard;
        recordTap(alone);
        if (alone) markKnown(ui.topic.id, target.id);
        if (misses) noteSlip(wordKey(ui.topic.id, target.id));
        await ui.talk(`${sentence} ${pick(PRAISE)}`, 'happy', '⭐');
        await ui.pause(300);
        break;
      }
      sfx.soft();
      misses++;
      tapped.classList.remove('shake');
      void tapped.offsetWidth;
      tapped.classList.add('shake');
      if (misses >= hintAfter()) opts.find((o) => o.dataset.word === target.text)?.classList.add('is-hint');
      await ui.talk('Read it again!', 'encourage', 'Read again! 👀');
    }
    ui.tick();
  }
}
