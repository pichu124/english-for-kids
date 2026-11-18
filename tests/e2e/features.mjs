/** Engagement features (Word Book, wardrobe, garden, mini-games, stories). node tests/e2e/features.mjs [baseUrl] [shotDir] */
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
const setState = (fn) => page.evaluate(`(() => { const s = JSON.parse(localStorage.getItem('efk.v1')); (${fn})(s); localStorage.setItem('efk.v1', JSON.stringify(s)); })()`);
const home = async () => {
  await page.goto(base);
  await page.locator('.btn-play').click({ force: true });
  await page.waitForSelector('.home');
};

// ---------- A2: Word Book ----------
await home();
await page.locator('.dock-btn[aria-label="My Words"]').click({ force: true });
await page.waitForSelector('.book');
if (await page.locator('.sticker.is-got').count()) fail('fresh child should have no stickers');
step('Word Book opens from the home dock, all stickers locked at first');

// Play the Animals unit: tap game picks right first time → stickers.
await page.goto(`${base}/?unit=animals`);
await page.locator('.btn-play').click({ force: true });
for (let i = 0; i < 800 && !(await page.locator('.reward-actions:not([hidden])').count()); i++) {
  if (await page.locator('.btn-next:not([hidden])').count()) await page.locator('.btn-next:not([hidden])').click({ force: true });
  else if (await page.locator('.btn-mic.is-ready').count()) await page.locator('.btn-mic.is-ready').click({ force: true });
  else if (await page.locator('.play').count()) {
    const said = (await page.evaluate(() => window.__spoken.at(-1) || '')).toLowerCase();
    const cards = page.locator('.word-card-play:not(.is-faded):not(.is-right)');
    for (let k = 0; k < (await cards.count()); k++) {
      const label = (await cards.nth(k).getAttribute('aria-label')).toLowerCase();
      if (said.includes(label)) { await cards.nth(k).click({ force: true }); break; }
    }
  }
  await page.waitForTimeout(80);
}
await page.waitForSelector('.reward .tip-card');
await page.locator('.reward .tip-head').click({ force: true });
if (!(await page.locator('.reward .tip-body:not([hidden])').count())) fail('tip card should open');
if (shots) await page.screenshot({ path: `${shots}/reward-tip.png` });
step('reward screen shows a "Chơi cùng con" card for parents');
let s = await state();
const known = Object.entries(s.words).filter(([k, v]) => k.startsWith('animals/') && v.known).length;
if (!known) fail('right-first-time picks should mark words known');
await home();
const badge = await page.locator('.dock-btn[aria-label="My Words"] .badge').textContent();
if (!(Number(badge) >= known)) fail(`dock badge should count stickers, got ${badge}`);
await page.locator('.dock-btn[aria-label="My Words"]').click({ force: true });
await page.waitForSelector('.sticker.is-got');
const got = await page.locator('.sticker.is-got').count();
if (got < known) fail('book should show the known words as stickers');
const before = await page.evaluate(() => window.__spoken.length);
await page.locator('.sticker.is-got').first().click({ force: true });
await page.waitForTimeout(300);
if ((await page.evaluate(() => window.__spoken.length)) <= before) fail('tapping a sticker should say the word');
if (shots) await page.screenshot({ path: `${shots}/book.png` });
step(`after a lesson: ${got} stickers in the book, tap says the word`);

