/** "Today" guided path. node tests/e2e/today.mjs [baseUrl] [shotDir] */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = (process.argv[2] || 'http://localhost:4173/').replace(/\/$/, '');
const shots = process.argv[3];
const step = (m) => console.log('✓', m);
const fail = (m) => { throw new Error(m); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(readFileSync(new URL('./fakes.js', import.meta.url), 'utf8'));
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('efk.v1') || '{}'));

// A child who learned Animals before, with 3 words due for review.
await page.goto(base);
await page.evaluate(() => {
  const due = '2000-01-01';
  localStorage.setItem('efk.v1', JSON.stringify({
    childName: 'Shin', settings: { dailyLimitMin: 0, rate: 0.8 },
    topics: { animals: { completed: 1, lastDone: '2026-01-02' } }, words: {}, blocks: { inventory: {}, placed: [], totalEarned: 1 },
    days: {}, bonus: {}, review: { 'animals/dog': { box: 1, due }, 'animals/cat': { box: 1, due }, 'animals/fish': { box: 1, due } },
    chats: { animals: '2099-01-01' },
  }));
});
const home = async () => {
  await page.goto(base);
  await page.locator('.btn-play').click({ force: true });
  await page.waitForSelector('.home');
};
await home();
if (!(await page.locator('.home-today.is-fresh').count())) fail('home should show a glowing Today button');
await page.locator('.home-today').click({ force: true });
await page.waitForSelector('.today-card');
const kinds = await page.locator('.today-card[data-kind]').evaluateAll((els) => els.map((e) => e.dataset.kind));
if (kinds.join(',') !== 'review,lesson,fun') fail('plan should be review → lesson → fun, got ' + kinds.join(','));
if (!(await page.locator('.today-card.is-now[data-kind="review"]').count())) fail('review is first');
if (!(await page.locator('.today-card[data-kind="lesson"]').textContent()).includes('Animals · Read')) fail('lesson = Read & Write of Animals (heard, not yet read)');
if (shots) await page.screenshot({ path: `${shots}/today-plan.png` });
step('Today plan: review (words due) → Read & Write of Animals (heard before) → story or game → prize');

// helper: answer whatever the lesson asks until the Next button appears
const playUntilNext = async () => {
  for (let i = 0; i < 1500 && !(await page.locator('.today-next').count()); i++) {
    if (await page.locator('.btn-next:not([hidden])').count()) await page.locator('.btn-next:not([hidden])').click({ force: true });
    else if (await page.locator('.btn-mic.is-ready').count()) await page.locator('.btn-mic.is-ready').click({ force: true });
    else if (await page.locator('.play').count()) {
      const said = (await page.evaluate(() => window.__spoken.at(-1) || '')).toLowerCase();
      const cards = page.locator('.word-card-play:not(.is-faded):not(.is-right)');
      for (let k = 0; k < (await cards.count()); k++) {
        const label = ((await cards.nth(k).getAttribute('aria-label', { timeout: 500 }).catch(() => '')) || '').toLowerCase();
        if (label && said.includes(label)) { await cards.nth(k).click({ force: true, timeout: 500 }).catch(() => {}); break; }
      }
    } else if (await page.locator('.story-next').count()) await page.locator('.story-next').click({ force: true });
    else if (await page.locator('.story-quiz').count()) {
      const said = (await page.evaluate(() => window.__spoken.at(-1) || '')).toLowerCase();
      for (const c of await page.locator('.story-quiz .word-card-play:not(.is-right)').all()) {
        const l = ((await c.getAttribute('aria-label').catch(() => '')) || '').toLowerCase();
        if (l && said.includes(l.split(' ')[0])) { await c.click({ force: true }).catch(() => {}); break; }
      }
      // fallback: try each card (wrong ones just wiggle)
      for (const c of await page.locator('.story-quiz .word-card-play:not(.is-right):not(.is-faded)').all()) await c.click({ force: true, timeout: 300 }).catch(() => {});
    } else if (await page.locator('.mem-card').count()) {
      const ids = await page.locator('.mem-card').evaluateAll((els) => els.map((e) => (e.classList.contains('is-done') ? null : e.dataset.id)));
      const i0 = ids.findIndex((x) => x);
      if (i0 >= 0) {
        const j = ids.findIndex((x, k) => k !== i0 && x === ids[i0]);
        await page.locator('.mem-card').nth(i0).click({ force: true });
        await page.locator('.mem-card').nth(j).click({ force: true });
        await page.waitForTimeout(500);
      }
    } else if (await page.locator('.paint-tile').count()) {
      const said = await page.evaluate(() => window.__spoken.at(-1) || '');
      const m = said.match(/colour the (.+) (\w+)!$/i);
      if (m) {
        await page.locator(`.crayon[data-colour="${m[2]}"]`).click({ force: true, timeout: 500 }).catch(() => {});
        await page.locator(`.paint-tile:not(.is-painted)[aria-label="${m[1]}" i]`).first().click({ force: true, timeout: 500 }).catch(() => {});
      }
    } else if (await page.locator('.balloon').count()) {
      const said = (await page.evaluate(() => window.__spoken.at(-1) || '')).toLowerCase();
      const m = said.match(/pop the (.+)!$/);
      if (m) await page.locator(`.balloon:not(.is-popped)[aria-label="${m[1]}" i]`).first().click({ force: true, timeout: 500 }).catch(() => {});
    }
    await page.waitForTimeout(90);
  }
  if (!(await page.locator('.today-next').count())) fail('activity from Today should end with ▶ Next');
};

