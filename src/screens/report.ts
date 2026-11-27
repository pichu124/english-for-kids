import { h } from '../lib/dom';
import { weekReport } from '../lib/progress';
import { getState } from '../lib/storage';
import type { Ctx } from '../router';
import { wordPicture } from './lesson/shared';
import { currentLevel } from '../lib/level';
import { skillsCard } from './skills';

const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const vn = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d}/${m}/${y}`;
};

/** Weekly report for parents (Vietnamese), printable on A4 portrait or saved as PDF. */
/** "Tuần này bé học 2 nhóm âm, tập viết 5 chữ." — only what was done (never "0 lượt"). */
function said(parts: [number, string, string][], start: string, none: string): string {
  const done = parts.filter(([n]) => n > 0).map(([n, verb, unit]) => `${verb} ${n} ${unit}`);
  return done.length ? `${start} ${done.join(', ')}.` : none;
}

export function reportScreen(ctx: Ctx): HTMLElement {
  const r = weekReport();
  const name = getState().childName.trim() || 'bé';
  const chip = (word: { word: Parameters<typeof wordPicture>[0] }) =>
    h('span', { class: 'rp-word' }, h('span', { class: 'rp-pic' }, wordPicture(word.word)), h('span', { lang: 'en' }, word.word.text));
  const tips = r.recentTopics.filter((t) => t.parentTip).slice(0, 2);
  const attempts = r.spoken.auto + r.spoken.parent + r.spoken.miss;

  const doc = h(
    'article',
    { class: 'rp', 'aria-label': 'Báo cáo tuần' },
    h('header', { class: 'rp-head' }, h('h1', {}, `Báo cáo tuần của ${name}`), h('p', {}, `Bix English · ${vn(r.from)} – ${vn(r.to)}`)),
    h(
      'section',
      { class: 'rp-stats' },
      h('div', { class: 'rp-stat' }, h('b', {}, `${r.learnedDays}/7`), h('span', {}, 'ngày có học')),
      h('div', { class: 'rp-stat' }, h('b', {}, `${r.minutes}`), h('span', {}, 'phút học')),
      h('div', { class: 'rp-stat' }, h('b', {}, `${r.lessons}`), h('span', {}, 'lượt học xong (bài, ôn, phần đọc–viết)')),
      h('div', { class: 'rp-stat' }, h('b', {}, `${r.newWords.length}`), h('span', {}, 'từ mới thành sticker')),
    ),
    h(
      'section',
      { class: 'rp-days' },
      r.days.map((d) => {
        const wd = WD[new Date(d.day + 'T12:00:00').getDay()];
        return h('div', { class: `rp-day ${d.lessons ? 'is-on' : ''}` }, h('span', {}, wd), h('b', {}, d.lessons ? '🌱' : '·'), h('small', {}, d.minutes ? `${d.minutes}′` : ''));
      }),
    ),
    h('section', { class: 'rp-skills' }, h('h2', {}, '📊 4 kỹ năng'), skillsCard(currentLevel(), true)),
    h(
      'section',
      { class: 'rp-extra' },
      h('h2', {}, '🔊 Âm, đọc to, tập viết & trò chuyện'),
      h('p', {}, said([[r.extra.sounds, 'học', 'nhóm âm'], [r.extra.read, 'tự đọc to', 'trang'], [r.extra.letters, 'tập viết', 'chữ'], [r.extra.talk, 'trò chuyện / luyện nói với Bix', 'lần']], 'Tuần này bé', 'Tuần này bé chưa luyện âm, đọc to, tập viết hay trò chuyện. Thử ABC → 🔊 Sounds hoặc ✏️ Write, nút 🎤 My turn trong truyện, hoặc 💬 Talk.')),
    ),
    h(
      'section',
      { class: 'rp-extra' },
      h('h2', {}, '🧒👩 Cùng bố mẹ'),
      h('p', {}, said([[r.extra.duo, 'chơi cùng nhau', 'lượt'], [r.extra.sheets, 'in', 'phiếu bài tập']], 'Tuần này cả nhà', 'Tuần này chưa chơi cùng nhau. Thử Games → 🧒👩 Play Together (2 người trên một máy), hoặc in một phiếu bài tập ở khu bố mẹ.')),
    ),
    h('section', {}, h('h2', {}, '⭐ Từ mới tuần này'), r.newWords.length ? h('div', { class: 'rp-words' }, r.newWords.slice(0, 24).map(chip)) : h('p', { class: 'rp-muted' }, 'Tuần này chưa có từ mới. Mỗi ngày một bài ngắn là đủ.')),
    h(
      'section',
      {},
      h('h2', {}, '🔁 Từ nên chơi lại'),
      r.practise.length
        ? h('div', { class: 'rp-words' }, r.practise.map(chip))
        : h('p', { class: 'rp-muted' }, 'Tuần này bé chọn đúng ngay hầu hết các từ.'),
      r.practise.length ? h('p', { class: 'rp-muted' }, 'Bé từng phải thử lại với các từ này. Chỉ đồ vật thật hoặc tranh và hỏi bằng tiếng Anh, ví dụ "Where is the …?". App cũng sẽ đưa chúng vào phần ôn.') : null,
    ),
    tips.length
      ? h(
          'section',
          {},
          h('h2', {}, '👨‍👩‍👧 Chơi cùng con tuần tới'),
          h('ul', { class: 'rp-tips' }, tips.map((t) => h('li', {}, h('b', {}, `${t.icon} ${t.titleVi}: `), t.parentTip!.vi, ' Bố mẹ nói: ', h('i', { lang: 'en' }, `“${t.parentTip!.say}”`)))),
        )
      : null,
    attempts
      ? h('p', { class: 'rp-muted rp-foot' }, `Phần nói: ${attempts} lượt, máy tự nhận ${r.spoken.auto}, bố mẹ xác nhận ${r.spoken.parent}, chưa được ${r.spoken.miss}.`)
      : null,
    h('p', { class: 'rp-muted rp-foot' }, 'Số liệu chỉ lưu trên máy này, không gửi đi đâu.'),
  );

  return h(
    'main',
    { class: 'rp-page', lang: 'vi' },
    h(
      'div',
      { class: 'rp-actions' },
      h('button', { class: 'p-btn', onclick: () => ctx.go('parent', { back: 'report' }) }, '← Khu bố mẹ'),
      h('button', { class: 'p-btn p-btn-main rp-print', onclick: () => window.print() }, '🖨️ In hoặc lưu PDF'),
    ),
    doc,
  );
}
