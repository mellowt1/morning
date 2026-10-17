// The Desk card: type a line, prepared rows come back, Approve with Undo, Edit, Copy, Skip, against a
// mocked Worker that keeps state like the real route. Hidden on the phone. Every value is made up.
//   PORT=8095 npm run serve, then: APP=http://localhost:8095/morning/ npm run desk-check
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CODE = 'abcdefgh23456789';
const BASE = process.env.APP || 'http://localhost:8080/morning/';
const OUT = new URL('../verify-shots/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const file = (n) => fileURLToPath(new URL(n + '.png', OUT));
const NOW = '2026-10-08T13:00:00+02:00';

let failed = false;
const check = (ok, what) => { if (!ok) { failed = true; console.error('FAIL:', what); } else console.log('ok:', what); };

function world() {
  return {
    items: [], posts: [], seq: 0,
    answer() {
      return { now: new Date(NOW).toISOString(), todos: { items: [{ text: 'Call the dentist' }], updated: NOW, yesterday: { count: 0, items: [] } },
        calendar: { events: [], sent: NOW, stale: false }, fixed: { events: [], countdowns: [] }, weather: null, arsenal: null, bins: null,
        birthdays: { birthdays: [] }, news: { items: [] }, kitchen: null, projects: null, german: null };
    },
    prepare({ text }) {
      const id = 'desk' + String(++this.seq).padStart(8, '0');
      const item = /\?$/.test(text)
        ? { id, at: NOW, text, answer: 'Two things are due this week: the dentist and the bike.', actions: [] }
        : { id, at: NOW, text, answer: null, actions: [
          { kind: 'todo', text: 'Call the dentist about Thursday', section: 'soon', person: null, state: 'ready' },
          { kind: 'draft', to: 'Sam', lang: 'en', text: 'Hey Sam, I am running late on Saturday. See you at eight.', state: 'ready' },
        ] };
      this.items.unshift(item);
      return { item };
    },
    act({ id, idx, action, edit }) {
      this.posts.push(action);
      const item = this.items.find((x) => x.id === id);
      const a = item.actions[idx];
      if (edit && edit.text) a.text = edit.text;
      a.state = { approve: 'approved', copied: 'copied', skip: 'skipped', undo: 'ready' }[action];
      return { item: structuredClone(item) };
    },
  };
}

const browser = await chromium.launch();
async function open(viewport) {
  const w = world();
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: viewport.width < 700, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date(NOW));
  const h = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
  await page.route('**/api/morning/**', (r) => (r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: h }) : r.fulfill({ json: w.answer(), headers: h })));
  await page.route('**/api/desk/**', async (r) => {
    const q = r.request();
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
    if (q.method() === 'GET') return r.fulfill({ json: { items: w.items }, headers: h });
    if (q.url().endsWith('/act')) return r.fulfill({ json: w.act(q.postDataJSON()), headers: h });
    await new Promise((res) => setTimeout(res, 400)); // Claude takes a moment
    return r.fulfill({ json: w.prepare(q.postDataJSON()), headers: h });
  });
  await page.route('**/site.**espn.com/**', (r) => r.abort());
  await page.goto(BASE + '?c=' + CODE);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1600);
  return { page, ctx, w, errors };
}
const acts = (page) => page.$$eval('#deskList .desk-act', (els) => els.map((e) => ({ what: e.querySelector('.desk-what, .desk-edit')?.textContent || e.querySelector('.desk-edit')?.value, done: e.classList.contains('is-done'), state: e.querySelector('.desk-state')?.textContent || '' })));

