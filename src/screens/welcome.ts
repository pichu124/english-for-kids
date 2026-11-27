import { Bix } from '../art/bix';
import { LEVELS } from '../content';
import { h } from '../lib/dom';
import { browserAdvice } from '../lib/env';
import { setLevel } from '../lib/level';
import { listenOnce, recognitionSupported } from '../lib/listen';
import { sfx } from '../lib/sfx';
import { getState, markWelcomed, SR_MODES, update, type SrMode } from '../lib/storage';
import { primeSpeech, say, ttsSupported } from '../lib/tts';
import type { Ctx } from '../router';

/**
 * The first time the app opens on a device: a short set-up for the parent (Vietnamese),
 * before the child ever sees the Play button. The child's name and age (→ the level),
 * a daily time, then a sound and microphone check. Every step can be skipped and
 * changed later in the parent area.
 */

/** Age → the level to start on (the Cambridge ages, a little gentle). */
export function levelForAge(age: number): string {
  if (age <= 3) return 'L0';
  if (age === 4) return 'L1';
  if (age <= 6) return 'L2';
  if (age <= 8) return 'L3';
  return 'L4';
}

const AGES = [3, 4, 5, 6, 7, 8, 9, 10];
const LIMITS: [number, string][] = [
  [10, '10 phút'],
  [15, '15 phút'],
  [20, '20 phút'],
  [30, '30 phút'],
  [0, 'Không giới hạn'],
];

