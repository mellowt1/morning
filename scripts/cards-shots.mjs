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
    rotas: { rotas: [{ what: 'Cleaning', date: day(2), end: day(3), days: 2, who: 'Alex', then: 'Both of you' }] },
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
    repos: { updated: new Date().toISOString(), repos: [{ name: 'photo-archive', why: 'No remote yet' }, { name: 'garden', why: '2 commits not pushed' }] },
    intake: { week: 2, needs: [{ id: "r1", at: new Date().toISOString(), who: "mom", kind: "letter", summary: "Insurance letter: a reply is wanted before the 20th.", tasks: 1, needs: true }], recent: [{ id: "r1", at: new Date().toISOString(), who: "mom", kind: "letter", summary: "Insurance letter: a reply is wanted before the 20th.", tasks: 1, needs: true }, { id: "r2", at: new Date(Date.now() - 2 * 864e5).toISOString(), who: "me", kind: "bill", summary: "Energy bill for September, paid by direct debit.", tasks: 0, needs: false }], month: { calls: 3, input: 12000, output: 1500 } },
    events: { events: [{ id: 'e1', source: 'feeling', kind: 'checkin', who: 'Nick', text: 'Nick checked in', at: new Date(Date.now() - 20 * 60000).toISOString() }, { id: 'e2', source: 'plan-regreso', kind: 'task', who: 'Dad', text: 'Dad ticked Pasaporte', at: new Date(Date.now() - 26 * 3600000).toISOString() }], sources: {} },
    status: { line: 'All jobs on time, 2 things happened in 2 apps, 3 open to-dos.', summary: 'Quiet night: Nick checked in and Dad ticked Pasaporte. Everything is running.', summaryAt: new Date(Date.now() - 3600000).toISOString(), at: new Date().toISOString() },
    links: { links: [{ name: 'To-do', url: 'https://example.com/todo/' }, { name: 'Kitchen', url: 'https://example.com/kitchen/' }, { name: 'Plan de regreso', url: 'https://example.com/plan/' }, { name: 'Bad', url: 'javascript:alert(1)' }] },
    ...over,
  };
}

const browser = await chromium.launch();
const errors = [];
let failed = false;
let checks = 0, fails = 0;
const check = (ok, what) => { checks++; if (!ok) { fails++; failed = true; console.error('FAIL:', what); } };

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
    href: document.getElementById('startLink').getAttribute('href'),
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
    parked: document.getElementById('parked').hidden ? '' : document.getElementById('parkHead').innerText.replace(/\s+/g, ' ').trim() || '',
    week: document.querySelectorAll('#days .ev').length,
    band: getComputedStyle(document.getElementById('weekBand')).display === 'none' ? null
      : [...document.querySelectorAll('#bandDays .bd')].map((d) => d.innerText.replace(/\s+/g, ' ').trim()),
    agendaShown: document.querySelectorAll('#todayList .evt').length,
    arsenal: document.getElementById('arsenalBody').innerText.replace(/\s+/g, ' ').trim(),
    overflow: document.documentElement.scrollWidth > innerWidth,
    intake: document.getElementById('intake').hidden ? -1 : [...document.querySelectorAll('#intakeList .read-row')].map((d) => d.innerText.replace(/\s+/g, ' ').trim()),
    feed: document.getElementById('feed').hidden ? -1 : [...document.querySelectorAll('#feedList .feed-row')].map((d) => d.innerText.replace(/\s+/g, ' ').trim()),
    projNext: document.querySelectorAll('#projList .proj-next').length,
    apps: document.getElementById('apps').hidden ? [] : [...document.querySelectorAll('#apps a')].map((a) => a.textContent + ' ' + a.getAttribute('href')),
    repos: [...document.querySelectorAll('#projList .repo-line span')].map((d) => d.textContent + ' ' + d.title),
  }));
  if (name) await page.screenshot({ path: file(name), fullPage: true });
  await ctx.close();
  return out;
}

const phone = { width: 390, height: 844 };
const laptop = { width: 1440, height: 900 };

let r = await shoot(answer(), phone, 'cards-phone');
console.log(r);
check(r.theme === 'light', 'one daylight theme');
check(r.apps.length === 2 && r.apps[1] === 'Kitchen https://example.com/kitchen/', 'apps row: two https links, javascript: dropped: ' + r.apps);
check(r.repos.length === 2 && r.repos[0] === 'photo-archive No remote yet', 'not pushed: ' + r.repos);
check(/^\d{1,2} [A-Z][a-z]+$/.test(r.date), 'the date reads "19 October" to a screen reader: ' + r.date);
check(r.start === 'Email the landlord about the heating', 'start with');
check(r.tasks.length === 2, 'two to-dos after Start with');
check(/^Good afternoon · \w+day$/.test(r.eyebrow), 'greeting and weekday');
check(r.say === 'Quiz night at 23:00.', 'the day in one sentence: ' + r.say);
check(/\bup\b/.test(r.sun), 'sun up at 13:00');
check(/^\.\.\/todo\/\?c=/.test(r.href), 'Start with opens the to-do app');
check(r.agenda.length === 1 && /^23:00 Quiz night$/.test(r.agenda[0]) && r.nextDot === 1, 'today holds today: ' + r.agenda);
check(r.tiles.length === 6, 'tiles: dinner, bins, birthday, countdown, cleaning, yesterday');
// Out for dinner (the hub's dinner.away from Day): the next night out only, on both widths.
// On that night the Dinner tile gives way; the dough still shows when it needs mixing.
{
  const dinner = { away: [{ date: day(0), title: 'dinner with a friend', start: '19:30' }, { date: day(2), title: 'Team dinner', start: '18:30' }] };
  for (const [vp, name] of [[phone, 'cards-phone-away'], [laptop, 'cards-laptop-away']]) {
    const a = await shoot(answer({ dinner }), vp, name);
    const out = a.tiles.filter((t) => /^eating out/i.test(t)).map((t) => t.replace(/^eating out /i, ''));
    check(out.length === 1 && out[0] === 'Dinner with a friend Tonight 19:30', name + ': ' + out);
    check(!a.tiles.some((t) => /^dinner /i.test(t)) && a.tiles.some((t) => /^dough mix the dough today/i.test(t)), name + ': no Dinner tile on a night out: ' + a.tiles);
  }
  const place = await shoot(answer({ dinner: { away: [{ date: day(1), title: 'Harbour Cafe - Table 4', start: '20:00' }] } }), laptop, '');
  check(place.tiles.some((t) => t === 'EATING OUT Harbour Cafe Tomorrow 20:00' || t === 'Eating out Harbour Cafe Tomorrow 20:00'), 'eating out shows the place only: ' + place.tiles);
  const none = await shoot(answer({ dinner: null }), phone, '');
  check(!none.tiles.some((t) => /^eating out/i.test(t)), 'no tile without dinner.away');
}
check(r.tiles.some((x) => /^Cleaning Alex (This weekend|\w+day)$/i.test(x)), 'cleaning tile: ' + r.tiles.find((x) => /^Cleaning/i.test(x)));
check(r.tiles.some((x) => /^Dinner Pasta alla Norma Mix the dough today$/i.test(x)), 'dinner tile');
check(r.tiles.some((x) => /^Bins Tomorrow GFT and Restafval out$/i.test(x)), 'bins tile');
check(r.tiles.some((x) => /^Yesterday 2 done$/i.test(x)), 'wins tile');
check(r.turn === 1 && r.projects === 3 && r.chips === 2, 'projects: your turn, building, up next, two live chips');
check(/^Parked 3$/i.test(r.parked), 'parked card header: ' + r.parked);
// One line each: kind, the gist, then its tasks (needs you) or when it was read.
check(r.intake.length === 2 && /^letter Insurance letter.* 1 task$/i.test(r.intake[0]) && /^bill Energy bill/i.test(r.intake[1]), 'read for you: ' + r.intake);
check(r.projNext === 0, 'projects: names only, no descriptions');
// Plan de regreso stays off Morning, so its feed line is left out.
check(r.feed.length === 1 && /^Nick checked in \d\d:\d\d$/.test(r.feed[0]), 'lately: one line per thing, time on the right: ' + r.feed);
check(r.week === 4 && /^Tomorrow Lunch with a friend, Cafe 13:00$/.test(r.days[0]), 'coming up starts tomorrow: ' + r.days[0]);
check(r.days.some((x) => /Club: evening/.test(x)), 'a spaced dash becomes a colon');
check(r.days.some((x) => /Film at Filmhuis 19:00$/.test(x)), 'the place is dropped when the title says it');
check(/Arsenal v Fictional Rovers\s*Last: Lost 0 to 3 at Made Up Town/.test(r.arsenal), 'arsenal');
check(!r.overflow, 'no sideways scroll on the phone');

