/**
 * Lesson content is plain JSON in /content. Every file matching content/*.json
 * is picked up at build time — add a topic by adding a file, no code changes.
 */
import { BLOCK_STYLES, type BlockDef, type BlockStyle } from './art/blocks';

export type Word = {
  id: string;
  /** What the child should say (and what is shown). */
  text: string;
  /** Picture: an emoji, or a color swatch (for color words). */
  image: { emoji?: string; color?: string };
  /** Example sentence the character says, e.g. "This is a dog." */
  sentence: string;
  /** Prompt in the speaking step. Default: "Can you say {text}?" */
  ask?: string;
  /** Other transcriptions that should count, e.g. "mom" for "mum". */
  accept?: string[];
};

export type Topic = {
  id: string;
  order: number;
  title: string;
  /** Vietnamese name, shown only in the parent area. */
  titleVi: string;
  icon: string;
  /** Grass color of the topic's island on the home map. */
  color: string;
  intro: string;
  /** Prompt for the tap game, with {word} as placeholder. */
  playPrompt: string;
  block: { name: string; style: BlockStyle; color: string };
  words: Word[];
};

const files = import.meta.glob<{ default: unknown }>('../content/*.json', { eager: true });

function isTopic(t: unknown, file: string): t is Topic {
  const fail = (why: string) => {
    console.warn(`[content] ${file}: ${why} — skipped`);
    return false;
  };
  if (!t || typeof t !== 'object') return fail('not an object');
  const o = t as Record<string, unknown>;
  for (const k of ['id', 'title', 'icon', 'color', 'playPrompt'] as const) {
    if (typeof o[k] !== 'string' || !o[k]) return fail(`missing "${k}"`);
  }
  if (!Array.isArray(o.words) || o.words.length < 3) return fail('needs at least 3 words');
  for (const w of o.words as Record<string, unknown>[]) {
    if (typeof w?.id !== 'string' || typeof w?.text !== 'string' || typeof w?.sentence !== 'string') {
      return fail(`bad word ${JSON.stringify(w)}`);
    }
    const img = w.image as Record<string, unknown> | undefined;
    if (!img || (typeof img.emoji !== 'string' && typeof img.color !== 'string')) {
      return fail(`word "${String(w.id)}" needs image.emoji or image.color`);
    }
  }
  const b = o.block as Record<string, unknown> | undefined;
  if (!b || typeof b.name !== 'string' || !BLOCK_STYLES.includes(b.style as BlockStyle)) {
    return fail(`block.style must be one of ${BLOCK_STYLES.join(', ')}`);
  }
  return true;
}

export const topics: Topic[] = Object.entries(files)
  .map(([file, mod]) => ({ file, data: mod.default }))
  .filter(({ file, data }) => isTopic(data, file))
  .map(({ data }) => {
    const t = data as Topic;
    return { ...t, order: t.order ?? 99, titleVi: t.titleVi ?? t.title, intro: t.intro ?? `Let's learn ${t.title}!` };
  })
  .sort((a, b) => a.order - b.order);

export const topicById = (id: string) => topics.find((t) => t.id === id);

export const askFor = (w: Word) => w.ask ?? `Can you say ${w.text}?`;

export const playPromptFor = (t: Topic, w: Word) => t.playPrompt.replace('{word}', w.text);

/** Block type definitions, one per topic. */
export function blockDefs(): BlockDef[] {
  return topics.map((t) => ({ type: t.id, name: t.block.name, style: t.block.style, color: t.block.color }));
}
