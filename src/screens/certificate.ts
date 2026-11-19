import { Bix } from '../art/bix';
import { levelById, topicsOfLevel } from '../content';
import { h } from '../lib/dom';
import { levelDone, levelDoneOn } from '../lib/progress';
import { sfx } from '../lib/sfx';
import { getState } from '../lib/storage';
import { say } from '../lib/tts';
import type { Ctx } from '../router';
import { confetti } from './widgets';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const nice = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return y ? `${d} ${MONTHS[m - 1]} ${y}` : '';
};

/**
 * Printable certificate for finishing every island of a level.
 * It is a family/school keepsake, not an official Cambridge certificate — the wording says so.
 */
export function certificateScreen(ctx: Ctx): HTMLElement {
  const level = levelById(ctx.params.level ?? '');
  const back = () => ctx.go((ctx.params.from as 'parent' | 'book') || 'book');
  if (!level || !levelDone(level.id)) {
    queueMicrotask(back);
    return h('main');
  }
  const name = getState().childName.trim() || 'Our Super Learner';
  const units = topicsOfLevel(level.id);
  const bix = new Bix({ size: 'md', bubble: false }).setMood('happy');

  const cert = h(
    'article',
    { class: 'cert', 'aria-label': 'Certificate' },
    h('div', { class: 'cert-inner' },
      h('div', { class: 'cert-top', 'aria-hidden': 'true' }, '⭐ ⭐ ⭐'),
      h('h1', { class: 'cert-title' }, 'Certificate'),
      h('p', { class: 'cert-sub' }, 'This certificate is proudly given to'),
      h('p', { class: 'cert-name' }, name),
      h('p', { class: 'cert-what' }, `for finishing all ${units.length} islands of`),
      h('p', { class: 'cert-level' }, `Bix English · ${level.name}`),
      h('p', { class: 'cert-small' }, `Ages ${level.ages} · topics based on ${level.framework}`),
      h('div', { class: 'cert-icons', 'aria-hidden': 'true' }, units.map((u) => h('span', {}, u.icon))),
      h('div', { class: 'cert-foot' },
        h('div', { class: 'cert-sign' }, h('span', { class: 'cert-line' }), 'Date', h('b', {}, nice(levelDoneOn(level.id)))),
        h('div', { class: 'cert-bix' }, bix.el),
        h('div', { class: 'cert-sign' }, h('span', { class: 'cert-line' }), 'Signed (parent / teacher)'),
      ),
    ),
  );
  const actions = h(
    'div',
    { class: 'cert-actions' },
    h('button', { class: 'btn btn-round btn-home', 'aria-label': 'Back', onclick: () => (sfx.tap(), back()) }, '◀'),
    h('button', { class: 'p-btn cert-print', lang: 'vi', onclick: () => window.print() }, '🖨️ In hoặc lưu PDF'),
  );
  setTimeout(() => {
    if (!ctx.alive()) return;
    confetti(document.body, 50);
    void say(`Congratulations, ${name}! You finished ${level.name}!`);
  }, 300);
  return h('main', { class: 'cert-page' }, actions, cert);
}
