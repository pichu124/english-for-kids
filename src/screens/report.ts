import { h } from '../lib/dom';
import { weekReport } from '../lib/progress';
import { getState } from '../lib/storage';
import type { Ctx } from '../router';
import { wordPicture } from './lesson/shared';

const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const vn = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d}/${m}/${y}`;
};

/** Weekly report for parents (Vietnamese), printable on A4 portrait or saved as PDF. */
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
    h(
      'section',
      { class: 'rp-extra' },
      h('h2', {}, '🔊 Âm, đọc to & trò chuyện'),
      h('p', {}, r.extra.sounds || r.extra.read || r.extra.talk ? `Tuần này bé học ${r.extra.sounds} nhóm âm, tự đọc to ${r.extra.read} trang, trò chuyện / luyện nói với Bix ${r.extra.talk} lần.` : 'Tuần này bé chưa luyện âm, đọc to hay trò chuyện. Thử ABC → 🔊 Sounds, nút 🎤 My turn trong truyện, hoặc 💬 Talk.'),
    ),
    h(
      'section',
      { class: 'rp-extra' },
      h('h2', {}, '🧒👩 Cùng bố mẹ'),
      h('p', {}, r.extra.duo || r.extra.sheets ? `Tuần này cả nhà chơi cùng nhau ${r.extra.duo} lượt, in ${r.extra.sheets} phiếu bài tập.` : 'Tuần này chưa chơi cùng nhau. Thử Games → 🧒👩 Play Together (2 người trên một máy), hoặc in một phiếu bài tập ở khu bố mẹ.'),
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
