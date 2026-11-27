// 🐢 slow repeat, British/American voice, "Practice" before the test, new games in the four skills.
// Run: node tests/e2e/extras.mjs [baseUrl]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = (process.argv[2] || 'http://localhost:4173/').replace(/\/$/, '');
const step = (m) => console.log('✓', m);
const fail = (m) => { throw new Error(m); };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(readFileSync(new URL('./fakes.js', import.meta.url), 'utf8'));
await page.addInitScript(() => {
  if (localStorage.getItem('efk.v1')) return;
  // two Starters units finished; three animal words needed more than one try
  const words = {};
  for (const w of ['cat', 'dog', 'fish']) words[`animals/${w}`] = { said: false, tries: 2, slips: 2, slipAt: '2026-11-20' };
  localStorage.setItem('efk.v1', JSON.stringify({ childName: 'Shin', settings: { dailyLimitMin: 0, rate: 0.8, level: 'L2' }, topics: { animals: { completed: 1 }, colours: { completed: 1 } }, words, blocks: { inventory: {}, placed: [], totalEarned: 0 }, days: {}, bonus: {}, review: {}, gamesPlayed: { pairs: 2, clock: 1, tower: 3 } }));
});
await page.goto(base);
await page.locator('.btn-play').click({ force: true });
await page.waitForSelector('.home');

// Practice before the test: an island with the hardest words, played like a review
const prep = page.locator('.island-prep');
if (!(await prep.count())) fail('a Practice island before the Test');
if (!/Practice · \d/.test(await prep.textContent())) fail('it shows how many words');
await prep.click({ force: true });
await page.waitForSelector('.lesson');
await page.waitForFunction(() => window.__spoken.some((t) => /tricky words/.test(t)), null, { timeout: 5000 });
step('Practice island (before the Test) opens a session with the hardest words');
await page.locator('.btn-home, [aria-label="Home"]').first().click({ force: true });
await page.waitForSelector('.home');

// 🐢 tapping "listen" twice: the second time is slower
await page.locator('.dock-btn[aria-label="ABC"]').click({ force: true });
await page.locator('.abc-tile[data-letter="B"]').click();
await page.waitForTimeout(300);
await page.locator('.abc-big').click();
await page.waitForTimeout(150);
await page.locator('.abc-big').click();
await page.waitForSelector('.slow-turtle');
const rates = await page.evaluate(() => window.__utter.filter((u) => /bee/.test(u.text)).map((u) => u.rate));
if (!(rates.length >= 2 && rates.at(-1) < rates.at(-2))) fail('the repeat is slower: ' + rates);
step('🐢 a second tap says it again, slowly (with a little turtle)');

// British voice: utterances in en-GB
await page.locator('.btn-home, [aria-label="Home"]').first().click({ force: true });
await page.waitForSelector('.home');
await page.locator('.btn-parent').click({ force: true });
const [a, b] = (await page.locator('.gate-q').textContent()).match(/\d+/g).map(Number);
for (const ch of String(a * b)) await page.click(`.key:text-is("${ch}")`);
await page.click('.key-ok');
await page.locator('[data-accent="en-GB"]').click();
await page.waitForFunction(() => window.__utter.at(-1)?.lang === 'en-GB');
if (JSON.parse(await page.evaluate(() => localStorage.getItem('efk.v1'))).settings.accent !== 'en-GB') fail('accent saved');
if (!(await page.locator('.p-row:has([data-accent]) .p-muted').count())) fail('no British voice on this device: the parent is told');
step('British/American voice: Bix speaks en-GB after choosing "Anh-Anh" (and says when the device lacks one)');

// the new games count in the four skills
const listen = await page.locator('.sk-item[data-skill="listen"]').textContent();
const write = await page.locator('.sk-item[data-skill="write"]').textContent();
if (!/Which one\? 2 lượt, What time\? 1 lượt/.test(listen) || !/Bix's Tower: 3 lượt/.test(write)) fail('games in the skills: ' + listen + ' | ' + write);
step('Which one? and What time? count for listening, Bix\'s Tower for writing');
if (errors.length) fail('page errors: ' + errors.join(' | '));
await browser.close();
console.log('extras e2e ok');
