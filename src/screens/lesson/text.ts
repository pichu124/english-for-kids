import { recordTap } from '../../lib/adapt';
import { h } from '../../lib/dom';
import { sfx } from '../../lib/sfx';
import { say } from '../../lib/tts';
import { confetti } from '../widgets';
import { pick, PRAISE, type LessonUI } from './shared';

/**
 * Step "text" (Movers): a short text to read (Bix reads it if asked, line by line),
 * then a few questions with written answers. A slip just wiggles; the text stays visible.
 */
export async function runText(ui: LessonUI): Promise<void> {
  const t = ui.topic.text;
  if (!t) return;
  const lines = t.lines.map((l) => h('p', { class: 'tx-line', lang: 'en' }, l));
  const hear = h('button', { class: 'btn btn-round btn-sun btn-ear', 'aria-label': 'Read to me' }, h('span', { class: 'icon-speaker' }));
  const qbox = h('div', { class: 'tx-q' });
  ui.stage.replaceChildren(h('div', { class: 'text-read' }, h('article', { class: 'tx-card' }, h('h3', { class: 'tx-title' }, t.title), lines, hear), qbox));
  // One reading at a time: a second tap is ignored, and an answer tap stops the reading
  // (both share the one speech voice, so they would cut each other off).
  let reading = 0;
  const stopReading = () => {
    reading = 0;
    lines.forEach((p) => p.classList.remove('is-now'));
  };
  hear.addEventListener('click', async () => {
    if (reading) return;
    sfx.tap();
    const me = (reading = Date.now());
    for (const [i, l] of t.lines.entries()) {
      if (!ui.ctx.alive() || reading !== me) return;
      lines.forEach((p, j) => p.classList.toggle('is-now', j === i));
      await say(l);
    }
    if (reading === me) stopReading();
  });
  await ui.talk("Let's read a story. Then answer the questions!", 'happy', 'Read and answer! 📃');
  for (const q of t.questions) {
    const opts = q.options.map((o, k) => h('button', { class: 'read-choice tx-opt pop', 'data-k': String(k), 'aria-label': o, lang: 'en' }, o));
    qbox.replaceChildren(h('p', { class: 'tx-ask', lang: 'en', 'data-answer': String(q.answer) }, q.q), h('div', { class: 'tx-opts' }, opts));
    void say(q.q);
    let misses = 0;
    for (;;) {
      const tapped = await ui.tapAny<HTMLElement>(opts);
      stopReading();
      if (Number(tapped.dataset.k) === q.answer) {
        sfx.success();
        tapped.classList.add('is-right');
        opts.forEach((o) => o !== tapped && o.classList.add('is-faded'));
        recordTap(misses === 0);
        confetti(document.body, 10);
        await ui.talk(pick(PRAISE), 'happy');
        break;
      }
      sfx.soft();
      misses++;
      tapped.classList.remove('shake');
      void tapped.offsetWidth;
      tapped.classList.add('shake');
      if (misses >= 2) opts[q.answer].classList.add('is-hint');
      await ui.talk('Look at the story again!', 'encourage', 'Look again! 👀');
    }
    ui.tick();
  }
}