// 1) review
await page.locator('.today-go').click({ force: true });
await page.waitForSelector('.lesson');
await playUntilNext();
if (await page.locator('.reward-actions .btn-good[aria-label="Home"]').count()) fail('from Today: Next instead of Home');
await page.locator('.today-next').click({ force: true });
await page.waitForSelector('.today-card[data-kind="review"].is-done');
step('review done → ▶ Next → back to the plan with ✓');

// 2) lesson (Animals part 2)
await page.locator('.today-go').click({ force: true });
await page.waitForSelector('.lesson');
await playUntilNext();
if (shots) await page.screenshot({ path: `${shots}/today-next.png` });
await page.locator('.today-next').click({ force: true });
await page.waitForSelector('.today-card[data-kind="lesson"].is-done');
let s = await state();
if (s.topics.animals?.readDone !== 1) fail('the Read & Write part counts');
step('Read & Write of Animals done → block etc. as usual, then ▶ Next');

// 3) fun: the Animals story is open and unread → story
const funLabel = await page.locator('.today-card[data-kind="fun"]').textContent();
await page.locator('.today-go').click({ force: true });
await page.waitForFunction(() => document.querySelector('.story, .games, .game'));
const isStory = await page.locator('.story').count();
await playUntilNext();
await page.locator('.today-next').click({ force: true });
await page.waitForSelector('.today-prize.is-done');
s = await state();
if (!s.today?.finished || s.todayDays !== 1) fail('all done → day finished, counted once');
await page.waitForFunction(() => window.__spoken.some((t) => t.startsWith('Hooray! You did everything today!')), null, { timeout: 5000 }).catch(() => fail('Bix celebrates the day'));
if (shots) await page.screenshot({ path: `${shots}/today-done.png` });
step(`fun step (${isStory ? 'story' : 'game'}${funLabel ? '' : ''}) → prize 🌟, day counted (todayDays = 1)`);

// Home: Today shows done; reopening does not count again.
await home();
if (await page.locator('.home-today.is-fresh').count()) fail('done today → no glow');
if (!(await page.locator('.home-today').textContent()).includes('🌟')) fail('done today → 🌟 on the button');
await page.locator('.home-today').click({ force: true });
await page.waitForSelector('.today-prize.is-done');
s = await state();
if (s.todayDays !== 1) fail('reopening must not count the day twice');
step('home: 🌟 Today when done; reopening does not count twice');

// Leaving mid-activity: from the map a lesson ends with the usual buttons (no Next).
await home();
await page.locator('.island[aria-label="Food"]').click({ force: true });
await page.waitForSelector('.lesson');
for (let i = 0; i < 1500 && !(await page.locator('.reward-actions:not([hidden])').count()); i++) {
  if (await page.locator('.btn-next:not([hidden])').count()) await page.locator('.btn-next:not([hidden])').click({ force: true });
  else if (await page.locator('.btn-mic.is-ready').count()) await page.locator('.btn-mic.is-ready').click({ force: true });
  else if (await page.locator('.play').count()) {
    const said = (await page.evaluate(() => window.__spoken.at(-1) || '')).toLowerCase();
    const cards = page.locator('.word-card-play:not(.is-faded):not(.is-right)');
    for (let k = 0; k < (await cards.count()); k++) {
      const label = ((await cards.nth(k).getAttribute('aria-label', { timeout: 500 }).catch(() => '')) || '').toLowerCase();
      if (label && said.includes(label)) { await cards.nth(k).click({ force: true, timeout: 500 }).catch(() => {}); break; }
    }
  }
  await page.waitForTimeout(90);
}
if (await page.locator('.today-next').count()) fail('a lesson opened from the map has no Next');
step('lessons opened from the map keep their usual World/Home buttons');

if (errors.length) fail('page errors: ' + errors.join(' | '));
await browser.close();
console.log('today e2e ok');
