import type { Topic } from '../content';
import { h } from '../lib/dom';
import { say } from '../lib/tts';

/** "Chơi cùng con": a small card for parents — one thing to try at home today. */
export function tipCard(t: Topic, open = false): HTMLElement | null {
  const tip = t.parentTip;
  if (!tip) return null;
  const body = h(
    'div',
    { class: 'tip-body', hidden: !open },
    h('p', {}, tip.vi),
    h(
      'p',
      { class: 'tip-say' },
      'Bố mẹ nói: ',
      h('b', { lang: 'en' }, `“${tip.say}”`),
      ' ',
      h('button', { class: 'tip-hear', 'aria-label': 'Nghe câu tiếng Anh', onclick: () => void say(tip.say) }, '🔊'),
    ),
  );
  const head = h(
    'button',
    {
      class: 'tip-head',
      'aria-expanded': String(open),
      onclick: () => {
        body.hidden = !body.hidden;
        head.setAttribute('aria-expanded', String(!body.hidden));
      },
    },
    `👨‍👩‍👧 Chơi cùng con · ${t.icon} ${t.titleVi}`,
  );
  return h('aside', { class: 'tip-card', lang: 'vi' }, head, body);
}
