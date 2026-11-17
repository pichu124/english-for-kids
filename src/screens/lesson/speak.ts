import { askFor, type Word } from '../../content';
import { h } from '../../lib/dom';
import { listenOnce, recognitionSupported, type ListenOutcome } from '../../lib/listen';
import { matchSpeech } from '../../lib/match';
import { sfx } from '../../lib/sfx';
import { dayLog, today, update, wordKey } from '../../lib/storage';
import { confetti } from '../widgets';
import { type LessonUI, PRAISE, pick, wordCard } from './shared';

const MIC_SVG = `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="16" y="4" width="16" height="26" rx="8" fill="#fff"/><path d="M10 22a14 14 0 0 0 28 0" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><rect x="21.5" y="35" width="5" height="8" fill="#fff"/><rect x="14" y="41" width="20" height="5" rx="2.5" fill="#fff"/></svg>`;

type Attempt =
  | { kind: 'pass'; heard: string }
  | { kind: 'miss'; heard: string } // recognizer heard something else, or nothing
  | { kind: 'novoice'; reason: 'denied' | 'offline' | 'unsupported' | 'error' };

const NOVOICE_MSG: Record<'denied' | 'offline' | 'unsupported' | 'error', string> = {
  denied: 'Chưa có quyền dùng micro. Bố mẹ bật quyền micro cho trang này trong Chrome, hoặc chấm giúp bé:',
  offline: 'Nhận giọng nói cần mạng mà máy đang offline. Bố mẹ chấm giúp bé nhé:',
  unsupported: 'Trình duyệt này không nhận giọng nói. Bố mẹ nghe bé nói rồi chấm giúp:',
  error: 'Micro đang gặp lỗi. Bố mẹ chấm giúp bé nhé:',
};

/** Step 2 — Speak: the child says each word; Bix cheers. Never "wrong". */
export async function runSpeak(ui: LessonUI): Promise<void> {
  ui.setStep(1);
  await ui.talk("Now it's your turn! Press the button and talk.", 'encourage', 'Your turn!');
  for (const w of ui.topic.words) {
    await speakWord(ui, w);
    ui.parentBar.replaceChildren();
    ui.tick();
  }
}