// PC: the whole flow.
{
  const { page, ctx, w, errors } = await open({ width: 1440, height: 1000 });
  check(await page.isVisible('#desk'), 'pc: Desk is shown');
  check(await page.evaluate(() => { const d = document.getElementById('desk').getBoundingClientRect(), p = document.getElementById('projects').getBoundingClientRect(); return d.top < 400 && (document.getElementById('projects').hidden || d.bottom <= p.top); }), 'pc: Desk sits at the top of the right column');
  await page.fill('#deskInput', 'remind me to call the dentist and tell Sam I am late Saturday');
  await page.press('#deskInput', 'Enter');
  await page.waitForFunction(() => !document.getElementById('deskBusy').hidden);
  check(await page.textContent('#deskBusy') === 'Preparing…', 'pc: Preparing… while Claude works');
  await page.waitForSelector('#deskList .desk-act');
  check(await page.inputValue('#deskInput') === '', 'pc: the box empties once prepared');
  let r = await acts(page);
  check(r.length === 2 && !r[0].done && !r[1].done, 'pc: two prepared rows, both ready');
  check((await page.textContent('#deskList .desk-act:nth-of-type(1) .fold-from')).includes('Soon'), 'pc: the task says its section');
  await page.screenshot({ path: file('desk-pc'), fullPage: true });
  await page.locator('#desk').screenshot({ path: file('desk-pc-card') });

  // Edit then Approve: the edited text goes to the Worker, Undo appears and works.
  await page.click('#deskList .desk-act:nth-of-type(1) [data-desk="edit"]');
  await page.fill('#deskList textarea', 'Call the dentist before Thursday');
  await page.locator('#desk').screenshot({ path: file('desk-pc-edit') });
  await page.click('#deskList .desk-act:nth-of-type(1) [data-desk="approve"]');
  await page.waitForFunction(() => !document.getElementById('deskToast').hidden);
  check((await page.textContent('#deskToast span')) === 'On the to-do list, in Soon', 'pc: toast after Approve');
  await page.waitForTimeout(300);
  r = await acts(page);
  check(r[0].done && r[0].state === 'On the to-do list' && r[0].what === 'Call the dentist before Thursday', 'pc: approved row shows the edited text');
  await page.click('#deskToast button');
  await page.waitForTimeout(300);
  r = await acts(page);
  check(!r[0].done, 'pc: Undo makes the row ready again');

  // Copy the draft, Skip the task.
  await page.click('#deskList .desk-act:nth-of-type(2) [data-desk="copy"]');
  await page.waitForTimeout(300);
  check(await page.evaluate(() => navigator.clipboard.readText()) === 'Hey Sam, I am running late on Saturday. See you at eight.', 'pc: Copy puts the draft on the clipboard');
  await page.click('#deskList .desk-act:nth-of-type(1) [data-desk="skip"]');
  await page.waitForTimeout(300);
  r = await acts(page);
  check(r[0].state === 'Skipped' && r[1].state === 'Copied', 'pc: Skipped and Copied');
  check(w.posts.join() === 'approve,undo,copied,skip', 'pc: Worker got approve, undo, copied, skip: ' + w.posts);

  // A question: the answer shows, no buttons.
  await page.fill('#deskInput', 'what is due this week?');
  await page.click('#deskGo');
  await page.waitForSelector('#deskList .desk-answer');
  check((await page.textContent('#deskList .desk-entry:first-child .desk-answer')).startsWith('Two things'), 'pc: a question gets an answer, newest on top');
  await page.locator('#desk').screenshot({ path: file('desk-pc-answer') });

  // Reload: the card comes back from GET.
  await page.reload();
  await page.waitForSelector('#deskList .desk-entry');
  check((await page.$$('#deskList .desk-entry')).length === 2, 'pc: both lines are back after a reload');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'pc: no sideways scroll');
  check(errors.length === 0, 'pc: no page errors ' + errors.join('; '));
  await ctx.close();
}

// Phone: the card is not there.
{
  const { page, ctx, errors } = await open({ width: 390, height: 844 });
  check(!(await page.isVisible('#desk')), 'phone: Desk is hidden');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone: no sideways scroll');
  check(errors.length === 0, 'phone: no page errors ' + errors.join('; '));
  await page.screenshot({ path: file('desk-phone'), fullPage: true });
  await ctx.close();
}

await browser.close();
if (failed) process.exit(1);
console.log('all desk checks pass');
