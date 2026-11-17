/** Render public/icons/icon.svg to the PNG sizes Android needs. Run: npm run icons */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
async function render(size, file, { maskable = false } = {}) {
  await page.setViewportSize({ width: size, height: size });
  // Maskable icons: full-bleed background, artwork inside the 80% safe zone.
  const inner = maskable ? Math.round(size * 0.78) : size;
  const bg = maskable ? '#7cc8ff' : 'transparent';
  const art = maskable ? svg.replace('rx="112"/></clipPath>', 'rx="0"/></clipPath>') : svg;
  await page.setContent(`<html><body style="margin:0;background:${bg};display:grid;place-items:center;height:${size}px">
    <div style="width:${inner}px;height:${inner}px">${art.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`);
  await page.screenshot({ path: new URL(`../public/icons/${file}`, import.meta.url).pathname, omitBackground: !maskable });
}
await render(192, 'icon-192.png');
await render(512, 'icon-512.png');
await render(512, 'maskable-512.png', { maskable: true });
await browser.close();
console.log('icons written');
