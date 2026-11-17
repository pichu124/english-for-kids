import { shade } from './color';

/** Isometric voxel cube as an SVG string. */
export function isoCube(color: string, opts: { label?: string; cls?: string } = {}): string {
  const top = shade(color, 0.3);
  const right = shade(color, -0.22);
  const edge = shade(color, -0.45);
  return `<svg class="iso-cube ${opts.cls ?? ''}" viewBox="0 0 100 100" aria-hidden="true">
    <polygon points="50,6 94,28 50,50 6,28" fill="${top}" stroke="${edge}" stroke-width="2.5" stroke-linejoin="round"/>
    <polygon points="6,28 50,50 50,96 6,74" fill="${color}" stroke="${edge}" stroke-width="2.5" stroke-linejoin="round"/>
    <polygon points="50,50 94,28 94,74 50,96" fill="${right}" stroke="${edge}" stroke-width="2.5" stroke-linejoin="round"/>
    <polygon points="16,30 50,13 58,17 24,34" fill="#fff" opacity=".35"/>
  </svg>`;
}

/** A small floating voxel island (grass on dirt) used on the home map. */
export function islandSVG(grass: string): string {
  const cube = (x: number, y: number, top: string, left: string, right: string) => `
    <g transform="translate(${x},${y})">
      <polygon points="30,0 60,15 30,30 0,15" fill="${top}"/>
      <polygon points="0,15 30,30 30,58 0,43" fill="${left}"/>
      <polygon points="30,30 60,15 60,43 30,58" fill="${right}"/>
    </g>`;
  const g = grass;
  const gl = shade(grass, -0.12);
  const gr = shade(grass, -0.3);
  const dt = '#c98b52';
  const dl = '#a86a37';
  const dr = '#8a5428';
  return `<svg class="island-svg" viewBox="0 0 180 150" aria-hidden="true">
    ${cube(60, 84, dt, dl, dr)}
    ${cube(30, 54, g, dl, dr)}${cube(90, 54, g, dl, dr)}
    ${cube(60, 69, g, dl, dr)}
    ${cube(0, 39, g, gl, gr)}${cube(120, 39, g, gl, gr)}
    ${cube(30, 24, g, gl, gr)}${cube(90, 24, g, gl, gr)}
    ${cube(60, 9, g, gl, gr)}
  </svg>`;
}
