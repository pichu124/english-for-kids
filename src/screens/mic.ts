import { h } from '../lib/dom';
import { listenOnce, recognitionSupported } from '../lib/listen';
import { sfx } from '../lib/sfx';
import { say } from '../lib/tts';
import type { Ctx } from '../router';

export type MicResult = { result: 'ok' | 'tried' | 'parent' | 'skip'; heard: string[] };

/**
 * One speaking turn for the newer activities (phonics reading, reading aloud, talking with Bix).
 * A big microphone button: the child taps it and speaks; `check` decides from what was heard.
 * - heard and right → 'ok';
 * - heard but not right: "Try again!" (never "wrong"); after `tries` goes → 'tried' (moves on kindly);
 * - no speech service (unsupported, blocked, offline, broken): a parent judges with two buttons → 'parent' / 'skip'.
 * Nothing is recorded or stored: only the recognizer's text reaches `check`.
 */
export function micTurn(ctx: Ctx, host: HTMLElement, opts: { expect: string; check: (alts: string[]) => boolean; tries?: number; timeoutMs?: number; onHeard?: (alts: string[]) => void }): Promise<MicResult> {
  const tries = opts.tries ?? 2;
  return new Promise((resolve) => {
    let missed = 0;
    let busy = false;
    let lastHeard: string[] = [];
    const mic = h('button', { class: 'btn btn-round mic-btn', 'aria-label': 'Speak', 'data-say': opts.expect }, h('span', { class: 'mic-icon', 'aria-hidden': 'true' }, '🎤'));
    const status = h('p', { class: 'mic-status' });
    const parentRow = h('div', { class: 'mic-parent', hidden: true });
    const box = h('div', { class: 'mic-turn' }, mic, status, parentRow);
    host.appendChild(box);
    const done = (r: MicResult['result']) => {
      box.remove();
      resolve({ result: r, heard: lastHeard });
    };
    const askParent = (why: string) => {
      status.textContent = '';
      const ok = h('button', { class: 'p-btn mic-parent-ok', onclick: () => (sfx.success(), done('parent')) }, '✓ Bé đã nói');
      const skip = h('button', { class: 'p-btn mic-parent-skip', onclick: () => (sfx.tap(), done('skip')) }, 'Bỏ qua');
      parentRow.replaceChildren(h('span', { class: 'mic-parent-msg' }, why), ok, skip);
      parentRow.hidden = false;
    };
    if (!recognitionSupported()) askParent('Máy này không nghe được giọng nói. Bố mẹ nghe bé nói rồi bấm:');
    mic.addEventListener('click', async () => {
      if (busy || !ctx.alive()) return;
      busy = true;
      mic.classList.add('is-listening');
      status.textContent = '👂';
      const out = await listenOnce({ timeoutMs: opts.timeoutMs ?? 7000 });
      mic.classList.remove('is-listening');
      busy = false;
      if (!ctx.alive()) return;
      if (out.status === 'heard') {
        lastHeard = out.alternatives;
        opts.onHeard?.(out.alternatives);
        if (opts.check(out.alternatives)) return done('ok');
        missed++;
        if (missed >= tries) {
          status.textContent = '';
          await say('Good try!');
          return done('tried');
        }
        sfx.soft();
        mic.classList.remove('shake');
        void mic.offsetWidth;
        mic.classList.add('shake');
        status.textContent = '🔁';
        void say('Try again!');
        return;
      }
      if (out.status === 'nothing') {
        status.textContent = '🔁';
        void say("I can't hear you. Try again!");
        return;
      }
      askParent(out.status === 'denied' ? 'Micro đang bị chặn. Bố mẹ nghe bé nói rồi bấm:' : 'Máy chưa nghe được. Bố mẹ nghe bé nói rồi bấm:');
    });
  });
}
