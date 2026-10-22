// Past weeks (morning/oracle/): the Oracle's questions newest first with the answer, Put aside or Not
// answered yet; the way back to Morning; the empty list; the hub away and Retry; no code; the phone; and
// that the service worker never keeps this page in Morning's place. Against a mocked Worker; every value
// here is made up.
//   PORT=8095 npm run serve, then: APP=http://localhost:8095/morning/ npm run oracle-check
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CODE = 'abcdefgh23456789';
const BASE = process.env.APP || 'http://localhost:8080/morning/';
const OUT = new URL('../verify-shots/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const file = (n) => fileURLToPath(new URL(n + '.png', OUT));
const NOW = '2026-10-25T18:30:00+01:00';

let failed = false;
let passes = 0, fails = 0;
const check = (ok, what) => { if (!ok) { fails++; failed = true; console.error('FAIL:', what); } else { passes++; console.log('ok:', what); } };

const WEEKS = [
  { week: '2026-10-19', label: 'Week 43', question: 'You passed on "Call the bank" seven times, then did it in six minutes on Friday. What was different about Friday?', state: 'open', answer: null, askedAt: '2026-10-25T05:02:00.000Z', answeredAt: null },
  { week: '2026-10-12', label: 'Week 42', question: 'You flagged "Book the flights" twice and it is still open. What is stopping you?', state: 'answered', answer: 'The dates are not fixed yet.\nI will ask on Monday.', askedAt: '2026-10-18T05:02:00.000Z', answeredAt: '2026-10-18T09:12:00.000Z' },
  { week: '2026-09-28', label: 'Week 40', question: 'Wednesday evenings were drained three weeks running. What happens on Wednesdays?', state: 'aside', answer: null, askedAt: '2026-10-04T05:02:00.000Z', answeredAt: '2026-10-04T10:00:00.000Z' },
  { week: '2025-12-29', label: 'Week 1', question: 'You finished nine things on the last day of the year. Which one mattered most?', state: 'answered', answer: 'The tax letter.', askedAt: '2026-01-04T05:02:00.000Z', answeredAt: '2026-01-04T11:00:00.000Z' },
];

const browser = await chromium.launch();
async function open(viewport, { weeks = WEEKS, status = 200, code = CODE, path = 'oracle/' } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: viewport.width < 700 });
  const page = await ctx.newPage();
  const errors = [];
  const logs = [];
  const w = { gets: 0, status, weeks };
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => logs.push(m.text()));
  await page.clock.setFixedTime(new Date(NOW));
  await page.route('**/api/oracle/**', (r) => {
    const h = { 'Access-Control-Allow-Origin': '*' };
    w.gets++;
    if (!new URL(r.request().url()).pathname.endsWith('/list')) return r.fulfill({ status: 404, json: { error: 'not found' }, headers: h });
    if (w.status !== 200) return r.fulfill({ status: w.status, json: { error: 'not configured' }, headers: h });
    return r.fulfill({ json: { weeks: structuredClone(w.weeks) }, headers: h });
  });
  await page.goto(BASE + path + (code ? '?c=' + code : ''));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  return { ctx, page, errors, logs, w };
}
const state = (page) => page.evaluate(() => {
  const vis = (el) => !!el && !el.closest('[hidden]') && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
  return {
    title: document.title, h1: document.querySelector('h1').textContent, sub: document.querySelector('.sub').textContent,
    back: document.getElementById('back').getAttribute('href'), app: vis(document.getElementById('app')), nocode: vis(document.getElementById('nocode')),
    rows: [...document.querySelectorAll('.pw')].map((li) => [li.querySelector('.pw-label').textContent, li.querySelector('.pw-days').textContent,
      li.querySelector('.pw-q').textContent, li.querySelector('.pw-a').textContent.trim()].join(' | ')),
    labelFont: document.querySelector('.pw-label') ? getComputedStyle(document.querySelector('.pw-label')).fontFamily : '',
    quiet: [...document.querySelectorAll('.pw-quiet')].map((e) => getComputedStyle(e).color),
    note: document.querySelector('.pw-note') ? document.querySelector('.pw-note').textContent.trim() : '',
    sr: [...document.querySelectorAll('.pw-a .sr')].map((e) => e.textContent),
    side: (() => { const r = document.querySelector('.pw'); if (!r) return null; const a = r.querySelector('.pw-week').getBoundingClientRect(), b = r.querySelector('.pw-body').getBoundingClientRect(); return b.left > a.right ? 'beside' : b.top >= a.bottom ? 'under' : 'overlap'; })(),
    targets: [...document.querySelectorAll('a, button')].filter(vis).map((b) => Math.round(b.getBoundingClientRect().height)),
    overflow: document.documentElement.scrollWidth > innerWidth,
  };
});

