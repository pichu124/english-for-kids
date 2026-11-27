import { Bix } from '../art/bix';
import { LEVELS, topics, topicsOfLevel, type Word } from '../content';
import { h, shuffle, wait } from '../lib/dom';
import { currentLevel } from '../lib/level';
import { isLearned } from '../lib/progress';
import { sfx } from '../lib/sfx';
import { getState, wordKey } from '../lib/storage';
import { say } from '../lib/tts';
import type { Ctx } from '../router';
import { finish, once, shell } from './games2';
import { graphemes, pick, PRAISE, wordPicture } from './lesson/shared';
import { fixEmoji, wordEmoji } from '../lib/emoji';

/**
 * Three more games (Games screen, and the game step of Today):
 *  - Grammar (Starters on): a sentence with a gap, two or three little words to choose from
 *    (a/an, cat/cats, is/are, he/she, can/can't, in/on/under; Movers: was/were, past, -er;
 *    Flyers: will, have … ever). Bix reads the sentence, then the whole sentence once it is full.
 *  - Maths in English: how many?, add, take away, which has more?, find the number (13 or 30?).
 *  - Sort it!: put the pictures in two baskets (animals or food?), then find the odd one out.
 * Nobody is told "wrong": another try, and Bix says why the answer fits.
 */

const levelIndex = () => Math.max(0, LEVELS.findIndex((l) => l.id === currentLevel().id));
const bankTopic = (w: Word) => (w as Word & { topic?: string }).topic ?? '';

/** Words of this level and the ones before it, learned words first, one per spelling and per picture. */
function wordsUpTo(lv: number): Word[] {
  const s = getState();
  const learned: Word[] = [];
  const rest: Word[] = [];
  const seen = new Set<string>();
  for (const l of LEVELS.slice(0, lv + 1)) {
    for (const t of topicsOfLevel(l.id)) {
      for (const w of t.words) {
        const pic = JSON.stringify(w.image);
        if (seen.has(w.text.toLowerCase()) || seen.has(pic)) continue;
        seen.add(w.text.toLowerCase());
        seen.add(pic);
        (isLearned(s.words[wordKey(t.id, w.id)]) ? learned : rest).push(w);
      }
    }
  }
  return [...shuffle(learned), ...shuffle(rest)];
}

const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
/** 7 → "seven", 42 → "forty-two", 100 → "a hundred". */
export function numWord(n: number): string {
  if (n >= 100) return 'a hundred';
  if (n < 20) return NUM[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? `-${NUM[n % 10]}` : '');
}

const shake = (el: HTMLElement) => {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
};
const stars = (n: number) => h('div', { class: 'play-stars g3-stars', 'aria-hidden': 'true' }, Array.from({ length: n }, () => h('span', {}, '★')));
const hearButton = () => h('button', { class: 'btn btn-round btn-sun btn-ear', 'aria-label': 'Listen again' }, h('span', { class: 'icon-speaker' }));
/** An emoji this device can draw (older look-alike if needed, see lib/emoji.ts). */
const safe = (e: string) => (graphemes(e) > 1 ? fixEmoji(e) : (wordEmoji(e) ?? fixEmoji(e)));
const emojiPic = (e: string) => h('div', { class: 'g3-pic', 'aria-hidden': 'true' }, h('span', { class: `g3-emoji ${graphemes(e) > 1 ? 'is-two' : ''}` }, safe(e)));
/** n copies of an emoji, five to a row (easier to count). */
const group = (e: string, n: number, cls = '') =>
  h('div', { class: `mt-group ${cls} ${n > 10 ? 'is-many' : ''}`, 'aria-label': String(n), style: `--cols:${Math.min(Math.max(n, 1), 5)}` }, Array.from({ length: n }, (_, i) => h('span', { class: 'mt-item', style: `--i:${i}` }, safe(e))));

/* ================================================================== Grammar */

type GItem = { kind: string; pic: HTMLElement; before: string; after: string; options: string[]; answer: string };

const sentence = (before: string, word: string, after: string) => [before, word, after].filter(Boolean).join(' ').replace(/ ([.,!?])/g, '$1');

