import { Bix } from '../art/bix';
import { topicById, type Word } from '../content';
import { h } from '../lib/dom';
import { buildWorksheet, type Section } from '../lib/worksheet';
import type { Ctx } from '../router';
import { wordPicture } from './lesson/shared';

const ABC = 'ABCDEFGHIJ';
const vn = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d}/${m}/${y}`;
};

/** English instruction for the child + a short Vietnamese line for the parent. */
const TITLES: Record<Section['kind'], [string, string]> = {
  colour: ['Colour the pictures.', 'Bé tô màu bức tranh lớn, có thể tô theo hình mẫu nhỏ.'],
  same: ['Match the same pictures.', 'Bé nối hai hình giống nhau.'],
  circle: ['Listen and circle.', 'Bố mẹ đọc to từng dòng (xem trang đáp án), bé khoanh hình Bix nói.'],
  match: ['Look and match.', 'Bé nối hình với chữ.'],
  trace: ['Trace and write.', 'Bé tô theo nét chấm, rồi tự viết lại trên dòng bên cạnh.'],
  write: ['Look and write.', 'Nhìn hình, viết từ vào ô, mỗi ô một chữ cái.'],
  search: ['Find the words.', 'Tìm và khoanh các từ trong bảng chữ (đọc ngang → hoặc dọc ↓).'],
  gaps: ['Read and write the missing words.', 'Đọc câu, chọn từ trong khung để viết vào chỗ trống.'],
  define: ['Read and write the word.', 'Đọc lời giải thích, chọn từ trong khung và viết ra.'],
  text: ['Read and circle the answer.', 'Đọc đoạn văn, khoanh câu trả lời.'],
};

/** SVG filter: the picture's silhouette as a dark outline over a very light grey copy — a picture to colour in. */
const OUTLINE = `<svg width="0" height="0" aria-hidden="true"><filter id="ws-outline" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
  <feMorphology in="SourceAlpha" operator="dilate" radius="2.5" result="fat"/>
  <feComposite in="fat" in2="SourceAlpha" operator="out" result="ring"/>
  <feFlood flood-color="#1d2440"/>
  <feComposite in2="ring" operator="in" result="ink"/>
  <feColorMatrix in="SourceGraphic" type="matrix" values="0.2 0.4 0.1 0 0.62  0.2 0.4 0.1 0 0.62  0.2 0.4 0.1 0 0.62  0 0 0 0.45 0" result="light"/>
  <feMerge><feMergeNode in="light"/><feMergeNode in="ink"/></feMerge>