// ---------- A3: Bix's wardrobe ----------
// One lesson done above → the cap is unlocked; the dock shows NEW.
await home();
if (!(await page.locator('.dock-btn[aria-label="Bix"].is-new').count())) fail('dock should flag new clothes after the first lesson');
await page.locator('.dock-btn[aria-label="Bix"]').click({ force: true });
await page.waitForSelector('.wardrobe');
if (await page.locator('.ward-item[data-item="crown"]:not(.is-locked)').count()) fail('crown needs 12 lessons');
await page.locator('.ward-item[data-item="cap"]').click({ force: true });
await page.waitForSelector('.ward-bix .bix.has-hat');
s = await state();
if (s.outfit?.hat !== 'cap') fail('wearing the cap should be saved');
if (shots) await page.screenshot({ path: `${shots}/wardrobe.png` });
await home();
if (!(await page.locator('.home-bix .bix.has-hat').count())) fail('Bix on the home screen should wear the cap');
if (await page.locator('.dock-btn[aria-label="Bix"].is-new').count()) fail('NEW should go once the wardrobe was opened');
step('wardrobe: cap unlocked by 1 lesson, Bix wears it everywhere, crown still locked');

// ---------- A4: Garden ----------
// Today had a lesson (above) → a fresh plant and a glowing dock button.
await home();
if (!(await page.locator('.dock-btn[aria-label="Garden"].is-new').count())) fail('garden should glow after today\'s first lesson');
await page.locator('.dock-btn[aria-label="Garden"]').click({ force: true });
await page.waitForSelector('.garden .plot.is-fresh');
if (await page.locator('.plot.is-empty').count()) fail('no empty plot when today already grew a plant');
// Past learning days (with gaps) each add a plant; nothing is lost for days off.
await setState((st) => {
  for (const d of ['2026-01-03', '2026-01-04', '2026-01-09', '2026-02-20', '2026-03-01']) st.days[d] = { seconds: 300, lessons: 1, auto: 0, parent: 0, miss: 0, noVoice: 0 };
  st.days['2026-01-05'] = { seconds: 60, lessons: 0, auto: 0, parent: 0, miss: 0, noVoice: 0 };
});
await home();
if (await page.locator('.dock-btn[aria-label="Garden"].is-new').count()) fail('glow should go once the garden was seen today');
await page.locator('.dock-btn[aria-label="Garden"]').click({ force: true });
await page.waitForSelector('.garden');
const plots = await page.locator('.plot:not(.is-empty)').count();
if (plots !== 6) fail(`6 learning days should give 6 plants, got ${plots}`);
if (!(await page.locator('.garden-friend').count())) fail('3+ plants should bring a butterfly');
if (shots) await page.screenshot({ path: `${shots}/garden.png` });
step('garden: one plant per learning day (gaps cost nothing), new plant glows once');

// ---------- A5: mini-games ----------
await home();
await page.locator('.dock-btn[aria-label="Games"]').click({ force: true });
await page.waitForSelector('.games');
await page.locator('.game-pick[data-game="memory"]').click({ force: true });
await page.waitForSelector('.mem-card');
const ids = await page.locator('.mem-card').evaluateAll((els) => els.map((e) => e.dataset.id));
if (ids.length !== 12) fail(`Starters memory should have 12 cards, got ${ids.length}`);
// One mismatch first (flips back), then every pair.
const first = ids[0];
const other = ids.findIndex((x) => x !== first);
await page.locator('.mem-card').nth(0).click({ force: true });
await page.locator('.mem-card').nth(other).click({ force: true });
await page.waitForTimeout(1400);
if (await page.locator('.mem-card.is-up').count()) fail('a mismatched pair should flip back');
const done = new Set();
for (let i = 0; i < ids.length; i++) {
  if (done.has(i)) continue;
  const j = ids.findIndex((x, k) => k !== i && x === ids[i]);
  await page.locator('.mem-card').nth(i).click({ force: true });
  await page.locator('.mem-card').nth(j).click({ force: true });
  done.add(i); done.add(j);
  await page.waitForTimeout(500);
}
await page.waitForSelector('.game-done', { timeout: 8000 });
if ((await page.locator('.mem-card.is-done').count()) !== 12) fail('all cards should be matched');
if (shots) await page.screenshot({ path: `${shots}/memory.png` });
step('memory: mismatches flip back, finding all 6 pairs ends the game');

