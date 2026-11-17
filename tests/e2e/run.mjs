/**
 * Smoke test: plays through the app with fake speech.
 *   npm run build && npm run preview   (in another terminal)
 *   node tests/e2e/run.mjs [baseUrl] [screenshotDir]
 */
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const base = process.argv[2] || 'http://localhost:4173/';
const shots = process.argv[3] || '';
if (shots) mkdirSync(shots, { recursive: true });
const fakes = readFileSync(new URL('./fakes.js', import.meta.url), 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.addInitScript(fakes);

const snap = async (name, settle = 500) => {
  if (!shots) return;
  await page.waitForTimeout(settle);
  await page.screenshot({ path: `${shots}/${name}.png` });
};
const tap = (sel) => page.locator(sel).first().click({ force: true });
const step = (msg) => console.log('✓', msg);

await page.goto(base);
await tap('.btn-play');
await page.waitForSelector('.home');
await snap('01-home');
step('home');

export async function playLesson(topicIndex, voice = 'match') {
  await page.evaluate((v) => (window.__voice = v), voice);
  await page.locator('.island').nth(topicIndex).click({ force: true });
  await page.waitForSelector('.listen');
  // Listen: press Next for each word
  let n = 0;
  while (await page.locator('.listen').count()) {
    const next = page.locator('.btn-next:not([hidden])');
    await next.waitFor({ timeout: 5000 }).catch(() => {});
    if (!(await page.locator('.listen').count())) break;
    if (n === 0) await snap('02-listen');
    await next.click({ force: true });
    n++;
    await page.waitForTimeout(80);
  }
  step(`listen (${n} words)`);
  // Speak
  await page.waitForSelector('.speak');
  let k = 0;
  while (await page.locator('.speak').count()) {
    const ok = page.locator('.pbtn-ok');
    if (await ok.count()) { if (k === 1) await snap('03b-parent-bar'); await ok.click({ force: true }); }
    else if (await page.locator('.btn-mic.is-ready').count()) { if (k === 0) await snap('03-speak'); await tap('.btn-mic'); k++; }
    await page.waitForTimeout(100);
    if (k > 40) throw new Error('speak step stuck');
  }
  step(`speak (${k} mic taps, voice=${voice})`);
  // Play
  await page.waitForSelector('.play');
  await snap('04-play');
  let rounds = 0;
  while (await page.locator('.play').count()) {
    const spoken = await page.evaluate(() => window.__spoken.at(-1) || '');
    const cards = page.locator('.word-card-play:not(.is-faded)');
    const count = await cards.count();
    let tapped = false;
    for (let i = 0; i < count; i++) {
      const label = await cards.nth(i).getAttribute('aria-label');
      if (label && spoken.toLowerCase().includes(label.toLowerCase()) && !(await cards.nth(i).evaluate((e) => e.classList.contains('is-right')))) {
        await cards.nth(i).click({ force: true });
        tapped = true;
        rounds++;
        break;
      }
    }
    await page.waitForTimeout(tapped ? 300 : 100);
    if (rounds > 12) throw new Error('play step stuck');
  }
  step(`play (${rounds} taps)`);
  await page.waitForSelector('.reward-actions:not([hidden])');
  await snap('05-reward', 1200);
  step('reward');
}

await playLesson(0, 'match');
await tap('.reward-actions .btn-good'); // Home
await page.waitForSelector('.home');
const stars = await page.locator('.island.is-done').count();
if (stars !== 1) throw new Error(`expected 1 finished island, got ${stars}`);
step('progress shows a star');

await playLesson(1, 'silent');
await tap('.reward-actions .btn-sun'); // My World
await page.waitForTimeout(500);
await snap('06-after-reward');

// progress survives reload
await page.reload();
await tap('.btn-play');
await page.waitForSelector('.home');
const after = await page.locator('.island.is-done').count();
if (after !== 2) throw new Error(`expected 2 finished islands after reload, got ${after}`);
step('progress survives reload');

if (errors.length) {
  console.error('Page errors:\n' + errors.join('\n'));
  process.exitCode = 1;
}
await browser.close();
