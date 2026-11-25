/** Reading & spelling (Starters) and the ABC board. node tests/e2e/reading.mjs [baseUrl] [shotDir] */
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
await page.addInitScript(() => (window.__manualReading = true));
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('efk.v1') || '{}'));
const spoken = () => page.evaluate(() => window.__spoken);

// Walk a Starters lesson up to the reading step.
await page.goto(`${base}/?unit=animals`);
await page.locator('.btn-play').click({ force: true });
const icons = await page.locator('.progress-step').allTextContents();
if (!icons.includes('📖') || !icons.includes('🔤')) fail('Starters lessons should show read 📖 and spell 🔤 steps: ' + icons.join(' '));
for (let i = 0; i < 800 && !(await page.locator('.read-choice').count()); i++) {
  if (await page.locator('.btn-next:not([hidden])').count()) await page.locator('.btn-next:not([hidden])').click({ force: true });
  else if (await page.locator('.btn-mic.is-ready').count()) await page.locator('.btn-mic.is-ready').click({ force: true });
  else if (await page.locator('.play').count()) {
    const said = ((await spoken()).at(-1) || '').toLowerCase();
    const cards = page.locator('.word-card-play:not(.is-faded):not(.is-right)');
    for (let k = 0; k < (await cards.count()); k++) {
      const label = (await cards.nth(k).getAttribute('aria-label')).toLowerCase();
      if (said.includes(label)) { await cards.nth(k).click({ force: true }); break; }
    }
  }
  await page.waitForTimeout(80);
}

// ---------- read ----------
await page.waitForSelector('.read[data-answer]');
const firstAnswer = await page.locator('.read').getAttribute('data-answer');
const nBefore = (await spoken()).length;
if ((await spoken()).slice(-1)[0]?.includes(firstAnswer) && !(await spoken()).slice(-1)[0].startsWith("Let's read")) fail('the read step must not say the word before the child reads it');
if (shots) await page.screenshot({ path: `${shots}/read.png` });
// One wrong word (wiggles, no "wrong"), then the 🔊 hint, then the right word.
const wrong = page.locator(`.read-choice:not([data-word="${firstAnswer}"])`).first();
await wrong.click({ force: true });
await page.waitForTimeout(200);
if ((await spoken()).some((t) => /wrong|no!/i.test(t))) fail('never say "wrong"');
await page.locator('.read .btn-ear').click({ force: true });
await page.waitForTimeout(200);
if (!(await spoken()).slice(nBefore).includes(firstAnswer)) fail('🔊 should say the word');
await page.locator(`.read-choice[data-word="${firstAnswer}"]`).click({ force: true });
let rounds = 1;
for (let i = 0; i < 200 && !(await page.locator('.spell').count()); i++) {
  const a = await page.locator('.read[data-answer]').getAttribute('data-answer').catch(() => null);
  if (a && !(await page.locator('.read-choice.is-right').count())) {
    await page.locator(`.read-choice[data-word="${a}"]`).click({ force: true }).catch(() => {});
    rounds++;
  }
  await page.waitForTimeout(120);
}
if (rounds !== 4) fail(`read step should have 4 rounds, had ${rounds}`);
step('read: picture + written words (no sound unless 🔊), a slip just wiggles, 4 rounds');

// ---------- spell ----------
await page.waitForSelector('.spell[data-word]');
await page.waitForTimeout(400);
const word = await page.locator('.spell').getAttribute('data-word');
const tileCount = await page.locator('.spell-tile').count();
if (tileCount !== word.length + (word.length <= 3 ? 1 : 2)) fail(`tiles = letters + 1–2 extra, got ${tileCount} for "${word}"`);
// a wrong tile first (wiggles), twice → the right one glows
const wrongTile = page.locator('.spell-tile:not(.is-used)').filter({ hasNotText: word[0] }).first();
await wrongTile.click({ force: true });
await page.waitForTimeout(100);
await wrongTile.click({ force: true });
await page.waitForTimeout(150);
if ((await page.locator('.spell-tile.is-hint').textContent()) !== word[0]) fail('after two slips the right letter should glow');
for (let i = 0; i < word.length; i++) {
  await page.locator(`.spell-tile:not(.is-used)`).filter({ hasText: new RegExp(`^${word[i]}$`) }).first().click({ force: true });
  await page.waitForTimeout(120);
}
const filled = await page.locator('.spell-slot.is-filled').allTextContents();
if (filled.join('') !== word) fail(`slots should spell "${word}", got "${filled.join('')}"`);
await page.waitForTimeout(400);
if (!(await spoken()).some((t) => t.includes(`. ${word}!`) && /, /.test(t))) fail('Bix should spell the word out by letter names');
if (shots) await page.screenshot({ path: `${shots}/spell.png` });
step(`spell: tap letters into boxes ("${word}"), slips wiggle, the right tile glows after two`);

