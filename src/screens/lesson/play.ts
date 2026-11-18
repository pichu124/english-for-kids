import { playPromptFor, type Word } from '../../content';
import { h, shuffle } from '../../lib/dom';
import { sfx } from '../../lib/sfx';
import { confetti } from '../widgets';
import { type LessonUI, PRAISE, pick, wordCard } from './shared';


/** Step 3 — Play: Bix says a word, the child taps the right picture. */
export async function runPlay(ui: LessonUI): Promise<void> {
  await ui.talk("Let's play a game! Listen and touch.", 'happy', "Let's play!");

  const words = ui.topic.words;
  const PLAY_ROUNDS = ui.level.playRounds;
  // Each word once (repeat if a topic has fewer than 6 words).
  let order: Word[] = [];
  while (order.length < PLAY_ROUNDS) order = order.concat(shuffle(words));
  order = order.slice(0, PLAY_ROUNDS);
  const nOptions = Math.min(ui.level.choices, words.length);

  for (let round = 0; round < PLAY_ROUNDS; round++) {
    const target = order[round];
    const others = shuffle(words.filter((w) => w.id !== target.id)).slice(0, nOptions - 1);
    const options = shuffle([target, ...others]);
    const cards = options.map((w) => {
      const c = wordCard(w, { label: false, cls: 'word-card-play pop' });
      c.dataset.id = w.id;
      return c;
    });
    const again = h('button', { class: 'btn btn-round btn-sun btn-ear', 'aria-label': 'Listen again' }, h('span', { class: 'icon-speaker' }));
    const stars = h('div', { class: 'play-stars', 'aria-hidden': 'true' }, Array.from({ length: PLAY_ROUNDS }, (_, i) => h('span', { class: i < round ? 'on' : '' }, '★')));
    ui.stage.replaceChildren(h('div', { class: 'play' }, h('div', { class: 'play-cards' }, cards), h('div', { class: 'play-side' }, again, stars)));

    const prompt = playPromptFor(ui.topic, target);
    await ui.talk(prompt, 'idle');
    let misses = 0;
    for (;;) {
      const tapped = await ui.tapAny<HTMLElement>([...cards, again]);
      if (tapped === again) {
        sfx.tap();
        await ui.talk(prompt, 'idle');
        continue;
      }
      if (tapped.dataset.id === target.id) {
        sfx.success();
        tapped.classList.add('is-right');
        cards.forEach((c) => c !== tapped && c.classList.add('is-faded'));
        stars.children[round]?.classList.add('on');
        confetti(document.body, 14);
        await ui.talk(`${pick(PRAISE)} ${target.text}!`, 'happy');
        await ui.pause(500);
        break;
      }
      // Not this one — gentle wobble, no "wrong".
      sfx.soft();
      misses++;
      tapped.classList.remove('shake');
      void tapped.offsetWidth;
      tapped.classList.add('shake');
      if (misses >= 2) cards.find((c) => c.dataset.id === target.id)?.classList.add('is-hint');
      await ui.talk(`Try again! ${prompt}`, 'encourage', 'Try again!');
    }
    ui.tick();
  }
}
