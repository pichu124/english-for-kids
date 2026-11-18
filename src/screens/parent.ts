/** Parent area (Vietnamese). Gated behind a multiplication question. */
import { topics } from '../content';
import { h } from '../lib/dom';
import { listenOnce, recognitionSupported } from '../lib/listen';
import { canInstall, isInstalled, offlineReady, onInstallChange, promptInstall } from '../lib/pwa';
import { getState, resetProgress, save, today, update, wordKey, type DayLog } from '../lib/storage';
import { allVoices, englishVoices, lastSpeech, pickVoice, say, ttsSupported } from '../lib/tts';
import { sfx } from '../lib/sfx';
import { limitReached, minutesToday } from '../lib/usage';
import type { Ctx } from '../router';

export function parentScreen(ctx: Ctx): HTMLElement {
  const root = h('main', { class: 'parent' });
  const show = () => root.replaceChildren(panel(ctx, show));
  root.appendChild(gate(ctx, show));
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
    summaryCard(),
    card('Tên bé', nameField(), h('p', { class: 'p-muted' }, 'Bix sẽ chào bé bằng tên này (“Hi, …!”). Nên dùng tên ngắn, không dấu để giọng đọc tiếng Anh đọc dễ nghe.')),
    card('Giới hạn thời gian mỗi ngày', limitField()),
    card('Nhật ký 14 ngày', logTable()),
    card('Từ bé đã nói được', wordsList()),
    card('Giọng đọc & micro', voiceTools()),
    card('Cài ứng dụng & hướng dẫn', installHelp()),
    card('Quyền riêng tư', privacy()),
    card('Xoá tiến độ', resetField()),
    h('p', { class: 'p-muted p-foot' }, `Bản 0 · ${topics.length} chủ đề · dữ liệu chỉ lưu trên máy này`),
  );

  function card(title: string, ...body: (HTMLElement | null)[]) {
    return h('section', { class: 'p-card' }, h('h2', {}, title), ...body);
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
    const input = h('input', { class: 'p-input', type: 'text', maxlength: 20, placeholder: 'Ví dụ: Su, Bin, Mia', value: s.childName }) as HTMLInputElement;
    const ok = h('span', { class: 'p-saved', hidden: true }, '✓ Đã lưu');
    input.addEventListener('input', () => {
      update((st) => (st.childName = input.value.trim()));
      ok.hidden = false;
    });
    const hear = h('button', { class: 'p-btn', onclick: () => void say(`Hi, ${input.value.trim() || 'there'}!`) }, '🔊 Nghe Bix chào');
    return h('div', { class: 'p-row' }, input, hear, ok);
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
    return h(
      'div',
      { class: 'p-topics' },
      topics.map((t) => {
        const done = s.topics[t.id]?.completed ?? 0;
        return h(
          'div',
          { class: 'p-topic' },
          h('h3', {}, `${t.icon} ${t.title} — ${t.titleVi}`, h('small', {}, done ? ` · đã học ${done} lần` : ' · chưa học')),
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
              return h(
                'li',
                {},
                h('b', {}, w.text),
                chip,
                st?.heard ? h('span', { class: 'p-heard' }, `máy nghe: “${st.heard}”`) : null,
              );
            }),
          ),
        );
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

    const micOut = h('div', { class: 'p-mic-out' }, recognitionSupported() ? 'Bấm “Thử micro”, rồi nói một từ tiếng Anh (ví dụ “dog”).' : '⚠️ Trình duyệt này không có nhận dạng giọng nói. Hãy dùng Chrome trên Android.');
    const micBtn = h('button', { class: 'p-btn' }, '🎤 Thử micro');
    micBtn.addEventListener('click', async () => {
      micBtn.setAttribute('disabled', '');
      micOut.textContent = 'Đang nghe… hãy nói';
      const out = await listenOnce({ timeoutMs: 5000 });
      micBtn.removeAttribute('disabled');
      if (out.status === 'heard') micOut.replaceChildren('Máy nghe được: ', ...out.alternatives.map((a) => h('span', { class: 'chip' }, a)));
      else
        micOut.textContent = {
          nothing: 'Không nghe thấy gì. Thử nói to và gần máy hơn.',
          denied: 'Chưa có quyền micro. Vào ⋮ → Cài đặt → Cài đặt trang web → Micrô, cho phép trang này.',
          offline: 'Nhận giọng nói cần Internet (Chrome gửi âm thanh tới máy chủ nhận dạng của Google). Hãy bật mạng.',
          unsupported: 'Trình duyệt này không hỗ trợ nhận giọng nói.',
          error: `Lỗi: ${'error' in out ? out.error : ''}`,
        }[out.status];
    });

    return h(
      'div',
      { class: 'p-stack' },
      h('label', { class: 'p-row' }, 'Tốc độ đọc', rate, rateLabel),
      h('label', { class: 'p-row' }, 'Giọng đọc', voiceSel),
      h('div', { class: 'p-row' }, testBtn, beepBtn),
      diag,
      h('div', { class: 'p-row' }, micBtn, micOut),
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
    return h('div', {}, h('p', { class: 'p-muted' }, 'Xoá sao, khối, danh sách từ và nhật ký. Giữ lại tên bé và cài đặt.'), btn);
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
