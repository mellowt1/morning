// The Energy soundtrack in Morning (paul-hub src/soundtrack.js, mocked like the real routes): Play under
// the dial in the PC header (and in Start with on the phone), a real spotify: link that also sends
// played (from "dial") without ever blocking the link; the row follows each new energy answer (the dial,
// a level set elsewhere, the minute poll) and goes when the level has no playlist or none is set; while
// a timer runs, "Music for this?" at the foot of Start with, Play from it (from "offer" with startedAt)
// and Not now (notnow with startedAt, hidden at once, before the hub answers); the offer follows a level
// change and goes with no playlist; keyboard focus, 44 px, contrast, nothing moving, no names in the
// console. Every Play tap also asks the hub to really start the playlist (POST /api/spotify/:code/play,
// paul-hub src/spotify.js) once, with the uri and the kind of device: "computer" on the PC, "phone" on an
// iPhone and on an iPad that calls itself a Mac; Not now never does. Every value here is made up.
//   PORT=8095 npm run serve, then: APP=http://localhost:8095/morning/ npm run soundtrack-check
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CODE = 'abcdefgh23456789'; // made up; the hub is mocked
const BASE = process.env.APP || 'http://localhost:8080/morning/';
const OUT = new URL('../verify-shots/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const file = (n) => fileURLToPath(new URL(n + '.png', OUT));

const NOW = '2026-10-23T13:00:00+02:00'; // a Friday at 13:00 in The Hague: the Today view, the sun up
const iso = (hhmm) => new Date(`2026-10-23T${hhmm}:00+02:00`).toISOString();
const pid = (s) => s.padEnd(22, '0');
const LISTS = {
  drained: { title: 'Low tide', pid: pid('LowTide') },
  wired: { title: 'Morning run, loud and fast, for the days that need a push', pid: pid('MorningRun') },
  normal: null, // no playlist for Normal
};
const URI = (lv) => 'spotify:playlist:' + LISTS[lv].pid;
const NAMES = /Low tide|Morning run|Return the lamp|Text a friend/;

let failed = false;
let passes = 0, fails = 0;
const check = (ok, what) => { if (!ok) { fails++; failed = true; console.error('FAIL:', what); } else { passes++; console.log('ok:', what); } };

const morning = () => ({
  now: new Date(NOW).toISOString(),
  todos: { items: [{ text: 'Email the landlord about the heating' }, { text: 'Call the dentist' }, { text: 'Book the train' }], updated: new Date(NOW).toISOString() },
  calendar: { events: [
    { title: 'Coffee with a friend', start: iso('16:00'), end: iso('17:00'), allDay: false, location: '' },
    { title: 'Archery', start: iso('20:00'), end: iso('21:30'), allDay: false, location: '' },
  ], sent: new Date(NOW).toISOString(), stale: false },
  fixed: { events: [], countdowns: [] },
  weather: { sun: [{ date: '2026-10-23', sunrise: '2026-10-23T00:00', sunset: '2026-10-23T23:59' }] },
  news: { items: [] },
});

const tasks = [
  { id: 'task00000001', name: 'Return the lamp', section: 'today', due: null, time: null },
  { id: 'task00000002', name: 'Text a friend', section: 'soon', due: null, time: null },
];

/* The hub: energy (with play), the Dread meter (with offer) and the soundtrack's played and notnow.
 * The offer stands while a timer runs, its level has a playlist, and neither Play nor Not now was
 * tapped for that timer (the hub's rule, made small). */
function world({ level = null, running = null } = {}) {
  const w = { level, running, posts: [], spotify: [], energyPosts: [], dreadPosts: [], gone: new Set(), gets: { energy: 0, dread: 0 }, hold: 0, spotifyAnswer: null };
  const h = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
  const play = () => (w.level && LISTS[w.level] ? { level: w.level, title: LISTS[w.level].title, url: 'https://open.spotify.com/playlist/' + LISTS[w.level].pid, uri: URI(w.level) } : null);
  const offer = () => { const p = play(); return w.running && p && !w.gone.has(w.running.startedAt) ? { ...p, startedAt: w.running.startedAt } : null; };
  const energy = () => {
    const on = !!w.level;
    return { level: w.level, setAt: on ? iso('12:00') : null, until: on ? iso('16:00') : null, source: on ? 'todo' : null,
      pick: on ? { task: tasks[0], count: 2, left: 2, position: 1 } : null, play: play() };
  };
  w.energy = async (r) => {
    const q = r.request();
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
    if (q.method() === 'GET') { w.gets.energy++; return r.fulfill({ json: energy(), headers: h }); }
    const b = q.postDataJSON();
    w.energyPosts.push({ path: new URL(q.url()).pathname.split('/').pop(), body: b });
    await new Promise((ok) => setTimeout(ok, 120));
    if (!q.url().endsWith('/pick')) w.level = b.level;
    return r.fulfill({ json: energy(), headers: h });
  };
  w.dread = async (r) => {
    const q = r.request();
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
    if (q.method() === 'GET') { w.gets.dread++; return r.fulfill({ json: { running: w.running, stopped: null, offer: offer() }, headers: h }); }
    const path = new URL(q.url()).pathname.split('/').pop();
    const b = q.postDataJSON();
    w.dreadPosts.push({ path, body: b });
    await new Promise((ok) => setTimeout(ok, 120));
    if (path === 'start') {
      const t = tasks.find((x) => x.id === b.task);
      w.running = { task: t.id, name: t.name, section: t.section, startedAt: w.nextStart || iso('13:00'), dread: null, level: w.level, source: 'morning', mins: 0 };
      return r.fulfill({ json: { running: w.running, offer: offer() }, headers: h });
    }
    if (path === 'rate') { w.running = { ...w.running, dread: b.dread }; return r.fulfill({ json: { running: w.running, offer: offer() }, headers: h }); }
    w.running = null;
    return r.fulfill({ json: { running: null, stopped: null, offer: null }, headers: h });
  };
  w.sound = async (r) => {
    const q = r.request();
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
    const path = new URL(q.url()).pathname.split('/').pop();
    const b = q.postDataJSON();
    w.posts.push({ path, body: b, type: q.headers()['content-type'] || '' });
    if (path === 'notnow' && b.startedAt) w.gone.add(b.startedAt);
    if (path === 'played' && w.running) w.gone.add(w.running.startedAt); // the music is on
    if (w.hold) await new Promise((ok) => setTimeout(ok, w.hold)); // a slow hub: the page must not wait for it
    return r.fulfill({ json: { ok: true }, headers: h });
  };
  // POST /api/spotify/:code/play (paul-hub src/spotify.js): the hub starts the playlist on that kind of device.
  w.spot = async (r) => {
    const q = r.request();
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
    w.spotify.push({ path: new URL(q.url()).pathname, body: q.postDataJSON(), type: q.headers()['content-type'] || '' });
    if (w.hold) await new Promise((ok) => setTimeout(ok, w.hold));
    const a = w.spotifyAnswer || { status: 200, json: { ok: true, device: 'Made-up device' } };
    return r.fulfill({ status: a.status, json: a.json, headers: h });
  };
  return w;
}
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15';
const PLAY_PATH = '/api/spotify/' + CODE + '/play';
// Exactly one play POST since `from`, for this uri and kind, as plain text.
const onePlay = (w, from, uri, kind) => w.spotify.length === from + 1 && w.spotify[from].path === PLAY_PATH &&
  JSON.stringify(w.spotify[from].body) === JSON.stringify({ uri, kind }) && /^text\/plain/.test(w.spotify[from].type);

const browser = await chromium.launch();
const errors = [];
const logs = [];
async function open(w, viewport, { clock = 'fixed', reduce = false, ua = null, touchPoints = null } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: viewport.width < 700, reducedMotion: reduce ? 'reduce' : 'no-preference', ...(ua ? { userAgent: ua } : {}) });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => logs.push(m.text()));
  if (clock === 'fixed') await page.clock.setFixedTime(new Date(NOW));
  else await page.clock.install({ time: new Date(NOW) });
  // An iPad on iPadOS says Macintosh; only its touch points give it away.
  if (touchPoints !== null) await page.addInitScript((n) => Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { get: () => n, configurable: true }), touchPoints);
  await page.addInitScript(() => {
    try { localStorage.setItem('morning.enteredOn', JSON.stringify('2026-10-23')); } catch (e) { /* none */ }
    // What the page asks fetch for on the soundtrack routes (keepalive), and whether a Play link's click
    // was blocked: the page's own listener is on document, so this one on window runs after it. Then
    // the test stops the spotify: navigation itself, which a headless browser has no app for.
    window.__sound = [];
    window.__clicks = [];
    const f = window.fetch;
    window.fetch = (u, init) => { if (/\/api\/(soundtrack|spotify)\//.test(String(u))) window.__sound.push({ path: String(u).split('/').pop(), keepalive: !!(init && init.keepalive) }); return f(u, init); };
    window.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href^="spotify:"]');
      if (!a) return;
      window.__clicks.push({ href: a.getAttribute('href'), blocked: e.defaultPrevented });
      e.preventDefault();
    });
  });
  await page.route('**/api/**', (r) => r.fulfill({ status: 503, json: { error: 'mocked' }, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.route('**/api/morning/**', (r) => r.fulfill({ json: morning(), headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.route('**/api/energy/**', w.energy);
  await page.route('**/api/dread/**', w.dread);
  await page.route('**/api/soundtrack/**', w.sound);
  await page.route('**/api/spotify/**', w.spot);
  await page.route('**/site.**espn.com/**', (r) => r.abort());
  await page.goto(BASE + '?c=' + CODE);
  if (clock !== 'fixed') await page.clock.runFor(1000);
  await page.waitForFunction(() => /As of/.test(document.getElementById('asOf').textContent));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  return { ctx, page };
}

const st = (page) => page.evaluate(() => {
  const vis = (el) => !!el && !el.closest('[hidden]') && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
  const L = (c) => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const x = L(a), y = L(b); return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 10) / 10; };
  const bg = (el) => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; } return 'rgb(255, 255, 255)'; };
  const on = (el) => (el ? ratio(getComputedStyle(el).color, bg(el)) : 0);
  const row = (sel) => {
    const a = document.querySelector(sel);
    if (!vis(a)) return null;
    const box = a.closest('.ro-energy, .start-dial').getBoundingClientRect(), r = a.getBoundingClientRect();
    return {
      href: a.getAttribute('href'), tag: a.tagName, label: a.getAttribute('aria-label'), level: a.dataset.level,
      title: a.querySelector('.play-title').textContent, sub: a.querySelector('.play-sub').textContent,
      h: Math.round(r.height), inside: r.left >= box.left - 0.5 && r.right <= box.right + 0.5,
      cut: a.querySelector('.play-title').scrollWidth > a.querySelector('.play-title').clientWidth,
      disc: getComputedStyle(a.querySelector('.play-disc')).backgroundColor, tri: getComputedStyle(a.querySelector('.play-disc')).color,
      under: r.top >= a.parentElement.querySelector('.dial').getBoundingClientRect().bottom,
      cTitle: on(a.querySelector('.play-title')), cSub: on(a.querySelector('.play-sub')),
      moves: getComputedStyle(a).transitionDuration + '/' + getComputedStyle(a.querySelector('.play-disc')).transitionDuration,
    };
  };
  const m = document.getElementById('startMusic');
  const go = m.querySelector('a.music-go'), not = m.querySelector('[data-music="notnow"]');
  return {
    pc: row('#readouts a.play'), phone: row('#startDial a.play'),
    plays: document.querySelectorAll('a.play').length,
    dial: [...document.querySelectorAll('#readouts .dial-btn, #startDial .dial-btn')].filter(vis).map((b) => b.textContent.trim() + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')),
    running: document.getElementById('start').classList.contains('is-running'),
    offer: vis(m) && go ? {
      text: [...go.querySelector('.music-text').childNodes].filter((n) => !(n.classList && n.classList.contains('sr'))).map((n) => n.textContent).join('').replace(/\s+/g, ' ').trim(),
      name: go.textContent.replace(/\s+/g, ' ').trim(), href: go.getAttribute('href'), started: go.dataset.started,
      not: not ? not.textContent.trim() : '', h: [go, not].map((e) => Math.round(e.getBoundingClientRect().height)),
      last: m === m.parentElement.lastElementChild, belowStop: m.getBoundingClientRect().top >= document.querySelector('#startDread [data-dread="stop"]').getBoundingClientRect().bottom,
      notRight: Math.round(m.getBoundingClientRect().right - not.getBoundingClientRect().right),
      cText: on(go.querySelector('.music-text')), cNot: on(not), disc: getComputedStyle(go.querySelector('.play-disc')).backgroundColor,
    } : null,
    focus: document.activeElement ? (document.activeElement.dataset.energy || document.activeElement.dataset.play || document.activeElement.dataset.dread || document.activeElement.tagName) : '',
    outline: document.activeElement ? getComputedStyle(document.activeElement).outlineStyle + ' ' + getComputedStyle(document.activeElement).outlineWidth : '',
    headH: Math.round(document.querySelector('.head').getBoundingClientRect().height),
    roTop: [...document.querySelectorAll('#readouts .ro')].map((e) => Math.round(e.getBoundingClientRect().top)),
    overflow: document.documentElement.scrollWidth > innerWidth,
  };
});
const page$ = (page, k) => page.evaluate((key) => window[key], k);
const tap = async (page, sel, settle = 400) => { await page.click(sel); await page.waitForTimeout(settle); };
const PC = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

// 1. The PC with no level: the dial, and no Play row.
{
  const w = world();
  const { ctx, page } = await open(w, PC);
  let s = await st(page);
  check(s.dial.join() === 'Wired,Normal,Drained' && !s.pc && s.plays === 0, 'pc: no level, no Play row: ' + JSON.stringify({ dial: s.dial, plays: s.plays }));

  // 2. Normal has no playlist: still no row.
  await tap(page, '#readouts [data-energy="normal"]');
  s = await st(page);
  check(s.dial.join() === 'Wired,Normal*,Drained' && !s.pc && s.plays === 0, 'pc: a level with no playlist (play null), no Play row: ' + JSON.stringify({ dial: s.dial, plays: s.plays }));

  // 3. Drained has Low tide: the row under the dial, a real spotify: link with the name and "Spotify app".
  await tap(page, '#readouts [data-energy="drained"]');
  s = await st(page);
  check(!!s.pc && s.pc.tag === 'A' && s.pc.href === URI('drained') && s.pc.title === 'Low tide' && s.pc.sub === 'Spotify app' && s.pc.label === 'Play Low tide in the Spotify app',
    'pc: play set, the row links to spotify:playlist:…, with the name and Spotify app: ' + JSON.stringify(s.pc));
  check(s.pc && s.pc.under && s.pc.inside && s.pc.h >= 44 && s.pc.disc === 'rgb(36, 127, 81)' && s.pc.tri === 'rgb(255, 255, 255)', 'pc: under the dial, inside the read-out, 44 px, the green disc with a white triangle: ' + JSON.stringify(s.pc));
  check(s.pc && s.pc.cTitle >= 4.5 && s.pc.cSub >= 4.5, 'pc: the name and Spotify app read at 4.5:1 or more: ' + JSON.stringify({ title: s.pc && s.pc.cTitle, sub: s.pc && s.pc.cSub }));
  check(s.roTop.length === 4 && s.roTop.every((y) => y === s.roTop[0]) && !s.overflow, 'pc: the four read-outs stay on one line, nothing sideways: ' + JSON.stringify({ tops: s.roTop, head: s.headH }));
  await page.screenshot({ path: file('soundtrack-pc-head'), clip: { x: 0, y: 0, width: 1440, height: Math.min(900, s.headH + 60) } });

  // 4. Click Play: the link is not blocked, and played goes once with from "dial", keepalive, no startedAt.
  w.hold = 1500; // a slow hub: nothing waits for it
  await page.click('#readouts a.play');
  await page.waitForTimeout(250);
  let clicks = await page$(page, '__clicks');
  let sound = await page$(page, '__sound');
  check(clicks.length === 1 && clicks[0].href === URI('drained') && clicks[0].blocked === false, 'pc: Play is a real link the page never blocks: ' + JSON.stringify(clicks));
  check(w.posts.length === 1 && w.posts[0].path === 'played' && JSON.stringify(w.posts[0].body) === JSON.stringify({ source: 'morning', level: 'drained', from: 'dial' }),
    'pc: Play sends played with from dial and no startedAt: ' + JSON.stringify(w.posts));
  check(sound.length === 2 && sound.every((x) => x.keepalive) && sound.map((x) => x.path).sort().join() === 'play,played' && /^text\/plain/.test(w.posts[0].type),
    'pc: played and the hub\'s play go with keepalive, as plain text (no preflight): ' + JSON.stringify({ sound, type: w.posts[0] && w.posts[0].type }));
  check(onePlay(w, 0, URI('drained'), 'computer') && (await page.getAttribute('#readouts a.play', 'href')) === URI('drained'),
    'pc: the same tap asks the hub once to start Low tide on the computer; the link is unchanged: ' + JSON.stringify(w.spotify));
  w.hold = 0;

  // 5. The level changes on the dial: the row follows the new answer (a long name stays in its read-out).
  await tap(page, '#readouts [data-energy="wired"]');
  s = await st(page);
  check(s.dial.join() === 'Wired*,Normal,Drained' && s.pc && s.pc.href === URI('wired') && s.pc.title === LISTS.wired.title && s.pc.label === 'Play ' + LISTS.wired.title + ' in the Spotify app',
    'pc: Wired on the dial, the row follows to its playlist: ' + JSON.stringify(s.pc));
  check(s.pc && s.pc.inside && s.pc.cut && !s.overflow, 'pc: a long name ends in an ellipsis inside the read-out: ' + JSON.stringify(s.pc));
  // A level set elsewhere (To-do), read on return to the page: the row follows that answer too.
  w.level = 'drained';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(400);
  s = await st(page);
  check(s.dial.join() === 'Wired,Normal,Drained*' && s.pc && s.pc.href === URI('drained'), 'pc: a level set in To-do shows its playlist on return: ' + JSON.stringify(s.pc));
  // Tapping the level that is on clears it: the row goes.
  await tap(page, '#readouts [data-energy="drained"]');
  s = await st(page);
  check(s.dial.join() === 'Wired,Normal,Drained' && !s.pc, 'pc: the level cleared, the row goes: ' + JSON.stringify(s.dial));

  // 6. The keyboard: the dial keeps its focus through the rebuild, then Tab reaches Play with a visible ring.
  await page.focus('#readouts [data-energy="drained"]');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  s = await st(page);
  check(s.focus === 'drained' && s.pc && s.pc.href === URI('drained'), 'pc: Enter on Drained by keyboard keeps the focus on Drained and shows Play: ' + JSON.stringify({ focus: s.focus }));
  await page.keyboard.press('Tab');
  s = await st(page);
  check(s.focus === 'dial' && s.outline === 'solid 2px', 'pc: Tab goes from the dial to Play, the focus ring shows: ' + JSON.stringify({ focus: s.focus, outline: s.outline }));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(400);
  s = await st(page);
  check(s.focus === 'dial', 'pc: a refresh keeps the focus on Play: ' + s.focus);
  await page.keyboard.press('Shift+Tab');
  await ctx.close();
}

// 7. The offer: Start a timer on Drained, "Music for this?" at the foot of the strip; Not now hides it at once.
{
  const w = world({ level: 'drained' });
  const { ctx, page } = await open(w, PC);
  let s = await st(page);
  check(!s.offer && !s.running, 'offer: none before a timer runs');
  await tap(page, '[data-dread="start"]');
  s = await st(page);
  check(s.running && !!s.offer && s.offer.text === 'Music for this? Low tide' && s.offer.href === URI('drained') && s.offer.started === iso('13:00') && s.offer.not === 'Not now',
    'offer: set, the line shows with the playlist and Not now: ' + JSON.stringify(s.offer));
  check(s.offer && s.offer.name === 'Music for this? Low tide, plays in the Spotify app' && s.offer.last && s.offer.belowStop && s.offer.notRight === 0 && s.offer.h.every((x) => x >= 44),
    'offer: its name says where it plays; under Stop at the foot of the strip, Not now on the right, 44 px: ' + JSON.stringify(s.offer));
  check(s.offer && s.offer.cText >= 4.5 && s.offer.cNot >= 4.5 && s.offer.disc === 'rgb(36, 127, 81)', 'offer: the words read at 4.5:1 or more, the disc green: ' + JSON.stringify(s.offer && { text: s.offer.cText, not: s.offer.cNot }));
  check(s.pc && s.pc.href === URI('drained'), 'offer: Play stays under the dial the whole time a level is set');
  await page.screenshot({ path: file('soundtrack-pc') });
  await page.locator('#start').screenshot({ path: file('soundtrack-pc-offer') });

  // Not now: notnow with the timer's startedAt; the line goes before the hub has answered.
  w.hold = 1500;
  await page.click('#startMusic [data-music="notnow"]');
  s = await st(page);
  check(!s.offer && s.running && s.focus === 'stop', 'offer: Not now hides the line at once, the focus on Stop: ' + JSON.stringify({ offer: s.offer, focus: s.focus }));
  await page.waitForTimeout(200);
  check(w.posts.length === 1 && w.posts[0].path === 'notnow' && JSON.stringify(w.posts[0].body) === JSON.stringify({ source: 'morning', startedAt: iso('13:00') }) && w.spotify.length === 0,
    'offer: Not now sends notnow with the startedAt, and starts no music: ' + JSON.stringify({ posts: w.posts, spotify: w.spotify }));
  await page.waitForTimeout(1400);
  w.hold = 0;
  // The hub's next answer has no offer (null): it stays hidden.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(400);
  s = await st(page);
  check(!s.offer && s.running && w.gets.dread >= 2, 'offer: null from the hub, hidden: ' + JSON.stringify({ offer: s.offer, gets: w.gets.dread }));

  // 8. A new timer: Play from the offer sends played with from "offer" and the startedAt, and the line goes.
  await tap(page, '#startDread [data-dread="stop"]');
  w.nextStart = iso('13:05');
  await tap(page, '[data-dread="start"]');
  s = await st(page);
  check(!!s.offer && s.offer.started === iso('13:05'), 'offer: a new timer offers again: ' + JSON.stringify(s.offer));
  const sp = w.spotify.length;
  await page.click('#startMusic a.music-go');
  await page.waitForTimeout(300);
  s = await st(page);
  const clicks = await page$(page, '__clicks');
  check(clicks.length === 1 && clicks[0].href === URI('drained') && clicks[0].blocked === false, 'offer: Play is a real link the page never blocks: ' + JSON.stringify(clicks));
  check(w.posts.length === 2 && w.posts[1].path === 'played' && JSON.stringify(w.posts[1].body) === JSON.stringify({ source: 'morning', level: 'drained', startedAt: iso('13:05'), from: 'offer' }),
    'offer: Play sends played with from offer and the startedAt: ' + JSON.stringify(w.posts[1]));
  check(onePlay(w, sp, URI('drained'), 'computer'), 'offer: the same tap asks the hub once to start Low tide on the computer: ' + JSON.stringify(w.spotify.slice(sp)));
  check(!s.offer && s.focus === 'stop' && s.pc && s.pc.href === URI('drained'), 'offer: after Play the line goes, the focus on Stop, Play under the dial stays: ' + JSON.stringify({ offer: s.offer, focus: s.focus }));

  // 9. The offer follows the level: a new timer on Drained, then Wired on the dial, then Normal (no playlist).
  await tap(page, '#startDread [data-dread="stop"]');
  w.nextStart = iso('13:10');
  await tap(page, '[data-dread="start"]');
  await tap(page, '#readouts [data-energy="wired"]');
  s = await st(page);
  check(s.offer && s.offer.href === URI('wired') && s.offer.text === 'Music for this? ' + LISTS.wired.title && s.offer.started === iso('13:10') && !s.overflow,
    'offer: Wired on the dial, the offer follows to its playlist: ' + JSON.stringify(s.offer));
  await page.locator('#start').screenshot({ path: file('soundtrack-pc-offer-long') });
  await tap(page, '#readouts [data-energy="normal"]');
  s = await st(page);
  check(!s.offer && !s.pc && s.running, 'offer: Normal has no playlist, the offer and Play go: ' + JSON.stringify({ offer: s.offer, pc: s.pc }));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(400);
  s = await st(page);
  check(!s.offer && !s.pc, 'offer: the hub agrees on its next answer (null)');
  // Back to Drained, a dial Play while the offer shows: the hub drops the offer, so does the screen.
  await tap(page, '#readouts [data-energy="drained"]');
  s = await st(page);
  check(!!s.offer && s.offer.href === URI('drained'), 'offer: back on Drained the offer is back: ' + JSON.stringify(s.offer));
  const sp2 = w.spotify.length;
  await page.click('#readouts a.play');
  await page.waitForTimeout(300);
  s = await st(page);
  check(!s.offer && w.posts.at(-1).body.from === 'dial' && !('startedAt' in w.posts.at(-1).body), 'offer: Play under the dial ends the offer too: ' + JSON.stringify({ offer: s.offer, post: w.posts.at(-1) }));
  check(onePlay(w, sp2, URI('drained'), 'computer') && s.pc && s.pc.href === URI('drained'), 'offer: that tap asks the hub once too, the link unchanged: ' + JSON.stringify(w.spotify.slice(sp2)));
  await ctx.close();
}

// 10. The minute poll: a level and a timer set in To-do show here within a minute, Play and the offer with them.
{
  const w = world();
  const { ctx, page } = await open(w, PC, { clock: 'install' });
  let s = await st(page);
  check(!s.pc && !s.offer, 'poll: nothing set, nothing shown');
  w.level = 'drained';
  w.running = { task: 'task00000002', name: 'Text a friend', section: 'soon', startedAt: iso('12:58'), dread: null, level: 'drained', source: 'todo', mins: 2 };
  await page.clock.runFor(61000);
  await page.waitForTimeout(400);
  s = await st(page);
  check(s.pc && s.pc.href === URI('drained') && s.offer && s.offer.started === iso('12:58'), 'poll: within a minute Play and the offer show: ' + JSON.stringify({ pc: !!s.pc, offer: s.offer }));
  // Not now from To-do: the next minute's answer has no offer, and the line goes.
  w.gone.add(iso('12:58'));
  await page.clock.runFor(61000);
  await page.waitForTimeout(400);
  s = await st(page);
  check(!s.offer && s.pc, 'poll: Not now in To-do, the offer goes on the next answer, Play stays: ' + JSON.stringify({ offer: s.offer }));
  await ctx.close();
}

// 11. An older hub (no play, no offer in its answers): nothing new shows, nothing breaks.
{
  const w = world({ level: 'drained' });
  const { ctx, page } = await open(w, PC);
  await page.route('**/api/energy/**', (r) => r.fulfill({ json: { level: 'drained', setAt: iso('12:00'), until: iso('16:00'), source: 'todo', pick: { task: tasks[0], count: 2, left: 2, position: 1 } }, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.reload();
  await page.waitForFunction(() => /As of/.test(document.getElementById('asOf').textContent));
  await page.waitForTimeout(400);
  const s = await st(page);
  check(!s.pc && s.dial.join() === 'Wired,Normal,Drained*', 'older hub: no play in the answer, no row');
  await ctx.close();
}

// 12. The phone: the dial sits in Start with, so Play does too, under it; the offer at the foot of the strip.
{
  const w = world({ level: 'drained' });
  const { ctx, page } = await open(w, PHONE, { reduce: true, ua: IPHONE });
  check(/iPhone/.test(await page.evaluate(() => navigator.userAgent)), 'phone: the browser says iPhone');
  let s = await st(page);
  check(!s.pc && s.phone && s.phone.href === URI('drained') && s.phone.title === 'Low tide' && s.phone.sub === 'Spotify app' && s.phone.label === 'Play Low tide in the Spotify app',
    'phone: Play under the dial in Start with: ' + JSON.stringify(s.phone));
  check(s.phone && s.phone.under && s.phone.inside && s.phone.h >= 44 && s.phone.cTitle >= 4.5 && s.phone.cSub >= 4.5 && !s.overflow, 'phone: 44 px, inside the strip, 4.5:1, nothing sideways: ' + JSON.stringify(s.phone));
  check(s.phone && /^0s/.test(s.phone.moves), 'phone, Reduce Motion: nothing on Play moves: ' + (s.phone && s.phone.moves));
  await page.click('#startDial a.play');
  await page.waitForTimeout(250);
  check(w.posts.length === 1 && JSON.stringify(w.posts[0].body) === JSON.stringify({ source: 'morning', level: 'drained', from: 'dial' }), 'phone: Play sends played from the dial: ' + JSON.stringify(w.posts));
  check(onePlay(w, 0, URI('drained'), 'phone') && (await page.getAttribute('#startDial a.play', 'href')) === URI('drained') && (await page$(page, '__clicks')).every((c) => !c.blocked),
    'phone: the same tap asks the hub once to start Low tide on the phone; the link unchanged, not blocked: ' + JSON.stringify(w.spotify));
  await page.mouse.move(1, 1);
  await page.screenshot({ path: file('soundtrack-phone') });
  // A timer: the offer line at the foot of the strip.
  w.posts.length = 0;
  w.gone.clear();
  w.nextStart = iso('13:01');
  await tap(page, '[data-dread="start"]');
  s = await st(page);
  check(s.offer && s.offer.text === 'Music for this? Low tide' && s.offer.last && s.offer.belowStop && s.offer.notRight === 0 && s.offer.h.every((x) => x >= 44) && !s.overflow,
    'phone: the offer at the foot of the strip, Not now on the right, 44 px, nothing sideways: ' + JSON.stringify(s.offer));
  await page.screenshot({ path: file('soundtrack-phone-offer'), fullPage: true });
  await page.locator('#start').screenshot({ path: file('soundtrack-phone-start') });
  // Play from the offer on the phone: the hub is asked for the phone's Spotify.
  let sp = w.spotify.length;
  await page.click('#startMusic a.music-go');
  await page.waitForTimeout(300);
  check(onePlay(w, sp, URI('drained'), 'phone') && w.posts.at(-1).body.from === 'offer', 'phone: Music for this? asks the hub once to start it on the phone: ' + JSON.stringify(w.spotify.slice(sp)));
  // A new timer, and Not now: notnow only, no music.
  await tap(page, '#startDread [data-dread="stop"]');
  w.posts.length = 0;
  w.gone.clear();
  w.nextStart = iso('13:03');
  await tap(page, '[data-dread="start"]');
  sp = w.spotify.length;
  await tap(page, '#startMusic [data-music="notnow"]', 300);
  s = await st(page);
  check(!s.offer && w.posts.length === 1 && w.posts[0].path === 'notnow' && w.posts[0].body.startedAt === iso('13:03') && w.spotify.length === sp, 'phone: Not now sends notnow, hides the line, starts no music: ' + JSON.stringify(w.posts));
  // The long name wraps inside the strip instead of running off the phone.
  await tap(page, '#startDread [data-dread="stop"]');
  w.nextStart = iso('13:02');
  await tap(page, '#startDial [data-energy="wired"]');
  await tap(page, '[data-dread="start"]');
  s = await st(page);
  check(s.offer && s.offer.href === URI('wired') && !s.overflow && s.phone && s.phone.inside && s.phone.cut, 'phone: a long name wraps in the offer and ends in an ellipsis under the dial: ' + JSON.stringify({ offer: s.offer, phone: s.phone }));
  await page.locator('#start').screenshot({ path: file('soundtrack-phone-long') });
  await ctx.close();
}

// 13. Which device: an iPad that says Macintosh (touch points 5) is a phone; a Mac (no touch) is a
// computer. A hub that is not connected, or away (503), changes nothing on the page.
for (const [name, viewport, opts, kind, answer] of [
  ['ipad as a mac', { width: 1024, height: 768 }, { ua: IPAD_AS_MAC, touchPoints: 5 }, 'phone', { status: 200, json: { ok: false, why: 'not connected' } }],
  ['mac', PC, { ua: IPAD_AS_MAC, touchPoints: 0 }, 'computer', { status: 503, json: { error: 'not configured' } }],
]) {
  const w = world({ level: 'drained' });
  w.spotifyAnswer = answer;
  const { ctx, page } = await open(w, viewport, opts);
  const sel = viewport.width >= 1100 ? '#readouts a.play' : '#startDial a.play';
  await page.click(sel);
  await page.waitForTimeout(300);
  const clicks = await page$(page, '__clicks');
  check(onePlay(w, 0, URI('drained'), kind) && clicks.length === 1 && !clicks[0].blocked && (await page.getAttribute(sel, 'href')) === URI('drained') && w.posts.length === 1,
    name + ': kind ' + kind + ', the link still opens, played still sent, with the hub answering ' + answer.status + ': ' + JSON.stringify(w.spotify));
  await ctx.close();
}

check(!logs.some((l) => NAMES.test(l)), 'no playlist or task names in the console: ' + logs.length + ' lines');
check(errors.length === 0, 'no page errors: ' + errors.join('; '));
await browser.close();
console.log(`${passes} of ${passes + fails} soundtrack checks pass`);
if (failed) process.exit(1);
console.log('all soundtrack checks pass');
