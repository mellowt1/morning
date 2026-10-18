// Gym card: the routine due next in Lift, today's workout once it is done, hidden before Lift
// has ever sent. Against a mocked Worker; every value is made up.
//   PORT=8095 npm run serve, then: APP=http://localhost:8095/morning/ npm run lift-check
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CODE = 'abcdefgh23456789';
const BASE = process.env.APP || 'http://localhost:8080/morning/';
const OUT = new URL('../verify-shots/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const file = (n) => fileURLToPath(new URL(n + '.png', OUT));
const NOW = '2026-10-18T08:30:00+02:00'; // a Sunday

let failed = false;
const check = (ok, what) => { if (!ok) { failed = true; console.error('FAIL:', what); } else console.log('ok:', what); };

const NEXT = {
  next: { name: 'Back', items: [
    { name: 'Lat Pulldown (Cable)', sets: 4, range: '8–10', kg: 40, up: false },
    { name: 'Dumbbell Row', sets: 3, range: '15–20', kg: 34, up: true },
    { name: 'Seated Cable Row', sets: 4, range: '10–12', kg: 33, up: true },
  ] },
  nextDay: '2026-10-18', today: true, doneToday: null, week: { done: 1, planned: 3 },
  rotation: ['Back', 'Chest', 'Shoulders'], last: { name: 'Shoulders', date: '2026-10-17', minutes: 76, volume: 8200, prs: 1 }, at: NOW,
};
const DONE = { ...NEXT, next: { name: 'Chest', items: [] }, nextDay: '2026-10-21', today: false, doneToday: { name: 'Back', volume: 9840, prs: 2 }, week: { done: 2, planned: 3 } };
const LATER = { ...NEXT, nextDay: '2026-10-21', today: false };

const browser = await chromium.launch();
async function open(lift, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: viewport.width < 700 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date(NOW));
  await page.addInitScript(([code, day]) => {
    try {
      localStorage.setItem('morning.code', JSON.stringify(code));
      localStorage.setItem('morning.enteredOn', JSON.stringify(day));
    } catch (e) {}
  }, [CODE, NOW.slice(0, 10)]);
  const h = { 'Access-Control-Allow-Origin': '*' };
  await page.route('**/api/hiscores/**', (r) => r.fulfill({ status: 404, json: { error: 'x' }, headers: h }));
  await page.route('**/api/morning/**', (r) => r.fulfill({ headers: h, json: {
    now: new Date(NOW).toISOString(), todos: { items: [], updated: NOW, yesterday: { count: 0, items: [] } }, calendar: { events: [], sent: NOW, stale: false },
    fixed: { events: [], countdowns: [] }, weather: null, arsenal: null, bins: null, birthdays: { birthdays: [] }, news: { items: [] }, kitchen: null, projects: null, german: null, week: null,
    lift } }));
  await page.route('**/site.**espn.com/**', (r) => r.abort());
  await page.goto(BASE + '?c=' + CODE);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  return { page, ctx, errors };
}
const shown = (page, sel) => page.$eval(sel, (e) => !e.hidden && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0).catch(() => false);
const text = (page, sel) => page.$eval(sel, (e) => [...e.querySelectorAll('.fx-next, .fx-sub, .fx-when')].map((x) => x.textContent).join(' | ') || e.textContent.trim());

for (const [name, viewport] of [['lift-pc', { width: 1440, height: 1000 }], ['lift-phone', { width: 390, height: 844 }]]) {
  const { page, ctx, errors } = await open(NEXT, viewport);
  check(await shown(page, '#lift'), name + ': card shows');
  check(await text(page, '#liftBody') === 'Back | 3 exercises · 2 going up | Today', name + ': next up ' + await text(page, '#liftBody'));
  check(await text(page, '#liftNote') === '1 of 3 this week', name + ': week note');
  check((await page.getAttribute('#lift', 'href')) === 'https://mellowt1.github.io/lift/', name + ': opens Lift');
  await page.$eval('#lift', (e) => e.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: file(name) });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ': no sideways scroll');
  check(errors.length === 0, name + ': no page errors ' + errors.join('; '));
  await ctx.close();
}
{
  const { page, ctx, errors } = await open(DONE, { width: 1440, height: 1000 });
  check(await text(page, '#liftBody') === 'Back done | 9,840 kg · 2 PRs | Next: Chest', 'done today: ' + await text(page, '#liftBody'));
  await page.$eval('#lift', (e) => e.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: file('lift-done') });
  check(errors.length === 0, 'done today: no page errors ' + errors.join('; '));
  await ctx.close();
}
{
  const { page, ctx } = await open(LATER, { width: 1440, height: 1000 });
  check((await text(page, '#liftBody')).endsWith('Wed'), 'a later gym day shows its weekday');
  await ctx.close();
}
{
  const { page, ctx } = await open(null, { width: 1440, height: 1000 });
  check(!(await shown(page, '#lift')), 'hidden before Lift has sent');
  await ctx.close();
}
await browser.close();
if (failed) process.exit(1);
console.log('all passed');
