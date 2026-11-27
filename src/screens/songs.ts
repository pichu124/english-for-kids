import { Bix } from '../art/bix';
import { LEVELS, topicById, topicsOfLevel, type Topic } from '../content';
import { h, wait } from '../lib/dom';
import { currentLevel } from '../lib/level';
import { musicMode, playTune, setBackground, type Player } from '../lib/music';
import { sfx } from '../lib/sfx';
import { getState, update } from '../lib/storage';
import { say, stopSpeaking } from '../lib/tts';
import { tuneFor } from '../lib/tunes';
import type { Ctx } from '../router';
import { homeButton } from './widgets';

/**
 * Songs: every chant of the lessons the child has done, in one place, to sing again
 * (with the lesson's tune when music is on). Chants of lessons not done yet show a lock:
 * finishing the lesson unlocks its song.
 */
export function songList(levelId = currentLevel().id): { topic: Topic; open: boolean }[] {
  const lv = LEVELS.findIndex((l) => l.id === levelId);
  const s = getState();
  return LEVELS.slice(0, lv + 1)
    .flatMap((l) => topicsOfLevel(l.id))
    .filter((t) => t.chant?.lines.length)
    .map((t) => ({ topic: t, open: (s.topics[t.id]?.completed ?? 0) > 0 }))
    // songs to sing first, then the locked ones of this level, then the earlier levels'
    .sort((a, b) => Number(b.open) - Number(a.open) || Number(b.topic.level === levelId) - Number(a.topic.level === levelId));
}

export function songsScreen(ctx: Ctx): HTMLElement {
  const id = ctx.params.song;
  const t = id ? topicById(id) : undefined;
  if (t?.chant) return player(ctx, t);
  const bix = new Bix({ size: 'sm', bubble: false }).setMood('happy');
  const list = songList();
  const open = list.filter((x) => x.open).length;
  const hint = h('div', { class: 'song-hint', 'aria-live': 'polite' });
  let hintTimer = 0;
  const showHint = (text: string) => {
    hint.textContent = text;
    hint.classList.add('is-on');
    clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => hint.classList.remove('is-on'), 2600);
  };
  ctx.onCleanup(() => clearTimeout(hintTimer));
  const level = currentLevel().id;
  // locked songs of earlier levels wait behind one button (no wall of locks)
  const later = list.filter((x) => !x.open && x.topic.level !== level);
  const tiles = list.map(({ topic, open }) =>
    h(
      'button',
      {
        class: `song-tile ${open ? '' : 'is-locked'}`,
        'data-song': topic.id,
        'aria-label': topic.chant!.title,
        style: `--c:${topic.color}`,
        onclick: () => {
          sfx.tap();
          if (open) return ctx.go('games', { game: 'songs', song: topic.id });
          showHint(`🔒 ${topic.icon} ${topic.title}`);
          void bix.talk(`Finish ${topic.title} to sing this song!`, 'encourage', `🔒 ${topic.icon}`);
        },
      },
      h('span', { class: 'song-icon', 'aria-hidden': 'true' }, open ? topic.icon : '🔒'),
      h('span', { class: 'song-name', lang: 'en' }, topic.chant!.title),
    ),
  );
  setTimeout(() => ctx.alive() && void bix.talk(open ? 'Pick a song! Let’s sing!' : 'Finish a lesson to get its song!', 'happy', open ? '🎵 Pick a song!' : '🎵'), 300);
  const back = h('button', { class: 'btn btn-round btn-sun', 'aria-label': 'Games', onclick: () => (sfx.tap(), ctx.go('games')) }, '🎮');
  return h(
    'main',
    { class: 'game songs' },
    h('header', { class: 'book-top' }, homeButton(ctx), back, h('h1', { class: 'world-title' }, 'Songs'), h('div', { class: 'book-count' }, `🎵 ${open}/${list.length}`), h('div', { class: 'game-bix' }, bix.el)),
    h('div', { class: 'songs-grid' }, ...tiles.map((t, i) => (later.includes(list[i]) ? (t.classList.add('is-later'), t) : t)), later.length ? h('button', { class: 'song-tile song-more', 'aria-label': 'More songs', onclick: (e: Event) => (sfx.tap(), (e.currentTarget as HTMLElement).closest('.songs-grid')?.classList.add('show-all'), (e.currentTarget as HTMLElement).remove()) }, h('span', { class: 'song-icon', 'aria-hidden': 'true' }, '🔒'), h('span', { class: 'song-name' }, `+${later.length}`)) : null),
    hint,
  );
}

