// The Projects block: screenshots with the Worker mocked, and checks that it is hidden
// before the first push and that the bike weather is gone. Every value here is made up.
//   npm run serve, then: npm run projects-shots
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CODE = 'abcdefgh23456789'; // made up; the Worker is mocked
const BASE = process.env.APP || 'http://localhost:8080/morning/';
const OUT = new URL('../verify-shots/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const file = (n) => fileURLToPath(new URL(n + '.png', OUT));

const PROJECTS = {
  updated: new Date().toISOString(),
  projects: [
    { name: 'Garden planner', status: 'waiting', next: 'Pick a colour for the beds' },
    { name: 'Recipe box', status: 'live', next: 'Add three soups' },
    { name: 'Language drills', status: 'next', next: 'Answer two questions to start' },
    { name: 'Old photo archive', status: 'parked', next: '' },
  ],
  parked: [{ text: 'Move passwords to a manager', from: 'Admin' }, { text: 'Tidy the downloads folder', from: '' }],
};

function answer(projects) {
  return {
    now: new Date().toISOString(),
    todos: { items: [{ text: 'Email the landlord about the heating' }, { text: 'Call the dentist' }], updated: new Date().toISOString(), yesterday: { count: 0, items: [] } },
    calendar: { events: [], sent: new Date().toISOString(), stale: false },
    fixed: { events: [], countdowns: [] },
    weather: { error: "Weather can't load right now" },
    arsenal: { error: "Arsenal can't load right now" },
    bins: { collections: [] },
    birthdays: { birthdays: [] },
    news: { error: "News can't load right now" },
    kitchen: null,
    projects,
  };
}

const browser = await chromium.launch();
const errors = [];
let failed = false;

async function shoot(projects, viewport, name, open = false) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/morning/**', (r) => r.fulfill({ json: answer(projects), headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.route('**/site.**espn.com/**', (r) => r.abort());
  await page.goto(BASE + '?c=' + CODE);
  await page.waitForSelector('#todoList li:not(.empty)');
  await page.evaluate(() => document.fonts.ready);
  if (open) await page.click('#parked summary');
  const out = {
    shown: await page.isVisible('#projects'),
    rows: await page.locator('#projList .proj').count(),
    parked: await page.isVisible('#parked') ? await page.textContent('#parkedLabel') : '',
    bike: await page.locator('.bike, #verdict').count(),
  };
  if (name) await page.screenshot({ path: file(name), fullPage: true });
  await ctx.close();
  return out;
}

const phone = { width: 390, height: 844 };
let r = await shoot(PROJECTS, phone, 'projects');
console.log('phone:', r);
failed ||= !(r.shown && r.rows === 4 && r.parked === 'Parked (2)' && r.bike === 0);
r = await shoot(PROJECTS, phone, 'projects-parked-open', true);
r = await shoot(PROJECTS, { width: 1280, height: 820 }, 'projects-laptop');
failed ||= !(r.shown && r.rows === 4);
r = await shoot(null, phone);
console.log('before first push, shown:', r.shown);
failed ||= r.shown;
r = await shoot({ error: "Projects can't load right now" }, phone);
failed ||= !(r.shown && r.rows === 0);

await browser.close();
if (errors.length) { console.error(errors.join('\n')); failed = true; }
console.log(failed ? 'FAILED' : 'ok');
process.exit(failed ? 1 : 0);
