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
// First visit online with the service worker on, then a reload with no network at all:
// the page and its fonts must come from the offline cache.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  // Real clock here: Playwright's fixed clock stalls font loading and the service worker.
  await page.goto(APP + '&sw=1');
  await page.waitForFunction(() => /As of/.test(document.getElementById('asOf').textContent));
  await page.waitForFunction(async () => {
    for (const k of await caches.keys()) {
      const reqs = await (await caches.open(k)).keys();
      if (reqs.some((r) => r.url.startsWith('https://fonts.gstatic.com/')) && reqs.some((r) => r.url.startsWith('https://fonts.googleapis.com/'))) return true;
    }
    return false;
  }, null, { timeout: 15000 });
  // The service worker caches the font files one by one: wait until the count stops growing.
  const count = () => page.evaluate(async () => {
    let n = 0;
    for (const k of await caches.keys()) n += (await (await caches.open(k)).keys()).filter((r) => r.url.startsWith('https://fonts.gstatic.com/')).length;
    return n;
  });
  for (let prev = -1, n = await count(); n !== prev; prev = n, await page.waitForTimeout(1000), n = await count());
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => /No connection/.test(document.getElementById('asOf').textContent));
  // Fonts with display=swap load after the first paint; give them a moment.
  await page.waitForFunction(() => [...document.fonts].some((f) => f.family === 'Instrument Serif' && f.status === 'loaded'), null, { timeout: 5000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() => ({
    serif: document.fonts.check('52px "Instrument Serif"'),
    sans: document.fonts.check('16px "IBM Plex Sans"'),
    loaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + ' ' + f.weight),
    dateHeight: document.querySelector('.head-phone .date').getBoundingClientRect().height,
  }));
  await page.screenshot({ path: path('phone-offline-fonts'), fullPage: false });
  console.log('offline fonts', JSON.stringify(fonts));
  if (!fonts.serif || !fonts.loaded.some((f) => f.includes('Instrument Serif'))) console.log('OFFLINE FONTS MISSING');
  await ctx.close();
}

await browser.close();

// No dash used as punctuation in visible text: no em or en dash, no spaced hyphen.
const bad = texts.join('\n').split('\n').filter((l) => /[–—]| - /.test(l));
console.log(bad.length ? 'DASHES: ' + bad.join(' | ') : 'no dashes in visible text');
