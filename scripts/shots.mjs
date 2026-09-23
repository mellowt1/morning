// Screenshots of the local page against the local Worker, into verify-shots/ (gitignored).
//   Worker: cd ../todo/worker; npx wrangler dev   (dev values, never the real code)
//   Page:   npm run serve
//   Then:   npm run shots
// The code comes from MORNING_CODE, or from ../todo/worker/.dev.vars.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let code = process.env.MORNING_CODE || '';
if (!code) {
  try {
    code = (readFileSync(new URL('../../todo/worker/.dev.vars', import.meta.url), 'utf8').match(/^TODO_CODE=(\S+)/m) || [])[1] || '';
  } catch { /* no dev vars */ }
}
if (!code) throw new Error('set MORNING_CODE to the dev code');

const APP = 'http://localhost:8080/morning/?c=' + code;
const OUT = new URL('../verify-shots/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const path = (n) => fileURLToPath(new URL(n + '.png', OUT));

// Light: tomorrow at 07:42 in The Hague. Dark: now, if it is after sunset, else 22:00 tonight.
const morning = new Date(process.env.LIGHT_AT || '2026-09-24T05:42:00Z');
const night = process.env.DARK_AT ? new Date(process.env.DARK_AT) : null;

const browser = await chromium.launch();
async function shot(name, viewport, at, { full = true, offline = false, url = APP } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (at) await page.clock.setFixedTime(at);
  if (offline) {
    await page.goto(url);
    await page.waitForFunction(() => /As of/.test(document.getElementById('asOf')?.textContent || ''));
    await page.route('**/api/morning/**', (r) => r.abort());
    await page.reload();
    await page.waitForFunction(() => /No connection/.test(document.getElementById('asOf')?.textContent || ''));
  } else {
    await page.goto(url);
    await page.waitForFunction(() => document.getElementById('nocode') && (!document.getElementById('nocode').hidden || /As of/.test(document.getElementById('asOf').textContent)), null, { timeout: 15000 });
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path(name), fullPage: full });
  const info = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    overflow: document.documentElement.scrollWidth > innerWidth,
    text: document.body.innerText,
  }));
  console.log(name, info.theme, info.overflow ? 'HORIZONTAL OVERFLOW' : 'fits', errors.length ? 'ERRORS ' + errors.join('; ') : '');
  await ctx.close();
  return info;
}

const texts = [];
texts.push((await shot('phone-light', { width: 390, height: 844 }, morning)).text);
texts.push((await shot('phone-dark', { width: 390, height: 844 }, night)).text);
texts.push((await shot('laptop-light', { width: 1280, height: 820 }, morning)).text);
texts.push((await shot('laptop-dark', { width: 1280, height: 820 }, night)).text);
texts.push((await shot('tablet-light', { width: 900, height: 1100 }, morning)).text);
texts.push((await shot('phone-offline', { width: 390, height: 844 }, morning, { offline: true })).text);
texts.push((await shot('phone-nocode', { width: 390, height: 844 }, morning, { url: 'http://localhost:8080/morning/' })).text);
await browser.close();

// No dash used as punctuation in visible text: no em or en dash, no spaced hyphen.
const bad = texts.join('\n').split('\n').filter((l) => /[–—]| - /.test(l));
console.log(bad.length ? 'DASHES: ' + bad.join(' | ') : 'no dashes in visible text');
