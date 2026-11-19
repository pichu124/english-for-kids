/**
 * Traditional, public-domain melodies (all written down long before 1900 or folk
 * songs with no known author), entered note by note — no audio files, no
 * copyrighted recordings. Played by src/lib/music.ts.
 *
 * notes:  "C D E:2 G3 R:2" — note name, octave if not 4, ":units" if not 1, R = rest.
 * chords: one chord root per `chordEvery` units (the bass plays it).
 */
export type Tune = { id: string; name: string; bpm: number; beatEvery: number; chordEvery: number; notes: string; chords: string };

export const TUNES: Tune[] = [
  {
    id: 'twinkle', name: 'Twinkle, Twinkle, Little Star', bpm: 104, beatEvery: 1, chordEvery: 2,
    notes: 'C C G G A A G:2 F F E E D D C:2 G G F F E E D:2 G G F F E E D:2 C C G G A A G:2 F F E E D D C:2',
    chords: 'C C F C F C G C C F C G C F C G C C F C F C G C',
  },
  {
    id: 'oldmac', name: 'Old MacDonald Had a Farm', bpm: 116, beatEvery: 1, chordEvery: 2,
    notes: 'C C C G3 A3 A3 G3:2 E E D D C:2 R:2',
    chords: 'C C F C C G C C',
  },
  {
    id: 'row', name: 'Row, Row, Row Your Boat', bpm: 230, beatEvery: 3, chordEvery: 6,
    notes: 'C:3 C:3 C:2 D:1 E:3 E:2 D:1 E:2 F:1 G:6 C5 C5 C5 G G G E E E C C C G:2 F:1 E:2 D:1 C:6',
    chords: 'C C C C C C G C',
  },
  {
    id: 'mary', name: 'Mary Had a Little Lamb', bpm: 112, beatEvery: 1, chordEvery: 4,
    notes: 'E D C D E E E:2 D D D:2 E G G:2 E D C D E E E E D D E D C:4',
    chords: 'C C G C C C G C',
  },
  {
    id: 'london', name: 'London Bridge', bpm: 108, beatEvery: 1, chordEvery: 4,
    notes: 'G:1.5 A:0.5 G F E F G:2 D E F:2 E F G:2 G:1.5 A:0.5 G F E F G:2 D:2 G:2 E C:3',
    chords: 'C C G C C C G C',
  },
  {
    id: 'frere', name: 'Frère Jacques', bpm: 112, beatEvery: 1, chordEvery: 4,
    notes: 'C D E C C D E C E F G:2 E F G:2 G:0.5 A:0.5 G:0.5 F:0.5 E C G:0.5 A:0.5 G:0.5 F:0.5 E C C G3 C:2 C G3 C:2',
    chords: 'C C C C C C C C',
  },
];
export const TUNE_IDS = TUNES.map((t) => t.id);
export const tuneById = (id: string) => TUNES.find((t) => t.id === id);

/** Default tune for a unit's chant: stable per unit id. */
export function tuneFor(unitId: string, tune?: string): Tune {
  const t = tune ? tuneById(tune) : undefined;
  if (t) return t;
  let n = 0;
  for (const c of unitId) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return TUNES[n % TUNES.length];
}

const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "G3:2" = G in octave 3 for 2 units; "E" = E4 for 1 unit; "R:2" = rest. */
export function parseNote(tok: string): { midi: number | null; units: number } {
  const m = /^([A-GR])([#b]?)(\d)?(?::(\d+(?:\.\d+)?))?$/.exec(tok);
  if (!m) throw new Error(`bad note ${tok}`);
  const [, letter, acc, oct, dur] = m;
  const units = dur ? Number(dur) : 1;
  if (letter === 'R') return { midi: null, units };
  const octave = oct ? Number(oct) : 4;
  return { midi: 12 * (octave + 1) + SEMI[letter] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0), units };
}

export type NoteEvent = { at: number; units: number; midi: number };
export function melody(t: Tune): { notes: NoteEvent[]; length: number } {
  const notes: NoteEvent[] = [];
  let at = 0;
  for (const tok of t.notes.split(/\s+/).filter(Boolean)) {
    const n = parseNote(tok);
    if (n.midi !== null) notes.push({ at, units: n.units, midi: n.midi });
    at += n.units;
  }
  return { notes, length: at };
}
