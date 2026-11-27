/** Text-to-speech via the browser's speechSynthesis (en-US). */
import { getState } from './storage';
import { playRecordings, recordingsFor, stopRecording } from './voice';

const synth: SpeechSynthesis | undefined =
  typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : undefined;

let voices: SpeechSynthesisVoice[] = [];
let generation = 0;
/** Utterances still in flight. Chrome can garbage-collect an utterance mid-speech
 *  (it then goes silent and never fires `onend`) unless something holds on to it. */
const live = new Set<SpeechSynthesisUtterance>();

/** What happened to the last line spoken — shown in the parent area to diagnose "no sound". */
export const lastSpeech: { text: string; voice: string; result: string } = { text: '', voice: '', result: '' };

function loadVoices() {
  if (!synth) return;
  voices = synth.getVoices();
}
if (synth) {
  loadVoices();
  synth.addEventListener?.('voiceschanged', loadVoices);
}

/** Voices load asynchronously in Chrome; wait (briefly) for the first list. */
function voicesReady(): Promise<void> {
  if (!synth || voices.length) return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(resolve, 1000);
    synth.addEventListener?.(
      'voiceschanged',
      () => {
        clearTimeout(t);
        loadVoices();
        resolve();
      },
      { once: true },
    );
  });
}

export function ttsSupported(): boolean {
  return !!synth;
}

export function allVoices(): SpeechSynthesisVoice[] {
  loadVoices();
  return voices;
}

export function englishVoices(): SpeechSynthesisVoice[] {
  return allVoices().filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('en'));
}

export function pickVoice(): SpeechSynthesisVoice | undefined {
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
  stopRecording();
  try {
    if (synth && (synth.speaking || synth.pending) && !onlyPrimer()) synth.cancel();
  } catch {
    /* ignore */
  }
}

/**
 * Wake the speech engine from inside a tap. Android Chrome can silently drop the
 * first line spoken after the page loads unless speaking started from a user
 * gesture; a silent one-word utterance in the Play tap unlocks it.
 */
let primed = false;
let primer: SpeechSynthesisUtterance | null = null;
/** True when nothing but the silent wake-up line is playing (it must not be cancelled). */
const onlyPrimer = () => live.size > 0 && [...live].every((u) => u === primer);
export function primeSpeech(): void {
  if (!synth || primed) return;
  primed = true;
  try {
    const u = (primer = new SpeechSynthesisUtterance('hi'));
    u.lang = 'en-US';
    u.volume = 0;
    u.onend = u.onerror = () => live.delete(u);
    live.add(u);
    synth.speak(u);
  } catch {
    /* ignore */
  }
}

/**
 * Speak text and resolve when done. Always resolves (never rejects) — on some
 * devices `onend` never fires, so a length-based timeout backs it up.
 * If a line has not started after ~1.5 s (the engine dropped it), it is sent once more.
 */
type SayOpts = { rate?: number; pitch?: number; onWord?: (charIndex: number) => void };
export function say(text: string, opts: SayOpts = {}): Promise<void> {
  const myGen = ++generation;
  // a real person's recording of this line, when there is one (src/lib/voice.ts)
  const rec = recordingsFor(text);
  if (rec) {
    try {
      if (synth && (synth.speaking || synth.pending) && !onlyPrimer()) synth.cancel();
    } catch {
      /* ignore */
    }
    lastSpeech.text = text;
    lastSpeech.voice = 'giọng thu sẵn';
    return playRecordings(rec, opts.rate ?? getState().settings.rate ?? 0.8, () => myGen === generation).then((ok) => {
      if (ok || myGen !== generation) {
        lastSpeech.result = '✓ Đã phát bản thu';
        return;
      }
      return speakEngine(text, opts, myGen); // the file would not play: the speech engine says it
    });
  }
  return speakEngine(text, opts, myGen);
}

function speakEngine(text: string, opts: SayOpts, myGen: number): Promise<void> {
  if (!synth) {
    lastSpeech.result = 'Trình duyệt không có giọng đọc';
    return new Promise((r) => setTimeout(r, 400));
  }
  return new Promise((resolve) => {
    const rate = opts.rate ?? getState().settings.rate ?? 0.8;
    let done = false;
    let started = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let current: SpeechSynthesisUtterance | null = null;
    const finish = (result: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearTimeout(watchdog);
      if (current) live.delete(current);
      if (lastSpeech.text === text && result) lastSpeech.result = result;
      resolve();
    };
    const make = () => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = rate;
      u.pitch = opts.pitch ?? 1.1;
      try {
        const v = pickVoice();
        if (v) u.voice = v;
        lastSpeech.voice = v ? `${v.name} (${v.lang})` : 'giọng mặc định của máy';
      } catch {
        lastSpeech.voice = 'giọng mặc định của máy';
      }
      u.onstart = () => {
        started = true;
        if (lastSpeech.text === text) lastSpeech.result = '✓ Đang đọc';
      };
      u.onend = () => u === current && finish(started ? '✓ Đã đọc xong' : '✓ Xong (máy không báo bắt đầu)');
      if (opts.onWord) u.onboundary = (e) => e.name === 'word' && opts.onWord?.(e.charIndex);
      u.onerror = (e) => {
        if (u !== current) return;
        const err = (e as SpeechSynthesisErrorEvent).error || 'không rõ';
        // "interrupted"/"canceled" also happen when we resend; only a real error ends the line.
        if (err === 'interrupted' || err === 'canceled') {
          if (myGen !== generation) finish(`Dừng: ${err}`);
          return;
        }
        finish(`Lỗi: ${err}`);
      };
      return u;
    };
    const send = () => {
      if (myGen !== generation) return finish('bị thay bằng câu khác');
      if (current) live.delete(current);
      current = make();
      live.add(current);
      try {
        synth.resume(); // Chrome can get stuck "paused" (e.g. after the tab was in the background)
      } catch {
        /* ignore */
      }
      try {
        synth.speak(current);
      } catch {
        finish('Lỗi khi gọi speak()');
      }
    };

    const start = () => {
      if (myGen !== generation) return finish('bị thay bằng câu khác');
      lastSpeech.text = text;
      lastSpeech.result = 'Đã gửi cho trình duyệt, chưa thấy bắt đầu đọc';
      timer = setTimeout(() => finish(''), Math.min(14000, 3000 + (text.length * 110) / rate));
      send();
      // Dropped by the engine (common for the first line on Android): send it once more.
      watchdog = setTimeout(() => {
        if (done || started || synth.speaking || myGen !== generation) return;
        lastSpeech.result = 'Câu đầu bị bỏ qua, đang đọc lại';
        try {
          synth.cancel();
        } catch {
          /* ignore */
        }
        setTimeout(() => !done && send(), 150);
      }, 1500);
    };

    // Cancel only if something is actually playing: cancel() followed at once by
    // speak() makes Chrome drop the new line, so leave a short gap in that case.
    const busy = (synth.speaking || synth.pending) && !onlyPrimer();
    if (busy) {
      try {
        synth.cancel();
      } catch {
        /* ignore */
      }
    }
    void voicesReady().then(() => (busy ? setTimeout(start, 120) : start()));
  });
}
