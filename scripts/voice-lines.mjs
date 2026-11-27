// Recorded voice for Bix (see src/lib/voice.ts).
//
// 1. List the lines to record (one sentence per line, with the file name to save it as):
//      node scripts/voice-lines.mjs > voice-lines.csv
//    Give the CSV to the voice actor: one short audio file per row, named as in the first column
//    (mp3 or m4a, mono, clear, friendly, a native English speaker; no music).
// 2. Put the files in public/audio/ and build the manifest the app reads:
//      node scripts/voice-lines.mjs --manifest
//    Lines with no file keep using the phone's speech engine, so this can be done a bit at a time.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const normalize = (t) => t.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
const sentences = (t) => t.split(/(?<=[.!?…])\s+/).map((x) => x.trim()).filter((x) => normalize(x));
const fileFor = (t) => {
  const n = normalize(t);
  return `${n.replace(/'/g, '').replace(/ /g, '-').slice(0, 40)}-${createHash('sha1').update(n).digest('hex').slice(0, 6)}.mp3`;
};

// English text in the content: these keys hold what Bix says or reads
const KEYS = new Set(['text', 'sentence', 'intro', 'playPrompt', 'ask', 'yes', 'no', 'a', 'bSay', 'reply', 'fallback', 'say', 'q', 'question', 'def', 'word', 'title', 'chant', 'line', 'lines']);
const english = (s) => /[a-z]/i.test(s) && !/[À-ỹ]/.test(s) && !/\p{Extended_Pictographic}/u.test(s) && s.length < 200;
const found = new Set();
const walk = (v, key) => {
  if (typeof v === 'string') {
    if (KEYS.has(key) && english(v)) for (const s of sentences(v)) found.add(s);
  } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!/vi$/i.test(k)) walk(x, k);
};
const files = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? files(join(d, f)) : f.endsWith('.json') ? [join(d, f)] : []));
for (const f of files(join(root, 'content'))) walk(JSON.parse(readFileSync(f, 'utf8')), '');
// what Bix says in every lesson (src/screens/lesson/shared.ts and the mic turn)
for (const s of ['Great job!', 'Super!', 'Wow!', 'Awesome!', 'Well done!', 'Yes! You did it!', 'Fantastic!', 'Try again!', 'Good try!', "Let's go on.", 'Your turn!', 'Tap and read.', 'Listen!', 'What is it?', 'Start at the green dot!', 'Keep going from the green dot!', "Hello! I'm Bix.", "Let's play!", 'Good night!', 'See you tomorrow!'])
  for (const x of sentences(s)) found.add(x);

const list = [...found].sort((a, b) => a.localeCompare(b));
if (process.argv[2] === '--manifest') {
  const dir = join(root, 'public', 'audio');
  const have = new Set(existsSync(dir) ? readdirSync(dir) : []);
  const lines = {};
  for (const s of list) {
    const f = fileFor(s);
    for (const name of [f, f.replace(/\.mp3$/, '.m4a')]) if (have.has(name)) lines[normalize(s)] = name;
  }
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ lines }, null, 1) + '\n');
  console.error(`manifest: ${Object.keys(lines).length} of ${list.length} lines have a recording`);
} else {
  console.log('file,text');
  for (const s of list) console.log(`${fileFor(s)},"${s.replace(/"/g, '""')}"`);
  console.error(`${list.length} lines to record`);
}