</filter></svg>`;

const pic = (w: Word, cls = '') => h('span', { class: `ws-pic ${cls}` }, wordPicture(w));

/** Letters as boxes; spaces stay gaps, hyphens/apostrophes are printed. */
function letterBoxes(text: string, given: number, fill = false): HTMLElement {
  let letters = 0;
  return h(
    'span',
    { class: 'ws-boxes', 'aria-label': fill ? text : `${text.length} letters` },
    [...text].map((ch) => {
      if (ch === ' ') return h('span', { class: 'ws-gap' });
      // accented letters (café) are still letters to write, not marks printed in
      if (!/[a-z]/i.test(ch.normalize('NFD').charAt(0))) return h('span', { class: 'ws-box is-mark' }, ch);
      const show = fill || letters++ < given;
      return h('span', { class: `ws-box ${show && !fill ? 'is-given' : ''}` }, show ? ch : '');
    }),
  );
}

/** A word in a dotted outline font to trace, on handwriting lines. */
function traceWord(text: string): HTMLElement {
  // Drawn 1:1 in px on the same handwriting lines as the copy line (CSS .ws-trace, .ws-lines).
  const size = text.length > 10 ? 36 : 44;
  const w = Math.round(text.length * size * 0.56 + 16);
  const svg = `<svg class="ws-trace-svg" width="${w}" height="60" viewBox="0 0 ${w} 60" aria-hidden="true">
    <text x="6" y="49" font-family="'Baloo 2', sans-serif" font-weight="800" font-size="${size}" fill="#f1f3f9" stroke="#4a5378" stroke-width="1.4" stroke-dasharray="2.6 2.2">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>
  </svg>`;
  return h('span', { class: 'ws-trace', html: svg, 'data-word': text });
}

const lines = () => h('span', { class: 'ws-lines', 'aria-hidden': 'true' });
const dot = () => h('span', { class: 'ws-dot', 'aria-hidden': 'true' });

function sectionBody(s: Section): HTMLElement {
  switch (s.kind) {
    case 'colour':
      return h('div', { class: 'ws-colour' }, h('span', { class: 'ws-defs', html: OUTLINE }), s.words.map((w) => h('div', { class: 'ws-colour-box' }, pic(w, 'ws-faint'), h('span', { class: 'ws-model' }, pic(w)))));
    case 'same':
      return h(
        'div',
        { class: 'ws-match ws-match-same' },
        s.left.map((w, i) =>
          h('div', { class: 'ws-match-row' },
            h('span', { class: 'ws-num' }, `${i + 1}`), pic(w), dot(), h('span', { class: 'ws-match-space' }), dot(), pic(s.right[i]), h('span', { class: 'ws-num' }, ABC[i])),
        ),
      );
    case 'circle':
      return h('div', { class: 'ws-circle' }, s.rows.map((r, i) => h('div', { class: 'ws-circle-row' }, h('span', { class: 'ws-num' }, `${i + 1}`), r.options.map((w) => h('span', { class: 'ws-circle-opt' }, pic(w))))));
    case 'match':
      return h(
        'div',
        { class: 'ws-match' },
        s.pictures.map((w, i) =>
          h('div', { class: 'ws-match-row' },
            h('span', { class: 'ws-num' }, `${i + 1}`), pic(w), dot(), h('span', { class: 'ws-match-space' }), dot(), h('span', { class: 'ws-match-word', lang: 'en' }, s.words[i].text), h('span', { class: 'ws-num' }, ABC[i])),
        ),
      );
    case 'trace':
      return h('div', { class: 'ws-trace-list' }, s.words.map((w) => h('div', { class: 'ws-trace-row' }, pic(w, 'ws-pic-sm'), traceWord(w.text), lines())));
    case 'write':
      return h('div', { class: 'ws-write' }, s.items.map((it, i) => h('div', { class: `ws-write-item ${it.word.text.length > 7 ? 'is-long' : ''}` }, h('span', { class: 'ws-num' }, `${i + 1}`), pic(it.word), letterBoxes(it.word.text, it.given))));
    case 'search':
      return h(
        'div',
        { class: 'ws-search' },
        h('div', { class: 'ws-grid', style: `--n:${s.grid.length}` }, s.grid.flat().map((ch) => h('span', {}, ch))),
        h('ul', { class: 'ws-search-words' }, s.placed.map((p) => h('li', { lang: 'en' }, h('span', { class: 'ws-tick' }), p.word))),
      );
    case 'gaps':
      return h(
        'div',
        { class: 'ws-gaps' },
        h('div', { class: 'ws-bank', lang: 'en' }, s.bank.map((b) => h('span', {}, b))),
        h('ol', { class: 'ws-sentences', lang: 'en' }, s.rows.map((r) => h('li', {}, r.before, h('span', { class: 'ws-blank' }), r.after))),
      );
    case 'define':
      return h(
        'div',
        { class: 'ws-gaps ws-define' },
        h('div', { class: 'ws-bank', lang: 'en' }, s.bank.map((b) => h('span', {}, b))),
        h('ol', { class: 'ws-sentences', lang: 'en' }, s.rows.map((r) => h('li', {}, h('span', {}, r.def), ' ', h('span', { class: 'ws-blank ws-blank-long' })))),
      );
    case 'text':
      return h(
        'div',
        { class: 'ws-text', lang: 'en' },
        h('div', { class: 'ws-text-box' }, h('h3', {}, s.text.title), s.text.lines.map((l) => h('p', {}, l))),
        h('ol', { class: 'ws-questions' }, s.text.questions.map((q) => h('li', {}, h('span', { class: 'ws-q' }, q.q), h('span', { class: 'ws-opts' }, q.options.map((o, k) => h('span', {}, `${'abc'[k] ?? k + 1}) ${o}`)))))),
      );
  }
}

/** What the parent checks (Vietnamese labels, English answers). */
function keyBody(s: Section): HTMLElement | null {
  const list = (items: (string | HTMLElement)[]) => h('ol', { class: 'ws-key-list' }, items.map((x) => h('li', { lang: 'en' }, x)));
  switch (s.kind) {
    case 'colour':
      return h('p', {}, 'Tô màu tự do. Khi bé tô, hỏi: ', h('i', { lang: 'en' }, `“What is it?” “What colour is it?”`));
    case 'same':
      return h('p', { lang: 'en' }, s.left.map((w, i) => `${i + 1}–${ABC[s.right.indexOf(w)]} (${w.text})`).join(' · '));
    case 'circle':
      return h('div', {}, h('p', {}, 'Bố mẹ đọc to từng dòng:'), list(s.rows.map((r) => h('span', {}, `Number ${s.rows.indexOf(r) + 1}. Circle the `, h('b', {}, r.answer.text), '!'))));
    case 'match':
      return h('p', { lang: 'en' }, s.pictures.map((w, i) => `${i + 1}–${ABC[s.words.indexOf(w)]} (${w.text})`).join(' · '));
    case 'trace':
      return h('p', {}, 'Bé tô theo nét rồi chép lại. Nhắc bé đọc to từng từ: ', h('i', { lang: 'en' }, s.words.map((w) => w.text).join(', ')), '.');
    case 'write':
      return list(s.items.map((it) => it.word.text));
    case 'search': {
      const hit = new Set(s.placed.flatMap((p) => [...p.word].map((_, i) => (p.dir === 'across' ? `${p.row},${p.col + i}` : `${p.row + i},${p.col}`))));
      return h(
        'div',
        { class: 'ws-key-search' },
        h('div', { class: 'ws-grid ws-grid-key', style: `--n:${s.grid.length}` }, s.grid.flatMap((row, r) => row.map((ch, c) => h('span', { class: hit.has(`${r},${c}`) ? 'is-hit' : '' }, ch)))),
        h('p', { lang: 'en' }, s.placed.map((p) => `${p.word.toLowerCase()} ${p.dir === 'across' ? '→' : '↓'}`).join(' · ')),
      );
    }
    case 'gaps':
      return list(s.rows.map((r) => r.answer));
    case 'define':
      return list(s.rows.map((r) => r.answer));
    case 'text':
      return list(s.text.questions.map((q) => `${'abc'[q.answer] ?? q.answer + 1}) ${q.options[q.answer]}`));
  }
}

/** Printable worksheet for one unit (A4 portrait), with the answer key on its own last page. */
export function worksheetScreen(ctx: Ctx): HTMLElement {
  const topic = topicById(ctx.params.unit ?? '');
  const back = () => ctx.go('parent', { back: 'worksheet' });
  if (!topic) {
    queueMicrotask(back);
    return h('main');
  }
  const ws = buildWorksheet(topic);
  const bix = new Bix({ size: 'sm', bubble: false }).setMood('happy');
  const sections = ws.sections.map((s, i) =>
    h(
      'section',
      { class: `ws-sec ws-sec-${s.kind}`, 'data-kind': s.kind },
      h('h2', { class: 'ws-h' }, h('span', { class: 'ws-h-num' }, `${i + 1}`), h('span', { lang: 'en' }, TITLES[s.kind][0])),
      h('p', { class: 'ws-vi', lang: 'vi' }, TITLES[s.kind][1]),
      sectionBody(s),
    ),
  );
  const sheet = h(
    'article',
    { class: `ws-sheet ws-${ws.level.id}`, 'aria-label': 'Worksheet' },
    h(
      'header',
      { class: 'ws-head' },
      h('div', { class: 'ws-bix' }, bix.el),
      h(
        'div',
        { class: 'ws-title' },
        h('p', { class: 'ws-brand' }, `Bix English · ${ws.level.name}`),
        h('h1', { lang: 'en' }, h('span', { 'aria-hidden': 'true' }, topic.icon), ' ', topic.title),
        h('p', { class: 'ws-title-vi', lang: 'vi' }, topic.titleVi),
      ),
      h('div', { class: 'ws-name', lang: 'en' }, h('p', {}, 'Name: ', h('span', { class: 'ws-line' })), h('p', {}, 'Date: ', h('span', { class: 'ws-line' }))),
    ),
    sections,
  );
  const key = h(
    'article',
    { class: 'ws-sheet ws-key', lang: 'vi', 'aria-label': 'Đáp án cho bố mẹ' },
    h('header', { class: 'ws-key-head' }, h('h2', {}, '🔑 Đáp án cho bố mẹ'), h('p', {}, `Answer key · ${topic.title} (${topic.titleVi}) · ${ws.level.name} · phiếu ngày ${vn(ws.day)}`)),
    ws.sections.map((s, i) => {
      const body = keyBody(s);
      return body ? h('section', { class: 'ws-key-sec', 'data-kind': s.kind }, h('h3', {}, `${i + 1}. `, h('span', { lang: 'en' }, TITLES[s.kind][0])), body) : null;
    }),
    h(
      'p',
      { class: 'ws-key-tip' },
      'Gợi ý: làm cùng con 10–15 phút, đọc to từng từ tiếng Anh trước khi bé viết. Chỗ nào bé chưa làm được, bố mẹ làm mẫu rồi để bé thử lại, khen khi bé cố gắng. In lại trong cùng ngày sẽ ra đúng phiếu này; ngày khác thứ tự bài sẽ đổi.',
    ),
  );
  return h(
    'main',
    { class: 'ws-page', lang: 'vi' },
    h(
      'div',
      { class: 'ws-actions' },
      h('button', { class: 'p-btn ws-back', onclick: back }, '← Khu bố mẹ'),
      h('span', { class: 'ws-actions-note' }, `${ws.sections.length} bài tập + 1 trang đáp án · khổ A4 dọc`),
      h('button', { class: 'p-btn p-btn-main ws-print', onclick: () => window.print() }, '🖨️ In phiếu'),
    ),
    sheet,
    key,
  );
}
