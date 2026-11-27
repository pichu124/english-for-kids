/** Parent area (Vietnamese). Gated behind a multiplication question. */
import { LEVELS, levelById, levelsWithContent, topics, topicsOfLevel } from '../content';
import { levelDone, levelProgress, unitBadge, weekReport } from '../lib/progress';
import { currentLevel, setLevel } from '../lib/level';
import phonicsData from '../../content/phonics.json';
import talkData from '../../content/talk.json';
import { phonicsAllDone } from './certificate';
import { h } from '../lib/dom';
import { browserAdvice, browserLabel } from '../lib/env';
import { listenOnce, recognitionSupported } from '../lib/listen';
import { canInstall, isInstalled, offlineReady, onInstallChange, promptInstall } from '../lib/pwa';
import { addProfile, backupDue, checkBackup, exportBackup, lastBackup, markBackedUp, restoreBackup, type Backup, MAX_PROFILES, profileAnimal, profiles, removeProfile, switchProfile, getState, resetProgress, save, SR_MODE_LABEL, SR_MODES, today, update, wordKey, type DayLog, type SrMode } from '../lib/storage';
import { allVoices, englishVoices, lastSpeech, pickVoice, say, ttsSupported } from '../lib/tts';
import { recordedCount } from '../lib/voice';
import { sfx } from '../lib/sfx';
import { limitReached, minutesToday } from '../lib/usage';
import type { Ctx } from '../router';
import { tipCard } from './tip';
import { skillsCard } from './skills';
import { NEWER_EMOJI, bundledEmoji, emojiOk, recheckEmoji, wordEmoji } from '../lib/emoji';
import { wordPicture } from './lesson/shared';
import { MUSIC_LABEL, musicMode, playTune, type MusicMode, type Player } from '../lib/music';
import { TUNES } from '../lib/tunes';
import { ADJUST_LABEL, adjustment } from '../lib/adapt';
import { PART_LABEL, passed, shields, testResults, TEST_NAME, TEST_PARTS, type Part } from '../lib/mocktest';
import { defaultUnit } from '../lib/worksheet';

let unlockedAt = 0;
/** Leaving the parent area for the child's side locks it again. */
export const lockParent = () => (unlockedAt = 0);

export function parentScreen(ctx: Ctx): HTMLElement {
  const root = h('main', { class: 'parent' });
  const show = () => {
    unlockedAt = Date.now();
    root.replaceChildren(panel(ctx, show));
  };
  // Coming back from the weekly report or a worksheet shortly after unlocking: no second question
  // (a short window, and only once: a report left open on the tablet must not open the parent area to a child).
  if ((ctx.params.back === 'report' || ctx.params.back === 'worksheet') && Date.now() - unlockedAt < 3 * 60 * 1000) show();
  else root.appendChild(gate(ctx, show));
  return root;
}

// ---------------------------------------------------------------- gate
function gate(ctx: Ctx, onPass: () => void): HTMLElement {
  let a = 0;
  let b = 0;
  let typed = '';
  const q = h('div', { class: 'gate-q' });
  const shown = h('div', { class: 'gate-answer' });
  const hint = h('p', { class: 'gate-hint' }, 'Khu vực dành cho bố mẹ. Hãy trả lời phép tính:');
  const fresh = () => {
    a = 3 + Math.floor(Math.random() * 7);
    b = 3 + Math.floor(Math.random() * 7);
    typed = '';
    q.textContent = `${a} × ${b} = ?`;
    shown.textContent = '…';
  };
  const press = (k: string) => {
    if (k === '⌫') typed = typed.slice(0, -1);
    else if (k === 'OK') {
      if (Number(typed) === a * b) return onPass();
      hint.textContent = 'Chưa đúng, thử phép tính khác nhé:';
      fresh();
      return;
    } else if (typed.length < 3) typed += k;
    shown.textContent = typed || '…';
  };
  fresh();
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'].map((k) =>
    h('button', { class: `key ${k === 'OK' ? 'key-ok' : ''}`, onclick: () => press(k) }, k),
  );
  return h(
    'div',
    { class: 'gate' },
    h('button', { class: 'p-back', onclick: () => ctx.go('home') }, '← Quay lại cho bé'),
    hint,
    q,
    shown,
    h('div', { class: 'keypad' }, keys),
  );
}

