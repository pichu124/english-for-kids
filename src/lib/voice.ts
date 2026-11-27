/**
 * Recorded voice: when a real person's recording of a line exists, Bix plays it instead of the
 * phone's speech engine (which sounds robotic on cheap phones, or may have no English voice).
 *
 * public/audio/manifest.json maps each recorded line (normalised text) to its file:
 *   { "lines": { "this is a dog": "this-is-a-dog-1a2b.mp3", … } }
 * A line made of several sentences is played sentence by sentence when every sentence has a
 * recording; otherwise the whole line goes to the speech engine as before. With an empty
 * manifest (the default) nothing changes. List of lines to record: scripts/voice-lines.mjs.
 */
import { getState } from './storage';

let lines: Record<string, string> = {};
let loaded: Promise<void> | null = null;

/** "Hello, Bix!" → "hello bix" (apostrophes kept: "it's"). */
export const normalizeLine = (t: string) =>
  t
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** "Great! Find the cat." → ["Great!", "Find the cat."] */
export const splitSentences = (t: string) =>
  t
    .split(/(?<=[.!?…])\s+/)
    .map((x) => x.trim())
    .filter((x) => normalizeLine(x));

export function loadVoice(): Promise<void> {
  loaded ??= fetch('/audio/manifest.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((m) => {
      if (m && typeof m.lines === 'object' && m.lines) lines = m.lines as Record<string, string>;
    })
    .catch(() => undefined);
  return loaded;
}

/** How many lines have a recording (parent area). */
export const recordedCount = () => Object.keys(lines).length;
const enabled = () => getState().settings.recorded !== false && recordedCount() > 0;

/** The recordings for every sentence of `text`, or null if one is missing (then the engine speaks it). */
export function recordingsFor(text: string): string[] | null {
  if (!enabled()) return null;
  const files = splitSentences(text).map((s) => lines[normalizeLine(s)]);
  return files.length && files.every(Boolean) ? files.map((f) => `/audio/${f}`) : null;
}

let playing: HTMLAudioElement | null = null;
export function stopRecording(): void {
  try {
    playing?.pause();
  } catch {
    /* ignore */
  }
  playing = null;
}

/** Play the files one after the other; false if a file could not be played (fall back to the engine). */
export async function playRecordings(files: string[], rate: number, alive: () => boolean): Promise<boolean> {
  for (const f of files) {
    if (!alive()) return true;
    const ok = await new Promise<boolean>((resolve) => {
      const a = new Audio(f);
      playing = a;
      // the speed slider (0.8 = normal) also slows recordings down a little
      a.playbackRate = Math.min(1.2, Math.max(0.7, rate / 0.8));
      a.preservesPitch = true;
      const done = (v: boolean) => {
        clearTimeout(t);
        a.onended = a.onerror = a.onpause = null;
        resolve(v);
      };
      const t = setTimeout(() => done(true), 20000);
      a.onended = () => done(true);
      a.onpause = () => done(true); // stopped by the app (next screen, next line)
      a.onerror = () => done(false);
      a.play().catch(() => done(false));
    });
    if (!ok) return false;
  }
  return true;
}
