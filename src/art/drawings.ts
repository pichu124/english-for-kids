/**
 * Pictures for words that have no (old enough) emoji: a child with one body part
 * circled, and simple household things and landscapes. Same ink and stroke as the
 * rest of the app. `image.body` / `image.icon` in the word bank.
 */
const INK = '#1d2440';
const S = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;

export const BODY_PARTS = ['head', 'neck', 'shoulder', 'stomach', 'knee', 'teeth'] as const;
export const ICONS = ['stairs', 'roof', 'towel', 'blanket', 'toothbrush', 'toothpaste', 'river', 'lake', 'waterfall', 'rock', 'above', 'below', 'near', 'opposite', 'inside', 'outside'] as const;

const child = `
  <rect x="38" y="122" width="10" height="12" rx="3" fill="#3d4a8a" ${S}/><rect x="52" y="122" width="10" height="12" rx="3" fill="#3d4a8a" ${S}/>
  <rect x="38" y="90" width="10" height="34" fill="#4361ee" ${S}/><rect x="52" y="90" width="10" height="34" fill="#4361ee" ${S}/>
  <rect x="20" y="52" width="10" height="34" rx="5" fill="#f6c89f" ${S}/><rect x="70" y="52" width="10" height="34" rx="5" fill="#f6c89f" ${S}/>
  <rect x="30" y="50" width="40" height="44" rx="10" fill="#4cc9f0" ${S}/>
  <rect x="45" y="40" width="10" height="12" fill="#f6c89f" ${S}/>
  <circle cx="50" cy="24" r="17" fill="#f6c89f" ${S}/>
  <path d="M33 22 Q35 5 50 6 Q65 5 67 22 Q58 14 50 15 Q42 14 33 22 Z" fill="#6b4226" ${S}/>
  <circle cx="44" cy="25" r="2.2" fill="${INK}"/><circle cx="56" cy="25" r="2.2" fill="${INK}"/>
  <path d="M44 32 Q50 37 56 32" fill="none" ${S}/>`;
const SPOT: Record<string, [number, number, number]> = { head: [50, 22, 22], neck: [50, 46, 10], shoulder: [30, 56, 12], stomach: [50, 76, 16], knee: [43, 108, 10] };

export function bodySVG(part: string): string {
  if (part === 'teeth') {
    return `<svg class="drawing" viewBox="0 0 100 100" role="img" aria-label="teeth">
      <path d="M12 40 Q50 20 88 40 Q80 82 50 86 Q20 82 12 40 Z" fill="#e2553f" ${S}/>
      <path d="M18 42 Q50 30 82 42 L80 52 Q50 46 20 52 Z" fill="#fff" ${S}/>
      <path d="M30 40 V50 M42 37 V48 M54 37 V48 M66 39 V50" stroke="${INK}" stroke-width="2"/>
      <path d="M24 66 Q50 76 76 66 L74 58 Q50 64 26 58 Z" fill="#fff" ${S}/>
      <path d="M36 61 V70 M50 63 V72 M64 61 V70" stroke="${INK}" stroke-width="2"/></svg>`;
  }
  const [x, y, r] = SPOT[part] ?? [50, 70, 10];
  // an arrow from the side pointing at the part
  const left = x < 50 || part === 'knee';
  const tipX = left ? x - r - 2 : x + r + 2;
  const tailX = left ? tipX - 20 : tipX + 20;
  const dir = left ? 1 : -1;
  return `<svg class="drawing" viewBox="0 0 100 140" role="img" aria-label="${part}">
    ${child}
    <circle cx="${x}" cy="${y}" r="${r}" fill="rgba(255,214,10,.4)" stroke="#ef476f" stroke-width="4.5" stroke-dasharray="6 3"/>
    <path d="M${tailX} ${y - 12} L${tipX} ${y}" stroke="#ef476f" stroke-width="5" stroke-linecap="round"/>
    <path d="M${tipX} ${y} l${-8 * dir} -1 l${4 * dir} -7 Z" fill="#ef476f" stroke="#ef476f" stroke-width="2" stroke-linejoin="round"/>
  </svg>`;
}

