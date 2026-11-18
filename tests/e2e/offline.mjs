/** PWA check: installable + works offline after first load. node tests/e2e/offline.mjs [baseUrl] */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:4173/';

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
await page.addInitScript(readFileSync(new URL('./fakes.js', import.meta.url), 'utf8'));
await page.goto(base);
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForTimeout(500);

const cdp = await context.newCDPSession(page);
const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
if (installabilityErrors.length) throw new Error('not installable: ' + JSON.stringify(installabilityErrors));
const manifest = await cdp.send('Page.getAppManifest');
if (manifest.errors?.length) throw new Error('manifest errors: ' + JSON.stringify(manifest.errors));
console.log('✓ installable (manifest + service worker OK)');

await context.setOffline(true);
await page.reload();
await page.click('.btn-play', { force: true });
await page.waitForSelector('.home');
const islands = await page.locator('.island').count();
if (islands < 5) throw new Error(`offline: expected the Starters islands, got ${islands}`);
await page.locator('.island').nth(3).click({ force: true });
await page.waitForSelector('.listen .word-card');
const font = await page.evaluate(() => document.fonts.check('800 20px "Baloo 2"'));
console.log(`✓ works offline (home + lesson load; font cached: ${font})`);
await browser.close();
