import { Bix } from '../art/bix';
import { islandSVG } from '../art/cube';
import { topicsOfLevel, type Topic } from '../content';
import { currentLevel } from '../lib/level';
import { buildReview, REVIEW_ID } from '../lib/review';
import { fromHTML, h } from '../lib/dom';
import { sfx } from '../lib/sfx';
import { getState } from '../lib/storage';
import { say } from '../lib/tts';
import { limitReached } from '../lib/usage';
import type { Ctx, ScreenName } from '../router';
import { learningDays, lessonsDone, stickerCount } from '../lib/progress';
import { gardenHasNew } from './garden';
import { storyOpen } from './stories';
import { storiesOfLevel } from '../content';
import { unlockedItems } from '../art/outfit';
import { confetti, parentButton } from './widgets';
import { answerChat, chatToday, greeting, levelToCelebrate, markCelebrated } from '../lib/memory';

let greetedThisSession = false;

export function homeScreen(ctx: Ctx): HTMLElement {
  if (limitReached()) {
    queueMicrotask(() => ctx.go('rest'));
    return h('main');
  }
  const s = getState();
  const level = currentLevel();
  const topics = topicsOfLevel(level.id);
  const name = s.childName.trim();
  const bix = new Bix({ size: 'md' }).setMood('hello');
  const hi = name ? `Hi, ${name}!` : 'Hi there!';
  bix.show(hi);

  // Suggest the first topic not yet done, else the least practiced one.
  const next =
    topics.find((t) => !s.topics[t.id]?.completed) ??
    [...topics].sort((a, b) => (s.topics[a.id]?.completed ?? 0) - (s.topics[b.id]?.completed ?? 0))[0];

  const islands = topics.map((t, i) => {
    const done = (s.topics[t.id]?.completed ?? 0) > 0;
    const btn = h(
      'button',
      {
        class: `island ${done ? 'is-done' : ''} ${t === next ? 'is-next' : ''}`,
        style: `--i:${i}`,
        'aria-label': t.title,
        onclick: () => {
          sfx.tap();
          ctx.go('lesson', { topic: t.id });
        },
      },
      fromHTML(islandSVG(t.color)),
      h('span', { class: 'island-icon', 'aria-hidden': 'true' }, t.icon),
      done ? h('span', { class: 'island-star', 'aria-label': 'done' }, '⭐') : null,
      h('span', { class: 'island-name' }, t.title),
    );
    return btn;
  });

  // Words due for review: a special island first on the map.
  const review = buildReview(level.id);
  if (review) {
    islands.unshift(
      h(
        'button',
        {
          class: 'island island-review',
          style: '--i:0',
          'aria-label': 'Review',
          onclick: () => {
            sfx.tap();
            ctx.go('lesson', { topic: REVIEW_ID });
          },
        },
        fromHTML(islandSVG('#ffd166')),
        h('span', { class: 'island-icon', 'aria-hidden': 'true' }, '🔁'),
        h('span', { class: 'island-name' }, `Review · ${review.topic.words.length}`),
      ),
    );
  }

  const totalBlocks = s.blocks.totalEarned;
  const dockBtn = (icon: string, label: string, go: ScreenName, badge?: number | string, isNew = false) =>
    h(
      'button',
      {
        class: `dock-btn ${isNew ? 'is-new' : ''}`,
        'aria-label': label,
        onclick: () => {
          sfx.tap();
          ctx.go(go);
        },
      },
      h('span', { class: 'dock-icon', 'aria-hidden': 'true' }, icon),
      h('span', {}, label),
      badge ? h('span', { class: 'badge' }, String(badge)) : null,
    );
  const stickers = stickerCount(level.id).got;
  const newStories = storiesOfLevel(level.id).filter((st) => storyOpen(st) && !getState().storiesRead?.[st.id]).length;
  const newClothes = unlockedItems(lessonsDone()).length - (getState().outfitSeen ?? 0);
  const dock = h(
    'nav',
    { class: 'home-dock', 'aria-label': 'Menu' },
    dockBtn('🧱', 'My World', 'world', totalBlocks || undefined),
    dockBtn('📖', 'My Words', 'book', stickers || undefined),
    dockBtn('👕', 'Bix', 'wardrobe', newClothes ? 'NEW' : undefined, newClothes > 0),
    level.showText ? dockBtn('🔤', 'ABC', 'abc') : null,
    dockBtn('📚', 'Stories', 'stories', newStories || undefined, newStories > 0),
    dockBtn('🎮', 'Games', 'games'),
    dockBtn('🌻', 'Garden', 'garden', learningDays().length || undefined, gardenHasNew()),
  );

  const el = h(
    'main',
    { class: 'home' },
    h('header', { class: 'home-top' }, h('div', { class: 'home-bix', onclick: () => void say(hi) }, bix.el), dock, parentButton(ctx)),
    h('section', { class: `map map-n${Math.min(topics.length, 6)} ${islands.length >= 8 ? 'map-many' : ''}`, 'aria-label': 'Topics', style: `--n:${topics.length}` }, h('div', { class: 'map-path', 'aria-hidden': 'true' }), islands),
    h('div', { class: 'home-level', 'aria-label': 'Level' }, level.name),
  );

  requestAnimationFrame(() => el.querySelector('.island.is-next')?.scrollIntoView({ inline: 'center', block: 'nearest' }));
  setTimeout(async () => {
    if (!ctx.alive()) return;
    if (levelToCelebrate(level)) {
      markCelebrated(level);
      confetti(document.body, 60);
      sfx.reward();
      await bix.talk(`Wow! You finished all the ${level.name} islands! You are a star!`, 'happy', '🌟 You are a star!');
      if (!ctx.alive()) return;
      const cert = h('button', { class: 'chat-box cert-btn pop', 'aria-label': 'Certificate', onclick: () => (sfx.tap(), ctx.go('certificate', { level: level.id, from: 'home' })) }, '🏆');
      el.querySelector('.home-top')?.appendChild(cert);
      await bix.talk('Here is your certificate! Tap the cup!', 'happy', 'Tap the cup!');
      return;
    }
    const first = !greetedThisSession;
    greetedThisSession = true;
    await bix.talk(first ? greeting(hi) : `${hi} Pick an island!`, 'idle', hi);
    const chat = first ? chatToday() : null;
    if (chat?.chat && ctx.alive()) askChat(chat);
  }, 350);

  /** Bix asks a yes/no question about something the child learned; big 👍 / 👎 answers. */
  function askChat(t: Topic) {
    const c = t.chat!;
    const reply = (answer: 'yes' | 'no' | null) => {
      box.remove();
      answerChat(t, answer);
      if (!answer) return;
      sfx.pop();
      void bix.talk(answer === 'yes' ? c.yes : c.no, answer === 'yes' ? 'happy' : 'idle');
    };
    const yes = h('button', { class: 'chat-btn chat-yes', 'aria-label': 'Yes', onclick: () => reply('yes') }, '👍');
    const no = h('button', { class: 'chat-btn chat-no', 'aria-label': 'No', onclick: () => reply('no') }, '👎');
    const box = h('div', { class: 'chat-box pop' }, yes, no);
    ctx.onCleanup(() => box.isConnected && answerChat(t, null));
    el.querySelector('.home-top')?.appendChild(box);
    void bix.talk(c.ask, 'listen');
  }

  return el;
}
