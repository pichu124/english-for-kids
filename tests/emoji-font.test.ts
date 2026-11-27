import { describe, expect, it } from 'vitest';
import list from '../scripts/emoji-font-codepoints.txt?raw';

// The bundled emoji font must hold every emoji the content uses: after adding new emoji,
// run scripts/emoji-list.mjs + scripts/emoji-font.py (see the top of emoji-font.py).
const sources = {
  ...import.meta.glob('../content/**/*.json', { eager: true, query: '?raw', import: 'default' }),
  ...import.meta.glob('../src/**/*.ts', { eager: true, query: '?raw', import: 'default' }),
} as Record<string, string>;
const font = new Set(list.split(/\s+/).filter(Boolean).map((x: string) => parseInt(x, 16)));
const inFont = (cp: number) => font.has(cp);

describe('bundled emoji font', () => {
  it('has every emoji the app shows', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(100);
    const missing = new Set<string>();
    for (const [file, text] of Object.entries(sources)) {
      for (const m of text.matchAll(/\p{Emoji_Presentation}|\p{Extended_Pictographic}️/gu)) {
        const cp = m[0].codePointAt(0)!;
        if (cp >= 0x80 && !inFont(cp)) missing.add(`${m[0]} (${file})`);
      }
    }
    expect([...missing]).toEqual([]);
  });
  it('the font file is there', () => {
    expect(Object.keys(import.meta.glob('../public/fonts/bix-emoji.woff2'))).toHaveLength(1);
  });
});
