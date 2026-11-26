/**
 * Emoji that older phones may not have (Emoji 11–13, from 2018 on): Android 8–10 and
 * some Chinese ROMs show them as empty boxes. On start-up each one is drawn once on a
 * hidden canvas; the ones this device cannot show are replaced — by an older emoji
 * with the same meaning, or (for words) by the word itself in big letters.
 */

/** Newer emoji used in the content → older replacement ('' = none: drop it / show the word). */
export const NEWER_EMOJI: Record<string, string> = {
  '🥭': '', // mango
  '🦘': '',
  '🦛': '', // hippo
  '🧸': '🐻', // teddy
  '🧳': '', // suitcase (shows the word on old phones)
  '🧺': '🌳', // picnic basket (story scene)
  '🦵': '', // leg
  '🦶': '👣', // foot
  '🧱': '🏠', // bricks (My World button)
  '🟦': '🔲', // square
  '🟫': '',
  '🧑‍🏫': '👩‍🏫', // teacher
  '🧑‍🤝‍🧑': '👫', // friends
  '🧅': '', // onion
  '🧃': '🥤', // juice
  '🥱': '😴', // tired
  '🩳': '', // shorts
  '🪀': '', // yo-yo
  '🪁': '', // kite
  '🪑': '💺', // chair
  '🪆': '🎎', // doll
  '🪞': '', // mirror
  '🪟': '', // window
};

const CACHE_KEY = 'efk.emoji';
let results: Record<string, boolean> | null = null;

/** Draw a character on a small canvas; null when canvas is not available (tests). */
function pixels(ctx: CanvasRenderingContext2D, ch: string): Uint8ClampedArray {
  ctx.clearRect(0, 0, 40, 40);
  ctx.fillText(ch, 2, 4);
  return ctx.getImageData(0, 0, 40, 40).data;
}

function detect(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  let forced: string[] = [];
  try {
    forced = JSON.parse(localStorage.getItem('efk.emoji.missing') || '[]'); // for tests and checking by hand
  } catch {
    /* ignore */
  }
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 40;
    ctx = c.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings) as CanvasRenderingContext2D | null;
  } catch {
    ctx = null;
  }
  if (!ctx) {
    for (const e of Object.keys(NEWER_EMOJI)) out[e] = !forced.includes(e);
    return out;
  }
  ctx.font = '28px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
  ctx.textBaseline = 'top';
  const tofu = pixels(ctx, '\u{10FFFD}'); // a private-use character: what "no glyph" looks like here
  const refW = ctx.measureText('😀').width || 28;
  for (const e of Object.keys(NEWER_EMOJI)) {
    if (forced.includes(e)) {
      out[e] = false;
      continue;
    }
    const px = pixels(ctx, e);
    let ink = 0;
    let same = true;
    for (let i = 3; i < px.length; i += 4) {
      if (px[i] > 0) ink++;
      if (same && px[i] !== tofu[i]) same = false;
    }
    // Blank, identical to the "no glyph" box, or split into several glyphs (ZWJ sequences).
    out[e] = ink > 20 && !same && ctx.measureText(e).width < refW * 1.6;
  }
  return out;
}

/** Can this device show `e`? (Old emoji always can.) */
export function emojiOk(e: string): boolean {
  if (!(e in NEWER_EMOJI)) return true;
  if (!results) {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (c && c.ua === ua && !localStorage.getItem('efk.emoji.missing')) results = c.results;
    } catch {
      /* ignore */
    }
    if (!results) {
      results = detect();
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ua, results }));
      } catch {
        /* ignore */
      }
    }
  }
  return results![e] !== false;
}

/** Forget the cached check (parent area "check again"). */
export function recheckEmoji(): void {
  results = null;
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

/** Replace emoji this device cannot show inside any text (icons, story scenes). */
export function fixEmoji(s: string, empty = '⭐'): string {
  let out = s;
  for (const [e, alt] of Object.entries(NEWER_EMOJI)) {
    if (out.includes(e) && !emojiOk(e)) out = out.split(e).join(alt);
  }
  return out.trim() ? out : empty;
}

/** For a word's picture: the emoji to show, or null = show the word written instead. */
export function wordEmoji(e: string): string | null {
  if (emojiOk(e)) return e;
  const alt = NEWER_EMOJI[e];
  return alt && emojiOk(alt) ? alt : null;
}
