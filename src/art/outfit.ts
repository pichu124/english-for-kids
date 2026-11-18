/**
 * Bix's wardrobe: hats, neck things, things to hold, body colours.
 * Each item unlocks after a number of finished lessons — a reward that grows
 * with the child, with English names Bix says out loud ("A red cap!").
 */
const INK = '#1d2440';
const S = `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`;

export type Slot = 'hat' | 'neck' | 'hand' | 'color';
export type Item = { id: string; slot: Slot; name: string; icon: string; at: number; svg?: string; colors?: [string, string, string] };

const box = (x: number, y: number, w: number, hg: number, d: number, f: string, t: string, sd: string) =>
  `<polygon points="${x},${y} ${x + d},${y - d} ${x + w + d},${y - d} ${x + w},${y}" fill="${t}" ${S}/>` +
  `<polygon points="${x + w},${y} ${x + w + d},${y - d} ${x + w + d},${y + hg - d} ${x + w},${y + hg}" fill="${sd}" ${S}/>` +
  `<rect x="${x}" y="${y}" width="${w}" height="${hg}" fill="${f}" ${S}/>`;

const star = (cx: number, cy: number, r: number, fill: string) => {
  const p: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    p.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${p.join(' ')}" fill="${fill}" ${S}/>`;
};

export const ITEMS: Item[] = [
  { id: 'cap', slot: 'hat', name: 'a blue cap', icon: '🧢', at: 1,
    svg: `<path d="M42 54 Q42 12 100 12 Q158 12 158 54 Z" fill="#3a86ff" ${S}/><path d="M100 12 V54 M70 18 Q62 34 64 54 M130 18 Q138 34 136 54" stroke="#2563c9" stroke-width="3" fill="none"/><rect x="14" y="46" width="90" height="12" rx="5" fill="#2563c9" ${S}/><circle cx="100" cy="11" r="6" fill="#2563c9" ${S}/>` },
  { id: 'red', slot: 'color', name: 'red', icon: '🟥', at: 2, colors: ['#ef476f', '#ff8fab', '#c9184a'] },
  { id: 'bowtie', slot: 'neck', name: 'a bow tie', icon: '🎀', at: 3,
    svg: `<polygon points="96,170 72,158 72,182" fill="#ef476f" ${S}/><polygon points="96,170 120,158 120,182" fill="#ef476f" ${S}/><rect x="89" y="163" width="14" height="14" rx="3" fill="#c9184a" ${S}/>` },
  { id: 'balloon', slot: 'hand', name: 'a balloon', icon: '🎈', at: 4,
    svg: `<path d="M152 228 C 168 200, 160 170, 180 132" fill="none" stroke="${INK}" stroke-width="2"/><ellipse cx="182" cy="104" rx="20" ry="26" fill="#4cc9f0" ${S}/><ellipse cx="175" cy="94" rx="5" ry="8" fill="#fff" opacity=".7"/><polygon points="178,130 186,130 182,124" fill="#4cc9f0" ${S}/>` },
  { id: 'party', slot: 'hat', name: 'a party hat', icon: '🥳', at: 5,
    svg: `<polygon points="66,48 134,48 100,-4" fill="#ffd166" ${S}/><path d="M78 30 L122 30 M86 16 L114 16" stroke="#ef476f" stroke-width="7"/><polygon points="66,48 134,48 100,-4" fill="none" ${S}/><circle cx="100" cy="-6" r="9" fill="#ef476f" ${S}/>` },
  { id: 'green', slot: 'color', name: 'green', icon: '🟩', at: 6, colors: ['#6cc04a', '#a6e07f', '#4a9a2e'] },
  { id: 'scarf', slot: 'neck', name: 'a scarf', icon: '🧣', at: 8,
    svg: `<rect x="52" y="156" width="90" height="16" rx="6" fill="#06d6a0" ${S}/><path d="M64 156 v16 M80 156 v16 M96 156 v16 M112 156 v16 M128 156 v16" stroke="#04a77c" stroke-width="5"/><rect x="112" y="166" width="16" height="40" rx="4" fill="#06d6a0" ${S}/>` },
  { id: 'flag', slot: 'hand', name: 'a flag', icon: '🚩', at: 10,
    svg: `<rect x="150" y="128" width="6" height="108" fill="#8d5a2b" ${S}/><polygon points="156,130 196,142 156,156" fill="#ef476f" ${S}/>${star(170, 143, 6, '#ffd166')}` },
  { id: 'crown', slot: 'hat', name: 'a crown', icon: '👑', at: 12,
    svg: `<polygon points="46,52 46,18 66,36 84,8 100,32 116,8 134,36 154,18 154,52" fill="#ffd166" ${S}/><circle cx="84" cy="44" r="5" fill="#ef476f" ${S}/><circle cx="116" cy="44" r="5" fill="#4cc9f0" ${S}/><circle cx="100" cy="42" r="5" fill="#06d6a0" ${S}/>` },
  { id: 'pink', slot: 'color', name: 'pink', icon: '🩷', at: 14, colors: ['#ff8fc7', '#ffc2e0', '#e0609f'] },
  { id: 'medal', slot: 'neck', name: 'a gold medal', icon: '🥇', at: 16,
    svg: `<polygon points="74,158 88,158 100,196 92,198" fill="#4361ee" ${S}/><polygon points="118,158 104,158 92,196 100,198" fill="#ef476f" ${S}/><circle cx="96" cy="206" r="15" fill="#ffd166" ${S}/>${star(96, 206, 8, '#f4a300')}` },
  { id: 'bow', slot: 'hat', name: 'a pink bow', icon: '🎀', at: 18,
    svg: `<polygon points="132,38 104,20 106,58" fill="#ff8fab" ${S}/><polygon points="132,38 162,18 160,58" fill="#ff8fab" ${S}/><rect x="124" y="30" width="16" height="16" rx="4" fill="#ef476f" ${S}/>` },
  { id: 'wand', slot: 'hand', name: 'a magic wand', icon: '🪄', at: 20,
    svg: `<rect x="150" y="160" width="6" height="74" rx="2" fill="${INK}" transform="rotate(20 153 234)"/>${star(180, 158, 18, '#ffd166')}<circle cx="196" cy="136" r="3" fill="#ffd166"/><circle cx="166" cy="134" r="2.5" fill="#ffd166"/>` },
  { id: 'blue', slot: 'color', name: 'blue', icon: '🟦', at: 23, colors: ['#4cc9f0', '#a0e4f8', '#2a9ac4'] },
  { id: 'wizard', slot: 'hat', name: 'a wizard hat', icon: '🧙', at: 26,
    svg: `<ellipse cx="100" cy="50" rx="66" ry="12" fill="#5a4bd6" ${S}/><path d="M64 48 L104 -6 Q114 -10 120 0 L112 4 L136 48 Z" fill="#7b6cf6" ${S}/>${star(96, 26, 8, '#ffd166')}${star(118, 38, 5, '#ffd166')}` },
  { id: 'purple', slot: 'color', name: 'purple', icon: '🟪', at: 30, colors: ['#9b5de5', '#c39bf2', '#7438c4'] },
];

