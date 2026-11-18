/** Levels + deep links. node tests/e2e/levels.mjs [baseUrl] [shotDir] */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = (process.argv[2] || 'http://localhost:4173/').replace(/\/$/, '');
const shots = process.argv[3];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(readFileSync(new URL('./fakes.js', import.meta.url), 'utf8'));
const step = (m) => console.log('✓', m);
const tap = (sel) => page.locator(sel).first().click({ force: true });

// 1. A link from casa-mamnon opens the unit right after Play
await page.goto(`${base}/?unit=l0-animals`);
await tap('.btn-play');
await page.waitForSelector('.listen .word-card');
if (page.url().includes('unit=')) throw new Error('deep link should be removed from the address bar');
if (await page.locator('.listen .word-label').count()) throw new Error('level 0 must not show written words');
if (shots) await page.screenshot({ path: `${shots}/l0-listen.png` });
step('?unit=l0-animals opens the unit; no written words at level 0');

// play through (listen → do-it → say) to the tap game and count the choices
let sawDoIt = false;
for (let i = 0; i < 400 && !(await page.locator('.play').count()); i++) {
  if (await page.locator('.btn-next:not([hidden])').count()) await tap('.btn-next:not([hidden])');
  else if (await page.locator('.btn-did:not([hidden])').count()) {
    if (!sawDoIt && shots) await page.screenshot({ path: `${shots}/l0-doit.png` });
    sawDoIt = true;
    await tap('.btn-did:not([hidden])');
  } else if (await page.locator('.btn-mic.is-ready').count()) await tap('.btn-mic');
  await page.waitForTimeout(80);
}
if (!sawDoIt) throw new Error('level 0 unit should have a do-it step');
step('do-it step: act out commands, tap ✓');
await page.waitForSelector('.play');
const choices = await page.locator('.word-card-play').count();
if (choices !== 3) throw new Error(`level 0 should offer 3 pictures, got ${choices}`);
step('level 0 tap game offers 3 pictures');

// 2. Home now shows level 0
await tap('.btn-home');
await page.waitForSelector('.home');
const l0 = await page.locator('.island').count();
const label = await page.locator('.home-level').innerText();
if (label !== 'Little Bix' || l0 < 1) throw new Error(`home should show Little Bix units, got "${label}" with ${l0}`);
if (shots) await page.screenshot({ path: `${shots}/l0-home.png` });
step(`home shows level "${label}" (${l0} unit)`);

// 3. Parent switches to Starters
await tap('.btn-parent');
const [a, b] = (await page.locator('.gate-q').textContent()).match(/\d+/g).map(Number);
for (const ch of String(a * b)) await page.click(`.key:text-is("${ch}")`);
await page.click('.key-ok');
await page.click('.p-seg-btn:has-text("Starters")');
await page.click('.p-btn-main:text("Xong")');
await page.waitForSelector('.home');
const l2 = await page.locator('.island').count();
if (l2 !== 8) throw new Error(`Starters should show 8 units, got ${l2}`);
step('parent switches the level to Starters → 8 units');

// 4. Public catalog for casa-mamnon
const cat = await (await page.request.get(`${base}/catalog.json`)).json();
const l1 = cat.units.find((u) => u.id === 'l1-body');
if (!l1 || l1.casa.luaTuoi !== '4-5' || l1.path !== '/?unit=l1-body') throw new Error('catalog.json is wrong');
step(`catalog.json lists ${cat.units.length} units with casa age groups`);

if (errors.length) throw new Error(errors.join('\n'));
await browser.close();
