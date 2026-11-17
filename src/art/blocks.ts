/**
 * Building blocks for "My World". A topic's JSON chooses a `style` from this
 * list plus a color, so new topics can bring new blocks without code changes.
 */
import { shade } from './color';

export const BLOCK_STYLES = ['grass', 'brick', 'rainbow', 'cake', 'window', 'wood', 'stone', 'gold', 'plain'] as const;
export type BlockStyle = (typeof BLOCK_STYLES)[number];

export type BlockDef = { type: string; name: string; style: BlockStyle; color: string };

function frame(color: string, inner: string): string {
  const edge = shade(color, -0.45);
  return `<svg class="block-svg" viewBox="0 0 64 64" aria-hidden="true">
    <rect x="1.5" y="1.5" width="61" height="61" rx="4" fill="${color}" stroke="${edge}" stroke-width="3"/>
    ${inner}
    <rect x="5" y="5" width="54" height="5" rx="2" fill="#fff" opacity=".35"/>
    <rect x="5" y="54" width="54" height="5" rx="2" fill="#000" opacity=".15"/>
  </svg>`;
}

export function blockSVG(style: BlockStyle | string, color: string): string {
  switch (style) {
    case 'grass':
      return frame('#b07a45', `
        <rect x="3" y="3" width="58" height="20" fill="${color}"/>
        <path d="M3 23 h8 v6 h8 v-6 h10 v8 h8 v-8 h12 v5 h12 v-5" fill="${color}"/>
        <rect x="14" y="40" width="6" height="6" fill="#8a5428"/><rect x="40" y="34" width="6" height="6" fill="#8a5428"/>`);
    case 'brick': {
      const m = shade(color, 0.45);
      return frame(color, `
        <g stroke="${m}" stroke-width="3">
          <line x1="3" y1="22" x2="61" y2="22"/><line x1="3" y1="42" x2="61" y2="42"/>
          <line x1="32" y1="3" x2="32" y2="22"/><line x1="18" y1="22" x2="18" y2="42"/>
          <line x1="46" y1="22" x2="46" y2="42"/><line x1="32" y1="42" x2="32" y2="61"/>
        </g>`);
    }
    case 'rainbow': {
      const bands = ['#ff595e', '#ff924c', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'];
      return frame('#ffffff', bands.map((c, i) => `<rect x="3" y="${3 + i * 9.7}" width="58" height="9.9" fill="${c}"/>`).join(''));
    }
    case 'cake':
      return frame('#f4c27a', `
        <rect x="3" y="3" width="58" height="18" fill="${color}"/>
        <path d="M3 21 q6 10 12 0 q6 10 12 0 q6 10 12 0 q6 10 12 0 q5 8 10 0" fill="${color}"/>
        <rect x="3" y="38" width="58" height="6" fill="#e07a5f"/>
        <rect x="14" y="8" width="5" height="4" fill="#fff"/><rect x="34" y="10" width="5" height="4" fill="#ffd166"/><rect x="48" y="7" width="5" height="4" fill="#06d6a0"/>`);
    case 'window':
      return frame(color, `
        <rect x="10" y="10" width="44" height="44" fill="#bde0fe" stroke="${shade(color, -0.35)}" stroke-width="3"/>
        <line x1="32" y1="10" x2="32" y2="54" stroke="${shade(color, -0.35)}" stroke-width="3"/>
        <line x1="10" y1="32" x2="54" y2="32" stroke="${shade(color, -0.35)}" stroke-width="3"/>
        <path d="M14 26 l10 -12 h4 l-10 12z" fill="#fff" opacity=".7"/>`);
    case 'wood': {
      const d = shade(color, -0.25);
      return frame(color, `
        <g stroke="${d}" stroke-width="2.5"><line x1="3" y1="17" x2="61" y2="17"/><line x1="3" y1="32" x2="61" y2="32"/><line x1="3" y1="47" x2="61" y2="47"/></g>
        <circle cx="20" cy="24" r="2" fill="${d}"/><circle cx="44" cy="39" r="2" fill="${d}"/>`);
    }
    case 'stone': {
      const d = shade(color, -0.2);
      return frame(color, `
        <rect x="9" y="12" width="14" height="10" fill="${d}"/><rect x="34" y="8" width="18" height="8" fill="${d}"/>
        <rect x="26" y="30" width="16" height="12" fill="${d}"/><rect x="8" y="42" width="10" height="9" fill="${d}"/><rect x="46" y="44" width="9" height="8" fill="${d}"/>`);
    }
    case 'gold':
      return frame(color, `
        <polygon points="32,10 38,25 54,25 41,35 46,51 32,41 18,51 23,35 10,25 26,25" fill="#fff8d6" stroke="${shade(color, -0.3)}" stroke-width="2"/>`);
    default:
      return frame(color, '');
  }
}