export const SLOTS: Slot[] = ['hat', 'neck', 'hand', 'color'];
export type Outfit = Partial<Record<Slot, string>>;
export const itemById = (id?: string) => ITEMS.find((i) => i.id === id);
export const unlockedItems = (lessons: number) => ITEMS.filter((i) => lessons >= i.at);

const VIEW: Record<Slot, string> = { hat: '10 -22 180 92', neck: '44 146 112 76', hand: '130 70 80 170', color: '40 136 120 108' };

/** A small picture of the item itself, for the wardrobe shelves. */
export function thumbSVG(it: Item): string {
  const body =
    it.slot === 'color'
      ? box(54, 160, 84, 72, 12, ...(it.colors ?? ['#ffb703', '#ffd166', '#df9500']))
      : (it.svg ?? '');
  return `<svg class="ward-thumb" viewBox="${VIEW[it.slot]}" aria-hidden="true"><g>${body}</g></svg>`;
}

/** Once on screen, zoom each thumbnail to its drawing so every item looks the same size. */
export function fitThumbs(root: ParentNode): void {
  root.querySelectorAll<SVGSVGElement>('svg.ward-thumb').forEach((svg) => {
    const g = svg.querySelector('g');
    if (!g) return;
    try {
      const b = g.getBBox();
      if (!b.width) return;
      const size = Math.max(b.width, b.height) + 10;
      svg.setAttribute('viewBox', `${b.x + b.width / 2 - size / 2} ${b.y + b.height / 2 - size / 2} ${size} ${size}`);
    } catch {
      /* not rendered yet — keep the default view */
    }
  });
}