// Little pieces for the "where is it?" pictures (Movers prepositions).
const cat = (x: number, y: number, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})">
  <path d="M10 2 Q22 0 20 14 Q12 18 0 14 Q-2 4 10 2 Z" fill="#ff9f1c" ${S}/>
  <path d="M18 8 Q28 4 26 -4" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M-8 -6 L-9 -16 L-3 -10 M3 -10 L8 -16 L8 -6" fill="#ff9f1c" ${S}/>
  <circle cx="0" cy="-3" r="9" fill="#ff9f1c" ${S}/>
  <circle cx="-3.5" cy="-4" r="1.4" fill="${INK}"/><circle cx="3.5" cy="-4" r="1.4" fill="${INK}"/><path d="M-2 0 Q0 2 2 0" stroke="${INK}" stroke-width="1.5" fill="none"/></g>`;
const box = (front = true) => `<path d="M24 56 L76 56 L76 90 L24 90 Z" fill="#c9a26b" ${S}/>${front ? `<path d="M24 56 L14 44 M76 56 L86 44" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` : ''}<path d="M24 70 H76" stroke="${INK}" stroke-width="2" opacity=".25"/>`;
const house = (x: number, y: number, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})"><rect x="-18" y="0" width="36" height="28" fill="#f1f3f8" ${S}/><path d="M-24 2 L0 -20 L24 2 Z" fill="#e2553f" ${S}/><rect x="-5" y="12" width="10" height="16" fill="#8d5a2b" ${S}/></g>`;
const tree = (x: number, y: number, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})"><rect x="-4" y="6" width="8" height="22" fill="#8d5a2b" ${S}/><circle cx="0" cy="-4" r="16" fill="#52b788" ${S}/></g>`;
const bird = (x: number, y: number) => `<g transform="translate(${x} ${y})"><ellipse cx="0" cy="0" rx="10" ry="7" fill="#4cc9f0" ${S}/><path d="M-2 -2 L-12 -12 L4 -5 Z" fill="#90e0ef" ${S}/><path d="M9 -1 L15 1 L9 3 Z" fill="#ffd166" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/><circle cx="4" cy="-2" r="1.3" fill="${INK}"/></g>`;
const ground = `<path d="M4 90 H96" stroke="#8ed16f" stroke-width="5" stroke-linecap="round"/>`;

