/**
 * Letter names written the way they sound, so the speech engine says "ay, bee, see"
 * instead of reading a lone "a" as the word "uh".
 */
export const LETTER_NAME: Record<string, string> = {
  a: 'ay', b: 'bee', c: 'see', d: 'dee', e: 'ee', f: 'ef', g: 'jee', h: 'aitch', i: 'eye', j: 'jay', k: 'kay', l: 'el', m: 'em',
  n: 'en', o: 'oh', p: 'pee', q: 'cue', r: 'ar', s: 'ess', t: 'tee', u: 'you', v: 'vee', w: 'double you', x: 'ex', y: 'why', z: 'zee',
};
export const letterName = (c: string) => LETTER_NAME[c.toLowerCase()] ?? c;
/** "cat" → "see, ay, tee" */
export const spellOut = (word: string) => word.toLowerCase().split('').filter((c) => LETTER_NAME[c]).map(letterName).join(', ');
