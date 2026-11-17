/** Small synthesized sound effects (no audio files, works offline). */

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.18) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

export const sfx = {
  /** Call once from a tap so later sounds are allowed. */
  unlock() {
    ac();
  },
  tap() {
    tone(660, 0, 0.08, 'triangle', 0.12);
  },
  pop() {
    tone(520, 0, 0.07, 'square', 0.06);
    tone(880, 0.05, 0.1, 'triangle', 0.1);
  },
  success() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22, 'triangle', 0.16));
  },
  soft() {
    tone(392, 0, 0.18, 'sine', 0.12);
    tone(330, 0.12, 0.22, 'sine', 0.1);
  },
  micOn() {
    tone(740, 0, 0.09, 'sine', 0.12);
  },
  reward() {
    [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.11, 0.3, 'triangle', 0.15));
  },
  place() {
    tone(220, 0, 0.08, 'square', 0.08);
    tone(330, 0.03, 0.08, 'triangle', 0.1);
  },
};