function player(ctx: Ctx, t: Topic): HTMLElement {
  const c = t.chant!;
  const bix = new Bix({ size: 'md' }).setMood('happy');
  const rows = c.lines.map((l) => h('div', { class: 'chant-line' }, l.emoji ? h('span', { class: 'chant-emoji', 'aria-hidden': 'true' }, l.emoji) : null, h('span', { class: 'chant-text', lang: 'en' }, l.text)));
  const drum = h('div', { class: 'chant-drum', 'aria-hidden': 'true' }, '🥁');
  const again = h('button', { class: 'btn btn-sun', 'aria-label': 'Sing again', hidden: true }, '🔁 Again');
  const toList = h('button', { class: 'btn btn-good', 'aria-label': 'Songs', hidden: true, onclick: () => (sfx.tap(), ctx.go('games', { game: 'songs' })) }, '🎵 Songs');
  let player: Player | null = null;
  ctx.onCleanup(() => {
    player?.stop();
    stopSpeaking();
  });
  const hit = () => {
    drum.classList.remove('hit');
    void drum.offsetWidth;
    drum.classList.add('hit');
  };
  const sing = async () => {
    again.hidden = true;
    toList.hidden = true;
    const tune = musicMode() !== 'off' ? tuneFor(t.id, c.tune) : null;
    const beatMs = tune ? (60 / tune.bpm) * tune.beatEvery * 1000 : 380;
    const beat = async (n: number) => {
      for (let i = 0; i < n && ctx.alive(); i++) {
        if (!player) {
          sfx.pop();
          hit();
        }
        await wait(beatMs);
      }
    };
    // the quiet background music (Games screens) stops while a song plays
    setBackground(false);
    if (tune) player = playTune(tune, { vol: 0.32, onBeat: hit });
    await beat(4);
    for (const [i, line] of c.lines.entries()) {
      if (!ctx.alive()) return;
      rows.forEach((r, j) => r.classList.toggle('is-on', j === i));
      rows[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' }); // small phones: the line being sung stays in view
      bix.setMood('talk');
      bix.show(line.text);
      await say(line.text, { rate: 0.85 });
      await beat(2);
    }
    player?.stop();
    player = null;
    if (!ctx.alive()) return;
    rows.forEach((r) => r.classList.remove('is-on'));
    bix.setMood('happy');
    sfx.success();
    update((s) => (s.gamesPlayed = { ...(s.gamesPlayed ?? {}), songs: (s.gamesPlayed?.songs ?? 0) + 1 }));
    await bix.talk('Lovely singing!', 'happy', '🎵 Lovely!');
    again.hidden = false;
    toList.hidden = false;
  };
  again.addEventListener('click', () => (sfx.tap(), void sing()));
  setTimeout(() => ctx.alive() && void sing(), 400);
  const back = h('button', { class: 'btn btn-round btn-sun', 'aria-label': 'Songs', onclick: () => (sfx.tap(), ctx.go('games', { game: 'songs' })) }, '🎵');
  return h(
    'main',
    { class: 'game song-play', 'data-song': t.id },
    h('header', { class: 'book-top' }, homeButton(ctx), back, h('h1', { class: 'world-title', lang: 'en' }, c.title)),
    h('div', { class: 'song-body' }, h('div', { class: 'song-bix' }, bix.el), h('div', { class: 'chant song-chant' }, h('div', { class: 'chant-head' }, drum, h('h2', { class: 'chant-title' }, `${t.icon} ${c.title}`)), h('div', { class: 'chant-lines' }, rows), h('div', { class: 'reward-actions' }, again, toList))),
  );
}