const ICON_SVG: Record<string, string> = {
  above: `${ground}${house(50, 60, 1.1)}${bird(50, 16)}<path d="M50 28 V34" stroke="#ef476f" stroke-width="3" stroke-dasharray="3 3"/>`,
  below: `${ground}<rect x="14" y="40" width="72" height="8" rx="2" fill="#bc8a5f" ${S}/><path d="M20 48 V90 M80 48 V90" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>${cat(46, 76)}`,
  near: `${ground}${tree(36, 58, 1.3)}${cat(66, 76)}`,
  opposite: `<rect x="4" y="42" width="92" height="20" fill="#adb5bd" ${S}/><path d="M10 52 H90" stroke="#fff" stroke-width="3" stroke-dasharray="7 6"/>${house(50, 18, 0.8)}${tree(50, 76, 0.75)}<path d="M50 40 V64" stroke="#ef476f" stroke-width="2.5" stroke-dasharray="3 3" opacity=".8"/>`,
  inside: `${ground}<path d="M30 56 L30 40 L70 40 L70 56" fill="#a47148" ${S}/>${cat(48, 54, 1.1)}${box()}`,
  outside: `${ground}<g transform="translate(-4 13) scale(.85)">${box()}<path d="M24 56 L76 56" stroke="${INK}" stroke-width="3"/></g>${cat(78, 78, 0.78)}`,
  stairs: `<path d="M10 90 H30 V72 H48 V54 H66 V36 H84 V18 H92 V90 Z" fill="#c9a26b" ${S}/><path d="M30 90 V72 M48 90 V54 M66 90 V36 M84 90 V18" stroke="${INK}" stroke-width="2" opacity=".35"/>`,
  roof: `<rect x="22" y="48" width="56" height="42" fill="#f1f3f8" ${S}/><rect x="44" y="64" width="12" height="26" fill="#8d5a2b" ${S}/><path d="M10 52 L50 14 L90 52 Z" fill="#e2553f" ${S}/><path d="M24 40 H76" stroke="${INK}" stroke-width="2" opacity=".4"/>`,
  towel: `<path d="M12 18 H88" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><rect x="24" y="18" width="52" height="66" rx="4" fill="#4cc9f0" ${S}/><path d="M24 68 H76 M24 74 H76" stroke="#fff" stroke-width="3"/>`,
  blanket: `<rect x="12" y="30" width="76" height="46" rx="8" fill="#ffafcc" ${S}/><path d="M12 45 H88 M12 60 H88 M31 30 V76 M50 30 V76 M69 30 V76" stroke="#ef476f" stroke-width="2" opacity=".6"/><path d="M12 64 Q30 84 50 70 Q70 84 88 64 L88 76 Q88 84 80 84 H20 Q12 84 12 76 Z" fill="#ff8fab" ${S}/>`,
  toothbrush: `<g transform="rotate(-22 50 55)"><rect x="6" y="56" width="62" height="11" rx="5" fill="#4cc9f0" ${S}/><rect x="60" y="48" width="32" height="12" rx="3" fill="#fff" ${S}/><path d="M65 47 V34 M71 47 V34 M77 47 V34 M83 47 V34 M89 47 V34" stroke="#90e0ef" stroke-width="4" stroke-linecap="round"/></g>`,
  toothpaste: `<path d="M14 40 H70 L84 46 V56 L70 62 H14 Q8 62 8 51 Q8 40 14 40 Z" fill="#fff" ${S}/><rect x="84" y="44" width="10" height="14" rx="2" fill="#ef476f" ${S}/><path d="M22 46 H56" stroke="#4cc9f0" stroke-width="5" stroke-linecap="round"/><path d="M8 51 Q2 40 10 32" stroke="#4cc9f0" stroke-width="6" fill="none" stroke-linecap="round"/>`,
  river: `<rect x="6" y="10" width="88" height="80" rx="10" fill="#8ed16f" ${S}/><path d="M6 60 Q30 40 50 52 Q70 64 94 40 V58 Q70 82 50 70 Q30 58 6 78 Z" fill="#4cc9f0" ${S}/><path d="M24 62 Q30 58 36 60 M62 64 Q68 62 74 58" stroke="#fff" stroke-width="2.5" fill="none"/>`,
  lake: `<rect x="6" y="10" width="88" height="80" rx="10" fill="#8ed16f" ${S}/><ellipse cx="54" cy="62" rx="32" ry="18" fill="#4cc9f0" ${S}/><path d="M42 60 Q48 56 54 60 M58 68 Q64 64 70 68" stroke="#fff" stroke-width="2.5" fill="none"/><path d="M18 50 L24 26 L30 50 Z" fill="#2d6a4f" ${S}/><rect x="22" y="50" width="4" height="8" fill="#8d5a2b"/>`,
  waterfall: `<path d="M6 90 V30 Q6 14 22 14 H40 V90 Z" fill="#8d99ae" ${S}/><path d="M60 90 V24 Q60 14 74 14 H94 V90 Z" fill="#8d99ae" ${S}/><rect x="40" y="14" width="20" height="62" fill="#4cc9f0" ${S}/><path d="M45 18 V72 M50 18 V72 M55 18 V72" stroke="#fff" stroke-width="2"/><ellipse cx="50" cy="82" rx="26" ry="8" fill="#4cc9f0" ${S}/>`,
  rock: `<path d="M12 78 L22 44 L44 28 L70 34 L88 58 L84 80 Z" fill="#9aa0a6" ${S}/><path d="M44 28 L50 56 L88 58 M22 44 L50 56 L40 80" stroke="${INK}" stroke-width="2" fill="none" opacity=".35"/>`,
};

