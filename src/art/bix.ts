/**
 * "Bix" — the app's own block-buddy character: a box head with an antenna and
 * square orange glasses, a cube body with a pixel heart. Drawn in SVG; moods are
 * CSS classes so the same drawing can greet, talk, cheer, encourage, listen, sleep.
 */
import { fromHTML, h } from '../lib/dom';
import { say } from '../lib/tts';

export type Mood = 'idle' | 'hello' | 'talk' | 'happy' | 'encourage' | 'listen' | 'sleep';

const HEAD = '#2ec4b6';
const HEAD_TOP = '#7fe3d9';
const HEAD_SIDE = '#1b9a8e';
const BODY = '#ffb703';
const BODY_TOP = '#ffd166';
const BODY_SIDE = '#df9500';
const ARM = '#7b6cf6';
const ARM_SIDE = '#5a4bd6';
const LEG = '#3d4a8a';
const INK = '#1d2440';

function box(x: number, y: number, w: number, hgt: number, d: number, front: string, top: string, side: string, extra = '') {
  return `<g ${extra}>
    <polygon points="${x},${y} ${x + d},${y - d} ${x + w + d},${y - d} ${x + w},${y}" fill="${top}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <polygon points="${x + w},${y} ${x + w + d},${y - d} ${x + w + d},${y + hgt - d} ${x + w},${y + hgt}" fill="${side}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <rect x="${x}" y="${y}" width="${w}" height="${hgt}" fill="${front}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  </g>`;
}

const heart = (() => {
  const px = [
    '.XX.XX.',
    'XXXXXXX',
    'XXXXXXX',
    '.XXXXX.',
    '..XXX..',
    '...X...',
  ];
  let s = '';
  px.forEach((row, r) =>
    row.split('').forEach((c, i) => {
      if (c === 'X') s += `<rect x="${78 + i * 5}" y="${180 + r * 5}" width="5" height="5" fill="#ef476f"/>`;
    }),
  );
  return s;
})();