/** Nouns that make a plural with -s / -es and take "a" or "an". */
const NOUN_TOPICS = ['animals', 'animals2', 'animals3', 'zoo', 'farm', 'wild', 'food', 'food2', 'food3', 'food4', 'fruit', 'meals', 'toys', 'toys2', 'transport', 'transport3', 'school', 'home', 'home2', 'kitchen', 'clothes', 'clothes2', 'clothes3'];
const UNCOUNT = new Set(['milk', 'rice', 'bread', 'juice', 'meat', 'lemonade', 'soup', 'pasta', 'salad', 'cheese', 'chocolate', 'tea', 'water', 'sweets', 'chips', 'noodles', 'grapes', 'chicken', 'game', 'teacher', 'orange', 'underground']);
const IRREGULAR = new Set(['mouse', 'sheep', 'fish', 'child', 'man', 'woman', 'foot', 'tooth', 'person', 'goose', 'deer', 'glasses', 'jeans', 'shorts', 'shoes', 'socks', 'boots', 'gloves']);
export function plural(t: string): string | null {
  if (IRREGULAR.has(t) || /(f|fe|o)$/.test(t)) return null;
  if (/(s|x|ch|sh)$/.test(t)) return t + 'es';
  if (/[^aeiou]y$/.test(t)) return t.slice(0, -1) + 'ies';
  return t + 's';
}
const nouns = (lv: number) =>
  wordsUpTo(lv).filter((w) => NOUN_TOPICS.includes(bankTopic(w)) && /^[a-z]+( [a-z]+)?$/.test(w.text) && !UNCOUNT.has(w.text) && !(w.text.endsWith('s') && w.text !== 'bus'));
/** "an" before a vowel sound (words starting with u or h are left out: umbrella / uniform, hour / horse). */
export const article = (t: string) => (/^[aeio]/.test(t) ? 'an' : 'a');

const PEOPLE: [string, 'He' | 'She'][] = [['👦', 'He'], ['👧', 'She'], ['👨', 'He'], ['👩', 'She'], ['👴', 'He'], ['👵', 'She']];
const DOING: [string, string][] = [['is happy.', '😊'], ['is sleeping.', '😴'], ['has got a ball.', '⚽'], ['has got a cat.', '🐱'], ['is eating an apple.', '🍎'], ['likes ice cream.', '🍦'], ['is reading a book.', '📖'], ['is singing.', '🎤']];
const CAN: [string, string, string, boolean][] = [
  ['🐟', 'A fish', 'swim', true], ['🐟', 'A fish', 'walk', false], ['🐦', 'A bird', 'fly', true], ['🐶', 'A dog', 'fly', false],
  ['🐘', 'An elephant', 'fly', false], ['🐒', 'A monkey', 'climb', true], ['🐸', 'A frog', 'jump', true], ['🐍', 'A snake', 'walk', false],
  ['🦆', 'A duck', 'swim', true], ['🐱', 'A cat', 'read', false], ['🐴', 'A horse', 'run', true], ['🐧', 'A penguin', 'fly', false],
];
// Movers and Flyers: [picture, before, answer, other, after]
const FIXED: Record<string, [string, string, string, string, string][]> = {
  was: [
    ['☀️', 'Yesterday it', 'was', 'were', 'sunny.'], ['🏖️', 'Last week we', 'were', 'was', 'at the beach.'], ['😴', 'Last night I', 'was', 'were', 'very tired.'],
    ['🧒🧒😊', 'The children', 'were', 'was', 'happy.'], ['🐶🐶🌳', 'The dogs', 'were', 'was', 'in the garden.'], ['👩🏠', 'My mum', 'was', 'were', 'at home.'],
  ],
  past: [
    ['⚽', 'Yesterday I', 'played', 'play', 'football.'], ['🦁', 'Last week we', 'went', 'go', 'to the zoo.'], ['🎂', 'Yesterday Mum', 'made', 'make', 'a cake.'],
    ['📺', 'Last night we', 'watched', 'watch', 'TV.'], ['🪥', 'Every day I', 'brush', 'brushed', 'my teeth.'], ['🎣', 'Yesterday Dad', 'caught', 'catch', 'a big fish.'],
  ],
  compare: [
    ['🐘🐭', 'An elephant is', 'bigger', 'smaller', 'than a mouse.'], ['🐭🐱', 'A mouse is', 'smaller', 'bigger', 'than a cat.'], ['🦒🐶', 'A giraffe is', 'taller', 'shorter', 'than a dog.'],
    ['🐢🐇', 'A tortoise is', 'slower', 'faster', 'than a rabbit.'], ['✈️🚲', 'A plane is', 'faster', 'slower', 'than a bike.'], ['☀️🌙', 'The sun is', 'hotter', 'colder', 'than the moon.'],
  ],
  future: [
    ['🏖️', 'Tomorrow we', 'will', 'were', 'go to the beach.'], ['🎂', 'Next year I', 'will', 'was', 'be eight.'], ['🌧️', 'If it rains, I', 'will', 'was', 'stay at home.'],
    ['🚀', 'One day I', 'will', 'did', 'fly to the moon.'], ['🛝', 'Yesterday we', 'went', 'will go', 'to the park.'],
  ],
  ever: [
    ['🐫', 'Have you ever', 'ridden', 'rode', 'a camel?'], ['🐋', 'Have you ever', 'seen', 'saw', 'a whale?'], ['🍕', 'I have never', 'eaten', 'ate', 'pizza for breakfast.'],
    ['✈️', 'Have you ever', 'flown', 'flew', 'in a plane?'], ['📚', 'I have', 'done', 'did', 'my homework.'],
  ],
};