export function iconSVG(name: string): string {
  return `<svg class="drawing" viewBox="0 0 100 100" role="img" aria-label="${name}">${ICON_SVG[name] ?? ''}</svg>`;
}

/** A small family tree; the person (or people) to learn is circled, "me" has a star. */
export const FAMILY = ['aunt', 'uncle', 'cousin', 'parents', 'grandparents'] as const;
export function familySVG(who: string): string {
  const T = `stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"`;
  const person = (x: number, y: number, shirt: string, hair: string, long = false, grey = false) => `
    <path d="M${x - 9} ${y + 20} Q${x - 9} ${y + 8} ${x} ${y + 8} Q${x + 9} ${y + 8} ${x + 9} ${y + 20} Z" fill="${shirt}" ${T}/>
    ${long ? `<path d="M${x - 8} ${y + 7} Q${x - 9.5} ${y - 8} ${x} ${y - 8} Q${x + 9.5} ${y - 8} ${x + 8} ${y + 7} Z" fill="${hair}" ${T}/>` : ''}
    <circle cx="${x}" cy="${y}" r="7" fill="#f6c89f" ${T}/>
    <circle cx="${x - 2.4}" cy="${y}" r="0.9" fill="${INK}"/><circle cx="${x + 2.4}" cy="${y}" r="0.9" fill="${INK}"/>
    ${long ? `<path d="M${x - 7} ${y - 2} Q${x} ${y - 9} ${x + 7} ${y - 2}" fill="${hair}" ${T}/>` : `<path d="M${x - 7} ${y - 1.5} Q${x} ${y - 10.5} ${x + 7} ${y - 1.5}" fill="${grey ? '#e3e6ee' : hair}" ${T}/>`}`;
  const P: Record<string, [number, number]> = { grandpa: [48, 14], grandma: [72, 14], dad: [18, 52], mum: [42, 52], aunt: [78, 52], uncle: [102, 52], me: [30, 90], cousin: [90, 90] };
  const ring: Record<string, string> = {
    aunt: `<circle cx="78" cy="60" r="15"/>`, uncle: `<circle cx="102" cy="60" r="15"/>`, cousin: `<circle cx="90" cy="98" r="15"/>`,
    parents: `<ellipse cx="30" cy="60" rx="27" ry="16"/>`, grandparents: `<ellipse cx="60" cy="22" rx="27" ry="16"/>`,
  };
  return `<svg class="drawing" viewBox="0 0 120 118" role="img" aria-label="${who}">
    <path d="M60 30 V40 M42 40 H78 M42 40 V44 M78 40 V44 M30 62 V82 M18 66 H42 M90 62 V82 M78 66 H102" stroke="#8d99ae" stroke-width="2.5" fill="none"/>
    ${person(...P.grandpa, '#8d99ae', '', false, true)}${person(...P.grandma, '#c77dff', '#e3e6ee', true)}
    ${person(...P.dad, '#4361ee', '#8d5a2b')}${person(...P.mum, '#ef476f', '#a0522d', true)}
    ${person(...P.aunt, '#ff9f1c', '#f4c95d', true)}${person(...P.uncle, '#2a9d8f', '#5c4033')}
    ${person(...P.me, '#ffd166', '#8d5a2b')}${person(...P.cousin, '#90be6d', '#f4c95d', true)}
    <text x="30" y="117" font-size="9" font-weight="800" text-anchor="middle" fill="${INK}">me ⭐</text>
    <g fill="rgba(255,214,10,.3)" stroke="#ef476f" stroke-width="3" stroke-dasharray="5 3">${ring[who] ?? ''}</g>
  </svg>`;
}