const SVG = `
<svg class="bix-svg" viewBox="0 0 200 290" role="img" aria-label="Bix">
  <ellipse class="bix-shadow" cx="100" cy="278" rx="62" ry="9" fill="#000" opacity=".15"/>
  <g class="bix-all">
    <g class="bix-legs">
      ${box(66, 230, 24, 38, 8, LEG, '#5a68b0', '#2b3566')}
      ${box(102, 230, 24, 38, 8, LEG, '#5a68b0', '#2b3566')}
    </g>
    <g class="bix-body">
      ${box(54, 160, 84, 72, 12, BODY, BODY_TOP, BODY_SIDE)}
      ${heart}
    </g>
    <g class="bix-head">
      <g class="bix-antenna">
        <rect x="96" y="26" width="7" height="28" fill="${INK}"/>
        <g class="bix-bulb">${box(88, 14, 20, 16, 6, '#ff6b6b', '#ffa3a3', '#d94848')}</g>
      </g>
      ${box(36, 56, 120, 100, 16, HEAD, HEAD_TOP, HEAD_SIDE)}
      <g class="bix-face">
        <g class="eyes eyes-open">
          <rect x="50" y="76" width="40" height="36" rx="4" fill="#fff" stroke="#ff7a00" stroke-width="6"/>
          <rect x="102" y="76" width="40" height="36" rx="4" fill="#fff" stroke="#ff7a00" stroke-width="6"/>
          <rect x="88" y="88" width="16" height="6" fill="#ff7a00"/>
          <g class="pupils">
            <rect x="64" y="85" width="14" height="18" rx="2" fill="${INK}"/>
            <rect x="116" y="85" width="14" height="18" rx="2" fill="${INK}"/>
            <rect x="67" y="88" width="5" height="5" fill="#fff"/>
            <rect x="119" y="88" width="5" height="5" fill="#fff"/>
          </g>
          <g class="lids"><rect x="53" y="79" width="34" height="30" fill="${HEAD}"/><rect x="105" y="79" width="34" height="30" fill="${HEAD}"/></g>
        </g>
        <g class="eyes eyes-happy">
          <rect x="50" y="76" width="40" height="36" rx="4" fill="#fff" stroke="#ff7a00" stroke-width="6"/>
          <rect x="102" y="76" width="40" height="36" rx="4" fill="#fff" stroke="#ff7a00" stroke-width="6"/>
          <rect x="88" y="88" width="16" height="6" fill="#ff7a00"/>
          <path d="M59 101 l11 -12 l11 12" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="square"/>
          <path d="M111 101 l11 -12 l11 12" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="square"/>
        </g>
        <g class="eyes eyes-closed">
          <rect x="56" y="94" width="28" height="6" fill="${INK}"/>
          <rect x="108" y="94" width="28" height="6" fill="${INK}"/>
        </g>
        <rect x="46" y="120" width="16" height="9" fill="#ff8fab" opacity=".8"/>
        <rect x="130" y="120" width="16" height="9" fill="#ff8fab" opacity=".8"/>
        <g class="mouth mouth-smile"><path d="M80 124 h8 v6 h16 v-6 h8 v8 h-4 v6 h-24 v-6 h-4z" fill="${INK}"/></g>
        <g class="mouth mouth-talk"><rect x="82" y="122" width="28" height="20" rx="3" fill="${INK}"/><rect x="88" y="134" width="16" height="6" fill="#ff6b81"/></g>
        <g class="mouth mouth-big"><path d="M74 120 h44 v8 h-4 v8 h-6 v4 h-24 v-4 h-6 v-8 h-4z" fill="${INK}"/><rect x="86" y="132" width="20" height="7" fill="#ff6b81"/></g>
        <g class="mouth mouth-o"><rect x="88" y="122" width="16" height="16" rx="3" fill="${INK}"/></g>
      </g>
    </g>
    <g class="bix-arm bix-arm-l">
      ${box(30, 164, 22, 54, 8, ARM, '#a397ff', ARM_SIDE)}
      ${box(30, 218, 22, 16, 6, HEAD, HEAD_TOP, HEAD_SIDE)}
    </g>
    <g class="bix-arm bix-arm-r">
      ${box(140, 164, 22, 54, 8, ARM, '#a397ff', ARM_SIDE)}
      ${box(140, 218, 22, 16, 6, HEAD, HEAD_TOP, HEAD_SIDE)}
    </g>
    <g class="bix-zzz" fill="${INK}" font-family="inherit" font-weight="800">
      <text x="158" y="40" font-size="26">z</text><text x="172" y="20" font-size="18">z</text>
    </g>
  </g>
</svg>`;

export class Bix {
  readonly el: HTMLElement;
  private bubble: HTMLElement;
  private mood: Mood = 'idle';

  constructor(opts: { size?: 'sm' | 'md' | 'lg'; bubble?: boolean } = {}) {
    this.bubble = h('div', { class: 'bix-bubble', 'aria-live': 'polite' });
    this.el = h('div', { class: `bix bix-${opts.size ?? 'md'} is-idle` }, fromHTML(SVG));
    if (opts.bubble !== false) this.el.appendChild(this.bubble);
  }

  setMood(m: Mood): this {
    this.el.classList.remove(`is-${this.mood}`);
    this.mood = m;
    this.el.classList.add(`is-${m}`);
    return this;
  }

  show(text: string): void {
    this.bubble.textContent = text;
    this.bubble.classList.toggle('is-shown', !!text);
  }

  /** Say a line out loud with the talking mouth, then settle into `after`. */
  async talk(text: string, after: Mood = 'idle', bubbleText: string = text): Promise<void> {
    this.show(bubbleText);
    this.setMood('talk');
    await say(text);
    this.setMood(after);
  }

  async talkLines(lines: string[], after: Mood = 'idle'): Promise<void> {
    for (const l of lines) {
      if (!this.el.isConnected) return;
      await this.talk(l, 'talk');
    }
    this.setMood(after);
  }
}
