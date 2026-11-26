/**
 * Children for "Who Is Who?" (Cambridge "listen and draw lines"): each has a name,
 * a T-shirt colour and something they are doing, all different, so one sentence
 * picks out exactly one child.
 */
import { shuffle } from '../lib/dom';

export const PAINTS = [
  { name: 'red', c: '#ef476f' },
  { name: 'blue', c: '#4cc9f0' },
  { name: 'green', c: '#06d6a0' },
  { name: 'yellow', c: '#ffd166' },
  { name: 'purple', c: '#9b5de5' },
];

const BOYS = ['Tom', 'Sam', 'Ben', 'Nick', 'Dan'];
const GIRLS = ['Anna', 'Lucy', 'May', 'Grace', 'Kim'];
const DOING = [
  { emoji: '📖', says: 'reading a book' },
  { emoji: '⚽', says: 'playing football' },
  { emoji: '🎸', says: 'playing the guitar' },
  { emoji: '🍦', says: 'eating an ice cream' },
  { emoji: '🎈', says: 'holding a balloon' },
  { emoji: '🍎', says: 'eating an apple' },
  { emoji: '📷', says: 'taking a photo' },
];
const HAIR = ['#8d5a2b', '#f4c95d', '#1d2440', '#a0522d', '#5c4033'];

export type Kid = { name: string; girl: boolean; shirt: (typeof PAINTS)[number]; hair: string; doing: (typeof DOING)[number] };

export function kidSVG(k: Kid): string {
  const ink = 'stroke="#1d2440" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"';
  return `<svg class="kid-svg" viewBox="0 0 78 112" aria-hidden="true">
    ${k.girl ? `<path d="M20 30 Q18 6 35 6 Q52 6 50 30 L52 46 H18 Z" fill="${k.hair}" ${ink}/>` : ''}
    <path d="M22 84 V106 M48 84 V106" stroke="#1d2440" stroke-width="9" stroke-linecap="round"/>
    <path d="M22 84 V105 M48 84 V105" stroke="#577590" stroke-width="5" stroke-linecap="round"/>
    <path d="M16 86 Q14 50 35 48 Q56 50 54 86 Z" fill="${k.shirt.c}" ${ink}/>
    <path d="M18 56 L8 74 M52 56 L60 70" stroke="#1d2440" stroke-width="6" stroke-linecap="round"/>
    <path d="M18 56 L8 74 M52 56 L60 70" stroke="#f6c89f" stroke-width="3" stroke-linecap="round"/>
    <circle cx="35" cy="28" r="15" fill="#f6c89f" ${ink}/>
    <circle cx="30" cy="28" r="1.8" fill="#1d2440"/><circle cx="40" cy="28" r="1.8" fill="#1d2440"/>
    <path d="M30 34 Q35 38 40 34" stroke="#1d2440" stroke-width="2" fill="none" stroke-linecap="round"/>
    ${k.girl ? `<path d="M20 24 Q35 6 50 24 Q42 16 35 18 Q28 16 20 24 Z" fill="${k.hair}" ${ink}/>` : `<path d="M20 26 Q20 10 35 10 Q50 10 50 26 Q44 17 35 18 Q26 17 20 26 Z" fill="${k.hair}" ${ink}/>`}
    <text x="64" y="76" font-size="24" text-anchor="middle" dominant-baseline="middle">${k.doing.emoji}</text>
  </svg>`;
}

export function makeKids(): Kid[] {
  const shirts = shuffle(PAINTS);
  const doings = shuffle(DOING);
  const boys = shuffle(BOYS);
  const girls = shuffle(GIRLS);
  return shuffle([true, true, false, false, Math.random() < 0.5]).map((girl, i) => ({
    name: girl ? girls.pop()! : boys.pop()!,
    girl,
    shirt: shirts[i],
    hair: HAIR[i % HAIR.length],
    doing: doings[i],
  }));
}

/** "Find Tom. He's got a blue T-shirt and he's reading a book." (simple: colour only) */
export function describeKid(k: Kid, simple = false): string {
  const he = k.girl ? 'She' : 'He';
  return simple
    ? `Where is ${k.name}? ${he}'s got a ${k.shirt.name} T-shirt.`
    : `Find ${k.name}. ${he}'s got a ${k.shirt.name} T-shirt and ${he.toLowerCase()}'s ${k.doing.says}.`;
}
