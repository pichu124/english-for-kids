/** Drag-and-drop check for "My World". node tests/e2e/world.mjs [baseUrl] [screenshot.png] */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:4173/';
const shot = process.argv[3];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(readFileSync(new URL('./fakes.js', import.meta.url), 'utf8'));
await page.goto(base);
await page.evaluate(() =>
  localStorage.setItem('efk.v1', JSON.stringify({ blocks: { inventory: { animals: 6, family: 6, colors: 3, hello: 1 }, placed: [], totalEarned: 16 } })),
);
await page.reload();
await page.click('.btn-play', { force: true });
await page.click('.dock-btn[aria-label="My World"]', { force: true });
await page.waitForSelector('.world-grid');
await page.waitForTimeout(300);

const g = await page.locator('.world-grid').boundingBox();
const cell = g.width / 12;
const center = (x, y) => [g.x + (x + 0.5) * cell, g.y + (y + 0.5) * cell];
async function drag(from, to) {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, { steps: 4 });
  await page.mouse.move(...to, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(60);
}
const trayCenter = async (i) => {
  const b = await page.locator('.tray-item').nth(i).boundingBox();
  return [b.x + b.width / 2, b.y + b.height / 2];
};
// tray order follows topics: colors, animals, food, family, hello
const plan = [
  [1, 0, 6], [1, 1, 6], [1, 2, 6], [1, 3, 6], [1, 4, 6], [1, 5, 6], // grass floor
  [3, 1, 5], [3, 4, 5], [3, 1, 4], [3, 4, 4], [3, 2, 3], [3, 3, 3],   // brick walls
  [0, 2, 5], [0, 3, 5], [0, 3, 4], [4, 2, 2],                        // rainbow + star
];
for (const [t, x, y] of plan) await drag(await trayCenter(t), center(x, y));
let placed = await page.evaluate(() => JSON.parse(localStorage.getItem('efk.v1')).blocks.placed.length);
if (placed !== 16) throw new Error(`expected 16 placed, got ${placed}`);
console.log('✓ placed 16 blocks from the tray');

// occupied cell rejects a drop; empty tray type can't be dragged
await drag(await trayCenter(2), center(0, 6));
placed = await page.evaluate(() => JSON.parse(localStorage.getItem('efk.v1')).blocks.placed.length);
if (placed !== 16) throw new Error('food has 0 blocks, should not place');
console.log('✓ empty tray item cannot be placed');

// move a block
await drag(center(2, 2), center(8, 6));
const moved = await page.evaluate(() => JSON.parse(localStorage.getItem('efk.v1')).blocks.placed.find((p) => p.x === 8 && p.y === 6));
if (!moved) throw new Error('block did not move');
console.log('✓ moved a placed block');

// drag it off the world → back to the tray
await drag(center(8, 6), await trayCenter(4));
const s = await page.evaluate(() => JSON.parse(localStorage.getItem('efk.v1')).blocks);
if (s.placed.length !== 15 || s.inventory.hello !== 1) throw new Error('block did not return to tray ' + JSON.stringify(s.inventory));
console.log('✓ dragging off the world returns the block to the tray');
await drag(await trayCenter(4), center(2, 2));

if (shot) await page.screenshot({ path: shot });
if (errors.length) throw new Error(errors.join('\n'));
await browser.close();
