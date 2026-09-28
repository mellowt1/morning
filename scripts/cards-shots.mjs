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
      { title: 'Club - evening', start: at(4, '20:00'), end: at(4, '20:00'), allDay: false, location: '' },
      { title: 'Film at Filmhuis', start: at(5, '19:00'), end: at(5, '21:00'), allDay: false, location: 'Filmhuis' },
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

// The page's clock is fixed at 13:00 in The Hague (the sun is up) unless a test says otherwise.
const NOON = at(0, '13:00');
async function shoot(data, viewport, name, act, when = NOON) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(when));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/morning/**', (r) => r.fulfill({ json: data, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.route('**/site.**espn.com/**', (r) => r.abort());
  await page.goto(BASE + '?c=' + CODE);
  await page.waitForFunction(() => /As of/.test(document.getElementById('asOf').textContent));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1600); // first light: the sun takes its place after 320 ms, the entrance ends by 1.5 s
  if (act) await act(page);
  const out = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    date: document.querySelector('.js-date').getAttribute('aria-label'),
    eyebrow: document.querySelector('.js-eyebrow').textContent,
    say: document.querySelector('.js-say').textContent,
    sun: document.querySelector('.sun-stop').className,
    href: document.getElementById('start').getAttribute('href'),
    agenda: [...document.querySelectorAll('#todayList .evt')].map((li) => li.innerText.replace(/\s+/g, ' ').trim()),
    nextDot: document.querySelectorAll('#todayList .nd.next').length,
    tasks: [...document.querySelectorAll('#todayList .task')].map((li) => li.innerText.trim()),
    days: [...document.querySelectorAll('#days .ev')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()),
    start: document.getElementById('start').hidden ? '' : document.querySelector('.start-text').textContent,
    today: [...document.querySelectorAll('#todayList li')].map((li) => li.innerText.replace(/\s+/g, ' ').trim()),
    tiles: [...document.querySelectorAll('#todayList .tile')].map((t) => t.innerText.replace(/\s+/g, ' ').trim()),
    chips: document.querySelectorAll('#projList .chip').length,
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
check(r.tasks.length === 2, 'two to-dos after Start with');
check(/^Good afternoon · \w+day$/.test(r.eyebrow), 'greeting and weekday');
check(r.say === 'Quiz night at 23:00.', 'the day in one sentence: ' + r.say);
check(/\bup\b/.test(r.sun), 'sun up at 13:00');
check(/^\.\.\/todo\/\?c=/.test(r.href), 'Start with opens the to-do app');
check(r.agenda.length === 1 && /^23:00 Quiz night$/.test(r.agenda[0]) && r.nextDot === 1, 'today holds today: ' + r.agenda);
check(r.tiles.length === 5, 'tiles: dinner, bins, birthday, countdown, yesterday');
check(r.tiles.some((x) => /^Dinner Pasta alla Norma Mix the dough today$/i.test(x)), 'dinner tile');
check(r.tiles.some((x) => /^Bins Tomorrow GFT and Restafval out$/i.test(x)), 'bins tile');
check(r.tiles.some((x) => /^Yesterday 2 done$/i.test(x)), 'wins tile');
check(r.turn === 1 && r.projects === 3 && r.chips === 2, 'projects: your turn, building, up next, two live chips');
check(/^Parked 3 Old blog, Admin, Other/i.test(r.parked), 'parked summary');
check(r.week === 4 && /^Tomorrow Lunch with a friend, Cafe 13:00$/.test(r.days[0]), 'coming up starts tomorrow: ' + r.days[0]);
check(r.days.some((x) => /Club: evening/.test(x)), 'a spaced dash becomes a colon');
check(r.days.some((x) => /Film at Filmhuis 19:00$/.test(x)), 'the place is dropped when the title says it');
check(/Arsenal v Fictional Rovers\s*Last: Lost 0 to 3 at Made Up Town/.test(r.arsenal), 'arsenal');
check(!r.overflow, 'no sideways scroll on the phone');

r = await shoot(answer({ dark: true }), phone, 'cards-phone-dark', (p) => p.click('#projList summary'), at(0, '23:30'));
check(r.theme === 'dark', 'dark after sunset');
check(/\bdown\b/.test(r.sun), 'sun down at 23:30');
check(/^Nothing more today\. Lunch with a friend tomorrow at 13:00\.$/.test(r.say), 'evening sentence: ' + r.say);
r = await shoot(answer(), laptop, 'cards-laptop');
check(!r.overflow, 'no sideways scroll on the laptop');
await shoot(answer({ dark: true }), laptop, 'cards-laptop-dark', null, at(0, '23:30'));
await shoot(answer(), { width: 820, height: 1180 }, 'cards-tablet');

// Empty and broken states.
r = await shoot(answer({ projects: null, kitchen: null, bins: { collections: [] }, birthdays: { birthdays: [] }, fixed: { events: [], countdowns: [] }, todos: { items: [], updated: null, yesterday: { count: 0, items: [] } } }), phone, 'cards-empty');
check(r.projects === -1, 'projects hidden before the first push');
check(r.start === '', 'start hidden with no tasks');
check(r.today.includes('Nothing for today.'), 'empty today');
r = await shoot(answer({ projects: { error: 'x' }, arsenal: { error: 'x' }, todos: { error: 'x' } }), phone);
check(r.projects === 0 && /can't load/.test(r.arsenal) && r.today.some((x) => /can't load/.test(x)), 'errors shown per card');

// Since you last looked: a to-do added while the page was away gets a tick; nothing else does.
{
  const ctx = await browser.newContext({ viewport: phone });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date(NOON));
  let data = answer();
  await page.route('**/api/morning/**', (r) => r.fulfill({ json: data, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.goto(BASE + '?c=' + CODE);
  await page.waitForFunction(() => /As of/.test(document.getElementById('asOf').textContent));
  const firstOpen = await page.evaluate(() => document.querySelectorAll('.is-new').length);
  check(firstOpen === 0, 'the first ever open marks nothing');
  data = answer({ todos: { items: [{ text: 'Email the landlord about the heating' }, { text: 'Call the dentist' }, { text: 'Water the plants' }, { text: 'Book the train' }], updated: NOON, yesterday: { count: 0, items: [] } } });
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#todayList .task').length === 3);
  const marked = await page.evaluate(() => [...document.querySelectorAll('.is-new')].map((e) => e.innerText.trim()));
  check(marked.length === 1 && marked[0] === 'Water the plants', 'only the new to-do is marked: ' + marked);
  const firstAgain = await page.evaluate(() => document.documentElement.classList.contains('first'));
  check(!firstAgain, 'first light plays once a day');
  await ctx.close();
}

// The minute: the tick lands on the minute and only the changed digit rolls.
{
  const ctx = await browser.newContext({ viewport: laptop });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: new Date(at(0, '13:08').replace(':00+', ':50+')) });
  await page.route('**/api/morning/**', (r) => r.fulfill({ json: answer(), headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.goto(BASE + '?c=' + CODE);
  await page.clock.runFor(2000);
  const before = await page.evaluate(() => document.querySelector('[data-clock="here"]').textContent);
  await page.clock.runFor(8200);
  const rolling = await page.evaluate(() => document.querySelector('[data-clock="here"]').innerHTML);
  await page.clock.runFor(700);
  const after = await page.evaluate(() => document.querySelector('[data-clock="here"]').innerHTML);
  check(before === '13:08' && /r-old[^>]*>8<.*r-new">9</.test(rolling) && (rolling.match(/class="roll"/g) || []).length === 1 && after === '13:09',
    'minute roll: ' + before + ' / ' + rolling + ' / ' + after);
  await ctx.close();
}

await browser.close();
if (errors.length) { console.error(errors.join('\n')); failed = true; }
console.log(failed ? 'FAILED' : 'ok');
process.exit(failed ? 1 : 0);
