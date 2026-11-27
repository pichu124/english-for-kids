// Every emoji the app shows (content + code), for the bundled emoji font (scripts/emoji-font.py).
// Prints the code points to keep, one hex per line. Run: node scripts/emoji-list.mjs > /tmp/emoji.txt
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(json|ts)$/.test(f)) files.push(p);
  }
};
walk(join(root, 'content'));
walk(join(root, 'src'));
// an emoji: a pictograph shown as emoji by default, or any pictograph followed by U+FE0F,
// with its skin tone / ZWJ joins; plus flags (regional-indicator pairs) and keycaps
const RE = /(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}️)(?:\p{Emoji_Modifier}|️|‍(?:\p{Extended_Pictographic})️?)*|\p{Regional_Indicator}{2}|[0-9#*]️?⃣/gu;
const keep = new Set();
const seqs = new Set();
for (const f of files) {
  for (const m of readFileSync(f, 'utf8').matchAll(RE)) {
    seqs.add(m[0]);
    for (const ch of m[0]) {
      const cp = ch.codePointAt(0);
      if (cp >= 0x2000 || cp === 0x20e3) keep.add(cp); // never ASCII digits/#/* or Latin text
      if (cp === 0x20e3) for (const c of m[0]) keep.add(c.codePointAt(0));
    }
  }
}
if (process.argv[2] === '--seqs') console.log([...seqs].join(' '));
else console.log([...keep].sort((a, b) => a - b).map((c) => c.toString(16)).join('\n'));
