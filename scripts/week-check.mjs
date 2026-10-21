// The Sunday reset (Week view): opens on Sundays, the switch, the four cards in order, Show all,
// Gone quiet's buttons with the delete question, New date and Undo, empty lines, and no switch
// on other days. Against a mocked Worker that keeps state like the real route. Every value is made up.
//   PORT=8095 npm run serve, then: APP=http://localhost:8095/morning/ npm run week-check
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CODE = 'abcdefgh23456789';
const BASE = process.env.APP || 'http://localhost:8080/morning/';
const OUT = new URL('../verify-shots/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const file = (n) => fileURLToPath(new URL(n + '.png', OUT));
const SUNDAY = '2026-10-18T18:30:00+02:00';
const MONDAY = '2026-10-19T08:30:00+02:00';

let failed = false;
let passes = 0, fails = 0;
const check = (ok, what) => { if (!ok) { fails++; failed = true; console.error('FAIL:', what); } else { passes++; console.log('ok:', what); } };

function world(now, empty) {
  const quiet = empty ? [] : [
    { id: 'quiet0000001', text: 'Cancel the old phone contract', section: 'soon', days: 31 },
    { id: 'quiet0000002', text: 'Find a tutor for the evening class', section: 'someday', days: 22 },
    { id: 'quiet0000003', text: 'Ask for the scanned certificates', section: 'soon', days: 17 },
    { id: 'quiet0000004', text: 'Fix the hallway light', section: 'today', days: 15 },
    { id: 'quiet0000005', text: 'Return the library books', section: 'today', days: 14 },
    { id: 'quiet0000006', text: 'Sort the photo backup', section: 'someday', days: 14 },
  ];
  const flags = empty ? [] : [
    { id: 'flag00000001', text: 'Book the flights · 2026-11-02', section: 'soon' },
    { id: 'flag00000002', text: 'Call the plumber', section: 'today' },
  ];
  // Waiting on: open items oldest first, with what was resolved and chased this week (paul-hub src/waiting.js).
  const witem = (n, who, what, since, extra = {}) => ({ id: 'wait00000000000' + n, who, what, since, channel: 'email', chaseDays: 7, nextChase: '2026-10-20',
    forWhom: null, source: 'morning', state: 'open', chases: 0, chaseDue: false, chaseTask: null, resolvedAt: null, ...extra });
  const waits = empty ? [] : [
    witem(1, 'The ministry', 'the policy officer application', '2026-10-04', { chases: 1, chaseDue: true, nextChase: '2026-10-18', source: 'apply' }),
    witem(2, 'The agency', 'the application', '2026-10-05', { chaseDue: true, nextChase: '2026-10-12' }),
    witem(3, 'The accountant', 'the tax overview', '2026-10-15', { channel: 'phone', forWhom: 'Nick' }),
    witem(4, 'The council', 'the parking permit', '2026-10-18', { channel: 'letter' }),
  ];
  const wcount = { resolved: empty ? 0 : 2, chased: empty ? 0 : 3 };
  const waitWeek = () => ({ items: structuredClone(waits), ...wcount });
  const waitBlock = () => { const due = waits.filter((i) => i.chaseDue); return { open: waits.length, due: due.length, dueWho: due.slice(0, 3).map((i) => i.who), items: structuredClone(waits.slice(0, 8)) }; };
  const week = () => ({
    waiting: waitWeek(),
    thisWeek: structuredClone(flags),
    week: 42, from: '2026-10-12', to: '2026-10-18',
    lessons: structuredClone(lessons),
    energy: empty ? { parts: ['morning', 'afternoon', 'evening'], days: [12, 13, 14, 15, 16, 17, 18].map((d) => ({ date: '2026-10-' + d, parts: [null, null, null] })), sets: 0, most: { wired: null, normal: null, drained: null } } : {
      parts: ['morning', 'afternoon', 'evening'],
      days: [
        ['normal', 'normal', 'drained'], ['wired', 'normal', 'drained'], ['normal', 'drained', 'drained'], ['normal', 'normal', 'normal'],
        [null, 'normal', 'drained'], ['wired', 'normal', 'normal'], ['normal', null, 'drained'],
      ].map((parts, i) => ({ date: '2026-10-' + (12 + i), parts })),
      sets: 11, most: { wired: 'morning', normal: 'afternoon', drained: 'evening' },
    },
    paragraph: empty ? null : 'You got seven things done, including the rent and the ID card. The hallway light has sat for two weeks now. Thursday is busy, so do it Monday evening after archery.',
    mirror: empty ? null : {
      days: 45, moodDays: 31,
      finding: { text: 'You tend to tick off almost twice as much on good days, about 6 tasks against 3.', numbers: 'Tasks done 5.8 on good or very good days (12 days), 3.1 on okay or worse days (9 days)' },
      experiment: { text: 'Keep 3 evenings this week free of plans.' },
      last: { text: 'You hit it: 4 of 7 days against a target of 4, and your mood was a little higher than the month before.' },
    },
    done: empty ? { count: 0, groups: [] } : { count: 7, groups: [
      { section: 'today', items: [{ text: 'Book the dentist', day: 'Sun' }, { text: 'Pay the rent', day: 'Fri' }, { text: 'Call home', day: 'Thu' }, { text: 'Bins out', day: 'Tue' }] },
      { section: 'soon', items: [{ text: 'Renew the ID card', day: 'Fri' }, { text: 'Back up the bike key', day: 'Tue' }] },
      { section: 'someday', items: [{ text: 'Frame the print', day: 'Sat' }] },
    ] },
    quiet: structuredClone(quiet),
    vacancies: empty ? [] : [
      { id: 'vac000000001', text: 'Apply: Policy officer (A ministry) · 2026-10-30', link: 'https://jobs.example/1', state: 'open' },
      { id: 'vac000000002', text: 'Apply: Research assistant (A think tank)', link: 'https://jobs.example/2', state: 'done' },
    ],
    next: { from: '2026-10-19', to: '2026-10-25', sent: SUNDAY, stale: false, events: empty ? [] : [
      { date: '2026-10-19', day: 'Mon', time: '19:00', title: 'Archery' },
      { date: '2026-10-20', day: 'Tue', time: '08:30', title: 'Dentist check-up' },
      { date: '2026-10-22', day: 'Thu', time: 'all day', title: 'Away for work' },
      { date: '2026-10-22', day: 'Thu', time: '18:30', title: 'Dinner with friends' },
      { date: '2026-10-24', day: 'Sat', time: '13:30', title: 'Football' },
      { date: '2026-10-25', day: 'Sun', time: '11:00', title: 'Call family' },
    ] },
  });
  const gone = new Map();
  const lessons = empty ? { proposed: [], kept: [] } : {
    proposed: [
      { id: 'lesson000001', app: 'tidy', text: 'Leave "tmrw" as typed; never turn it into a date.', why: 'You undid 3 tidies that turned tmrw into a date.' },
      { id: 'lesson000002', app: 'desk', text: 'Write tasks for family in Spanish.', why: 'You edited 2 Desk tasks for family into Spanish.' },
    ],
    kept: [{ id: 'lesson000000', app: 'desk', text: 'Put dentist and doctor tasks in Today.', why: 'You moved 2 of them to Today.' }],
  };
  return {
    posts: [],
    lessonPosts: [],
    waitPosts: [],
    wait(url, body) {
      this.waitPosts.push({ url, body });
      const id = url.split('/').pop();
      const i = waits.findIndex((x) => x.id === id);
      if (i < 0) return { status: 404, json: { error: 'no such item' } };
      if (body.action === 'resolve') {
        const [x] = waits.splice(i, 1);
        wcount.resolved++;
        return { json: { item: { ...x, state: 'resolved', chaseDue: false, resolvedAt: new Date(now).toISOString() } } };
      }
      if (body.action === 'snooze' && [3, 7, 14].includes(body.days)) {
        const next = new Date(Date.parse(now.slice(0, 10) + 'T12:00:00Z') + body.days * 864e5).toISOString().slice(0, 10);
        Object.assign(waits[i], { nextChase: next, chaseDue: false, chaseTask: null });
        return { json: { item: structuredClone(waits[i]) } };
      }
      return { status: 400, json: { error: 'action: resolve, snooze or still' } };
    },
    lesson({ id, action }) {
      this.lessonPosts.push(action);
      const all = [...lessons.proposed, ...lessons.kept];
      const x = all.find((l) => l.id === id) || this.dropped;
      lessons.proposed = lessons.proposed.filter((l) => l.id !== id);
      lessons.kept = lessons.kept.filter((l) => l.id !== id);
      if (action === 'keep') lessons.kept.unshift(x);
      if (action === 'undo') lessons.proposed.unshift(x);
      if (action === 'drop') this.dropped = x;
      return { ok: true, lessons: structuredClone(lessons) };
    },
    answer() {
      const sunday = now === SUNDAY;
      return { now: new Date(now).toISOString(), todos: { items: [{ text: 'Water the plants' }], updated: now, yesterday: { count: 0, items: [] } },
        calendar: { events: [], sent: now, stale: false }, fixed: { events: [], countdowns: [] }, weather: null, arsenal: null, bins: null,
        birthdays: { birthdays: [] }, news: { items: [] }, kitchen: null, projects: null, german: null, waiting: waitBlock(), week: sunday ? week() : null };
    },
    act({ id, action }) {
      this.posts.push(action);
      if (action === 'keep' || action === 'unflag') {
        const i = flags.findIndex((q) => q.id === id); const [q] = flags.splice(i, 1); if (action === 'unflag') gone.set(id, { flag: q });
        return { ok: true, week: week() };
      }
      if (action === 'undo' && gone.get(id) && gone.get(id).flag) { flags.push(gone.get(id).flag); gone.delete(id); return { ok: true, week: week() }; }
      if (action === 'undo') { const q = gone.get(id); if (q) { quiet.push(q); quiet.sort((a, b) => b.days - a.days); gone.delete(id); } }
      else { const i = quiet.findIndex((q) => q.id === id); const [q] = quiet.splice(i, 1); if (action !== 'delete') gone.set(id, q); }
      return { ok: true, week: week(), ...(action.startsWith('later') ? { until: '2026-10-26' } : {}) };
    },
  };
}

const browser = await chromium.launch();
async function open(viewport, { dark = false, now = SUNDAY, empty = false } = {}) {
  const w = world(now, empty);
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: viewport.width < 700, colorScheme: dark ? 'dark' : 'light' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date(now));
  // Skip the day's first-light animation, so the checks see the page at rest.
  await page.addInitScript((day) => { try { localStorage.setItem('morning.enteredOn', JSON.stringify(day)); } catch (e) {} }, now.slice(0, 10));
  await page.route('**/api/morning/**', async (r) => {
    const h = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
    if (r.request().url().endsWith('/lesson')) return r.fulfill({ json: w.lesson(r.request().postDataJSON()), headers: h });
    if (r.request().url().endsWith('/week')) return r.fulfill({ json: w.act(r.request().postDataJSON()), headers: h });
    return r.fulfill({ json: w.answer(), headers: h });
  });
  await page.route('**/api/waiting/**', async (r) => {
    const h = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
    const out = w.wait(new URL(r.request().url()).pathname, r.request().postDataJSON());
    await new Promise((ok) => setTimeout(ok, 120)); // network time, so a double tap lands while the first is out
    return r.fulfill({ status: out.status || 200, json: out.json, headers: h });
  });
  await page.route('**/site.**espn.com/**', (r) => r.abort());
  await page.goto(BASE + '?c=' + CODE);
  await page.waitForFunction(() => document.querySelector('.js-say').textContent.length > 0);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  return { page, ctx, w, errors };
}
const shown = (page, sel) => page.$eval(sel, (e) => !e.hidden && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0).catch(() => false);
const texts = (page, sel) => page.$$eval(sel, (els) => els.map((e) => e.textContent.trim()));

