// The Tonight line from the kitchen: screenshots with the Worker mocked, and a check that
// the line is hidden when the kitchen block is null. Every value here is made up.
//   npm run serve, then: npm run tonight-shots
// With LIVE_TODO_CODE=<dev code> it also shoots the page against a local wrangler dev Worker.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CODE = 'abcdefgh23456789'; // made up; the Worker is mocked
const BASE = process.env.APP || 'http://localhost:8080/morning/';
const OUT = new URL('../verify-shots/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const file = (n) => fileURLToPath(new URL(n + '.png', OUT));

const pad = (n) => String(n).padStart(2, '0');
const day = (plus) => { const d = new Date(Date.now() + plus * 864e5); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

function answer(kitchen) {
  return {
    now: new Date().toISOString(),
    todos: { items: [{ text: 'Email the landlord about the heating' }, { text: 'Buy new bike lights' }], updated: new Date().toISOString(), yesterday: { count: 0, items: [] } },
    calendar: { events: [], sent: new Date().toISOString(), stale: false },
    fixed: { events: [], countdowns: [] },
    weather: { error: "Weather can't load right now" },
    arsenal: { error: "Arsenal can't load right now" },
    bins: { collections: [{ date: day(1), types: ['GFT'] }] },
    birthdays: { birthdays: [] },
    news: { error: "News can't load right now" },
    kitchen,
  };
}

const browser = await chromium.launch();
const errors = [];
let failed = false;

async function shoot(kitchen, viewport, name) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/morning/**', (r) => r.fulfill({ json: answer(kitchen), headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.route('**/site.**espn.com/**', (r) => r.abort());
  await page.goto(BASE + '?c=' + CODE);
  await page.waitForSelector('#bin:not([hidden])');
  await page.evaluate(() => document.fonts.ready);
  const shown = await page.isVisible('#tonight');
  const text = shown ? await page.textContent('#tonight') : '';
  if (name) await page.screenshot({ path: file(name) });
  await ctx.close();
  return { shown, text };
}

const phone = { width: 390, height: 844 };
const both = { tonight: { kind: 'pizza', title: 'Pizza night', veg: false }, mixToday: true, pizzaOn: day(3) };
let r = await shoot({ tonight: { kind: 'recipe', title: 'Pasta alla Norma', veg: true }, mixToday: true, pizzaOn: day(3) }, phone, 'tonight');
console.log('tonight + mix:', r.text.trim());
failed ||= !(r.shown && /Tonight: Pasta alla Norma\. Mix the dough today/.test(r.text));
r = await shoot(both, { width: 1280, height: 820 }, 'tonight-laptop');
failed ||= !(r.shown && /Tonight: Pizza night/.test(r.text));
r = await shoot({ tonight: null, mixToday: true, pizzaOn: day(3) }, phone, 'tonight-mix-only');
console.log('mix only:', r.text.trim());
failed ||= !(r.shown && /^Mix the dough today for \w+day's pizza night$/.test(r.text.trim()));
r = await shoot(null, phone, 'tonight-hidden');
console.log('null block, line shown:', r.shown);
failed ||= r.shown;
r = await shoot({ error: "Kitchen can't load right now" }, phone);
failed ||= r.shown;

if (process.env.LIVE_TODO_CODE) {
  const ctx = await browser.newContext({ viewport: phone, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE + '?c=' + process.env.LIVE_TODO_CODE);
  await page.waitForSelector('#tonight:not([hidden])', { timeout: 20000 });
  console.log('live:', (await page.textContent('#tonight')).trim());
  await page.screenshot({ path: file('tonight-live') });
  await ctx.close();
}

await browser.close();
if (errors.length) { console.error(errors.join('\n')); failed = true; }
console.log(failed ? 'FAILED' : 'ok');
process.exit(failed ? 1 : 0);