export function welcomeScreen(ctx: Ctx): HTMLElement {
  const bix = new Bix({ size: 'md', bubble: false }).setMood('hello');
  const body = h('section', { class: 'wl-body' });
  const dots = h('div', { class: 'wl-dots', 'aria-hidden': 'true' }, [0, 1, 2, 3].map(() => h('span')));
  const el = h('main', { class: 'welcome', lang: 'vi' }, h('div', { class: 'wl-side' }, bix.el, dots), body);

  let age: number | null = null;
  const finish = () => {
    markWelcomed();
    ctx.go('start');
  };
  /** What the current card keeps when the parent skips the rest (a name already typed). */
  let keepOnSkip: (() => void) | null = null;
  const skip = () => h('button', { class: 'p-btn wl-skip', 'data-wl': 'skip', onclick: () => (sfx.tap(), keepOnSkip?.(), finish()) }, 'Bỏ qua, cài sau');
  // ◀ and the Android back button go to the card before (each card after the first gets a history entry)
  let step = 0;
  let goingBack = false;
  const steps: (() => void)[] = [];
  const back = () => step > 0 && ((goingBack = true), steps[step - 1](), (goingBack = false));
  const onPop = () => back();
  window.addEventListener('popstate', onPop);
  ctx.onCleanup(() => window.removeEventListener('popstate', onPop));
  const enter = (n: number) => {
    if (n > step && !goingBack) {
      try {
        history.pushState({ bixWelcome: n }, '');
      } catch {
        /* ignore */
      }
    }
    step = n;
  };
  const card = (n: number, title: string, ...kids: (HTMLElement | HTMLElement[] | string | null)[]) => {
    enter(n);
    keepOnSkip = null;
    [...dots.children].forEach((d, k) => (d.classList.toggle('on', k < n), d.classList.toggle('now', k === n)));
    body.replaceChildren(h('div', { class: 'wl-card pop', 'data-step': String(n) }, h('h1', { class: 'wl-title' }, title), ...kids));
    body.scrollTop = 0;
  };
  const nav = (next: () => void, label = 'Tiếp ▶') =>
    h(
      'div',
      { class: 'wl-nav' },
      step > 0 ? h('button', { class: 'p-btn wl-back', 'data-wl': 'back', 'aria-label': 'Quay lại', onclick: () => (sfx.tap(), back()) }, '◀') : null,
      skip(),
      h('button', { class: 'p-btn p-btn-main wl-next', 'data-wl': 'next', onclick: () => (sfx.tap(), next()) }, label),
    );

  // 1. Hello
  const hello = () =>
    card(
      0,
      'Chào bố mẹ! 👋',
      h('p', { class: 'wl-lead' }, 'Bix English giúp bé nghe và nói tiếng Anh qua trò chơi ngắn, mỗi ngày khoảng 10–15 phút.'),
      h(
        'ul',
        { class: 'wl-points' },
        h('li', {}, '🎮 Bé tự chơi được: nghe, nhắc lại, chạm hình, đọc truyện. Bix không bao giờ chê “sai”.'),
        h('li', {}, '📚 Bài học từ mức 3 tuổi đến trình độ Starters, Movers, Flyers (theo khung Cambridge; app không liên kết với Cambridge).'),
        h('li', {}, '🔒 Không quảng cáo. App không thu thập dữ liệu: tiến độ của bé chỉ lưu trên máy này.'),
      ),
      h('p', { class: 'p-muted' }, 'Cài đặt mất khoảng 1 phút. Mọi thứ đều đổi lại được trong khu bố mẹ.'),
      h(
        'p',
        { class: 'p-muted wl-legal' },
        'Đọc thêm: ',
        h('button', { class: 'wl-link', 'data-legal': 'privacy', onclick: () => ctx.go('legal', { doc: 'privacy', from: 'welcome' }) }, 'Chính sách quyền riêng tư'),
        ' · ',
        h('button', { class: 'wl-link', 'data-legal': 'terms', onclick: () => ctx.go('legal', { doc: 'terms', from: 'welcome' }) }, 'Điều khoản sử dụng'),
      ),
      nav(child, 'Bắt đầu ▶'),
    );

  // 2. Name and age → level
  const child = () => {
    const name = h('input', { class: 'p-input wl-name', type: 'text', maxlength: 20, placeholder: 'Tên ở nhà, ví dụ: Su, Bin, Mia', value: getState().childName, 'aria-label': 'Tên của bé' }) as HTMLInputElement;
    const levelBox = h('div', { class: 'wl-level' });
    const showLevel = () => {
      const cur = getState().settings.level;
      levelBox.replaceChildren(
        age === null
          ? h('p', { class: 'p-muted' }, 'Chọn tuổi để app gợi ý bậc học phù hợp.')
          : h(
              'div',
              {},
              h('p', {}, 'Bậc gợi ý. Nếu bé thấy dễ hoặc khó quá, đổi ở đây hoặc trong khu bố mẹ:'),
              h(
                'div',
                { class: 'p-seg' },
                LEVELS.map((l) => h('button', { class: `p-seg-btn ${l.id === cur ? 'is-on' : ''}`, 'data-level': l.id, onclick: () => (setLevel(l.id), showLevel()) }, l.nameVi)),
              ),
            ),
      );
    };
    const ages = h(
      'div',
      { class: 'p-seg wl-ages' },
      AGES.map((a) =>
        h(
          'button',
          {
            class: `p-seg-btn ${a === age ? 'is-on' : ''}`,
            'data-age': String(a),
            onclick: (e: Event) => {
              age = a;
              ages.querySelectorAll('.p-seg-btn').forEach((b) => b.classList.toggle('is-on', b === e.currentTarget));
              setLevel(levelForAge(a));
              showLevel();
            },
          },
          a === 10 ? '10+ tuổi' : `${a} tuổi`,
        ),
      ),
    );
    showLevel();
    const save = () => update((s) => (s.childName = name.value.trim()));
    card(
      1,
      'Bé tên gì, mấy tuổi?',
      h('label', { class: 'wl-field' }, h('span', {}, 'Tên của bé (không bắt buộc, dùng trên giấy khen và lời chào)'), name),
      h('div', { class: 'wl-field' }, h('span', {}, 'Tuổi'), ages),
      levelBox,
      nav(() => (save(), time())),
    );
    keepOnSkip = save;
  };

  // 3. Daily time
  const time = () => {
    const seg = h('div', { class: 'p-seg' });
    // 15 minutes is suggested (and kept if the parent skips from this card)
    let pick = getState().settings.dailyLimitMin || 15;
    const render = () =>
      seg.replaceChildren(
        ...LIMITS.map(([m, label]) => h('button', { class: `p-seg-btn ${m === pick ? 'is-on' : ''}`, 'data-limit': String(m), onclick: () => ((pick = m), render()) }, label)),
      );
    render();
    card(
      2,
      'Mỗi ngày học bao lâu?',
      h('p', {}, 'Hết giờ, Bix chào tạm biệt và hẹn bé ngày mai. Với bé 3–7 tuổi, 10–15 phút mỗi ngày là vừa.'),
      seg,
      nav(() => (update((s) => (s.settings.dailyLimitMin = pick)), check())),
    );
    keepOnSkip = () => update((s) => (s.settings.dailyLimitMin = pick)); // what the card shows is what is kept
  };

  // 4. Sound and microphone
  const check = () => {
    const soundOut = h('div', { class: 'p-mic-out', 'aria-live': 'polite' });
    const micOut = h('div', { class: 'p-mic-out', 'aria-live': 'polite' });
    const yesNo = (onYes: () => void, onNo: () => void) =>
      h('div', { class: 'p-row' }, h('button', { class: 'p-btn', 'data-wl': 'heard', onclick: onYes }, '👍 Nghe rõ'), h('button', { class: 'p-btn', 'data-wl': 'not-heard', onclick: onNo }, '🔇 Không nghe thấy'));
    const soundBtn = h('button', { class: 'p-btn wl-test', 'data-wl': 'sound' }, '🔊 Nghe thử');
    soundBtn.addEventListener('click', async () => {
      primeSpeech();
      sfx.unlock();
      if (!ttsSupported()) {
        soundOut.replaceChildren(h('div', { class: 'p-warn' }, '⚠️ Trình duyệt này không có giọng đọc. ' + (browserAdvice() || 'Hãy mở bằng Chrome.')));
        return;
      }
      soundOut.replaceChildren(h('div', {}, 'Bix đang nói: “Hello! I’m Bix. Let’s play!”'));
      bix.setMood('happy');
      await say("Hello! I'm Bix. Let's play!");
      if (!ctx.alive()) return;
      soundOut.replaceChildren(
        h('div', {}, 'Bố mẹ có nghe rõ không?'),
        yesNo(
          () => soundOut.replaceChildren(h('div', { class: 'p-saved' }, '✓ Loa và giọng đọc chạy tốt.')),
          () =>
            soundOut.replaceChildren(
              h('div', { class: 'p-warn' }, 'Thử: tăng âm lượng (nút cạnh máy), tắt chế độ im lặng, rồi bấm Nghe thử lại. Vẫn không được thì vào khu bố mẹ → Giọng đọc & micro → “Nghe thử giọng đọc” để xem máy có giọng tiếng Anh không.'),
            ),
        ),
      );
    });
    const micBtn = h('button', { class: 'p-btn wl-test', 'data-wl': 'mic' }, '🎤 Thử micro');
    micBtn.addEventListener('click', async () => {
      if (!recognitionSupported()) {
        micOut.replaceChildren(h('div', {}, 'Trình duyệt này không nhận được giọng nói. ' + (browserAdvice() || 'Hãy mở bằng Chrome trên Android.') + ' Không sao: khi bé nói, bố mẹ bấm “✓ Bé đã nói” để chấm.'));
        return;
      }
      micBtn.setAttribute('disabled', '');
      // like the parent-area check: try each recognizer setting until one gives text, and keep it
      let heard: string[] | null = null;
      let worked: SrMode | null = null;
      let last = '';
      for (const [i, mode] of SR_MODES.entries()) {
        micOut.replaceChildren(h('div', {}, i === 0 ? 'Đang nghe… hãy nói “hello”.' : 'Thử lại lần nữa: nói “hello”.'));
        if (i > 0) await new Promise((r) => setTimeout(r, 400));
        if (!ctx.alive()) return;
        const out = await listenOnce({ timeoutMs: 7000, mode });
        if (!ctx.alive()) return;
        last = out.status;
        if (out.status === 'heard') {
          heard = out.alternatives;
          worked = mode;
          break;
        }
        if (!(out.status === 'service' || out.status === 'nothing')) break;
      }
      micBtn.removeAttribute('disabled');
      if (heard && worked) {
        update((s) => (s.settings.srMode = worked!));
        micOut.replaceChildren(h('div', { class: 'p-saved' }, `✓ Micro chạy tốt. Máy nghe được: “${heard[0]}”.`));
        return;
      }
      const why: Record<string, string> = {
        denied: 'Micro chưa được cho phép. Trong Chrome: chạm biểu tượng bên trái địa chỉ trang → Quyền → Micrô → Cho phép. Nếu app đã cài ra màn hình chính (không có thanh địa chỉ): Cài đặt Android → Ứng dụng → Chrome → Quyền → Micrô → Cho phép. Rồi thử lại.',
        offline: 'Nhận giọng nói cần Internet. Bật mạng rồi thử lại.',
        nomic: 'Không mở được micro (có ứng dụng khác đang dùng?).',
      };
      micOut.replaceChildren(
        h('div', { class: 'p-warn' }, why[last] ?? 'Máy chưa nghe ra tiếng nói.'),
        h('div', {}, 'Không sao: khi máy không nghe được, bố mẹ bấm “✓ Bé đã nói” để chấm. Khu bố mẹ → Giọng đọc & micro có hướng dẫn sửa chi tiết.'),
      );
    });
    card(
      3,
      'Thử loa và micro',
      h('div', { class: 'wl-test-row' }, soundBtn, soundOut),
      h('div', { class: 'wl-test-row' }, micBtn, micOut),
      h('p', { class: 'p-muted' }, 'Bấm “Thử micro”, cho phép micro nếu máy hỏi, rồi nói “hello”.'),
      h('p', { class: 'p-muted wl-privacy' }, 'Khi bé nói, Chrome gửi tiếng nói tới dịch vụ nhận giọng nói của Google để chuyển thành chữ. App không lưu hay gửi bản ghi âm đi đâu khác.'),
      nav(done),
    );
  };

  // 5. Ready
  const done = () => {
    enter(4);
    keepOnSkip = null;
    [...dots.children].forEach((d) => (d.classList.add('on'), d.classList.remove('now')));
    bix.setMood('happy');
    const name = getState().childName.trim();
    body.replaceChildren(
      h(
        'div',
        { class: 'wl-card pop', 'data-step': '4' },
        h('h1', { class: 'wl-title' }, 'Xong rồi! 🎉'),
        h('p', { class: 'wl-lead' }, `Giờ đưa máy cho ${name || 'bé'} và bấm nút ▶ lớn.`),
        h(
          'ul',
          { class: 'wl-points' },
          h('li', {}, '🌟 Nút “Today” trên màn chính dẫn bé đi qua bài của ngày hôm nay.'),
          h('li', {}, '🔒 Khu bố mẹ: nút “Bố mẹ” ở góc trên. Có một phép tính nhỏ để bé không tự vào.'),
          h('li', {}, '👨‍👩‍👧 Nhiều con dùng chung máy? Thêm hồ sơ cho từng bé trong khu bố mẹ.'),
        ),
        h('div', { class: 'wl-nav' }, h('button', { class: 'p-btn p-btn-main wl-next', 'data-wl': 'go', onclick: () => (sfx.tap(), finish()) }, '▶ Vào app')),
      ),
    );
  };

  steps.push(hello, child, time, check, done);
  hello();
  return el;
}
