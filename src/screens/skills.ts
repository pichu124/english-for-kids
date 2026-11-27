import { h } from '../lib/dom';
import type { Level } from '../content';
import { skillSummary, weakest } from '../lib/skills';

/** The four-skills card (parent area and weekly report): a bar per skill and what to do next. */
export function skillsCard(level: Level, compact = false): HTMLElement {
  const skills = skillSummary(level);
  const next = weakest(skills);
  return h(
    'div',
    { class: `sk ${compact ? 'sk-compact' : ''}`, lang: 'vi' },
    h(
      'div',
      { class: 'sk-grid' },
      skills.map((sk) =>
        h(
          'div',
          { class: `sk-item ${sk === next ? 'is-next' : ''}`, 'data-skill': sk.id },
          h('div', { class: 'sk-head' }, h('span', { class: 'sk-icon', 'aria-hidden': 'true' }, sk.icon), h('b', {}, sk.name), h('span', { class: 'sk-pct' }, `${Math.round(sk.share * 100)}%`)),
          h('div', { class: 'sk-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(sk.share * 100)), 'aria-label': sk.name }, h('span', { style: `width:${Math.round(sk.share * 100)}%` })),
          compact ? null : sk.facts.map((f) => h('p', { class: 'sk-fact' }, f)),
        ),
      ),
    ),
    h('p', { class: 'sk-tip' }, `👉 Nên tập thêm: ${next.icon} ${next.name}. ${next.tip}`),
    compact ? null : h('p', { class: 'p-muted' }, `Tính trên các bài của ${level.nameVi}. Phần trăm là phần việc của bậc này bé đã làm được, không phải điểm thi.`),
  );
}
