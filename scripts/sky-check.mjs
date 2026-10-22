// Constellation (morning/constellation/) against a mocked GET /api/sky/:code: the ten stars in their places,
// the quiet star, a star's panel and a line's panel (Escape and × give the focus back), the live check
// (one new event travels, nothing new travels nothing, at most five at once, paused while hidden), the
// replay of the last day and the last week (play, pause, scrub, the clock, the end), Reduce Motion (counts
// on the lines, nothing travels, the stepper), the hub away and Retry, no code, an empty week, the phone at
// 390 and 375, Morning's Lately link and the service worker. Every value here is made up.
//   PORT=8095 npm run serve, then: APP=http://localhost:8095/morning/ npm run sky-check
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CODE = 'abcdefgh23456789';
const BASE = process.env.APP || 'http://localhost:8080/morning/';
const OUT = new URL('../verify-shots/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const file = (n) => fileURLToPath(new URL(n + '.png', OUT));

let failed = false;
let passes = 0, fails = 0;
const check = (ok, what) => { if (!ok) { fails++; failed = true; console.error('FAIL:', what); } else { passes++; console.log('ok:', what); } };

/* ---------- The mocked hub: a week of events, counted the way paul-hub src/sky.js counts them ---------- */
const HOUR = 36e5, DAY = 24 * HOUR;
const NOW = Date.parse('2026-10-22T12:58:00.000Z'); // Thursday 22 October, 14:58 in The Hague
const iso = (ms) => new Date(ms).toISOString();
const STARS = [
  ['todo', 'To-do', 'app', 48], ['morning', 'Morning', 'app', 48], ['day', 'Day', 'app', 3], ['kitchen', 'Kitchen', 'app', 168],
  ['mail', 'Email in', 'app', 168], ['defence-digest', 'Defence digest', 'job', 30], ['lift', 'Lift', 'app', 168], ['pc', 'PC', 'job', 26],
  ['arsenal-watch', 'Arsenal watch', 'job', 3], ['hub', 'Hub', 'hub', 3],
];
const ORDER = Object.fromEntries(STARS.map(([id], i) => [id, i]));
const NAME = Object.fromEntries(STARS.map(([id, name]) => [id, name]));
const LABELS = {
  'energy.set': 'Energy set', 'waiting.created': 'Waiting on added', 'waiting.snoozed': 'Snoozed', 'waiting.chase_due': 'Chase due',
  'vacancy.found': 'Vacancy found', 'email.sorted': 'Mail sorted', 'email.received': 'Mail in', 'dinner.away': 'Out for dinner',
  'dinner.back': 'Back for dinner', 'feed.drop': 'Ticket drop', 'feed.job': 'Job ran', 'feed.workout': 'Workout', 'oracle.asked': 'Weekly question',
};
const HOW = { 'arsenal-watch': 'On the Mac: tail ~/arsenal-tx-watch/watch.log' };
let seq = 0;
const ev = (hoursAgo, from, type, to, base = NOW) => ({ id: (0x3f9a0c000000 + ++seq * 7919).toString(16).slice(-12), at: base - Math.round(hoursAgo * HOUR), from, type, to });
const many = (from, type, to, hours) => hours.map((h) => ev(h, from, type, to));
const TM = ['morning', 'day'];
const WEEK = [
  ...many('todo', 'energy.set', TM, [0, 26, 30, 50, 54, 74, 98, 122, 146]),
  ...many('todo', 'waiting.snoozed', TM, [0.4, 28, 76]),
  ...many('todo', 'waiting.created', TM, [20 + 43 / 60, 44, 92, 140]), // Wed 18:15
  ...many('hub', 'waiting.chase_due', ['todo', 'morning', 'day'], [38 + 58 / 60, 110]), // Wed 00:00
  ...many('defence-digest', 'vacancy.found', ['todo'], [52, 124]),
  ...many('day', 'email.sorted', ['todo'], [60]),
  ...many('mail', 'email.received', ['day'], [60.1]),
  ...many('morning', 'energy.set', ['todo', 'day'], [3, 100]),
  ...many('day', 'dinner.away', ['kitchen', 'morning'], [30.5, 100.5, 130]),
  ...many('day', 'dinner.back', ['kitchen', 'morning'], [6, 80]),
  ...many('arsenal-watch', 'feed.drop', ['morning'], [5.2, 9, 20, 33, 47, 58, 71, 95, 119, 143]),
  ...many('pc', 'feed.job', ['morning'], [7.5, 31.5, 55.5]),
  ...many('lift', 'feed.workout', ['morning'], [23, 71, 119]),
  ...many('hub', 'oracle.asked', ['morning'], [104]),
  ev(200, 'todo', 'energy.set', TM), // older than the window: never shown
];

function sky(evs, { now = NOW, poll = 30, replay = { day: 60, week: 60 }, life = {} } = {}) {
  const from = now - 7 * DAY;
  const pulses = evs.filter((e) => e.at > from && e.at <= now).sort((a, b) => a.at - b.at);
  const st = new Map(STARS.map(([id, name, kind, limitHours]) => [id, { id, name, kind, limitHours, events: 0, sent: new Map(), received: new Map(), newest: null }]));
  const lines = new Map();
  const add = (m, type, who) => { const r = m.get(type) || { type, label: LABELS[type], n: 0, who: new Set() }; r.n++; for (const w of who) r.who.add(w); m.set(type, r); };
  for (const p of pulses) {
    const f = st.get(p.from);
    f.events++; f.newest = p.at;
    add(f.sent, p.type, p.to);
    for (const t of p.to) {
      const r = st.get(t);
      r.events++;
      add(r.received, p.type, [p.from]);
      const [a, b] = ORDER[p.from] <= ORDER[t] ? [p.from, t] : [t, p.from];
      const l = lines.get(a + '|' + b) || { a, b, n: 0, ab: new Map(), ba: new Map() };
      l.n++;
      const dir = p.from === a ? l.ab : l.ba;
      const row = dir.get(p.type) || { type: p.type, label: LABELS[p.type], n: 0 };
      row.n++;
      dir.set(p.type, row);
      lines.set(a + '|' + b, l);
    }
  }
  const order = (s) => [...s].sort((x, y) => ORDER[x] - ORDER[y]);
  const byCount = (x, y) => y.n - x.n || x.label.localeCompare(y.label);
  return {
    now: iso(now), from: iso(from), poll, replay,
    stars: [...st.values()].map((s) => {
      const at = s.id in life ? life[s.id] : s.id === 'arsenal-watch' ? s.newest : now - 20 * 60000;
      const quiet = at === null || now - at > s.limitHours * HOUR;
      return {
        id: s.id, name: s.name, kind: s.kind, events: s.events,
        sent: [...s.sent.values()].map((r) => ({ type: r.type, label: r.label, n: r.n, to: order(r.who) })).sort(byCount),
        received: [...s.received.values()].map((r) => ({ type: r.type, label: r.label, n: r.n, from: order(r.who) })).sort(byCount),
        life: at === null ? null : iso(at), limitHours: s.limitHours, quiet,
        quietHours: quiet && at !== null ? Math.floor((now - at) / HOUR) : null, how: quiet ? HOW[s.id] || null : null,
      };
    }),
    lines: [...lines.values()].map((l) => ({ a: l.a, b: l.b, n: l.n, ab: [...l.ab.values()].sort(byCount), ba: [...l.ba.values()].sort(byCount) }))
      .sort((x, y) => ORDER[x.a] - ORDER[y.a] || ORDER[x.b] - ORDER[y.b]),
    pulses: pulses.map((p) => ({ id: p.id, at: iso(p.at), from: p.from, type: p.type, label: LABELS[p.type], to: p.to })),
  };
}
const DATA = sky(WEEK);
const star = (d, id) => d.stars.find((s) => s.id === id);
const line = (d, a, b) => d.lines.find((l) => l.a === a && l.b === b);

/* Where each star must be: the approved geometry (PC box 960 x 740, phone 390 x 400). */
const ANGLE = { morning: 0, day: 40, kitchen: 80, mail: 120, 'defence-digest': 160, lift: 200, pc: 240, 'arsenal-watch': 280, todo: 320 };
const PCG = { cx: 480, cy: 380, rx: 330, ry: 270 }, PHG = { cx: 195, cy: 200, rx: 130, ry: 152 };
const place = (id, g) => (id === 'hub' ? { x: g.cx, y: g.cy } : { x: g.cx + g.rx * Math.sin(ANGLE[id] * Math.PI / 180), y: g.cy - g.ry * Math.cos(ANGLE[id] * Math.PI / 180) });

/* ---------- The page ---------- */
const browser = await chromium.launch();
const CORS = { 'Access-Control-Allow-Origin': '*' };
async function open(viewport, { data = DATA, status = 200, code = CODE, reduced = false, scale = 2 } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, hasTouch: viewport.width < 700, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errors = [], logs = [];
  const w = { gets: 0, status, data, abort: false };
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => logs.push(m.text()));
  // Every travelling dot and flash that appears, with when.
  await page.addInitScript(() => {
    window.__fx = [];
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) {
        if (n.nodeType === 1 && (n.classList.contains('pulse') || n.classList.contains('flash'))) window.__fx.push([n.className, Math.round(performance.now())]);
      }
    }).observe(document, { childList: true, subtree: true });
  });
  await page.route('**/api/sky/**', (r) => {
    w.gets++;
    if (w.abort) return r.abort();
    if (w.status !== 200) return r.fulfill({ status: w.status, json: { error: 'mocked' }, headers: CORS });
    return r.fulfill({ json: structuredClone(w.data), headers: CORS });
  });
  await page.goto(BASE + 'constellation/' + (code ? '?c=' + code : ''));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  return { ctx, page, errors, logs, w };
}
const fx = (page) => page.evaluate(() => window.__fx.slice());
const hide = (page, hidden) => page.evaluate((h) => {
  Object.defineProperty(document, 'hidden', { value: h, configurable: true });
  Object.defineProperty(document, 'visibilityState', { value: h ? 'hidden' : 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}, hidden);

const state = (page) => page.evaluate(() => {
  const vis = (el) => !!el && !el.closest('[hidden]') && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
  const sky = document.getElementById('sky').getBoundingClientRect();
  const svg = document.getElementById('chart');
  const scale = svg.viewBox.baseVal.width ? sky.width / svg.viewBox.baseVal.width : 1;
  const panel = document.getElementById('panel');
  const t = (q) => { const el = document.querySelector(q); return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; };
  return {
    title: document.title, h1: t('h1'), back: document.getElementById('back').getAttribute('href'),
    app: vis(document.getElementById('app')), nocode: vis(document.getElementById('nocode')),
    status: document.getElementById('status').innerText.replace(/\s+/g, ' ').trim(), statusFont: getComputedStyle(document.getElementById('status')).fontFamily,
    note: vis(document.getElementById('note')) ? t('#note') : '',
    legend: vis(document.getElementById('legend')) ? t('#legend') : '',
    seg: [...document.querySelectorAll('.seg button')].map((b) => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')),
    away: vis(document.getElementById('away')) ? t('#away') : '',
    scale, sky: { x: sky.x, y: sky.y, w: sky.width, h: sky.height },
    stars: [...document.querySelectorAll('.star-btn')].map((b) => { const r = b.getBoundingClientRect(); return { id: b.dataset.star, label: b.getAttribute('aria-label'), x: (r.x + r.width / 2 - sky.x) / scale, y: (r.y + r.height / 2 - sky.y) / scale, cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: r.width, h: r.height, expanded: b.getAttribute('aria-expanded') }; }),
    labels: [...svg.querySelectorAll('text.lab, text.lab-q')].map((el) => ({ id: el.dataset.star, q: el.classList.contains('lab-q'), text: el.textContent, fill: el.getAttribute('fill'), anchor: el.getAttribute('text-anchor'), px: parseFloat(el.getAttribute('font-size')) * scale, ...box(el) })),
    circles: [...svg.querySelectorAll('circle.star')].map((c) => ({ id: c.dataset.star, r: +c.getAttribute('r'), fill: c.getAttribute('fill') })),
    lines: [...svg.querySelectorAll('line.ln')].map((l) => ({ key: l.dataset.key, stroke: l.getAttribute('stroke'), op: +l.getAttribute('stroke-opacity'), w: +l.getAttribute('stroke-width') })),
    hits: [...svg.querySelectorAll('line.hit')].map((l) => ({ key: l.dataset.line, label: l.getAttribute('aria-label'), px: +l.getAttribute('stroke-width') * scale, tab: l.getAttribute('tabindex'), role: l.getAttribute('role') })),
    tags: [...svg.querySelectorAll('g.tag')].map((g) => ({ key: g.dataset.key, n: g.textContent, on: g.classList.contains('on'), ...box(g) })),
    pulses: document.querySelectorAll('#fx .pulse').length,
    panel: vis(panel) ? {
      ...box(panel), h2: t('#panelH'), sub: t('.pn-sub'), quiet: panel.querySelector('.pn-quiet') ? panel.querySelector('.pn-quiet').innerText.replace(/\s+/g, ' ').trim() : '', how: t('.pn-how'),
      chip: document.querySelector('.pn-quiet .chip') ? getComputedStyle(document.querySelector('.pn-quiet .chip')).color : '',
      sections: [...panel.querySelectorAll('h3')].map((h) => [h.textContent, [...h.nextElementSibling.querySelectorAll('li')].map((li) => [...li.children].map((c) => c.textContent).filter(Boolean).join(' | '))]),
    } : null,
    replay: vis(document.getElementById('replay')) ? {
      play: document.getElementById('play').getAttribute('aria-label'), value: +document.getElementById('scrub').value,
      valuetext: document.getElementById('scrub').getAttribute('aria-valuetext'), k: t('#replayK'),
      ticks: [...document.querySelectorAll('#ticks span')].filter((s) => !s.hidden).map((s) => s.textContent),
      tickBoxes: [...document.querySelectorAll('#ticks span')].filter((s) => !s.hidden).map((s) => { const r = s.getBoundingClientRect(); return { x: r.x, w: r.width }; }),
      label: document.querySelector('label[for="scrub"]').textContent,
    } : null,
    stepper: vis(document.getElementById('stepper')) ? { k: t('#stepK'), label: t('#stepLabel'), who: t('#stepWho'), prev: document.getElementById('prev').getAttribute('aria-disabled'), next: document.getElementById('next').getAttribute('aria-disabled') } : null,
    focus: (() => { const a = document.activeElement; return a ? (a.dataset && (a.dataset.star || a.dataset.line)) || a.id || a.tagName : ''; })(),
    targets: [...document.querySelectorAll('a, button, input')].filter(vis).map((el) => { const r = el.getBoundingClientRect(); return { what: el.id || el.dataset.star || el.textContent.trim() || el.tagName, w: Math.round(r.width), h: Math.round(r.height) }; }),
    overflow: document.documentElement.scrollWidth > innerWidth,
  };
});
// Text boxes include the line's leading, so two may touch by a pixel or two without the letters meeting.
const overlap = (a, b, m = 1.5) => a.x + m < b.x + b.w - m && b.x + m < a.x + a.w - m && a.y + m < b.y + b.h - m && b.y + m < a.y + a.h - m;
const noisy = (logs) => logs.filter((x) => !/Failed to load resource|net::ERR_/.test(x));

/* ---------- 1. The PC, live ---------- */
for (const [name, viewport] of [['sky-pc', { width: 1440, height: 900 }], ['sky-pc-1280', { width: 1280, height: 800 }]]) {
  const { ctx, page, errors, logs, w } = await open(viewport);
  let s = await state(page);
  check(s.title === 'Constellation' && s.h1 === 'Constellation' && s.back === '../?c=' + CODE, name + ': the title and the way back with the code');
  check(s.seg.join() === 'Live*,Last day,Last week' && s.status === 'Live · checks every 30 s · 14:58' && w.gets === 1, name + ': Live pressed, the status: ' + s.status);
  check(s.sky.w >= (viewport.width - 48 - 432) * 0.9 && s.sky.x - 24 < 60 && s.scale > 0.8 && s.sky.y > 90 && s.sky.y < 120, name + ': the sky fills its column under the header: ' + JSON.stringify({ x: s.sky.x, y: s.sky.y, w: s.sky.w, scale: s.scale.toFixed(3) }));
  check(s.legend === 'Brighter: more events this week · Dim: quiet past its limit · A line: two apps that told each other something', name + ': the legend');
  check(s.stars.map((x) => x.id).join() === STARS.map((x) => x[0]).join(), name + ': ten stars in the answer\'s order: ' + s.stars.map((x) => x.id));
  const off = s.stars.map((x) => { const p = place(x.id, PCG); return Math.hypot(p.x - x.x, p.y - x.y); });
  check(off.every((d) => d < 1.2), name + ': every star in its place: ' + off.map((d) => d.toFixed(1)));
  const names = s.labels.filter((l) => !l.q);
  check(names.map((l) => l.text).join() === 'Hub,To-do,Morning,Day,Kitchen,Email in,Defence digest,Lift,PC,Arsenal watch', name + ': the names drawn: ' + names.map((l) => l.text));
  const by = Object.fromEntries(names.map((l) => [l.id, l]));
  const at = Object.fromEntries(s.stars.map((x) => [x.id, x]));
  const outward = ['day', 'kitchen', 'mail'].every((id) => by[id].anchor === 'start' && by[id].x > at[id].cx) &&
    ['pc', 'arsenal-watch', 'todo'].every((id) => by[id].anchor === 'end' && by[id].x + by[id].w < at[id].cx) &&
    by.morning.anchor === 'middle' && by.morning.y + by.morning.h < at.morning.cy &&
    ['defence-digest', 'lift', 'hub'].every((id) => by[id].anchor === 'middle' && by[id].y > at[id].cy);
  check(outward, name + ': names outward: sides anchored, Morning over, the bottom two and Hub under');
  check(s.labels.every((l) => l.px >= 12.95), name + ': no label under 13 px: ' + Math.min(...s.labels.map((l) => l.px)).toFixed(1));
  const clash = [];
  for (let i = 0; i < s.labels.length; i++) for (let j = i + 1; j < s.labels.length; j++) if (overlap(s.labels[i], s.labels[j])) clash.push(s.labels[i].text + '/' + s.labels[j].text);
  for (const l of s.labels) for (const x of s.stars) if (l.x < x.cx && x.cx < l.x + l.w && l.y < x.cy && x.cy < l.y + l.h) clash.push(l.text + ' on ' + x.id);
  check(!clash.length, name + ': no name on another name or on a star: ' + clash);
  const q = s.labels.find((l) => l.q);
  const dim = s.circles.find((c) => c.id === 'arsenal-watch');
  check(dim && dim.fill === '#4A5263' && by['arsenal-watch'].fill === '#7D8597' && q && q.text === 'Quiet 5 h' && q.fill === '#E5B45A' && q.y > by['arsenal-watch'].y,
    name + ': Arsenal watch dim, Quiet 5 h in amber under its name');
  check(at['arsenal-watch'].label === 'Arsenal watch, quiet 5 hours' && at.todo.label === `To-do, ${star(DATA, 'todo').events} events this week` && at.hub.label === `Hub, ${star(DATA, 'hub').events} events this week`,
    name + ': star buttons say name and count: ' + [at.todo.label, at['arsenal-watch'].label, at.hub.label].join(' / '));
  const r = Object.fromEntries(s.circles.map((c) => [c.id, c.r]));
  const maxE = Math.max(...DATA.stars.filter((x) => x.id !== 'hub').map((x) => x.events));
  const want = (id) => Math.round((3 + 6 * Math.sqrt(star(DATA, id).events / maxE)) * 10) / 10;
  check(['todo', 'morning', 'day', 'kitchen', 'lift'].every((id) => Math.abs(r[id] - want(id)) < 0.11) && r.morning === 9, name + ': brighter for more events (r = 3 + 6 sqrt(events / most)): ' + JSON.stringify(r));
  check(s.lines.length === DATA.lines.length && s.lines.every((l) => l.stroke === '#9AA3B5' && l.op === 0.3) && s.hits.length === DATA.lines.length &&
    s.hits.every((h) => h.px >= 16 && h.tab === '0' && h.role === 'button'), name + ': a faint line for each pair, a 16 px hit stroke that takes the keyboard');
  check(s.hits.find((h) => h.key === 'todo|morning').label === 'To-do and Morning, 18 events this week', name + ': a line says both names and its count');
  check(s.stars.every((x) => x.w >= 44 && x.h >= 44) && s.targets.every((x) => x.h >= 44) && !s.overflow, name + ': 44 px targets, nothing sideways: ' + JSON.stringify(s.targets.filter((x) => x.h < 44)));
  check(s.tags.length === 0 && s.pulses === 0 && !s.note, name + ': no counts on the lines, nothing travels on the first read');
  await page.screenshot({ path: file(name) });

  // A star: the panel on the right, counts, Latest newest first; Escape gives the focus back.
  await page.click('.star-btn[data-star="todo"]');
  await page.waitForTimeout(150);
  s = await state(page);
  const todo = star(DATA, 'todo');
  const mine = DATA.pulses.filter((p) => p.from === 'todo' || p.to.includes('todo')).slice(-4).reverse();
  check(s.panel && Math.round(s.panel.w) === 400 && Math.abs(s.panel.x + s.panel.w - (viewport.width - 24)) < 1.5 && s.panel.x > s.sky.x + s.sky.w - 1,
    name + ': the panel is the right-hand 400 px column, clear of the sky: ' + JSON.stringify(s.panel && { x: s.panel.x, w: s.panel.w }));
  check(s.panel.h2 === 'To-do' && s.panel.sub === `${todo.events} events this week · last one 14:58` && s.focus === 'panelH' && at.todo && s.stars.find((x) => x.id === 'todo').expanded === 'true',
    name + ': To-do, its count and the last one, the focus on the heading: ' + s.panel.sub);
  const sent = s.panel.sections.find((x) => x[0] === 'Sent')[1], got = s.panel.sections.find((x) => x[0] === 'Received')[1], latest = s.panel.sections.find((x) => x[0] === 'Latest')[1];
  check(JSON.stringify(sent) === JSON.stringify(todo.sent.map((x) => `${x.label} | ${x.n} | to ${x.to.map((i) => NAME[i]).join(', ')}`)), name + ': Sent, biggest first: ' + JSON.stringify(sent));
  check(JSON.stringify(got) === JSON.stringify(todo.received.map((x) => `${x.label} | ${x.n} | from ${x.from.map((i) => NAME[i]).join(', ')}`)), name + ': Received: ' + JSON.stringify(got));
  check(JSON.stringify(latest) === JSON.stringify(['14:58 | Energy set | to Morning, Day', '14:34 | Snoozed | to Morning, Day', '11:58 | Energy set | from Morning', 'Wed 18:15 | Waiting on added | to Morning, Day']) && mine.length === 4,
    name + ': Latest, newest first, weekday when not today: ' + JSON.stringify(latest));
  await page.screenshot({ path: file(name + '-star') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  s = await state(page);
  check(!s.panel && s.focus === 'todo', name + ': Escape closes it and the focus is back on To-do: ' + s.focus);

  // The quiet star: the amber chip, its limit, how to look.
  await page.click('.star-btn[data-star="arsenal-watch"]');
  await page.waitForTimeout(120);
  s = await state(page);
  check(s.panel.h2 === 'Arsenal watch' && s.panel.quiet === 'Quiet 5 h its limit is 3 h' && s.panel.chip === 'rgb(229, 180, 90)' && s.panel.how === HOW['arsenal-watch'],
    name + ': a quiet star: Quiet 5 h, its limit, how to look: ' + JSON.stringify([s.panel.quiet, s.panel.how]));
  await page.screenshot({ path: file(name + '-quiet') });
  await page.click('#close');
  await page.waitForTimeout(100);
  s = await state(page);
  check(!s.panel && s.focus === 'arsenal-watch', name + ': × closes it and the focus is back on the star: ' + s.focus);

  // A line from the keyboard: both directions, the line lit; Escape back to the line.
  await page.focus('.hit[data-line="todo|morning"]');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);
  s = await state(page);
  const tm = line(DATA, 'todo', 'morning');
  check(s.panel && s.panel.h2 === 'To-do and Morning' && s.panel.sub === '18 events this week' &&
    JSON.stringify(s.panel.sections) === JSON.stringify([['To-do to Morning', tm.ab.map((x) => `${x.label} | ${x.n}`)], ['Morning to To-do', tm.ba.map((x) => `${x.label} | ${x.n}`)]]),
    name + ': a line: both names, the count, each direction: ' + JSON.stringify(s.panel && s.panel.sections));
  const lit = s.lines.filter((l) => l.stroke === '#F4EFE1');
  check(lit.length === 1 && lit[0].key === 'todo|morning' && lit[0].op === 0.85 && lit[0].w === 2.4, name + ': the line is lit');
  await page.screenshot({ path: file(name + '-line') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  s = await state(page);
  check(!s.panel && s.focus === 'todo|morning' && !s.lines.some((l) => l.stroke === '#F4EFE1'), name + ': Escape puts the line out and the focus back on it');

  // A line with the mouse: To-do and Day, with only one direction, the empty one left out.
  const k = s.scale;
  const p1 = place('todo', PCG), p2 = place('day', PCG);
  await page.mouse.click(s.sky.x + (p1.x + (p2.x - p1.x) * 0.6) * k, s.sky.y + (p1.y + (p2.y - p1.y) * 0.6) * k);
  await page.waitForTimeout(120);
  s = await state(page);
  const td = line(DATA, 'todo', 'day');
  check(s.panel && s.panel.h2 === 'To-do and Day' && s.panel.sections.map((x) => x[0]).join() === (td.ba.length ? 'To-do to Day,Day to To-do' : 'To-do to Day'), name + ': a click on a line opens it: ' + (s.panel && s.panel.h2));
  await page.mouse.click(s.sky.x + 40, s.sky.y + 40);
  await page.waitForTimeout(100);
  s = await state(page);
  check(!s.panel, name + ': a click on the empty sky puts the panel away');
  check(errors.length === 0 && noisy(logs).length === 0, name + ': nothing in the console: ' + errors.concat(noisy(logs)).join('; '));
  await ctx.close();
}

/* ---------- 2. Live: a new event travels, nothing new travels nothing, at most five, hidden pauses ---------- */
{
  const { ctx, page, errors, logs, w } = await open({ width: 1440, height: 900 }, { data: sky(WEEK, { poll: 1 }) });
  let f = await fx(page);
  check(f.length === 0, 'live: nothing travels on the first read');
  const next = ev(0, 'todo', 'energy.set', TM, NOW + 30000);
  w.data = sky([...WEEK, next], { now: NOW + 30000, poll: 1 });
  await page.waitForFunction(() => window.__fx.length > 0, null, { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(250);
  const mid = await state(page);
  f = await fx(page);
  check(f.filter((x) => x[0] === 'flash').length === 1 && f.filter((x) => x[0] === 'pulse').length === 2 && mid.pulses >= 1,
    'live: one new event: To-do flashes once, a dot to Morning and one to Day: ' + JSON.stringify(f.map((x) => x[0])));
  await page.screenshot({ path: file('sky-pc-live-pulse') });
  check(/14:58$/.test(mid.status) && mid.stars.find((x) => x.id === 'todo').label === `To-do, ${star(DATA, 'todo').events + 1} events this week`, 'live: the counts follow the new answer');
  const gets = w.gets;
  await page.waitForTimeout(2300);
  f = await fx(page);
  const s = await state(page);
  check(w.gets >= gets + 1 && f.length === 3 && s.pulses === 0, 'live: the next checks bring nothing new and nothing travels; the dots are gone: ' + JSON.stringify({ gets: w.gets - gets, fx: f.length, left: s.pulses }));

  // Hidden: no checks; visible again: one at once.
  await hide(page, true);
  const before = w.gets;
  await page.waitForTimeout(2600);
  check(w.gets === before, 'live: no checks while the page is hidden: ' + (w.gets - before));
  // Eight new events while away: five travel, 300 ms apart, the newest five.
  const eight = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ev(-i / 3600, i % 2 ? 'day' : 'pc', i % 2 ? 'dinner.away' : 'feed.job', i % 2 ? ['kitchen', 'morning'] : ['morning'], NOW + 40000));
  w.data = sky([...WEEK, next, ...eight], { now: NOW + 60000, poll: 1 });
  const t0 = await page.evaluate(() => window.__fx.length);
  await hide(page, false);
  await page.waitForTimeout(250);
  check(w.gets === before + 1, 'live: back on the screen, one check at once');
  await page.waitForTimeout(1700);
  f = (await fx(page)).slice(t0);
  const flashes = f.filter((x) => x[0] === 'flash').map((x) => x[1]);
  const gaps = flashes.slice(1).map((t, i) => t - flashes[i]);
  check(flashes.length === 5 && gaps.every((g) => g >= 240 && g <= 420), 'live: many at once: five, 300 ms apart: ' + JSON.stringify(gaps));
  check(errors.length === 0 && noisy(logs).length === 0, 'live: nothing in the console');
  await ctx.close();
}

/* ---------- 3. Replay: the last day and the last week ---------- */
{
  const data = sky(WEEK, { replay: { day: 3, week: 4 } });
  const { ctx, page, errors, logs, w } = await open({ width: 1440, height: 900 }, { data });
  const gets = w.gets;
  await page.click('.seg button[data-mode="day"]');
  await page.waitForTimeout(80);
  let s = await state(page);
  const dayN = data.pulses.filter((p) => Date.parse(p.at) >= NOW - DAY).length;
  check(s.seg.join() === 'Live,Last day*,Last week' && s.replay && s.replay.play === 'Pause' && !s.legend, 'day: Last day pressed, playing, the legend makes room: ' + JSON.stringify(s.replay));
  check(s.replay.ticks.join(' ') === '18 00 06 12' && s.replay.k === 'A day in 3 s' && s.replay.label === 'Time in the replay', 'day: the hours under the scrubber: ' + s.replay.ticks.join(' '));
  check(/^Wed 21 Oct · 1[45]:\d\d$/.test(s.status) && /Barlow Condensed/.test(s.statusFont), 'day: the replay clock in Barlow Condensed: ' + s.status);
  await page.waitForTimeout(900);
  s = await state(page);
  const v1 = s.replay.value;
  let f = await fx(page);
  check(v1 > 150 && v1 < 600 && f.some((x) => x[0] === 'pulse') && s.replay.valuetext === s.status, 'day: the scrubber moves, events travel as their time passes: ' + JSON.stringify({ v1, fx: f.length }));
  await page.screenshot({ path: file('sky-pc-day') });
  await page.click('#play');
  await page.waitForTimeout(400);
  s = await state(page);
  const v2 = s.replay.value;
  await page.waitForTimeout(400);
  s = await state(page);
  check(s.replay.play === 'Play' && s.replay.value === v2, 'day: Pause holds it: ' + JSON.stringify([v2, s.replay.value]));
  // A jump: the clock follows, nothing on the way travels.
  const n0 = (await fx(page)).length;
  await page.locator('#scrub').fill('500');
  await page.waitForTimeout(150);
  s = await state(page);
  check(s.replay.value === 500 && s.status === 'Thu 22 Oct · 02:58' && (await fx(page)).length === n0, 'day: scrubbing to the middle jumps to 02:58 without anything travelling: ' + s.status);
  await page.click('#play');
  await page.waitForTimeout(2000);
  s = await state(page);
  check(s.replay.play === 'Play' && s.replay.value === 1000 && s.status === 'Thu 22 Oct · 14:58', 'day: at the end it stops on now: ' + JSON.stringify([s.replay.play, s.replay.value, s.status]));
  await page.click('#play');
  await page.waitForTimeout(250);
  s = await state(page);
  check(s.replay.play === 'Pause' && s.replay.value < 200, 'day: Play at the end starts again from the beginning: ' + s.replay.value);
  check(dayN > 3, 'day: the mock has events in the last day: ' + dayN);

  await page.click('.seg button[data-mode="week"]');
  await page.waitForTimeout(60);
  s = await state(page);
  check(s.seg.join() === 'Live,Last day,Last week*' && s.replay.ticks.join() === 'Fri,Sat,Sun,Mon,Tue,Wed,Thu' && s.replay.k === 'A week in 4 s', 'week: weekday names under the scrubber: ' + s.replay.ticks);
  check(/^Thu 15 Oct · 1[4-9]:\d\d$/.test(s.status), 'week: the clock starts a week ago (and runs at 42 hours a second): ' + s.status);
  await page.waitForTimeout(1500);
  s = await state(page);
  check(s.replay.value > 250 && s.replay.value < 600, 'week: a week in 4 s: ' + s.replay.value);
  await page.screenshot({ path: file('sky-pc-week') });
  await page.waitForTimeout(2800);
  s = await state(page);
  check(s.replay.play === 'Play' && s.replay.value === 1000 && w.gets === gets, 'week: the end; no checks while replaying: ' + (w.gets - gets));
  await page.click('.seg button[data-mode="live"]');
  await page.waitForTimeout(250);
  s = await state(page);
  check(s.seg[0] === 'Live*' && !s.replay && w.gets === gets + 1 && /^Live/.test(s.status) && s.legend, 'back to Live: one check at once, the legend back');
  check(errors.length === 0 && noisy(logs).length === 0, 'replay: nothing in the console');
  await ctx.close();
}

/* ---------- 4. Reduce Motion: counts on the lines, nothing travels, the stepper ---------- */
for (const [name, viewport] of [['sky-calm-pc', { width: 1440, height: 900 }], ['sky-calm-phone', { width: 390, height: 844 }]]) {
  const { ctx, page, errors, logs, w } = await open(viewport, { reduced: true, data: sky(WEEK, { poll: 1 }) });
  let s = await state(page);
  check(s.note === 'Latest: Energy set, To-do to Morning and Day · 14:58', name + ': Live names the newest event under the header: ' + s.note);
  check(s.tags.length === DATA.lines.length && DATA.lines.every((l) => s.tags.find((t) => t.key === `${l.a}|${l.b}`).n === String(l.n)), name + ': a count on every line');
  const clash = [];
  for (let i = 0; i < s.tags.length; i++) for (let j = i + 1; j < s.tags.length; j++) if (overlap(s.tags[i], s.tags[j])) clash.push(s.tags[i].key + '/' + s.tags[j].key);
  for (const t of s.tags) for (const x of s.stars) if (Math.hypot(t.x + t.w / 2 - x.cx, t.y + t.h / 2 - x.cy) < 10) clash.push(t.key + ' on ' + x.id);
  for (const t of s.tags) for (const l of s.labels) if (overlap(t, l)) clash.push(t.key + ' on ' + l.text);
  check(!clash.length, name + ': no count on another count, a star or a name: ' + clash);
  w.data = sky([...WEEK, ev(0, 'todo', 'energy.set', TM, NOW + 30000)], { now: NOW + 30000, poll: 1 });
  await page.waitForTimeout(1600);
  s = await state(page);
  const f = await fx(page);
  check(f.length === 0 && s.pulses === 0 && w.gets >= 2 && /^Latest: Energy set, To-do to Morning and Day · 14:58$/.test(s.note), name + ': a new event moves nothing; the line says it: ' + JSON.stringify({ fx: f.length, gets: w.gets }));
  await page.screenshot({ path: file(name) });
  await page.click('.seg button[data-mode="day"]');
  await page.waitForTimeout(120);
  s = await state(page);
  const list = w.data.pulses.filter((p) => Date.parse(p.at) >= Date.parse(w.data.now) - DAY);
  check(s.stepper && !s.replay && s.stepper.k === `Last day, one at a time · 1 of ${list.length}` && s.stepper.label === list[0].label && s.stepper.prev === 'true' && s.stepper.next === 'false',
    name + ': Last day is a stepper from the first: ' + JSON.stringify(s.stepper));
  for (let i = 0; i < 3; i++) await page.click('#next');
  await page.waitForTimeout(100);
  s = await state(page);
  const p = list[3];
  const whoText = `${NAME[p.from]} to ${p.to.map((x) => NAME[x]).join(' and ')}`;
  const lit = s.tags.filter((t) => t.on).map((t) => t.key).sort().join();
  const want = p.to.map((t) => (ORDER[p.from] <= ORDER[t] ? `${p.from}|${t}` : `${t}|${p.from}`)).sort().join();
  check(s.stepper.k === `Last day, one at a time · 4 of ${list.length}` && s.stepper.label === p.label && s.stepper.who.startsWith(whoText + ' · ') && s.stepper.prev === 'false',
    name + ': Next steps one at a time: ' + JSON.stringify(s.stepper));
  check(lit === want && s.lines.filter((l) => l.stroke === '#F4EFE1').map((l) => l.key).sort().join() === want, name + ': the step lights its lines: ' + lit);
  check(/^\w{3} \d{1,2} Oct · \d\d:\d\d$/.test(s.status), name + ': the status is the step\'s clock: ' + s.status);
  await page.click('#prev');
  await page.waitForTimeout(80);
  s = await state(page);
  check(s.stepper.k === `Last day, one at a time · 3 of ${list.length}`, name + ': Previous steps back');
  check((await state(page)).targets.every((x) => x.h >= 44) && !s.overflow, name + ': 44 px, nothing sideways');
  await page.screenshot({ path: file(name + '-step') });
  check(errors.length === 0 && noisy(logs).length === 0, name + ': nothing in the console');
  await ctx.close();
}

/* ---------- 5. The phone at 390 and 375 ---------- */
for (const [name, viewport] of [['sky-phone', { width: 390, height: 844 }], ['sky-phone-375', { width: 375, height: 667 }]]) {
  const { ctx, page, errors, logs } = await open(viewport);
  let s = await state(page);
  const off = s.stars.map((x) => { const p = place(x.id, PHG); return Math.hypot(p.x - x.x, p.y - x.y); });
  check(off.every((d) => d < 1.2) && s.sky.w <= viewport.width + 0.5, name + ': the phone\'s ellipse: ' + off.map((d) => d.toFixed(1)));
  const by = Object.fromEntries(s.labels.filter((l) => !l.q).map((l) => [l.id, l]));
  const at = Object.fromEntries(s.stars.map((x) => [x.id, x]));
  check(s.labels.every((l) => l.anchor === 'middle') && ['morning', 'day', 'todo'].every((id) => by[id].y + by[id].h < at[id].cy) &&
    ['kitchen', 'mail', 'defence-digest', 'lift', 'pc', 'arsenal-watch', 'hub'].every((id) => by[id].y > at[id].cy), name + ': names centred, over the top three, under the rest');
  check(s.labels.every((l) => l.px >= 12.95 && l.x >= 0 && l.x + l.w <= viewport.width), name + ': labels 13 px or more, on the screen: ' + Math.min(...s.labels.map((l) => l.px)).toFixed(2));
  const clash = [];
  for (let i = 0; i < s.labels.length; i++) for (let j = i + 1; j < s.labels.length; j++) if (overlap(s.labels[i], s.labels[j])) clash.push(s.labels[i].text + '/' + s.labels[j].text);
  check(!clash.length, name + ': no name on another: ' + clash);
  check(s.status === 'Live · 14:58' && !s.legend, name + ': the short status, no legend: ' + s.status);
  check(!s.overflow && s.targets.every((x) => x.h >= 44 && x.w >= 44), name + ': nothing sideways, 44 px targets: ' + JSON.stringify(s.targets.filter((x) => x.h < 44 || x.w < 44)));
  await page.screenshot({ path: file(name) });
  // A line on the phone: a sheet from below.
  await page.focus('.hit[data-line="todo|morning"]');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  s = await state(page);
  check(s.panel && s.panel.x === 0 && Math.round(s.panel.w) === viewport.width && Math.abs(s.panel.y + s.panel.h - viewport.height) < 1 && s.panel.h2 === 'To-do and Morning',
    name + ': a line opens a sheet from below: ' + JSON.stringify(s.panel && { y: s.panel.y, h: s.panel.h }));
  check(s.targets.every((x) => x.h >= 44 && x.w >= 44) && !s.overflow, name + ': the sheet: 44 px, nothing sideways');
  await page.screenshot({ path: file(name + '-line') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  await page.tap('.star-btn[data-star="arsenal-watch"]');
  await page.waitForTimeout(150);
  s = await state(page);
  check(s.panel && s.panel.h2 === 'Arsenal watch' && s.panel.quiet === 'Quiet 5 h its limit is 3 h', name + ': a tap on the quiet star opens its sheet');
  await page.screenshot({ path: file(name + '-star') });
  await page.click('#close');
  await page.click('.seg button[data-mode="week"]');
  await page.waitForTimeout(700);
  s = await state(page);
  check(s.replay && !s.overflow && s.targets.every((x) => x.h >= 44) && /^\w{3} \d{1,2} Oct · \d\d:\d\d$/.test(s.status) && s.replay.ticks.length >= 6 && s.replay.ticks.at(-1) === 'Thu' &&
    s.replay.tickBoxes.every((b, i, a) => i === 0 || b.x >= a[i - 1].x + a[i - 1].w + 4), name + ': Last week: the bar at the bottom, the clock in the status, weekday names apart: ' + s.status + ' ' + s.replay.ticks);
  await page.screenshot({ path: file(name + '-week') });
  check(errors.length === 0 && noisy(logs).length === 0, name + ': nothing in the console');
  await ctx.close();
}

/* ---------- 6. The hub away, no code, an empty week ---------- */
for (const how of [503, 404, 400]) {
  const { ctx, page, w, errors } = await open({ width: 1440, height: 900 }, { status: how });
  let s = await state(page);
  check(s.away === 'Can’t reach the hub. Retry' && s.stars.length === 0 && s.seg.every((x) => !x.endsWith('*') || x === 'Live*'), `away (${how}): says so, with Retry, no stars: ` + s.away);
  if (how === 503) {
    await page.screenshot({ path: file('sky-away') });
    w.status = 200;
    await page.click('#retry');
    await page.waitForTimeout(300);
    s = await state(page);
    check(!s.away && s.stars.length === 10 && w.gets === 2 && /^Live/.test(s.status), 'away: Retry reads again and draws the sky');
  }
  check(errors.length === 0, `away (${how}): no page errors`);
  await ctx.close();
}
{
  const { ctx, page, w } = await open({ width: 390, height: 844 }, { status: 200 });
  w.abort = true;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(300);
  let s = await state(page);
  check(s.stars.length === 10 && /^Can’t reach the hub · as of 14:58$/.test(s.status) && !s.away, 'network gone after a good read: the sky stays, the status says so: ' + s.status);
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.route('**/api/sky/**', (r) => r.abort());
  await page.goto(BASE + 'constellation/?c=' + CODE);
  await page.waitForTimeout(400);
  const s = await state(page);
  check(s.away === 'Can’t reach the hub. Retry', 'network failure on the first read: the hub away with Retry');
  await ctx.close();
}
{
  const { ctx, page } = await open({ width: 390, height: 844 }, { code: '' });
  const s = await state(page);
  check(!s.app && s.nocode, 'no code: the page says to open Morning from the private link');
  await ctx.close();
}
{
  const { ctx, page, errors } = await open({ width: 1440, height: 900 }, { data: sky([]) });
  const s = await state(page);
  check(s.note === 'Nothing in the last 7 days' && s.stars.length === 10 && s.labels.filter((l) => !l.q).length === 10 && s.lines.length === 0 &&
    s.circles.every((c) => c.r === 3) && s.stars.find((x) => x.id === 'todo').label === 'To-do, nothing this week', 'empty week: says so and still draws the ten stars: ' + s.note);
  await page.click('.star-btn[data-star="todo"]');
  await page.waitForTimeout(100);
  const p = (await state(page)).panel;
  check(p && p.sub === 'Nothing this week' && p.sections.length === 0, 'empty week: a star says Nothing this week');
  await page.screenshot({ path: file('sky-empty') });
  check(errors.length === 0, 'empty week: no page errors');
  await ctx.close();
}

/* ---------- 7. Morning's Lately card leads here ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.route('**/api/**', (r) => {
    const u = new URL(r.request().url());
    if (u.pathname.startsWith('/api/morning/')) return r.fulfill({ json: { now: new Date().toISOString(), events: { events: [{ id: 'e1', source: 'pc', kind: 'job', text: 'Backup done', at: new Date(Date.now() - 600000).toISOString() }], sources: {} } }, headers: CORS });
    if (u.pathname.startsWith('/api/sky/')) return r.fulfill({ json: DATA, headers: CORS });
    return r.fulfill({ status: 503, json: { error: 'mocked' }, headers: CORS });
  });
  await page.route('**/site.**espn.com/**', (r) => r.abort());
  await page.goto(BASE + '?c=' + CODE);
  await page.waitForFunction(() => !document.getElementById('feed').hidden, null, { timeout: 5000 }).catch(() => {});
  const link = await page.evaluate(() => {
    const a = document.getElementById('feedSky');
    if (!a) return null;
    const r = a.getBoundingClientRect();
    return { href: a.getAttribute('href'), text: a.textContent.replace(/\s+/g, ' ').trim(), h: r.height, inHead: !!a.closest('#feed .card-head'), cls: a.className };
  });
  check(link && link.href === 'constellation/?c=' + CODE && link.text === 'Constellation ›' && link.inHead && /card-link/.test(link.cls), 'Morning: Constellation › in the head of Lately: ' + JSON.stringify(link));
  await page.waitForTimeout(1600); // the day's first open plays a one-second entrance
  await page.locator('#feed').screenshot({ path: file('sky-lately-link') });
  await page.click('#feedSky');
  await page.waitForURL(/constellation\/\?c=/);
  await page.waitForTimeout(300);
  check((await page.title()) === 'Constellation' && (await page.locator('.star-btn').count()) === 10, 'Morning: the link opens the Constellation with the code');
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.route('**/api/**', (r) => {
    const u = new URL(r.request().url());
    if (u.pathname.startsWith('/api/morning/')) return r.fulfill({ json: { now: new Date().toISOString(), events: { events: [{ id: 'e1', source: 'pc', kind: 'job', text: 'Backup done', at: new Date(Date.now() - 600000).toISOString() }], sources: {} } }, headers: CORS });
    return r.fulfill({ status: 503, json: { error: 'mocked' }, headers: CORS });
  });
  await page.route('**/site.**espn.com/**', (r) => r.abort());
  await page.goto(BASE + '?c=' + CODE);
  await page.waitForFunction(() => !document.getElementById('feed').hidden, null, { timeout: 5000 }).catch(() => {});
  const h = await page.evaluate(() => { const a = document.getElementById('feedSky'); return a ? Math.round(a.getBoundingClientRect().height) : 0; });
  check(h >= 44, 'Morning phone: the link is 44 px tall: ' + h);
  await ctx.close();
}

/* ---------- 8. The service worker keeps this page under its own path ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, json: { error: 'mocked' }, headers: CORS }));
  await ctx.route('**/site.**espn.com/**', (r) => r.abort());
  await page.goto(BASE + '?c=' + CODE + '&sw=1');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.goto(BASE + 'constellation/?c=' + CODE);
  await page.waitForTimeout(800);
  const kept = await page.evaluate(async () => {
    const out = {};
    for (const k of await caches.keys()) {
      const c = await caches.open(k);
      for (const req of await c.keys()) {
        const p = new URL(req.url).pathname;
        if (p.endsWith('/')) out[p] = /<title>([^<]*)<\/title>/.exec(await (await c.match(req)).text())?.[1] || '';
      }
    }
    return out;
  });
  const root = new URL(BASE).pathname;
  check(kept[root] === 'Morning' && kept[root + 'constellation/'] === 'Constellation', 'service worker: Morning stays Morning, Constellation under its own path: ' + JSON.stringify(kept));
  await ctx.close();
}

await browser.close();
console.log(`${passes} of ${passes + fails} sky checks pass`);
if (failed) process.exit(1);
console.log('all sky checks pass');
