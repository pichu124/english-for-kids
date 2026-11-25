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
  /** Spelled it with letter tiles without a slip. */
  spelled?: boolean;
  /** Day it first became a sticker (said or known) — for the weekly report. */
  firstAt?: string;
  /** Rounds that needed more than one try, and the last such day (weekly report: words to practise). */
  slips?: number;
  slipAt?: string;
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
    /** Music: 'off', 'chant' (default: only during chants) or 'all' (also soft background music). */
    music?: 'off' | 'chant' | 'all';
  };
  topics: Record<string, { completed: number; lastDone?: string; /** times part 2 (Read & Write) was finished */ readDone?: number }>;
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
  /** Today's guided plan, and how many days it was finished. */
  today?: { day: string; steps: { kind: 'review' | 'lesson' | 'fun'; id?: string; done?: boolean }[]; finished?: boolean };
  todayDays?: number;
  /** Letters found right first time in the letter game (⭐ on the ABC board). */
  letters?: Record<string, boolean>;
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

// ---------------------------------------------------------------- child profiles
// Up to 4 children per device. The first child keeps the original key, so
// progress from before profiles existed is kept as-is.
const INDEX_KEY = 'efk.profiles';
export const MAX_PROFILES = 4;
type ProfileIndex = { active: string; ids: string[] };
const keyFor = (id: string) => (id === 'p1' ? KEY : `${KEY}.${id}`);

function readIndex(): ProfileIndex {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    const p = raw ? (JSON.parse(raw) as ProfileIndex) : null;
    if (p && Array.isArray(p.ids) && p.ids.length && p.ids.includes(p.active)) return p;
  } catch {
    /* fall through */
  }
  return { active: 'p1', ids: ['p1'] };
}
function writeIndex(): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    /* keep in memory */
  }
}

let index: ProfileIndex = readIndex();
let state: State = load();

export type Profile = { id: string; name: string; active: boolean };
/** Each child gets an animal, so pre-readers can find their own button. */
export const PROFILE_ANIMALS = ['🦊', '🐼', '🐯', '🐸', '🐨', '🦁'];
export const profileAnimal = (id: string) => PROFILE_ANIMALS[(Number(id.slice(1)) - 1) % PROFILE_ANIMALS.length];

export function profiles(): Profile[] {
  return index.ids.map((id) => {
    if (id === index.active) return { id, name: state.childName, active: true };
    let name = '';
    try {
      name = (JSON.parse(localStorage.getItem(keyFor(id)) ?? '{}') as Partial<State>).childName ?? '';
    } catch {
      /* unreadable — show as unnamed */
    }
    return { id, name, active: false };
  });
}

export function switchProfile(id: string): void {
  if (!index.ids.includes(id) || id === index.active) return;
  save();
  index.active = id;
  writeIndex();
  state = load();
}

/** Add a child; device settings (voice, microphone mode, level, time limit) are copied from the current one. */
export function addProfile(name: string): string | null {
  if (index.ids.length >= MAX_PROFILES) return null;
  let n = 2;
  while (index.ids.includes(`p${n}`)) n++;
  const id = `p${n}`;
  const fresh = defaultState();
  fresh.childName = name.trim();
  fresh.settings = { ...state.settings };
  try {
    localStorage.setItem(keyFor(id), JSON.stringify(fresh));
  } catch {
    return null;
  }
  index.ids.push(id);
  writeIndex();
  return id;
}

export function removeProfile(id: string): void {
  if (index.ids.length <= 1 || !index.ids.includes(id)) return;
  if (id === index.active) switchProfile(index.ids.find((x) => x !== id)!);
  index.ids = index.ids.filter((x) => x !== id);
  writeIndex();
  try {
    localStorage.removeItem(keyFor(id));
  } catch {
    /* ignore */
  }
}

function load(): State {
  const base = defaultState();
  try {
    const raw = localStorage.getItem(keyFor(index.active));
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
    localStorage.setItem(keyFor(index.active), JSON.stringify(state));
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

// ---------------------------------------------------------------- backup & restore
// Everything stays on this device; a backup is a small JSON file the parent keeps
// (Files, Drive, Zalo…) and can load back on this or another device.

const BACKUP_KEY = 'efk.backup';
export const BACKUP_APP = 'bix-english';

export type Backup = {
  app: typeof BACKUP_APP;
  version: 1;
  exportedAt: string;
  index: { active: string; ids: string[] };
  profiles: Record<string, State>;
};

export function exportBackup(): Backup {
  save();
  const profiles: Record<string, State> = {};
  for (const id of index.ids) {
    if (id === index.active) profiles[id] = state;
    else {
      try {
        profiles[id] = { ...defaultState(), ...(JSON.parse(localStorage.getItem(keyFor(id)) ?? '{}') as Partial<State>) };
      } catch {
        profiles[id] = defaultState();
      }
    }
  }
  return { app: BACKUP_APP, version: 1, exportedAt: new Date().toISOString(), index: { ...index, ids: [...index.ids] }, profiles };
}

/** Check a parsed backup file. Returns a Vietnamese reason when it cannot be used. */
export function checkBackup(b: unknown): string | null {
  const x = b as Partial<Backup> | null;
  if (!x || typeof x !== 'object' || x.app !== BACKUP_APP) return 'Đây không phải file sao lưu của Bix English.';
  if (x.version !== 1) return 'File sao lưu này từ phiên bản khác, chưa đọc được.';
  const ids = x.index?.ids;
  if (!Array.isArray(ids) || !ids.length || ids.length > MAX_PROFILES || ids.some((id) => typeof id !== 'string' || !/^p\d+$/.test(id))) return 'File sao lưu bị hỏng (danh sách bé).';
  if (!x.index || !ids.includes(x.index.active)) return 'File sao lưu bị hỏng (bé đang dùng).';
  for (const id of ids) {
    const p = x.profiles?.[id] as Partial<State> | undefined;
    if (!p || typeof p !== 'object' || typeof p.topics !== 'object' || typeof p.words !== 'object' || typeof p.settings !== 'object') return `File sao lưu bị hỏng (dữ liệu của bé ${id}).`;
  }
  return null;
}

/** Replace everything on this device with the backup (after checkBackup passed). */
export function restoreBackup(b: Backup): void {
  for (const id of index.ids) {
    try {
      if (!b.index.ids.includes(id)) localStorage.removeItem(keyFor(id));
    } catch {
      /* ignore */
    }
  }
  for (const id of b.index.ids) {
    try {
      localStorage.setItem(keyFor(id), JSON.stringify(b.profiles[id]));
    } catch {
      /* storage full — the reload below shows what was written */
    }
  }
  index = { active: b.index.active, ids: [...b.index.ids] };
  writeIndex();
  state = load();
}

export function lastBackup(): string | null {
  try {
    return localStorage.getItem(BACKUP_KEY);
  } catch {
    return null;
  }
}
export function markBackedUp(): void {
  try {
    localStorage.setItem(BACKUP_KEY, new Date().toISOString());
  } catch {
    /* ignore */
  }
}
/** Remind after a week without a backup, once there is progress worth keeping. */
export function backupDue(): boolean {
  const any = Object.keys(state.topics).length > 0;
  const last = lastBackup();
  return any && (!last || Date.now() - Date.parse(last) > 7 * 86400000);
}
