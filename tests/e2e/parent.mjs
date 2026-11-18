/** Parent area check: gate, name, time limit → rest screen, reset. node tests/e2e/parent.mjs [baseUrl] [shotDir] */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:4173/';
const shots = process.argv[3];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(readFileSync(new URL('./fakes.js', import.meta.url), 'utf8'));
await page.goto(base);
// seed a few days of history
await page.evaluate(() => {
  const d = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  localStorage.setItem('efk.v1', JSON.stringify({
    topics: { animals: { completed: 2 }, colors: { completed: 1 } },
    words: { 'animals/dog': { said: true, by: 'auto', tries: 2, heard: 'dog' }, 'animals/cat': { said: true, by: 'parent', tries: 3, heard: 'cut' }, 'animals/cow': { said: false, tries: 2, heard: 'how' } },
    days: { [d(0)]: { seconds: 420, lessons: 1, auto: 5, parent: 2, miss: 3, noVoice: 0 }, [d(1)]: { seconds: 360, lessons: 1, auto: 4, parent: 1, miss: 2, noVoice: 1 }, [d(3)]: { seconds: 300, lessons: 1, auto: 3, parent: 3, miss: 1, noVoice: 0 } },
    blocks: { inventory: { animals: 1 }, placed: [], totalEarned: 3 },
  }));
});
await page.reload();
await page.click('.btn-play', { force: true });
await page.click('.btn-parent');
await page.waitForSelector('.gate');
if (shots) await page.screenshot({ path: `${shots}/parent-gate.png` });

// wrong answer keeps the gate
await page.click('.key:text("1")');
await page.click('.key-ok');
if (!(await page.locator('.gate').count())) throw new Error('wrong answer should not unlock');
// right answer
const [a, b] = (await page.locator('.gate-q').textContent()).match(/\d+/g).map(Number);
for (const ch of String(a * b)) await page.click(`.key:text-is("${ch}")`);
await page.click('.key-ok');
await page.waitForSelector('.p-wrap');
console.log('✓ math gate');

await page.fill('.p-name', 'Su');
const name = await page.evaluate(() => JSON.parse(localStorage.getItem('efk.v1')).childName);
if (name !== 'Su') throw new Error('name not saved');
console.log('✓ child name saved');
if (shots) await page.screenshot({ path: `${shots}/parent-panel.png`, fullPage: true });

// 5-minute limit: today already has 7 minutes → rest screen
await page.click('.p-seg-btn:text("5 phút")');
await page.click('.p-btn-main:text("Xong")');
await page.waitForSelector('.rest');
console.log('✓ time limit sends Bix to sleep');
if (shots) await page.screenshot({ path: `${shots}/rest.png` });

// parent grants +10 minutes → home again
await page.click('.btn-parent');
const [c, e] = (await page.locator('.gate-q').textContent()).match(/\d+/g).map(Number);
for (const ch of String(c * e)) await page.click(`.key:text-is("${ch}")`);
await page.click('.key-ok');
await page.click('.p-btn:text("+10 phút")');
await page.click('.p-btn-main:text("Xong")');
await page.waitForSelector('.home');
console.log('✓ +10 minutes lets the child play again');

// reset (two taps)
await page.click('.btn-parent');
const [f, g] = (await page.locator('.gate-q').textContent()).match(/\d+/g).map(Number);
for (const ch of String(f * g)) await page.click(`.key:text-is("${ch}")`);
await page.click('.key-ok');
await page.click('.p-btn-danger');
await page.click('.p-btn-danger');
const st = await page.evaluate(() => JSON.parse(localStorage.getItem('efk.v1')));
if (Object.keys(st.topics).length || st.blocks.totalEarned || st.childName !== 'Su') throw new Error('reset wrong ' + JSON.stringify(st));
console.log('✓ reset clears progress, keeps name');

// The parent area is long: it must scroll with a finger on a phone/tablet.
{
  const { devices } = require('playwright');
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const ph = await ctx.newPage();
  await ph.goto(base);
  await ph.locator('.btn-play').click({ force: true });
  await ph.locator('.btn-parent').click();
  const [x, y] = (await ph.locator('.gate-q').textContent()).match(/\d+/g).map(Number);
  for (const ch of String(x * y)) await ph.locator(`.key:text-is("${ch}")`).click();
  await ph.locator('.key-ok').click();
  await ph.waitForSelector('.p-wrap');
  const cdp = await ctx.newCDPSession(ph);
  const vp = ph.viewportSize();
  const cx = Math.round(vp.width / 2);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: Math.round(vp.height * 0.8) }] });
  for (let i = 1; i <= 12; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx, y: Math.round(vp.height * (0.8 - (0.6 * i) / 12)) }] });
    await ph.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await ph.waitForTimeout(600);
  const top = await ph.evaluate(() => document.querySelector('.screen-parent').scrollTop);
  if (top < 100) throw new Error(`parent area did not scroll with a finger swipe (scrollTop=${top})`);
  console.log('✓ parent area scrolls with a finger on a phone');
  await ctx.close();
}

if (errors.length) throw new Error(errors.join('\n'));
await browser.close();