/** One sentence of each kind; null when the words for it are missing. */
export function grammarItem(kind: string, lv: number): GItem | null {
  const one = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
  if (kind === 'aan') {
    const ns = nouns(lv).filter((w) => !/^[uh]/.test(w.text));
    const an = ns.filter((w) => article(w.text) === 'an');
    const w = an.length && Math.random() < 0.5 ? one(an) : one(ns);
    if (!w) return null;
    return { kind, pic: h('div', { class: 'g3-pic', 'aria-hidden': 'true' }, wordPicture(w)), before: "It's", after: `${w.text}.`, options: ['a', 'an'], answer: article(w.text) };
  }
  if (kind === 'plural' || kind === 'isare') {
    const ns = nouns(lv).filter((w) => w.image.emoji && !w.text.includes(' ') && plural(w.text));
    const w = one(ns);
    if (!w) return null;
    const n = kind === 'plural' ? one([1, 2, 3, 4]) : one([1, 2, 3, 4, 5]);
    const many = plural(w.text)!;
    const pic = h('div', { class: 'g3-pic gr-count', 'aria-hidden': 'true' }, group(w.image.emoji!, n, `gr-group ${n > 4 ? 'is-five' : ''}`));
    if (kind === 'plural') return { kind, pic, before: `I can see ${numWord(n)}`, after: '.', options: [w.text, many], answer: n === 1 ? w.text : many };
    return { kind, pic, before: 'There', after: `${numWord(n)} ${n === 1 ? w.text : many}.`, options: ['is', 'are'], answer: n === 1 ? 'is' : 'are' };
  }
  if (kind === 'hesh') {
    const [who, he] = one(PEOPLE);
    const [doing, e] = one(DOING);
    return { kind, pic: emojiPic(who + e), before: '', after: doing, options: ['He', 'She'], answer: he };
  }
  if (kind === 'can') {
    const [e, who, verb, yes] = one(CAN);
    return { kind, pic: emojiPic(e), before: who, after: `${verb}.`, options: ['can', "can't"], answer: yes ? 'can' : "can't" };
  }
  if (kind === 'inon') {
    // Starters prepositions with a drawn scene: in, on, under, next to, behind, in front of
    const PREP = ['in', 'on', 'under', 'next to', 'behind', 'in front of'];
    const ws = topics.flatMap((t) => t.words).filter((w) => PREP.includes(w.image.scene ?? '') && new RegExp(`\\b${w.text}\\b`).test(w.sentence));
    const w = one(ws.filter((x, i) => ws.findIndex((y) => y.text === x.text) === i));
    if (!w) return null;
    const [before, after] = w.sentence.split(new RegExp(`\\b${w.text}\\b`));
    // in/on/under first; the longer ones are offered with two others
    const options = ['in', 'on', 'under'].includes(w.text) ? ['in', 'on', 'under'] : [w.text, ...shuffle(PREP.filter((x) => x !== w.text)).slice(0, 2)];
    return { kind, pic: h('div', { class: 'g3-pic', 'aria-hidden': 'true' }, wordPicture(w)), before: before.trim(), after: after.trim(), options, answer: w.text };
  }
  const list = FIXED[kind];
  if (!list) return null;
  const [e, before, answer, other, after] = one(list);
  return { kind, pic: emojiPic(e), before, after, options: [answer, other], answer };
}