r = await shoot(answer({ dark: true }), phone, 'cards-phone-dark', null, at(0, '23:30'));
check(r.theme === 'light', 'the same daylight board after sunset');
check(/\bdown\b/.test(r.sun), 'sun down at 23:30');
check(/^Nothing more today\. Lunch with a friend tomorrow at 13:00\.$/.test(r.say), 'evening sentence: ' + r.say);
check(r.band === null, 'no week band on the phone');
r = await shoot(answer(), laptop, 'cards-laptop');
check(!r.overflow, 'no sideways scroll on the laptop');
// The PC's week band: seven days, today first, each fact on its own day.
check(r.band && r.band.length === 7 && /^Today \d+ 23:00 Quiz night$/i.test(r.band[0]), 'band: today first: ' + (r.band && r.band[0]));
check(/Bins GFT and Restafval out 13:00 Lunch with a friend Cafe$/i.test(r.band[1]), 'band: bins, then lunch, tomorrow: ' + r.band[1]);
check(/\d\d:\d\d Arsenal v Fictional Rovers Premier League$/.test(r.band[3]), 'band: the match on its day: ' + r.band[3]);
check(/All day Day off 20:00 Club: evening$/i.test(r.band[4]), 'band: all day first: ' + r.band[4]);
check(/Birthday Sam turns 40 19:00 Film at Filmhuis$/i.test(r.band[5]), 'band: birthday on its day: ' + r.band[5]);
check(/^\w+ \d+ Cleaning Alex/i.test(r.band[2]) && /^\w+ \d+ Cleaning Alex/i.test(r.band[3]), 'band: cleaning on both days of the turn: ' + r.band[2]);
check(!r.tiles.some((x) => /^Cleaning/i.test(x)), 'Today leaves the cleaning to the band');
check(r.agendaShown === 0 && r.week === 4 && !r.tiles.some((x) => /^Birthday/i.test(x)), 'Today leaves this week to the band');
check(r.tiles.some((x) => /^Bins Tomorrow/i.test(x)) && r.tiles.some((x) => /^Countdown/i.test(x)), 'bins out tomorrow and a countdown 12 days off stay in Today');
await shoot(answer({ dark: true }), laptop, 'cards-laptop-dark', null, at(0, '23:30'));
await shoot(answer(), { width: 820, height: 1180 }, 'cards-tablet');

// The read-outs (PC): next thing, left today, then tonight or Arsenal; never the same thing twice.
{
  let ro = [];
  let sayShown = true;
  const grab = async (page) => {
    ro = await page.evaluate(() => [...document.querySelectorAll('#readouts .ro')].map((d) => d.innerText.replace(/\s+/g, ' ').trim()));
    sayShown = await page.evaluate(() => getComputedStyle(document.querySelector('.js-say')).display !== 'none');
  };
  await shoot(answer(), laptop, '', grab);
  check(ro.length === 4 && ro[3] === 'Energy Wired Normal Drained' && ro[0] === 'Next at 23:00 Quiz night' && ro[1] === 'Left today 3 on the list' && /^Arsenal \w+ \d\d:\d\d Arsenal v Fictional Rovers$/.test(ro[2]) && !sayShown,
    'read-outs: ' + JSON.stringify(ro) + ' say shown: ' + sayShown);
  await shoot(answer({ dinner: { away: [{ date: day(0), title: 'Harbour Cafe - Table 4', start: '19:30' }] } }), laptop, '', grab, at(0, '22:40'));
  check(ro[0] === 'Next, in 20 min 23:00 Quiz night' && /^Arsenal /.test(ro[2] || ''), 'read-outs at 22:40: the night out is past, so Arsenal: ' + JSON.stringify(ro));
  await shoot(answer({ dinner: { away: [{ date: day(0), title: 'Harbour Cafe - Table 4', start: '19:30' }] } }), laptop, '', grab);
  check(ro[2] === 'Tonight 19:30 Harbour Cafe', 'read-outs: a night out is Tonight: ' + JSON.stringify(ro));
}
// Today: the next three to-dos, then "+N more" into the to-do app.
{
  const items = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'].map((text) => ({ text }));
  let more = '';
  const m = await shoot(answer({ todos: { items, updated: null, yesterday: { count: 0, items: [] } } }), laptop, '', async (page) => {
    more = await page.evaluate(() => { const a = document.querySelector('#todayList .more-link'); return a ? a.textContent + ' ' + a.getAttribute('href') : ''; });
  });
  check(m.tasks.length === 3 && /^\+2 more \.\.\/todo\/\?c=/.test(more), 'three to-dos and +2 more: ' + m.tasks + ' / ' + more);
}
// Projects: Live leaves out what the apps row already has. Lately leaves out what the page shows.
{
  const p = answer().projects;
  const d = await shoot(answer({
    projects: { ...p, projects: [...p.projects, { name: 'Kitchen', status: 'live', next: '' }] },
    events: { events: [
      { id: 'a', source: 'feeling', kind: 'checkin', text: 'Nick checked in', at: new Date(Date.now() - 6e5).toISOString() },
      { id: 'b', source: 'day', kind: 'dinner', text: 'Out for dinner Mon 26 Oct', at: new Date(Date.now() - 7e5).toISOString() },
      { id: 'c', source: 'pc', kind: 'job', text: 'Projects list refreshed', at: new Date(Date.now() - 8e5).toISOString() },
    ] },
  }), laptop, '');
  check(d.chips === 2, 'live chips leave out Kitchen (in the apps row): ' + d.chips);
  check(d.feed.length === 1 && /^Nick checked in/.test(d.feed[0]), 'lately leaves out dinner and the projects refresh: ' + d.feed);
}
// No hub and nothing kept: Retry on the cards, Offline by the clock, no empty week band.
{
  const ctx = await browser.newContext({ viewport: laptop });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date(NOON));
  await page.route('**/api/**', (r) => r.abort());
  await page.goto(BASE + '?c=' + CODE);
  await page.waitForFunction(() => /No connection/.test(document.getElementById('asOf').textContent));
  const o = await page.evaluate(() => ({
    retry: document.querySelectorAll('[data-retry]').length,
    stale: document.getElementById('stale').hidden ? '' : document.getElementById('stale').textContent,
    band: document.getElementById('weekBand').hidden,
    loading: /Loading/.test(document.getElementById('todayList').textContent),
  }));
  check(o.retry >= 2 && o.stale === 'Offline' && o.band && !o.loading, 'offline: ' + JSON.stringify(o));
  await page.screenshot({ path: file('cards-offline'), fullPage: true });
  await ctx.close();
}

