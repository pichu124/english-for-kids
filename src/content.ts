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
};

export const LEVELS: Level[] = [
  { id: 'L0', name: 'Little Bix', nameVi: 'Bậc 0 · Little Bix (3–4 tuổi)', ages: '3–4', framework: 'Cambridge Early Years', casaLuaTuoi: '3-4', showText: false, choices: 3, playRounds: 4 },
  { id: 'L1', name: 'Bix Explorer', nameVi: 'Bậc 1 · Bix Explorer (4–5 tuổi)', ages: '4–5', framework: 'Cambridge Early Years', casaLuaTuoi: '4-5', showText: true, choices: 3, playRounds: 5 },
  { id: 'L2', name: 'Starters', nameVi: 'Bậc 2 · Starters (5–7 tuổi)', ages: '5–7', framework: 'Pre A1 Starters · Primary ESL Stage 1–2', casaLuaTuoi: '5-6', showText: true, choices: 4, playRounds: 6 },
  { id: 'L3', name: 'Movers', nameVi: 'Bậc 3 · Movers (7–8 tuổi)', ages: '7–8', framework: 'A1 Movers · Primary ESL Stage 3–4', casaLuaTuoi: '', showText: true, choices: 4, playRounds: 6 },
  { id: 'L4', name: 'Flyers', nameVi: 'Bậc 4 · Flyers (9–10 tuổi)', ages: '9–10', framework: 'A2 Flyers · Primary ESL Stage 5–6', casaLuaTuoi: '', showText: true, choices: 4, playRounds: 6 },
];

export const levelById = (id: string): Level | undefined => LEVELS.find((l) => l.id === id);
export const DEFAULT_LEVEL: LevelId = 'L2';

// ---------------------------------------------------------------- types

export type Word = {
  id: string;
  /** What the child should say (and what is shown). */
  text: string;
  /** Picture: an emoji, or a color swatch (for color words). */
  image: { emoji?: string; color?: string; text?: string; scene?: string };
  /** Example sentence the character says, e.g. "This is a dog." (unit may override) */
  sentence: string;
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
  places: 'pulse', hello: 'wave', positions: 'pulse',
};
/** The animation to play for a word. */
export const animFor = (w: Word & { topic?: string }): Anim => w.anim ?? TOPIC_ANIM[(w as { topic?: string }).topic ?? ''] ?? 'bounce';

export type StepType = 'listen' | 'say' | 'tap-picture' | 'do-it' | 'chant';
export const STEP_TYPES: StepType[] = ['listen', 'say', 'tap-picture', 'do-it', 'chant'];
/** Steps a unit gets when it does not list its own. */
export const DEFAULT_STEPS: StepType[] = ['listen', 'say', 'tap-picture'];

/** A "do it" command (Total Physical Response): the child acts it out, then taps ✓. */
export type Action = { say: string; emoji: string };

/** A short rhythmic chant: Bix says it on a beat, then the child joins in. */
export type ChantLine = { text: string; emoji?: string };
export type Chant = { title: string; lines: ChantLine[] };

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
  /** "Play together" card for parents: what to do at home (Vietnamese) and the English line to say. */
  parentTip?: { vi: string; say: string };
  /** A yes/no question Bix asks the child about the topic, with its two replies. */
  chat?: { ask: string; yes: string; no: string };
  words: Word[];
};

type BankFile = { topic?: string; words: Word[] };
type UnitWordRef = string | ({ id: string } & Partial<Pick<Word, 'sentence' | 'ask' | 'play' | 'accept' | 'image'>>);
type UnitFile = Omit<Topic, 'words' | 'steps' | 'actions' | 'chant' | 'titleVi' | 'intro' | 'order'> & {
  actions?: Action[];
  chant?: { title: string; lines: (string | ChantLine)[] };
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
    if (!w.image || (typeof w.image.emoji !== 'string' && typeof w.image.color !== 'string' && typeof w.image.text !== 'string' && typeof w.image.scene !== 'string')) {
      problem(file, `từ "${w.id}" cần image.emoji, image.color, image.text hoặc image.scene`);
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
  const steps = u.steps ?? DEFAULT_STEPS;
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
    chant = { title: u.chant.title, lines };
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
    if (words.some((x) => x.id === w.id)) problem(where, `từ "${w.id}" lặp lại trong bài`);
    words.push(w);
  }
  if (words.length < 3) return problem(where, 'cần ít nhất 3 từ (trò chơi chọn hình cần 3 lựa chọn)'), null;
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
    icon: u.icon,
    color: u.color,
    intro: u.intro ?? `Let's learn ${u.title}!`,
    playPrompt: u.playPrompt,
    block: u.block,
    steps,
    actions,
    chant,
    casa: u.casa,
    parentTip: u.parentTip,
    chat: u.chat,
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
  return { id: s.id, unit: unit.id, level: unit.level, title: s.title, icon: s.icon, pages: s.pages, questions };
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