/** The kinds of sentence for this level (Starters: 6; Movers adds 3; Flyers 2 more). */
export const grammarKinds = (lv: number) => [
  ...(lv >= 2 ? ['aan', 'plural', 'isare', 'hesh', 'can', 'inon'] : []),
  ...(lv >= 3 ? ['was', 'past', 'compare'] : []),
  ...(lv >= 4 ? ['future', 'ever'] : []),
];

export function grammarGame(ctx: Ctx): HTMLElement {
  const lv = levelIndex();
  const ROUNDS = 8;
  // the newest kinds of the level come up more often
  const kinds = grammarKinds(Math.max(2, lv));
  const fresh = lv >= 3 ? kinds.slice(lv >= 4 ? -2 : -3) : [];
  const order = shuffle([...shuffle(kinds), ...fresh]).slice(0, ROUNDS);
  while (order.length < ROUNDS) order.push(kinds[order.length % kinds.length]);
  const bix = new Bix({ size: 'sm', bubble: false }).setMood('idle');
  const stage = h('div', { class: 'gr-stage' });
  const host = h('div', { class: 'game-body gr-body' }, stage);
  const bar = stars(ROUNDS);

  const round = async (r: number) => {
    if (!ctx.alive()) return;
    if (r >= ROUNDS) return finish(ctx, host, bix, 'grammar', 'Super sentences! Play again?');
    const it = grammarItem(order[r], lv) ?? grammarItem('hesh', lv)!;
    const gap = h('span', { class: 'gr-gap' }, '?');
    const text = h('p', { class: 'gr-text', lang: 'en' }, it.before ? `${it.before} ` : '', gap, it.after.match(/^[.,!?]/) ? it.after : ` ${it.after}`);
    const opts = shuffle(it.options).map((o) => h('button', { class: 'gr-opt pop', 'data-word': o, lang: 'en' }, o));
    const hear = hearButton();
    stage.replaceChildren(h('div', { class: 'gr-round', 'data-answer': it.answer, 'data-kind': it.kind }, it.pic, h('div', { class: 'gr-side' }, text, h('div', { class: 'gr-opts' }, opts), hear)));
    const prompt = `${[it.before, '…', it.after].filter(Boolean).join(' ')} ${it.options.join(' or ')}?`;
    void bix.talk(prompt, 'idle', 'Which word? 🧩');
    for (;;) {
      const t = await once([...opts, hear]);
      if (!ctx.alive()) return;
      if (t === hear) {
        sfx.tap();
        void bix.talk(prompt, 'idle');
        continue;
      }
      if (t.dataset.word === it.answer) {
        sfx.success();
        t.classList.add('is-right');
        opts.forEach((o) => o !== t && o.classList.add('is-faded'));
        gap.textContent = it.answer;
        gap.classList.add('is-filled', 'pop');
        bar.children[r]?.classList.add('on');
        await bix.talk(`${pick(PRAISE)} ${sentence(it.before, it.answer, it.after)}`, 'happy');
        break;
      }
      sfx.soft();
      shake(t);
      t.classList.add('is-faded');
      void bix.talk(it.options.length === 2 ? 'Hmm… try the other one!' : 'Hmm… try again!', 'encourage', 'Try again!');
    }
    await wait(250);
    void round(r + 1);
  };
  setTimeout(() => void round(0), 300);
  const el = shell(ctx, 'grammar', 'Grammar', host, bix);
  el.querySelector('.book-top')?.appendChild(bar);
  return el;
}

