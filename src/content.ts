/**
 * Lesson content (format v2, see docs/KE-HOACH-NOI-DUNG-CAMBRIDGE.md §5).
 *
 *   content/words/*.json  word bank: each word defined once, reused by many units
 *   content/units/*.json  units: one topic at one level, listing word ids
 *
 * Every file is picked up at build time — add content by adding files, no code
 * changes. Unit and word ids never change: the child's progress is keyed on them.
 */
import { BLOCK_STYLES, type BlockDef, type BlockStyle } from './art/blocks';
import { SCENES } from './art/positions';
import { BODY_PARTS, FAMILY, ICONS } from './art/drawings';
import { TUNE_IDS } from './lib/tunes';
import { fixEmoji } from './lib/emoji';

// ---------------------------------------------------------------- levels

export type LevelId = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

export type Level = {
  id: LevelId;
  name: string;
  /** Vietnamese label for the parent area. */
  nameVi: string;
  ages: string;
  framework: string;
  /** Matching age group code in casa-mamnon ('' = none). */
  casaLuaTuoi: string;
  /** Show the written word on cards? (pre-readers: no) */
  showText: boolean;
  /** Pictures to choose from in the tap game. */
  choices: number;
  /** Rounds of the tap game. */
  playRounds: number;
  /** Reading steps added after a unit's own steps (Starters: read the word, spell it). */
  reading?: StepType[];
};

export const LEVELS: Level[] = [
  { id: 'L0', name: 'Little Bix', nameVi: 'Bậc 0 · Little Bix (3–4 tuổi)', ages: '3–4', framework: 'Cambridge Early Years', casaLuaTuoi: '3-4', showText: false, choices: 3, playRounds: 4 },
  { id: 'L1', name: 'Bix Explorer', nameVi: 'Bậc 1 · Bix Explorer (4–5 tuổi)', ages: '4–5', framework: 'Cambridge Early Years', casaLuaTuoi: '4-5', showText: true, choices: 3, playRounds: 5 },
  { id: 'L2', name: 'Starters', nameVi: 'Bậc 2 · Starters (5–7 tuổi)', ages: '5–7', framework: 'Pre A1 Starters · Primary ESL Stage 1–2', casaLuaTuoi: '5-6', showText: true, choices: 4, playRounds: 6, reading: ['read', 'spell', 'sentence'] },
  { id: 'L3', name: 'Movers', nameVi: 'Bậc 3 · Movers (7–8 tuổi)', ages: '7–8', framework: 'A1 Movers · Primary ESL Stage 3–4', casaLuaTuoi: '', showText: true, choices: 4, playRounds: 6, reading: ['gap', 'write', 'sentence', 'text'] },
  { id: 'L4', name: 'Flyers', nameVi: 'Bậc 4 · Flyers (9–10 tuổi)', ages: '9–10', framework: 'A2 Flyers · Primary ESL Stage 5–6', casaLuaTuoi: '', showText: true, choices: 4, playRounds: 6, reading: ['gap', 'define', 'sentence', 'text'] },
];

export const levelById = (id: string): Level | undefined => LEVELS.find((l) => l.id === id);
export const DEFAULT_LEVEL: LevelId = 'L2';

// ---------------------------------------------------------------- types

export type Word = {
  id: string;
  /** What the child should say (and what is shown). */
  text: string;
  /** Picture: an emoji, or a color swatch (for color words). */
  image: { emoji?: string; color?: string; text?: string; scene?: string; /** analogue clock "3:00", "7:30" */ clock?: string; /** a child with this part circled */ body?: string; /** a small drawing (stairs, towel…) */ icon?: string; /** family tree with this person circled */ family?: string };
  /** Example sentence the character says, e.g. "This is a dog." (unit may override) */
  sentence: string;
  /** Flyers: a short definition ("You can see old things here.") — read it, then type the word. */
  def?: string;
  /** Prompt in the speaking step. Default: "Can you say {text}?" */
  ask?: string;
  /** Other transcriptions that should count, e.g. "mom" for "mum". */
  accept?: string[];
  /** Prompt for the tap game, overriding the unit's playPrompt. */
  play?: string;
  /** Little animation that acts out the word's meaning (default from its topic). */
  anim?: Anim;
};

