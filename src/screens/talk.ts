import { Bix } from '../art/bix';
import data from '../../content/talk.json';
import { LEVELS } from '../content';
import { h, shuffle, wait } from '../lib/dom';
import { fixEmoji } from '../lib/emoji';
import { currentLevel } from '../lib/level';
import { matchSpeech, normalize } from '../lib/match';
import { sfx } from '../lib/sfx';
import { dayLog, update } from '../lib/storage';
import { limitReached } from '../lib/usage';
import type { Ctx } from '../router';
import { pick, PRAISE } from './lesson/shared';
import { micTurn } from './mic';
import { confetti, homeButton } from './widgets';
import { todayRunning } from '../lib/today';
import { todayNextButton } from './today';

/**
 * Talk with Bix — everything runs on the device (no AI service, nothing sent anywhere):
 *  - Chats: short scripted conversations; the child answers by speaking or by tapping a picture
 *    answer, and Bix replies to what they chose.
 *  - Speaking practice: the Cambridge speaking test, by level — point to things in a big picture
 *    and name them (Starters), find the differences and tell a picture story (Movers, Flyers),
 *    and personal questions. Answers are never marked; Bix models a good answer.
 */
type Option = { say: string; emoji: string; words: string[]; reply: string };
type Turn = { bix: string; type: 'any' | 'choice' | 'end'; reply?: string; options?: Option[]; fallback?: string };
type Chat = { id: string; title: string; icon: string; level: string; turns: Turn[] };
type Item = { word: string; emoji: string; x: number; y: number; size?: number; b?: string; a?: string; bSay?: string; /** with its article: "the sun", "a cat" */ say?: string };
type Scene = { id: string; title: string; sky: string; ground: string; items: Item[]; point?: string[]; name?: string[] };
type Practice = { scenes?: Scene[]; differences?: Scene[]; story?: { title: string; panels: { emoji: string; model: string }[] }; questions: string[] };
const CHATS = data.chats as Chat[];
const PRACTICE = data.practice as Record<string, Practice>;
const levelIndex = (id: string) => LEVELS.findIndex((l) => l.id === id);
const said = (alts: string[]) => alts.some((a) => normalize(a).length > 0);

export function talkScreen(ctx: Ctx): HTMLElement {
  if (limitReached()) {
    queueMicrotask(() => ctx.go('rest'));
    return h('main');
  }
  const chat = CHATS.find((c) => c.id === ctx.params.chat);
  if (chat) return chatScreen(ctx, chat);
  if (ctx.params.mode === 'practice' && PRACTICE[currentLevel().id]) return practiceScreen(ctx, currentLevel().id);
  return menu(ctx);
}

function shell(ctx: Ctx, title: string, body: HTMLElement, bix: Bix, back = true): HTMLElement {
  return h(
    'main',
    { class: 'talk' },
    h('header', { class: 'book-top' }, homeButton(ctx), back ? h('button', { class: 'btn btn-round btn-sun', 'aria-label': 'Talk', onclick: () => (sfx.tap(), ctx.go('talk')) }, '💬') : null, h('h1', { class: 'world-title' }, title)),
    h('div', { class: 'talk-body' }, h('div', { class: 'talk-bix' }, bix.el), body),
  );
}

function menu(ctx: Ctx): HTMLElement {
  const level = currentLevel();
  const bix = new Bix({ size: 'md' }).setMood('hello');
  const chats = CHATS.filter((c) => levelIndex(c.level) <= levelIndex(level.id));
  const card = (icon: string, label: string, onclick: () => void, attrs: Record<string, string> = {}) =>
    h('button', { class: 'talk-card', 'aria-label': label, onclick: () => (sfx.tap(), onclick()), ...attrs }, h('span', { class: 'talk-card-icon', 'aria-hidden': 'true' }, fixEmoji(icon)), h('span', {}, label));
  const practice = PRACTICE[level.id] ? card('🎓', 'Speaking practice', () => ctx.go('talk', { mode: 'practice' }), { 'data-talk': 'practice' }) : null;
  setTimeout(() => ctx.alive() && void bix.talk("Let's talk! Choose a chat.", 'happy', "Let's talk! 💬"), 300);
  return shell(ctx, 'Talk with Bix', h('div', { class: 'talk-menu' }, practice, chats.map((c) => card(c.icon, c.title, () => ctx.go('talk', { chat: c.id }), { 'data-talk': c.id }))), bix, false);
}

