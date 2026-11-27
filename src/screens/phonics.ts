import { Bix } from '../art/bix';
import data from '../../content/phonics.json';
import { h, shuffle } from '../lib/dom';
import { fixEmoji } from '../lib/emoji';
import { readScore, tokenHits, wordHits } from '../lib/readcheck';
import { sfx } from '../lib/sfx';
import { dayLog, getState, update } from '../lib/storage';
import { say } from '../lib/tts';
import { limitReached } from '../lib/usage';
import type { Ctx } from '../router';
import { pick, PRAISE } from './lesson/shared';
import { micTurn } from './mic';
import { confetti, homeButton } from './widgets';
import { todayRunning } from '../lib/today';
import { todayNextButton } from './today';
import { phonicsAllDone } from './certificate';

/**
 * Phonics: letter SOUNDS (not names) and blending them into words — how children learn to
 * read on their own. Five sets in the usual order (s a t p i n, then c k e h r m d…).
 * Each set: meet the sounds → find the sound → blend (hear c-a-t, pick the picture) →
 * build the word from sound tiles → read a tiny book made only of sounds already taught.
 */
type Sound = { s: string; say: string; word: string; emoji: string };
type BlendWord = { w: string; parts: string[]; emoji: string };
type PhonicsSet = { id: string; title: string; color: string; sounds: Sound[]; words: BlendWord[]; reader: { title: string; pages: { text: string; emoji: string }[] }; /** tricky words to know by sight (no blending) */ tricky?: boolean };
const SETS = data.sets as PhonicsSet[];
const TRICKY = new Set(data.tricky);
const SAY: Record<string, string> = Object.fromEntries(SETS.flatMap((st) => st.sounds.map((x) => [x.s, x.say])));
const taughtUpTo = (i: number) => SETS.slice(0, i + 1).filter((st) => !st.tricky).flatMap((st) => st.sounds);
const wordsUpTo = (i: number) => SETS.slice(0, i + 1).flatMap((st) => st.words);

export function phonicsScreen(ctx: Ctx): HTMLElement {
  if (limitReached()) {
    queueMicrotask(() => ctx.go('rest'));
    return h('main');
  }
  const i = SETS.findIndex((st) => st.id === ctx.params.set);
  return i >= 0 ? lesson(ctx, i) : menu(ctx);
}

function menu(ctx: Ctx): HTMLElement {
  const done = getState().phonics ?? {};
  const halfway = getState().phonicsStep ?? {};
  const next = SETS.findIndex((st) => !done[st.id]);
  const bix = new Bix({ size: 'md' }).setMood('hello');
  const cards = SETS.map((st, i) =>
    h(
      'button',
      { class: `ph-set ${i === next ? 'is-next' : ''}`, 'data-set': st.id, 'aria-label': st.title, style: `--c:${st.color}`, onclick: () => (sfx.tap(), ctx.go('phonics', { set: st.id })) },
      // tricky words: the first few only (the whole list does not fit on a card)
      h('span', { class: `ph-set-letters ${st.sounds.map((x) => x.s).join(' ').length > 11 && !st.tricky ? 'is-long' : ''}`, lang: 'en' }, st.tricky ? `${st.sounds.slice(0, 3).map((x) => x.s).join(' ')}…` : st.sounds.map((x) => x.s).join(' ')),
      h('span', { class: 'ph-set-title' }, st.title),
      done[st.id] ? h('span', { class: 'ph-set-star', 'aria-hidden': 'true' }, '⭐') : null,
      // left halfway: how far the child got (4 steps after meeting the sounds)
      halfway[st.id] ? h('span', { class: 'ph-set-prog', 'aria-hidden': 'true', style: `--p:${halfway[st.id] / 5}` }) : null,
    ),
  );
  // every set done: the "Sounds Star" certificate
  const cert = phonicsAllDone() ? h('button', { class: 'btn btn-sun ph-cert', 'aria-label': 'Certificate', onclick: () => (sfx.tap(), ctx.go('certificate', { kind: 'phonics', from: 'phonics' })) }, '🏆') : null;
  setTimeout(() => ctx.alive() && void bix.talk("Let's learn the sounds of the letters!", 'happy', 'Sounds! 🔊'), 300);
  return h(
    'main',
    { class: 'phonics' },
    h('header', { class: 'book-top' }, homeButton(ctx), h('button', { class: 'btn btn-round btn-sun', 'aria-label': 'ABC', onclick: () => (sfx.tap(), ctx.go('abc')) }, '🔤'), h('h1', { class: 'world-title' }, 'Sounds'), cert),
    h('div', { class: 'ph-menu' }, h('div', { class: 'ph-bix' }, bix.el), h('div', { class: 'ph-sets' }, cards)),
    h('p', { class: 'ph-parent-tip', lang: 'vi' }, 'Bố mẹ: đọc ÂM của chữ, không đọc tên chữ (t là “t” rất ngắn, không phải “tê” hay “tờ”). Giọng máy chỉ đọc gần đúng, nên bố mẹ đọc mẫu cho bé nghe thì tốt nhất.'),
  );
}

