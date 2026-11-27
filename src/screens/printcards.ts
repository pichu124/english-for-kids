import { topicsOfLevel, type Topic, type Word } from '../content';
import { h } from '../lib/dom';
import { dayLog, today, update } from '../lib/storage';
import { seededRandom, seededShuffle } from '../lib/worksheet';
import { wordPicture } from './lesson/shared';

/**
 * Printables for one unit (parent area → Phiếu bài tập in):
 *  - Word cards: 6 big picture cards per A4 page, to cut out (wall, games, "show me the cat").
 *  - Bingo: 4 different 3×3 boards (2 per page) and a caller list for the parent.
 * The same unit on the same day prints the same cards (seeded by unit + day).
 */
const uniq = (ws: Word[]) => ws.filter((w, i) => ws.findIndex((x) => x.text.toLowerCase() === w.text.toLowerCase()) === i);

/** The unit's words; bingo needs 9+, so it borrows words from the same level when a unit is small. */
function wordsFor(topic: Topic, min = 0): Word[] {
  const own = uniq(topic.words);
  if (own.length >= min) return own;
  const more = uniq(topicsOfLevel(topic.level).filter((t) => t.id !== topic.id).flatMap((t) => t.words)).filter((w) => !own.some((o) => o.text.toLowerCase() === w.text.toLowerCase()));
  return [...own, ...seededShuffle(more, seededRandom(topic.id)).slice(0, min - own.length)];
}

function countSheet(key: string): void {
  // counted once per printable (unit + kind) and day in the weekly report
  update(() => {
    const d = dayLog();
    if (d.sheetUnits?.includes(key)) return;
    d.sheetUnits = [...(d.sheetUnits ?? []), key];
    d.sheets = (d.sheets ?? 0) + 1;
  });
}

function page(title: string, note: string, back: () => void, printKey: string, sheets: HTMLElement[]): HTMLElement {
  return h(
    'main',
    { class: 'ws-page pc-page-wrap', lang: 'vi' },
    h(
      'div',
      { class: 'ws-actions' },
      h('button', { class: 'p-btn ws-back', onclick: back }, '← Khu bố mẹ'),
      h('span', { class: 'ws-actions-note' }, note),
      h('button', { class: 'p-btn p-btn-main ws-print', onclick: () => (countSheet(printKey), window.print()) }, `🖨️ In ${title}`),
    ),
    sheets,
  );
}

const cardText = (w: Word) => h('div', { class: 'pc-word', lang: 'en' }, w.text);

/** Big picture word cards, 6 per A4 page, with dashed cutting lines. */
export function wordCards(topic: Topic, back: () => void): HTMLElement {
  const words = wordsFor(topic);
  const pages: HTMLElement[] = [];
  for (let i = 0; i < words.length; i += 6) {
    pages.push(
      h(
        'article',
        { class: 'ws-sheet pc-sheet', 'aria-label': 'Word cards' },
        h('div', { class: 'pc-grid' }, words.slice(i, i + 6).map((w) => h('div', { class: 'pc-card', 'data-word': w.text }, h('div', { class: 'pc-pic' }, wordPicture(w)), cardText(w)))),
        h('p', { class: 'pc-foot', lang: 'en' }, `Bix English · ${topic.icon} ${topic.title}`),
      ),
    );
  }
  pages.push(
    h(
      'article',
      { class: 'ws-sheet pc-sheet pc-tips', lang: 'vi' },
      h('h2', {}, '🃏 Chơi với thẻ từ'),
      h(
        'ul',
        {},
        h('li', {}, 'Cắt theo đường nét đứt. Dán lên tường hoặc tủ lạnh, mỗi ngày chỉ vào và nói cùng con.'),
        h('li', {}, '“Show me the …!”: trải thẻ ra bàn, bố mẹ nói một từ, bé tìm và giơ thẻ lên.'),
        h('li', {}, '“What’s missing?”: bày 4–5 thẻ, bé nhắm mắt, bố mẹ giấu một thẻ, bé đoán thẻ nào biến mất.'),
        h('li', {}, 'Lật úp hai bộ thẻ (in 2 lần) để chơi lật hình tìm cặp, lật thẻ nào nói tên thẻ đó.'),
      ),
    ),
  );
  return page('thẻ từ', `${words.length} thẻ · ${pages.length - 1} trang A4 + 1 trang gợi ý chơi`, back, `${topic.id}:cards`, pages);
}

/** Four different 3×3 bingo boards (2 per page) and a caller list. */
export function bingoCards(topic: Topic, back: () => void): HTMLElement {
  // 12+ words, so the four boards differ and nobody wins at the same moment
  const words = wordsFor(topic, 12);
  const rnd = seededRandom(`${topic.id}|bingo|${today()}`);
  const boards = [0, 1, 2, 3].map((n) => {
    const nine = seededShuffle(words, rnd).slice(0, 9);
    return h(
      'div',
      { class: 'bg-board', 'data-board': String(n + 1) },
      h('div', { class: 'bg-head', lang: 'en' }, h('b', {}, 'BINGO'), h('span', {}, `Player ${n + 1}: `, h('span', { class: 'ws-line' }))),
      h('div', { class: 'bg-grid' }, nine.map((w) => h('div', { class: 'bg-cell', 'data-word': w.text }, h('div', { class: 'bg-pic' }, wordPicture(w)), h('div', { class: 'bg-word', lang: 'en' }, w.text)))),
    );
  });
  const caller = h(
    'article',
    { class: 'ws-sheet pc-sheet bg-caller', lang: 'vi' },
    h('h2', {}, '🎱 Bingo cả nhà: cách chơi'),
    h(
      'ol',
      {},
      h('li', {}, 'Mỗi người một bảng. Cắt các thẻ nhỏ ở danh sách dưới (hoặc đọc theo danh sách).'),
      h('li', {}, 'Bố mẹ đọc to từng từ tiếng Anh theo thứ tự bất kỳ: “Can you find the … ?”. Ai có hình đó thì đặt một hạt đậu/đánh dấu vào ô.'),
      h('li', {}, 'Đủ 3 ô thẳng hàng (ngang, dọc hoặc chéo) thì hô “BINGO!” và đọc lại 3 từ đó bằng tiếng Anh.'),
      h('li', {}, 'Đổi vai: để bé làm người đọc từ. Ai cũng được khen, không có người thua.'),
    ),
    h('h3', {}, 'Danh sách từ để đọc'),
    h('div', { class: 'bg-list' }, words.map((w) => h('span', { class: 'bg-list-item', lang: 'en' }, h('span', { class: 'bg-list-pic' }, wordPicture(w)), w.text))),
  );
  const sheets = [
    h('article', { class: 'ws-sheet pc-sheet bg-sheet' }, boards[0], boards[1]),
    h('article', { class: 'ws-sheet pc-sheet bg-sheet' }, boards[2], boards[3]),
    caller,
  ];
  return page('Bingo', `4 bảng Bingo (2 trang) + 1 trang cách chơi · ${words.length} từ`, back, `${topic.id}:bingo`, sheets);
}