/* ================================================================== Maths */

type Thing = { e: string; one: string; many: string; away: string };
const THINGS: Thing[] = [
  { e: '🍎', one: 'apple', many: 'apples', away: 'Bix eats' },
  { e: '🍌', one: 'banana', many: 'bananas', away: 'Bix eats' },
  { e: '🧁', one: 'cake', many: 'cakes', away: 'Bix eats' },
  { e: '🥚', one: 'egg', many: 'eggs', away: 'Bix eats' },
  { e: '🐱', one: 'cat', many: 'cats', away: 'run away' },
  { e: '🐶', one: 'dog', many: 'dogs', away: 'run away' },
  { e: '🐸', one: 'frog', many: 'frogs', away: 'jump away' },
  { e: '🐦', one: 'bird', many: 'birds', away: 'fly away' },
  { e: '🦆', one: 'duck', many: 'ducks', away: 'fly away' },
  { e: '🐝', one: 'bee', many: 'bees', away: 'fly away' },
  { e: '🐟', one: 'fish', many: 'fish', away: 'swim away' },
  { e: '⭐', one: 'star', many: 'stars', away: '' },
  { e: '⚽', one: 'ball', many: 'balls', away: '' },
  { e: '🌸', one: 'flower', many: 'flowers', away: '' },
];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const some = (n: number, t: Thing) => `${numWord(n)} ${n === 1 ? t.one : t.many}`;
const goesAway = (k: number, t: Thing) => (t.away.startsWith('Bix') ? `${t.away} ${numWord(k)}!` : `${cap(numWord(k))} ${t.away}!`);

/** Kinds of question by level: count (3–4 years) … add, take away, 13 or 30? (Movers on). */
export const mathKinds = (lv: number): string[] =>
  lv === 0 ? ['count'] : lv === 1 ? ['count', 'count', 'more'] : lv === 2 ? ['count', 'add', 'take', 'more', 'find'] : ['add', 'take', 'find', 'more', 'count', 'add'];

