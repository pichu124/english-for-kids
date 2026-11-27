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
// Count music beat ticks: the synthesizer's ticks are the only sounds at 1600/1200 Hz.
await page.addInitScript(() => {
  window.__ticks = 0;
  const orig = AudioParam.prototype.setValueAtTime;
  AudioParam.prototype.setValueAtTime = function (v, t) {
    if (v === 1600 || v === 1200) window.__ticks++;
    return orig.call(this, v, t);
  };
});
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
  if (await page.locator('.btn-chant-done:not([hidden])').count()) await page.locator('.btn-chant-done').click({ force: true });
  else if (await page.locator('.btn-next:not([hidden])').count()) await page.locator('.btn-next:not([hidden])').click({ force: true });
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
if (!(await page.locator('.game-pick[data-game="duo"]').count())) fail('Games menu has the Play Together card (tests/e2e/duo.mjs plays it)');
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

await page.locator('.btn-home').first().click({ force: true });
await page.waitForSelector('.home');
await page.locator('.dock-btn[aria-label="Games"]').click({ force: true });
await page.locator('.game-pick[data-game="colour"]').click({ force: true });
await page.waitForSelector('.paint-tile');
if ((await page.locator('.paint-tile').count()) !== 4) fail('colour game shows 4 things');
await page.waitForFunction(() => /colour the .+ \w+!$/i.test(window.__spoken.at(-1) || ''));
{
  // Wrong colour first: nothing gets painted, Bix says "Try again".
  const said = await page.evaluate(() => window.__spoken.at(-1));
  const [, thing, col] = said.match(/colour the (.+) (\w+)!$/i);
  const wrong = ['red', 'blue', 'green', 'yellow', 'purple'].find((c) => c !== col);
  await page.locator(`.crayon[data-colour="${wrong}"]`).click({ force: true });
  await page.locator(`.paint-tile[aria-label="${thing}" i]`).click({ force: true });
  await page.waitForTimeout(300);
  if (await page.locator('.paint-tile.is-painted').count()) fail('a wrong colour should not paint');
  if (!/try again/i.test(await page.evaluate(() => window.__spoken.at(-1)))) fail('wrong colour: Bix says try again');
}
let cshot = false;
for (let i = 0; i < 120 && !(await page.locator('.game-done').count()); i++) {
  const said = (await page.evaluate(() => window.__spoken.at(-1) || ''));
  const m = said.match(/colour the (.+) (\w+)!$/i);
  if (m) {
    const t = page.locator(`.paint-tile:not(.is-painted)[aria-label="${m[1]}" i]`);
    if (await t.count()) {
      await page.locator(`.crayon[data-colour="${m[2]}"]`).click({ force: true });
      await t.first().click({ force: true });
      if (shots && !cshot && (await page.locator('.paint-tile.is-painted').count()) >= 2) { await page.screenshot({ path: `${shots}/colour.png` }); cshot = true; }
    }
  }
  await page.waitForTimeout(150);
}
if (!(await page.locator('.game-done').count())) fail('colouring 4 things should end the game');
if ((await page.locator('.paint-tile.is-painted').count()) !== 4) fail('all 4 things painted');
step('colour: "Colour the dog blue!" — wrong colour gently retried, 4 things coloured then done');

await page.locator('.btn-home').first().click({ force: true });
await page.waitForSelector('.home');
await page.locator('.dock-btn[aria-label="Games"]').click({ force: true });
await page.locator('.game-pick[data-game="who"]').click({ force: true });
await page.waitForSelector('.kid');
if ((await page.locator('.kid').count()) !== 5) fail('Who Is Who shows 5 children');
await page.waitForFunction(() => /^find \w+\. (he|she)'s got a \w+ t-shirt and (he|she)'s .+\.$/i.test(window.__spoken.at(-1) || ''));
{
  const said = await page.evaluate(() => window.__spoken.at(-1));
  const name = said.match(/^find (\w+)\./i)[1];
  await page.locator(`.kid:not([data-name="${name}"])`).first().click({ force: true });
  await page.waitForTimeout(300);
  if (await page.locator('.kid.is-named').count()) fail('tapping the wrong child names nobody');
  if (!/try again/i.test(await page.evaluate(() => window.__spoken.at(-1)))) fail('wrong child: Bix says try again');
}
let wshot = false;
for (let i = 0; i < 120 && !(await page.locator('.game-done').count()); i++) {
  const m = (await page.evaluate(() => window.__spoken.at(-1) || '')).match(/^(?:try again! )?find (\w+)\./i);
  if (m) {
    const k = page.locator(`.kid:not(.is-named)[data-name="${m[1]}"]`);
    if (await k.count()) {
      await k.click({ force: true });
      if (shots && !wshot && (await page.locator('.kid.is-named').count()) >= 2) { await page.screenshot({ path: `${shots}/whoiswho.png` }); wshot = true; }
    }
  }
  await page.waitForTimeout(150);
}
if (!(await page.locator('.game-done').count())) fail('naming 4 children should end the game');
if ((await page.locator('.kid.is-named').count()) !== 4) fail('4 children named, one left over');
step('who is who: "Find Tom. He\'s got a blue T-shirt and he\'s reading a book." — 4 of 5 named');

