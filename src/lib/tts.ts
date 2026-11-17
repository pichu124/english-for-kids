/** Text-to-speech via the browser's speechSynthesis (en-US). */
import { getState } from './storage';

const synth: SpeechSynthesis | undefined =
  typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : undefined;

let voices: SpeechSynthesisVoice[] = [];
let generation = 0;

function loadVoices() {
  if (!synth) return;
  voices = synth.getVoices();
}
if (synth) {
  loadVoices();
  synth.addEventListener?.('voiceschanged', loadVoices);
}

export function ttsSupported(): boolean {
  return !!synth;
}

export function englishVoices(): SpeechSynthesisVoice[] {
  loadVoices();
  return voices.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('en'));
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const list = englishVoices();
  const wanted = getState().settings.voiceURI;
  if (wanted) {
    const v = list.find((x) => x.voiceURI === wanted);
    if (v) return v;
  }
  const us = list.filter((v) => v.lang.replace('_', '-').toLowerCase() === 'en-us');
  return (
    us.find((v) => v.localService) || // offline-capable first
    us.find((v) => /google/i.test(v.name)) ||
    us[0] ||
    list[0]
  );
}

/** Stop anything currently being spoken and invalidate pending sequences. */
export function stopSpeaking(): void {
  generation++;
  try {
    synth?.cancel();
  } catch {
    /* ignore */
  }
}

/**
 * Speak text and resolve when done. Always resolves (never rejects) — on some
 * Android builds `onend` never fires, so a length-based timeout backs it up.
 */
export function say(text: string, opts: { rate?: number; pitch?: number } = {}): Promise<void> {
  const myGen = ++generation;
  if (!synth) return new Promise((r) => setTimeout(r, 400));
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve();
    };
    const rate = opts.rate ?? getState().settings.rate ?? 0.8;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = rate;
    u.pitch = opts.pitch ?? 1.1;
    try {
      const v = pickVoice();
      if (v) u.voice = v;
    } catch {
      /* odd voice objects on some devices — fall back to the default voice */
    }
    u.onend = finish;
    u.onerror = finish;
    const timer = setTimeout(finish, Math.min(12000, 1200 + (text.length * 110) / rate));
    try {
      synth.cancel();
      // Chrome sometimes drops an utterance queued right after cancel().
      setTimeout(() => {
        if (myGen !== generation) return finish();
        synth.speak(u);
      }, 60);
    } catch {
      finish();
    }
  });
}

/** Speak several lines in order; stops early if something else starts speaking. */
export async function sayAll(lines: string[], gapMs = 250): Promise<void> {
  for (const line of lines) {
    const before = generation;
    await say(line);
    if (generation !== before + 1) return; // interrupted
    await new Promise((r) => setTimeout(r, gapMs));
  }
}

/** Is a sequence started at `gen` still current? */
export function speechGeneration(): number {
  return generation;
}
