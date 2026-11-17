/**
 * One-shot speech recognition (Chrome: webkitSpeechRecognition).
 * Audio goes only to the browser's own recognizer; we keep nothing but the text.
 */
import { stopSpeaking } from './tts';

type SR = {
  lang: string;
  maxAlternatives: number;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
};
type SREvent = { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> };

function ctor(): (new () => SR) | undefined {
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}

export function recognitionSupported(): boolean {
  return typeof window !== 'undefined' && !!ctor();
}

export type ListenOutcome =
  | { status: 'heard'; alternatives: string[]; stoppedEarly: boolean }
  | { status: 'nothing' } // no speech / nothing understood
  | { status: 'denied' } // mic permission refused
  | { status: 'offline' } // recognizer needs network
  | { status: 'unsupported' }
  | { status: 'error'; error: string };

let active: SR | null = null;

export function cancelListening(): void {
  try {
    active?.abort();
  } catch {
    /* ignore */
  }
  active = null;
}

/**
 * Listen once. `onTranscript` sees every interim and final transcript; return
 * true from it to stop early (e.g. as soon as the target word is heard).
 */
export function listenOnce(opts: {
  timeoutMs?: number;
  onTranscript?: (alternatives: string[]) => boolean;
  onSpeechStart?: () => void;
}): Promise<ListenOutcome> {
  const C = ctor();
  if (!C) return Promise.resolve({ status: 'unsupported' });
  cancelListening();
  stopSpeaking();

  return new Promise((resolve) => {
    const rec = new C();
    active = rec;
    rec.lang = 'en-US';
    rec.maxAlternatives = 5;
    rec.interimResults = true;
    rec.continuous = false;

    const heard = new Set<string>();
    let errorCode = '';
    let settled = false;
    let stoppedEarly = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(hardStop);
      clearTimeout(softStop);
      if (active === rec) active = null;
      if (heard.size) return resolve({ status: 'heard', alternatives: [...heard], stoppedEarly });
      if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') return resolve({ status: 'denied' });
      if (errorCode === 'network') return resolve({ status: 'offline' });
      if (!errorCode || errorCode === 'no-speech' || errorCode === 'aborted' || errorCode === 'no-match') {
        return resolve({ status: 'nothing' });
      }
      resolve({ status: 'error', error: errorCode });
    };

    rec.onresult = (e) => {
      const batch: string[] = [];
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        for (let j = 0; j < r.length; j++) {
          const t = r[j]?.transcript?.trim();
          if (t) {
            heard.add(t);
            batch.push(t);
          }
        }
      }
      if (batch.length && opts.onTranscript?.(batch)) {
        stoppedEarly = true;
        try {
          rec.stop();
        } catch {
          finish();
        }
      }
    };
    rec.onerror = (e) => {
      errorCode = e.error || 'error';
    };
    rec.onend = finish;
    rec.onspeechstart = () => opts.onSpeechStart?.();

    const timeout = opts.timeoutMs ?? 6000;
    const softStop = setTimeout(() => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }, timeout);
    // If the engine never fires onend, give up anyway.
    const hardStop = setTimeout(() => {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
      finish();
    }, timeout + 2500);

    try {
      rec.start();
    } catch (err) {
      errorCode = String((err as Error)?.name || 'error');
      finish();
    }
  });
}
