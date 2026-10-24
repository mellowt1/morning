// The Restless list in Morning (paul-hub src/restless.js, mocked like the real routes, keeping its own
// state): "Restless?" only while the dial says wired; the free time and the chips from today's next
// event (and All evening when nothing else is on); Go, Another (the round's ids and the one turned
// down), Not for me and Done with their bodies; "That's all that fits" and the round starting over; an
// empty list; Add one (only What needed, a chip tapped twice left open); the list page restless/ (To sort
// first, drift words, Edit with every field, Delete asked twice, Add one, the hub away and Retry, no
// code); the Sunday "Spare energy this week" card; 44 px, focus, contrast, nothing sideways, no names in
// the console. PC 1440x900 and phone 390x844 screenshots. Every value here is made up.
//   PORT=8095 npm run serve, then: APP=http://localhost:8095/morning/ npm run restless-check
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CODE = 'abcdefgh23456789'; // made up; the hub is mocked
const BASE = process.env.APP || 'http://localhost:8080/morning/';
const OUT = new URL('../verify-shots/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const file = (n) => fileURLToPath(new URL(n + '.png', OUT));

const SAT = '2026-10-24';
const NOW = `${SAT}T14:20:00+02:00`; // a Saturday afternoon; the next event at 16:00 is 1 h 40 away
const LATE = `${SAT}T21:30:00+02:00`; // nothing else on today
const SUNDAY = '2026-10-25T18:30:00+01:00';
const at = (date, hhmm, off = '+02:00') => new Date(`${date}T${hhmm}:00${off}`).toISOString();
const NAMES = /park loop|bouldering|bike light|beach and back|Vliet|Call Sam|Walk to the harbour/;

let failed = false;
let passes = 0, fails = 0;
const check = (ok, what) => { if (!ok) { fails++; failed = true; console.error('FAIL:', what); } else { passes++; console.log('ok:', what); } };

const seed = () => [
  { id: 'park00000001', text: 'Run the park loop', kind: 'move', mins: 60, place: 'outside', costs: false, done: 4, skipped: 0 },
  { id: 'climb0000001', text: 'Climb at the bouldering hall', kind: 'move', mins: 120, place: 'inside', costs: true, done: 0, skipped: 2 },
  { id: 'light0000001', text: 'Fix the bike light', kind: 'build', mins: 30, place: 'inside', costs: false, done: 2, skipped: 0 },
  { id: 'beach0000001', text: 'Bike to the beach and back', kind: null, mins: 60, place: 'outside', costs: false, done: 0, skipped: 0 },
  { id: 'kayak0000001', text: 'Kayak on the Vliet', kind: 'outside', mins: 120, place: 'outside', costs: true, done: 0, skipped: 0 },
];

const morning = (week = null) => ({
  now: new Date(NOW).toISOString(),
  todos: { items: [{ text: 'Email the landlord about the heating' }, { text: 'Call the dentist' }], updated: new Date(NOW).toISOString() },
  calendar: { events: [
    { title: 'Coffee with a friend', start: at(SAT, '16:00'), end: at(SAT, '17:00'), allDay: false, location: '' },
    { title: 'Archery', start: at(SAT, '20:00'), end: at(SAT, '21:00'), allDay: false, location: '' },
  ], sent: new Date(NOW).toISOString(), stale: false },
  fixed: { events: [], countdowns: [] },
  weather: { sun: [{ date: SAT, sunrise: `${SAT}T00:00`, sunset: `${SAT}T23:59` }] },
  news: { items: [] },
  waiting: { open: 0, due: 0, dueWho: [], items: [] },
  ...(week ? { week } : {}),
});

/* The hub: energy, and the Restless list with its own state (pick by fit, first that fits). */
function world({ level = 'wired', items = seed(), week = null } = {}) {
  const w = { level, items, posts: [], gets: 0, hidden: new Set(), down: false, week };
  const h = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
  const energy = () => ({ level: w.level, setAt: w.level ? at(SAT, '12:00') : null, until: w.level ? at(SAT, '23:00') : null, source: w.level ? 'todo' : null, pick: null, play: null });
  w.energy = async (r) => {
    const q = r.request();
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
    if (q.method() === 'POST' && !q.url().endsWith('/pick')) { await new Promise((ok) => setTimeout(ok, 80)); w.level = q.postDataJSON().level; }
    return r.fulfill({ json: energy(), headers: h });
  };
  const counts = () => ({ total: w.items.length, done: w.items.reduce((n, it) => n + it.done, 0), skipped: w.items.reduce((n, it) => n + it.skipped, 0) });
  w.rest = async (r) => {
    const q = r.request();
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
    if (w.down) return r.fulfill({ status: 503, json: { error: 'not configured' }, headers: h });
    const sub = new URL(q.url()).pathname.split('/').slice(4); // after /api/restless/:code
    if (q.method() === 'GET') { w.gets++; return r.fulfill({ json: { items: structuredClone(w.items), kinds: ['move', 'build', 'outside', 'social', 'learn', 'home'], counts: counts() }, headers: h }); }
    const b = q.postDataJSON();
    w.posts.push({ path: sub.join('/'), body: b });
    await new Promise((ok) => setTimeout(ok, 120)); // network time, so a double tap lands while the first is out
    const find = (id) => w.items.find((it) => it.id === id);
    if (sub[0] === 'pick') {
      const skip = [...(b.skip || []), ...(b.another ? [b.another] : [])];
      if (b.another) find(b.another).skipped++;
      const pool = w.items.filter((it) => !w.hidden.has(it.id) && (b.mins === null || it.mins === null || it.mins <= b.mins) && !skip.includes(it.id));
      return r.fulfill({ json: { item: pool[0] ? structuredClone(pool[0]) : null, fit: pool.length, dark: false }, headers: h });
    }
    if (sub[0] === 'done') { find(b.id).done++; return r.fulfill({ json: { item: find(b.id) }, headers: h }); }
    if (sub[0] === 'notforme') { find(b.id).skipped++; w.hidden.add(b.id); return r.fulfill({ json: { item: find(b.id) }, headers: h }); }
    if (sub[0] === 'add') {
      if (!b.text) return r.fulfill({ status: 400, json: { error: 'What is it? Give it a few words.' }, headers: h });
      const it = { id: ('new' + String(w.items.length + 1).padStart(9, '0')).slice(0, 12), text: b.text, kind: b.kind ?? null, mins: b.mins ?? null, place: b.place ?? null, costs: b.costs ?? null, done: 0, skipped: 0 };
      w.items.push(it);
      return r.fulfill({ json: { item: it }, headers: h });
    }
    if (sub[0] === 'item' && sub.length === 3 && sub[2] === 'delete') { w.items = w.items.filter((it) => it.id !== sub[1]); return r.fulfill({ json: { ok: true }, headers: h }); }
    if (sub[0] === 'item') { Object.assign(find(sub[1]), b); return r.fulfill({ json: { item: find(sub[1]) }, headers: h }); }
    return r.fulfill({ status: 404, json: { error: 'not found' }, headers: h });
  };
  return w;
}

const browser = await chromium.launch();
const errors = [];
const logs = [];
async function open(w, viewport, { when = NOW, path = '', code = CODE, reduce = false } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: viewport.width < 700, reducedMotion: reduce ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => logs.push(m.text()));
  await page.clock.setFixedTime(new Date(when));
  await page.addInitScript((d) => { try { localStorage.setItem('morning.enteredOn', JSON.stringify(d)); } catch (e) { /* none */ } }, when.slice(0, 10));
  await page.route('**/api/**', (r) => r.fulfill({ status: 503, json: { error: 'mocked' }, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.route('**/api/morning/**', (r) => r.fulfill({ json: morning(w.week), headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.route('**/api/energy/**', w.energy);
  await page.route('**/api/restless/**', w.rest);
  await page.route('**/site.**espn.com/**', (r) => r.abort());
  await page.goto(BASE + path + (code ? '?c=' + code : ''));
  if (!path) await page.waitForFunction(() => /As of/.test(document.getElementById('asOf').textContent));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  return { ctx, page };
}

const CONTRAST = `(() => {
  const L = (c) => { const [r, g, b] = c.match(/\\d+(\\.\\d+)?/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const bg = (el) => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(c)) return c; } return 'rgb(255, 255, 255)'; };
  return (el) => { if (!el) return 0; const x = L(getComputedStyle(el).color), y = L(bg(el)); return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 10) / 10; };
})()`;

const st = (page) => page.evaluate((contrast) => {
  const ratio = eval(contrast);
  const vis = (el) => !!el && !el.closest('[hidden]') && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
  const t = (sel) => { const el = document.querySelector(sel); return vis(el) ? el.textContent.replace(/\s+/g, ' ').trim() : ''; };
  const box = document.getElementById('restless');
  return {
    shown: vis(box),
    free: t('#restFree'), msg: t('#restMsg'), fit: t('#restFit'),
    chips: [...document.querySelectorAll('#restChips .rest-chip')].filter(vis).map((b) => b.textContent.trim() + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')),
    go: vis(document.getElementById('restGoBtn')),
    name: t('#restStrip .rest-name'), meta: t('#restStrip .rest-meta'),
    acts: [...document.querySelectorAll('#restPicked button')].filter(vis).map((b) => b.textContent.trim()),
    empty: t('#restEmpty'), add: vis(document.getElementById('restAdd')), form: vis(document.getElementById('restForm')),
    err: t('#rfErr'),
    listHref: document.getElementById('restList').getAttribute('href'),
    waitHref: document.getElementById('waitRest').getAttribute('href'), waitShown: vis(document.getElementById('waitRest')),
    targets: [...box.querySelectorAll('button, a, input')].filter(vis).map((b) => Math.round(b.getBoundingClientRect().height)),
    focus: document.activeElement ? (document.activeElement.dataset.rest || document.activeElement.dataset.chip || document.activeElement.id || document.activeElement.tagName) : '',
    outline: document.activeElement ? getComputedStyle(document.activeElement).outlineStyle + ' ' + getComputedStyle(document.activeElement).outlineWidth : '',
    contrast: { free: ratio(document.getElementById('restFree')), fit: ratio(document.getElementById('restFit')), add: ratio(document.getElementById('restAdd')),
      meta: ratio(document.querySelector('#restStrip .rest-meta')), msg: ratio(document.getElementById('restMsg')), list: ratio(document.getElementById('restList')) },
    afterStart: (() => { const s = document.getElementById('start'); return !s.hidden && vis(box) ? box.getBoundingClientRect().top > s.getBoundingClientRect().bottom - 1 : null; })(),
    sameCol: box.parentElement === document.getElementById('start').parentElement,
    overflow: document.documentElement.scrollWidth > innerWidth,
  };
}, CONTRAST);
const tap = async (page, sel, settle = 400) => { await page.click(sel); await page.waitForTimeout(settle); };
const PC = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const last = (w) => w.posts[w.posts.length - 1];
const body = (w) => JSON.stringify(last(w).body);

// 1. Only while wired: Normal and no level hide the card; Wired on the dial shows it.
{
  const w = world({ level: 'normal' });
  const { ctx, page } = await open(w, PC);
  let s = await st(page);
  check(!s.shown && w.gets === 0, 'pc: Normal, no Restless card, the list is not read: ' + JSON.stringify({ shown: s.shown, gets: w.gets }));
  await tap(page, '#readouts [data-energy="normal"]'); // clears the level
  s = await st(page);
  check(!s.shown, 'pc: no level, no card');
  await tap(page, '#readouts [data-energy="wired"]');
  s = await st(page);
  check(s.shown && w.gets === 1 && s.sameCol && s.afterStart, 'pc: Wired shows the card under Start with in the left column, the list read once: ' + JSON.stringify({ gets: w.gets, after: s.afterStart }));
  check(s.free === 'You have 1 h 40 until Coffee with a friend' && s.chips.join() === '30 min,1 h,until 16:00*,All evening' && s.go && !s.name,
    'pc: the free time from the next event, its chip chosen, Go: ' + JSON.stringify({ free: s.free, chips: s.chips }));
  check(s.listHref === 'restless/?c=' + CODE && s.waitHref === 'restless/?c=' + CODE && s.waitShown, 'pc: The list › and Restless › (beside Network and Skills) open restless/ with the code');
  check(s.targets.every((x) => x >= 44) && s.contrast.free >= 4.5 && s.contrast.add >= 4.5 && s.contrast.list >= 4.5 && !s.overflow,
    'pc: 44 px, 4.5:1, nothing sideways: ' + JSON.stringify({ targets: s.targets, contrast: s.contrast }));

  // 2. Go: the pick with the gap in minutes and no skips; the strip, its meta and the three buttons.
  await tap(page, '#restGoBtn');
  s = await st(page);
  check(last(w).path === 'pick' && body(w) === JSON.stringify({ source: 'morning', mins: 100, skip: [] }), 'pc: Go sends pick with 100 min and no skips: ' + body(w));
  check(s.name === 'Run the park loop' && s.meta === 'Move · 1 h · outside · free' && s.acts.join() === 'Done,Not for me,Another' && !s.go && s.focus === 'done',
    'pc: the pick, big, with its meta and Done, Not for me, Another; the focus on Done: ' + JSON.stringify({ name: s.name, meta: s.meta, acts: s.acts, focus: s.focus }));
  check(s.fit === 'Picked from 3 that fit 1 h 40' && s.contrast.meta >= 4.5 && s.contrast.fit >= 4.5, 'pc: how many fitted: ' + JSON.stringify({ fit: s.fit, contrast: s.contrast }));
  await page.screenshot({ path: file('restless-pc') });
  await page.locator('#restless').screenshot({ path: file('restless-pc-picked') });

  // 3. Another twice: the round's ids and the one turned down; then nothing left.
  await tap(page, '#restPicked [data-rest="another"]');
  s = await st(page);
  check(body(w) === JSON.stringify({ source: 'morning', mins: 100, skip: ['park00000001'], another: 'park00000001' }) && s.name === 'Fix the bike light' && s.focus === 'another',
    'pc: Another sends the round and the one turned down: ' + body(w));
  await tap(page, '#restPicked [data-rest="another"]');
  s = await st(page);
  check(body(w) === JSON.stringify({ source: 'morning', mins: 100, skip: ['park00000001', 'light0000001'], another: 'light0000001' }) && s.name === 'Bike to the beach and back' && s.meta === '1 h · outside · free',
    'pc: Another again, the round grows; an item with no kind shows what is known: ' + JSON.stringify({ body: last(w).body, meta: s.meta }));
  await tap(page, '#restPicked [data-rest="another"]');
  s = await st(page);
  check(s.msg === 'That’s all that fits. Try more time.' && s.go && !s.name && s.focus === 'go' && s.chips.join() === '30 min,1 h,until 16:00*,All evening',
    'pc: nothing left: the line, back to Go with the chips: ' + JSON.stringify({ msg: s.msg, focus: s.focus }));
  // 4. The round starts over at Go.
  await tap(page, '#restGoBtn');
  s = await st(page);
  check(body(w) === JSON.stringify({ source: 'morning', mins: 100, skip: [] }) && s.name === 'Run the park loop' && !s.msg, 'pc: Go again starts a new round (no skips): ' + body(w));

  // 5. Not for me: its body, a short line, back to Go.
  await tap(page, '#restPicked [data-rest="notforme"]');
  s = await st(page);
  check(last(w).path === 'notforme' && body(w) === JSON.stringify({ source: 'morning', id: 'park00000001' }) && s.msg === 'Not for me today: Run the park loop.' && s.go && !s.name && s.focus === 'go',
    'pc: Not for me sends its id, says so, back to Go: ' + JSON.stringify({ body: last(w).body, msg: s.msg }));
  await page.locator('#restless').screenshot({ path: file('restless-pc-go') });
  // 6. A chip: 30 min; then Done.
  await tap(page, '#restChips [data-chip="30"]', 150);
  s = await st(page);
  check(s.chips.join() === '30 min*,1 h,until 16:00,All evening' && s.focus === '30', 'pc: 30 min chosen, the focus stays on it: ' + JSON.stringify({ chips: s.chips, focus: s.focus }));
  await tap(page, '#restGoBtn');
  s = await st(page);
  check(body(w) === JSON.stringify({ source: 'morning', mins: 30, skip: [] }) && s.name === 'Fix the bike light' && s.fit === 'The only one that fits 30 min', 'pc: Go with 30 min: ' + JSON.stringify({ body: last(w).body, fit: s.fit }));
  // A double tap on Done sends once.
  await page.evaluate(() => { const b = document.querySelector('#restPicked [data-rest="done"]'); b.click(); b.click(); });
  await page.waitForTimeout(400);
  s = await st(page);
  check(w.posts.filter((p) => p.path === 'done').length === 1 && body(w) === JSON.stringify({ source: 'morning', id: 'light0000001' }) && s.msg === 'Done: Fix the bike light.' && s.go,
    'pc: Done (a double tap sends once), a short line, back to Go: ' + JSON.stringify({ body: last(w).body, msg: s.msg }));
  // All evening: no minutes.
  await tap(page, '#restChips [data-chip="all"]', 150);
  await tap(page, '#restGoBtn');
  check(body(w) === JSON.stringify({ source: 'morning', mins: null, skip: [] }), 'pc: All evening sends mins null: ' + body(w));
  // Keyboard: Tab from a chip shows the focus ring.
  await page.focus('#restChips [data-chip="30"]');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  s = await st(page);
  check(s.outline === 'solid 2px', 'pc: a chip reached by keyboard shows the focus ring: ' + s.outline);

  // 7. The level goes back to Normal: the card goes.
  await tap(page, '#readouts [data-energy="normal"]');
  s = await st(page);
  check(!s.shown, 'pc: Normal again, the card goes');
  await ctx.close();
}

// 8. Nothing else on today: All evening by default, no "until" chip.
{
  const w = world();
  const { ctx, page } = await open(w, PC, { when: LATE });
  const s = await st(page);
  check(s.shown && s.free === 'Nothing else on today' && s.chips.join() === '30 min,1 h,All evening*', 'late: nothing else on today, All evening chosen: ' + JSON.stringify({ free: s.free, chips: s.chips }));
  await tap(page, '#restGoBtn');
  check(body(w) === JSON.stringify({ source: 'morning', mins: null, skip: [] }), 'late: Go sends mins null');
  await ctx.close();
}

// 9. An empty list: says so with Add one; then Add one (only What, a chip tapped twice left open, a refusal, a full body).
{
  const w = world({ items: [] });
  const { ctx, page } = await open(w, PC);
  let s = await st(page);
  check(s.shown && s.empty === 'Nothing on the list yet.' && s.add && !s.go, 'empty: "Nothing on the list yet." and Add one, no Go: ' + JSON.stringify({ empty: s.empty, go: s.go }));
  await page.locator('#restless').screenshot({ path: file('restless-pc-empty') });
  await tap(page, '#restAdd', 100);
  s = await st(page);
  check(s.form && s.focus === 'rfText' && !s.empty, 'add: the form opens, the focus on What');
  await tap(page, '#rfSend', 100);
  s = await st(page);
  check(s.err === 'What is it? A few words are enough.' && !w.posts.length, 'add: What is needed, nothing sent: ' + s.err);
  await page.fill('#rfText', 'Climb at the bouldering hall');
  await tap(page, '#restForm [data-rf="kind"] [data-v="move"]', 50);
  await tap(page, '#restForm [data-rf="mins"] [data-v="60"]', 50);
  await tap(page, '#restForm [data-rf="mins"] [data-v="120"]', 50);
  await tap(page, '#restForm [data-rf="place"] [data-v="inside"]', 50);
  await tap(page, '#restForm [data-rf="costs"] [data-v="true"]', 50);
  await tap(page, '#restForm [data-rf="costs"] [data-v="false"]', 50);
  await tap(page, '#restForm [data-rf="costs"] [data-v="false"]', 50); // tapped twice: left open
  await page.locator('#restless').screenshot({ path: file('restless-pc-add') });
  await tap(page, '#rfSend');
  s = await st(page);
  check(last(w).path === 'add' && body(w) === JSON.stringify({ source: 'morning', text: 'Climb at the bouldering hall', kind: 'move', mins: 120, place: 'inside' }),
    'add: the body has what was chosen, and no costs (tapped twice): ' + body(w));
  check(!s.form && s.msg === 'Added: Climb at the bouldering hall.' && s.go && !s.empty && s.focus === 'restAdd', 'add: the form closes, a line, Go instead of the empty line, the focus on Add one: ' + JSON.stringify({ msg: s.msg, focus: s.focus }));
  // Only What.
  await tap(page, '#restAdd', 100);
  await page.fill('#rfText', '  Call   Sam ');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  check(body(w) === JSON.stringify({ source: 'morning', text: 'Call Sam' }), 'add: only What, tidied: ' + body(w));
  // Escape closes and clears the draft.
  await tap(page, '#restAdd', 100);
  await page.fill('#rfText', 'A draft');
  await page.keyboard.press('Escape');
  s = await st(page);
  const draft = await page.inputValue('#rfText');
  check(!s.form && draft === '' && s.focus === 'restAdd', 'add: Escape closes the form, the draft cleared, the focus back on Add one');
  await ctx.close();
}

// 10. The phone: the card in the flow under Start with; the pick; the form; nothing sideways; 44 px.
{
  const w = world();
  const { ctx, page } = await open(w, PHONE, { reduce: true });
  let s = await st(page);
  check(s.shown && s.afterStart && s.chips.join() === '30 min,1 h,until 16:00*,All evening' && s.targets.every((x) => x >= 44) && !s.overflow,
    'phone: under Start with, the chips, 44 px, nothing sideways: ' + JSON.stringify({ after: s.afterStart, targets: s.targets }));
  await page.evaluate(() => document.getElementById('restless').scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: file('restless-phone-go') });
  await tap(page, '#restGoBtn');
  s = await st(page);
  check(s.name === 'Run the park loop' && s.acts.join() === 'Done,Not for me,Another' && !s.overflow && s.targets.every((x) => x >= 44), 'phone: the pick and its three buttons: ' + JSON.stringify(s.targets));
  const row = await page.evaluate(() => [...document.querySelectorAll('#restPicked button')].map((b) => Math.round(b.getBoundingClientRect().top)));
  check(row.every((y) => y === row[0]), 'phone: Done, Not for me and Another on one line: ' + row);
  await page.evaluate(() => document.getElementById('restless').scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: file('restless-phone') });
  await tap(page, '#restAdd', 100);
  s = await st(page);
  check(s.form && !s.overflow && s.targets.every((x) => x >= 44), 'phone: the form, 44 px, nothing sideways: ' + JSON.stringify(s.targets));
  await page.locator('#restless').screenshot({ path: file('restless-phone-add') });
  await ctx.close();
}

// 11. The list page: by kind, To sort first; drift words; Edit with every field; Delete asked twice; Add one.
const ls = (page) => page.evaluate((contrast) => {
  const ratio = eval(contrast);
  const vis = (el) => !!el && !el.closest('[hidden]') && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
  return {
    title: document.title, sub: document.getElementById('sub').textContent, back: document.getElementById('back').getAttribute('href'),
    status: document.getElementById('status').textContent, app: vis(document.getElementById('app')), nocode: vis(document.getElementById('nocode')),
    groups: [...document.querySelectorAll('.group-h')].map((h) => h.firstChild.textContent.trim()),
    rows: [...document.querySelectorAll('.rr:not(.rr-edit)')].map((r) => [r.querySelector('.rr-text').textContent, r.querySelector('.rr-drift').textContent, r.querySelector('.rr-meta').textContent].join(' | ')),
    form: (() => { const f = document.querySelector('.rr-edit .rf'); if (!f) return null; return { text: f.querySelector('[name="text"]').value, on: [...f.querySelectorAll('[aria-pressed="true"]')].map((b) => b.textContent) }; })(),
    note: (document.querySelector('.note') || { textContent: '' }).textContent.trim(),
    cols: (() => { const g = [...document.querySelectorAll('.group')].map((e) => Math.round(e.getBoundingClientRect().left)); return new Set(g).size; })(),
    targets: [...document.querySelectorAll('a, button, input')].filter(vis).map((b) => Math.round(b.getBoundingClientRect().height)),
    contrast: { drift: ratio(document.querySelector('.rr-drift')), meta: ratio(document.querySelector('.rr-meta')), edit: ratio(document.querySelector('.rr-edit-btn')), sub: ratio(document.getElementById('sub')), back: ratio(document.getElementById('back')) },
    focus: document.activeElement ? (document.activeElement.dataset.act || document.activeElement.id || document.activeElement.name || document.activeElement.tagName) : '',
    focusRow: document.activeElement && document.activeElement.closest('.rr') ? document.activeElement.closest('.rr').dataset.id : '',
    overflow: document.documentElement.scrollWidth > innerWidth,
  };
}, CONTRAST);
const ROWS = [
  'Bike to the beach and back | new | 1 h · outside · free · no kind yet',
  'Run the park loop | done 4 | 1 h · outside · free',
  'Climb at the bouldering hall | skipped 2 | 2 h+ · inside · costs money',
  'Fix the bike light | done 2 | 30 min · inside · free',
  'Kayak on the Vliet | new | 2 h+ · outside · costs money',
];
for (const [name, viewport] of [['restless-list-pc', PC], ['restless-list-phone', PHONE]]) {
  const pc = viewport.width >= 1100;
  const w = world();
  const { ctx, page } = await open(w, viewport, { path: 'restless/' });
  let s = await ls(page);
  check(s.title === 'Restless list' && s.back === '../?c=' + CODE && s.sub === '5 things · done 6 times, skipped 2', name + ': the title, the way back with the code, the counts: ' + s.sub);
  check(s.groups.join() === 'To sort,Move,Build,Outside' && JSON.stringify(s.rows) === JSON.stringify(ROWS), name + ': by kind, To sort first, drift words and what is known: ' + JSON.stringify(s.rows));
  check(s.cols === (pc ? 2 : 1) && !s.overflow && s.targets.every((x) => x >= 44), name + ': ' + (pc ? 'two columns' : 'one column') + ', 44 px, nothing sideways: ' + JSON.stringify({ cols: s.cols, targets: s.targets }));
  check(Object.values(s.contrast).every((x) => x >= 4.5), name + ': 4.5:1 or more: ' + JSON.stringify(s.contrast));
  await page.screenshot({ path: file(name), fullPage: true });
  if (pc) {
    // Edit: the fields filled in; 1 h instead of 2 h+, Costs money taken off; Save sends every field.
    await tap(page, '.rr[data-id="climb0000001"] [data-act="edit"]', 150);
    s = await ls(page);
    check(s.form && s.form.text === 'Climb at the bouldering hall' && s.form.on.join() === 'Move,2 h+,Inside,Costs money' && s.focus === 'text', 'list: Edit fills the fields in, the focus on What: ' + JSON.stringify(s.form));
    await page.screenshot({ path: file('restless-list-pc-edit'), fullPage: true });
    await tap(page, '.rr-edit [data-rf="mins"] [data-v="60"]', 50);
    await tap(page, '.rr-edit [data-rf="costs"] [data-v="true"]', 50);
    await tap(page, '.rr-edit .btn-go');
    s = await ls(page);
    check(last(w).path === 'item/climb0000001' && body(w) === JSON.stringify({ text: 'Climb at the bouldering hall', kind: 'move', mins: 60, place: 'inside', costs: null }),
      'list: Save sends every field, a cleared one as null: ' + body(w));
    check(s.rows[2] === 'Climb at the bouldering hall | skipped 2 | 1 h · inside' && s.status === 'Saved.' && s.focusRow === 'climb0000001', 'list: the row shows the change, Saved., the focus back on its Edit: ' + JSON.stringify({ row: s.rows[2], status: s.status }));
    // Delete: asked once more, then gone; the focus on the next row.
    await tap(page, '.rr[data-id="kayak0000001"] [data-act="edit"]', 150);
    await tap(page, '.rr-edit [data-act="delete"]', 100);
    const asked = await page.textContent('.rr-edit [data-act="delete"]');
    check(asked === 'Delete for good?' && !w.posts.some((p) => /delete$/.test(p.path)), 'list: Delete asks once more, nothing sent yet');
    await tap(page, '.rr-edit [data-act="delete"]');
    s = await ls(page);
    check(last(w).path === 'item/kayak0000001/delete' && !s.rows.some((r) => /Vliet/.test(r)) && s.groups.join() === 'To sort,Move,Build' && s.status === 'Deleted.',
      'list: the second tap deletes it; Outside goes with its last row: ' + JSON.stringify({ path: last(w).path, groups: s.groups }));
    // Cancel an edit: nothing sent.
    const n = w.posts.length;
    await tap(page, '.rr[data-id="park00000001"] [data-act="edit"]', 150);
    await page.keyboard.press('Escape');
    s = await ls(page);
    check(w.posts.length === n && !s.form && s.focusRow === 'park00000001', 'list: Escape leaves an edit, nothing sent, the focus back on Edit');
    // Add one on the page.
    await tap(page, '#addBtn', 100);
    await page.fill('.add-box [name="text"]', 'Call Sam');
    await tap(page, '.add-box [data-rf="kind"] [data-v="social"]', 50);
    await tap(page, '.add-box .btn-go');
    s = await ls(page);
    check(last(w).path === 'add' && body(w) === JSON.stringify({ text: 'Call Sam', source: 'morning', kind: 'social' }) && s.groups.join() === 'To sort,Move,Build,Social' && s.status === 'Added: Call Sam.',
      'list: Add one sends source morning, the new row under its kind: ' + JSON.stringify({ body: last(w).body, groups: s.groups }));
  } else {
    await tap(page, '.rr[data-id="beach0000001"] [data-act="edit"]', 150);
    s = await ls(page);
    check(s.form && !s.overflow && s.targets.every((x) => x >= 44), 'list phone: Edit in the row, 44 px, nothing sideways: ' + JSON.stringify(s.targets));
    await page.screenshot({ path: file('restless-list-phone-edit'), fullPage: true });
  }
  await ctx.close();
}
{
  const w = world({ items: [] });
  const { ctx, page } = await open(w, PHONE, { path: 'restless/' });
  const s = await ls(page);
  check(s.note === 'Nothing on the list yet. Add one: a few words are enough.' && !s.groups.length, 'list: empty says so: ' + s.note);
  await ctx.close();
}
{
  const w = world();
  w.down = true;
  const { ctx, page } = await open(w, PC, { path: 'restless/' });
  let s = await ls(page);
  check(s.note === 'Can’t reach the hub. Retry', 'list: the hub away, with Retry: ' + s.note);
  w.down = false;
  await tap(page, '#retry');
  s = await ls(page);
  check(s.rows.length === 5, 'list: Retry reads again');
  await ctx.close();
}
{
  const w = world();
  const { ctx, page } = await open(w, PHONE, { path: 'restless/', code: '' });
  const s = await ls(page);
  check(!s.app && s.nocode, 'list: no code, the page says to open Morning from the private link');
  await ctx.close();
}

// 12. Sunday: Spare energy this week.
const WEEK = (restless) => ({ week: 43, from: '2026-10-19', to: '2026-10-25', done: { count: 0, groups: [] }, quiet: [], vacancies: [], thisWeek: [], restless });
const REST_WEEK = {
  wired: 5, skipped: 3,
  done: [
    { item: 'park00000001', text: 'Run the park loop', kind: 'move', at: at('2026-10-20', '19:10') },
    { item: 'light0000001', text: 'Fix the bike light', kind: 'build', at: at('2026-10-22', '15:00') },
    { item: 'park00000001', text: 'Run the park loop', kind: 'move', at: at('2026-10-23', '18:40') },
    { item: 'walk00000001', text: 'Walk to the harbour for a coffee', kind: 'outside', at: at('2026-10-24', '14:30') },
  ],
  byKind: { move: 2, build: 1, outside: 1, social: 0, learn: 0, home: 0 },
};
const wk = (page) => page.evaluate((contrast) => {
  const ratio = eval(contrast);
  const c = document.getElementById('wkRestCard');
  const vis = (el) => !!el && !el.closest('[hidden]') && getComputedStyle(el).display !== 'none';
  return {
    week: vis(document.getElementById('weekView')), shown: vis(c),
    head: c.querySelector('.num').textContent, line: document.getElementById('wkRestLine').textContent,
    rows: [...c.querySelectorAll('.rw')].map((r) => r.querySelector('.rw-name').textContent + ' | ' + r.querySelector('.rw-when').textContent),
    bars: [...c.querySelectorAll('.rk')].map((r) => r.querySelector('.rk-k').textContent + ' ' + r.querySelector('.rk-n').textContent + ' ' + Math.round(parseFloat(r.querySelector('.rk-bar i').style.width))),
    order: [...document.querySelectorAll('#weekView .card:not([hidden]) .num')].map((e) => e.textContent.trim()).slice(0, 3),
    contrast: { line: ratio(document.getElementById('wkRestLine')), when: ratio(c.querySelector('.rw-when')) },
    overflow: document.documentElement.scrollWidth > innerWidth,
  };
}, CONTRAST);
for (const [name, viewport] of [['restless-week-pc', PC], ['restless-week-phone', PHONE]]) {
  const w = world({ level: null, week: WEEK(REST_WEEK) });
  const { ctx, page } = await open(w, viewport, { when: SUNDAY });
  const s = await wk(page);
  check(s.week && s.shown && s.head === 'Spare energy this week' && s.line === 'Wired 5 times. You did 4 things with it and passed on 3.', name + ': the card and its line: ' + JSON.stringify({ week: s.week, line: s.line }));
  check(s.rows.join(' / ') === 'Run the park loop | Move · Tue evening / Fix the bike light | Build · Thu afternoon / Run the park loop | Move · Fri evening / Walk to the harbour for a coffee | Outside · Sat afternoon',
    name + ': what was done, its kind and when: ' + JSON.stringify(s.rows));
  check(s.bars.join() === 'Move 2 100,Build 1 50,Outside 1 50,Social 0 0,Learn 0 0,Home 0 0' && s.contrast.line >= 4.5 && s.contrast.when >= 4.5 && !s.overflow,
    name + ': a bar per kind, 4.5:1, nothing sideways: ' + JSON.stringify({ bars: s.bars, contrast: s.contrast }));
  await page.locator('#wkRestCard').screenshot({ path: file(name) });
  await ctx.close();
}
for (const [what, r] of [['never wired, nothing done', { wired: 0, skipped: 2, done: [], byKind: {} }], ['no block', null]]) {
  const w = world({ level: null, week: WEEK(r) });
  const { ctx, page } = await open(w, PC, { when: SUNDAY });
  const s = await wk(page);
  check(s.week && !s.shown, 'week: ' + what + ', no card');
  await ctx.close();
}
{
  const w = world({ level: null, week: WEEK({ wired: 1, skipped: 0, done: [], byKind: {} }) });
  const { ctx, page } = await open(w, PC, { when: SUNDAY });
  const s = await wk(page);
  check(s.shown && s.line === 'Wired once. You did 0 things with it and passed on none.' && s.rows.length === 0, 'week: wired once, nothing done: ' + s.line);
  await ctx.close();
}

check(!logs.some((l) => NAMES.test(l)), 'no item names in the console: ' + logs.length + ' lines');
check(errors.length === 0, 'no page errors: ' + errors.join('; '));
await browser.close();
console.log(`${passes} of ${passes + fails} restless checks pass`);
if (failed) process.exit(1);
console.log('all restless checks pass');
