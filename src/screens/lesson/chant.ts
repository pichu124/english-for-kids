import { h } from '../../lib/dom';
import { sfx } from '../../lib/sfx';
import { say } from '../../lib/tts';
import { confetti } from '../widgets';
import { musicMode, playTune, type Player } from '../../lib/music';
import { tuneFor } from '../../lib/tunes';
import type { LessonUI } from './shared';

/**
 * Step "chant": a short rhythmic rhyme. Round 1 Bix chants it on a drum beat
 * while the child listens and claps; round 2 "Say it with me!" — the child joins in.
 * The current line is highlighted (pre-readers see its picture instead of text).
 */
export async function runChant(ui: LessonUI): Promise<void> {
  const c = ui.topic.chant;
  if (!c) return;
  const rows = c.lines.map((l) =>
    h(
      'div',
      { class: 'chant-line' },
      l.emoji ? h('span', { class: 'chant-emoji', 'aria-hidden': 'true' }, l.emoji) : null,
      ui.level.showText || !l.emoji ? h('span', { class: 'chant-text' }, l.text) : null,
    ),
  );
  const drum = h('div', { class: 'chant-drum', 'aria-hidden': 'true' }, '🥁');
  const done = h('button', { class: 'btn btn-good btn-chant-done', 'aria-label': 'Done', hidden: true }, h('span', { class: 'did-check' }, '✓'));
  ui.stage.replaceChildren(h('div', { class: 'chant' }, h('div', { class: 'chant-head' }, drum, h('h2', { class: 'chant-title' }, c.title)), h('div', { class: 'chant-lines' }, rows), done));

  const hit = () => {
    drum.classList.remove('hit');
    void drum.offsetWidth;
    drum.classList.add('hit');
  };
  // With music on, a public-domain tune plays underneath and the drum follows its beat;
  // otherwise a plain drum beat as before.
  const tune = musicMode() !== 'off' ? tuneFor(ui.topic.id, c.tune) : null;
  const beatMs = tune ? (60 / tune.bpm) * tune.beatEvery * 1000 : 380;
  let player: Player | null = null;
  ui.ctx.onCleanup(() => player?.stop());
  const beat = async (n: number) => {
    for (let i = 0; i < n; i++) {
      if (!player) {
        sfx.pop();
        hit();
      }
      await ui.pause(beatMs);
    }
  };

  for (const round of [1, 2]) {
    await ui.talk(round === 1 ? "Listen and clap! Let's chant!" : 'Now say it with me!', 'happy', round === 1 ? 'Listen and clap! 👏' : 'Say it with me! 🎤');
    if (tune) {
      player = playTune(tune, { vol: 0.32, onBeat: hit });
      drum.title = tune.name;
    }
    await beat(4);
    for (const [i, line] of c.lines.entries()) {
      rows.forEach((r, j) => r.classList.toggle('is-on', j === i));
      ui.bix.setMood('talk');
      ui.bix.show(line.text);
      await say(line.text, { rate: 0.85 });
      ui.guard();
      if (round === 2) await ui.pause(900); // room for the child to echo the line
      await beat(2);
      ui.tick();
    }
    rows.forEach((r) => r.classList.remove('is-on'));
    player?.stop();
    player = null;
  }
  ui.bix.setMood('happy');
  sfx.success();
  confetti(document.body, 16);
  await ui.talk('Great chanting!', 'happy');
  done.hidden = false;
  done.classList.add('pop');
  await ui.tap(done);
  sfx.tap();
}