// Android back button: back from a game returns to the home map instead of leaving the app.
await home();
await page.locator('.dock-btn[aria-label="Games"]').click({ force: true });
await page.waitForSelector('.games');
await page.goBack();
await page.waitForSelector('.home', { timeout: 5000 }).catch(() => fail('back from Games should show the home map'));
if (!page.url().startsWith(base)) fail('back must not leave the app');
step('Android back: from a game back to the home map (the app does not close)');

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
  const ans = said.includes('sings') ? 'bird' : said.includes('quack') ? 'duck' : '';
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
    if (await page.locator('.btn-chant-done:not([hidden])').count()) await page.locator('.btn-chant-done').click({ force: true });
  else if (await page.locator('.btn-next:not([hidden])').count()) await page.locator('.btn-next:not([hidden])').click({ force: true });
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

// ---------- C12: badges & certificates ----------
// (still in the parent area; Little Bix was completed in the B9 check)
if (!(await page.locator('.p-cert-row .p-btn[data-level="L0"]').count())) fail('parent area should offer the Little Bix certificate');
if (await page.locator('.p-cert-row .p-btn[data-level="L2"]').count()) fail('no Starters certificate before all 28 islands');
await setState((st) => {
  st.topics.animals.completed = 3;
  for (const w of ['dog', 'cat', 'fish', 'bird', 'duck', 'cow']) st.words[`animals/${w}`] = { said: true, tries: 1 };
  st.childName = 'Su';
});
await home();
await page.locator('.dock-btn[aria-label="My Words"]').click({ force: true });
await page.waitForSelector('.book');
if ((await page.locator('.book-page[data-unit="animals"] .medal').getAttribute('data-tier')) !== 'gold') fail('all stickers + 3 times → gold badge');
if ((await page.locator('.book-page[data-unit="colors"] .medal').getAttribute('data-tier')) !== 'none') fail('unfinished unit has no badge');
if (!(await page.locator('.trophy.is-got[data-level="L0"]').count())) fail('Little Bix trophy should be earned');
if (!(await page.locator('.trophy.is-locked[data-level="L2"]').count())) fail('Starters trophy still locked');
if (shots) await page.screenshot({ path: `${shots}/badges.png` });
await page.locator('.trophy[data-level="L0"]').click({ force: true });
await page.waitForSelector('.cert');
const certText = await page.locator('.cert').textContent();
if (!certText.includes('Su') || !certText.includes('Little Bix') || !certText.includes('6 islands')) fail('certificate text: ' + certText);
await page.evaluate(() => (window.print = () => (window.__printed = true)));
await page.locator('.cert-print').click({ force: true });
if (!(await page.evaluate(() => window.__printed))) fail('print button should open printing');
if (shots) { await page.waitForTimeout(1500); await page.screenshot({ path: `${shots}/certificate.png` }); await page.emulateMedia({ media: 'print' }); await page.screenshot({ path: `${shots}/certificate-print.png` }); await page.emulateMedia({ media: 'screen' }); }
step('badges: bronze/silver/gold per unit, trophy per level, printable certificate');
await home();
await page.locator('.btn-parent').click({ force: true });
await page.waitForSelector('.gate');
const [ca, cb] = (await page.locator('.gate-q').textContent()).match(/\d+/g).map(Number);
for (const ch of String(ca * cb)) await page.click(`.key:text-is("${ch}")`);
await page.click('.key-ok');
await page.waitForSelector('.p-kids');

// ---------- B10: several children on one device ----------
// (still in the parent area) add "Mia" → she becomes the active child with a fresh start.
await page.fill('.p-new-kid', 'Mia');
await page.locator('.p-btn[aria-label="Thêm bé"]').click({ force: true });
await page.waitForSelector('.p-kid.is-active[data-profile="p2"]');
const mia = await page.evaluate(() => JSON.parse(localStorage.getItem('efk.v1.p2')));
if (mia.childName !== 'Mia' || Object.keys(mia.topics).length) fail('new child should start fresh with her name');
const firstKid = await page.evaluate(() => JSON.parse(localStorage.getItem('efk.v1')));
if (!Object.keys(firstKid.topics).length) fail("first child's progress must stay in the original key");
await page.goto(base);
await page.waitForSelector('.who-btn');
if ((await page.locator('.who-btn').count()) !== 2) fail('start screen should show 2 children');
if (shots) await page.screenshot({ path: `${shots}/who.png` });
await page.evaluate(() => (window.__spoken.length = 0));
await page.locator('.who-btn[data-profile="p2"]').click({ force: true });
await page.waitForSelector('.home');
await page.waitForTimeout(800);
if (!(await page.evaluate(() => window.__spoken.some((t) => t.startsWith('Hi, Mia!'))))) fail('Bix should greet Mia');
if (await page.locator('.dock-btn[aria-label="My Words"] .badge').count()) fail('Mia has no stickers yet');
await page.goto(base);
await page.locator('.who-btn[data-profile="p1"]').click({ force: true });
await page.waitForSelector('.home');
if (!(await page.locator('.dock-btn[aria-label="My Words"] .badge').count())) fail('first child keeps her stickers');
step('profiles: add a child in the parent area, each taps their animal, progress kept apart');