/** Tap one of the picture answers, or say it: whichever comes first. */
async function answer(ctx: Ctx, host: HTMLElement, opts: { expect: string; options?: Option[]; showText: boolean }): Promise<{ option?: Option; spoke: boolean }> {
  const chips = (opts.options ?? []).map((o) => h('button', { class: 'talk-chip pop', 'aria-label': o.say, 'data-option': o.say }, h('span', { class: 'talk-chip-emoji', 'aria-hidden': 'true' }, fixEmoji(o.emoji)), opts.showText ? h('span', { lang: 'en' }, o.say) : null));
  const row = h('div', { class: 'talk-chips' }, chips);
  const area = h('div', { class: 'talk-answer' }, chips.length ? row : null);
  host.appendChild(area);
  let matched: Option | undefined;
  const has = (o: Option, alts: string[]) => alts.some((a) => o.words.some((w) => ` ${normalize(a)} `.includes(` ${normalize(w)} `)));
  // "I'm not hungry" contains "i am": a negative answer picks the No option first
  const negative = (alts: string[]) => alts.some((a) => /\b(no|not|nope|never|dont|don't|haven't|havent|can't|cant)\b/.test(normalize(a)));
  const find = (alts: string[]) => {
    const list = opts.options ?? [];
    const no = list.find((o) => o.words.includes('no'));
    if (no && negative(alts)) return no;
    return list.find((o) => has(o, alts));
  };
  const byTap = new Promise<{ option?: Option; spoke: boolean }>((resolve) => chips.forEach((c, i) => c.addEventListener('click', () => (sfx.tap(), resolve({ option: opts.options![i], spoke: false })))));
  const voice = micTurn(ctx, area, {
    expect: opts.expect,
    check: (alts) => (opts.options?.length ? !!(matched = find(alts)) : said(alts)),
    tries: opts.options?.length ? 2 : 1,
  });
  const byVoice = voice.then((r) => ({ option: matched, spoke: r.result === 'ok' || r.result === 'tried' }));
  const res = await Promise.race([byTap, byVoice]);
  voice.cancel(); // a tap ends the listening turn too
  area.remove();
  return res;
}

function chatScreen(ctx: Ctx, chat: Chat): HTMLElement {
  const level = currentLevel();
  const bix = new Bix({ size: 'md' }).setMood('hello');
  const stage = h('section', { class: 'talk-stage' });
  const el = shell(ctx, chat.title, stage, bix);
  const run = async () => {
    for (const turn of chat.turns) {
      if (!ctx.alive()) return;
      stage.replaceChildren(h('p', { class: 'talk-line pop', lang: 'en' }, turn.bix));
      bix.setMood('hello');
      await bix.talk(turn.bix, 'idle', turn.type === 'end' ? '👋' : '💬');
      if (!ctx.alive()) return;
      if (turn.type === 'end') break;
      const first = turn.options?.[0];
      const r = await answer(ctx, stage, { expect: first ? first.words[0] : 'yes', options: turn.options, showText: level.showText && level.id !== 'L1' });
      if (!ctx.alive()) return;
      // no answer understood (misheard twice, or skipped): no praise for an answer Bix did not hear
      const unheard = turn.type !== 'any' && !r.option;
      const reply = turn.type === 'any' ? turn.reply! : (r.option?.reply ?? turn.fallback ?? "OK! Let's go on.");
      if (r.option) stage.replaceChildren(h('div', { class: 'talk-picked pop', 'aria-hidden': 'true' }, fixEmoji(r.option.emoji)));
      bix.setMood('happy');
      if (!unheard) sfx.success();
      await bix.talk(reply, 'happy');
      await wait(250);
    }
    if (!ctx.alive()) return;
    update((s) => {
      s.talk = { ...(s.talk ?? {}), [`chat-${chat.id}`]: (s.talk?.[`chat-${chat.id}`] ?? 0) + 1 };
      const d = dayLog();
      d.talk = (d.talk ?? 0) + 1;
    });
    done(ctx, stage, bix);
  };
  setTimeout(() => void run(), 300);
  return el;
}

function done(ctx: Ctx, stage: HTMLElement, bix: Bix): void {
  sfx.reward();
  confetti(document.body, 40);
  bix.setMood('happy');
  const again = h('button', { class: 'btn btn-sun', 'aria-label': 'Talk', onclick: () => (sfx.tap(), ctx.go('talk')) }, '💬 Talk');
  const home = h('button', { class: 'btn btn-good', 'aria-label': 'Home', onclick: () => (sfx.tap(), ctx.go('home')) }, h('span', { class: 'icon-home', style: 'width:36px' }), 'Home');
  stage.replaceChildren(h('div', { class: 'talk-done pop' }, h('div', { class: 'talk-done-star', 'aria-hidden': 'true' }, '⭐'), h('div', { class: 'reward-actions' }, todayRunning() ? todayNextButton(ctx) : [again, home])));
  void bix.talk(`${pick(PRAISE)} You are a great talker!`, 'happy');
}

/** A big picture made of positioned pictures (Cambridge "look at the picture"). */
function scene(sc: Scene, which: 'a' | 'b' = 'a'): { el: HTMLElement; items: HTMLElement[] } {
  const items = sc.items.map((it) =>
    h('button', { class: 'talk-item', 'data-word': it.word, 'aria-label': it.word, style: `left:${it.x}%; top:${it.y}%; --s:${it.size ?? 1}` }, fixEmoji(which === 'b' && it.b ? it.b : it.emoji)),
  );
  return { el: h('div', { class: 'talk-scene', style: `--sky:${sc.sky}; --ground:${sc.ground}`, 'data-scene': `${sc.id}-${which}` }, items), items };
}

function practiceScreen(ctx: Ctx, levelId: string): HTMLElement {
  const P = PRACTICE[levelId];
  const bix = new Bix({ size: 'md' }).setMood('hello');
  const stage = h('section', { class: 'talk-stage' });
  const steps = h('div', { class: 'ph-dots talk-dots', 'aria-hidden': 'true' });
  const el = shell(ctx, 'Speaking practice', stage, bix);
  el.querySelector('.book-top')?.appendChild(steps);
  const parts: (() => Promise<void>)[] = [];
  const ok = () => ctx.alive();
  const wiggle = (e: HTMLElement) => {
    e.classList.remove('shake');
    void e.offsetWidth;
    e.classList.add('shake');
  };
  const tapOne = (els: HTMLElement[]) => new Promise<HTMLElement>((resolve) => els.forEach((e) => e.addEventListener('click', () => resolve(e), { once: true })));

  if (P.scenes) {
    const sc = shuffle(P.scenes)[0];
    parts.push(async () => {
      const { el: pic, items } = scene(sc);
      stage.replaceChildren(h('div', { class: 'talk-task', 'data-task': 'point' }, pic));
      await bix.talk(`Look at this picture. It's ${sc.title.replace(/^(In|At) the /, 'a ').toLowerCase()}.`, 'idle');
      for (const word of sc.point ?? []) {
        if (!ok()) return;
        const q = `Where is the ${word}? Point to the ${word}.`;
        stage.firstElementChild?.setAttribute('data-answer', word);
        void bix.talk(q, 'idle', `👆 ${word}`);
        for (;;) {
          const t = await tapOne(items);
          if (!ok()) return;
          if (t.dataset.word === word) {
            sfx.success();
            t.classList.add('is-found');
            await bix.talk(`Yes! That's the ${word}.`, 'happy');
            break;
          }
          sfx.soft();
          wiggle(t);
          void bix.talk(`Try again! ${q}`, 'idle');
        }
      }
    });
    parts.push(async () => {
      const { el: pic, items } = scene(sc);
      const task = h('div', { class: 'talk-task', 'data-task': 'name' }, pic);
      stage.replaceChildren(task);
      for (const word of sc.name ?? []) {
        if (!ok()) return;
        const it = items.find((x) => x.dataset.word === word)!;
        items.forEach((x) => x.classList.toggle('is-asked', x === it));
        await bix.talk("What's this?", 'idle', '❓');
        const r = await micTurn(ctx, task, { expect: word, check: (alts) => matchSpeech(word, [], alts).ok });
        if (!ok()) return;
        it.classList.add('is-found');
        const said = sc.items.find((x) => x.word === word)?.say ?? `a ${word}`;
        await bix.talk(r.result === 'ok' ? `Yes! It's ${said}! ${pick(PRAISE)}` : `It's ${said}. ${word}!`, 'happy');
      }
      items.forEach((x) => x.classList.remove('is-asked'));
    });
  }
  if (P.differences) {
    const sc = shuffle(P.differences)[0];
    parts.push(async () => {
      const a = scene(sc, 'a');
      const b = scene(sc, 'b');
      const diffs = sc.items.filter((it) => it.b);
      const task = h('div', { class: 'talk-task talk-two', 'data-task': 'differences', 'data-left': String(diffs.length) }, h('div', { class: 'talk-pic' }, h('span', { class: 'talk-pic-n' }, '1'), a.el), h('div', { class: 'talk-pic' }, h('span', { class: 'talk-pic-n' }, '2'), b.el));
      stage.replaceChildren(task);
      await bix.talk(`Look at the two pictures. They are different. Find ${diffs.length} differences in picture two!`, 'idle', `🔍 ${diffs.length}`);
      let left = diffs.length;
      while (left > 0) {
        const t = await tapOne(b.items.filter((x) => !x.classList.contains('is-found')));
        if (!ok()) return;
        const it = sc.items.find((x) => x.word === t.dataset.word)!;
        if (!it.b) {
          sfx.soft();
          wiggle(t);
          void bix.talk('That is the same. Try again!', 'idle');
          continue;
        }
        sfx.success();
        t.classList.add('is-found');
        a.items.find((x) => x.dataset.word === it.word)?.classList.add('is-found');
        left--;
        task.dataset.left = String(left);
        await bix.talk(`${it.a} ${it.bSay}`, 'happy');
      }
      if (!ok()) return;
      await bix.talk('Now you tell me one difference!', 'idle', '🗣️');
      const r = await micTurn(ctx, task, { expect: diffs[0].bSay ?? 'different', check: said, tries: 1 });
      if (ok()) await bix.talk(r.result === 'skip' ? 'Good! Let\'s go on.' : `${pick(PRAISE)} Good talking!`, 'happy');
    });
  }
  if (P.story) {
    const story = P.story;
    parts.push(async () => {
      const panels = story.panels.map((p, i) => h('div', { class: 'talk-panel', 'data-panel': String(i) }, h('span', { class: 'talk-panel-n' }, String(i + 1)), h('span', { class: 'talk-panel-pic', 'aria-hidden': 'true' }, fixEmoji(p.emoji))));
      const task = h('div', { class: 'talk-task', 'data-task': 'story' }, h('div', { class: 'talk-panels' }, panels));
      stage.replaceChildren(task);
      await bix.talk(`These pictures tell a story. It's called "${story.title}". Look at the pictures and tell me the story.`, 'idle', `📖 ${story.title}`);
      for (const [i, p] of story.panels.entries()) {
        if (!ok()) return;
        panels.forEach((x, j) => x.classList.toggle('is-now', j === i));
        // Flyers tells the story in the past ("What happened…?"), Movers in the present
        await bix.talk(i === 0 ? (levelId === 'L4' ? 'What happened in picture one?' : 'What happens in picture one?') : `And in picture ${['one', 'two', 'three', 'four', 'five'][i]}?`, 'idle', `🗣️ ${i + 1}`);
        const r = await micTurn(ctx, task, { expect: p.model, check: said, tries: 1 });
        if (!ok()) return;
        await bix.talk(`${r.result === 'skip' ? '' : 'Good! '}${p.model}`, 'happy');
      }
      panels.forEach((x) => x.classList.remove('is-now'));
    });
  }
  parts.push(async () => {
    const task = h('div', { class: 'talk-task', 'data-task': 'questions' }, h('div', { class: 'talk-q-icon', 'aria-hidden': 'true' }, '🙋'));
    stage.replaceChildren(task);
    await bix.talk("Now let's talk about you!", 'happy');
    for (const q of shuffle(P.questions).slice(0, 3)) {
      if (!ok()) return;
      task.replaceChildren(h('p', { class: 'talk-line', lang: 'en' }, q));
      await bix.talk(q, 'idle', '🗣️');
      await micTurn(ctx, task, { expect: 'yes', check: said, tries: 1 });
      if (!ok()) return;
      await bix.talk(pick(levelId === 'L2' ? ['Thank you!', 'Great answer!', 'Very good!'] : ['Thank you!', 'Great answer!', 'Very good!', 'How interesting!']), 'happy');
    }
  });

  steps.replaceChildren(...parts.map((_, i) => h('span', {}, String(i + 1))));
  const mark = (n: number) => [...steps.children].forEach((d, k) => (d.classList.toggle('on', k < n), d.classList.toggle('now', k === n)));
  const run = async () => {
    await bix.talk("Hello! Let's practise speaking, like in the Cambridge test. Ready?", 'happy', 'Ready? 🎓');
    for (const [i, part] of parts.entries()) {
      if (!ok()) return;
      mark(i);
      await part();
    }
    if (!ok()) return;
    mark(parts.length);
    update((s) => {
      s.talk = { ...(s.talk ?? {}), [`practice-${levelId}`]: (s.talk?.[`practice-${levelId}`] ?? 0) + 1 };
      const d = dayLog();
      d.talk = (d.talk ?? 0) + 1;
    });
    done(ctx, stage, bix);
  };
  setTimeout(() => void run(), 300);
  return el;
}