/** Animations that act out a word (Endless-Alphabet style), see styles/lesson.css. */
export const ANIMS = ['bounce', 'wiggle', 'hop', 'fly', 'drive', 'swim', 'fall', 'spin', 'pulse', 'sway', 'shine', 'wave'] as const;
export type Anim = (typeof ANIMS)[number];
const TOPIC_ANIM: Record<string, Anim> = {
  animals: 'wiggle', animals2: 'hop', zoo: 'wiggle', farm: 'wiggle', transport: 'drive', weather: 'fall', world: 'sway',
  food: 'bounce', food2: 'bounce', fruit: 'bounce', meals: 'bounce', toys: 'spin', toys2: 'spin', actions: 'bounce',
  body: 'pulse', clothes: 'sway', clothes2: 'sway', colors: 'spin', colours2: 'spin', numbers: 'pulse', numbers2: 'pulse',
  shapes: 'spin', feelings: 'pulse', family: 'wave', people: 'wave', school: 'wiggle', home: 'pulse', home2: 'pulse',
  places: 'pulse', hello: 'wave', positions: 'pulse', adjectives: 'pulse', sports: 'bounce', rooms: 'pulse', food3: 'bounce',
  health: 'wiggle', town: 'pulse', jobs: 'wave', time: 'pulse', days: 'pulse', nature: 'sway', sea: 'swim', compare: 'bounce', food4: 'bounce', feelings2: 'pulse', past: 'bounce',
  hobbies: 'bounce', animals3: 'wiggle', travel: 'drive', directions: 'pulse', superlatives: 'bounce', adverbs: 'pulse', past2: 'bounce', clothes3: 'sway', fun: 'spin', kitchen: 'pulse',
  body2: 'pulse', house: 'pulse', routine: 'bounce', water: 'sway', past3: 'bounce',
  family2: 'wave', town2: 'pulse', offers: 'bounce', numbers3: 'pulse', where2: 'bounce', move: 'bounce',
  seasons: 'sway', subjects: 'wiggle', space: 'fly', jobs3: 'bounce', places3: 'pulse', sports3: 'sway', transport3: 'drive', world2: 'pulse', ever: 'bounce',
  months: 'pulse', materials: 'shine', holiday: 'bounce', instruments: 'wiggle', city: 'pulse', weather2: 'sway', time2: 'pulse', shopping: 'bounce',
  was: 'pulse', weather3: 'sway', sports4: 'bounce', country: 'sway', future: 'fly', feelings3: 'pulse', workers: 'bounce', tales: 'wave', wild: 'wave', doctor: 'pulse',
};
/** The animation to play for a word. */
export const animFor = (w: Word & { topic?: string }): Anim => w.anim ?? TOPIC_ANIM[(w as { topic?: string }).topic ?? ''] ?? 'bounce';

export type StepType = 'listen' | 'say' | 'tap-picture' | 'do-it' | 'chant' | 'read' | 'spell' | 'sentence' | 'write' | 'text' | 'gap' | 'define';
export const STEP_TYPES: StepType[] = ['listen', 'say', 'tap-picture', 'do-it', 'chant', 'read', 'spell', 'sentence', 'write', 'text', 'gap', 'define'];
/** Part 2 of a unit ("Read & Write"); everything else is part 1 ("Listen & Say"). */
export const READING_STEPS: StepType[] = ['read', 'spell', 'sentence', 'write', 'text', 'gap', 'define'];

