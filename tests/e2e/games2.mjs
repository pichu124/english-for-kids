// New games: Bix's Tower (guess the word), What time is it? (clocks), Which one? (words that sound alike).
// Run: node tests/e2e/games2.mjs [baseUrl]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = (process.argv[2] || 'http://localhost:4173/').replace(/\/$/, '');
const step = (m) => console.log('✓', m);
const fail = (m) => { throw new Error(m); };
const FAKES = readFileSync(new URL('./fakes.js', import.meta.url), 'utf8');
const browser = await chromium.launch();
const errors = [];

async function open(level, vp = { width: 1280, height: 800 }) {
  const page = await browser.newPage({ viewport: vp });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(FAKES);
  await page.addInitScript((lv) => {
    if (!localStorage.getItem('efk.v1')) localStorage.setItem('efk.v1', JSON.stringify({ childName: 'Shin', settings: { dailyLimitMin: 0, rate: 0.8, level: lv }, topics: {}, words: {}, blocks: { inventory: {}, placed: [], totalEarned: 0 }, days: {}, bonus: {}, review: {} }));
  }, level);
  await page.goto(base);
  await page.locator('.btn-play').click({ force: true });
  await page.waitForSelector('.home');
  await page.locator('.dock-btn[aria-label="Games"]').click({ force: true });
  await page.waitForSelector('.games-list');
  return page;
}
const spoken = (page) => page.evaluate(() => window.__spoken.join(' | '));

// which games each level gets
{
  const p0 = await open('L0');
  if (await p0.locator('[data-game="pairs"], [data-game="clock"], [data-game="tower"]').count()) fail('3–4 year olds: none of the new games');
  await p0.close();
  const p1 = await open('L1');
  if (!(await p1.locator('[data-game="pairs"]').count()) || (await p1.locator('[data-game="tower"], [data-game="clock"]').count())) fail('4–5: only Which one?');
  await p1.close();
  step('the new games appear by level (Which one? from 4–5, What time? and Tower from Starters)');
}

// Bix's Tower
{
  const page = await open('L2');
  await page.locator('[data-game="tower"]').click({ force: true });
  for (let r = 0; r < 4; r++) {
    await page.waitForSelector(`.tw-round:nth-child(1)`);
    const word = await page.locator('.tw-round').getAttribute('data-word');
    await page.waitForTimeout(450); // new keys ignore a tap in their first moment
    if (r === 0) {
      const miss = 'zqxjvkw'.split('').find((c) => !word.includes(c));
      await page.locator(`.tw-key[data-key="${miss}"]`).click({ force: true });
      await page.waitForFunction(() => /Not in this word/.test(window.__spoken.at(-1) || ''));
      if (!(await page.locator(`.tw-key[data-key="${miss}"].is-out`).count())) fail('a letter not in the word is greyed out');
    }
    for (const c of new Set(word)) await page.locator(`.tw-key[data-key="${c}"]`).click({ force: true });
    await page.waitForFunction((w) => window.__spoken.some((t) => t.endsWith(`${w}!`) && /, /.test(t)), word);
    if (r < 3) await page.waitForFunction((w) => document.querySelector('.tw-round')?.getAttribute('data-word') !== w, word, { timeout: 8000 });
  }
  await page.waitForSelector('.game-done');
  const blocks = await page.locator('.tw-block').count();
  if (blocks < 8) fail('every right letter adds a block: ' + blocks);
  if (/wrong/i.test(await spoken(page))) fail('never "wrong"');
  step(`Bix's Tower: 4 words guessed letter by letter, ${blocks} blocks, a missing letter is just "not in this word"`);
  await page.close();
}

// What time is it? — o'clock for Starters, quarter past/to for Flyers
for (const level of ['L2', 'L4']) {
  const page = await open(level);
  await page.locator('[data-game="clock"]').click({ force: true });
  const seen = [];
  for (let r = 0; r < 6; r++) {
    await page.waitForSelector('.ck-round');
    const ans = await page.locator('.ck-round').getAttribute('data-answer');
    seen.push(ans);
    await page.waitForTimeout(450);
    if (r === 0) {
      await page.locator(`.ck-clock:not([data-time="${ans}"])`).first().click();
      await page.waitForFunction(() => /That's .* Try again!/.test(window.__spoken.at(-1) || ''));
    }
    await page.locator(`.ck-clock[data-time="${ans}"]`).click();
    if (r < 5) await page.waitForFunction((a) => document.querySelector('.ck-round')?.getAttribute('data-answer') !== a, ans, { timeout: 8000 });
  }
  await page.waitForSelector('.game-done');
  if (level === 'L2' && seen.some((t) => !t.endsWith(':00'))) fail("Starters: only o'clock " + seen);
  if (!/o'clock|half past|quarter/.test(await spoken(page))) fail('times are said in words');
  step(`What time is it? (${level}): 6 clocks, a wrong clock says its own time, then "Try again!"`);
  await page.close();
}

// Which one?
{
  const page = await open('L1', { width: 640, height: 320 });
  await page.locator('[data-game="pairs"]').click({ force: true });
  for (let r = 0; r < 8; r++) {
    await page.waitForSelector('.wp-round');
    const ans = await page.locator('.wp-round').getAttribute('data-answer');
    await page.waitForTimeout(450);
    await page.locator(`.wp-card[data-word="${ans}"]`).click();
    await page.waitForFunction((a) => window.__spoken.some((t) => t.includes(`${a}! Not `)), ans);
    if (r < 7) await page.waitForFunction((a) => document.querySelector('.wp-round')?.getAttribute('data-answer') !== a || document.querySelectorAll('.wp-card.is-right').length === 0, ans, { timeout: 8000 });
  }
  await page.waitForSelector('.game-done', { timeout: 10000 });
  step('Which one? (phone): 8 pairs of words that sound alike, both words said after each answer');
  await page.close();
}
if (errors.length) fail('page errors: ' + errors.join(' | '));
await browser.close();
console.log('games2 e2e ok');