export function mathsGame(ctx: Ctx): HTMLElement {
  const lv = levelIndex();
  const ROUNDS = 6;
  const kinds = mathKinds(lv);
  const order = Array.from({ length: ROUNDS }, (_, i) => kinds[i % kinds.length]);
  const plan = lv === 0 ? order : shuffle(order);
  const max = lv === 0 ? 5 : lv === 1 ? 10 : lv === 2 ? 10 : 20;
  const bix = new Bix({ size: 'sm', bubble: false }).setMood('idle');
  const stage = h('div', { class: 'mt-stage' });
  const host = h('div', { class: 'game-body mt-body' }, stage);
  const bar = stars(ROUNDS);
  const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
  const numButtons = (answer: number, near: number[]) => {
    const set = new Set([answer]);
    for (const x of shuffle(near)) if (x >= 1 && x <= 100 && set.size < 3) set.add(x);
    for (let d = 1; set.size < 3; d++) set.add(answer + d);
    return shuffle([...set]).map((n) => h('button', { class: 'mt-num pop', 'data-n': String(n), 'aria-label': numWord(n) }, String(n)));
  };

  const round = async (r: number) => {
    if (!ctx.alive()) return;
    if (r >= ROUNDS) return finish(ctx, host, bix, 'maths', 'You are a maths star! Play again?');
    const kind = plan[r];
    const t = THINGS[rnd(0, kind === 'take' ? 10 : THINGS.length - 1)];
    const hear = hearButton();
    let answer = 0;
    let prompt = '';
    let praise = '';
    let again = 'Count again!';
    let options: HTMLElement[] = [];
    let scene: HTMLElement;
    let afterShow: (() => Promise<void>) | null = null;
    let answered = false;

    if (kind === 'count') {
      answer = rnd(lv === 0 ? 1 : 2, lv >= 2 ? 12 : max);
      scene = group(t.e, answer);
      options = numButtons(answer, [answer - 1, answer + 1, answer + 2]);
      prompt = `How many ${t.many}?`;
      praise = `${Array.from({ length: answer }, (_, i) => cap(numWord(i + 1))).join(', ')}. ${cap(some(answer, t))}!`;
    } else if (kind === 'add') {
      const a = rnd(1, Math.floor(max / 2));
      const b = rnd(1, max - a);
      answer = a + b;
      const size = Math.max(a, b) > 10 ? 'is-many' : ''; // both groups the same size
      scene = h('div', { class: 'mt-sum' }, group(t.e, a, size), h('span', { class: 'mt-sign' }, '+'), group(t.e, b, size));
      options = numButtons(answer, [answer - 1, answer + 1, a, b]);
      prompt = `${cap(some(a, t))} and ${some(b, t)}. How many ${t.many}?`;
      praise = `${cap(numWord(a))} and ${numWord(b)} is ${numWord(answer)}!`;
      again = 'Count them all!';
    } else if (kind === 'take') {
      const n = rnd(3, max);
      const k = rnd(1, Math.min(n - 1, lv >= 3 ? 9 : 4));
      answer = n - k;
      const g = group(t.e, n);
      scene = g;
      options = numButtons(answer, [answer - 1, answer + 1, n]);
      prompt = `How many ${t.many} now?`;
      praise = `${cap(numWord(n))} take away ${numWord(k)} is ${numWord(answer)}!`;
      again = 'Count the ones that are left!';
      afterShow = async () => {
        await bix.talk(`${cap(some(n, t))}.`, 'idle');
        if (!ctx.alive() || answered) return;
        [...g.children].slice(-k).forEach((x) => x.classList.add('is-gone'));
        sfx.pop();
        if (!answered) await bix.talk(`${goesAway(k, t)} ${prompt}`, 'idle', `${prompt} 🤔`);
      };
    } else if (kind === 'more') {
      const a = rnd(1, max - 1);
      let b = rnd(1, max);
      while (b === a) b = rnd(1, max);
      answer = Math.max(a, b);
      const left = h('button', { class: 'mt-pick pop', 'data-n': String(a), 'aria-label': String(a) }, group(t.e, a, 'is-small'));
      const right = h('button', { class: 'mt-pick pop', 'data-n': String(b), 'aria-label': String(b) }, group(t.e, b, 'is-small'));
      scene = h('div', { class: 'mt-picks' }, left, right);
      options = [left, right];
      prompt = `Which has more ${t.many}?`;
      praise = `${cap(numWord(answer))} is more than ${numWord(Math.min(a, b))}!`;
      again = 'Count them!';
    } else {
      // find the number: teens for Starters; 13 or 30? from Movers
      const n = lv >= 3 ? rnd(13, 19) : rnd(11, 20);
      answer = n;
      scene = h('div', { class: 'mt-ear', 'aria-hidden': 'true' }, '👂');
      options = numButtons(n, lv >= 3 ? [(n % 10) * 10, n - 10, n + 1] : [n - 10, n + 1, n - 1]);
      prompt = `Find number ${numWord(n)}!`;
      praise = `${cap(numWord(n))}!`;
      again = '';
    }
    stage.replaceChildren(h('div', { class: 'mt-round', 'data-kind': kind, 'data-answer': String(answer) }, h('div', { class: 'mt-scene' }, scene), h('div', { class: 'mt-side' }, kind === 'more' ? null : h('div', { class: 'mt-nums' }, options), hear)));
    // the buttons work at once, also while Bix shows the "take away"
    if (afterShow) void afterShow();
    else void bix.talk(prompt, 'idle', `${prompt} 🤔`);
    for (;;) {
      if (!ctx.alive()) return;
      const p = await once([...options, hear]);
      if (!ctx.alive()) return;
      if (p === hear) {
        sfx.tap();
        void bix.talk(prompt, 'idle');
        continue;
      }
      if (Number(p.dataset.n) === answer) {
        answered = true;
        sfx.success();
        p.classList.add('is-right');
        stage.querySelectorAll('.mt-item').forEach((x, i) => i >= answer && kind === 'take' && x.classList.add('is-gone'));
        bar.children[r]?.classList.add('on');
        stage.querySelector('.mt-round')?.classList.add('is-counted');
        await bix.talk(`${pick(PRAISE)} ${praise}`, 'happy', `${answer} ✓`);
        break;
      }
      sfx.soft();
      shake(p);
      const n = Number(p.dataset.n);
      void bix.talk(kind === 'find' ? `That's ${numWord(n)}. Listen… ${numWord(answer)}!` : `Hmm… ${again}`, 'encourage', 'Try again!');
    }
    await wait(250);
    void round(r + 1);
  };
  setTimeout(() => void round(0), 300);
  const el = shell(ctx, 'maths', 'Maths', host, bix);
  el.querySelector('.book-top')?.appendChild(bar);
  return el;
}