/** A word whose example sentence can have it blanked out: "Mum is in the ____." (Movers gap fill). */
export const gappable = (w: Word) => w.sentence.split(/\s+/).length >= 3 && new RegExp(`\\b${w.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(w.sentence);
export const gapCount = (words: Word[]) => (new Set(words.map((w) => w.text)).size >= 3 ? Math.min(3, words.filter(gappable).length) : 0);

/** A gap-fill sentence written by hand: "___" is the gap; options = the two wrong words. */
export type GapItem = { s: string; answer: string; options: string[] };
/** A short text to read (Movers): a few sentences and questions about it. */
export type ReadingText = { title: string; lines: string[]; questions: { q: string; options: string[]; answer: number }[] };
/** Words to type on the letter keyboard (Movers writing): one word, letters only, 3–8 letters. */
export const writable = (w: Word) => /^[a-z]+$/i.test(w.text) && w.text.length >= 3 && w.text.length <= 8;
/** Flyers "read the definition, write the word": one word, letters only, up to 12 letters. */
export const definable = (w: Word) => !!w.def && /^[a-z]+$/i.test(w.text) && w.text.length >= 3 && w.text.length <= 12;

/** First sentence of a word's example, without the final punctuation: "This is a dog". */
export const firstSentence = (w: Word) => w.sentence.split(/(?<=[.!?])\s+/)[0].trim().replace(/[.!?]+$/, '');
/** The punctuation that ends the first sentence ("?" for "How are you?"). */
export const sentenceEnd = (w: Word) => (w.sentence.split(/(?<=[.!?])\s+/)[0].trim().match(/[.!?]$/)?.[0] ?? '.');
/** Sentences to build from word tiles: 3–6 words that contain the word itself. */
export const buildable = (w: Word) => {
  const fs = firstSentence(w);
  const n = fs.split(/\s+/).length;
  return n >= 3 && n <= 6 && fs.toLowerCase().includes(w.text.toLowerCase()) && !/["“”]/.test(fs);
};
/** "This is a/an <word>" — the pattern the yes/no reading question swaps. */
export const yesNoAble = (w: Word) => new RegExp(`^this is an? ${w.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(firstSentence(w));
/** Rounds of the sentence step: up to 2 "build", plus 1 yes/no when two words fit the pattern. */
export const sentenceCount = (words: Word[]) => Math.min(2, words.filter(buildable).length) + (words.filter(yesNoAble).length >= 2 ? 1 : 0);

/** Steps of part 1 ("Listen & Say") or part 2 ("Read & Write") of a unit. */
export const partSteps = (t: Topic, part: 1 | 2) => t.steps.filter((st) => READING_STEPS.includes(st) === (part === 2));
export const hasPart2 = (t: Topic) => partSteps(t, 2).length > 0;

/** Words a child can spell with letter tiles: one word, letters only, not too long. */
export const spellable = (w: Word, maxLen = 6) => /^[a-z]+$/i.test(w.text) && w.text.length >= 2 && w.text.length <= maxLen;
/** Steps a unit gets when it does not list its own. */
export const DEFAULT_STEPS: StepType[] = ['listen', 'say', 'tap-picture'];

/** A "do it" command (Total Physical Response): the child acts it out, then taps ✓. */
export type Action = { say: string; emoji: string };

/** A short rhythmic chant: Bix says it on a beat, then the child joins in. */
export type ChantLine = { text: string; emoji?: string };
export type Chant = { title: string; lines: ChantLine[]; tune?: string };

export type CasaLink = { luaTuoi?: string; chuDe?: string; monHoc?: string };

/** A playable unit (called Topic in the screens, for historical reasons). */
export type Topic = {
  id: string;
  level: LevelId;
  topic: string;
  order: number;
  title: string;
  /** Vietnamese name, shown only in the parent area. */
  titleVi: string;
  icon: string;
  /** Grass color of the unit's island on the home map. */
  color: string;
  intro: string;
  /** Prompt for the tap game, with {word} as placeholder. */
  playPrompt: string;
  block: { name: string; style: BlockStyle; color: string };
  steps: StepType[];
  /** Rounds of the tap game, if different from the level's default (review sessions). */
  playRounds?: number;
  actions: Action[];
  chant?: Chant;
  casa?: CasaLink;
  /** Movers: a short text to read in part 2 (the "text" step). */
  text?: ReadingText;
  /** Hand-written gap-fill sentences ("___" = the gap), each with one sensible answer. */
  gaps?: GapItem[];
  /** "Play together" card for parents: what to do at home (Vietnamese) and the English line to say. */
  parentTip?: { vi: string; say: string };
  /** A yes/no question Bix asks the child about the topic, with its two replies. */
  chat?: { ask: string; yes: string; no: string };
  words: Word[];
};

type BankFile = { topic?: string; words: Word[] };
type UnitWordRef = string | ({ id: string } & Partial<Pick<Word, 'sentence' | 'ask' | 'play' | 'accept' | 'image' | 'def'>>);
type UnitFile = Omit<Topic, 'words' | 'steps' | 'actions' | 'chant' | 'titleVi' | 'intro' | 'order'> & {
  /** false = no reading/spelling steps for this unit (e.g. phrases like "How are you?"). */
  reading?: boolean;
  /** true = this unit's sentences work as gap fill (each fits only one of its words). */
  gap?: boolean;
  actions?: Action[];
  chant?: { title: string; lines: (string | ChantLine)[]; tune?: string };
  order?: number;
  titleVi?: string;
  intro?: string;
  steps?: StepType[];
  words: UnitWordRef[];
};

// ---------------------------------------------------------------- loading

const bankFiles = import.meta.glob<{ default: BankFile }>('../content/words/*.json', { eager: true });
const unitFiles = import.meta.glob<{ default: UnitFile }>('../content/units/*.json', { eager: true });

/** Everything wrong with the content. Must be empty — a unit test checks it. */
export const contentProblems: string[] = [];
const problem = (where: string, what: string) => {
  contentProblems.push(`${where}: ${what}`);
  console.warn(`[content] ${where}: ${what}`);
};

const bank = new Map<string, Word & { topic?: string }>();
for (const [file, mod] of Object.entries(bankFiles)) {
  const words = mod.default?.words;
  if (!Array.isArray(words)) {
    problem(file, 'thiếu mảng "words"');
    continue;
  }
  for (const w of words) {
    if (!w || typeof w.id !== 'string' || typeof w.text !== 'string' || typeof w.sentence !== 'string') {
      problem(file, `từ sai cấu trúc: ${JSON.stringify(w)}`);
      continue;
    }
    if (!w.image || (typeof w.image.emoji !== 'string' && typeof w.image.color !== 'string' && typeof w.image.text !== 'string' && typeof w.image.scene !== 'string' && typeof w.image.clock !== 'string' && typeof w.image.body !== 'string' && typeof w.image.icon !== 'string' && typeof w.image.family !== 'string')) {
      problem(file, `từ "${w.id}" cần image.emoji, image.color, image.text hoặc image.scene`);
      continue;
    }
    if (w.image.body && !(BODY_PARTS as readonly string[]).includes(w.image.body)) {
      problem(file, `từ "${w.id}": image.body phải là một trong ${BODY_PARTS.join(', ')}`);
      continue;
    }
    if (w.image.family && !(FAMILY as readonly string[]).includes(w.image.family)) {
      problem(file, `từ "${w.id}": image.family phải là một trong ${FAMILY.join(', ')}`);
      continue;
    }
    if (w.image.icon && !(ICONS as readonly string[]).includes(w.image.icon)) {
      problem(file, `từ "${w.id}": image.icon phải là một trong ${ICONS.join(', ')}`);
      continue;
    }
    if (w.image.clock && !/^([1-9]|1[0-2]):(00|15|30|45)$/.test(w.image.clock)) {
      problem(file, `từ "${w.id}": image.clock dạng "3:00", "7:30" (giờ 1–12, phút 00/15/30/45)`);
      continue;
    }
    if (w.image.scene && !(SCENES as readonly string[]).includes(w.image.scene)) {
      problem(file, `từ "${w.id}": image.scene phải là một trong ${SCENES.join(', ')}`);
      continue;
    }
    if (w.anim && !(ANIMS as readonly string[]).includes(w.anim)) problem(file, `từ "${w.id}": anim phải là một trong ${ANIMS.join(', ')}`);
    if (bank.has(w.id)) problem(file, `id từ "${w.id}" bị trùng`);
    bank.set(w.id, w);
  }
}

const mentions = (sentence: string, text: string) =>
  sentence.toLowerCase().replace(/[’']/g, "'").includes(text.toLowerCase().replace(/[’']/g, "'"));

function buildUnit(file: string, u: UnitFile): Topic | null {
  const where = `${file}${u?.id ? ` (${u.id})` : ''}`;
  if (!u || typeof u !== 'object') return problem(file, 'không phải object'), null;
  for (const k of ['id', 'title', 'icon', 'color', 'playPrompt', 'topic'] as const) {
    if (typeof u[k] !== 'string' || !u[k]) return problem(where, `thiếu "${k}"`), null;
  }
  const level = levelById(u.level);
  if (!level) return problem(where, `level phải là một trong ${LEVELS.map((l) => l.id).join(', ')}`), null;
  if (!u.block || typeof u.block.name !== 'string' || !BLOCK_STYLES.includes(u.block.style)) {
    return problem(where, `block.style phải là một trong ${BLOCK_STYLES.join(', ')}`), null;
  }
  const own = u.steps ?? DEFAULT_STEPS;
  if (own.some((st) => READING_STEPS.includes(st))) problem(where, 'không cần ghi "read"/"spell"/"sentence" trong steps: bậc học tự thêm (tắt bằng "reading": false)');
  const steps = [...own];
  if (u.reading !== false) for (const r of level.reading ?? []) if (!steps.includes(r)) steps.push(r);
  if (!steps.length || steps.some((s) => !STEP_TYPES.includes(s))) return problem(where, `steps chỉ gồm ${STEP_TYPES.join(', ')}`), null;
  const actions = Array.isArray(u.actions) ? u.actions : [];
  if (actions.some((a) => typeof a?.say !== 'string' || !a.say || typeof a?.emoji !== 'string' || !a.emoji)) {
    return problem(where, 'mỗi hành động trong "actions" cần "say" và "emoji"'), null;
  }
  if (steps.includes('do-it') && actions.length < 2) return problem(where, 'bước "do-it" cần ít nhất 2 hành động trong "actions"'), null;
  if (actions.length && !steps.includes('do-it')) problem(where, 'có "actions" nhưng "steps" không có "do-it"');
  let chant: Chant | undefined;
  if (u.chant) {
    const lines = (u.chant.lines ?? []).map((l) => (typeof l === 'string' ? { text: l } : l));
    if (typeof u.chant.title !== 'string' || lines.length < 2 || lines.some((l) => typeof l?.text !== 'string' || !l.text)) {
      return problem(where, '"chant" cần "title" và ít nhất 2 dòng'), null;
    }
    if (u.chant.tune && !TUNE_IDS.includes(u.chant.tune)) problem(where, `chant.tune phải là một trong ${TUNE_IDS.join(', ')}`);
    chant = { title: u.chant.title, lines: lines.map((l) => (l.emoji ? { ...l, emoji: fixEmoji(l.emoji, '') || undefined } : l)), tune: u.chant.tune };
  }
  if (steps.includes('chant') && !chant) return problem(where, 'bước "chant" cần mục "chant"'), null;
  if (chant && !steps.includes('chant')) problem(where, 'có "chant" nhưng "steps" không có "chant"');
  if (u.casa?.luaTuoi && u.casa.luaTuoi !== level.casaLuaTuoi) {
    problem(where, `casa.luaTuoi "${u.casa.luaTuoi}" không khớp bậc ${level.id} ("${level.casaLuaTuoi}")`);
  }

  if (u.parentTip && (typeof u.parentTip.vi !== 'string' || !u.parentTip.vi || typeof u.parentTip.say !== 'string' || !u.parentTip.say)) {
    problem(where, '"parentTip" cần "vi" và "say"');
  }
  if (u.chat && ['ask', 'yes', 'no'].some((k) => typeof u.chat?.[k as 'ask'] !== 'string' || !u.chat?.[k as 'ask'])) {
    problem(where, '"chat" cần "ask", "yes" và "no"');
  }

  const words: Word[] = [];
  for (const ref of u.words ?? []) {
    const id = typeof ref === 'string' ? ref : ref?.id;
    const base = id ? bank.get(id) : undefined;
    if (!base) {
      problem(where, `từ "${id}" không có trong content/words`);
      continue;
    }
    const w: Word = { ...base, ...(typeof ref === 'string' ? {} : ref) };
    if (!mentions(w.sentence, w.text)) problem(where, `câu mẫu của "${w.id}" không chứa chính từ đó: "${w.sentence}"`);
    if (w.def && w.def.toLowerCase().includes(w.text.toLowerCase())) problem(where, `định nghĩa của "${w.id}" không được chứa chính từ đó: "${w.def}"`);
    if (words.some((x) => x.id === w.id)) problem(where, `từ "${w.id}" lặp lại trong bài`);
    words.push(w);
  }
  if (words.length < 3) return problem(where, 'cần ít nhất 3 từ (trò chơi chọn hình cần 3 lựa chọn)'), null;
  if (steps.includes('spell') && words.filter((w) => spellable(w)).length < 2) steps.splice(steps.indexOf('spell'), 1);
  if (steps.includes('sentence') && sentenceCount(words) === 0) steps.splice(steps.indexOf('sentence'), 1);
  if (steps.includes('write') && words.filter(writable).length < 2) steps.splice(steps.indexOf('write'), 1);
  if (steps.includes('define') && words.filter(definable).length < 2) steps.splice(steps.indexOf('define'), 1);
  // Gap fill only where each sentence fits just one word of the unit (checked by hand): "gap": true.
  if (u.gaps) {
    for (const g of u.gaps) {
      if (typeof g?.s !== 'string' || (g.s.match(/___/g) ?? []).length !== 1 || typeof g.answer !== 'string' || !Array.isArray(g.options) || g.options.length !== 2 || g.options.includes(g.answer)) {
        problem(where, `câu điền từ sai dạng (cần đúng một "___", "answer" và 2 "options" khác đáp án): ${JSON.stringify(g)}`);
      }
    }
  }
  if (steps.includes('gap') && !(u.gaps?.length || (u.gap && gapCount(words) > 0))) steps.splice(steps.indexOf('gap'), 1);
  if (u.text) {
    const tx = u.text;
    const bad = typeof tx.title !== 'string' || !Array.isArray(tx.lines) || tx.lines.length < 2 || !Array.isArray(tx.questions) || !tx.questions.length ||
      tx.questions.some((q) => typeof q?.q !== 'string' || !Array.isArray(q.options) || q.options.length < 2 || !(q.answer >= 0 && q.answer < q.options.length));
    if (bad) problem(where, '"text" cần "title", ít nhất 2 dòng "lines" và "questions" (q, options, answer là số thứ tự đáp án đúng)');
  }
  if (steps.includes('text') && !u.text) steps.splice(steps.indexOf('text'), 1);
  // An accepted mishearing must not be another word of the same unit, or saying
  // "cat" would also count as "kite".
  for (const w of words) {
    for (const a of w.accept ?? []) {
      const other = words.find((x) => x !== w && x.text.toLowerCase() === a.toLowerCase());
      if (other) problem(where, `"${a}" (chấp nhận cho "${w.text}") lại là một từ khác trong bài`);
    }
  }

  return {
    id: u.id,
    level: level.id,
    topic: u.topic,
    order: u.order ?? 99,
    title: u.title,
    titleVi: u.titleVi ?? u.title,
    icon: fixEmoji(u.icon),
    color: u.color,
    intro: u.intro ?? `Let's learn ${u.title}!`,
    playPrompt: u.playPrompt,
    block: u.block,
    steps,
    actions: actions.map((a) => ({ ...a, emoji: fixEmoji(a.emoji) })),
    chant,
    casa: u.casa,
    parentTip: u.parentTip,
    chat: u.chat,
    text: u.text,
    gaps: u.gaps,
    words,
  };
}

export const topics: Topic[] = Object.entries(unitFiles)
  .map(([file, mod]) => buildUnit(file, mod.default))
  .filter((t): t is Topic => !!t)
  .sort((a, b) => a.level.localeCompare(b.level) || a.order - b.order || a.id.localeCompare(b.id));

{
  const seen = new Set<string>();
  for (const t of topics) {
    if (seen.has(t.id)) problem(t.id, 'id bài bị trùng');
    seen.add(t.id);
  }
}

export const topicById = (id: string) => topics.find((t) => t.id === id);

// ---------------------------------------------------------------- stories

export type StoryPage = { text: string; scene: string; bix?: boolean };
export type Story = { id: string; unit: string; level: LevelId; title: string; icon: string; pages: StoryPage[]; questions: { ask: string; answer: Word }[] };
type StoryFile = Omit<Story, 'level' | 'questions'> & { questions: { ask: string; answer: string }[] };

const storyFiles = import.meta.glob<{ default: StoryFile }>('../content/stories/*.json', { eager: true });

function buildStory(file: string, s: StoryFile): Story | null {
  const where = `${file}${s?.id ? ` (${s.id})` : ''}`;
  if (!s || typeof s.id !== 'string' || typeof s.title !== 'string' || typeof s.icon !== 'string') return problem(where, 'truyện cần "id", "title", "icon"'), null;
  const unit = topicById(s.unit);
  if (!unit) return problem(where, `truyện gắn với bài "${s.unit}" không có`), null;
  if (!Array.isArray(s.pages) || s.pages.length < 2 || s.pages.some((p) => typeof p?.text !== 'string' || !p.text || typeof p.scene !== 'string')) {
    return problem(where, 'truyện cần ít nhất 2 trang, mỗi trang có "text" và "scene"'), null;
  }
  const questions: Story['questions'] = [];
  for (const q of s.questions ?? []) {
    const answer = unit.words.find((w) => w.id === q?.answer);
    if (typeof q?.ask !== 'string' || !answer) {
      problem(where, `câu hỏi "${q?.ask}": đáp án "${q?.answer}" phải là một từ của bài ${unit.id}`);
      continue;
    }
    questions.push({ ask: q.ask, answer });
  }
  const pages = s.pages.map((p) => ({ ...p, scene: fixEmoji(p.scene, '') }));
  return { id: s.id, unit: unit.id, level: unit.level, title: s.title, icon: fixEmoji(s.icon), pages, questions };
}

export const stories: Story[] = Object.entries(storyFiles)
  .map(([file, mod]) => buildStory(file, mod.default))
  .filter((s): s is Story => !!s)
  .sort((a, b) => topics.findIndex((t) => t.id === a.unit) - topics.findIndex((t) => t.id === b.unit));
export const storyById = (id: string) => stories.find((s) => s.id === id);
export const storiesOfLevel = (level: string) => stories.filter((s) => s.level === level);
export const topicsOfLevel = (level: string) => topics.filter((t) => t.level === level);
/** Levels that have at least one unit. */
export const levelsWithContent = () => LEVELS.filter((l) => topics.some((t) => t.level === l.id));

/** Speaking prompt. Pre-readers (L0–L1) get a command, not a yes/no question
 *  ("Can you say dog?" → a 3-year-old answers "Yes!"). */
export const askFor = (w: Word, level?: LevelId) =>
  w.ask ?? (level === 'L0' || level === 'L1' ? `Say: ${w.text}!` : `Can you say ${w.text}?`);

export const playPromptFor = (t: Topic, w: Word) => w.play ?? t.playPrompt.replace('{word}', w.text);

/** Block type definitions, one per unit. */
export function blockDefs(): (BlockDef & { level: LevelId })[] {
  return topics.map((t) => ({ type: t.id, name: t.block.name, style: t.block.style, color: t.block.color, level: t.level }));
}
