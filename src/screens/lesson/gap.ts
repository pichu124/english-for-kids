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
  // Hand-written sentences when the unit has them, else the words' own example sentences.
  type Round = { sentence: string; answer: string; options: string[]; word?: (typeof words)[number] };
  const rounds: Round[] = ui.topic.gaps?.length
    ? shuffle(ui.topic.gaps).slice(0, 3).map((g) => ({ sentence: g.s, answer: g.answer, options: g.options, word: words.find((w) => w.text === g.answer) }))
    : shuffle(words.filter(gappable)).slice(0, 3).map((w) => ({
        sentence: w.sentence.replace(new RegExp(`\\b${esc(w.text)}\\b`, 'i'), '___'),
        answer: w.text,
        options: shuffle(words.filter((x) => x.text !== w.text).map((x) => x.text).filter((t, i, a) => a.indexOf(t) === i)).slice(0, 2),
        word: w,
      }));
  if (!rounds.length) return;
  await ui.talk('Read the sentence. Choose the missing word!', 'happy', 'Fill the gap! 🧩');
  for (const r of rounds) {
    const [before, after] = r.sentence.split('___');
    const full = `${before}${r.answer}${after}`;
    const opts = shuffle([r.answer, ...r.options]).map((t) => h('button', { class: 'read-choice gap-opt pop', 'data-word': t, 'aria-label': t, lang: 'en' }, t));
    const blank = h('span', { class: 'gap-blank' }, '?');
    const hear = h('button', { class: 'btn btn-round btn-sun btn-ear', 'aria-label': 'Listen' }, h('span', { class: 'icon-speaker' }));
    ui.stage.replaceChildren(
      h('div', { class: 'gap', 'data-answer': r.answer }, h('p', { class: 'gap-sentence', lang: 'en' }, before, blank, after), h('div', { class: 'gap-opts' }, opts), hear),
    );
    let misses = 0;
    let heard = false;
    for (;;) {
      const tapped = await ui.tapAny<HTMLElement>([...opts, hear]);
      if (tapped === hear) {
        sfx.tap();
        heard = true;
        await say(`${before} blank ${after}`);
        continue;
      }
      if (tapped.dataset.word === r.answer) {
        sfx.success();
        tapped.classList.add('is-right');
        opts.forEach((o) => o !== tapped && o.classList.add('is-faded'));
        blank.textContent = r.answer;
        blank.classList.add('is-filled', 'pop');
        confetti(document.body, 10);
        const alone = misses === 0 && !heard;
        recordTap(alone);
        if (alone && r.word) markKnown(ui.topic.id, r.word.id);
        if (misses && r.word) noteSlip(wordKey(ui.topic.id, r.word.id));
        await ui.talk(`${full} ${pick(PRAISE)}`, 'happy', '⭐');
        await ui.pause(300);
        break;
      }
      sfx.soft();
      misses++;
      tapped.classList.remove('shake');
      void tapped.offsetWidth;
      tapped.classList.add('shake');
      if (misses >= hintAfter()) opts.find((o) => o.dataset.word === r.answer)?.classList.add('is-hint');
      await ui.talk('Read it again!', 'encourage', 'Read again! 👀');
    }
    ui.tick();
  }
}
