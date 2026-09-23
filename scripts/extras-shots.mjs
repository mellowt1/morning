// Screenshots of the second pass (Start with, yesterday's wins, birthdays, NOS) with the
// Worker mocked, into verify-shots/extras-*.png. Every name and headline here is made up.
//   npm run serve, then: npm run extras-shots
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CODE = 'abcdefgh23456789'; // made up; the Worker is mocked
const APP = 'http://localhost:8080/morning/?c=' + CODE;
const OUT = new URL('../verify-shots/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const slots = (from, wet) => Array.from({ length: 8 }, (_, i) => {
  const m = from + i * 15;
  return { time: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, mm: wet[i] || 0 };
});

function answer(evening) {
  return {
    now: new Date().toISOString(),
    todos: {
      items: [
        { text: 'Email the landlord about the heating' },
        { text: 'Buy new bike lights' },
        { text: 'Renew the library card' },
        { text: 'Pay the water bill' },
      ],
      updated: '2026-09-24T05:00:00Z',
      yesterday: { count: 4, items: ['Sent the tax form', 'Fixed the back tyre', 'Called the insurer', 'Laundry'] },
    },
    calendar: {
      events: [
        { title: 'Dentist check up', start: '2026-09-24T10:00:00+02:00', end: '2026-09-24T10:30:00+02:00', allDay: false, location: 'Centrum' },
        { title: 'Day off', start: '2026-09-25', end: '2026-09-26', allDay: true, location: '' },
        { title: 'Team meeting', start: '2026-09-29T09:30:00+02:00', end: '2026-09-29T10:30:00+02:00', allDay: false, location: '' },
      ],
      sent: '2026-09-24T07:30:00+02:00',
      stale: false,
    },
    fixed: {
      events: [{ title: 'Evening class, group A', start: '2026-09-28T20:00:00+02:00', end: '2026-09-28T22:00:00+02:00', allDay: false, location: '' }],
      countdowns: [{ what: 'the trip', date: '2026-10-06', days: 12 }],
    },
    weather: evening ? {
      day: '2026-09-25',
      rides: [
        { time: '08:00', label: 'to work', temp: 11, rainProb: 5, rainMm: 0, wind: 14, gusts: 25, compass: 'SW', relative: null, past: false },
        { time: '17:30', label: 'home', temp: 15, rainProb: 10, rainMm: 0, wind: 29, gusts: 47, compass: 'W', relative: null, past: false },
      ],
      verdict: 'Dry both ways tomorrow, windy home.',
      rain: { line: 'Dry until 23:00', slots: slots(21 * 60 + 30, [0, 0, 0, 0, 0, 0, 0.2, 0.6]) },
      sun: [{ date: '2026-09-24', sunrise: '2026-09-24T07:31', sunset: '2026-09-24T19:36' }],
    } : {
      day: '2026-09-24',
      rides: [
        { time: '08:00', label: 'to work', temp: 12, rainProb: 70, rainMm: 0.8, wind: 18, gusts: 32, compass: 'SW', relative: null, past: false },
        { time: '17:30', label: 'home', temp: 16, rainProb: 5, rainMm: 0, wind: 16, gusts: 27, compass: 'SW', relative: null, past: false },
      ],
      verdict: 'Rain around 08:15. Leave at 08:45 and stay dry.',
      rain: { line: 'Rain from 08:15 to 08:45', slots: slots(7 * 60 + 45, [0, 0, 0.3, 1.2, 0.4, 0, 0, 0]) },
      sun: [{ date: '2026-09-24', sunrise: '2026-09-24T07:31', sunset: '2026-09-24T19:36' }],
    },
    arsenal: {
      next: { opponent: 'Leeds', home: true, competition: 'Premier League', kickoff: '2026-10-10T11:30:00.000Z', live: false },
      last: { opponent: 'Brighton', home: false, competition: 'Premier League', kickoff: '2026-09-19T14:00:00.000Z', us: 0, them: 3, result: 'Lost', pens: null },
    },
    bins: { collections: [{ date: '2026-09-25', types: ['GFT'] }, { date: '2026-10-06', types: ['Papier'] }] },
    birthdays: { birthdays: [
      { name: 'Nick', date: '2026-09-24', days: 0, age: 40 },
      { name: 'Ada', date: '2026-09-29', days: 5, age: null },
    ] },
    news: { items: [
      { title: 'Kabinet presenteert plannen voor meer woningen in de Randstad', link: 'https://nos.nl/l/1000001' },
      { title: 'KNMI geeft code geel af voor harde wind aan de kust', link: 'https://nos.nl/l/1000002' },
      { title: 'Nieuwe tramlijn in Den Haag gaat een jaar later open', link: 'https://nos.nl/l/1000003' },
    ] },
  };
}

const browser = await chromium.launch();
const texts = [];
async function shot(name, viewport, at, evening) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('http://localhost:8787/**', (r) => r.fulfill({ json: answer(evening), headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.clock.setFixedTime(new Date(at));
  await page.goto(APP);
  await page.waitForFunction(() => /As of/.test(document.getElementById('asOf').textContent));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: fileURLToPath(new URL(name + '.png', OUT)), fullPage: true });
  const info = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    overflow: document.documentElement.scrollWidth > innerWidth,
    text: document.body.innerText,
    newTab: [...document.querySelectorAll('#newsList a')].every((a) => a.target === '_blank' && a.rel.includes('noopener')),
  }));
  texts.push(info.text);
  console.log(name, info.theme, info.overflow ? 'HORIZONTAL OVERFLOW' : 'fits', info.newTab ? 'links open in a new tab' : 'LINKS WRONG', errors.length ? 'ERRORS ' + errors.join('; ') : '');
  await ctx.close();
}

await shot('extras-phone-light', { width: 390, height: 844 }, '2026-09-24T05:42:00Z', false);
await shot('extras-phone-dark', { width: 390, height: 844 }, '2026-09-24T19:32:00Z', true);
await shot('extras-laptop-light', { width: 1280, height: 820 }, '2026-09-24T05:42:00Z', false);
await shot('extras-laptop-dark', { width: 1280, height: 820 }, '2026-09-24T19:32:00Z', true);
await browser.close();

const bad = texts.join('\n').split('\n').filter((l) => /[–—]| - /.test(l));
console.log(bad.length ? 'DASHES: ' + bad.join(' | ') : 'no dashes in visible text');
