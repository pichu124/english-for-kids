/**
 * A tiny synthesizer that plays the public-domain tunes in tunes.ts:
 * melody (soft triangle), bass on the chord root, a light tick on each beat.
 * Everything is generated live with Web Audio — no files, works offline.
 */
import { audioContext } from './sfx';
import { getState } from './storage';
import { melody, tuneById, TUNES, type Tune } from './tunes';

export type MusicMode = 'off' | 'chant' | 'all';
export const MUSIC_LABEL: Record<MusicMode, string> = { off: 'Tắt nhạc', chant: 'Chỉ khi đọc vè', all: 'Vè + nhạc nền nhẹ' };
export const musicMode = (): MusicMode => getState().settings.music ?? 'chant';

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const ROOT: Record<string, number> = { C: 48, D: 50, E: 52, F: 53, G: 43, A: 45, B: 47 };

export type Player = { stop(): void; tune: Tune };

/** Start a tune looping. `vol` 0–1 (keep it low under speech); `onBeat` fires on every beat. */
export function playTune(tune: Tune, opts: { vol?: number; onBeat?: () => void; loops?: number } = {}): Player | null {
  const ctx = audioContext();
  if (!ctx) return null;
  const master = ctx.createGain();
  master.gain.value = Math.max(0, Math.min(1, opts.vol ?? 0.5)) * 0.5;
  master.connect(ctx.destination);
  const { notes, length } = melody(tune);
  const chords = tune.chords.split(/\s+/).filter(Boolean);
  const unit = 60 / tune.bpm;
  const timers: number[] = [];
  let loopStart = ctx.currentTime + 0.12;
  let loop = 0;
  let next = 0; // index into a merged, time-sorted list built per loop
  type Ev = { at: number; kind: 'note' | 'bass' | 'tick'; midi?: number; units?: number; accent?: boolean };
  const events: Ev[] = [
    ...notes.map((n) => ({ at: n.at, kind: 'note' as const, midi: n.midi, units: n.units })),
    ...chords.map((c, i) => ({ at: i * tune.chordEvery, kind: 'bass' as const, midi: ROOT[c[0]] ?? 48, units: tune.chordEvery })),
    ...Array.from({ length: Math.ceil(length / tune.beatEvery) }, (_, i) => ({ at: i * tune.beatEvery, kind: 'tick' as const, accent: i % 2 === 0 })),
  ].sort((a, b) => a.at - b.at);

  const voice = (type: OscillatorType, f: number, t0: number, dur: number, vol: number) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(vol * 0.6, t0 + Math.min(0.15, dur * 0.5));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  };

  const schedule = () => {
    const horizon = ctx.currentTime + 0.3;
    for (;;) {
      if (next >= events.length) {
        loop++;
        if (opts.loops && loop >= opts.loops) return stop();
        loopStart += length * unit;
        next = 0;
      }
      const e = events[next];
      const t0 = loopStart + e.at * unit;
      if (t0 > horizon) break;
      next++;
      if (t0 < ctx.currentTime - 0.05) continue; // fell behind (tab was asleep): skip, don't burst
      if (e.kind === 'note') voice('triangle', freq(e.midi!), t0, Math.max(0.12, e.units! * unit * 0.92), 0.22);
      else if (e.kind === 'bass') voice('sine', freq(e.midi!), t0, e.units! * unit * 0.9, 0.2);
      else {
        voice('square', e.accent ? 1600 : 1200, t0, 0.03, e.accent ? 0.05 : 0.03);
        if (opts.onBeat) timers.push(window.setTimeout(opts.onBeat, Math.max(0, (t0 - ctx.currentTime) * 1000)));
      }
    }
  };
  const iv = window.setInterval(schedule, 60);
  schedule();

  let stopped = false;
  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(iv);
    timers.forEach(clearTimeout);
    try {
      master.gain.setTargetAtTime(0.0001, ctx!.currentTime, 0.08);
      setTimeout(() => master.disconnect(), 400);
    } catch {
      /* ignore */
    }
  }
  return { stop, tune };
}

// ---------------------------------------------------------------- background music

let bg: Player | null = null;
let bgIndex = Math.floor(Math.random() * TUNES.length);

/** Very soft music on the calm screens, only when the parent chose "all". */
export function setBackground(on: boolean): void {
  if (on && musicMode() === 'all') {
    if (bg) return;
    const tune = TUNES[bgIndex++ % TUNES.length];
    bg = playTune(tune, { vol: 0.18 });
  } else {
    bg?.stop();
    bg = null;
  }
}

export { tuneById };
