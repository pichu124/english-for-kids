/**
 * Progress lives only in this browser (localStorage). Every access is wrapped in
 * try/catch: in a private window or with storage blocked the app still runs,
 * it just forgets progress when closed.
 */

const KEY = 'efk.v1';

export type WordStatus = {
  /** Child said it successfully at least once (recognizer or parent). */
  said: boolean;
  /** How the last success was judged. */
  by?: 'auto' | 'parent';
  tries: number;
  /** Picked the right picture first time in a tap game. */
  known?: boolean;
  /** Last thing the recognizer heard (text only — never audio). */
  heard?: string;
  last?: string; // ISO date
};

/**
 * Recognizer configurations, most lenient first:
 *  full   = live partial results + 5 alternatives
 *  alts   = final result only + 5 alternatives
 *  simple = final result only + 1 alternative
 * Some Android speech services hear the voice but answer "nomatch" in the richer modes.
 */
export const SR_MODES = ['full', 'alts', 'simple'] as const;
export type SrMode = (typeof SR_MODES)[number];
export const SR_MODE_LABEL: Record<SrMode, string> = { full: 'đầy đủ', alts: 'không kết quả tạm, 5 phương án', simple: 'đơn giản' };

export type PlacedBlock = { id: string; type: string; x: number; y: number };

export type DayLog = {
  seconds: number;
  lessons: number;
  /** Speaking attempts and how they were judged. */
  auto: number;
  parent: number;
  miss: number;
  noVoice: number;
};

export type State = {
  childName: string;
  settings: {
    /** 0 = no limit */
    dailyLimitMin: number;
    rate: number;
    voiceURI?: string;
    /** Speech-recognizer configuration that works on this device (see SR_MODES). */
    srMode?: SrMode;
    /** Level shown on the home map (L0…L4). */
    level?: string;
  };
  topics: Record<string, { completed: number; lastDone?: string }>;
  words: Record<string, WordStatus>;
  blocks: {
    /** Earned blocks not yet placed, by type. */
    inventory: Record<string, number>;
    placed: PlacedBlock[];
    totalEarned: number;
  };
  days: Record<string, DayLog>;
  /** Extra minutes a parent granted today, keyed by date. */
  bonus: Record<string, number>;
  /** Spaced review: per word key, its box (1–5) and next due date. */
  review: Record<string, { box: number; due: string }>;
  /** Bix's clothes: item id per slot (hat, neck, hand, color). */
  outfit?: Record<string, string>;
  /** How many wardrobe items the child has already seen (for the "new!" glow). */
  outfitSeen?: number;
  /** Bix's memory: when each unit's chat question was last asked, the child's answers, levels celebrated. */
  chats?: Record<string, string>;
  chatAnswers?: Record<string, 'yes' | 'no'>;
  celebrated?: string[];
  /** Adaptive difficulty: first-try results of recent picture rounds. */
  adapt?: { recent: boolean[] };
  /** Stories read to the end, by story id. */
  storiesRead?: Record<string, number>;
  /** Last day the child looked at the garden (for the "new flower" glow). */
  gardenSeen?: string;
};

export function defaultState(): State {
  return {
    childName: '',
    settings: { dailyLimitMin: 0, rate: 0.8 },
    topics: {},
    words: {},
    blocks: { inventory: {}, placed: [], totalEarned: 0 },
    days: {},
    bonus: {},
    review: {},
  };
}

let state: State = load();

function load(): State {
  const base = defaultState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<State>;
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
      blocks: { ...base.blocks, ...(parsed.blocks ?? {}) },
      review: parsed.review ?? {},
    };
  } catch {
    return base;
  }
}

export function getState(): State {
  return state;
}

export function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked — keep going in memory */
  }
}

export function update(fn: (s: State) => void): void {
  fn(state);
  save();
}

export function resetProgress(keepSettings = true): void {
  const fresh = defaultState();
  if (keepSettings) {
    fresh.childName = state.childName;
    fresh.settings = state.settings;
  }
  state = fresh;
  save();
}

export function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function dayLog(date = today()): DayLog {
  if (!state.days[date]) {
    state.days[date] = { seconds: 0, lessons: 0, auto: 0, parent: 0, miss: 0, noVoice: 0 };
  }
  return state.days[date];
}

export const wordKey = (topicId: string, wordId: string) => `${topicId}/${wordId}`;

/** Ask the browser not to evict our storage (best effort). */
export function requestPersistence(): void {
  try {
    navigator.storage?.persist?.().catch(() => {});
  } catch {
    /* ignore */
  }
}