// Empty and broken states.
r = await shoot(answer({ projects: null, intake: null, events: null, status: null, kitchen: null, bins: { collections: [] }, birthdays: { birthdays: [] }, fixed: { events: [], countdowns: [] }, todos: { items: [], updated: null, yesterday: { count: 0, items: [] } } }), phone, 'cards-empty');
check(r.projects === -1, 'projects hidden before the first push');
check(r.intake === -1, 'read-for-you hidden before the first letter');
check(r.feed === -1, 'lately hidden before the first event');
check(r.start === '', 'start hidden with no tasks');
check(r.today.includes('Nothing for today.'), 'empty today');
r = await shoot(answer({ events: null }), phone);
check(r.feed === -1, 'lately hidden without events (the status paragraph is no longer on Morning)');
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

// The energy dial (paul-hub src/energy.js, mocked like the real routes): the PC read-out, the taps,
// the pick in Start with, Not this one, Surprise me, every task turned down, a level set elsewhere,
// the phone's dial in Start with, and the first paint from the copy on this device.
{
  const tasks = [
    { id: 'task00000001', name: 'Return the lamp', section: 'today', due: null, time: null },
    { id: 'task00000002', name: 'Text a friend', section: 'soon', due: day(4), time: null },
    { id: 'task00000003', name: 'Sort the receipts', section: 'soon', due: null, time: '16:00' },
  ];
  const dm = (d) => `${+d.slice(8, 10)} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+d.slice(5, 7) - 1]}`;
  const world = (level = null) => {
    const w = { level, sets: [], picks: [], gets: 0, down: false };
    const state = () => ({ level: w.level, setAt: w.level ? new Date(NOON).toISOString() : null,
      until: w.level ? new Date(Date.parse(NOON) + 4 * 36e5).toISOString() : null, source: w.level ? 'morning' : null });
    const pick = (skip = [], mode = 'next', current = null) => {
      if (!w.level) return null;
      const left = tasks.filter((t) => !skip.includes(t.id));
      let task = left[0] || null;
      if (mode === 'surprise' && left.length > 1) task = left.filter((t) => t.id !== current).pop();
      return { task, count: tasks.length, left: left.length, position: tasks.length - left.length + 1 };
    };
    w.route = async (r) => {
      const h = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
      const q = r.request();
      if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
      if (w.down) return r.abort();
      if (q.method() === 'GET') { w.gets++; return r.fulfill({ json: { ...state(), pick: /pick=1/.test(q.url()) ? pick() : undefined }, headers: h }); }
      const b = q.postDataJSON();
      await new Promise((ok) => setTimeout(ok, 150)); // a little network time, so a double tap lands while the first is out
      if (q.url().endsWith('/pick')) { w.picks.push(b); return r.fulfill({ json: { ...state(), pick: pick(b.skip, b.mode, b.current) }, headers: h }); }
      w.sets.push(b);
      w.level = b.level;
      return r.fulfill({ json: { ...state(), pick: pick() }, headers: h });
    };
    return w;
  };
  const openE = async (w, viewport) => {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: viewport.width < 700 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date(NOON));
    await page.addInitScript((d) => { try { localStorage.setItem('morning.enteredOn', JSON.stringify(d)); } catch (e) {} }, day(0));
    await page.route('**/api/morning/**', (r) => r.fulfill({ json: answer(), headers: { 'Access-Control-Allow-Origin': '*' } }));
    await page.route('**/api/energy/**', w.route);
    await page.route('**/site.**espn.com/**', (r) => r.abort());
    await page.goto(BASE + '?c=' + CODE);
    await page.waitForFunction(() => /As of/.test(document.getElementById('asOf').textContent));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    return { ctx, page };
  };
  const st = (page) => page.evaluate(() => {
    const vis = (el) => !!el && !el.closest('[hidden]') && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
    const t = (sel) => { const el = document.querySelector(sel); return vis(el) ? el.textContent.trim() : ''; };
    return {
      ro: [...document.querySelectorAll('#readouts .ro')].length,
      dial: [...document.querySelectorAll('#readouts .dial-btn')].filter(vis).map((b) => b.textContent.trim() + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')),
      dialH: [...document.querySelectorAll('#readouts .dial-btn')].map((b) => Math.round(b.getBoundingClientRect().height)),
      phoneDial: [...document.querySelectorAll('#startDial .dial-btn')].filter(vis).map((b) => b.textContent.trim() + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')),
      phoneDialH: [...document.querySelectorAll('#startDial .dial-btn')].map((b) => Math.round(b.getBoundingClientRect().height)),
      start: t('#start .start-text'), meta: t('#start .start-meta'), note: t('#start .start-note'), go: t('#start .start-go'),
      acts: [...document.querySelectorAll('#startActs button')].filter(vis).map((b) => b.textContent.trim()),
      tasks: [...document.querySelectorAll('#todayList .task:not(.task-done)')].map((li) => li.innerText.trim()),
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  const tap = async (page, sel, settle = 450) => { await page.click(sel); await page.waitForTimeout(settle); };

  // The PC: the dial is the fourth read-out; nothing set, Start with is as before.
  const w = world();
  const { ctx, page } = await openE(w, laptop);
  let s = await st(page);
  check(s.ro === 4 && s.dial.join() === 'Wired,Normal,Drained' && s.dialH.every((h) => h >= 44), 'energy: the dial is the fourth read-out, three buttons of 44 px or more: ' + JSON.stringify(s));
  check(s.start === 'Email the landlord about the heating' && !s.note && s.go === 'Open ›' && !s.acts.length && !s.meta, 'energy: no level, Start with as before: ' + JSON.stringify(s));
  check(s.phoneDial.length === 0, 'energy: no dial in Start with on the PC');
  await page.screenshot({ path: file('energy-pc-unset'), clip: { x: 0, y: 0, width: 1440, height: 560 } });
  // Drained: one POST, the button pressed, the pick in Start with, Today keeps the first to-do.
  await tap(page, '#readouts [data-energy="drained"]');
  s = await st(page);
  check(w.sets.length === 1 && w.sets[0].level === 'drained' && w.sets[0].source === 'morning', 'energy: tapping Drained sends level drained: ' + JSON.stringify(w.sets));
  check(s.dial.join() === 'Wired,Normal,Drained*', 'energy: Drained is pressed: ' + s.dial);
  check(s.start === 'Return the lamp' && s.meta === 'Today' && s.note === 'Drained · 1 of 3 that fit' && !s.go && s.acts.join() === 'Not this one,Surprise me',
    'energy: Start with shows the pick: ' + JSON.stringify(s));
  check(s.tasks[0] === 'Email the landlord about the heating' && s.tasks.length === 3, 'energy: Today lists the first to-do once the pick holds Start with: ' + s.tasks);
  await page.screenshot({ path: file('energy-pc'), fullPage: true });
  // Not this one: skip the one on screen, record it, show the next. A double tap sends once.
  await page.evaluate(() => { const b = document.querySelector('[data-pick="skip"]'); b.click(); b.click(); });
  await page.waitForTimeout(450);
  s = await st(page);
  check(w.picks.length === 1 && w.picks[0].mode === 'next' && w.picks[0].skipped === 'task00000001' && w.picks[0].current === 'task00000001' && w.picks[0].skip.join() === 'task00000001' && w.picks[0].source === 'morning',
    'energy: Not this one sends skipped, once for a double tap: ' + JSON.stringify(w.picks));
  check(s.start === 'Text a friend' && s.meta === 'Soon · ' + dm(day(4)) && s.note === 'Drained · 2 of 3 that fit', 'energy: the next pick: ' + JSON.stringify(s));
  // Surprise me: not a skip.
  await tap(page, '[data-pick="surprise"]');
  check(w.picks[1].mode === 'surprise' && w.picks[1].skip.join() === 'task00000001' && w.picks[1].current === 'task00000002' && !w.picks[1].skipped, 'energy: Surprise me is not a skip: ' + JSON.stringify(w.picks[1]));
  s = await st(page);
  check(s.start === 'Sort the receipts' && s.meta === 'Soon · 16:00' && s.note === 'Drained · 2 of 3 that fit' && s.acts.join() === 'Not this one,Surprise me', 'energy: the surprise: ' + JSON.stringify(s));
  // Turn the rest down: every task that fits is gone, Start again clears the skips.
  await tap(page, '[data-pick="skip"]');
  s = await st(page);
  check(s.start === 'Text a friend' && s.acts.join() === 'Not this one', 'energy: with one left, no Surprise me: ' + JSON.stringify(s));
  await tap(page, '[data-pick="skip"]');
  s = await st(page);
  check(w.picks[3].skip.join() === 'task00000001,task00000003,task00000002', 'energy: the skip list grows: ' + JSON.stringify(w.picks[3]));
  check(s.start === 'That was every task that fits drained.' && s.acts.join() === 'Start again' && !s.meta && s.note === 'Drained', 'energy: every task turned down: ' + JSON.stringify(s));
  await page.locator('#start').screenshot({ path: file('energy-pc-out') });
  await tap(page, '[data-pick="again"]');
  s = await st(page);
  check(w.picks[4].skip.length === 0 && !w.picks[4].skipped && s.start === 'Return the lamp', 'energy: Start again starts over: ' + JSON.stringify(w.picks[4]));
  // A level set in To-do shows on return to the page, and the skips start over.
  await tap(page, '[data-pick="skip"]');
  w.level = 'wired';
  const gets = w.gets;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(450);
  s = await st(page);
  check(w.gets === gets + 1 && s.dial.join() === 'Wired*,Normal,Drained' && s.note === 'Wired · 1 of 3 that fit', 'energy: a level set elsewhere shows on return: ' + JSON.stringify(s));
  await tap(page, '[data-pick="skip"]');
  check(w.picks[w.picks.length - 1].skip.join() === 'task00000001', 'energy: a new level starts a new skip list: ' + JSON.stringify(w.picks[w.picks.length - 1]));
  // Tapping the level that is on clears it: Start with goes back to the first Today task.
  await tap(page, '#readouts [data-energy="wired"]');
  s = await st(page);
  check(w.sets[w.sets.length - 1].level === null && s.dial.join() === 'Wired,Normal,Drained' && s.start === 'Email the landlord about the heating' && !s.acts.length,
    'energy: tapping the level that is on clears it: ' + JSON.stringify(w.sets) + JSON.stringify(s));
  // The hub away: the copy on this device paints first, and the page carries on.
  await tap(page, '#readouts [data-energy="normal"]');
  w.down = true;
  await page.reload();
  await page.waitForFunction(() => /As of/.test(document.getElementById('asOf').textContent));
  await page.waitForTimeout(300);
  s = await st(page);
  check(s.dial.join() === 'Wired,Normal*,Drained' && s.start === 'Return the lamp' && s.tasks.length === 3, 'energy: the last answer paints after a reload with the hub away: ' + JSON.stringify(s));
  await ctx.close();

  // The phone: no header read-outs; the dial sits on top of Start with.
  const pw = world('drained');
  const p = await openE(pw, phone);
  s = await st(p.page);
  check(s.dial.length === 0 && s.phoneDial.join() === 'Wired,Normal,Drained*' && s.phoneDialH.every((h) => h >= 44), 'energy phone: the dial in Start with: ' + JSON.stringify(s));
  check(s.start === 'Return the lamp' && s.acts.join() === 'Not this one,Surprise me' && !s.overflow, 'energy phone: the pick and its buttons, no sideways scroll: ' + JSON.stringify(s));
  await p.page.screenshot({ path: file('energy-phone'), fullPage: true });
  await tap(p.page, '#startDial [data-energy="normal"]');
  check(pw.sets.length === 1 && pw.sets[0].level === 'normal', 'energy phone: the dial in Start with sends: ' + JSON.stringify(pw.sets));
  // Every task turned down on the phone.
  for (let i = 0; i < 3; i++) await tap(p.page, '[data-pick="skip"]');
  s = await st(p.page);
  check(s.start === 'That was every task that fits normal.' && s.acts.join() === 'Start again' && !s.overflow, 'energy phone: every task turned down: ' + JSON.stringify(s));
  await p.page.locator('#start').screenshot({ path: file('energy-phone-out') });
  await p.ctx.close();
}

// Waiting on (paul-hub src/waiting.js, mocked like the real routes): the Chases due tile, the card's
// rows, the empty and missing states, the add form (validation, the POST body, a refusal, no hub,
// a double tap), the phone's order, and that the card leaves the PC's week band where it was.
{
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dm = (d) => `${+d.slice(8, 10)} ${MON[+d.slice(5, 7) - 1]}`;
  const item = (n, who, what, since, extra = {}) => ({ id: 'wait00000000000' + n, who, what, since, channel: 'email', chaseDays: 7, nextChase: day(1),
    forWhom: null, source: 'morning', state: 'open', chases: 0, chaseDue: false, chaseTask: null, resolvedAt: null, ...extra });
  const seed = () => [
    item(1, 'The ministry', 'the policy officer application', day(-14), { chases: 1, chaseDue: true, nextChase: day(0), source: 'apply' }),
    item(2, 'The agency', 'the application', day(-13), { chaseDue: true, nextChase: day(-1) }),
    item(3, 'The accountant', 'the tax overview', day(-3), { channel: 'phone', forWhom: 'Nick' }),
    item(4, 'The council', 'the parking permit', day(0), { channel: 'letter' }),
  ];
  const block = (items) => {
    const due = items.filter((i) => i.chaseDue);
    return { open: items.length, due: due.length, dueWho: due.slice(0, 3).map((i) => i.who), items: items.slice(0, 8) };
  };
  const wworld = (items = seed()) => {
    const w = { items, posts: [], gets: 0, mode: 'ok' };
    const h = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
    w.morning = (r) => { w.gets++; return r.fulfill({ json: answer({ waiting: block(w.items) }), headers: h }); };
    w.waiting = async (r) => {
      const q = r.request();
      if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
      const b = q.postDataJSON();
      w.posts.push(b);
      await new Promise((ok) => setTimeout(ok, 150)); // network time, so a double tap lands while the first is out
      if (w.mode === 'down') return r.abort();
      if (w.mode === 'refuse') return r.fulfill({ status: 400, json: { error: 'channel: email, phone, letter or in-person' }, headers: h });
      const it = item('x', b.who, b.what, day(0), { channel: b.channel, chaseDays: b.chaseDays, nextChase: day(b.chaseDays), forWhom: b.forWhom || null });
      it.id = 'new0000000000' + String(w.posts.length).padStart(3, '0');
      w.items.push(it);
      return r.fulfill({ json: { item: it }, headers: h });
    };
    return w;
  };
  const openW = async (w, viewport) => {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: viewport.width < 700 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date(NOON));
    await page.addInitScript((d) => { try { localStorage.setItem('morning.enteredOn', JSON.stringify(d)); } catch (e) {} }, day(0));
    await page.route('**/api/morning/**', w.morning);
    await page.route('**/api/waiting/**', w.waiting);
    await page.route('**/api/energy/**', (r) => r.abort());
    await page.route('**/site.**espn.com/**', (r) => r.abort());
    await page.goto(BASE + '?c=' + CODE);
    await page.waitForFunction(() => /As of/.test(document.getElementById('asOf').textContent));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    return { ctx, page };
  };
  const ws = (page) => page.evaluate(() => {
    const vis = (el) => !!el && !el.closest('[hidden]') && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
    const card = document.getElementById('waiting');
    const due = document.querySelector('#waitList .tmeta-near');
    return {
      card: vis(card),
      head: vis(card) ? card.querySelector('.card-head .num').innerText.replace(/\s+/g, ' ').trim() : '',
      add: vis(document.getElementById('waitAdd')),
      form: vis(document.getElementById('waitForm')),
      rows: [...document.querySelectorAll('#waitList .wait-row')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()),
      more: vis(document.querySelector('#waitList .more-link')) ? document.querySelector('#waitList .more-link').textContent : '',
      dueInk: due ? getComputedStyle(due).color : '',
      err: vis(document.getElementById('wfErr')) ? document.getElementById('wfErr').textContent : '',
      vals: ['wfWho', 'wfWhat', 'wfFor'].map((id) => document.getElementById(id).value),
      invalid: ['wfWho', 'wfWhat'].filter((id) => document.getElementById(id).getAttribute('aria-invalid') === 'true'),
      focus: document.activeElement && document.activeElement.id,
      tiles: [...document.querySelectorAll('#todayList .tile')].map((t) => t.innerText.replace(/\s+/g, ' ').trim()),
      band: Math.round(document.getElementById('weekBand').getBoundingClientRect().top),
      order: ['#start', '.card-today', '#waiting', '#projects'].map((s) => Math.round(document.querySelector(s).getBoundingClientRect().top)),
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });

  // The tile, on both widths: the number and the names. Hidden with nothing due, and without the block.
  for (const vp of [laptop, phone]) {
    const t = await shoot(answer({ waiting: block(seed()) }), vp, '');
    check(t.tiles[0] === 'Chases due 2 The ministry, The agency', `waiting ${vp.width}: the Chases due tile comes first: ` + t.tiles);
  }
  const many = [...seed(), item(5, 'The bank', 'the card', day(-20), { chaseDue: true }), item(6, 'The school', 'the form', day(-19), { chaseDue: true })];
  const tm = await shoot(answer({ waiting: block(many) }), laptop, '');
  check(tm.tiles.some((x) => x === 'Chases due 4 The ministry, The agency, The bank +1'), 'waiting: three names and +1 for the fourth: ' + tm.tiles);
  const t0 = await shoot(answer({ waiting: block(seed().map((i) => ({ ...i, chaseDue: false }))) }), laptop, '');
  const tn = await shoot(answer({ waiting: null }), laptop, '');
  check(!t0.tiles.some((x) => /^Chases due/i.test(x)) && !tn.tiles.some((x) => /^Chases due/i.test(x)), 'waiting: no tile when nothing is due or the block is null');

  // The card on the PC.
  const w = wworld();
  const { ctx, page } = await openW(w, laptop);
  let s = await ws(page);
  check(s.card && s.head === 'Waiting on 4 open' && s.add && !s.form, 'waiting: the card, its header and Add: ' + JSON.stringify(s));
  check(s.rows.length === 4 && s.rows[0] === 'The ministry about the policy officer application Chase due' && s.rows[1] === 'The agency about the application Chase due'
    && s.rows[2] === `The accountant about the tax overview · for Nick since ${dm(day(-3))}` && s.rows[3] === 'The council about the parking permit since today',
    'waiting: rows, oldest first, Chase due or since: ' + s.rows);
  check(s.dueInk === 'rgb(138, 83, 0)', 'waiting: Chase due is amber ink: ' + s.dueInk);
  check((await page.$$('#waitList button')).length === 0, 'waiting: no buttons on the rows');
  await page.screenshot({ path: file('waiting-pc'), fullPage: true });
  await page.locator('#waiting').screenshot({ path: file('waiting-pc-card') });
  // The week band stays where it was without the card (col-a runs beside it, the full height).
  const plain = await shoot(answer({ waiting: null }), laptop, '', async (p) => { s.bandWithout = await p.evaluate(() => Math.round(document.getElementById('weekBand').getBoundingClientRect().top)); });
  check(s.band === s.bandWithout, `waiting: the card leaves the week band at ${s.bandWithout}px (with it: ${s.band}px)`);

  // Add: validation first, nothing sent.
  await page.click('#waitAdd');
  s = await ws(page);
  check(s.form && !s.add && s.focus === 'wfWho', 'waiting: Add opens the form, Who has focus: ' + JSON.stringify({ form: s.form, add: s.add, focus: s.focus }));
  check(await page.$$eval('#waitForm [data-wf="days"] [aria-pressed="true"]', (b) => b.map((x) => x.textContent).join()) === '7 days'
    && await page.$$eval('#waitForm [data-wf="channel"] [aria-pressed="true"]', (b) => b.map((x) => x.textContent).join()) === 'Email', 'waiting: Email and 7 days to start with');
  await page.click('#wfSend');
  s = await ws(page);
  check(s.err === 'Who and About are needed.' && s.invalid.join() === 'wfWho,wfWhat' && s.focus === 'wfWho' && w.posts.length === 0, 'waiting: both empty: ' + JSON.stringify({ err: s.err, invalid: s.invalid, focus: s.focus, posts: w.posts.length }));
  await page.fill('#wfWho', '  The landlord ');
  await page.click('#wfSend');
  s = await ws(page);
  check(s.err === 'About is needed.' && s.invalid.join() === 'wfWhat' && s.focus === 'wfWhat' && w.posts.length === 0, 'waiting: About empty: ' + JSON.stringify({ err: s.err, invalid: s.invalid }));
  await page.fill('#wfWhat', 'the heating repair');
  await page.click('#waitForm [data-v="phone"]');
  await page.click('#waitForm [data-v="14"]');
  await page.fill('#wfFor', 'Nick');
  check(!(await ws(page)).err, 'waiting: the error goes once Who and About are filled');
  await page.waitForTimeout(300); // the chips' colour change
  await page.locator('#waiting').screenshot({ path: file('waiting-pc-form') });
  // The hub refuses: its words show, nothing typed is lost.
  w.mode = 'refuse';
  await page.click('#wfSend');
  await page.waitForTimeout(400);
  s = await ws(page);
  check(s.err === 'Not added: channel: email, phone, letter or in-person' && s.vals.join('|') === '  The landlord |the heating repair|Nick' && s.form, 'waiting: a refusal shows the hub\'s words and keeps the draft: ' + JSON.stringify({ err: s.err, vals: s.vals }));
  // No hub: the same.
  w.mode = 'down';
  await page.click('#wfSend');
  await page.waitForTimeout(400);
  s = await ws(page);
  check(/^Can’t reach the hub/.test(s.err) && s.vals[1] === 'the heating repair' && s.form, 'waiting: no hub keeps the draft: ' + s.err);
  // A double tap sends once; the body is what was picked; the item goes in, then Morning asks again.
  w.mode = 'ok';
  w.posts.length = 0;
  const gets = w.gets;
  await page.evaluate(() => { const b = document.getElementById('wfSend'); b.click(); b.click(); document.getElementById('waitForm').requestSubmit(); });
  await page.waitForTimeout(600);
  s = await ws(page);
  check(w.posts.length === 1, 'waiting: a double tap sends once: ' + w.posts.length);
  check(JSON.stringify(w.posts[0]) === JSON.stringify({ who: 'The landlord', what: 'the heating repair', channel: 'phone', chaseDays: 14, source: 'morning', forWhom: 'Nick' }), 'waiting: the POST body: ' + JSON.stringify(w.posts[0]));
  check(!s.form && s.add && s.focus === 'waitAdd' && s.head === 'Waiting on 5 open' && !s.more && s.rows.length === 5 && s.rows[4] === 'The landlord about the heating repair · for Nick since today', 'waiting: the new item shows, the form closes: ' + JSON.stringify(s.rows) + s.head);
  check(w.gets === gets + 1, 'waiting: Morning is asked again after an add: ' + (w.gets - gets));
  check(s.vals.join('|') === '||', 'waiting: the form is empty after an add');
  // A second add with nothing picked: Email, 7 days, no forWhom; a sixth item makes "+1 more".
  await page.click('#waitAdd');
  await page.fill('#wfWho', 'The dentist');
  await page.fill('#wfWhat', 'the new appointment');
  await page.press('#wfWhat', 'Enter');
  await page.waitForTimeout(600);
  s = await ws(page);
  check(JSON.stringify(w.posts[1]) === JSON.stringify({ who: 'The dentist', what: 'the new appointment', channel: 'email', chaseDays: 7, source: 'morning' }), 'waiting: the defaults go out with Enter: ' + JSON.stringify(w.posts[1]));
  check(s.rows.length === 5 && s.more === '+1 more' && s.head === 'Waiting on 6 open', 'waiting: five rows and +1 more: ' + s.more + ' ' + s.head);
  // Escape closes the form and keeps a draft.
  await page.click('#waitAdd');
  await page.fill('#wfWho', 'Half typed');
  await page.press('#wfWho', 'Escape');
  await page.click('#waitAdd');
  s = await ws(page);
  check(s.form && s.vals[0] === 'Half typed', 'waiting: Escape closes, the draft stays: ' + s.vals);
  await ctx.close();

  // Empty: only the header and Add. No block: no card.
  {
    const e = await openW(wworld([]), laptop);
    s = await ws(e.page);
    check(s.card && s.head === 'Waiting on' && s.add && !s.rows.length && !s.more && !(await e.page.$$('#waitList *')).length, 'waiting empty: only the header and Add: ' + JSON.stringify(s));
    await e.page.locator('#waiting').screenshot({ path: file('waiting-pc-empty') });
    await e.ctx.close();
    const n = await shoot(answer({ waiting: null }), laptop, '', async (p) => { s.nullCard = await p.evaluate(() => document.getElementById('waiting').hidden); });
    check(s.nullCard === true, 'waiting: no card without the block');
  }

  // The phone: after Today, before Projects; the form fits, nothing scrolls sideways.
  {
    const pw = wworld();
    const p = await openW(pw, phone);
    s = await ws(p.page);
    check(s.order[1] < s.order[2] && s.order[2] < s.order[3], 'waiting phone: after Today, before Projects: ' + s.order);
    check(!s.overflow, 'waiting phone: no sideways scroll');
    await p.page.screenshot({ path: file('waiting-phone'), fullPage: true });
    await p.page.click('#waitAdd');
    await p.page.click('#wfSend');
    s = await ws(p.page);
    const sizes = await p.page.$$eval('#waitForm .wf-in, #waitForm button', (els) => els.map((x) => Math.round(x.getBoundingClientRect().height)));
    check(s.form && s.err === 'Who and About are needed.' && !s.overflow && sizes.every((h) => h >= 44), 'waiting phone: the form, its error, 44 px controls: ' + sizes);
    check(await p.page.$eval('#wfWho', (x) => parseFloat(getComputedStyle(x).fontSize) >= 16), 'waiting phone: inputs at 16 px or more (no zoom on iOS)');
    await p.page.locator('#waiting').screenshot({ path: file('waiting-phone-form') });
    await p.ctx.close();
  }
}

// Email in (paul-hub src/mail.js, mocked like the real routes): read-later mails sit above the
// letters with the event-blue tick, the meta line, the excerpt on tap, Done and Drop (the POST body,
// the row off at once, back with a toast when the POST fails, a 404 keeps it off), the count line,
// the "mails to sort in Day" line, nothing new without the block, and the phone's order.
{
  const NOON_MS = Date.parse(NOON);
  const hmIn = (t) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(t);
  const ymdIn = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(t);
  const shortIn = (t) => {
    const d = ymdIn(t);
    const wd = new Date(d + 'T12:00:00Z').getUTCDay();
    return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][wd]} ${+d.slice(8, 10)} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+d.slice(5, 7) - 1]}`;
  };
  const t1 = NOON_MS - 200 * 60000, t2 = NOON_MS - 864e5, t3 = NOON_MS - 3 * 864e5, t4 = NOON_MS - 9 * 864e5;
  const EX1 = 'The defence budget doubles by 2030, and most of it goes to people, not kit. Three things that means for jobs in The Hague this winter, and where the openings will be first.';
  const mails = () => [
    { id: 'mail0000000000a1', subject: 'Why the defence budget doubles by 2030 and what it means for the jobs in The Hague', sender: 'A newsletter', sentAt: 'Wed, 21 Oct 2026 18:02', excerpt: EX1, at: new Date(t1).toISOString() },
    { id: 'mail0000000000b2', subject: 'New routine ideas for legs day', sender: 'Nick', sentAt: new Date(t2 - 3600000).toISOString(), excerpt: 'Try split squats before the leg press.', at: new Date(t2).toISOString() },
    { id: 'mail0000000000c3', subject: 'Your parcel is on its way', sender: null, sentAt: 'Mon 19 Oct', excerpt: 'Track it in the app.', at: new Date(t3).toISOString() },
    { id: 'mail0000000000d4', subject: 'An older one from last week', sender: 'The bank', sentAt: null, excerpt: '', at: new Date(t4).toISOString() },
  ];
  const mworld = (later = mails(), triage = 2) => {
    const w = { mail: { later, triage }, posts: [], mode: 'ok' };
    const h = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
    w.morning = (r) => r.fulfill({ json: answer({ mail: w.mail }), headers: h });
    w.post = async (r) => {
      const q = r.request();
      if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
      w.posts.push({ path: new URL(q.url()).pathname, body: q.postDataJSON() });
      await new Promise((done) => setTimeout(done, 400)); // network time, so the row is seen off while the POST is out
      if (w.mode === 'fail') return r.fulfill({ status: 500, json: { error: 'boom' }, headers: h });
      if (w.mode === 'gone') return r.fulfill({ status: 404, json: { error: 'not a read-later line' }, headers: h });
      return r.fulfill({ json: { ok: true }, headers: h });
    };
    return w;
  };
  const openM = async (w, viewport) => {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: viewport.width < 700 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date(NOON));
    await page.addInitScript((d) => { try { localStorage.setItem('morning.enteredOn', JSON.stringify(d)); } catch (e) {} }, day(0));
    await page.route('**/api/morning/**', w.morning);
    await page.route('**/api/mail/**', w.post);
    await page.route('**/api/energy/**', (r) => r.abort());
    await page.route('**/api/waiting/**', (r) => r.abort());
    await page.route('**/site.**espn.com/**', (r) => r.abort());
    await page.goto(BASE + '?c=' + CODE);
    await page.waitForFunction(() => /As of/.test(document.getElementById('asOf').textContent));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    return { ctx, page };
  };
  const ms = (page) => page.evaluate(() => {
    const card = document.getElementById('intake');
    const rows = [...document.querySelectorAll('#mailList .mail-row')];
    const letters = [...document.querySelectorAll('#intakeList .read-row')];
    const toastEl = document.getElementById('mailToast');
    const sort = document.getElementById('mailSort');
    const first = rows[0] && rows[0].querySelector('.mail-subj');
    return {
      card: !card.hidden,
      note: document.getElementById('intakeNote').textContent,
      kinds: rows.map((r) => r.querySelector('.read-kind').textContent),
      metas: rows.map((r) => (r.querySelector('.mail-meta') || {}).textContent || ''),
      ids: rows.map((r) => r.querySelector('[data-mail="done"]').dataset.id),
      btns: rows.map((r) => [...r.querySelectorAll('.mail-btns button')].map((b) => b.textContent).join()),
      edge: rows.length ? getComputedStyle(rows[0], '::before').backgroundColor : '',
      oneLine: first ? first.scrollWidth > first.clientWidth && Math.round(first.getBoundingClientRect().height) < 30 : null,
      excerpt: [...document.querySelectorAll('#mailList .mail-excerpt')].map((e) => e.textContent),
      expanded: first ? first.getAttribute('aria-expanded') : null,
      lastMailBottom: rows.length ? Math.round(rows[rows.length - 1].getBoundingClientRect().bottom) : null,
      firstLetterTop: letters.length ? Math.round(letters[0].getBoundingClientRect().top) : null,
      letters: letters.map((d) => d.innerText.replace(/\s+/g, ' ').trim()),
      empty: !!document.querySelector('#intakeList .empty'),
      toast: toastEl.hidden ? '' : toastEl.textContent,
      sort: sort.hidden ? '' : sort.textContent,
      sortBelow: sort.hidden ? null : sort.getBoundingClientRect().top >= Math.max(...[...card.querySelectorAll('.read-row')].map((r) => r.getBoundingClientRect().bottom)),
      mailListHidden: document.getElementById('mailList').hidden,
      overflow: document.documentElement.scrollWidth > innerWidth,
      btnH: [...document.querySelectorAll('#mailList .mail-btns button')].map((b) => Math.round(b.getBoundingClientRect().height)),
      order: ['#parked', '#intake', '#feed'].map((q) => getComputedStyle(document.querySelector(q)).order),
    };
  });

  // The PC: rows, meta lines, the tick, above the letters, the count, the sort line.
  const w = mworld();
  const { ctx, page } = await openM(w, laptop);
  let s = await ms(page);
  check(s.card && s.kinds.join() === 'Mail,Mail,Mail,Mail', 'mail: four rows labelled Mail: ' + s.kinds);
  check(s.ids.join() === 'mail0000000000a1,mail0000000000b2,mail0000000000c3,mail0000000000d4', 'mail: newest first as sent: ' + s.ids);
  check(s.metas[0] === `From A newsletter · forwarded ${hmIn(t1)}` && s.metas[1] === 'From Nick · forwarded yesterday'
    && s.metas[2] === `Forwarded ${shortIn(t3)}` && s.metas[3] === `From The bank · forwarded ${shortIn(t4)}`, 'mail: meta lines: ' + JSON.stringify(s.metas));
  check(s.btns.every((b) => b === 'Done,Drop'), 'mail: Done and Drop on each row: ' + s.btns);
  check(s.edge === 'rgb(127, 166, 207)', 'mail: event-blue holder tick: ' + s.edge);
  check(s.oneLine === true, 'mail: a long subject stays on one line with an ellipsis');
  check(s.lastMailBottom <= s.firstLetterTop && s.letters.length === 2 && /^letter Insurance letter/i.test(s.letters[0]), 'mail: rows above the letters: ' + s.lastMailBottom + ' / ' + s.firstLetterTop);
  check(s.note === '5 this week', 'mail: the count line adds the 3 mails from the last 7 days to the 2 letters: ' + s.note);
  check(s.sort === '2 mails to sort in Day' && s.sortBelow, 'mail: the sort line at the bottom: ' + s.sort);
  check(s.excerpt.length === 0 && s.expanded === 'false', 'mail: excerpts closed to start with');
  await page.screenshot({ path: file('mail-pc'), fullPage: true });
  await page.locator('#intake').screenshot({ path: file('mail-pc-card') });

  // The excerpt: a tap on the subject opens it, a second tap closes it.
  await page.click('#mailList .mail-row:first-child .mail-subj');
  s = await ms(page);
  check(s.excerpt.length === 1 && s.excerpt[0] === EX1 && s.expanded === 'true', 'mail: the subject opens its excerpt: ' + s.excerpt);
  await page.locator('#intake').screenshot({ path: file('mail-pc-open') });
  await page.click('#mailList .mail-row:first-child .mail-subj');
  s = await ms(page);
  check(s.excerpt.length === 0 && s.expanded === 'false', 'mail: a second tap closes it');
  check((await page.$$('#mailList .mail-row:nth-child(4) button.mail-subj')).length === 0, 'mail: no excerpt, no toggle');

  // Done: off at once, the POST body, still off after.
  await page.click('#mailList [data-mail="done"][data-id="mail0000000000a1"]');
  s = await ms(page);
  check(s.ids.join() === 'mail0000000000b2,mail0000000000c3,mail0000000000d4', 'mail done: the row goes at once: ' + s.ids);
  await page.waitForTimeout(700);
  s = await ms(page);
  check(w.posts.length === 1 && w.posts[0].path === `/api/mail/${CODE}/mail0000000000a1` && JSON.stringify(w.posts[0].body) === '{"action":"done"}', 'mail done: the POST: ' + JSON.stringify(w.posts));
  check(s.ids.length === 3 && !s.toast && s.note === '4 this week', 'mail done: stays off, the count follows: ' + s.ids + ' ' + s.note);

  // Drop.
  await page.click('#mailList [data-mail="drop"][data-id="mail0000000000b2"]');
  await page.waitForTimeout(700);
  s = await ms(page);
  check(w.posts.length === 2 && w.posts[1].path === `/api/mail/${CODE}/mail0000000000b2` && JSON.stringify(w.posts[1].body) === '{"action":"drop"}', 'mail drop: the POST: ' + JSON.stringify(w.posts[1]));
  check(s.ids.join() === 'mail0000000000c3,mail0000000000d4', 'mail drop: the row is gone: ' + s.ids);

  // The POST fails: off at once, back with the toast.
  w.mode = 'fail';
  await page.click('#mailList [data-mail="done"][data-id="mail0000000000c3"]');
  s = await ms(page);
  check(s.ids.join() === 'mail0000000000d4', 'mail fail: off at once while the POST is out: ' + s.ids);
  await page.waitForTimeout(700);
  s = await ms(page);
  check(s.ids.join() === 'mail0000000000c3,mail0000000000d4' && s.toast === 'Couldn’t save that. Try again.', 'mail fail: the row comes back with a toast: ' + s.ids + ' / ' + s.toast);
  await page.locator('#intake').screenshot({ path: file('mail-pc-fail') });

  // A 404 (closed somewhere else): it stays off, no toast.
  w.mode = 'gone';
  await page.evaluate(() => { document.getElementById('mailToast').hidden = true; });
  await page.click('#mailList [data-mail="drop"][data-id="mail0000000000d4"]');
  await page.waitForTimeout(700);
  s = await ms(page);
  check(s.ids.join() === 'mail0000000000c3' && !s.toast, 'mail 404: stays off, no toast: ' + s.ids + ' / ' + s.toast);
  await ctx.close();

  // Nothing new without the block, or with an empty one; one mail to sort reads singular.
  const base = await shoot(answer(), laptop, '');
  for (const [mail, what] of [[null, 'null'], [{ later: [], triage: 0 }, 'empty']]) {
    const a = await shoot(answer({ mail }), laptop, '', async (p) => { s = await ms(p); });
    check(s.card && s.kinds.length === 0 && s.mailListHidden && !s.sort && !s.toast && s.note === '2 this week'
      && JSON.stringify(a.intake) === JSON.stringify(base.intake), `mail ${what}: the card as before: ` + JSON.stringify({ kinds: s.kinds, sort: s.sort, note: s.note, intake: a.intake }));
  }
  await shoot(answer({ mail: { later: [], triage: 1 } }), laptop, '', async (p) => { s = await ms(p); });
  check(s.kinds.length === 0 && s.sort === '1 mail to sort in Day', 'mail: one to sort, singular, no rows: ' + s.sort);
  await shoot(answer({ intake: null, mail: { later: mails().slice(0, 1), triage: 0 } }), laptop, '', async (p) => { s = await ms(p); });
  check(s.card && s.kinds.length === 1 && !s.empty && s.letters.length === 0 && s.note === '1 this week', 'mail: shows the card before the first letter, no empty line: ' + JSON.stringify({ card: s.card, kinds: s.kinds, empty: s.empty, note: s.note }));
  await shoot(answer({ intake: null, mail: null }), laptop, '', async (p) => { s = await ms(p); });
  check(!s.card, 'mail: no letters and no mail, no card');

  // The phone: the card keeps its order, buttons get their own line at 44 px, nothing scrolls sideways.
  {
    const p = await openM(mworld(), phone);
    s = await ms(p.page);
    check(s.order.join() === '6,7,8', 'mail phone: Read for you keeps its place (after Parked, before Lately): ' + s.order);
    check(!s.overflow && s.btnH.length === 8 && s.btnH.every((h) => h >= 44), 'mail phone: no sideways scroll, 44 px buttons: ' + s.btnH);
    await p.page.screenshot({ path: file('mail-phone'), fullPage: true });
    await p.page.click('#mailList .mail-row:first-child .mail-subj');
    await p.page.locator('#intake').screenshot({ path: file('mail-phone-card') });
    s = await ms(p.page);
    check(s.excerpt[0] === EX1 && !s.overflow, 'mail phone: the excerpt opens and wraps');
    await p.ctx.close();
  }
}

await browser.close();
if (errors.length) { console.error(errors.join('\n')); failed = true; }
console.log(`${checks - fails} of ${checks} checks pass`);
console.log(failed ? 'FAILED' : 'ok');
process.exit(failed ? 1 : 0);