for (const [name, viewport, dark] of [['week-pc', { width: 1440, height: 1000 }, false], ['week-phone', { width: 390, height: 844 }, true]]) {
  const { page, ctx, w, errors } = await open(viewport, { dark });
  check(await shown(page, '#weekView') && !(await shown(page, '.cols')), name + ': Sunday opens on the Week view');
  check(await page.textContent('#wkLabel') === 'Week 42 · 12 to 18 Oct', name + ': label ' + await page.textContent('#wkLabel'));
  check(await page.textContent('.js-say') === '7 done this week. 6 things have gone quiet. 2 flagged tasks are still open.', name + ': sentence ' + await page.textContent('.js-say'));
  check((await texts(page, '#weekView .num')).join('|') === 'Your week|The mirror|Energy this week|Waiting on|What Claude learned|01 Done this week|02 Still this week|03 Gone quiet|04 New vacancies|05 Next week', name + ': Your week, the mirror, energy, waiting on, the lessons, then five cards in order');
  // 02 Still this week: the flagged tasks still open, Keep for next week or Unflag (with Undo).
  check((await texts(page, '#wkFlag .park-what')).join('|') === 'Book the flights|Call the plumber', name + ': still this week lists the flagged tasks, clean names');
  check(await page.textContent('#wkFlagNote') === '2 left', name + ': still this week says 2 left');
  await page.locator('#wkFlag').screenshot({ path: file(name + '-flag') });
  await page.click('#wkFlag [data-wk="keep"][data-id="flag00000001"]');
  await page.waitForTimeout(300);
  check((await texts(page, '#wkFlag .park-what')).join('|') === 'Call the plumber' && w.posts.at(-1) === 'keep', name + ': Keep sends keep and the row leaves');
  check(await page.textContent('#wkToast span') === 'Kept for next week.' && await page.$eval('#wkToast', (e) => !!e.closest('[aria-label="Still this week"]')), name + ': the toast says so, in this card ' + await page.textContent('#wkToast span') + ' ' + await page.$eval('#wkToast', (e) => e.parentElement.getAttribute('aria-label')));
  await page.click('#wkFlag [data-wk="unflag"]');
  await page.waitForTimeout(300);
  check(w.posts.at(-1) === 'unflag' && await page.textContent('#wkToast span') === 'Off this week.', name + ': Unflag sends unflag');
  check((await texts(page, '#wkFlag .row.empty')).join() === 'Nothing flagged is left. Flag tasks for the week in To-do.', name + ': then the card says nothing is left');
  await page.click('#wkToast button');
  await page.waitForTimeout(400);
  check(w.posts.at(-1) === 'undo' && (await texts(page, '#wkFlag .park-what')).join() === 'Call the plumber', name + ': Undo brings it back');
  w.posts.length = 0; // the checks below count from here
  // Energy this week: Mon to Sun across, morning, afternoon and evening down, then one line of facts.
  check((await texts(page, '#wkEnergy .en-day')).join() === 'Mon,Tue,Wed,Thu,Fri,Sat,Sun' && (await texts(page, '#wkEnergy .en-part')).join() === 'Morning,Afternoon,Evening', name + ': energy grid heads');
  const cells = await texts(page, '#wkEnergy .en-cell');
  check(cells.length === 21 && cells[0] === 'Normal' && cells[1] === 'Wired' && cells[4] === 'Not set' && cells[20] === 'Drained', name + ': energy cells ' + cells.join());
  check((await page.$$('#wkEnergy .en-cell .batt')).length === 19 && (await page.$$('#wkEnergy .en-none .batt')).length === 0, name + ': a battery in every set cell, none in Not set');
  const facts = (await texts(page, '#wkEnergyFacts span')).join('|');
  check(facts === 'Set 11 times|Drained most: evenings|Wired most: mornings|Normal most: afternoons', name + ': energy facts ' + facts);
  check(await page.evaluate(() => { const a = document.getElementById('wkEnergyCard').getBoundingClientRect(), v = document.getElementById('weekView').getBoundingClientRect(), g = document.getElementById('wkEnergy'); return a.width > v.width * 0.9 && g.scrollWidth <= g.clientWidth; }), name + ': the energy card spans the width, nothing cut off');
  await page.locator('#wkEnergyCard').screenshot({ path: file(name + '-energy') });
  // Waiting on: every open item oldest first (who about what, channel, days waiting, amber edge when a
  // chase is due), Answered and Snooze, and what was resolved and chased this week.
  const wrows = () => page.$$eval('#wkWait .ww', (els) => els.map((e) => [e.querySelector('.ww-what').textContent.trim(), e.querySelector('.ww-how').textContent.trim(),
    e.querySelector('.ww-days').textContent.trim(), e.classList.contains('due') ? 'due' : ''].join('|')).join(' / '));
  check(await wrows() === 'The ministry about the policy officer application|Email · chased once|14 days|due / The agency about the application|Email|13 days|due'
    + ' / The accountant about the tax overview · for Nick|Phone|3 days| / The council about the parking permit|Letter|today|', name + ': waiting rows, oldest first: ' + await wrows());
  check(await page.$$eval('#wkWait .ww', (els) => els.map((e) => getComputedStyle(e, '::before').backgroundColor).join()) === 'rgb(226, 169, 59),rgb(226, 169, 59),rgb(207, 199, 179),rgb(207, 199, 179)', name + ': amber edge only where a chase is due');
  check(await page.textContent('#wkWaitNote') === '4 open' && await page.textContent('#wkWaitFoot') === 'Resolved this week 2 · Chased this week 3', name + ': waiting note and footer: ' + await page.textContent('#wkWaitFoot'));
  check(await page.evaluate(() => { const a = document.getElementById('wkWaitCard').getBoundingClientRect(), v = document.getElementById('weekView').getBoundingClientRect(), g = document.getElementById('wkWait'); return a.width > v.width * 0.9 && g.scrollWidth <= g.clientWidth; }), name + ': the waiting card spans the width, nothing cut off');
  const wsizes = await page.$$eval('#wkWait .ww:first-child .pbtn', (b) => b.map((x) => Math.round(x.getBoundingClientRect().height)));
  check(wsizes.length === 2 && (viewport.width < 700 ? wsizes.every((h) => h >= 44) : wsizes.every((h) => h >= 34)), name + ': Answered and Snooze, heights ' + wsizes);
  await page.locator('#wkWaitCard').screenshot({ path: file(name + '-waiting') });
  // Snooze shows three choices; Cancel backs out and sends nothing.
  await page.click('#wkWait [data-ww="snooze"][data-id="wait000000000001"]');
  check((await texts(page, '#wkWait .ww-ask .pbtn')).join('|') === '3 days|1 week|2 weeks|Cancel', name + ': Snooze offers 3 days, 1 week, 2 weeks');
  await page.locator('#wkWaitCard').screenshot({ path: file(name + '-waiting-snooze') });
  await page.click('#wkWait [data-ww="cancel"]');
  check((await page.$$('#wkWait .ww-ask')).length === 0 && w.waitPosts.length === 0, name + ': Cancel backs out, nothing sent');
  // 1 week: the hub gets snooze with days 7; the row stays, open, its edge no longer amber.
  await page.click('#wkWait [data-ww="snooze"][data-id="wait000000000001"]');
  await page.click('#wkWait [data-ww="s7"][data-id="wait000000000001"]');
  await page.waitForTimeout(400);
  check(w.waitPosts.length === 1 && w.waitPosts[0].url === `/api/waiting/${CODE}/wait000000000001` && JSON.stringify(w.waitPosts[0].body) === JSON.stringify({ action: 'snooze', source: 'morning', days: 7 }),
    name + ': Snooze 1 week POSTs ' + JSON.stringify(w.waitPosts));
  check((await wrows()).startsWith('The ministry about the policy officer application|Email · chased once · next chase 25 Oct|14 days| / ') && (await page.$$('#wkWait .ww')).length === 4,
    name + ': the snoozed row stays with its next chase: ' + await wrows());
  check(await page.textContent('#wkToast span') === 'Snoozed. Next chase Sun 25 Oct.' && await page.$eval('#wkToast', (e) => !!e.closest('#wkWaitCard') && e.querySelector('button').hidden), name + ': snooze toast, no Undo, in this card');
  // Answered: resolve, once for a double tap; the row leaves and Resolved this week counts it.
  await page.evaluate(() => { const b = document.querySelector('#wkWait [data-ww="resolve"][data-id="wait000000000002"]'); b.click(); b.click(); });
  await page.waitForTimeout(400);
  check(w.waitPosts.length === 2 && w.waitPosts[1].url === `/api/waiting/${CODE}/wait000000000002` && JSON.stringify(w.waitPosts[1].body) === JSON.stringify({ action: 'resolve', source: 'morning' }),
    name + ': Answered POSTs resolve once: ' + JSON.stringify(w.waitPosts.slice(1)));
  check(!(await wrows()).includes('The agency') && await page.textContent('#wkWaitNote') === '3 open' && await page.textContent('#wkWaitFoot') === 'Resolved this week 3 · Chased this week 3'
    && await page.textContent('#wkToast span') === 'Marked answered.', name + ': the answered row leaves, resolved 3: ' + await page.textContent('#wkWaitFoot'));
  // What Claude learned: two rules to check with Keep and Drop, one kept rule under a fold.
  check(await page.textContent('#wkLessonsNote') === '2 rules to check' && (await page.$$('#wkLessons .parks .park')).length === 2, name + ': lessons shows 2 rules to check');
  check((await texts(page, '#wkLessons .park-from')).join() === 'Tidy,Desk' && (await page.textContent('#wkLessons .lesson-why')).startsWith('You undid 3'), name + ': each rule names its app and why');
  check(await page.textContent('#wkLessons .wk-more') === 'Kept rules (1)', name + ': kept rules sit under a fold');
  await page.locator('#wkLessonsCard').screenshot({ path: file(name + '-lessons') });
  await page.click('#wkLessons [data-ls="keep"][data-id="lesson000001"]');
  await page.waitForTimeout(300);
  check(await page.textContent('#lsToast span') === 'Kept. Tidy follows it from now on.' && await page.textContent('#wkLessons .wk-more') === 'Kept rules (2)', name + ': Keep moves it under the fold ' + await page.textContent('#lsToast span'));
  await page.click('#lsToast button');
  await page.waitForTimeout(300);
  check((await page.$$('#wkLessons .parks .park')).length === 2 && await page.textContent('#wkLessons .wk-more') === 'Kept rules (1)', name + ': Undo puts it back to check');
  await page.click('#wkLessons .wk-more');
  check((await texts(page, '#wkLessons .park-what')).includes('Put dentist and doctor tasks in Today.'), name + ': the fold opens the kept rules');
  await page.click('#wkLessons [data-ls="drop"][data-id="lesson000000"]');
  await page.waitForTimeout(300);
  check(await page.textContent('#lsToast span') === 'Dropped.' && !(await shown(page, '#wkLessons .wk-more')), name + ': Drop takes a kept rule out');
  check(w.lessonPosts.join() === 'keep,undo,drop', name + ': lesson posts ' + w.lessonPosts);
  check(w.posts.length === 0, name + ': lesson buttons never touch the week route');
  check((await page.textContent('#wkPara')).startsWith('You got seven things done'), name + ': Your week paragraph shows');
  check((await page.textContent('#wkMirror')).startsWith('You tend to tick off') && await page.textContent('#wkMirrorNote') === '45 days', name + ': the mirror shows its finding and day count');
  check(await shown(page, '#wkMirrorNums') && await shown(page, '#wkMirrorTry') && await shown(page, '#wkMirrorLast'), name + ': numbers, this week and last week show');
  check(await page.evaluate(() => { const a = document.getElementById('wkMirrorCard').getBoundingClientRect(), v = document.getElementById('weekView').getBoundingClientRect(); return a.width > v.width * 0.9; }), name + ': the mirror spans the full width');
  await page.locator('#wkMirrorCard').screenshot({ path: file(name + '-mirror') });
  check(await page.evaluate(() => { const a = document.getElementById('wkParaCard').getBoundingClientRect(), v = document.getElementById('weekView').getBoundingClientRect(); return a.width > v.width * 0.9; }), name + ': Your week spans the full width');
  if (viewport.width >= 1100) {
    const box = await page.$$eval('#weekView > .card:not(.card-para)', (els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
    check(box[0] === box[1] && box[2] === box[3] && box[2] > box[0], name + ': 01 and 02 left, 03 and 04 right ' + box);
  }
  check((await page.$$('#wkDone .row')).length === 5 && await page.textContent('#wkDone .wk-more') === 'Show all 7', name + ': Done shows 5 of 7');
  check((await texts(page, '#wkDone .sub-head')).join() === 'Today,Soon', name + ': Done grouped by section');
  check((await page.$$('#wkQuiet .park')).length === 5, name + ': Gone quiet shows 5 of 6');
  check((await texts(page, '#wkQuiet .park-age'))[0] === '31 days', name + ': oldest first, 31 days');
  check((await page.$$('#wkNext .ev')).length === 5 && await page.textContent('#wkNext .wk-more') === 'Show all 6', name + ': Next week shows 5 of 6');
  check(await page.getAttribute('#wkVac a', 'target') === '_blank' && await page.getAttribute('#wkVac a', 'href') === 'https://jobs.example/1', name + ': vacancies link out');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ': no sideways scroll');
  const sizes = await page.$$eval('#wkQuiet .park:first-child .pbtn', (b) => b.map((x) => Math.round(x.getBoundingClientRect().height)));
  check(viewport.width < 700 ? sizes.every((h) => h >= 44) : sizes.every((h) => h >= 34), name + ': button heights ' + sizes);
  console.log(name, 'page height', await page.evaluate(() => document.documentElement.scrollHeight));
  await page.screenshot({ path: file(name), fullPage: true });

  await page.click('#wkDone .wk-more');
  check((await page.$$('#wkDone .row')).length === 7 && await page.textContent('#wkDone .wk-more') === 'Show fewer', name + ': Show all opens all 7');
  await page.click('#wkDone .wk-more');

  // Delete asks once; Keep backs out; Delete removes it with no Undo.
  await page.click('#wkQuiet .park:first-child [data-wk="delete"]');
  check(await page.textContent('#wkQuiet .park:first-child .wk-ask span') === 'Delete for good?', name + ': Delete asks first');
  await page.locator('#wkQuiet .park:first-child').screenshot({ path: file(name + '-ask') });
  await page.click('#wkQuiet .park:first-child [data-wk="cancel"]');
  check((await page.$$('#wkQuiet .park:first-child .park-btns .pbtn')).length === 3 && w.posts.length === 0, name + ': Keep backs out, nothing sent');
  await page.click('#wkQuiet .park:first-child [data-wk="delete"]');
  await page.click('#wkQuiet .park:first-child [data-wk="delete-yes"]');
  await page.waitForTimeout(300);
  check(!(await texts(page, '#wkQuiet .park-what')).includes('Cancel the old phone contract'), name + ': deleted row gone');
  check(await page.textContent('#wkToast span') === 'Deleted.' && await page.$eval('#wkToast button', (b) => b.hidden), name + ': "Deleted." with no Undo');

  // New date: three choices, the toast names the Monday, Undo brings it back.
  await page.click('#wkQuiet .park:first-child [data-wk="date"]');
  check((await texts(page, '#wkQuiet .park:first-child .wk-ask .pbtn')).join('|') === 'Next week|In 2 weeks|In a month|Cancel', name + ': New date offers three dates');
  await page.locator('#wkQuiet .park:first-child').screenshot({ path: file(name + '-date') });
  await page.click('#wkQuiet .park:first-child [data-wk="later1"]');
  await page.waitForTimeout(300);
  check(await page.textContent('#wkToast span') === 'Back in Today on Mon 26 Oct.', name + ': toast ' + await page.textContent('#wkToast span'));
  check(!(await texts(page, '#wkQuiet .park-what')).includes('Find a tutor for the evening class'), name + ': dated row gone');
  await page.click('#wkToast button');
  await page.waitForTimeout(300);
  check((await texts(page, '#wkQuiet .park-what')).includes('Find a tutor for the evening class'), name + ': Undo brings it back');

  // Do this week.
  await page.click('#wkQuiet .park:first-child [data-wk="soon"]');
  await page.waitForTimeout(300);
  check(await page.textContent('#wkToast span') === 'Moved to the top of Soon.', name + ': toast after Do this week');
  check(w.posts.join() === 'delete,later1,undo,soon', name + ': Worker got ' + w.posts);

  // The switch: Today shows the usual cards, Week comes back.
  await page.click('#viewSwitch [data-view="today"]');
  check(await shown(page, '.cols') && !(await shown(page, '#weekView')) && await shown(page, '#viewSwitch'), name + ': Today shows the usual page, switch stays');
  await page.click('#viewSwitch [data-view="week"]');
  check(await shown(page, '#weekView'), name + ': Week comes back');
  check(errors.length === 0, name + ': no page errors ' + errors.join('; '));
  await ctx.close();
}

{
  const { page, ctx, errors } = await open({ width: 390, height: 844 }, { empty: true });
  check((await texts(page, '#weekView .row.empty')).join('|') === 'Nothing ticked off this week. Next week is a fresh one.|Nothing flagged is left. Flag tasks for the week in To-do.|Nothing has gone quiet. Every open task moved in the last two weeks.|No new vacancies this week.|Nothing in Day for next week yet.', 'empty: every card says so in a line');
  check(await page.textContent('.js-say') === 'A quiet week. Nothing to clear up.', 'empty: sentence');
  check(!(await shown(page, '#wkParaCard')), 'empty: no Your week card before it is written');
  check(!(await shown(page, '#wkMirrorCard')), 'empty: no mirror card before it is written');
  check(!(await shown(page, '#wkLessonsCard')), 'empty: no lessons card without rules');
  check(!(await shown(page, '#wkEnergyCard')), 'empty: no energy card when nothing was set');
  check(!(await shown(page, '#wkWaitCard')), 'empty: no waiting card with nothing open and nothing resolved or chased');
  await page.screenshot({ path: file('week-empty-phone'), fullPage: true });
  check(errors.length === 0, 'empty: no page errors ' + errors.join('; '));
  await ctx.close();
}
{
  const { page, ctx, errors } = await open({ width: 1440, height: 1000 }, { now: MONDAY });
  check(!(await shown(page, '#viewSwitch')) && !(await shown(page, '#weekView')) && await shown(page, '.cols'), 'Monday: no switch, the usual page');
  check(errors.length === 0, 'Monday: no page errors ' + errors.join('; '));
  await ctx.close();
}
await browser.close();
console.log(`${passes} of ${passes + fails} week checks pass`);
if (failed) process.exit(1);
console.log('all week checks pass');
