// Parked on 03 Projects: ages (calm, amber, red), the three buttons and Undo, against a
// mocked Worker that keeps state like the real route. Every value here is made up.
//   PORT=8095 npm run serve, then: APP=http://localhost:8095/morning/ npm run parked-check
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CODE = 'abcdefgh23456789';
const BASE = process.env.APP || 'http://localhost:8080/morning/';
const OUT = new URL('../verify-shots/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const file = (n) => fileURLToPath(new URL(n + '.png', OUT));
const NOW = '2026-10-08T13:00:00+02:00';
const ago = (n) => new Date(Date.parse('2026-10-08T12:00:00Z') - n * 864e5).toISOString().slice(0, 10);

let failed = false;
const check = (ok, what) => { if (!ok) { failed = true; console.error('FAIL:', what); } else console.log('ok:', what); };

function world(dark) {
  const projects = {
    updated: new Date(NOW).toISOString(),
    projects: [
      { name: 'Garden planner', status: 'waiting', next: 'Pick a colour for the beds' },
      { name: 'Recipe box', status: 'live', next: '' },
      { name: 'Old blog', status: 'parked', next: 'Move the posts', id: 'oldblog01', since: ago(16) },
    ],
    parked: [
      { text: 'Move passwords to a manager', from: 'Admin', id: 'pass00001', since: ago(15) },
      { text: 'Tidy the downloads folder', from: 'Admin', id: 'tidy00001', since: ago(9) },
      { text: 'Send the birthday list', from: 'Morning', id: 'bday00001', since: ago(2) },
      { text: 'Fresh idea', from: 'Other', id: 'fresh0001', since: ago(0) },
    ],
  };
  const sun = [{ date: ago(0), sunrise: `${ago(0)}T00:00`, sunset: dark ? `${ago(0)}T00:01` : `${ago(0)}T23:59` }];
  return {
    projects, done: [], posts: [],
    answer() {
      return { now: new Date(NOW).toISOString(), todos: { items: [{ text: 'Call the dentist' }], updated: NOW, yesterday: { count: 0, items: [] } },
        calendar: { events: [], sent: NOW, stale: false }, fixed: { events: [], countdowns: [] }, weather: { sun }, arsenal: null, bins: null,
        birthdays: { birthdays: [] }, news: { items: [] }, kitchen: null, projects: structuredClone(this.projects), german: null };
    },
    act({ id, action }) {
      this.posts.push(action);
      if (action === 'undo') {
        const r = this.done.shift();
        if (r.kind === 'project') this.projects.projects.push(r.item); else this.projects.parked.push(r.item);
      } else {
        let i = this.projects.parked.findIndex((x) => x.id === id);
        if (i >= 0) this.done.unshift({ kind: 'parked', item: this.projects.parked.splice(i, 1)[0] });
        else { i = this.projects.projects.findIndex((x) => x.id === id); this.done.unshift({ kind: 'project', item: this.projects.projects.splice(i, 1)[0] }); }
      }
      return { ok: true, projects: structuredClone(this.projects) };
    },
  };
}

const browser = await chromium.launch();
async function open(viewport, dark) {
  const w = world(dark);
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: viewport.width < 700 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date(NOW));
  await page.route('**/api/morning/**', async (r) => {
    const h = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
    if (r.request().url().endsWith('/parked')) return r.fulfill({ json: w.act(r.request().postDataJSON()), headers: h });
    return r.fulfill({ json: w.answer(), headers: h });
  });
  await page.route('**/site.**espn.com/**', (r) => r.abort());
  await page.goto(BASE + '?c=' + CODE);
  await page.waitForSelector('#projList .park');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1600);
  return { page, ctx, w, errors };
}
const rows = (page) => page.$$eval('#projList .park', (els) => els.map((e) => ({
  lv: e.className.match(/lv-(\w+)/)[1], from: e.querySelector('.park-from').textContent,
  age: e.querySelector('.park-age')?.textContent, what: e.querySelector('.park-what').textContent,
})));

for (const [name, viewport, dark] of [['parked-pc', { width: 1440, height: 1000 }, false], ['parked-phone', { width: 390, height: 844 }, true]]) {
  const { page, ctx, w, errors } = await open(viewport, dark);
  let r = await rows(page);
  console.log(name, r);
  check(r.map((x) => x.what).join('|') === 'Move the posts|Move passwords to a manager|Tidy the downloads folder|Send the birthday list|Fresh idea', name + ': oldest first, parked project included');
  check(r.map((x) => x.lv).join() === 'red,red,amber,calm,calm', name + ': levels red, red, amber, calm, calm');
  check(r[0].age === '16 days' && r[4].age === 'Today', name + ': ages read "16 days" and "Today"');
  check(await page.textContent('.park-oldest') === 'Oldest 16 days', name + ': header says oldest 16 days');
  check(await page.$eval('#projList', (l) => l.firstElementChild.classList.contains('park-head')), name + ': Parked sits at the top of 03');
  const sizes = await page.$$eval('#projList .park:first-child .pbtn', (b) => b.map((x) => Math.round(x.getBoundingClientRect().height)));
  check(viewport.width < 700 ? sizes.every((h) => h >= 44) : sizes.every((h) => h >= 34), name + ': button heights ' + sizes);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ': no sideways scroll');
  await page.screenshot({ path: file(name), fullPage: true });
  await page.locator('#projects').screenshot({ path: file(name + '-card') });

  // Do today: off Parked at once, Undo bar, then Undo brings it back.
  await page.click('#projList .park:nth-child(2) .pbtn-today');
  await page.waitForFunction(() => !document.getElementById('parkToast').hidden);
  check(await page.textContent('#parkToast span') === 'On today’s to-do list', name + ': toast after Do today');
  await page.waitForTimeout(300);
  r = await rows(page);
  check(!r.some((x) => x.what === 'Move passwords to a manager'), name + ': item gone after Do today');
  await page.locator('#projects').screenshot({ path: file(name + '-toast') });
  await page.click('#parkToast button');
  await page.waitForTimeout(300);
  r = await rows(page);
  check(r.some((x) => x.what === 'Move passwords to a manager' && x.lv === 'red'), name + ': Undo brings it back, still red');
  check(w.posts.join() === 'today,undo', name + ': Worker got today then undo: ' + w.posts);

  // Done and Drop on the rest until it is empty: the section goes away.
  for (const act of ['done', 'drop', 'done', 'drop', 'done']) {
    await page.click(`#projList .park:first-child .pbtn-${act}`);
    await page.waitForTimeout(250);
  }
  check((await page.$$('#projList .park')).length === 0 && !(await page.$('.park-head')), name + ': all handled, Parked is gone');
  check(await page.$('#projList .proj-turn') !== null, name + ': Your turn still shows');
  check(errors.length === 0, name + ': no page errors ' + errors.join('; '));
  await ctx.close();
}
await browser.close();
if (failed) process.exit(1);
console.log('all parked checks pass');