async function speakWord(ui: LessonUI, w: Word): Promise<void> {
  const card = wordCard(w, { cls: 'word-card-md pop' });
  const mic = h('button', { class: 'btn btn-mic', 'aria-label': 'Talk', html: MIC_SVG });
  const ear = h('button', { class: 'btn btn-round btn-sun btn-ear', 'aria-label': 'Listen again' }, h('span', { class: 'icon-speaker' }));
  const rings = h('div', { class: 'mic-rings', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'));
  ui.stage.replaceChildren(h('div', { class: 'speak' }, card, h('div', { class: 'mic-wrap' }, rings, mic), ear));

  const ok = h('button', { class: 'pbtn pbtn-ok' }, '✓ Bé nói đúng');
  const retry = h('button', { class: 'pbtn' }, '↻ Thử lại');
  let tries = 0;
  let autoStart = false;

  await ui.talk(askFor(w), 'idle');

  for (;;) {
    let tapped: HTMLElement;
    if (autoStart) {
      tapped = mic;
      autoStart = false;
    } else {
      mic.classList.add('is-ready');
      const watch: HTMLElement[] = [mic, ear, card];
      if (ui.parentBar.childElementCount) watch.push(ok, retry);
      tapped = await ui.tapAny(watch);
      mic.classList.remove('is-ready');
    }

    if (tapped === ear || tapped === card) {
      sfx.tap();
      await ui.talk(`${w.text}.`, 'talk', w.text);
      await ui.talk(askFor(w), 'idle');
      continue;
    }
    if (tapped === ok) return celebrate(ui, w, card, 'parent', '');
    if (tapped === retry) {
      tries++;
      if (tries >= 2) return moveOn(ui);
      ui.parentBar.replaceChildren();
      await ui.talk(`Try again! ${w.text}!`, 'encourage', 'Try again!');
      continue;
    }

    // tapped the mic
    sfx.micOn();
    ui.parentBar.replaceChildren();
    const result = await attempt(ui, w, mic, rings);
    ui.guard();

    if (result.kind === 'pass') {
      record(ui.topic.id, w, result, 'auto');
      return celebrate(ui, w, card, 'auto', result.heard);
    }

    if (result.kind === 'miss') {
      record(ui.topic.id, w, result, 'miss');
      tries++;
      showParentBar(ui, result.heard ? `Máy nghe được: “${result.heard}”. Nếu bé nói đúng, bố mẹ bấm:` : 'Máy không nghe rõ. Nếu bé đã nói đúng, bố mẹ bấm:', ok, retry);
      if (tries >= 2) {
        // Give a parent a moment to override before moving on.
        sfx.soft();
        await ui.talk('Good try! Let’s go on.', 'encourage');
        const t = await raceTap(ui, [ok], 1800);
        if (t === ok) return celebrate(ui, w, card, 'parent', result.heard);
        return;
      }
      sfx.soft();
      await ui.talk(`Try again! ${w.text}!`, 'encourage', 'Try again!');
      continue;
    }

    // No voice at all — rely on the parent.
    record(ui.topic.id, w, result, 'novoice');
    ui.bix.setMood('idle');
    ui.bix.show('');
    showParentBar(ui, NOVOICE_MSG[result.reason], ok, retry, true);
    const t = await ui.tapAny<HTMLElement>([ok, retry, mic]);
    if (t === ok) return celebrate(ui, w, card, 'parent', '');
    tries++;
    if (tries >= 2) return moveOn(ui);
    ui.parentBar.replaceChildren();
    if (t === mic) autoStart = true;
    else await ui.talk(`Try again! ${w.text}!`, 'encourage', 'Try again!');
  }
}

async function attempt(ui: LessonUI, w: Word, mic: HTMLElement, rings: HTMLElement): Promise<Attempt> {
  ui.bix.setMood('listen');
  ui.bix.show('...');
  mic.classList.add('is-listening');
  rings.classList.add('is-on');
  try {
    if (!recognitionSupported()) {
      await ui.pause(3500); // time for the child to speak, then ask the parent
      return { kind: 'novoice', reason: 'unsupported' };
    }
    let passed = '';
    const out: ListenOutcome = await listenOnce({
      timeoutMs: 6000,
      onSpeechStart: () => ui.bix.show('🎵'),
      onTranscript: (alts) => {
        const m = matchSpeech(w.text, w.accept ?? [], alts);
        if (m.ok) passed = m.heard;
        return m.ok;
      },
    });
    if (out.status === 'heard') {
      if (passed) return { kind: 'pass', heard: passed };
      const m = matchSpeech(w.text, w.accept ?? [], out.alternatives);
      return m.ok ? { kind: 'pass', heard: m.heard } : { kind: 'miss', heard: out.alternatives[0] ?? '' };
    }
    if (out.status === 'nothing') return { kind: 'miss', heard: '' };
    return { kind: 'novoice', reason: out.status === 'unsupported' ? 'unsupported' : out.status === 'denied' ? 'denied' : out.status === 'offline' ? 'offline' : 'error' };
  } finally {
    mic.classList.remove('is-listening');
    rings.classList.remove('is-on');
  }
}

function showParentBar(ui: LessonUI, msg: string, ok: HTMLElement, retry: HTMLElement, strong = false): void {
  ui.parentBar.replaceChildren(h('div', { class: `parent-bar ${strong ? 'is-strong' : ''}` }, h('span', { class: 'parent-bar-msg' }, msg), ok, retry));
}

async function raceTap(ui: LessonUI, els: HTMLElement[], ms: number): Promise<HTMLElement | null> {
  return Promise.race([ui.tapAny(els), ui.pause(ms).then(() => null)]);
}

async function celebrate(ui: LessonUI, w: Word, card: HTMLElement, by: 'auto' | 'parent', heard: string): Promise<void> {
  if (by === 'parent') record(ui.topic.id, w, { kind: 'pass', heard }, 'parent');
  ui.parentBar.replaceChildren();
  sfx.success();
  confetti(document.body, 20);
  card.classList.add('is-done');
  await ui.talk(pick(PRAISE), 'happy');
  await ui.pause(700);
}

async function moveOn(ui: LessonUI): Promise<void> {
  ui.parentBar.replaceChildren();
  await ui.talk('Good try! Let’s go on.', 'encourage');
  await ui.pause(400);
}

type Judge = 'auto' | 'parent' | 'miss' | 'novoice';

function record(topicId: string, w: Word, a: Attempt, judge: Judge): void {
  update((s) => {
    const key = wordKey(topicId, w.id);
    const ws = (s.words[key] ??= { said: false, tries: 0 });
    if (judge !== 'parent') ws.tries++; // a parent "correct" confirms the attempt already counted
    if ('heard' in a && a.heard) ws.heard = a.heard;
    ws.last = today();
    if (a.kind === 'pass') {
      ws.said = true;
      ws.by = judge === 'parent' ? 'parent' : 'auto';
    }
    const log = dayLog();
    if (judge === 'auto') log.auto++;
    else if (judge === 'parent') log.parent++;
    else if (judge === 'novoice') log.noVoice++;
    else if (judge === 'miss') log.miss++;
  });
}