await page.locator('.btn-home').first().click({ force: true });
await page.waitForSelector('.home');
await page.locator('.dock-btn[aria-label="Games"]').click({ force: true });
await page.locator('.game-pick[data-game="balloons"]').click({ force: true });
await page.waitForSelector('.balloon');
let shot = false;
for (let i = 0; i < 200 && !(await page.locator('.game-done').count()); i++) {
  const said = (await page.evaluate(() => window.__spoken.at(-1) || '')).toLowerCase();
  const m = said.match(/pop the (.+)!$/);
  if (m) {
    const b = page.locator(`.balloon:not(.is-popped)[aria-label="${m[1]}" i]`);
    if (await b.count()) {
      if (shots && !shot) { await page.screenshot({ path: `${shots}/balloons.png` }); shot = true; }
      await b.first().click({ force: true });
    }
  }
  await page.waitForTimeout(120);
}
if (!(await page.locator('.game-done').count())) fail('popping 5 named balloons should end the game');
if ((await page.locator('.balloon-stars .on').count()) !== 5) fail('5 stars after 5 rounds');
step('balloons: pop the balloon Bix names, 5 rounds then done');

// ---------- B7: stories ----------
await home();
if (!(await page.locator('.dock-btn[aria-label="Stories"].is-new').count())) fail('finishing Animals should open its story (dock glows)');
await page.locator('.dock-btn[aria-label="Stories"]').click({ force: true });
await page.waitForSelector('.story-book');
if (!(await page.locator('.story-book.is-locked').count())) fail('stories of unfinished units should be locked');
await page.locator('.story-book[data-story="story-animals"]').click({ force: true });
await page.waitForSelector('.story-page');
await page.waitForTimeout(300);
if (!(await page.evaluate(() => window.__spoken.some((t) => t.startsWith('Bix walks to the pond'))))) fail('Bix should read the first page');
const nBefore = await page.evaluate(() => window.__spoken.length);
await page.locator('.story-word[aria-label="pond"]').click({ force: true });
await page.waitForTimeout(200);
if ((await page.evaluate(() => window.__spoken.at(-1))) !== 'pond' || (await page.evaluate(() => window.__spoken.length)) <= nBefore) fail('tapping a word should say it');
if (shots) await page.screenshot({ path: `${shots}/story-page.png` });
for (let i = 0; i < 5; i++) { await page.locator('.story-next').click({ force: true }); await page.waitForTimeout(150); }
await page.waitForSelector('.story-quiz');
for (let i = 0; i < 100 && !(await page.locator('.story-end').count()); i++) {
  const said = (await page.evaluate(() => window.__spoken.at(-1) || '')).toLowerCase();
  const ans = said.includes('sings') ? 'bird' : said.includes('swims') ? 'fish' : '';
  const c = page.locator(`.story-quiz .word-card-play[aria-label="${ans}"]:not(.is-right)`);
  if (ans && (await c.count())) await c.click({ force: true });
  await page.waitForTimeout(150);
}
await page.waitForSelector('.story-end');
s = await state();
if (s.storiesRead?.['story-animals'] !== 1) fail('reading to the end should be saved');
step('story: Bix reads each page, words are tappable, 2 picture questions, "The End"');