const ROWS = [
  'Week 43 | 19 to 25 Oct | You passed on "Call the bank" seven times, then did it in six minutes on Friday. What was different about Friday? | Not answered yet',
  'Week 42 | 12 to 18 Oct | You flagged "Book the flights" twice and it is still open. What is stopping you? | You said: The dates are not fixed yet.\nI will ask on Monday.',
  'Week 40 | 28 Sep to 4 Oct | Wednesday evenings were drained three weeks running. What happens on Wednesdays? | Put aside',
  'Week 1 | 29 Dec to 4 Jan | You finished nine things on the last day of the year. Which one mattered most? | You said: The tax letter.',
];
for (const [name, viewport] of [['oracle-page-pc', { width: 1440, height: 1000 }], ['oracle-page-phone', { width: 390, height: 844 }]]) {
  const pc = viewport.width >= 1100;
  const { ctx, page, errors, logs, w } = await open(viewport);
  const s = await state(page);
  check(s.title === 'Past weeks' && s.h1 === 'Past weeks' && s.sub === 'One question a week, and what you said.', name + ': the title and the subtitle');
  check(s.back === '../?c=' + CODE && w.gets === 1, name + ': the way back to Morning keeps the code: ' + s.back);
  check(JSON.stringify(s.rows) === JSON.stringify(ROWS), name + ': newest first, the three states: ' + JSON.stringify(s.rows));
  check(/Barlow Condensed/.test(s.labelFont) && s.quiet.length === 2 && s.sr.join() === 'You said: ,You said: ', name + ': the label in Barlow Condensed, two quiet states, "You said" for screen readers');
  check(s.side === (pc ? 'beside' : 'under') && !s.overflow && (pc || s.targets.every((x) => x >= 44)), name + ': the layout, nothing sideways, 44 px on the phone: ' + JSON.stringify({ side: s.side, targets: s.targets }));
  check(!logs.some((x) => /Call the bank|Book the flights|dates are not fixed|tax letter/.test(x)), name + ': no question or answer in the console');
  check(errors.length === 0, name + ': no page errors ' + errors.join('; '));
  await page.screenshot({ path: file(name), fullPage: true });
  await ctx.close();
}
{
  const { ctx, page } = await open({ width: 390, height: 844 }, { weeks: [] });
  const s = await state(page);
  check(!s.rows.length && s.note === 'No questions yet. The first one comes on a Sunday morning.', 'empty: one line: ' + s.note);
  await ctx.close();
}
{
  const { ctx, page, w } = await open({ width: 1440, height: 1000 }, { status: 503 });
  let s = await state(page);
  check(!s.rows.length && s.note === 'Can’t reach the hub. Retry', 'the hub away: says so, with Retry: ' + s.note);
  await page.screenshot({ path: file('oracle-page-away') });
  w.status = 200;
  await page.click('#retry');
  await page.waitForTimeout(300);
  s = await state(page);
  check(s.rows.length === 4 && w.gets === 2, 'Retry reads again and shows the weeks');
  await ctx.close();
}
{
  const { ctx, page } = await open({ width: 390, height: 844 }, { code: '' });
  const s = await state(page);
  check(!s.app && s.nocode, 'no code: the page says to open Morning from the private link');
  await ctx.close();
}
// The service worker (on with &sw=1 locally): a visit to Past weeks is kept under its own path, and
// Morning's own copy stays Morning.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, json: { error: 'mocked' }, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await ctx.route('**/site.**espn.com/**', (r) => r.abort());
  await page.goto(BASE + '?c=' + CODE + '&sw=1');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.goto(BASE + 'oracle/?c=' + CODE);
  await page.waitForTimeout(800);
  const kept = await page.evaluate(async () => {
    const out = {};
    for (const k of await caches.keys()) {
      const c = await caches.open(k);
      for (const req of await c.keys()) {
        const p = new URL(req.url).pathname;
        if (p.endsWith('/') ) out[p] = /<title>([^<]*)<\/title>/.exec(await (await c.match(req)).text())?.[1] || '';
      }
    }
    return out;
  });
  const root = new URL(BASE).pathname;
  check(kept[root] === 'Morning' && kept[root + 'oracle/'] === 'Past weeks', 'service worker: Morning stays Morning, Past weeks under its own path: ' + JSON.stringify(kept));
  await ctx.close();
}
await browser.close();
console.log(`${passes} of ${passes + fails} oracle checks pass`);
if (failed) process.exit(1);
console.log('all oracle checks pass');