/* ================================================================== Sort it! */

type Cat = { id: string; icon: string; name: string; many: string; topics: string[] };
export const CATS: Cat[] = [
  { id: 'animals', icon: '🐾', name: 'Animals', many: 'animals', topics: ['animals', 'animals2', 'animals3', 'zoo', 'farm', 'wild'] },
  { id: 'food', icon: '🍽️', name: 'Food', many: 'food', topics: ['food', 'food2', 'food3', 'food4', 'fruit', 'meals'] },
  { id: 'clothes', icon: '👕', name: 'Clothes', many: 'clothes', topics: ['clothes', 'clothes2', 'clothes3'] },
  { id: 'toys', icon: '🧸', name: 'Toys', many: 'toys', topics: ['toys', 'toys2'] },
  { id: 'transport', icon: '🚦', name: 'Transport', many: 'transport', topics: ['transport', 'transport3'] },
  { id: 'body', icon: '🧍', name: 'Body', many: 'parts of the body', topics: ['body', 'body2'] },
  { id: 'colours', icon: '🎨', name: 'Colours', many: 'colours', topics: ['colors', 'colours2'] },
  { id: 'numbers', icon: '🔢', name: 'Numbers', many: 'numbers', topics: ['numbers', 'numbers2'] },
  { id: 'family', icon: '🏠', name: 'Family', many: 'people in the family', topics: ['family', 'family2'] },
  { id: 'weather', icon: '⛅', name: 'Weather', many: 'weather words', topics: ['weather', 'weather2'] },
  { id: 'feelings', icon: '💛', name: 'Feelings', many: 'feelings', topics: ['feelings', 'feelings2'] },
  { id: 'sports', icon: '🏅', name: 'Sports', many: 'sports', topics: ['sports', 'sports3'] },
  { id: 'jobs', icon: '🧑‍🔧', name: 'Jobs', many: 'jobs', topics: ['jobs', 'jobs3'] },
];
/** Words that could go in two baskets (a chicken is an animal and food; a toy car is transport…). */
const TWO_BASKETS = new Set(['chicken', 'orange', 'train', 'car', 'guitar', 'piano', 'camera', 'game', 'handbag', 'teacher', 'baby', 'ice', 'sea', 'fish', 'ball', 'watch', 'glasses']);

/** Words of each basket the child can know by now (levels up to this one). */
export function sortPool(lv: number): Map<Cat, Word[]> {
  const out = new Map<Cat, Word[]>();
  for (const w of wordsUpTo(lv)) {
    if (TWO_BASKETS.has(w.text.toLowerCase())) continue;
    const c = CATS.find((x) => x.topics.includes(bankTopic(w)));
    if (c) out.set(c, [...(out.get(c) ?? []), w]);
  }
  for (const [c, ws] of out) if (ws.length < 3) out.delete(c);
  return out;
}

