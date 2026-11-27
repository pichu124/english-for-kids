// Privacy policy and terms: by link (?legal=…), from the parent area and from the welcome.
// Run: node tests/e2e/legal.mjs [baseUrl]
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

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(FAKES);
  await page.goto(base + '/?legal=privacy');
  await page.waitForSelector('[data-legal="privacy"] h1');
  const text = await page.locator('.lg-doc').textContent();
  for (const must of ['Không quảng cáo', 'không ghi âm', 'Google', 'Xoá tiến độ', 'localStorage']) if (!text.includes(must)) fail(`privacy policy mentions "${must}"`);
  await page.locator('[data-doc="terms"]').click();
  await page.waitForSelector('[data-legal="terms"]');
  if (!(await page.locator('.lg-doc').textContent()).includes('không liên kết với Cambridge')) fail('terms: not affiliated with Cambridge');
  await page.locator('.lg-back').click();
  await page.waitForSelector('.btn-play');
  step('?legal=privacy opens the policy (for an app store), terms one tap away, back to Play');
  // from the parent area, and back without a second maths question
  await page.locator('.btn-play').click({ force: true });
  await page.locator('.btn-parent').click();
  const [a, b] = (await page.locator('.gate-q').textContent()).match(/\d+/g).map(Number);
  for (const ch of String(a * b)) await page.click(`.key:text-is("${ch}")`);
  await page.click('.key-ok');
  await page.locator('.p-btn[data-legal="terms"]').click();
  await page.waitForSelector('[data-legal="terms"] h1');
  await page.locator('.lg-back').click();
  await page.waitForSelector('.p-wrap .p-card');
  if (await page.locator('.gate').count()) fail('back from the terms should not ask again');
  step('parent area → terms → back to the parent area');
  await page.close();
}
{
  const page = await browser.newPage({ viewport: { width: 640, height: 320 }, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(FAKES);
  await page.addInitScript(() => localStorage.removeItem('efk.welcome'));
  await page.goto(base);
  await page.locator('.wl-link[data-legal="privacy"]').click();
  await page.waitForSelector('[data-legal="privacy"]');
  const wide = await page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth + 1);
  if (wide) fail('no sideways scroll on a phone');
  await page.locator('.lg-back').click();
  await page.waitForSelector('.welcome [data-step="0"]');
  step('welcome → privacy policy → back to the welcome (phone)');
  await page.close();
}
if (errors.length) fail('page errors: ' + errors.join(' | '));
await browser.close();
console.log('legal e2e ok');
