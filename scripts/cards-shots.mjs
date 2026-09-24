// The Swiss Cards layout with the Worker mocked: phone and laptop, light and dark, plus the
// states each card can be in. Every value here is made up.
//   npm run serve, then: npm run cards-shots
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
const at = (plus, hhmm) => `${day(plus)}T${hhmm}:00+02:00`;

function answer({ dark = false, ...over } = {}) {
  // Dark: sunset already passed today; light: sunset late tonight.
  const sun = [{ date: day(0), sunrise: `${day(0)}T00:00`, sunset: dark ? `${day(0)}T00:01` : `${day(0)}T23:59` }];
  return {
    now: new Date().toISOString(),
    todos: { items: [{ text: 'Email the landlord about the heating' }, { text: 'Call the dentist' }, { text: 'Book the train' }], updated: new Date().toISOString(), yesterday: { count: 2, items: ['Paid the rent', 'Went to the gym'] } },
    calendar: { events: [
      { title: 'Quiz night', start: at(0, '23:00'), end: at(0, '23:00'), allDay: false, location: '' },
      { title: 'Lunch with a friend', start: at(1, '13:00'), end: at(1, '14:00'), allDay: false, location: 'Cafe' },
      { title: 'Club evening', start: at(4, '20:00'), end: at(4, '20:00'), allDay: false, location: '' },
      { title: 'Day off', start: day(4), end: day(5), allDay: true, location: '' },
    ], sent: new Date().toISOString(), stale: false },
    fixed: { events: [], countdowns: [{ what: 'the trip', date: day(12) }] },
    weather: { sun },
    arsenal: { next: { opponent: 'Fictional Rovers', home: true, competition: 'Premier League', kickoff: new Date(Date.now() + 3 * 864e5).toISOString() }, last: { opponent: 'Made Up Town', home: false, us: 0, them: 3, result: 'Lost', pens: null } },
    bins: { collections: [{ date: day(1), types: ['GFT', 'Restafval'] }] },
    birthdays: { birthdays: [{ name: 'Sam', date: day(5), days: 5, age: 40 }] },
    news: { items: [] },
    kitchen: { tonight: { kind: 'recipe', title: 'Pasta alla Norma', veg: true }, mixToday: true, pizzaOn: day(3) },
    projects: {
      updated: new Date().toISOString(),
      projects: [
        { name: 'Garden planner', status: 'waiting', next: 'Pick a colour for the beds' },
        { name: 'Photo archive', status: 'active', next: 'Sort 2019' },
        { name: 'Language drills', status: 'next', next: 'Answer two questions to start' },
        { name: 'Recipe box', status: 'live', next: '' },
        { name: 'Budget sheet', status: 'live', next: '' },
        { name: 'Old blog', status: 'parked', next: 'Move the posts' },
      ],
      parked: [{ text: 'Move passwords to a manager', from: 'Admin' }, { text: 'Tidy the downloads folder', from: '' }],
    },
    ...over,
  };
}

const browser = await chromium.launch();
const errors = [];
let failed = false;
const check = (ok, what) => { if (!ok) { failed = true; console.error('FAIL:', what); } };

async function shoot(data, viewport, name, act) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/morning/**', (r) => r.fulfill({ json: data, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.route('**/site.**espn.com/**', (r) => r.abort());
  await page.goto(BASE + '?c=' + CODE);
  await page.waitForFunction(() => /As of/.test(document.getElementById('asOf').textContent));
  await page.evaluate(() => document.fonts.ready);
  if (act) await act(page);
  const out = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    date: document.querySelector('.js-date').textContent,
    start: document.getElementById('start').hidden ? '' : document.querySelector('.start-text').textContent,
    today: [...document.querySelectorAll('#todayList > li')].map((li) => li.innerText.replace(/\s+/g, ' ').trim()),
    turn: document.querySelectorAll('#projList .proj-turn').length,
    projects: document.getElementById('projects').hidden ? -1 : document.querySelectorAll('#projList .proj').length,
    parked: document.querySelector('#projList summary')?.innerText.replace(/\s+/g, ' ').trim() || '',
    week: document.querySelectorAll('#days .ev').length,
    arsenal: document.getElementById('arsenalBody').innerText.replace(/\s+/g, ' ').trim(),
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  if (name) await page.screenshot({ path: file(name), fullPage: true });
  await ctx.close();
  return out;
}

const phone = { width: 390, height: 844 };
const laptop = { width: 1440, height: 900 };

let r = await shoot(answer(), phone, 'cards-phone');
console.log(r);
check(r.theme === 'light', 'light theme');
check(/^\d{2}\.\d{2}$/.test(r.date), 'date as 24.09');
check(r.start === 'Email the landlord about the heating', 'start with');
check(r.today.length === 7, 'today rows: 2 tasks, dinner, bins, birthday, countdown, yesterday');
check(r.today.some((x) => /Dinner Pasta alla Norma\s*Mix the dough today/.test(x)), 'dinner row');
check(r.today.some((x) => /^Bins Tomorrow · GFT and Restafval out$/.test(x)), 'bins row');
check(r.today.some((x) => /^Yesterday 2 done/i.test(x)), 'wins row');
check(r.turn === 1 && r.projects === 4, 'projects: 1 your turn, 2 more, live line');
check(/^Old blog \+ 2 parked parked/i.test(r.parked), 'parked summary');
check(r.week === 4, 'four week rows');
check(/Arsenal v Fictional Rovers\s*Last: Lost 0–3 at Made Up Town/.test(r.arsenal), 'arsenal');
check(!r.overflow, 'no sideways scroll on the phone');

r = await shoot(answer({ dark: true }), phone, 'cards-phone-dark', (p) => p.click('#projList summary'));
check(r.theme === 'dark', 'dark after sunset');
r = await shoot(answer(), laptop, 'cards-laptop');
check(!r.overflow, 'no sideways scroll on the laptop');
await shoot(answer({ dark: true }), laptop, 'cards-laptop-dark');
await shoot(answer(), { width: 820, height: 1180 }, 'cards-tablet');

// Empty and broken states.
r = await shoot(answer({ projects: null, kitchen: null, bins: { collections: [] }, birthdays: { birthdays: [] }, fixed: { events: [], countdowns: [] }, todos: { items: [], updated: null, yesterday: { count: 0, items: [] } } }), phone, 'cards-empty');
check(r.projects === -1, 'projects hidden before the first push');
check(r.start === '', 'start hidden with no tasks');
check(r.today.length === 1 && r.today[0] === 'Nothing for today.', 'empty today');
r = await shoot(answer({ projects: { error: 'x' }, arsenal: { error: 'x' }, todos: { error: 'x' } }), phone);
check(r.projects === 0 && /can't load/.test(r.arsenal) && /can't load/.test(r.today[0]), 'errors shown per card');

await browser.close();
if (errors.length) { console.error(errors.join('\n')); failed = true; }
console.log(failed ? 'FAILED' : 'ok');
process.exit(failed ? 1 : 0);