// ---------- B8: adaptive difficulty ----------
const playCards = async (unit) => {
  await page.goto(`${base}/?unit=${unit}`);
  await page.locator('.btn-play').click({ force: true });
  for (let i = 0; i < 400 && !(await page.locator('.play .word-card-play').count()); i++) {
    if (await page.locator('.btn-next:not([hidden])').count()) await page.locator('.btn-next:not([hidden])').click({ force: true });
    else if (await page.locator('.btn-mic.is-ready').count()) await page.locator('.btn-mic.is-ready').click({ force: true });
    else if (await page.locator('.btn-did').count()) await page.locator('.btn-did').click({ force: true });
    else if (await page.locator('.btn-chant-done:not([hidden])').count()) await page.locator('.btn-chant-done').click({ force: true });
    await page.waitForTimeout(80);
  }
  return page.locator('.play .word-card-play').count();
};
await setState((st) => (st.adapt = { recent: Array(12).fill(false) }));
let nc = await playCards('animals');
if (nc !== 3) fail(`struggling child: Starters game should drop to 3 pictures, got ${nc}`);
await setState((st) => (st.adapt = { recent: Array(12).fill(true) }));
nc = await playCards('l1-family');
if (nc !== 4) fail(`strong child: Explorer game should rise to 4 pictures, got ${nc}`);
await setState((st) => (st.adapt = { recent: [true, false, true] }));
nc = await playCards('animals');
if (nc !== 4) fail(`too few rounds → level default (4), got ${nc}`);
step('adaptive: often wrong → 3 pictures, always right → one more, few rounds → level default');

// ---------- B9: Bix remembers and chats ----------
await setState((st) => {
  for (const t of Object.values(st.topics)) t.lastDone = '2026-01-02';
  st.topics.animals.lastDone = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  delete st.chats;
});
await page.evaluate(() => (window.__spoken.length = 0));
await home();
await page.waitForSelector('.chat-box', { timeout: 15000 });
const spoken = await page.evaluate(() => window.__spoken.join(' | '));
if (!spoken.includes('Welcome back! Last time we learned Animals!')) fail('greeting should recall the last unit: ' + spoken);
if (!spoken.includes('Do you like dogs?')) fail('Bix should ask the Animals chat question');
if (shots) await page.screenshot({ path: `${shots}/chat.png` });
await page.locator('.chat-yes').click({ force: true });
await page.waitForTimeout(300);
if (!(await page.evaluate(() => window.__spoken.includes('Woof! Dogs are great!')))) fail('👍 should get the yes reply');
s = await state();
if (s.chatAnswers?.animals !== 'yes') fail('the answer should be remembered');
await home();
await page.waitForTimeout(2500);
if (await page.locator('.chat-box').count()) fail('only one chat question a day');
// All Little Bix islands done → a one-time celebration.
await setState((st) => {
  for (const id of ['l0-animals', 'l0-colors', 'l0-food', 'l0-toys', 'l0-weather', 'l0-transport']) st.topics[id] = { completed: 1, lastDone: '2026-01-02' };
  st.settings.level = 'L0';
});
await page.evaluate(() => (window.__spoken.length = 0));
await home();
await page.waitForTimeout(800);
if (!(await page.evaluate(() => window.__spoken.some((t) => t.startsWith('Wow! You finished all the Little Bix islands'))))) fail('finishing a level should be celebrated');
s = await state();
if (!s.celebrated?.includes('L0')) fail('celebration should happen once');
await setState((st) => (st.settings.level = 'L2'));
step('Bix: "Welcome back! Last time we learned…", one 👍/👎 question a day, cheers when a level is done');

// ---------- A6: tips in the parent area ----------
await home();
await page.locator('.btn-parent').click({ force: true });
await page.waitForSelector('.gate');
const [ga, gb] = (await page.locator('.gate-q').textContent()).match(/\d+/g).map(Number);
for (const ch of String(ga * gb)) await page.click(`.key:text-is("${ch}")`);
await page.click('.key-ok');
await page.waitForSelector('.p-tips .tip-card');
const tipText = await page.locator('.p-tips .tip-card').first().textContent();
if (!tipText.includes('Animals') && !tipText.includes('Con vật') && !tipText.includes('🐶')) fail('first tip should be for the unit just done (Animals), got: ' + tipText.slice(0, 80));
if (!(await page.locator('.p-chat li').count())) fail('parent area should show what the child told Bix');
step('parent area lists "Chơi cùng con" tips and the child\'s answers to Bix');

// __MORE__

if (errors.length) fail('page errors: ' + errors.join(' | '));
await browser.close();
console.log('features e2e ok');
