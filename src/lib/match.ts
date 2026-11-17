/**
 * Lenient matching of what the recognizer heard against the target word.
 * A young child's speech is often mis-transcribed, so we accept:
 *  1. any alternative that contains the target (or an accepted variant) as words,
 *  2. a near miss by edit distance on any window of words,
 *  3. the same rough "sound key" (consonant skeleton).
 * There is no "wrong" — the caller only decides between "great" and "try again".
 */

export type MatchResult = { ok: boolean; how?: 'exact' | 'close' | 'sound'; heard: string };

const CONTRACTIONS: [RegExp, string][] = [
  [/\bi'm\b/g, 'i am'],
  [/\bim\b/g, 'i am'],
  [/\byou're\b/g, 'you are'],
  [/\bit's\b/g, 'it is'],
  [/\bthat's\b/g, 'that is'],
  [/\bu\b/g, 'you'],
  [/\br\b/g, 'are'],
];

export function normalize(s: string): string {
  let t = s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’ʼ`]/g, "'");
  t = t.replace(/[^a-z0-9' ]+/g, ' ');
  for (const [re, rep] of CONTRACTIONS) t = t.replace(re, rep);
  return t.replace(/'/g, '').replace(/\s+/g, ' ').trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Rough sound key: first letter + consonant skeleton with look-alike sounds merged. */
export function soundKey(word: string): string {
  let w = word.replace(/[^a-z]/g, '');
  if (!w) return '';
  w = w
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/th/g, 't')
    .replace(/sh/g, 's')
    .replace(/ch/g, 's')
    .replace(/q/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/[cz]/g, (m) => (m === 'c' ? 'k' : 's'))
    .replace(/[bp]/g, 'b')
    .replace(/[dt]/g, 'd')
    .replace(/[gk]/g, 'g')
    .replace(/[vfw]/g, 'f');
  const first = /[aeiouy]/.test(w[0]) ? 'a' : w[0];
  const rest = w.slice(1).replace(/[aeiouyh]/g, '');
  return (first + rest).replace(/(.)\1+/g, '$1');
}

function allowedDistance(len: number): number {
  if (len <= 3) return 1;
  if (len <= 5) return 2;
  return Math.ceil(len * 0.4);
}

function windows(words: string[], n: number): string[] {
  const out: string[] = [];
  for (let size = Math.max(1, n - 1); size <= n + 1; size++) {
    for (let i = 0; i + size <= words.length; i++) out.push(words.slice(i, i + size).join(' '));
  }
  // Also try the whole thing glued together ("ice cream" heard as "icecream").
  out.push(words.join(''));
  return out;
}

export function matchSpeech(target: string, accepts: readonly string[], alternatives: readonly string[]): MatchResult {
  const cands = [target, ...accepts].map(normalize).filter(Boolean);
  const alts = alternatives.map(normalize).filter(Boolean);
  const heard = alts[0] ?? '';

  // 1. contains as whole words
  for (const alt of alts) {
    const padded = ` ${alt} `;
    for (const c of cands) {
      if (padded.includes(` ${c} `) || alt.replace(/ /g, '') === c.replace(/ /g, '')) {
        return { ok: true, how: 'exact', heard: alt };
      }
    }
  }

  // 2. close by edit distance, 3. same sound key
  for (const alt of alts) {
    const words = alt.split(' ');
    for (const c of cands) {
      const n = c.split(' ').length;
      const cKey = c.split(' ').map(soundKey).join(' ');
      for (const w of windows(words, n)) {
        if (levenshtein(w, c) <= allowedDistance(c.length)) return { ok: true, how: 'close', heard: alt };
        const wKey = w.split(' ').map(soundKey).join(' ');
        if (cKey.length >= 2 && wKey === cKey) return { ok: true, how: 'sound', heard: alt };
      }
    }
  }
  return { ok: false, heard };
}
