import { h } from '../lib/dom';
import { cancelListening, listenOnce, recognitionSupported } from '../lib/listen';
import { sfx } from '../lib/sfx';
import { say, stopSpeaking } from '../lib/tts';
import type { Ctx } from '../router';

export type MicResult = { result: 'ok' | 'tried' | 'parent' | 'skip'; heard: string[] };
/** A speaking turn: a promise that settles once, plus ways to end or pause it from outside. */
export type MicTurn = Promise<MicResult> & {
  /** The child moved on (tapped an answer, turned the page): end the turn quietly. */
  cancel(): void;
  /** Stop listening for now (Bix is about to talk), keep the turn open. */
  pause(): void;
};

/**
 * One speaking turn for the newer activities (phonics reading, reading aloud, talking with Bix).
 * A big microphone button: the child taps it and speaks; `check` decides from what was heard.
 * - heard and right → 'ok';
 * - heard but not right: "Try again!" (never "wrong"); after `tries` goes → 'tried' (moves on kindly);
 * - nothing heard twice, or no speech service (unsupported, blocked, offline): a parent judges
 *   with two buttons → 'parent' / 'skip'.
 * Nothing is recorded or stored: only the recognizer's text reaches `check`.
 */
export function micTurn(ctx: Ctx, host: HTMLElement, opts: { expect: string; check: (alts: string[]) => boolean; tries?: number; timeoutMs?: number; onHeard?: (alts: string[]) => void; /** said when the turn opens, e.g. "Your turn! Tap and read." (the mic glows until tapped) */ prompt?: string }): MicTurn {
  const tries = opts.tries ?? 2;
  let finished = false;
  let listening = false;
  let ignore = false; // the current listen was stopped from outside: drop its result
  let resolveTurn!: (r: MicResult) => void;
  const promise = new Promise<MicResult>((r) => (resolveTurn = r)) as MicTurn;
  let missed = 0;
  let empty = 0;
  let busy = false;
  let lastHeard: string[] = [];
  const mic = h('button', { class: 'btn btn-round mic-btn', 'aria-label': 'Speak', 'data-say': opts.expect }, h('span', { class: 'mic-icon', 'aria-hidden': 'true' }, '🎤'));
  const status = h('p', { class: 'mic-status' });
  const parentRow = h('div', { class: 'mic-parent', hidden: true });
  const box = h('div', { class: 'mic-turn' }, mic, status, parentRow);
  host.appendChild(box);
  const stopListening = () => {
    if (!listening) return;
    ignore = true;
    cancelListening();
  };
  const done = (r: MicResult['result']) => {
    if (finished) return;
    finished = true;
    stopListening();
    box.remove();
    resolveTurn({ result: r, heard: lastHeard });
  };
  promise.cancel = () => done('skip');
  promise.pause = stopListening;
  const askParent = (why: string) => {
    status.textContent = '';
    const ok = h('button', { class: 'p-btn mic-parent-ok', onclick: () => (sfx.success(), done('parent')) }, '✓ Bé đã nói');
    const skip = h('button', { class: 'p-btn mic-parent-skip', onclick: () => (sfx.tap(), done('skip')) }, 'Bỏ qua');
    parentRow.replaceChildren(h('span', { class: 'mic-parent-msg' }, why), ok, skip);
    parentRow.hidden = false;
  };
  const wiggle = () => {
    mic.classList.remove('shake');
    void mic.offsetWidth;
    mic.classList.add('shake');
  };
  if (!recognitionSupported()) askParent('Máy này không nghe được giọng nói. Bố mẹ nghe bé nói rồi bấm:');
  else if (opts.prompt) {
    mic.classList.add('is-hint');
    void say(opts.prompt);
  }
  mic.addEventListener('click', async () => {
    if (busy || finished || !ctx.alive()) return;
    busy = true;
    ignore = false;
    mic.classList.remove('is-hint');
    stopSpeaking(); // the mic must not hear Bix
    listening = true;
    mic.classList.add('is-listening');
    status.textContent = '👂';
    const out = await listenOnce({ timeoutMs: opts.timeoutMs ?? 7000 });
    listening = false;
    mic.classList.remove('is-listening');
    if (finished || ignore || !ctx.alive()) {
      busy = false;
      status.textContent = '';
      return;
    }
    if (out.status === 'heard') {
      lastHeard = out.alternatives;
      opts.onHeard?.(out.alternatives);
      if (opts.check(out.alternatives)) return done('ok');
      missed++;
      if (missed >= tries) {
        status.textContent = '';
        await say('Good try!'); // busy stays true: no second listen while Bix talks
        return done('tried');
      }
      sfx.soft();
      wiggle();
      status.textContent = '🔁';
      busy = false;
      void say('Try again!');
      return;
    }
    if (out.status === 'nothing') {
      // a shy child, a quiet voice, or a phone that hears speech but gives no text
      empty++;
      status.textContent = '🔁';
      busy = false;
      if (empty >= 2) askParent('Máy chưa nghe rõ bé. Bố mẹ nghe bé nói rồi bấm:');
      void say(empty >= 2 ? 'Say it to Mum or Dad!' : "I can't hear you. Try again!");
      return;
    }
    busy = false;
    askParent(out.status === 'denied' ? 'Micro đang bị chặn. Bố mẹ nghe bé nói rồi bấm:' : 'Máy chưa nghe được. Bố mẹ nghe bé nói rồi bấm:');
  });
  return promise;
}
