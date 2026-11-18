/**
 * Little scenes for position words (in, on, under, next to, behind, in front of):
 * a voxel box (or a table, for "under") and a red ball placed accordingly.
 */
export const SCENES = ['in', 'on', 'under', 'next to', 'behind', 'in front of'] as const;
export type Scene = (typeof SCENES)[number];

const INK = '#1d2440';
const ball = (cx: number, cy: number, r: number) => `
  <g class="scene-ball">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#ef476f" stroke="${INK}" stroke-width="3"/>
    <circle cx="${cx - r * 0.35}" cy="${cy - r * 0.35}" r="${r * 0.28}" fill="#fff" opacity=".7"/>
  </g>`;
// box: front face at (x,y,w,h), depth d up-right
const box = (x: number, y: number, w: number, h: number, d: number, open = false) => `
  <g>
    <polygon points="${x},${y} ${x + d},${y - d} ${x + w + d},${y - d} ${x + w},${y}" fill="${open ? '#7a4a1f' : '#e0a458'}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <polygon points="${x + w},${y} ${x + w + d},${y - d} ${x + w + d},${y + h - d} ${x + w},${y + h}" fill="#a86a37" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#c98b52" stroke="${INK}" stroke-width="3"/>
  </g>`;
const floor = `<rect x="0" y="92" width="140" height="8" fill="#8fd46b"/>`;

export function sceneSVG(scene: string): string {
  let body = '';
  switch (scene) {
    case 'in':
      // open box, ball sitting inside (top half visible above the front edge)
      body = `${box(40, 50, 50, 42, 14, true)}${ball(72, 46, 13)}<rect x="40" y="50" width="50" height="42" fill="#c98b52" stroke="${INK}" stroke-width="3"/>`;
      break;
    case 'on':
      body = `${box(40, 52, 50, 40, 14)}${ball(72, 30, 13)}`;
      break;
    case 'under':
      body = `
        <rect x="22" y="40" width="96" height="10" rx="2" fill="#c98b52" stroke="${INK}" stroke-width="3"/>
        <rect x="28" y="50" width="8" height="42" fill="#a86a37" stroke="${INK}" stroke-width="3"/>
        <rect x="104" y="50" width="8" height="42" fill="#a86a37" stroke="${INK}" stroke-width="3"/>
        ${ball(70, 78, 13)}`;
      break;
    case 'next to':
      body = `${box(22, 52, 50, 40, 14)}${ball(108, 79, 13)}`;
      break;
    case 'behind':
      // ball on the floor behind the box, its left half hidden by the box side
      body = `${ball(104, 70, 14)}${box(36, 52, 50, 40, 14)}`;
      break;
    case 'in front of':
      body = `${box(40, 44, 50, 40, 14)}${ball(66, 80, 15)}`;
      break;
    default:
      body = ball(70, 60, 14);
  }
  return `<svg class="scene-svg" viewBox="0 0 140 100" aria-hidden="true">${floor}${body}</svg>`;
}
