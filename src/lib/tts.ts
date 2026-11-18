/** Text-to-speech via the browser's speechSynthesis (en-US). */
import { getState } from './storage';

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
  try {
    if (synth && (synth.speaking || synth.pending)) synth.cancel();
  } catch {
    /* ignore */
  }
}

/**
 * Speak text and resolve when done. Always resolves (never rejects) — on some
 * devices `onend` never fires, so a length-based timeout backs it up.
 */
export function say(text: string, opts: { rate?: number; pitch?: number; onWord?: (charIndex: number) => void } = {}): Promise<void> {
  const myGen = ++generation;
  if (!synth) {
    lastSpeech.result = 'Trình duyệt không có giọng đọc';
    return new Promise((r) => setTimeout(r, 400));
  }
  return new Promise((resolve) => {
    const rate = opts.rate ?? getState().settings.rate ?? 0.8;
    const u = new SpeechSynthesisUtterance(text);
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (result: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      live.delete(u);
      if (lastSpeech.text === text && result) lastSpeech.result = result;
      resolve();
    };
    u.lang = 'en-US';
    u.rate = rate;
    u.pitch = opts.pitch ?? 1.1;
    u.onstart = () => {
      if (lastSpeech.text === text) lastSpeech.result = '✓ Đang đọc';
    };
    u.onend = () => finish('✓ Đã đọc xong');
    if (opts.onWord) u.onboundary = (e) => e.name === 'word' && opts.onWord?.(e.charIndex);
    u.onerror = (e) => finish(`Lỗi: ${(e as SpeechSynthesisErrorEvent).error || 'không rõ'}`);

    const start = () => {
      if (myGen !== generation) return finish('bị thay bằng câu khác');
      try {
        const v = pickVoice();
        if (v) u.voice = v;
        lastSpeech.voice = v ? `${v.name} (${v.lang})` : 'giọng mặc định của máy';
      } catch {
        lastSpeech.voice = 'giọng mặc định của máy';
      }
      lastSpeech.text = text;
      lastSpeech.result = 'Đã gửi cho trình duyệt, chưa thấy bắt đầu đọc';
      live.add(u);
      timer = setTimeout(() => finish(''), Math.min(12000, 1500 + (text.length * 110) / rate));
      try {
        synth.resume(); // Chrome can get stuck "paused" (e.g. after the tab was in the background)
      } catch {
        /* ignore */
      }
      try {
        synth.speak(u);
      } catch {
        finish('Lỗi khi gọi speak()');
      }
    };

    // Cancel only if something is actually playing: cancel() followed at once by
    // speak() makes Chrome drop the new line, so leave a short gap in that case.
    const busy = synth.speaking || synth.pending;
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
