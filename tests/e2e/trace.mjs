// ✏️ Write: every letter, small and big, can be traced stroke by stroke with a finger.
// Run: node tests/e2e/trace.mjs [baseUrl] [screenshotDir]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = (process.argv[2] || 'http://localhost:4173/').replace(/\/$/, '');
const shots = process.argv[3];
const step = (m) => console.log('✓', m);
const fail = (m) => { throw new Error(m); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(readFileSync(new URL('./fakes.js', import.meta.url), 'utf8'));
await page.addInitScript(() => {
  if (!localStorage.getItem('efk.v1')) localStorage.setItem('efk.v1', JSON.stringify({ childName: 'Shin', settings: { dailyLimitMin: 0, rate: 0.8, level: 'L2' }, topics: {}, words: {}, blocks: { inventory: {}, placed: [], totalEarned: 0 }, days: {}, bonus: {}, review: {} }));
});

/** Points of stroke k on the screen, from start to end. */
const strokePoints = (k, n = 30) =>
  page.evaluate(
    ([k, n]) => {
      const path = document.querySelectorAll('.tr-ink')[k];
      const m = path.ownerSVGElement.getScreenCTM();
      const len = path.getTotalLength();
      return Array.from({ length: n + 1 }, (_, i) => {
        const q = path.getPointAtLength((len * i) / n);
        const s = new DOMPoint(q.x, q.y).matrixTransform(m);
        return [s.x, s.y];
      });
    },
    [k, n],
  );
async function trace() {
  const n = await page.locator('.tr-ink').count();
  for (let k = 0; k < n; k++) {
    const pts = await strokePoints(k);
    await page.mouse.move(pts[0][0], pts[0][1]);
    await page.mouse.down();
    for (const [x, y] of pts) await page.mouse.move(x, y, { steps: 2 });
    await page.mouse.up();
  }
  const ok = await page.waitForSelector('.tr-board.is-done', { timeout: 2000 }).then(() => true, () => false);
  if (!ok) fail(`${await page.locator('.tr-board').getAttribute('aria-label')}: did not finish`);
}

await page.goto(base);
await page.locator('.btn-play').click({ force: true });
await page.waitForSelector('.home');
await page.locator('.dock-btn[aria-label="ABC"]').click({ force: true });
await page.locator('.abc-write-btn').click({ force: true });
await page.waitForSelector('.tr-board[aria-label="Write a"]');
await page.waitForFunction(() => window.__spoken.some((t) => /green dot/.test(t)), null, { timeout: 3000 }).catch(() => fail('Bix explains where to start'));

// scribbling away from the letter, or starting at the wrong end, does nothing
const toScreen = (x, y) => page.evaluate(([x, y]) => { const s = new DOMPoint(x, y).matrixTransform(document.querySelector('.tr-board').getScreenCTM()); return [s.x, s.y]; }, [x, y]);
for (const y of [20, 108]) {
  // across the empty top and bottom of the board
  const [x0, y0] = await toScreen(5, y);
  const [x1, y1] = await toScreen(95, y);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x1, y1, { steps: 10 });
  await page.mouse.up();
}
const back = (await strokePoints(0)).reverse(); // the round part of "a", the wrong way round
await page.mouse.move(back[0][0], back[0][1]);
await page.mouse.down();
for (const [x, y] of back) await page.mouse.move(x, y, { steps: 2 });
await page.mouse.up();
// at most a tiny start (the finger was at the green dot), never the stroke
const filled = await page.evaluate(() => [...document.querySelectorAll('.tr-ink')].map((p) => (p.style.visibility === 'visible' ? parseFloat(p.style.strokeDasharray) / p.getTotalLength() : 0)));
if (filled.some((f) => f > 0.15)) fail('nothing fills in for a scribble or the wrong way round: ' + filled);
if (await page.evaluate(() => window.__spoken.some((t) => /wrong|no!/i.test(t)))) fail('never "wrong"');
step('a scribble or the wrong end fills nothing in, and nothing is called wrong');

// lifting the finger halfway keeps what was done
const half = (await strokePoints(0)).slice(0, 14);
await page.mouse.move(half[0][0], half[0][1]);
await page.mouse.down();
for (const [x, y] of half) await page.mouse.move(x, y, { steps: 2 });
await page.mouse.up();
const kept = await page.evaluate(() => parseFloat(document.querySelector('.tr-ink').style.strokeDasharray));
if (!(kept > 25)) fail('half a stroke stays filled in: ' + kept);
step('lifting the finger halfway keeps the part already written');

for (const upper of [false, true]) {
  for (let i = 0; i < 26; i++) {
    const ch = String.fromCharCode(97 + i);
    const want = upper ? ch.toUpperCase() : ch;
    await page.waitForSelector(`.tr-board[aria-label="Write ${want}"]`);
    await trace();
    if (shots) await page.locator('.tr-paper').screenshot({ path: `${shots}/trace-${upper ? 'up' : 'low'}-${ch}.png` });
    await page.locator('.tr-next').click({ force: true });
  }
  if (!upper) {
    await page.waitForSelector('.tr-board[aria-label="Write a"]');
    await page.locator('.tr-case').click({ force: true });
  }
}
const st = await page.evaluate(() => JSON.parse(localStorage.getItem('efk.v1')));
if (Object.keys(st.traced ?? {}).length !== 52) fail('all 52 letters saved: ' + Object.keys(st.traced ?? {}).length);
step('all 26 small and 26 big letters trace stroke by stroke to the end');

// from the ABC board: tap a letter, then ✏️ writes that letter; the board's Write starts at the first not yet written
await page.locator('.book-top [aria-label="ABC"]').click();
await page.locator('.abc-tile[data-letter="K"]').click();
await page.locator('.abc-write').click();
await page.waitForSelector('.tr-board[aria-label="Write k"]');
step('ABC board → letter → ✏️ opens that letter');
if (errors.length) fail('page errors: ' + errors.join(' | '));
await browser.close();
console.log('trace e2e ok');
