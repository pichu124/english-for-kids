/**
 * One-shot speech recognition (Chrome: webkitSpeechRecognition).
 * Audio goes only to the browser's own recognizer; we keep nothing but the text.
 */
import { sfx } from './sfx';
import { getState, SR_MODE_LABEL, type SrMode } from './storage';
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
  onerror: ((e: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onsoundstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onnomatch: (() => void) | null;
};
type SREvent = { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> };

function ctor(): (new () => SR) | undefined {
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}

export function recognitionSupported(): boolean {
  return typeof window !== 'undefined' && !!ctor();
}

/** What happened during one listen, for the parent-area diagnosis. */
export type ListenTrace = {
  /** e.g. ["start 80ms", "audiostart 210ms", "error:no-speech 5300ms", "end 5310ms"] */
  events: string[];
  /** Raw error code from the browser ('' if none). */
  error: string;
  /** Did the recognizer actually start capturing audio? */
  gotAudio: boolean;
  ms: number;
};

export type ListenOutcome = (
  | { status: 'heard'; alternatives: string[]; stoppedEarly: boolean }
  | { status: 'nothing' } // listened, but no speech / nothing understood
  | { status: 'service' } // ended without ever capturing audio: the device's speech service is not working
  | { status: 'denied' } // mic permission refused (site or Android app permission)
  | { status: 'nomic' } // no microphone, or another app is using it
  | { status: 'offline' } // recognizer needs network
  | { status: 'unsupported' }
  | { status: 'error'; error: string }
) & { trace: ListenTrace };

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
  /** Called with every recognizer event (for live diagnostics). */
  onEvent?: (line: string) => void;
  /** Override the saved recognizer mode (the mic test tries both). */
  mode?: SrMode;
}): Promise<ListenOutcome> {
  const C = ctor();
  if (!C) return Promise.resolve({ status: 'unsupported', trace: { events: [], error: '', gotAudio: false, ms: 0 } });
  cancelListening();
  stopSpeaking();
  sfx.pause();
  const mode = opts.mode ?? getState().settings.srMode ?? 'full';

  return new Promise((resolve) => {
    const rec = new C();
    active = rec;
    rec.lang = 'en-US';
    rec.maxAlternatives = mode === 'simple' ? 1 : 5;
    rec.interimResults = mode === 'full';
    rec.continuous = false;

    const heard = new Set<string>();
    let errorCode = '';
    let settled = false;
    let stoppedEarly = false;
    let gotAudio = false;
    const t0 = Date.now();
    const events: string[] = [];
    const log = (name: string) => {
      const line = `${name} ${Date.now() - t0}ms`;
      events.push(line);
      opts.onEvent?.(line);
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(hardStop);
      clearTimeout(softStop);
      if (active === rec) active = null;
      const trace: ListenTrace = { events, error: errorCode, gotAudio, ms: Date.now() - t0 };
      if (heard.size) return resolve({ status: 'heard', alternatives: [...heard], stoppedEarly, trace });
      if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') return resolve({ status: 'denied', trace });
      if (errorCode === 'network') return resolve({ status: 'offline', trace });
      if (errorCode === 'audio-capture') return resolve({ status: 'nomic', trace });
      if (!errorCode || errorCode === 'no-speech' || errorCode === 'aborted' || errorCode === 'no-match') {
        // Never captured any audio: the speech service did not really run.
        // Not the child's fault, so the caller must not answer "Try again!".
        return resolve({ status: gotAudio ? 'nothing' : 'service', trace });
      }
      resolve({ status: 'error', error: errorCode, trace });
    };

    rec.onresult = (e) => {
      gotAudio = true;
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
      log(`error:${errorCode}${e.message ? ` (${e.message})` : ''}`);
    };
    rec.onend = () => {
      log('end');
      finish();
    };
    rec.onstart = () => log('start');
    rec.onaudiostart = () => {
      gotAudio = true;
      log('audiostart');
    };
    rec.onsoundstart = () => {
      gotAudio = true;
      log('soundstart');
    };
    rec.onspeechstart = () => {
      gotAudio = true;
      log('speechstart');
      opts.onSpeechStart?.();
    };
    rec.onspeechend = () => log('speechend');
    rec.onnomatch = () => log('nomatch');

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
      log(`start() gọi (chế độ ${SR_MODE_LABEL[mode]})`);
    } catch (err) {
      errorCode = String((err as Error)?.name || 'error');
      log(`start() lỗi: ${errorCode}`);
      finish();
    }
  });
}
