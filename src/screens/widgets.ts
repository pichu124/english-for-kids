import { h } from '../lib/dom';
import { sfx } from '../lib/sfx';
import type { Ctx } from '../router';

export function homeButton(ctx: Ctx, onLeave?: () => void): HTMLElement {
  return h(
    'button',
    {
      class: 'btn btn-round btn-home',
      'aria-label': 'Home',
      onclick: () => {
        sfx.tap();
        onLeave?.();
        ctx.go('home');
      },
    },
    h('span', { class: 'icon-home', 'aria-hidden': 'true' }),
  );
}

/** Small, deliberately unexciting button into the parent area. */
export function parentButton(ctx: Ctx): HTMLElement {
  return h(
    'button',
    { class: 'btn-parent', 'aria-label': 'Khu bố mẹ', onclick: () => ctx.go('parent') },
    '🔒 Bố mẹ',
  );
}

/** Bursts of little squares for celebrations (skipped with reduced motion). */
export function confetti(host: HTMLElement, n = 24): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff924c'];
  const layer = h('div', { class: 'confetti', 'aria-hidden': 'true' });
  for (let i = 0; i < n; i++) {
    const p = h('i');
    p.style.setProperty('--x', `${(Math.random() - 0.5) * 120}vmin`);
    p.style.setProperty('--y', `${-20 - Math.random() * 50}vmin`);
    p.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = `${Math.random() * 0.15}s`;
    layer.appendChild(p);
  }
  host.appendChild(layer);
  setTimeout(() => layer.remove(), 1600);
}