// Remove Mia → single child again, plain Play button.
await page.locator('.btn-parent').click({ force: true });
await page.waitForSelector('.gate');
const [ra, rb] = (await page.locator('.gate-q').textContent()).match(/\d+/g).map(Number);
for (const ch of String(ra * rb)) await page.click(`.key:text-is("${ch}")`);
await page.click('.key-ok');
await page.waitForSelector('.p-kid[data-profile="p2"]');
await page.locator('.p-kid[data-profile="p2"] .p-btn-danger').click({ force: true });
await page.locator('.p-kid[data-profile="p2"] .p-btn-danger').click({ force: true });
await page.waitForFunction(() => !document.querySelector('.p-kid[data-profile="p2"]'));
if (await page.evaluate(() => localStorage.getItem('efk.v1.p2'))) fail("removed child's data should be deleted");
await page.goto(base);
await page.waitForSelector('.btn-play');
step('removing a child deletes only that child; one child → plain Play button');

// ---------- C11: music ----------
const ticks = () => page.evaluate(() => window.__ticks);
const toChant = async (unit) => {
  await page.goto(`${base}/?unit=${unit}`);
  await page.locator('.btn-play').click({ force: true });
  for (let i = 0; i < 600 && !(await page.locator('.chant').count()); i++) {
    if (await page.locator('.btn-chant-done:not([hidden])').count()) await page.locator('.btn-chant-done').click({ force: true });
  else if (await page.locator('.btn-next:not([hidden])').count()) await page.locator('.btn-next:not([hidden])').click({ force: true });
    else if (await page.locator('.btn-mic.is-ready').count()) await page.locator('.btn-mic.is-ready').click({ force: true });
    else if (await page.locator('.btn-did').count()) await page.locator('.btn-did').click({ force: true });
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
  await page.waitForSelector('.chant');
};
await toChant('l1-farm');
let t0 = await ticks();
await page.waitForTimeout(2500);
if ((await ticks()) - t0 < 3) fail('default music mode should play a tune under the chant');
if ((await page.locator('.chant-drum').getAttribute('title')) !== 'Old MacDonald Had a Farm') fail('farm chant should use Old MacDonald');
step('chant: a public-domain tune (Old MacDonald) plays under the farm chant');

// Default: no background music on the home screen.
await home();
t0 = await ticks();
await page.waitForTimeout(1500);
if ((await ticks()) !== t0) fail('no background music unless a parent turns it on');
// Parent picks "Vè + nhạc nền" → soft music at home, silence in a lesson.
await page.locator('.btn-parent').click({ force: true });
await page.waitForSelector('.gate');
const [ma, mb] = (await page.locator('.gate-q').textContent()).match(/\d+/g).map(Number);
for (const ch of String(ma * mb)) await page.click(`.key:text-is("${ch}")`);
await page.click('.key-ok');
await page.locator('.p-seg-btn[data-music="all"]').click({ force: true });
t0 = await ticks();
await page.locator('.p-btn[data-tune="twinkle"]').click({ force: true });
await page.waitForTimeout(1200);
if ((await ticks()) - t0 < 2) fail('tune preview should play');
await home();
t0 = await ticks();
await page.waitForTimeout(1500);
if ((await ticks()) - t0 < 2) fail('background music should play at home when turned on');
await page.locator('.island').first().click({ force: true });
await page.waitForSelector('.lesson');
await page.waitForTimeout(600);
t0 = await ticks();
await page.waitForTimeout(1200);
if ((await ticks()) !== t0) fail('background music must stop during a lesson');
// "Tắt nhạc" → the chant falls back to the plain drum.
await setState((st) => (st.settings.music = 'off'));
await toChant('l1-farm');
t0 = await ticks();
await page.waitForTimeout(2000);
if ((await ticks()) !== t0) fail('music off → no tune under the chant');
await setState((st) => (st.settings.music = 'chant'));
step('music: background only when chosen and only on calm screens; off means off');

// __MORE__

if (errors.length) fail('page errors: ' + errors.join(' | '));
await browser.close();
console.log('features e2e ok');
