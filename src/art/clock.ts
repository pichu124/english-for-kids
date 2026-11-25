/** A friendly analogue clock for "What time is it?" (Movers). "3:00", "7:30". */
const INK = '#1d2440';
export function clockSVG(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const minA = (m / 60) * 360;
  const hourA = ((h % 12) / 12) * 360 + (m / 60) * 30;
  const hand = (a: number, len: number, w: number, color: string) => {
    const r = (a - 90) * (Math.PI / 180);
    return `<line x1="50" y1="50" x2="${(50 + len * Math.cos(r)).toFixed(1)}" y2="${(50 + len * Math.sin(r)).toFixed(1)}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
  };
  let ticks = '';
  for (let i = 1; i <= 12; i++) {
    const r = ((i * 30 - 90) * Math.PI) / 180;
    ticks += `<text x="${(50 + 34 * Math.cos(r)).toFixed(1)}" y="${(50 + 34 * Math.sin(r) + 4).toFixed(1)}" font-size="11" font-weight="800" text-anchor="middle" fill="${INK}">${i}</text>`;
  }
  return `<svg class="clock-svg" viewBox="0 0 100 100" role="img" aria-label="${time}">
    <circle cx="50" cy="50" r="46" fill="#fff" stroke="${INK}" stroke-width="5"/>
    <circle cx="50" cy="50" r="40" fill="#fff6d6"/>
    ${ticks}
    ${hand(hourA, 20, 6, INK)}
    ${hand(minA, 30, 4, '#e2553f')}
    <circle cx="50" cy="50" r="4" fill="${INK}"/>
  </svg>`;
}
