import { Bix } from '../art/bix';
import { LEVELS } from '../content';
import { h, wait } from '../lib/dom';
import { currentLevel } from '../lib/level';
import { sfx } from '../lib/sfx';
import { dayLog, getState, update } from '../lib/storage';
import { todayRunning } from '../lib/today';
import type { Ctx } from '../router';
import { once } from './games2';
import { todayNextButton } from './today';
import { homeButton } from './widgets';
import { limitReached } from '../lib/usage';

/**
 * Hello! (the first step of Today, about 30 seconds): like the morning circle at school.
 * What day is it today? (from 4–5 years; Movers on find it without help) → What's the weather
 * like? → How are you? Bix answers each with the whole sentence to say ("It's sunny!").
 * The weather and the feeling are kept for the parents' weekly report.
 */
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEATHER: [string, string, string][] = [
  ['sunny', '☀️', "Let's play outside!"],
  ['cloudy', '☁️', 'Where is the sun?'],
  ['rainy', '🌧️', "Don't forget your umbrella!"],
  ['windy', '💨', 'Hold your hat!'],
];
export const FEELINGS: [string, string, string][] = [
  ['happy', '😊', "I'm happy too! Hooray!"],
  ['tired', '😴', "Let's stretch! Arms up… and down! Well done!"],
  ['sad', '😢', "Here is a big hug from me! Let's have fun together."],
  ['angry', '😠', "Let's take a big breath. In… and out. Well done!"],
];

export function circleScreen(ctx: Ctx): HTMLElement {
  if (limitReached()) {
    queueMicrotask(() => ctx.go('rest'));
    return h('main');
  }
  const lv = Math.max(0, LEVELS.findIndex((l) => l.id === currentLevel().id));
  const showText = currentLevel().showText;
  const bix = new Bix({ size: 'md' }).setMood('hello');
  const stage = h('div', { class: 'cc-stage' });
  const name = getState().childName.trim();
  const now = new Date();
  const hour = now.getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const choose = async (opts: HTMLElement[]) => {
    const t = await once(opts);
    sfx.tap();
    t.classList.add('is-right');
    opts.forEach((o) => o !== t && o.classList.add('is-faded'));
    return t;
  };
  const card = (id: string, emoji: string, label: string) =>
    h('button', { class: 'cc-opt pop', 'data-id': id, 'aria-label': label }, h('span', { class: 'cc-emoji', 'aria-hidden': 'true' }, emoji), showText ? h('span', { class: 'cc-label', lang: 'en' }, label) : null);

  const dayPart = async () => {
    const today = DAYS[now.getDay()];
    // Monday first, like a school calendar
    const week = [1, 2, 3, 4, 5, 6, 0].map((d) =>
      h('button', { class: `cc-day pop ${d === 0 || d === 6 ? 'is-weekend' : ''}`, 'data-day': DAYS[d], 'aria-label': DAYS[d], lang: 'en' }, DAYS[d].slice(0, 3)),
    );
    const mine = week.find((b) => b.dataset.day === today)!;
    if (lv <= 2) mine.classList.add('is-hint'); // younger children: today glows, they touch it
    stage.replaceChildren(h('div', { class: 'cc-round', 'data-part': 'day', 'data-answer': today }, h('div', { class: 'cc-week' }, week)));
    // the days work while Bix talks ("Touch Friday!" — a quick child taps at once)
    void bix.talk(lv <= 2 ? `Today is ${today}! Touch ${today}!` : 'What day is it today?', 'happy', 'What day is it? 📅');
    for (let misses = 0; ; ) {
      const t = await once(week);
      if (!ctx.alive()) return;
      if (t === mine) {
        sfx.success();
        t.classList.add('is-right');
        await bix.talk(`Yes! Today is ${today}!`, 'happy', `${today}! ✓`);
        return;
      }
      sfx.soft();
      misses++;
      if (misses >= 2) mine.classList.add('is-hint');
      void bix.talk(`That's ${t.dataset.day}. Try again!`, 'encourage', 'Try again!');
    }
  };

  const weatherPart = async () => {
    const opts = WEATHER.map(([id, e]) => card(id, e, id));
    stage.replaceChildren(h('div', { class: 'cc-round', 'data-part': 'weather' }, h('div', { class: 'cc-opts' }, opts)));
    void bix.talk("What's the weather like today? Look outside!", 'idle', "What's the weather like? 🌤️");
    const t = await choose(opts);
    if (!ctx.alive()) return;
    const [id, , reply] = WEATHER.find((w) => w[0] === t.dataset.id)!;
    update(() => (dayLog().circle = { ...dayLog().circle, weather: id }));
    await bix.talk(`It's ${id}! Say it with me: it's ${id}!`, 'happy', `It's ${id}!`);
    if (!ctx.alive()) return;
    await wait(900);
    if (!ctx.alive()) return;
    await bix.talk(reply, 'happy');
  };

  const feelPart = async () => {
    const opts = FEELINGS.map(([id, e]) => card(id, e, id));
    stage.replaceChildren(h('div', { class: 'cc-round', 'data-part': 'feel' }, h('div', { class: 'cc-opts' }, opts)));
    void bix.talk(`How are you today${name ? `, ${name}` : ''}?`, 'idle', 'How are you? 💛');
    const t = await choose(opts);
    if (!ctx.alive()) return;
    const [id, , reply] = FEELINGS.find((f) => f[0] === t.dataset.id)!;
    update(() => (dayLog().circle = { ...dayLog().circle, feel: id }));
    await bix.talk(`I'm ${id}. Say it with me: I'm ${id}!`, id === 'happy' ? 'happy' : 'encourage', `I'm ${id}.`);
    if (!ctx.alive()) return;
    await wait(900);
    if (!ctx.alive()) return;
    await bix.talk(reply, 'happy');
  };

  setTimeout(async () => {
    if (!ctx.alive()) return;
    await bix.talk(`${hello}${name ? `, ${name}` : ''}!`, 'hello', `${hello}! 👋`);
    if (!ctx.alive()) return;
    if (lv >= 1) await dayPart();
    if (ctx.alive()) await weatherPart();
    if (ctx.alive()) await feelPart();
    if (!ctx.alive()) return;
    sfx.reward();
    stage.replaceChildren(
      h(
        'div',
        { class: 'cc-round cc-done pop' },
        todayRunning() ? todayNextButton(ctx) : h('button', { class: 'btn btn-good', 'aria-label': 'Home', onclick: () => (sfx.tap(), ctx.go('home')) }, h('span', { class: 'icon-home', style: 'width:36px' }), 'Home'),
      ),
    );
    await bix.talk("Let's start our day!", 'happy', "Let's go! ▶");
  }, 300);

  return h(
    'main',
    { class: 'circle' },
    h('header', { class: 'book-top' }, homeButton(ctx), h('h1', { class: 'world-title' }, 'Hello!')),
    h('div', { class: 'cc-body' }, h('div', { class: 'cc-bix' }, bix.el), stage),
  );
}
