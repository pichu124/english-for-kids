import { h } from '../../lib/dom';
import { sfx } from '../../lib/sfx';
import { confetti } from '../widgets';
import { type LessonUI, PRAISE, pick } from './shared';

/**
 * Step "do-it" (Total Physical Response): Bix gives a command ("Clap your hands!"),
 * the child acts it out, then taps the big ✓. No microphone needed, and nothing
 * can be "wrong" — the point is moving and hearing the English at the same time.
 */
export async function runDoIt(ui: LessonUI): Promise<void> {
  await ui.talk("Stand up! Let's move! Watch me and do it too.", 'happy', "Let's move!");
  for (const a of ui.topic.actions) {
    const card = h('div', { class: 'doit-card pop', 'aria-hidden': 'true' }, a.emoji);
    const again = h('button', { class: 'btn btn-round btn-sun btn-ear', 'aria-label': 'Listen again' }, h('span', { class: 'icon-speaker' }));
    const did = h('button', { class: 'btn btn-good btn-did', 'aria-label': 'I did it' }, h('span', { class: 'did-check', 'aria-hidden': 'true' }, '✓'));
    did.hidden = true;
    ui.stage.replaceChildren(h('div', { class: 'doit' }, card, h('div', { class: 'doit-side' }, did, again)));

    card.classList.add('is-moving');
    await ui.talk(a.say, 'hello');
    await ui.pause(300);
    await ui.talk(a.say, 'happy');
    did.hidden = false;
    did.classList.add('pop');
    for (;;) {
      const t = await ui.tapAny<HTMLElement>([did, again]);
      if (t === did) break;
      sfx.tap();
      await ui.talk(a.say, 'happy');
    }
    card.classList.remove('is-moving');
    sfx.success();
    confetti(document.body, 12);
    await ui.talk(pick(PRAISE), 'happy');
    await ui.pause(300);
    ui.tick();
  }
}