/** A letter sound card: tap it to hear the sound. */
/** A letter-sound tile; `silent` tiles are answer choices (the tap is the answer, not a sound). */
const soundTile = (s: string, cls = '', silent = false) => h('button', { class: `ph-tile ${cls}`, 'data-sound': s, 'aria-label': s, lang: 'en', onclick: silent ? null : () => void say(SAY[s] ?? s) }, s);

function lesson(ctx: Ctx, idx: number): HTMLElement {
  const set = SETS[idx];
  const bix = new Bix({ size: 'sm', bubble: false }).setMood('idle');
  const stage = h('section', { class: 'ph-stage' });
  const STEPS = ['🔊', '🎯', '🧩', '🔤', '📖'];
  const dots = h('div', { class: 'ph-dots', 'aria-hidden': 'true' }, STEPS.map((s) => h('span', {}, s)));
  const back = h('button', { class: 'btn btn-round btn-sun', 'aria-label': 'Sounds', onclick: () => (sfx.tap(), ctx.go('phonics')) }, '🔊');
  const el = h(
    'main',
    { class: 'phonics ph-lesson', style: `--c:${set.color}` },
    h('header', { class: 'book-top' }, homeButton(ctx), back, h('h1', { class: 'world-title' }, set.title), dots, h('div', { class: 'game-bix' }, bix.el)),
    stage,
  );
  // a set left halfway starts again at the step the child had reached (1 find … 4 read)
  const from = getState().phonicsStep?.[set.id] ?? 0;
  const step = (n: number) => {
    [...dots.children].forEach((d, k) => (d.classList.toggle('on', k < n), d.classList.toggle('now', k === n)));
    if (n > 0 && n !== (getState().phonicsStep?.[set.id] ?? 0)) update((s) => void (s.phonicsStep = { ...(s.phonicsStep ?? {}), [set.id]: n }));
  };
  const firstSeen = new WeakMap<HTMLElement, number>();
  const tap = <T extends HTMLElement>(els: T[]) =>
    new Promise<T>((resolve) => {
      // a quick double tap must not also press a button that has just appeared in the same place
      // (buttons already on screen, like the letter tiles, answer fast taps as usual)
      const now = Date.now();
      els.forEach((e) => firstSeen.has(e) || firstSeen.set(e, now));
      const off = () => els.forEach((e) => e.removeEventListener('click', on));
      const on = (e: Event) => {
        if (Date.now() - (firstSeen.get(e.currentTarget as HTMLElement) ?? 0) < 400) return;
        off();
        resolve(e.currentTarget as T);
      };
      els.forEach((e) => e.addEventListener('click', on));
    });
  const wiggle = (e: HTMLElement) => {
    e.classList.remove('shake');
    void e.offsetWidth;
    e.classList.add('shake');
  };
  const nextBtn = () => h('button', { class: 'btn btn-good ph-next', 'aria-label': 'Next' }, '▶');
  const alive = () => ctx.alive();

  const run = async () => {
    if (from > 0) await say("Welcome back! Let's go on.");
    if (!alive()) return;
    // 1. Meet the sounds
    step(0);
    for (const snd of from > 0 ? [] : set.sounds) {
      if (!alive()) return;
      const card = h('div', { class: 'ph-meet pop' }, soundTile(snd.s, 'ph-tile-big'), h('div', { class: 'ph-meet-pic', 'aria-hidden': 'true' }, fixEmoji(snd.emoji)), h('div', { class: 'ph-meet-word', lang: 'en' }, snd.word));
      const again = h('button', { class: 'btn btn-round btn-sun btn-ear', 'aria-label': 'Listen again' }, h('span', { class: 'icon-speaker' }));
      const next = nextBtn();
      stage.replaceChildren(h('div', { class: 'ph-row' }, card, h('div', { class: 'ph-side' }, again, next)));
      // a sound met before that sounds the same (c then k, er then ur): say so
      const earlier = [...taughtUpTo(idx - 1), ...set.sounds.slice(0, set.sounds.indexOf(snd))];
      const twin = set.tricky ? undefined : earlier.find((x) => x.say === snd.say);
      const line = `${snd.say}… ${snd.say}… ${snd.word}!${twin ? ` ${snd.s.toUpperCase()} and ${twin.s.toUpperCase()} make the same sound!` : ''}`;
      void say(line);
      for (;;) {
        const t = await tap([again, next]);
        if (!alive()) return;
        if (t === next) break;
        sfx.tap();
        void say(line);
      }
      sfx.tap();
    }

    // 2. Find the sound
    if (from <= 1) step(1);
    // a tricky-word set finds among its own words; sound sets among all sounds taught so far
    const pool = set.tricky ? set.sounds : taughtUpTo(idx);
    const order = shuffle([...set.sounds, ...shuffle(set.sounds)]).slice(0, 5);
    for (const target of from > 1 ? [] : order) {
      if (!alive()) return;
      // never two tiles with the same sound (c/k, er/ur): both would be right
      const others = shuffle(pool.filter((x) => x.s !== target.s && x.say !== target.say)).slice(0, 2);
      const tiles = shuffle([target, ...others]).map((x) => soundTile(x.s, 'ph-tile-pick', true));
      const again = h('button', { class: 'btn btn-round btn-sun btn-ear', 'aria-label': 'Listen again' }, h('span', { class: 'icon-speaker' }));
      stage.replaceChildren(h('div', { class: 'ph-find', 'data-answer': target.s }, h('div', { class: 'ph-tiles' }, tiles), again));
      const prompt = `Find… ${target.say}!`;
      void say(prompt);
      for (;;) {
        const t = await tap([...tiles, again]);
        if (!alive()) return;
        if (t === again) {
          void say(prompt);
          continue;
        }
        if (t.dataset.sound === target.s) {
          sfx.success();
          t.classList.add('is-right');
          await say(`${pick(PRAISE)} ${target.say}!`);
          break;
        }
        sfx.soft();
        wiggle(t);
        void say(`Try again! ${prompt}`);
      }
    }

    // 3. Blend: hear the sounds, pick the picture (tricky words skip blending and building)
    if (from <= 2) step(2);
    const allWords = wordsUpTo(idx);
    for (const w of set.tricky || from > 2 ? [] : shuffle(set.words).slice(0, 4)) {
      if (!alive()) return;
      const tiles = w.parts.map((p) => soundTile(p, 'ph-tile-word'));
      const others = shuffle(allWords.filter((x) => x.w !== w.w)).slice(0, 2);
      const pics = shuffle([w, ...others]).map((x) => h('button', { class: 'ph-pic', 'data-word': x.w, 'aria-label': x.w }, fixEmoji(x.emoji)));
      const blend = h('button', { class: 'btn btn-round btn-sun btn-ear', 'aria-label': 'Blend' }, h('span', { class: 'icon-speaker' }));
      stage.replaceChildren(h('div', { class: 'ph-blend', 'data-answer': w.w }, h('div', { class: 'ph-word-row' }, tiles, blend), h('div', { class: 'ph-pics' }, pics)));
      const sayBlend = async () => {
        for (const [k, p] of w.parts.entries()) {
          if (!alive()) return;
          tiles.forEach((t, j) => t.classList.toggle('is-now', j === k));
          await say(SAY[p] ?? p); // normal speed: slowed down, a short sound grows an extra "uh"
        }
        tiles.forEach((t) => t.classList.remove('is-now'));
        if (alive()) await say('What word is it?');
      };
      void sayBlend();
      for (;;) {
        const t = await tap([...pics, blend]);
        if (!alive()) return;
        if (t === blend) {
          void sayBlend();
          continue;
        }
        if (t.dataset.word === w.w) {
          sfx.success();
          t.classList.add('is-right');
          tiles.forEach((x) => x.classList.add('is-on'));
          await say(`${w.parts.map((p) => SAY[p] ?? p).join('… ')}… ${w.w}! ${pick(PRAISE)}`);
          break;
        }
        sfx.soft();
        wiggle(t);
        void say('Try again! Listen.');
      }
    }

    // 4. Build the word from sound tiles
    if (from <= 3) step(3);
    for (const w of set.tricky || from > 3 ? [] : shuffle(set.words).slice(0, 3)) {
      if (!alive()) return;
      const extra = shuffle(pool.filter((x) => !w.parts.includes(x.s) && !w.parts.some((p) => SAY[p] === x.say)))[0];
      const choices = shuffle([...w.parts, ...(extra ? [extra.s] : [])]);
      const slots = w.parts.map(() => h('span', { class: 'ph-slot' }));
      const tiles = choices.map((p) => soundTile(p, 'ph-tile-pick', true));
      const hear = h('button', { class: 'btn btn-round btn-sun btn-ear', 'aria-label': 'Listen' }, h('span', { class: 'icon-speaker' }));
      stage.replaceChildren(h('div', { class: 'ph-build', 'data-word': w.w, 'data-parts': w.parts.join(',') }, h('div', { class: 'ph-build-top' }, h('div', { class: 'ph-pic is-big', 'aria-hidden': 'true' }, fixEmoji(w.emoji)), hear), h('div', { class: 'ph-slots' }, slots), h('div', { class: 'ph-tiles' }, tiles)));
      void say(`Make the word… ${w.w}!`);
      for (let k = 0; k < w.parts.length; ) {
        const t = await tap([...tiles.filter((x) => !x.classList.contains('is-used')), hear]);
        if (!alive()) return;
        if (t === hear) {
          void say(w.parts.map((p) => SAY[p] ?? p).join('… ') + `… ${w.w}`);
          continue;
        }
        if (t.dataset.sound === w.parts[k]) {
          sfx.pop();
          t.classList.add('is-used');
          slots[k].textContent = w.parts[k];
          slots[k].classList.add('is-filled');
          void say(SAY[w.parts[k]] ?? w.parts[k]);
          k++;
        } else {
          sfx.soft();
          wiggle(t);
        }
      }
      sfx.success();
      await say(`${w.w}! ${pick(PRAISE)}`);
    }

    // 5. Read the little book (Bix reads it, or the child reads it aloud)
    step(4);
    let readByChild = 0;
    for (const page of set.reader.pages) {
      if (!alive()) return;
      const words = page.text.split(/\s+/).map((t) => {
        const plain = t.replace(/[^A-Za-z]/g, '');
        return h('button', { class: `ph-rword ${TRICKY.has(plain) ? 'is-tricky' : ''}`, lang: 'en', onclick: () => void say(plain || t) }, t);
      });
      const toMe = h('button', { class: 'btn btn-sun ph-read-me', 'aria-label': 'Read to me' }, '🔊 Read to me');
      const next = nextBtn();
      const line = h('p', { class: 'ph-line' }, words);
      const area = h('div', { class: 'ph-read' }, h('div', { class: 'ph-read-pic', 'aria-hidden': 'true' }, fixEmoji(page.emoji)), line, h('div', { class: 'ph-read-btns' }, toMe, next));
      stage.replaceChildren(h('div', { class: 'ph-book' }, h('h2', { class: 'ph-book-title', lang: 'en' }, set.reader.title), area));
      const tokens = page.text.split(/\s+/);
      const mark = (alts: string[]) => tokenHits(tokens, alts).forEach((hit, j) => words[j]?.classList.toggle('is-read', !!hit));
      // the child's turn first; "Read to me" is always there
      const turn = micTurn(ctx, area, { expect: page.text, check: (alts) => readScore(wordHits(page.text, alts)) >= 0.6, onHeard: mark, prompt: page === set.reader.pages[0] ? 'Can you read it? Tap the microphone!' : undefined });
      void turn.then((r) => {
        if (!alive()) return;
        if (r.result === 'ok' || r.result === 'parent') {
          readByChild++;
          words.forEach((w) => w.classList.add('is-read'));
          sfx.success();
          void say(pick(PRAISE));
        }
        next.classList.add('pop');
      });
      for (;;) {
        const t = await tap([toMe, next]);
        if (!alive()) return;
        if (t === toMe) {
          sfx.tap();
          turn.pause(); // Bix reads: don't let the mic hear Bix
          const starts: number[] = [];
          let at = 0;
          for (const w of page.text.split(/\s+/)) {
            starts.push(page.text.indexOf(w, at));
            at = starts[starts.length - 1] + w.length;
          }
          await say(page.text, {
            rate: 0.75,
            onWord: (ci) => words.forEach((w, j) => w.classList.toggle('is-now', starts[j] <= ci && (j + 1 >= starts.length || ci < starts[j + 1]))),
          });
          words.forEach((w) => w.classList.remove('is-now'));
          continue;
        }
        break;
      }
      turn.cancel(); // the child moved on while the mic was open
      sfx.tap();
    }

    // Done!
    update((s) => {
      s.phonics = { ...(s.phonics ?? {}), [set.id]: (s.phonics?.[set.id] ?? 0) + 1 };
      if (s.phonicsStep?.[set.id]) {
        const { [set.id]: _, ...rest } = s.phonicsStep;
        s.phonicsStep = rest;
      }
      if (readByChild) s.readAloud = { ...(s.readAloud ?? {}), [`phonics-${set.id}`]: (s.readAloud?.[`phonics-${set.id}`] ?? 0) + readByChild };
      const d = dayLog();
      d.sounds = (d.sounds ?? 0) + 1;
      d.read = (d.read ?? 0) + readByChild;
    });
    [...dots.children].forEach((d) => d.classList.add('on'));
    sfx.reward();
    confetti(document.body, 50);
    bix.setMood('happy');
    const nextSet = SETS[idx + 1];
    const again = h('button', { class: 'btn btn-sun', 'aria-label': 'Sounds', onclick: () => (sfx.tap(), ctx.go('phonics')) }, '🔊 Sounds');
    const on = nextSet ? h('button', { class: 'btn btn-good', 'aria-label': 'Next sounds', onclick: () => (sfx.tap(), ctx.go('phonics', { set: nextSet.id })) }, `▶ ${nextSet.title}`) : null;
    // started from Today: one big Next back to the day's path
    stage.replaceChildren(h('div', { class: 'ph-done pop' }, h('div', { class: 'ph-done-star', 'aria-hidden': 'true' }, '⭐'), h('div', { class: 'reward-actions' }, todayRunning() ? todayNextButton(ctx) : [on, again])));
    // never list the letters here: a voice would read their NAMES, not their sounds
    await say(readByChild ? `You read the book by yourself! ${pick(PRAISE)}` : `${set.tricky ? 'You know these tricky words!' : 'You know these sounds!'} ${pick(PRAISE)}`);
  };
  setTimeout(() => void run(), 300);
  return el;
}