// The other words go fast; the slip-free ones get the ✏️ mark.
await page.evaluate(() => (window.__manualReading = false));
await page.waitForSelector('.reward-actions:not([hidden])', { timeout: 60000 });
let s = await state();
const spelled = Object.entries(s.words).filter(([k, v]) => k.startsWith('animals/') && v.spelled).map(([k]) => k.split('/')[1]);
if (spelled.includes(word)) fail(`"${word}" had slips → no ✏️`);
if (spelled.length < 1) fail('slip-free spellings should be marked');
await page.goto(base);
await page.locator('.btn-play').click({ force: true });
await page.waitForSelector('.home');
await page.locator('.dock-btn[aria-label="My Words"]').click({ force: true });
await page.waitForSelector('.sticker-pen');
step(`✏️ on stickers spelled without a slip (${spelled.join(', ')})`);

// ---------- ABC ----------
await page.goto(base);
await page.locator('.btn-play').click({ force: true });
await page.waitForSelector('.home');
await page.locator('.dock-btn[aria-label="ABC"]').click({ force: true });
await page.waitForSelector('.abc-tile');
if ((await page.locator('.abc-grid .abc-tile').count()) !== 26) fail('26 letters');
await page.locator('.abc-tile[data-letter="B"]').click({ force: true });
await page.waitForTimeout(300);
if (!(await spoken()).includes('bee. bee is for ball.')) fail('B should say its name and a word: ' + (await spoken()).slice(-2).join(' | '));
await page.locator('.abc-tile[data-letter="X"]').click({ force: true });
await page.waitForTimeout(300);
if (!(await spoken()).includes('ex. fox. ex is at the end of fox.')) fail('X uses fox');
if (shots) await page.screenshot({ path: `${shots}/abc.png` });
step('ABC: 26 letters, tap → letter name + word ("bee. bee is for ball.")');

await page.locator('.abc-game-btn').click({ force: true });
await page.waitForSelector('.abc-choice');
for (let i = 0; i < 200 && !(await page.locator('.game-done-inline').count()); i++) {
  const said = (await spoken()).at(-1) || '';
  const m = said.match(/^Find the letter (.+)!$/) || said.match(/Find the letter (.+)!$/);
  if (m) {
    const name = m[1];
    const L = { ay: 'A', bee: 'B', see: 'C', dee: 'D', ee: 'E', ef: 'F', jee: 'G', aitch: 'H', eye: 'I', jay: 'J', kay: 'K', el: 'L', em: 'M', en: 'N', oh: 'O', pee: 'P', cue: 'Q', ar: 'R', ess: 'S', tee: 'T', you: 'U', vee: 'V', 'double you': 'W', ex: 'X', why: 'Y', zee: 'Z' }[name];
    const t = page.locator(`.abc-choice[data-letter="${L}"]:not(.is-right)`);
    if (L && (await t.count())) await t.click({ force: true });
  }
  await page.waitForTimeout(150);
}
await page.waitForSelector('.game-done-inline');
s = await state();
if (Object.keys(s.letters || {}).length !== 6) fail('6 letters found first time → 6 stars');
await page.goto(base);
await page.locator('.btn-play').click({ force: true });
await page.locator('.dock-btn[aria-label="ABC"]').click({ force: true });
await page.waitForSelector('.abc-star');
if ((await page.locator('.abc-star').count()) !== 6) fail('ABC board shows the stars');
step('letter game: "Find the letter …" 6 rounds, letters found first time get a ⭐');

// Little Bix (pre-readers): no ABC button, no reading steps.
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('efk.v1')); s.settings.level = 'L0'; localStorage.setItem('efk.v1', JSON.stringify(s)); });
await page.goto(base);
await page.locator('.btn-play').click({ force: true });
await page.waitForSelector('.home');
if (await page.locator('.dock-btn[aria-label="ABC"]').count()) fail('no ABC for pre-readers');
await page.goto(`${base}/?unit=l0-animals`);
await page.locator('.btn-play').click({ force: true });
await page.waitForSelector('.progress-step');
const l0 = await page.locator('.progress-step').allTextContents();
if (l0.includes('📖') || l0.includes('🔤')) fail('Little Bix lessons have no reading');
step('Little Bix (3–4): no ABC button, no reading steps');

if (errors.length) fail('page errors: ' + errors.join(' | '));
await browser.close();
console.log('reading e2e ok');
