import type { Word } from '../../content';
import { h } from '../../lib/dom';
import { sfx } from '../../lib/sfx';
import { type LessonUI, wordCard } from './shared';

/** Step 1 — Listen: one big card at a time; Bix reads the word and a sentence. */
export async function runListen(ui: LessonUI): Promise<void> {
  await ui.talk(ui.topic.intro, 'talk');
  await ui.talk('Listen!', 'idle');

  for (const w of ui.topic.words) {
    const card = wordCard(w, { cls: 'word-card-xl pop', label: ui.level.showText });
    const next = h('button', { class: 'btn btn-round btn-good btn-next', 'aria-label': 'Next', hidden: true }, h('span', { class: 'icon-next' }));
    ui.stage.replaceChildren(h('div', { class: 'listen' }, card, next));

    await readWord(ui, w);
    next.hidden = false;
    next.classList.add('pop');

    // Tap the card to hear it again, tap the arrow to go on.
    for (;;) {
      const tapped = await ui.tapAny<HTMLElement>([card, next]);
      sfx.tap();
      if (tapped === next) break;
      card.classList.remove('wiggle');
      void card.offsetWidth;
      card.classList.add('wiggle');
      await readWord(ui, w);
    }
    ui.tick();
  }
}

async function readWord(ui: LessonUI, w: Word): Promise<void> {
  await ui.talk(`${w.text}.`, 'talk', ui.level.showText ? w.text : '🔊');
  await ui.pause(250);
  await ui.talk(w.sentence, 'idle');
}
