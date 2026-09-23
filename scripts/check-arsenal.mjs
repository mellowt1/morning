// The Arsenal fallback: when the Worker's arsenal block is an error, the page asks ESPN itself.
// The Worker is mocked here; ESPN is the real one unless a step blocks it.
//   npm run serve, then: npm run check-arsenal
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const CODE = 'abcdefgh23456789'; // made up; the Worker is mocked
const APP = 'http://localhost:8080/morning/?c=' + CODE;
const OUT = new URL('../verify-shots/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const answer = (arsenal) => ({
  now: new Date().toISOString(),
  todos: { items: [{ text: 'A made up task' }], updated: null },
  calendar: { events: [], sent: null, stale: true },
  fixed: { events: [], countdowns: [] },
  weather: { error: "Weather can't load right now" },
  arsenal,
  bins: null,
});
const WORKER_OK = { next: { opponent: 'Fictional Rovers', home: false, competition: 'Premier League', kickoff: new Date(Date.now() + 3 * 86400000).toISOString(), live: false }, last: null };

const browser = await chromium.launch();
async function run({ arsenal, blockEspn = false, ctx }) {
  const own = !ctx;
  ctx = ctx || await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const espn = [];
  await page.route('http://localhost:8787/**', (r) => r.fulfill({ json: answer(arsenal), headers: { 'Access-Control-Allow-Origin': '*' } }));
  page.on('request', (r) => { if (r.url().includes('espn.com')) espn.push(r.url()); });
  if (blockEspn) await page.route(/espn\.com/, (r) => r.abort());
  await page.goto(APP);
  await page.waitForFunction(() => /As of/.test(document.getElementById('asOf').textContent));
  await page.waitForTimeout(3000);
  const text = await page.locator('#arsenal').innerText();
  return { page, ctx, own, espn, text };
}

// 1. Worker says Arsenal can't load: the page fetches ESPN and shows the real fixture.
const a = await run({ arsenal: { error: "Arsenal can't load right now" } });
console.log('direct:', a.text.replace(/\n+/g, ' | '), '| ESPN requests', a.espn.length);
assert.match(a.text, /Next: /);
assert.match(a.text, /Last: /);
assert.ok(a.espn.some((u) => u.startsWith('https://site.web.api.espn.com/')));
await a.page.screenshot({ path: fileURLToPath(new URL('arsenal-direct.png', OUT)), fullPage: true });
await a.page.close();

// 2. Same browser within the hour: from localStorage, no ESPN request.
const b = await run({ arsenal: { error: "Arsenal can't load right now" }, ctx: a.ctx });
console.log('cached:', b.espn.length, 'ESPN requests');
assert.equal(b.espn.length, 0);
assert.match(b.text, /Next: /);
await a.ctx.close();

// 3. ESPN unreachable from the browser too: the calm error text.
const c = await run({ arsenal: { error: "Arsenal can't load right now" }, blockEspn: true });
console.log('both down:', c.text.replace(/\n+/g, ' | '));
assert.match(c.text, /Arsenal can't load right now/);
await c.page.screenshot({ path: fileURLToPath(new URL('arsenal-both-down.png', OUT)) });
await c.ctx.close();

// 4. Worker's block is fine: the page never calls ESPN.
const d = await run({ arsenal: WORKER_OK });
console.log('worker ok:', d.text.replace(/\n+/g, ' | '), '| ESPN requests', d.espn.length);
assert.equal(d.espn.length, 0);
assert.match(d.text, /Fictional Rovers v Arsenal/);
await d.ctx.close();

await browser.close();
console.log('arsenal fallback: all checks passed');