export function sortGame(ctx: Ctx): HTMLElement {
  const lv = levelIndex();
  const pool = sortPool(lv);
  const cats = shuffle([...pool.keys()]);
  if (cats.length < 2) {
    queueMicrotask(() => ctx.go('games'));
    return h('main');
  }
  const [A, B] = cats;
  const cards = shuffle([...pool.get(A)!.slice(0, 3), ...pool.get(B)!.slice(0, 3)]);
  const ODD = lv === 0 ? 0 : 3;
  const ROUNDS = cards.length + ODD;
  const bix = new Bix({ size: 'sm', bubble: false }).setMood('idle');
  const stage = h('div', { class: 'so-stage' });
  const host = h('div', { class: 'game-body so-body' }, stage);
  const bar = stars(ROUNDS);
  let r = 0;

  const basket = (c: Cat) =>
    h('button', { class: 'so-basket pop', 'data-cat': c.id, 'aria-label': c.name }, h('span', { class: 'so-basket-icon', 'aria-hidden': 'true' }, c.icon), h('span', { class: 'so-basket-name', lang: 'en' }, c.name), h('span', { class: 'so-in' }));
  const sorting = async () => {
    const bA = basket(A);
    const bB = basket(B);
    const spot = h('div', { class: 'so-card' });
    const hear = hearButton();
    stage.replaceChildren(h('div', { class: 'so-round', 'data-phase': 'sort' }, bA, h('div', { class: 'so-mid' }, spot, hear), bB));
    for (const w of cards) {
      if (!ctx.alive()) return;
      const right = pool.get(A)!.includes(w) ? bA : bB;
      spot.replaceChildren(h('div', { class: 'so-word pop', 'data-word': w.text, 'data-cat': right.dataset.cat }, wordPicture(w)));
      const prompt = `${w.text}! ${A.name} or ${B.name}?`;
      void bix.talk(prompt, 'idle', `${A.icon} or ${B.icon}?`);
      for (;;) {
        const t = await once([bA, bB, hear]);
        if (!ctx.alive()) return;
        if (t === hear) {
          sfx.tap();
          void say(w.text);
          continue;
        }
        if (t === right) {
          sfx.success();
          const c = t === bA ? A : B;
          t.querySelector('.so-in')!.appendChild(h('span', { class: 'so-mini pop' }, wordPicture(w)));
          spot.replaceChildren();
          bar.children[r++]?.classList.add('on');
          await bix.talk(`${pick(PRAISE)} ${w.text}. ${c.name}!`, 'happy');
          break;
        }
        sfx.soft();
        shake(t);
        void bix.talk(`Hmm… ${w.text}. Look again!`, 'encourage', 'Try again!');
      }
    }
  };
  const oddOne = async () => {
    const [main, other] = shuffle(cats).slice(0, 2);
    const three = shuffle(pool.get(main)!).slice(0, 3);
    const odd = shuffle(pool.get(other)!)[0];
    const opts = shuffle([...three, odd]).map((w) => h('button', { class: 'so-odd pop', 'data-word': w.text, 'aria-label': w.text }, wordPicture(w)));
    const hear = hearButton();
    stage.replaceChildren(h('div', { class: 'so-round', 'data-phase': 'odd', 'data-answer': odd.text }, h('div', { class: 'so-odds' }, opts), hear));
    const prompt = 'Which one is different?';
    void bix.talk(prompt, 'idle', 'Which one is different? 🤔');
    for (;;) {
      const t = await once([...opts, hear]);
      if (!ctx.alive()) return;
      if (t === hear) {
        sfx.tap();
        void bix.talk(prompt, 'idle');
        continue;
      }
      if (t.dataset.word === odd.text) {
        sfx.success();
        t.classList.add('is-right');
        bar.children[r++]?.classList.add('on');
        await bix.talk(`${pick(PRAISE)} The ${odd.text} is different! The others are ${main.many}.`, 'happy', `${other.icon} ✓`);
        break;
      }
      sfx.soft();
      shake(t);
      void bix.talk(`The ${t.dataset.word} goes with the others. Look again!`, 'encourage', 'Try again!');
    }
  };

  setTimeout(async () => {
    if (!ctx.alive()) return;
    await bix.talk(`Let's sort! ${A.name} here, ${B.name} there!`, 'happy', 'Sort it! 🧺');
    await sorting();
    for (let i = 0; i < ODD && ctx.alive(); i++) {
      await wait(250);
      if (!ctx.alive()) return;
      await oddOne();
    }
    if (ctx.alive()) finish(ctx, host, bix, 'sort', 'Super sorting! Play again?');
  }, 300);
  const el = shell(ctx, 'sort', 'Sort it!', host, bix);
  el.querySelector('.book-top')?.appendChild(bar);
  return el;
}