// ---------------------------------------------------------------- panel
function panel(ctx: Ctx, rerender: () => void): HTMLElement {
  const s = getState();
  return h(
    'div',
    { class: 'p-wrap' },
    h(
      'header',
      { class: 'p-head' },
      h('h1', {}, 'Khu vực bố mẹ'),
      h('button', { class: 'p-btn p-btn-main', onclick: () => ctx.go(limitReached() ? 'rest' : 'home') }, 'Xong, quay lại cho bé →'),
    ),
    backupDue()
      ? h('a', { class: 'p-notice', href: '#p-backup', onclick: (e: Event) => (e.preventDefault(), document.getElementById('p-backup')?.scrollIntoView({ behavior: 'smooth' })) }, '💾 Đã hơn 7 ngày chưa sao lưu tiến độ của bé. Bấm để sao lưu (chỉ mất vài giây).')
      : null,
    summaryCard(),
    card('4 kỹ năng: nghe, nói, đọc, viết', skillsCard(currentLevel())),
    card('Tuần này', weekField()),
    card('Các bé dùng máy này', profilesField()),
    h('div', { id: 'p-backup' }, card('Sao lưu tiến độ', backupField())),
    card('Tên bé', nameField(), h('p', { class: 'p-muted' }, 'Bix sẽ chào bé bằng tên này (“Hi, …!”). Nên dùng tên ngắn, không dấu để giọng đọc tiếng Anh đọc dễ nghe.')),
    card('Bậc học của bé', levelField()),
    card('Huy hiệu & giấy chứng nhận', certField()),
    card('Phiếu bài tập in', worksheetField()),
    card('Âm, đọc to & trò chuyện', speakingField()),
    card('Thi thử', testField()),
    card('Chơi cùng con', tipsList()),
    card('Giọng đọc & micro', voiceTools()),
    card('Nhạc', musicField()),
    card('Giới hạn thời gian mỗi ngày', limitField()),
    card('Nhật ký 14 ngày', logTable(), h('p', { class: 'p-muted' }, `Độ khó trò chọn hình: ${ADJUST_LABEL[String(adjustment()) as '0']}. App tự điều chỉnh theo khoảng 12 lượt gần nhất.`)),
    card('Từ bé đã nói được', wordsList()),
    card('Kiểm tra hình', emojiField()),
    card('Cài ứng dụng & hướng dẫn', installHelp()),
    card('Quyền riêng tư', privacy()),
    card('Xoá tiến độ', resetField()),
    h('p', { class: 'p-muted p-foot' }, `Bản 0 · phiên bản ${__APP_VERSION__} · ${topics.length} bài · dữ liệu chỉ lưu trên máy này`),
  );

  /** Results of the practice tests (Starters, Movers) and what to do next. */
  function testField() {
    const blocks = (['L2', 'L3', 'L4'] as const).map((lv) => {
      const results = testResults(lv);
      const name = TEST_NAME[lv];
      if (!results.length) return lv === 'L2' ? h('p', { class: 'p-muted' }, `${name}: bé chưa làm. Đảo 🎓 "Test" ở cuối bản đồ có khoảng 15 câu mô phỏng bài thi Cambridge (nghe, đánh vần/viết, đọc). Nên cho bé làm khi đã học gần hết các đảo của bậc.`) : null;
      const last = results[results.length - 1];
      const parts = TEST_PARTS[lv];
      const weak = parts.filter((p) => shields(last.score[p] ?? [0, 0]) <= 3);
      const next = lv === 'L2' ? 'bậc Movers' : lv === 'L3' ? 'bậc Flyers' : '';
      const tips: Record<Part, string> = { spelling: 'Đánh vần: chơi bảng ABC và phần Đọc & Viết. ', writing: 'Viết: bước gõ từ trong phần Đọc & Viết. ', listening: 'Nghe: học lại phần Nghe & Nói các đảo. ', reading: 'Đọc: phần Đọc & Viết (đọc, câu đúng/sai, đoạn văn). ' };
      const advice = passed(last.score)
        ? next ? `✓ Bé làm đúng từ 80% trở lên: có thể bắt đầu ${next} (vẫn ôn song song).` : '✓ Bé làm đúng từ 80% trở lên: đã nắm chắc chương trình Flyers. Có thể cho bé làm đề mẫu Flyers chính thức của Cambridge.'
        : `Nên luyện thêm: ${weak.map((p) => PART_LABEL[p].toLowerCase()).join(', ') || 'mọi phần'}. ${weak.map((p) => tips[p]).join('')}`;
      return h(
        'div',
        { class: 'p-test-level', 'data-level': lv },
        h('h3', { class: 'p-sub' }, name),
        h(
          'ul',
          { class: 'p-kids p-tests' },
          results
            .slice(-3)
            .reverse()
            .map((r) =>
              h(
                'li',
                { class: 'p-cert-row' },
                h('b', {}, new Date(r.day + 'T12:00:00').toLocaleDateString('vi-VN')),
                parts.map((p) => {
                  const sc = r.score[p];
                  return sc ? h('span', {}, ` ${PART_LABEL[p]} ${sc[0]}/${sc[1]} ${'🛡️'.repeat(shields(sc))}`) : null;
                }),
              ),
            ),
        ),
        h('p', { class: passed(last.score) ? 'p-saved' : 'p-muted' }, advice),
      );
    });
    return h('div', {}, blocks, h('p', { class: 'p-muted' }, 'Đây là bài luyện tập trong app, không phải bài thi chính thức của Cambridge. Thang 1–5 khiên mô phỏng cách Cambridge báo kết quả.'));
  }

  /** Badges per level and the printable certificate once a level is complete. */
  function certField() {
    const rows = levelsWithContent().map((l) => {
      const p = levelProgress(l.id);
      const tiers = topicsOfLevel(l.id).map(unitBadge);
      const count = (t: string) => tiers.filter((x) => x === t).length;
      return h(
        'li',
        { class: 'p-cert-row' },
        h('b', {}, l.nameVi),
        h('span', {}, ` ${p.done}/${p.total} bài · 🥇 ${count('gold')} · 🥈 ${count('silver')} · 🥉 ${count('bronze')} `),
        levelDone(l.id)
          ? h('button', { class: 'p-btn p-btn-sm', 'data-level': l.id, onclick: () => ctx.go('certificate', { level: l.id, from: 'parent' }) }, '🏆 Xem & in giấy chứng nhận')
          : h('span', { class: 'p-muted' }, '(xong cả bậc sẽ có giấy chứng nhận)'),
      );
    });
    return h(
      'div',
      {},
      h('ul', { class: 'p-kids' }, rows),
      h('p', { class: 'p-muted' }, 'Huy hiệu mỗi bài: đồng khi học xong, bạc khi mọi từ thành sticker, vàng khi đủ sticker và học 3 lần. Giấy chứng nhận in khổ A4 ngang (hoặc lưu PDF), là kỷ niệm của gia đình/lớp học, không phải chứng chỉ Cambridge.'),
    );
  }

  /** Phonics sets, pages read aloud, chats and speaking practice (all on this device). */
  function speakingField() {
    const st = getState();
    const sets = phonicsData.sets.map((x) => h('span', { class: `chip ${st.phonics?.[x.id] ? 'chip-ok' : ''}`, 'data-set': x.id }, `${st.phonics?.[x.id] ? '✓' : '·'} ${x.sounds.map((y) => y.s).join(' ')}`));
    const pages = Object.values(st.readAloud ?? {}).reduce((n, v) => n + (typeof v === 'number' ? v : 0), 0);
    const chats = talkData.chats.filter((c) => st.talk?.[`chat-${c.id}`]).map((c) => `${c.icon} ${c.title}`);
    const practice = Object.keys(talkData.practice).filter((l) => st.talk?.[`practice-${l}`]).map((l) => `${levelById(l)?.name} (${st.talk?.[`practice-${l}`]} lần)`);
    return h(
      'div',
      { class: 'p-speaking' },
      h('p', {}, h('b', {}, 'Âm chữ cái (phonics): '), `${phonicsData.sets.filter((x) => st.phonics?.[x.id]).length}/${phonicsData.sets.length} nhóm`),
      h('div', { class: 'p-words p-sets' }, sets),
      phonicsAllDone() ? h('button', { class: 'p-btn p-btn-sm', 'data-cert': 'phonics', onclick: () => ctx.go('certificate', { kind: 'phonics', from: 'parent' }) }, '🔊 Xem & in giấy "Sounds Star"') : h('p', { class: 'p-muted' }, 'Xong cả các nhóm âm sẽ có giấy "Sounds Star". Vào ABC → 🔊 Sounds.'),
      h('p', {}, h('b', {}, 'Bé tự đọc to: '), pages ? `${pages} trang (truyện và truyện phonics)` : 'chưa có trang nào. Trong truyện, bấm 🎤 My turn để bé tự đọc.'),
      h('p', {}, h('b', {}, 'Trò chuyện với Bix: '), chats.length ? chats.join(' · ') : 'chưa trò chuyện. Nút 💬 Talk ở màn hình chính.'),
      h('p', {}, h('b', {}, 'Luyện phần Nói: '), practice.length ? practice.join(' · ') : 'chưa luyện.'),
      h('p', { class: 'p-muted' }, 'Máy chỉ lưu số lần, không lưu giọng nói.'),
    );
  }

  /** Printable worksheet for one unit: pick the level and the unit, then open the A4 page. */
  function worksheetField() {
    const levels = levelsWithContent();
    const cur = currentLevel().id;
    const lvSel = h('select', { class: 'p-input p-ws-level', 'aria-label': 'Bậc' }, levels.map((l) => h('option', { value: l.id, selected: l.id === cur }, l.nameVi))) as HTMLSelectElement;
    const unitSel = h('select', { class: 'p-input p-ws-unit', 'aria-label': 'Bài' }) as HTMLSelectElement;
    const fill = () => {
      const pick = defaultUnit(lvSel.value)?.id;
      unitSel.replaceChildren(...topicsOfLevel(lvSel.value).map((t) => h('option', { value: t.id, selected: t.id === pick }, `${t.icon} ${t.title} · ${t.titleVi}`)));
    };
    lvSel.addEventListener('change', fill);
    fill();
    return h(
      'div',
      {},
      h('div', { class: 'p-row' }, lvSel, unitSel, h('button', { class: 'p-btn p-btn-main', 'data-ws': 'open', onclick: () => unitSel.value && ctx.go('worksheet', { unit: unitSel.value }) }, '📄 Mở phiếu')),
      h(
        'p',
        { class: 'p-muted' },
        'Phiếu A4 dọc tạo từ các từ của bài, có trang đáp án riêng cho bố mẹ. Bậc 0–1: tô màu, nối hình, nghe và khoanh. Starters: nối hình với chữ, tô chữ, nhìn hình viết từ, tìm chữ. Movers/Flyers: viết từ, điền từ vào câu, đọc định nghĩa, đọc đoạn văn. Mặc định là bài bé học gần nhất.',
      ),
    );
  }

  /** Tips for the units the child did most recently (or the first units of the level). */
  function tipsList() {
    const st = getState();
    const recent = topics
      .filter((t) => st.topics[t.id]?.lastDone)
      .sort((a, b) => (st.topics[b.id].lastDone ?? '').localeCompare(st.topics[a.id].lastDone ?? ''))
      .slice(0, 4);
    const list = recent.length ? recent : topicsOfLevel(currentLevel().id).slice(0, 3);
    return h(
      'div',
      { class: 'p-tips' },
      h('p', { class: 'p-muted' }, recent.length ? 'Gợi ý theo các bài bé vừa học. Mỗi ngày chỉ cần 2–3 phút chơi cùng con ngoài đời là đủ.' : 'Bé chưa học bài nào. Đây là gợi ý cho những bài đầu tiên.'),
      list.map((t, i) => tipCard(t, i === 0)),
      chatAnswers(),
    );
  }

  /** What the child told Bix (👍/👎) — a conversation starter for parents. */
  function chatAnswers() {
    const ans = getState().chatAnswers ?? {};
    const rows = Object.entries(ans)
      .map(([id, a]) => ({ t: topics.find((x) => x.id === id), a }))
      .filter((r) => r.t?.chat);
    if (!rows.length) return null;
    return h(
      'div',
      {},
      h('h3', { class: 'p-sub' }, 'Bé trả lời Bix'),
      h('ul', { class: 'p-chat' }, rows.map((r) => h('li', {}, h('span', { lang: 'en' }, r.t!.chat!.ask), ' ', r.a === 'yes' ? '👍' : '👎'))),
    );
  }

  function card(title: string, ...body: (HTMLElement | null)[]) {
    return h('section', { class: 'p-card' }, h('h2', {}, title), ...body);
  }

  function levelField() {
    const wrap = h('div', {});
    const render = () => {
      const cur = currentLevel().id;
      wrap.replaceChildren(
        h(
          'div',
          { class: 'p-seg' },
          LEVELS.map((l) => {
            const n = topicsOfLevel(l.id).length;
            return h(
              'button',
              {
                class: `p-seg-btn ${l.id === cur ? 'is-on' : ''}`,
                disabled: n === 0,
                onclick: () => {
                  setLevel(l.id);
                  render();
                },
              },
              n ? `${l.nameVi} · ${n} bài` : `${l.nameVi} · sắp có`,
            );
          }),
        ),
        h(
          'p',
          { class: 'p-muted' },
          'Màn hình chính chỉ hiện các bài của bậc đang chọn. Bậc 0 không hiện chữ (bé chưa biết đọc) và chỉ cho chọn giữa 3 hình. Khung đối chiếu: ' +
            (LEVELS.find((l) => l.id === cur)?.framework ?? '') +
            '. Sao và khối bé đã có ở bậc khác vẫn được giữ.',
        ),
      );
    };
    render();
    return wrap;
  }

  function summaryCard() {
    const days = lastDays(7).map((d) => s.days[d]);
    const active = days.filter((d) => d && d.auto + d.parent + d.miss + d.noVoice > 0).length;
    const all = Object.values(s.days).reduce(
      (acc, d) => ({ auto: acc.auto + d.auto, parent: acc.parent + d.parent, miss: acc.miss + d.miss, noVoice: acc.noVoice + d.noVoice }),
      { auto: 0, parent: 0, miss: 0, noVoice: 0 },
    );
    const attempts = all.auto + all.parent + all.miss + all.noVoice;
    const pct = attempts ? Math.round((all.auto / attempts) * 100) : null;
    const said = Object.values(s.words).filter((w) => w.said).length;
    const totalWords = topics.reduce((n, t) => n + t.words.length, 0);
    const stat = (big: string, label: string) => h('div', { class: 'p-stat' }, h('b', {}, big), h('span', {}, label));
    return h(
      'section',
      { class: 'p-card p-summary' },
      stat(`${active}/7`, 'ngày có nói tiếng Anh (7 ngày qua)'),
      stat(pct === null ? '—' : `${pct}%`, 'lượt nói máy tự nhận đúng'),
      stat(`${said}/${totalWords}`, 'từ bé đã nói được'),
      stat(`${minutesToday()} phút`, 'đã học hôm nay'),
    );
  }

  function nameField() {
    const input = h('input', { class: 'p-input p-name', type: 'text', maxlength: 20, placeholder: 'Ví dụ: Su, Bin, Mia', value: s.childName }) as HTMLInputElement;
    const ok = h('span', { class: 'p-saved', hidden: true }, '✓ Đã lưu');
    input.addEventListener('input', () => {
      update((st) => (st.childName = input.value.trim()));
      ok.hidden = false;
    });
    const hear = h('button', { class: 'p-btn', onclick: () => void say(`Hi, ${input.value.trim() || 'there'}!`) }, '🔊 Nghe Bix chào');
    return h('div', { class: 'p-row' }, input, hear, ok);
  }

  /** Which pictures this phone can draw; the missing ones are replaced automatically. */
  function emojiField() {
    const wrap = h('div', {});
    const render = () => {
      const list = Object.entries(NEWER_EMOJI);
      const bad = list.filter(([e]) => !emojiOk(e));
      const all = h('div', { class: 'p-emoji-all', hidden: true });
      const showAll = h('button', { class: 'p-btn p-btn-sm' }, '👀 Xem tất cả hình của các bài');
      showAll.addEventListener('click', () => {
        all.hidden = !all.hidden;
        if (!all.hidden && !all.childElementCount) {
          const seen = new Set<string>();
          for (const t of topics)
            for (const w of t.words) {
              if (seen.has(w.text)) continue;
              seen.add(w.text);
              all.appendChild(h('span', { class: 'p-emoji-cell' }, wordPicture(w), h('small', { lang: 'en' }, w.text)));
            }
        }
      });
      wrap.replaceChildren(
        h('p', {}, bundledEmoji() ? `✓ App dùng bộ hình emoji kèm sẵn (Noto), nên máy nào cũng hiện cùng một hình, kể cả ${list.length} hình mới.` : bad.length ? `Máy này không vẽ được ${bad.length}/${list.length} hình mới. App đã tự thay bằng hình cũ cùng nghĩa, hoặc ghi chữ.` : `✓ Máy này vẽ được đủ ${list.length} hình mới (emoji từ năm 2018 trở về sau).`),
        h(
          'div',
          { class: 'p-emoji-grid' },
          list.map(([e, alt]) => {
            const ok = emojiOk(e);
            return h('span', { class: `p-emoji ${ok ? '' : 'is-bad'}`, 'data-emoji': e, title: ok ? 'hiện được' : 'không hiện được' }, ok ? e : wordEmoji(e) ?? (alt || 'Aa'), h('small', {}, ok ? '✓' : '→'));
          }),
        ),
        h('p', { class: 'p-muted' }, 'Hình nào trên máy bé hiện ra ô vuông hay dấu hỏi, bố mẹ chụp màn hình gửi lại để sửa. Bấm "Xem tất cả hình" để soát các hình của bài học.'),
        h('div', { class: 'p-row' }, showAll, h('button', { class: 'p-btn p-btn-sm', onclick: () => (recheckEmoji(), render()) }, '🔄 Kiểm tra lại')),
        all,
      );
    };
    render();
    return wrap;
  }

  /** This week at a glance + the printable weekly report. */
  function weekField() {
    const r = weekReport();
    const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return h(
      'div',
      { class: 'p-week' },
      h('div', { class: 'p-week-days', 'aria-label': 'Các ngày trong tuần' }, r.days.map((d) => h('span', { class: d.lessons ? 'is-on' : '' }, WD[new Date(d.day + 'T12:00:00').getDay()]))),
      h('p', {}, `${r.learnedDays}/7 ngày có học · ${r.minutes} phút · ${r.lessons} lượt học xong · ${r.newWords.length} từ mới`),
      r.practise.length ? h('p', { class: 'p-muted' }, `Từ nên chơi lại: ${r.practise.slice(0, 5).map((x) => x.word.text).join(', ')}`) : null,
      h('div', { class: 'p-row' }, h('button', { class: 'p-btn', 'data-report': 'open', onclick: () => ctx.go('report') }, '📄 Xem báo cáo tuần (in được)')),
    );
  }

  /** Backup file: download / share it, restore it (here or on a new device). */
  function backupField() {
    const last = lastBackup();
    const status = h('p', { class: 'p-muted p-backup-status' }, last ? `Lần sao lưu gần nhất: ${new Date(last).toLocaleDateString('vi-VN')}` : 'Chưa sao lưu lần nào.');
    const msg = h('p', { class: 'p-saved', hidden: true });
    const say = (text: string, ok = true) => {
      msg.textContent = text;
      msg.hidden = false;
      msg.classList.toggle('p-error', !ok);
    };
    const fileName = () => `bix-english-sao-luu-${today()}.json`;
    const makeFile = () => new File([JSON.stringify(exportBackup())], fileName(), { type: 'application/json' });
    const done = () => {
      markBackedUp();
      status.textContent = `Lần sao lưu gần nhất: ${new Date().toLocaleDateString('vi-VN')}`;
      document.querySelector('.p-notice')?.remove();
    };

    const download = h('button', { class: 'p-btn', 'data-backup': 'download' }, '💾 Tải file sao lưu');
    download.addEventListener('click', () => {
      const url = URL.createObjectURL(makeFile());
      const a = h('a', { href: url, download: fileName() });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      done();
      say('✓ Đã tải file sao lưu (thường nằm trong thư mục Tải xuống / Download).');
    });

    let share: HTMLElement | null = null;
    try {
      const probe = new File(['{}'], 'x.json', { type: 'application/json' });
      if (navigator.canShare?.({ files: [probe] })) {
        share = h('button', { class: 'p-btn', 'data-backup': 'share' }, '📤 Gửi file (Zalo, Drive, Gmail…)');
        share.addEventListener('click', async () => {
          try {
            await navigator.share({ files: [makeFile()], title: 'Sao lưu Bix English' });
            done();
            say('✓ Đã gửi file sao lưu.');
          } catch {
            /* the parent closed the share sheet */
          }
        });
      }
    } catch {
      /* no file sharing on this browser */
    }

    // Restore: pick a file → show what is in it → confirm twice → replace.
    const input = h('input', { type: 'file', accept: '.json,application/json', class: 'p-file', 'aria-label': 'Chọn file sao lưu' }) as HTMLInputElement;
    const preview = h('div', { class: 'p-restore', hidden: true });
    const pick = h('button', { class: 'p-btn', 'data-backup': 'restore', onclick: () => input.click() }, '📂 Khôi phục từ file');
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      input.value = '';
      if (!f) return;
      let data: unknown;
      try {
        data = JSON.parse(await f.text());
      } catch {
        return say('Không đọc được file này. Hãy chọn đúng file .json đã sao lưu.', false);
      }
      const problem = checkBackup(data);
      if (problem) return say(problem, false);
      const b = data as Backup;
      const kids = b.index.ids.map((id, i) => {
        const p = b.profiles[id];
        const lessons = Object.values(p.topics).reduce((n, t) => n + (typeof t?.completed === 'number' ? t.completed : 0), 0);
        return `${p.childName || `Bé ${i + 1}`} (${lessons} lượt học)`;
      });
      let armed = false;
      const go = h('button', { class: 'p-btn p-btn-danger', 'data-backup': 'confirm' }, 'Thay tiến độ trên máy này bằng file');
      go.addEventListener('click', () => {
        if (!armed) {
          armed = true;
          go.textContent = 'Bấm lần nữa để khôi phục';
          setTimeout(() => ((armed = false), (go.textContent = 'Thay tiến độ trên máy này bằng file')), 5000);
          return;
        }
        restoreBackup(b);
        rerender();
        setTimeout(() => {
          const m = document.querySelector('.p-backup-msg');
          if (m) m.textContent = '✓ Đã khôi phục tiến độ từ file.';
        }, 0);
      });
      preview.hidden = false;
      preview.replaceChildren(
        h('p', {}, `File sao lưu${Number.isNaN(new Date(b.exportedAt).getTime()) ? '' : ` ngày ${new Date(b.exportedAt).toLocaleDateString('vi-VN')}`}: ${kids.join(', ')}.`),
        h('p', { class: 'p-muted' }, 'Khôi phục sẽ thay toàn bộ tiến độ hiện có trên máy này (mọi bé) bằng nội dung trong file.'),
        h('div', { class: 'p-row' }, go, h('button', { class: 'p-btn', onclick: () => (preview.hidden = true) }, 'Huỷ')),
      );
    });

    return h(
      'div',
      {},
      h('p', { class: 'p-muted' }, 'Tiến độ chỉ lưu trên máy này. Thỉnh thoảng hãy sao lưu ra file để không mất khi xoá dữ liệu trình duyệt hay đổi máy. File có tên bé, tiến độ học và vài chữ ngắn máy nghe được khi bé nói (dòng "máy nghe"), không có giọng nói; hãy giữ nó như ảnh của gia đình.'),
      status,
      h('div', { class: 'p-row' }, download, share, pick, input),
      preview,
      msg,
      h('p', { class: 'p-saved p-backup-msg' }),
    );
  }

  /** Up to 4 children: each has their own progress, Bix clothes, garden, stories. */
  function profilesField() {
    const kids = profiles();
    const rows = kids.map((k, i) => {
      const label = k.name || `Bé ${i + 1} (chưa đặt tên)`;
      let armed = false;
      const del = kids.length > 1 ? h('button', { class: 'p-btn p-btn-danger p-btn-sm', 'aria-label': `Xoá hồ sơ ${label}` }, 'Xoá') : null;
      del?.addEventListener('click', () => {
        if (!armed) {
          armed = true;
          del.textContent = 'Bấm lần nữa để xoá';
          setTimeout(() => ((armed = false), (del.textContent = 'Xoá')), 4000);
          return;
        }
        removeProfile(k.id);
        rerender();
      });
      return h(
        'li',
        { class: `p-kid ${k.active ? 'is-active' : ''}`, 'data-profile': k.id },
        h('span', { class: 'p-kid-animal', 'aria-hidden': 'true' }, profileAnimal(k.id)),
        h('span', { class: 'p-kid-name' }, label),
        k.active ? h('span', { class: 'p-kid-on' }, 'Đang dùng') : h('button', { class: 'p-btn p-btn-sm', onclick: () => (switchProfile(k.id), rerender()) }, 'Chuyển sang bé này'),
        del,
      );
    });
    const input = h('input', { class: 'p-input p-new-kid', type: 'text', maxlength: 20, placeholder: 'Tên bé mới' }) as HTMLInputElement;
    const add = h('button', { class: 'p-btn', 'aria-label': 'Thêm bé' }, '+ Thêm bé');
    add.addEventListener('click', () => {
      if (!input.value.trim()) {
        input.placeholder = 'Nhập tên bé trước';
        input.focus();
        return;
      }
      const id = addProfile(input.value);
      if (!id) return;
      switchProfile(id);
      rerender();
    });
    return h(
      'div',
      {},
      h('ul', { class: 'p-kids' }, rows),
      kids.length < MAX_PROFILES ? h('div', { class: 'p-row' }, input, add) : h('p', { class: 'p-muted' }, `Tối đa ${MAX_PROFILES} bé trên một máy.`),
      h('p', { class: 'p-muted' }, 'Mỗi bé có tiến độ, sticker, tủ đồ, vườn và giới hạn giờ riêng. Khi có từ 2 bé, màn hình đầu tiên sẽ cho bé chạm vào con vật của mình. Các phần dưới đây là của bé đang dùng.'),
    );
  }

  /** Music under chants (default) and optional soft background music; preview each tune. */
  function musicField() {
    const wrap = h('div', {});
    let preview: Player | null = null;
    ctx.onCleanup(() => preview?.stop());
    const render = () => {
      const cur = musicMode();
      wrap.replaceChildren(
        h(
          'div',
          { class: 'p-seg' },
          (['off', 'chant', 'all'] as MusicMode[]).map((m) =>
            h('button', { class: `p-seg-btn ${m === cur ? 'is-on' : ''}`, 'data-music': m, onclick: () => (update((st) => (st.settings.music = m)), render()) }, MUSIC_LABEL[m]),
          ),
        ),
        h('p', { class: 'p-muted' }, 'Giai điệu dân gian đã hết bản quyền (Twinkle Twinkle, Old MacDonald…), máy tự chơi bằng nhạc cụ tổng hợp, không cần mạng. Bix đọc lời vè theo nhịp nhạc. Nhạc nền chỉ phát rất nhỏ ở màn hình chính, tủ đồ, vườn…; tắt hẳn khi học, đọc truyện và khi bật micro.'),
        h(
          'div',
          { class: 'p-row p-tunes' },
          TUNES.map((t) => {
            const b = h('button', { class: 'p-btn p-btn-sm', 'data-tune': t.id }, `▶ ${t.name}`);
            b.addEventListener('click', () => {
              const same = preview?.tune.id === t.id;
              preview?.stop();
              preview = null;
              wrap.querySelectorAll('[data-tune]').forEach((x) => (x.textContent = `▶ ${TUNES.find((y) => y.id === (x as HTMLElement).dataset.tune)?.name}`));
              if (same) return;
              preview = playTune(t, { vol: 0.6, loops: 1 });
              b.textContent = `⏹ ${t.name}`;
            });
            return b;
          }),
        ),
      );
    };
    render();
    return wrap;
  }

  function limitField() {
    const opts = [0, 5, 10, 15, 20, 30];
    const wrap = h('div', {});
    const render = () => {
      const cur = getState().settings.dailyLimitMin;
      const bonus = getState().bonus[today()] ?? 0;
      wrap.replaceChildren(
        h(
          'div',
          { class: 'p-seg' },
          opts.map((m) =>
            h(
              'button',
              {
                class: `p-seg-btn ${m === cur ? 'is-on' : ''}`,
                onclick: () => {
                  update((st) => (st.settings.dailyLimitMin = m));
                  render();
                },
              },
              m ? `${m} phút` : 'Không giới hạn',
            ),
          ),
        ),
        h(
          'p',
          { class: 'p-muted' },
          `Hôm nay bé đã học ${minutesToday()} phút` + (cur ? ` / ${cur + bonus} phút cho phép.` : '.') + ' Chỉ tính thời gian ở màn học và Thế giới của bé. Khi hết giờ, bé học nốt bài đang dở rồi Bix sẽ đi ngủ.',
        ),
        ...(cur
          ? [
            h(
              'button',
              {
                class: 'p-btn',
                onclick: () => {
                  update((st) => (st.bonus[today()] = (st.bonus[today()] ?? 0) + 10));
                  render();
                },
              },
              '+10 phút cho hôm nay',
            )
          ]
          : []),
      );
    };
    render();
    return wrap;
  }

  function logTable() {
    const rows = lastDays(14).map((d) => {
      const l: DayLog | undefined = s.days[d];
      const [, m, day] = d.split('-');
      const cells = l ? [Math.floor(l.seconds / 60), l.lessons, l.auto, l.parent, l.miss, l.noVoice] : ['', '', '', '', '', ''];
      return h('tr', { class: l ? '' : 'is-empty' }, h('td', {}, `${day}/${m}`), cells.map((c) => h('td', {}, String(c))));
    });
    return h(
      'div',
      {},
      h(
        'div',
        { class: 'p-table-wrap' },
        h(
          'table',
          { class: 'p-table' },
          h('thead', {}, h('tr', {}, ['Ngày', 'Phút', 'Bài xong', 'Máy nghe đúng', 'Bố mẹ chấm đúng', 'Chưa được', 'Không thu được giọng'].map((x) => h('th', {}, x)))),
          h('tbody', {}, rows.reverse()),
        ),
      ),
      h(
        'p',
        { class: 'p-muted' },
        'Mỗi lượt bé bấm micro được ghi một lần. “Chưa được”: máy nghe thấy nhưng không khớp từ. “Không thu được giọng”: máy không hỗ trợ, chưa cho quyền micro, hoặc mất mạng. Nếu “Bố mẹ chấm đúng” cao hơn hẳn “Máy nghe đúng”, nghĩa là nhận dạng chưa nghe tốt giọng bé.',
      ),
    );
  }

  function wordsList() {
    // One fold per level (the child's level open); units not started yet take one line,
    // so the page stays short even with 100+ units.
    const cur = currentLevel().id;
    return h(
      'div',
      { class: 'p-topics' },
      LEVELS.filter((l) => topicsOfLevel(l.id).length).map((l) => {
        const units = topicsOfLevel(l.id);
        const started = units.filter((t) => (s.topics[t.id]?.completed ?? 0) > 0 || t.words.some((w) => s.words[wordKey(t.id, w.id)]?.tries));
        const fold = h(
          'details',
          { class: 'p-level', 'data-level': l.id },
          h('summary', { class: 'p-level-title' }, `${l.nameVi} · đã học ${started.length}/${units.length} bài`),
          units.map((t) => {
            const done = s.topics[t.id]?.completed ?? 0;
            if (!started.includes(t)) return h('p', { class: 'p-topic-none' }, `${t.icon} ${t.title} — ${t.titleVi} · chưa học`);
            return h(
              'div',
              { class: 'p-topic' },
              h('h3', {}, `${t.icon} ${t.title} — ${t.titleVi}`, h('small', {}, done ? ` · đã học ${done} lần` : ' · đang học')),
              h(
                'ul',
                { class: 'p-words' },
                t.words.map((w) => {
                  const st = s.words[wordKey(t.id, w.id)];
                  let chip: HTMLElement;
                  if (st?.said && st.by === 'auto') chip = h('span', { class: 'chip chip-ok' }, '✓ Máy nghe đúng');
                  else if (st?.said) chip = h('span', { class: 'chip chip-parent' }, '✓ Bố mẹ chấm');
                  else if (st?.tries) chip = h('span', { class: 'chip chip-try' }, `Đã thử ${st.tries} lần`);
                  else chip = h('span', { class: 'chip' }, 'Chưa nói');
                  return h('li', {}, h('b', {}, w.text), chip, st?.heard ? h('span', { class: 'p-heard' }, `máy nghe: “${st.heard}”`) : null);
                }),
              ),
            );
          }),
        ) as HTMLDetailsElement;
        fold.open = l.id === cur;
        return fold;
      }),
    );
  }

  function voiceTools() {
    const rate = h('input', { type: 'range', min: 0.5, max: 1.1, step: 0.05, value: s.settings.rate, class: 'p-range' }) as HTMLInputElement;
    const rateLabel = h('span', {}, s.settings.rate.toFixed(2));
    rate.addEventListener('input', () => {
      update((st) => (st.settings.rate = Number(rate.value)));
      rateLabel.textContent = Number(rate.value).toFixed(2);
    });
    const voiceSel = h('select', { class: 'p-input' }) as HTMLSelectElement;
    const fillVoices = () => {
      const vs = englishVoices();
      voiceSel.replaceChildren(
        h('option', { value: '' }, 'Tự chọn (ưu tiên en-US)'),
        ...vs.map((v) => h('option', { value: v.voiceURI, selected: v.voiceURI === getState().settings.voiceURI }, `${v.name} (${v.lang})${v.localService ? '' : ' · cần mạng'}`)),
      );
    };
    fillVoices();
    window.speechSynthesis?.addEventListener?.('voiceschanged', fillVoices);
    voiceSel.addEventListener('change', () => update((st) => (st.settings.voiceURI = voiceSel.value || undefined)));

    // "No sound?" diagnostics: tells apart a muted tab/speaker from missing voices.
    const diag = h('div', { class: 'p-mic-out' });
    const showDiag = (extra = '') => {
      const all = allVoices();
      const en = englishVoices();
      const v = pickVoice();
      diag.replaceChildren(
        h('div', {}, ttsSupported() ? `Máy có ${all.length} giọng đọc, trong đó ${en.length} giọng tiếng Anh.` : '⚠️ Trình duyệt này không có giọng đọc.'),
        h('div', {}, `Đang dùng: ${v ? `${v.name} (${v.lang})` : 'giọng mặc định của máy (không tìm thấy giọng tiếng Anh)'}`),
        ...(extra ? [h('div', {}, extra)] : []),
      );
    };
    showDiag();
    window.speechSynthesis?.addEventListener?.('voiceschanged', () => showDiag());
    const testBtn = h('button', { class: 'p-btn' }, '🔊 Nghe thử giọng đọc');
    testBtn.addEventListener('click', async () => {
      testBtn.setAttribute('disabled', '');
      showDiag('Đang đọc: “This is a dog. Can you say dog?”…');
      await say('This is a dog. Can you say dog?');
      testBtn.removeAttribute('disabled');
      showDiag(`Kết quả: ${lastSpeech.result || '—'} · giọng: ${lastSpeech.voice || '—'}`);
    });
    const beepBtn = h('button', { class: 'p-btn', onclick: () => { sfx.unlock(); sfx.success(); } }, '🔔 Thử loa (tiếng chuông)');
    // real recordings (public/audio): on by default when the app has some
    const recBox = h('label', { class: 'p-row p-recorded' });
    if (recordedCount()) {
      const cb = h('input', { type: 'checkbox', checked: getState().settings.recorded !== false }) as HTMLInputElement;
      cb.addEventListener('change', () => update((st) => (st.settings.recorded = cb.checked)));
      recBox.append(cb, h('span', {}, `Dùng giọng người thật thu sẵn (${recordedCount()} câu); câu nào chưa thu thì dùng giọng đọc của máy.`));
    } else recBox.append(h('span', { class: 'p-muted' }, 'App chưa kèm giọng thu sẵn: Bix dùng giọng đọc của máy.'));

    // Microphone check in two parts, so a parent can tell *which* part is broken:
    // (1) can the page open the microphone at all, (2) does speech recognition answer.
    const advice = browserAdvice();
    const envInfo = h(
      'div',
      { class: 'p-mic-out' },
      h('div', {}, `Đang mở bằng: ${browserLabel()}.`),
      h('div', {}, `HTTPS: ${window.isSecureContext ? 'có ✓' : 'KHÔNG — micro sẽ bị chặn'} · Nhận giọng nói: ${recognitionSupported() ? 'có ✓' : 'không có'}`),
      advice ? h('div', { class: 'p-warn' }, `⚠️ ${advice}`) : null,
    );
    const micOut = h('div', { class: 'p-mic-out' }, 'Bấm “Thử micro”, cho phép micro nếu được hỏi, rồi nói một từ tiếng Anh (ví dụ “dog”).');
    const micBtn = h('button', { class: 'p-btn' }, '🎤 Thử micro');
    const line = (text: string, cls = '') => h('div', { class: cls }, text);
    const GOOGLE_APP_PERMISSION =
      'Nhiều khả năng app “Google” trên máy (app làm việc nhận giọng cho Chrome) chưa có quyền micro. Vào Cài đặt Android → Ứng dụng → Google → Quyền → Micrô → chọn “Cho phép khi dùng ứng dụng”. Trên máy Samsung: Cài đặt → Quản lý chung → Bàn phím/Ngôn ngữ → chọn dịch vụ nhập giọng nói của Google.';
    const GBOARD_TEST =
      'Kiểm tra nhanh dịch vụ giọng nói của máy: mở một ô gõ chữ bất kỳ, chạm 🎤 trên bàn phím Gboard rồi nói “hello”. Ra chữ = dịch vụ của Google chạy tốt (báo người làm app); không ra chữ = làm theo cách sửa ở trên.';
    const SERVICE_HELP =
      'Cách sửa thường gặp: (0) Máy có bàn phím Baidu/Sogou hoặc bản ROM Trung Quốc: Cài đặt → tìm “Manage keyboards” / “Quản lý bàn phím” → BẬT “Google Voice Typing”; rồi tìm “voice input” → chọn Google (đã sửa được trên máy thật); (1) Mở CH Play, tìm và cập nhật “Google” và “Speech Recognition & Synthesis from Google” (Dịch vụ giọng nói của Google); (2) Cài đặt Android → Ứng dụng → Google → đảm bảo không bị Tắt, quyền Micrô = Cho phép; (3) Cài đặt → Quản lý chung/Hệ thống → Ngôn ngữ → Nhập bằng giọng nói: chọn của Google. Rồi tắt hẳn Chrome, mở lại và thử.';
    const PERMISSION_HELP =
      'Mở quyền micro: (1) trong Chrome, chạm biểu tượng bên trái địa chỉ trang → Quyền → Micrô → Cho phép; (2) nếu vẫn không được: Cài đặt Android → Ứng dụng → Chrome → Quyền → Micrô → Cho phép. Rồi tải lại trang.';
    micBtn.addEventListener('click', async () => {
      micBtn.setAttribute('disabled', '');
      // Try each recognizer configuration, richest first, and keep the first that
      // returns text. Start straight away inside the tap (some Android builds refuse
      // to start later), and BEFORE touching the mic ourselves.
      const traces: HTMLElement[] = [];
      let out: Awaited<ReturnType<typeof listenOnce>> | null = null;
      let first: Awaited<ReturnType<typeof listenOnce>> | null = null;
      let worked: SrMode | null = null;
      for (const [i, mode] of SR_MODES.entries()) {
        const live = h('div', { class: 'p-trace' });
        micOut.replaceChildren(line(i === 0 ? 'Lần 1: đang nghe… hãy nói “dog”.' : `Lần ${i + 1} (chế độ ${SR_MODE_LABEL[mode]}): hãy nói lại “dog”.`), live);
        if (i > 0) await new Promise((r) => setTimeout(r, 400));
        if (!ctx.alive()) return;
        out = await listenOnce({ timeoutMs: 8000, mode, onEvent: (l) => live.append(h('div', {}, l)) });
        if (!ctx.alive()) return; // the parent left: never keep listening on the child's screens
        first ??= out;
        traces.push(h('div', {}, `Lần ${i + 1} (${SR_MODE_LABEL[mode]}):`), ...out.trace.events.map((l) => h('div', {}, l)));
        if (out.status === 'heard') {
          worked = mode;
          break;
        }
        // Only a recognizer that listened but gave no text is worth retrying in another mode.
        if (!(out.status === 'service' || out.status === 'nothing' || out.status === 'denied')) break;
      }
      if (!out || !first) return;
      const usedSimple = worked !== null && worked !== 'full';
      const trace = h('details', { class: 'p-trace' }, h('summary', {}, `Chi tiết kỹ thuật (lần cuối ${out.trace.ms} ms)`), ...traces);

      if (out.status === 'heard') {
        // Only switch to the simple mode when the full one never even got audio;
        // a "nomatch" in round 1 just means it did not catch the word that time.
        // Round 1 (full) gave nothing but round 2 (simple) gave text: this device needs
        // the simple mode. Seen on a real phone: full mode hears speech, answers "nomatch".
        const simpleNeeded = usedSimple;
        update((st) => (st.settings.srMode = worked ?? 'full'));
        micBtn.removeAttribute('disabled');
        micOut.replaceChildren(
          h('div', {}, '✓ Micro và nhận giọng nói đều chạy. Máy nghe được: ', ...out.alternatives.map((a) => h('span', { class: 'chip' }, a))),
          ...(simpleNeeded ? [line(`Chế độ đầy đủ không ra chữ trên máy này. App đã chuyển sang chế độ “${SR_MODE_LABEL[worked!]}” cho bài học.`, 'p-saved')] : []),
          line(`Mẹo: máy liệt kê ${out.alternatives.length} cách nghe. Nếu “dog” không có trong danh sách, thử nói gần máy hơn, ở chỗ yên tĩnh, nói một lần rồi dừng.`),
          trace,
        );
        return;
      }

      const msg: Record<Exclude<typeof out.status, 'heard'>, string> = {
        nothing: 'Micro có thu âm thanh nhưng không nghe ra tiếng nói. Nói to, gần máy hơn, rồi thử lại.',
        service: 'Bộ nhận giọng nói đã khởi động nhưng không thu được chút âm thanh nào. Thường do dịch vụ giọng nói của Google trên máy bị tắt, cũ, hoặc bị ứng dụng khác giành micro.',
        denied: 'Dịch vụ nhận giọng nói của máy từ chối quyền micro.',
        nomic: 'Nhận giọng nói không mở được micro (ứng dụng khác đang dùng micro?).',
        offline: 'Nhận giọng nói cần Internet (Chrome gửi âm thanh tới dịch vụ nhận dạng của Google). Hãy bật mạng.',
        unsupported: 'Trình duyệt này không có nhận giọng nói. ' + (advice || 'Hãy mở bằng Chrome trên Android.'),
        error: `Lỗi nhận giọng nói: ${out.trace.error || 'không rõ'}.`,
      };
      const rows: HTMLElement[] = [line(`✗ ${msg[out.status]}`, out.status === 'nothing' ? '' : 'p-warn')];

      // Now, separately, can the page open the microphone at all?
      if (out.status !== 'unsupported' && out.status !== 'offline') {
        await new Promise((r) => setTimeout(r, 300));
        try {
          if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error(), { name: 'NoMediaDevices' });
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((t) => t.stop());
          if (out.status === 'nothing') rows.push(line('Micro: trang mở được micro ✓'));
          else {
            rows.push(line('Micro: trang mở được micro ✓ — vậy Chrome và quyền micro của trang đều ổn, lỗi nằm ở dịch vụ nhận giọng nói của máy.'));
            if (out.status === 'denied' || first.status === 'denied') {
              // Chrome may open the mic, but the system speech app (usually "Google") refused:
              // Android reports that as "not-allowed" too.
              rows.push(line(GOOGLE_APP_PERMISSION, 'p-warn'));
            }
            if (out.status === 'service' || out.status === 'error' || out.status === 'denied') rows.push(line(SERVICE_HELP), line(GBOARD_TEST));
          }
        } catch (e) {
          const name = (e as Error)?.name || 'Lỗi';
          const why: Record<string, string> = {
            NotAllowedError: 'Micro đang bị chặn. ' + PERMISSION_HELP,
            SecurityError: 'Micro bị chặn vì trang không chạy HTTPS hoặc đang mở trong ứng dụng khác.',
            NotFoundError: 'Không tìm thấy micro trên máy.',
            NotReadableError: 'Micro đang bị ứng dụng khác dùng (gọi điện, ghi âm, Zalo…). Tắt ứng dụng đó rồi thử lại.',
            NoMediaDevices: 'Trình duyệt này không cho trang dùng micro. ' + (advice || 'Hãy mở bằng Chrome.'),
          };
          rows.push(line(`Micro: trang không mở được micro (${name}). ${why[name] ?? PERMISSION_HELP}`, 'p-warn'));
        }
      }
      micBtn.removeAttribute('disabled');
      micOut.replaceChildren(...rows, trace);
    });

    const refreshBtn = h('button', { class: 'p-btn' }, '🔄 Tải bản mới nhất');
    refreshBtn.addEventListener('click', async () => {
      // Offline the reload would fail and the installed app would not open until back online.
      // The offline copy answers '/', so ask for a URL it never holds (Wi-Fi without Internet looks "online").
      const online = navigator.onLine && (await fetch(`/sw.js?probe=${Date.now()}`, { cache: 'no-store' }).then((r) => r.ok, () => false));
      if (!online) {
        refreshBtn.textContent = 'Chưa có mạng — thử lại khi có Internet';
        return;
      }
      refreshBtn.setAttribute('disabled', '');
      refreshBtn.textContent = 'Đang tải…';
      // Drop the offline copy so the next load comes straight from the server.
      // Progress (localStorage) is NOT touched.
      try {
        const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
        await Promise.all(regs.map((r) => r.unregister()));
        const keys = (await caches?.keys?.()) ?? [];
        await Promise.all(keys.filter((k) => k.startsWith('efk-')).map((k) => caches.delete(k)));
      } catch {
        /* reload anyway */
      }
      location.reload();
    });

    // Advanced check: same recognizer, different languages. Tells apart "the speech
    // service works but not in English" from "Chrome cannot use the service at all".
    const advOut = h('div', { class: 'p-mic-out' });
    const advBtn = h('button', { class: 'p-btn' }, '🧪 Thử nâng cao (4 lần)');
    advBtn.addEventListener('click', async () => {
      advBtn.setAttribute('disabled', '');
      const plan: [string, string, string][] = [
        ['en-US', 'tiếng Anh (Mỹ)', 'dog'],
        ['en-GB', 'tiếng Anh (Anh)', 'dog'],
        ['', 'không chỉ định ngôn ngữ', 'dog'],
        ['vi-VN', 'tiếng Việt', 'xin chào'],
      ];
      const rows: HTMLElement[] = [];
      for (const [i, [lang, label, say]] of plan.entries()) {
        advOut.replaceChildren(...rows, line(`Lần ${i + 1}/4 (${label}): hãy nói “${say}”…`));
        if (i > 0) await new Promise((r) => setTimeout(r, 500));
        if (!ctx.alive()) return;
        const o = await listenOnce({ timeoutMs: 7000, mode: 'alts', lang });
        if (!ctx.alive()) return;
        const result =
          o.status === 'heard'
            ? `✓ ra chữ: ${o.alternatives.slice(0, 5).join(' · ')}`
            : o.trace.events.some((e) => e.startsWith('nomatch'))
              ? '✗ nghe thấy tiếng nhưng không ra chữ (nomatch)'
              : `✗ ${o.status}${o.trace.error ? ` (${o.trace.error})` : ''}`;
        rows.push(line(`Lần ${i + 1} — ${label}: ${result}`, o.status === 'heard' ? '' : 'p-warn'));
      }
      advOut.replaceChildren(...rows, line('Chụp màn hình này gửi người làm app.'));
      advBtn.removeAttribute('disabled');
    });

    return h(
      'div',
      { class: 'p-stack' },
      h('div', { class: 'p-row' }, h('span', { class: 'p-muted' }, `Phiên bản đang chạy: ${__APP_VERSION__}`), refreshBtn),
      h('label', { class: 'p-row' }, 'Tốc độ đọc', rate, rateLabel),
      h('label', { class: 'p-row' }, 'Giọng đọc', voiceSel),
      h('div', { class: 'p-row' }, testBtn, beepBtn),
      recBox,
      diag,
      envInfo,
      h('div', { class: 'p-row' }, micBtn, micOut),
      h('div', { class: 'p-row' }, advBtn, advOut),
    );
  }

  function installHelp() {
    const status = h('p', { class: 'p-muted' });
    const btn = h('button', { class: 'p-btn p-btn-main', hidden: true, onclick: () => void promptInstall() }, '📲 Cài vào màn hình chính');
    const refresh = async () => {
      btn.hidden = !canInstall();
      const ready = await offlineReady();
      status.textContent = (isInstalled() ? '✓ Đang chạy như ứng dụng đã cài. ' : '') + (ready ? '✓ Đã sẵn sàng chạy offline.' : 'Chưa sẵn sàng offline (mở app một lần khi có mạng).');
    };
    void refresh();
    const off = onInstallChange(() => void refresh());
    ctx.onCleanup(off);
    return h(
      'div',
      {},
      btn,
      status,
      h(
        'ol',
        { class: 'p-steps' },
        h('li', {}, 'Mở trang web bằng Chrome trên tablet, đợi trang tải xong.'),
        h('li', {}, 'Bấm ⋮ (góc trên phải) → “Thêm vào màn hình chính” / “Cài đặt ứng dụng”. Biểu tượng Bix sẽ hiện trên màn hình chính.'),
        h('li', {}, 'Lần đầu bé bấm micro, Chrome hỏi quyền micro → chọn “Cho phép”.'),
        h('li', {}, 'Bài học, hình và giọng đọc chạy offline. Riêng phần nghe bé nói cần Internet; khi mất mạng, bố mẹ dùng 2 nút “Bé nói đúng / Thử lại”.'),
        h('li', {}, 'Nếu giọng đọc nghe lạ: Cài đặt Android → Hệ thống → Ngôn ngữ → Chuyển văn bản thành giọng nói → chọn Google, tải giọng English (US).'),
        h('li', {}, 'Mẹo: mỗi ngày 1 bài, ngồi cạnh bé 2–3 ngày đầu. Bé có thể học lại bài cũ để nhận thêm khối.'),
      ),
    );
  }

  function privacy() {
    return h(
      'ul',
      { class: 'p-steps' },
      h('li', {}, 'Không có tài khoản, không quảng cáo, không công cụ thống kê bên thứ ba.'),
      h('li', {}, 'Tiến độ, tên bé và nhật ký chỉ lưu trong trình duyệt của máy này (localStorage).'),
      h('li', {}, 'App không ghi âm và không lưu âm thanh. Khi bé bấm micro, Chrome tự gửi âm thanh tới dịch vụ nhận dạng giọng nói của Google để chuyển thành chữ; app chỉ giữ lại chữ (ví dụ “dog”) để bố mẹ xem.'),
      h('li', {}, 'Khi đọc to (🎤 My turn) và trò chuyện với Bix (💬 Talk), chữ máy nghe được chỉ dùng để chấm ngay rồi bỏ; app chỉ đếm số lần. Bix không hỏi tên, trường hay bạn của bé.'),
    );
  }

  function resetField() {
    let armed = false;
    const btn = h('button', { class: 'p-btn p-btn-danger' }, 'Xoá toàn bộ tiến độ');
    btn.addEventListener('click', () => {
      if (!armed) {
        armed = true;
        btn.textContent = 'Bấm lần nữa để xoá thật';
        setTimeout(() => {
          armed = false;
          btn.textContent = 'Xoá toàn bộ tiến độ';
        }, 4000);
        return;
      }
      resetProgress(true);
      save();
      rerender();
      window.scrollTo(0, 0);
    });
    return h('div', {}, h('p', { class: 'p-muted' }, 'Xoá sao, khối, sticker, tủ đồ, vườn và nhật ký của bé đang dùng. Giữ lại tên bé và cài đặt. Các bé khác không bị ảnh hưởng.'), btn);
  }
}

function lastDays(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`);
  }
  return out;
}
