// Skills (morning/skills/) against a mocked paul-hub /api/skills/:code that keeps its own state the way
// src/skills.js does: the three columns on the PC (roles you track with Past folded, the open role, gaps
// across roles with the closed ones last), a role's groups, chips, evidence and nice to have, a role being
// read and the 5 s look that stops when it is read (and after 3 minutes), needs the text, could not be read
// and Try again, Past and Back to active, Remove with its confirm step, a gap's plan (add, Make a task with
// its body, remove), Claude's options (a slow answer, the wait, Use as a step), I have this now with a note
// (the roles move to Have) and Reopen, Your side (the lines, a paste, a file, the counts), Paste a job and
// its checks, ?r= and ?g=, an empty page, an empty side, no code, the hub away and Retry, the phone at 390
// and 375 (tabs, full screen, sheets, 44 px, nothing sideways), Morning's link, the service worker and
// nothing in the console. Every vacancy and every line on "your side" here is made up.
//   PORT=8196 npm run serve, then: APP=http://localhost:8196/morning/ npm run skills-check
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CODE = 'abcdefgh23456789';
const BASE = process.env.APP || 'http://localhost:8080/morning/';
const OUT = new URL('../verify-shots/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const file = (n) => fileURLToPath(new URL(n + '.png', OUT));

let passes = 0, fails = 0;
const check = (ok, what) => { if (!ok) { fails++; console.error('FAIL:', what); } else { passes++; console.log('ok:', what); } };

/* ---------- The made-up side and the made-up vacancies ---------- */
const TODAY = '2026-10-22';
const SIDE = [
  ['l1', 'Made-up line A: four years of policy work at an example ministry'],
  ['l2', 'Made-up line B: a security studies course at an example school'],
  ['l3', 'Made-up line C: led talks with example partners abroad'],
  ['l4', 'Made-up line D: Dutch and English, both fluent'],
  ['l5', 'Made-up line E: a master’s degree from an example university'],
  ['l6', 'Made-up line F: an example volunteer role'],
  ['l7', 'Made-up line G: an example writing sample'],
  ['l8', 'Made-up line H: an example team project'],
  ['l9', 'Made-up line I: an example award'],
  ['l10', 'Made-up line J: an example hobby'],
].map(([id, text]) => ({ id, text, source: 'cv', gap: null }));
const CLOSED_NOTE = 'Made-up note: finished an example course in May';
const LABEL = {
  'intl-policy': ['Three years of policy work in an international setting', 'experience'],
  'defence-sector': ['Defence or security sector experience', 'experience'],
  procurement: ['Experience with public procurement', 'experience'],
  negotiation: ['Negotiating with foreign counterparts', 'skill'],
  'programme-mgmt': ['Programme management', 'skill'],
  'eu-policy': ['Knowledge of the EU policy process', 'skill'],
  spreadsheets: ['Advanced spreadsheet skills', 'skill'],
  'crisis-writing': ['Writing for a crisis team', 'skill'],
  'dutch-english': ['Dutch C1 and English C1', 'language'],
  'french-b2': ['French B2', 'language'],
  'screening-a': ['Screening level A', 'clearance'],
  masters: ['A master’s degree', 'qualification'],
  'programme-cert': ['A programme management certificate', 'qualification'],
};
// A requirement and how the made-up side would match it: [key, must, status, line, why].
const Q = (key, must, status, line = null, why = null) => ({ key, label: LABEL[key][0], kind: LABEL[key][1], must, base: { status, line, why } });
const id12 = (k) => k.padEnd(12, '0');
const ROLE = (k, title, org, deadline, source, reqs, extra = {}) => ({
  id: id12(k), title, org, link: source === 'digest' ? `https://example.org/vacancies/${k}` : null, deadline, source, taskId: source === 'digest' ? 'task' + k : null,
  state: 'ready', error: null, createdAt: '2026-10-20T09:00:00.000Z', readAt: '2026-10-20T09:01:00.000Z', reqs, readIn: 0, pending: null, ...extra,
});
const ROLES = [
  ROLE('r1', 'Policy Officer, Example Directorate', 'Ministry of Examples', '2026-11-04', 'digest', [
    Q('intl-policy', true, 'have', 'l1'), Q('defence-sector', true, 'partly', 'l2', 'The course is about security; there is no defence work in it.'),
    Q('negotiation', true, 'have', 'l3'), Q('programme-mgmt', false, 'missing'), Q('spreadsheets', false, 'missing'),
    Q('dutch-english', true, 'have', 'l4'), Q('french-b2', true, 'missing'), Q('screening-a', true, 'missing'), Q('masters', true, 'have', 'l5'),
  ]),
  ROLE('r2', 'Project Officer, Example Capabilities', 'Example Defence Agency', '2026-11-18', 'digest', [
    Q('defence-sector', true, 'partly', 'l2'), Q('procurement', true, 'partly', 'l1', 'Policy work, not buying.'), Q('negotiation', true, 'have', 'l3'),
    Q('eu-policy', true, 'partly', 'l1'), Q('french-b2', true, 'missing'), Q('screening-a', true, 'missing'),
  ]),
  ROLE('r3', 'Economic Security Advisor', 'Example Economic Affairs', null, 'paste', [
    Q('intl-policy', true, 'have', 'l1'), Q('eu-policy', false, 'partly', 'l1'), Q('programme-cert', true, 'missing'), Q('programme-mgmt', true, 'missing'),
  ]),
  ROLE('r4', 'Procurement Officer', 'Example Support Agency', '2026-12-02', 'digest', [
    Q('procurement', true, 'partly', 'l1'), Q('screening-a', true, 'missing'), Q('programme-cert', true, 'missing'), Q('dutch-english', true, 'have', 'l4'),
  ]),
  ROLE('r5', 'Analyst, Example Institute', 'Example Institute', '2026-09-30', 'digest', [Q('intl-policy', true, 'have', 'l1'), Q('french-b2', true, 'missing')], { state: 'past' }),
];
const EXTRA_ROLES = [
  ROLE('r6', 'Advisor, Example Bureau', 'Example Bureau', '2026-11-25', 'digest', [], { state: 'needs_text', readAt: null }),
  ROLE('r7', 'Researcher, Example Lab', 'Example Lab', '2026-11-28', 'digest', [], { state: 'failed', error: 'The vacancy page did not answer.', readAt: null }),
];
const NEW_REQS = () => [Q('intl-policy', true, 'have', 'l1'), Q('crisis-writing', true, 'missing'), Q('french-b2', true, 'missing')];
const OPTIONS = [
  { title: 'Ask for a briefing on the route', text: 'A made-up option: a short call to learn what the step involves.' },
  { title: 'Find a course that ends with a test', text: 'A made-up option: something with a fixed date to work toward.' },
  { title: 'Look for a smaller first step', text: 'A made-up option: one thing that fits in an evening.' },
];
const ID = { r1: id12('r1'), r2: id12('r2'), r3: id12('r3'), r4: id12('r4'), r5: id12('r5'), r6: id12('r6'), r7: id12('r7') };
const JOB = 'A made-up vacancy for the check. ' + 'The team works on example files with example partners and writes short example notes for an example board. '.repeat(3);

/* ---------- The mocked hub ---------- */
function makeHub({ side = SIDE, roles = ROLES, extra = [], closed = true, steps = true } = {}) {
  const w = {
    side: structuredClone(side), roles: structuredClone([...roles, ...extra]), meta: {}, gets: 0, sideGets: 0, posts: [],
    status: 200, abort: false, postStatus: 0, n: 0, optDelay: 0, readAfter: 2,
  };
  const meta = (k) => (w.meta[k] ||= { steps: [], options: null, closed: null });
  if (closed && side.length) {
    w.side.push({ id: 'c1', text: CLOSED_NOTE, source: 'closed', gap: 'spreadsheets' });
    meta('spreadsheets').closed = { note: CLOSED_NOTE, at: '2026-10-01T12:00:00.000Z', line: 'c1' };
  }
  if (steps) meta('french-b2').steps.push({ id: 's1aaaaaa', text: 'Example step: book a language course', taskId: 'task9001', source: 'paul' });
  const line = (lid) => w.side.find((l) => l.id === lid);
  const match = (q) => {
    const m = w.meta[q.key];
    if (m && m.closed) { const l = line(m.closed.line); return { status: 'have', line: l, why: null }; }
    if (!w.side.some((l) => l.source === 'cv')) return { status: 'unknown', line: null, why: null };
    if ((q.base.status === 'have' || q.base.status === 'partly') && !line(q.base.line)) return { status: 'missing', line: null, why: null };
    return { status: q.base.status, line: q.base.line ? line(q.base.line) : null, why: q.base.why };
  };
  const roleView = (r) => {
    const reqs = r.reqs.map((q) => { const m = match(q); return { key: q.key, label: q.label, kind: q.kind, must: q.must, status: m.status, line: m.line ? { id: m.line.id, text: m.line.text, source: m.line.source } : null, why: m.why }; });
    const counts = { have: 0, partly: 0, missing: 0, unknown: 0 };
    for (const q of reqs) counts[q.status]++;
    const { readIn, pending, ...rest } = r;
    return { ...rest, counts, matchedAt: r.state === 'ready' ? '2026-10-22T10:00:00.000Z' : null, reqs };
  };
  const ordered = () => {
    const act = w.roles.filter((r) => r.state !== 'past').sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
    return [...act, ...w.roles.filter((r) => r.state === 'past')];
  };
  const gapView = (key) => {
    const act = w.roles.filter((r) => r.state !== 'past');
    const m = w.meta[key] || { steps: [], options: null, closed: null };
    const asking = act.filter((r) => r.reqs.some((q) => q.key === key));
    const views = asking.map((r) => r.reqs.find((q) => q.key === key)).map((q) => ({ q, m: match(q) }));
    const short = views.filter((v) => v.m.status === 'missing' || v.m.status === 'partly');
    if (!m.closed && !short.length) return null;
    const list = m.closed ? views : short;
    const label = LABEL[key] ? LABEL[key][0] : key;
    return {
      key, label, roles: (m.closed ? asking : asking.filter((r, i) => short.includes(views[i]))).map((r) => r.id),
      must: list.filter((v) => v.q.must).length, total: list.length, active: act.length,
      worst: m.closed ? 'missing' : short.some((v) => v.m.status === 'missing') ? 'missing' : 'partly',
      state: m.closed ? 'closed' : m.steps.length || m.options ? 'working' : 'open', closedNote: m.closed ? m.closed.note : null, closedAt: m.closed ? m.closed.at : null,
      steps: m.steps.map((s) => ({ ...s })), options: m.options ? m.options.map((o) => ({ ...o })) : null,
    };
  };
  const gaps = () => {
    const keys = [];
    for (const r of ordered()) for (const q of r.reqs) if (!keys.includes(q.key)) keys.push(q.key);
    for (const k of Object.keys(w.meta)) if (!keys.includes(k)) keys.push(k);
    const all = keys.map(gapView).filter(Boolean);
    const open = all.filter((g) => g.state !== 'closed').sort((a, b) => b.must - a.must || b.total - a.total);
    return [...open, ...all.filter((g) => g.state === 'closed')];
  };
  w.tick = () => {
    for (const r of w.roles) {
      if (r.state !== 'reading') continue;
      if (--r.readIn > 0) continue;
      r.state = 'ready';
      r.readAt = '2026-10-22T10:00:00.000Z';
      if (r.pending) { r.reqs = r.pending; r.pending = null; }
    }
  };
  w.answer = () => ({
    today: TODAY,
    side: { lines: w.side.length, closed: w.side.filter((l) => l.source === 'closed').length, updatedAt: w.side.length ? '2026-10-22T10:00:00.000Z' : null },
    roles: ordered().map(roleView), gaps: gaps(),
  });
  w.sideAnswer = () => ({ lines: w.side.map((l) => ({ ...l })), updatedAt: w.side.length ? '2026-10-22T10:00:00.000Z' : null });
  const bad = (error, status = 400) => ({ status, json: { error } });
  const find = (rid) => w.roles.find((r) => r.id === rid);
  const read = (r, reqs) => { r.state = 'reading'; r.error = null; r.readIn = w.readAfter; r.pending = reqs; };
  w.handle = async (parts, b) => {
    const [a0, a1, a2, a3, a4] = parts;
    if (parts.length === 1 && a0 === 'side') {
      if (typeof b.text !== 'string' || !b.text.trim()) return bad('text: paste your CV Studio blocks');
      let items;
      try {
        const j = JSON.parse(b.text);
        const list = Array.isArray(j) ? j : Array.isArray(j.blocks) ? j.blocks : null;
        if (!list) return bad('text: no blocks in that JSON');
        items = list.map((x) => [x.title, x.period, x.text].filter(Boolean).join(' · '));
      } catch (e) {
        items = b.text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
      }
      w.side = [...items.map((text, i) => ({ id: 'l' + (i + 1), text, source: 'cv', gap: null })), ...w.side.filter((l) => l.source === 'closed')];
      let rechecks = 0;
      for (const r of w.roles) if (r.state === 'ready') { read(r, null); rechecks++; }
      return { json: { lines: w.side.length, rechecks } };
    }
    if (parts.length === 1 && a0 === 'role') {
      if (typeof b.title !== 'string' || !b.title.trim()) return bad('title: required');
      if (typeof b.text !== 'string' || b.text.trim().length < 200) return bad('text: at least 200 characters');
      if (b.link != null && !/^https?:\/\//.test(b.link)) return bad('link: http or https');
      const r = ROLE('rn' + String(++w.n), b.title.trim(), b.org || null, null, 'paste', [], { id: ('rnew' + w.n).padEnd(12, '0'), link: b.link || null, createdAt: '2026-10-22T11:00:00.000Z', readAt: null });
      read(r, NEW_REQS());
      w.roles.push(r);
      return { json: { role: roleView(r) } };
    }
    if (a0 === 'role' && a1) {
      const r = find(a1);
      if (!r) return bad('no such role', 404);
      if (a2 === 'text') {
        if (r.state !== 'needs_text') return bad('not waiting for text', 409);
        if (typeof b.text !== 'string' || b.text.trim().length < 200) return bad('text: at least 200 characters');
        read(r, NEW_REQS());
        return { json: { role: roleView(r) } };
      }
      if (a2 === 'recheck') {
        if (r.state === 'reading') return bad('already reading', 409);
        read(r, r.reqs.length ? null : NEW_REQS());
        return { json: { role: roleView(r) } };
      }
      if (a2 === 'past') {
        if (typeof b.past !== 'boolean') return bad('past: true or false');
        r.state = b.past ? 'past' : 'ready';
        return { json: { role: roleView(r) } };
      }
      if (a2 === 'delete') { w.roles = w.roles.filter((x) => x !== r); return { json: { ok: true } }; }
    }
    if (a0 === 'gap' && a1) {
      const g = gapView(a1);
      if (!g && !(w.meta[a1] && w.meta[a1].closed)) return bad('no such gap', 404);
      const m = meta(a1);
      const out = (extra = {}) => ({ json: { gap: gapView(a1), ...extra } });
      if (a2 === 'step' && !a3) {
        if (typeof b.text !== 'string' || !b.text.trim()) return bad('text: write the step');
        const fromClaude = (m.options || []).some((o) => o.title === b.text.trim());
        m.steps.push({ id: ('s' + String(++w.n)).padEnd(8, 'x'), text: b.text.trim(), taskId: null, source: fromClaude ? 'claude' : 'paul' });
        return out();
      }
      if (a2 === 'step' && a3) {
        const s = m.steps.find((x) => x.id === a3);
        if (!s) return bad('no such step', 404);
        if (a4 === 'task') {
          if (!['today', 'soon'].includes(b.section) || !['wired', 'normal', 'drained'].includes(b.energy)) return bad('section: today or soon');
          if (s.taskId) return bad('a task is already in To-do', 409);
          s.taskId = 'task' + String(++w.n).padStart(8, '0');
          return out({ task: { id: s.taskId, text: s.text } });
        }
        if (a4 === 'delete') { m.steps = m.steps.filter((x) => x !== s); return out(); }
      }
      if (a2 === 'options') {
        if (w.optDelay) await new Promise((res) => setTimeout(res, w.optDelay));
        m.options = OPTIONS.map((o) => ({ ...o }));
        return out();
      }
      if (a2 === 'close') {
        if (m.closed) return bad('already closed', 409);
        if (typeof b.note !== 'string' || !b.note.trim()) return bad('note: say how');
        const lid = 'cl' + String(++w.n);
        w.side.push({ id: lid, text: b.note.trim(), source: 'closed', gap: a1 });
        m.closed = { note: b.note.trim(), at: '2026-10-22T12:00:00.000Z', line: lid };
        return out();
      }
      if (a2 === 'reopen') {
        if (!m.closed) return bad('already open', 409);
        w.side = w.side.filter((l) => l.id !== m.closed.line);
        m.closed = null;
        return out();
      }
    }
    return bad('not found', 404);
  };
  return w;
}

/* ---------- The page ---------- */
const browser = await chromium.launch();
const H = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
async function open(viewport, { hub = makeHub(), code = CODE, query = '', clock = false } = {}) {
  const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 700 });
  const page = await ctx.newPage();
  const errors = [], logs = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => logs.push(m.text()));
  if (clock) await page.clock.install({ time: new Date('2026-10-22T10:00:00Z') });
  await page.route('**/api/skills/**', async (r) => {
    const q = r.request();
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: H });
    if (hub.abort) return r.abort();
    const parts = new URL(q.url()).pathname.split('/').slice(4);
    if (q.method() === 'GET') {
      if (hub.status !== 200) return r.fulfill({ status: hub.status, json: { error: 'mocked' }, headers: H });
      if (parts[0] === 'side') { hub.sideGets++; return r.fulfill({ json: hub.sideAnswer(), headers: H }); }
      hub.gets++;
      hub.tick();
      return r.fulfill({ json: hub.answer(), headers: H });
    }
    const body = q.postDataJSON();
    hub.posts.push({ path: '/' + parts.join('/'), body });
    if (hub.postStatus) return r.fulfill({ status: hub.postStatus, json: { error: 'mocked' }, headers: H });
    const res = await hub.handle(parts, body || {});
    return r.fulfill({ status: res.status || 200, json: res.json, headers: H });
  });
  await page.goto(BASE + 'skills/' + (code ? '?c=' + code : '') + query);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  return { ctx, page, errors, logs, hub };
}
const noisy = (logs) => logs.filter((x) => !/Failed to load resource|net::ERR_/.test(x));
const wait = (page, ms = 150) => page.waitForTimeout(ms);
const lastPost = (hub) => hub.posts[hub.posts.length - 1];
const quiet = (o, what) => check(o.errors.length === 0 && noisy(o.logs).length === 0, what + ': nothing in the console: ' + o.errors.concat(noisy(o.logs)).join('; '));

const snap = (page) => page.evaluate(() => {
  const vis = (el) => !!el && !el.closest('[hidden]') && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
  const t = (el) => (typeof el === 'string' ? t(document.querySelector(el)) : el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
  const $ = (id) => document.getElementById(id);
  const d = $('detail'), dlg = document.querySelector('dialog[open]'), a = document.activeElement;
  const chip = (el) => (el ? { text: t(el), cls: el.className.replace('st ', '').replace(' st-s', ''), bg: getComputedStyle(el).backgroundColor, ink: getComputedStyle(el).color } : null);
  return {
    title: document.title, h1: t('h1'), back: $('back').getAttribute('href'),
    app: vis($('app')), nocode: vis($('nocode')), sideLine: t('#sideLine'), sideEmpty: $('sideLine').classList.contains('is-empty'),
    status: vis($('status')) ? t('#status') : '', away: vis($('away')) ? t('#away p') : '',
    tabs: vis($('tabs')) ? [...document.querySelectorAll('.tab')].map((b) => ({ text: t(b), sel: b.getAttribute('aria-selected') })) : null,
    cols: Object.fromEntries(['roles', 'detail', 'gaps'].map((k) => [k, vis($(k)) ? box($(k)) : null])),
    rolesH: vis($('rolesH')) ? t('#rolesH') : '',
    roles: [...document.querySelectorAll('#rolesBody .rr')].map((b) => ({
      id: b.dataset.role, title: t(b.querySelector('.rr-t')), sub: t(b.querySelector('.rr-s')), state: t(b.querySelector('.rr-st')), fit: t(b.querySelector('.fit-t')),
      cur: b.getAttribute('aria-current') === 'true', past: !!b.closest('#pastList'), vis: vis(b),
    })),
    pastTog: $('pastTog') ? { text: t('#pastTog'), exp: $('pastTog').getAttribute('aria-expanded') } : null,
    rolesNone: t(document.querySelector('#rolesBody .d-empty p')),
    gaps: [...document.querySelectorAll('#gapsBody .gr')].map((b) => ({
      key: b.dataset.gap, n: t(b.querySelector('.gr-n')), label: t(b.querySelector('.gr-l')), chip: chip(b.querySelector('.st')), sub: t(b.querySelector('.gr-s')),
      cur: b.getAttribute('aria-current') === 'true', closed: !!b.closest('.glist-closed'),
    })),
    gh: [...document.querySelectorAll('#gapsBody .gh')].map(t), gapsNone: document.querySelector('#gapsBody .none') ? document.querySelector('#gapsBody .none').innerText.replace(/\s+/g, ' ').trim() : '', gapsSub: vis($('gapsSub')) ? t('#gapsSub') : '',
    d: vis(d) ? {
      ...box(d), full: d.classList.contains('is-full'), h2: t('#detailH'), sub: t(d.querySelector('.d-sub')), links: [...d.querySelectorAll('.d-sub a')].map((x) => [t(x), x.getAttribute('href'), x.target]),
      fit: t(d.querySelector('.d-head .fit-t')), back: vis(d.querySelector('.d-back')) ? t(d.querySelector('.d-back')) : '',
      kinds: [...d.querySelectorAll('.kind-h')].map(t),
      reqs: [...d.querySelectorAll('.rq')].map((li) => ({ label: t(li.querySelector('.rq-l')).replace(/ · nice to have$/, ''), nice: !!li.querySelector('.nice'), chip: chip(li.querySelector('.st')), ev: t(li.querySelector('.rq-e')) })),
      boxes: [...d.querySelectorAll('.box')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()), err: t(d.querySelector('.err')), sideNote: t(d.querySelector('.side-note span')), empty: t(d.querySelector('.d-empty p')),
      menu: vis($('roleMenu')) ? [...document.querySelectorAll('#roleMenu button')].map((b) => t(b) + (b.disabled ? '(off)' : '')) : null, menuExp: $('menuBtn') ? $('menuBtn').getAttribute('aria-expanded') : '',
      rm: vis(d.querySelector('.rm')) ? t(d.querySelector('.rm p')) : '', pastBox: !!d.querySelector('.reqs-past'),
      chip: chip(d.querySelector('.d-head > .st')),
      groles: [...d.querySelectorAll('.grole')].map((b) => ({ id: b.dataset.role, title: t(b.querySelector('.grole-t')), sub: t(b.querySelector('.grole-s')), chip: t(b.querySelector('.st')) })),
      steps: [...d.querySelectorAll('.step')].map((li) => ({ text: t(li.querySelector('.step-t')), task: t(li.querySelector('.step-task')), href: li.querySelector('.step-task') ? li.querySelector('.step-task').getAttribute('href') : '', make: !!li.querySelector('[data-step-task]'), del: !!li.querySelector('[data-step-del]') })),
      stepsNone: t(d.querySelector('.steps-none')), stepIn: $('stepIn') ? $('stepIn').value : null,
      thinking: vis(d.querySelector('.thinking')) ? t(d.querySelector('.thinking')) : '',
      opts: [...d.querySelectorAll('.opt')].map((o) => ({ title: t(o.querySelector('.opt-t')), used: !!o.querySelector('.opt-used'), btn: !!o.querySelector('[data-use]') })),
      acts: [...d.querySelectorAll('.g-acts .btn')].map((b) => t(b) + (b.classList.contains('btn-go') ? '*' : '') + (b.disabled ? '(off)' : '')),
      note: t(d.querySelector('.closed-box')), rtCount: t('#rtCount'),
    } : null,
    dialog: dlg ? { id: dlg.id, ...box(dlg) } : null,
    toast: vis($('toast')) ? t('#toast') : '',
    focus: a ? a.id || a.dataset.role || a.dataset.gap || a.dataset.act || a.dataset.stepTask || a.dataset.taskOf || a.dataset.use || a.className || a.tagName : '',
    url: location.search,
    targets: [...document.querySelectorAll('a, button, input, select, textarea')].filter(vis).filter((el) => !el.closest('dialog:not([open])') && !(dlg && !el.closest('dialog[open]')) && !el.closest('[inert]')).map((el) => {
      const r = el.getBoundingClientRect();
      return { what: el.id || el.dataset.role || el.dataset.gap || el.dataset.act || el.getAttribute('aria-label') || el.textContent.trim().slice(0, 30) || el.tagName, w: Math.round(r.width), h: Math.round(r.height), inline: !!el.closest('.d-sub, .box-s') };
    }),
    overflow: document.documentElement.scrollWidth > innerWidth,
  };
});
const small = (s) => s.targets.filter((x) => x.h < 44 || (!x.inline && x.w < 44)).map((x) => `${x.what} ${x.w}x${x.h}`);
const CHIP = { have: 'rgb(220, 235, 221)', partly: 'rgb(246, 231, 200)', missing: 'rgb(247, 218, 219)' };
const near = (a, b, m = 2) => Math.abs(a - b) <= m;
const PC = { width: 1440, height: 900 };

/* ---------- 1. The PC: three columns ---------- */
{
  const o = await open(PC);
  const { page } = o;
  const s = await snap(page);
  check(s.title === 'Skills' && s.h1 === 'Skills' && s.back === '../?c=' + CODE, 'pc: the title and the way back with the code');
  check(s.sideLine === 'Your side: 11 lines · updated 22 Oct' && !s.sideEmpty, 'pc: Your side: 11 lines · updated 22 Oct: ' + s.sideLine);
  check(!s.tabs && s.cols.roles && s.cols.detail && s.cols.gaps, 'pc: three columns, no tabs');
  const { roles: L, detail: C, gaps: R } = s.cols;
  check(near(L.x, 24) && near(L.w, 330, 3) && near(C.x, 370, 3) && near(C.w, 640, 4) && near(R.x + R.w, 1416, 3) && near(R.w, 382, 4) && near(L.y, 92, 4) && near(C.y, L.y) && near(R.y, L.y) && near(L.y + L.h, 876, 3),
    'pc: the columns where the mockup has them: ' + JSON.stringify(s.cols));
  check(s.rolesH === 'Roles you track · 4', 'pc: Roles you track · 4: ' + s.rolesH);
  const act = s.roles.filter((r) => !r.past);
  check(act.map((r) => r.id).join() === [ID.r1, ID.r2, ID.r4, ID.r3].join() && act[0].cur && act.filter((r) => r.cur).length === 1, 'pc: active roles by closing date, the first one open');
  check(act[0].sub === 'Ministry of Examples · Closes 4 Nov' && act[3].sub === 'Example Economic Affairs · Pasted 20 Oct' && act[0].fit === '5 have · 1 partly · 3 missing' && act[1].fit === '1 have · 3 partly · 2 missing',
    'pc: a role row: organisation, closing or pasted date, the fit: ' + JSON.stringify(act.map((r) => [r.sub, r.fit])));
  check(s.pastTog && s.pastTog.text === 'Past · 1' && s.pastTog.exp === 'false' && s.roles.filter((r) => r.past).every((r) => !r.vis), 'pc: Past · 1, folded');
  const d = s.d;
  check(d && !d.full && d.h2 === 'Policy Officer, Example Directorate' && d.sub === 'Ministry of Examples · closes 4 Nov · from Defence digest · vacancy ›' &&
    d.links.length === 1 && d.links[0][1] === `https://example.org/vacancies/r1` && d.links[0][2] === '_blank' && d.fit === '5 have · 1 partly · 3 missing', 'pc: the open role: title, organisation, closes, from Defence digest, the vacancy link, the fit: ' + (d && d.sub));
  check(d.kinds.join() === 'Experience,Skills,Languages,Clearances,Qualifications', 'pc: requirements grouped by kind in order: ' + d.kinds);
  const rq = Object.fromEntries(d.reqs.map((q) => [q.label, q]));
  check(rq['Three years of policy work in an international setting'].chip.text === '●Have' && rq['Three years of policy work in an international setting'].ev === 'From your side: “Made-up line A: four years of policy work at an example ministry”',
    'pc: Have with its line from your side: ' + rq['Three years of policy work in an international setting'].ev);
  check(rq['Defence or security sector experience'].chip.text === '◐Partly' && rq['Defence or security sector experience'].ev === 'From your side: “Made-up line B: a security studies course at an example school”The course is about security; there is no defence work in it.',
    'pc: Partly with its line and why: ' + rq['Defence or security sector experience'].ev);
  check(rq['French B2'].chip.text === '○Missing' && rq['French B2'].ev === 'Not on your side · also in 1 other role' && rq['Screening level A'].ev === 'Not on your side · also in 2 other roles',
    'pc: Missing, Not on your side, also in N other roles: ' + [rq['French B2'].ev, rq['Screening level A'].ev]);
  check(rq['Programme management'].nice && !rq['French B2'].nice && rq['Programme management'].ev === 'Not on your side · also in 1 other role', 'pc: nice to have on the nice-to-haves only');
  check(rq['Advanced spreadsheet skills'].chip.text === '●Have' && rq['Advanced spreadsheet skills'].ev === `From your side: “${CLOSED_NOTE}”`, 'pc: a closed gap counts like a line: ' + rq['Advanced spreadsheet skills'].ev);
  check(['have', 'partly', 'missing'].every((k) => d.reqs.filter((q) => q.chip.cls === 'st-' + k).every((q) => q.chip.bg === CHIP[k])), 'pc: each chip in its colour');
  check(s.gaps.filter((g) => !g.closed).map((g) => g.key).join() === 'screening-a,defence-sector,french-b2,procurement,programme-cert,programme-mgmt,eu-policy', 'pc: gaps ranked as the hub sends them: ' + s.gaps.map((g) => g.key));
  const gp = Object.fromEntries(s.gaps.map((g) => [g.key, g]));
  check(gp['screening-a'].n === '1' && gp['screening-a'].sub === 'In 3 of 4 roles' && gp['screening-a'].chip.text === '○Missing' && gp['defence-sector'].chip.text === '◐Partly' && gp['eu-policy'].n === '7',
    'pc: a gap row: number, label, worst chip, In N of M roles');
  check(gp['french-b2'].sub === 'In 2 of 4 roles · Plan: Example step: book a language course · task in To-do', 'pc: the first plan step under a gap: ' + gp['french-b2'].sub);
  check(s.gh.join() === 'Closed · 1' && gp.spreadsheets.closed && !gp.spreadsheets.n && gp.spreadsheets.chip.text === '●Closed' && gp.spreadsheets.sub === `Closed 1 Oct · “${CLOSED_NOTE}”`, 'pc: closed gaps in a Closed group at the bottom: ' + gp.spreadsheets.sub);
  check(!s.overflow && !small(s).length, 'pc: nothing sideways, 44 px: ' + small(s));
  await page.screenshot({ path: file('skills-pc') });
  check(o.hub.posts.length === 0 && o.hub.gets === 1, 'pc: one read, nothing sent');
  quiet(o, 'pc');
  await o.ctx.close();
}

{
  // The smallest PC width: still three columns, nothing sideways.
  const o = await open({ width: 1100, height: 760 });
  const s = await snap(o.page);
  check(s.cols.roles && s.cols.detail && s.cols.gaps && s.cols.detail.x > s.cols.roles.x + s.cols.roles.w && s.cols.gaps.x > s.cols.detail.x + s.cols.detail.w && !s.overflow && !small(s).length, 'pc 1100: three columns, nothing sideways, 44 px: ' + small(s));
  await o.page.screenshot({ path: file('skills-pc-1100') });
  await o.ctx.close();
}

/* ---------- 2. Picking a role and a gap; ?r= and ?g= ---------- */
{
  const o = await open(PC);
  const { page } = o;
  await page.click(`#roles [data-role="${ID.r2}"]`);
  await wait(page);
  let s = await snap(page);
  check(s.d.h2 === 'Project Officer, Example Capabilities' && s.roles.find((r) => r.id === ID.r2).cur && s.url.includes('r=' + ID.r2) && s.focus === 'detailH', 'pick: a role opens in the middle, with ?r= and the focus on its title');
  await page.click('#gaps [data-gap="french-b2"]');
  await wait(page);
  s = await snap(page);
  check(s.d.h2 === 'French B2' && s.d.sub === 'In 2 of 4 roles · a must-have in 2' && s.d.chip.text === '○Missing' && s.gaps.find((g) => g.key === 'french-b2').cur && !s.roles.some((r) => r.cur) && /g=french-b2/.test(s.url) && !/r=/.test(s.url),
    'pick: a gap opens in the middle with ?g=: ' + s.d.sub);
  check(s.d.groles.map((r) => r.id).join() === [ID.r1, ID.r2].join() && s.d.groles.every((r) => r.chip === '○Missing'), 'gap: the roles that ask for it, each with its chip');
  check(s.d.steps.length === 1 && s.d.steps[0].task === 'Task in To-do' && s.d.steps[0].href === '../../todo/?c=' + CODE && !s.d.steps[0].make, 'gap: a step that is a task links to To-do: ' + s.d.steps[0].href);
  check(s.d.acts.join() === 'Ask for options,I have this now*' && !s.d.opts.length && !s.d.thinking, 'gap: Ask for options and I have this now');
  await page.screenshot({ path: file('skills-pc-gap') });
  await page.click(`#detail [data-role="${ID.r1}"]`);
  await wait(page);
  s = await snap(page);
  check(s.d.h2 === 'Policy Officer, Example Directorate' && s.roles.find((r) => r.id === ID.r1).cur && s.url.includes('r=' + ID.r1), 'gap: tapping a role opens it');
  await o.ctx.close();
  // ?r= and ?g= open them; an unknown one says so.
  let p = await open(PC, { query: '&r=' + ID.r4 });
  s = await snap(p.page);
  check(s.d.h2 === 'Procurement Officer' && s.roles.find((r) => r.id === ID.r4).cur && s.focus === 'detailH', '?r= opens that role');
  await p.ctx.close();
  p = await open(PC, { query: '&g=programme-cert' });
  s = await snap(p.page);
  check(s.d.h2 === 'A programme management certificate' && s.gaps.find((g) => g.key === 'programme-cert').cur, '?g= opens that gap');
  await p.ctx.close();
  p = await open(PC, { query: '&r=' + ID.r5 });
  s = await snap(p.page);
  check(s.d.h2 === 'Analyst, Example Institute' && s.pastTog.exp === 'true' && s.roles.find((r) => r.id === ID.r5).cur && s.roles.find((r) => r.id === ID.r5).vis, '?r= on a past role opens Past');
  await p.ctx.close();
  p = await open(PC, { query: '&r=zzzzzzzzzzzz' });
  s = await snap(p.page);
  check(s.toast === 'That role is not tracked any more.' && s.url === '?c=' + CODE && s.d.h2 === 'Policy Officer, Example Directorate', '?r= of a role that is gone: a note, the address cleaned: ' + s.url);
  await p.ctx.close();
  p = await open(PC, { query: '&g=no-such-gap' });
  s = await snap(p.page);
  check(s.toast === 'That gap is not there any more.' && s.url === '?c=' + CODE, '?g= of a gap that is gone: a note');
  quiet(p, '?r= and ?g=');
  await p.ctx.close();
}

/* ---------- 3. A gap's plan: add, Make a task, remove ---------- */
{
  const o = await open(PC, { query: '&g=programme-cert' });
  const { page, hub } = o;
  let s = await snap(page);
  check(s.d.stepsNone === 'No steps yet. Write one, or ask Claude for options.' && s.d.stepIn === '', 'plan: none yet');
  await page.click('#stepIn');
  await page.keyboard.press('Enter');
  await wait(page);
  check(hub.posts.length === 0, 'plan: an empty step sends nothing');
  await page.fill('#stepIn', 'Example step: ask about an evening course');
  await page.keyboard.press('Enter');
  await wait(page, 250);
  s = await snap(page);
  check(lastPost(hub).path === '/gap/programme-cert/step' && lastPost(hub).body.text === 'Example step: ask about an evening course' && s.d.steps.length === 1 && s.d.steps[0].make && s.d.stepIn === '' && s.focus === 'stepIn',
    'plan: a step is added with the body { text }, the box empties, the focus stays: ' + JSON.stringify(lastPost(hub)));
  check(s.gaps.find((g) => g.key === 'programme-cert').sub === 'In 2 of 4 roles · Plan: Example step: ask about an evening course', 'plan: the gap row shows the first step');
  // A draft survives a read.
  await page.fill('#stepIn', 'Half a step');
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await wait(page, 300);
  s = await snap(page);
  check(s.d.stepIn === 'Half a step' && s.focus === 'stepIn', 'plan: what is typed survives a read');
  await page.fill('#stepIn', '');
  await page.click('[data-step-task]');
  await wait(page);
  s = await snap(page);
  const tk = await page.evaluate(() => ({ text: document.getElementById('taskText').textContent, pressed: [...document.querySelectorAll('#task .chip[aria-pressed="true"]')].map((b) => b.textContent) }));
  check(s.dialog && s.dialog.id === 'task' && tk.text === 'Example step: ask about an evening course' && tk.pressed.join() === 'Soon,Normal' && s.focus === 'taskGo', 'Make a task: the sheet with the step, Soon and Normal picked');
  await page.keyboard.press('Escape');
  await wait(page);
  s = await snap(page);
  check(!s.dialog && s.focus.startsWith('s') && hub.posts.length === 1, 'Make a task: Escape closes it, the focus back on Make a task, nothing sent: ' + s.focus);
  await page.click('[data-step-task]');
  await wait(page);
  await page.click('#task .chip[data-v="today"]');
  await page.click('#task .chip[data-v="drained"]');
  await page.click('#taskGo');
  await wait(page, 250);
  s = await snap(page);
  const tp = lastPost(hub);
  check(/^\/gap\/programme-cert\/step\/[^/]+\/task$/.test(tp.path) && JSON.stringify(tp.body) === '{"section":"today","energy":"drained"}', 'Make a task: the body is { section, energy }: ' + JSON.stringify(tp));
  check(!s.dialog && s.d.steps[0].task === 'Task in To-do' && !s.d.steps[0].make && s.toast === 'Example step: ask about an evening course is in To-do · Today' && s.focus === tp.path.split('/')[4],
    'Make a task: Task in To-do, the toast, the focus on the link: ' + [s.toast, s.focus]);
  check(s.gaps.find((g) => g.key === 'programme-cert').sub.endsWith('· task in To-do'), 'Make a task: the gap row says task in To-do');
  await page.screenshot({ path: file('skills-pc-plan') });
  await page.click('[data-step-del]');
  await wait(page, 250);
  s = await snap(page);
  check(/\/step\/[^/]+\/delete$/.test(lastPost(hub).path) && !s.d.steps.length && s.focus === 'stepIn', 'plan: × removes the step, the focus back in the box');
  quiet(o, 'plan');
  await o.ctx.close();
}

/* ---------- 4. Claude's options: slow, the wait, Use as a step ---------- */
{
  const hub = makeHub();
  hub.optDelay = 2500;
  const o = await open(PC, { hub, query: '&g=defence-sector' });
  const { page } = o;
  await page.click('#detail [data-act="options"]');
  await wait(page, 400);
  let s = await snap(page);
  check(s.d.thinking === 'Claude is looking for options. It can take up to 30 seconds.' && s.d.acts[0] === 'Ask for options(off)' && lastPost(hub).path === '/gap/defence-sector/options', 'options: the wait while Claude thinks, the button off');
  await page.screenshot({ path: file('skills-pc-thinking') });
  await page.click('#detail [data-act="options"]', { force: true }).catch(() => {});
  await wait(page, 2700);
  s = await snap(page);
  check(hub.posts.filter((p) => p.path.endsWith('/options')).length === 1, 'options: asked once only');
  check(!s.d.thinking && s.d.opts.length === 3 && s.d.opts.every((x) => x.btn) && s.d.acts[0] === 'Ask for new options' && s.focus === '0', 'options: three options, each with Use as a step, the focus on the first: ' + s.focus);
  await page.screenshot({ path: file('skills-pc-options') });
  await page.click('#detail [data-use="1"]');
  await wait(page, 250);
  s = await snap(page);
  check(lastPost(hub).path === '/gap/defence-sector/step' && lastPost(hub).body.text === OPTIONS[1].title && s.d.opts[1].used && !s.d.opts[1].btn && s.d.steps[0].text === OPTIONS[1].title + ' · from Claude', 'options: Use as a step adds it, marked from Claude: ' + JSON.stringify(s.d.steps));
  check(s.focus === '2', 'options: the focus moves to the next option: ' + s.focus);
  quiet(o, 'options');
  await o.ctx.close();
  // A failed ask says so and leaves the button on.
  const h2 = makeHub();
  const p = await open(PC, { hub: h2, query: '&g=defence-sector' });
  h2.postStatus = 503;
  await p.page.click('#detail [data-act="options"]');
  await wait(p.page, 300);
  s = await snap(p.page);
  check(s.d.err === 'The hub cannot ask Claude right now. Try again later.' && s.d.acts[0] === 'Ask for options' && !s.d.thinking, 'options: a 503 in plain words: ' + s.d.err);
  await p.ctx.close();
}

/* ---------- 5. I have this now, with a note, and Reopen ---------- */
{
  const o = await open(PC, { query: '&g=french-b2' });
  const { page, hub } = o;
  await page.click('#detail [data-act="close"]');
  await wait(page);
  let s = await snap(page);
  const cd = await page.evaluate(() => ({ h: document.getElementById('closeH').textContent, hint: document.getElementById('closeHint').textContent, moves: [...document.querySelectorAll('#closeMoves li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim()) }));
  check(s.dialog.id === 'close' && cd.h === 'I have this now: French B2' && s.focus === 'closeNote', 'close: the sheet, the focus in How, in your words');
  check(cd.moves.join(' | ') === 'Policy Officer, Example Directorate: ○Missing→●Have | Project Officer, Example Capabilities: ○Missing→●Have' && /every role that asked for it moves/.test(cd.hint), 'close: the roles that move from Missing to Have: ' + cd.moves.join(' | '));
  await page.click('#closeGo');
  await wait(page);
  s = await snap(page);
  const inv = await page.evaluate(() => [document.getElementById('closeNote').getAttribute('aria-invalid'), document.getElementById('closeErr').textContent]);
  check(s.dialog && inv[0] === 'true' && inv[1] === 'Say how, in your words.' && hub.posts.length === 0, 'close: the note is required, nothing sent');
  await page.screenshot({ path: file('skills-pc-close') });
  await page.fill('#closeNote', 'Made-up note: passed an example exam');
  await page.click('#closeGo');
  await wait(page, 400);
  s = await snap(page);
  check(lastPost(hub).path === '/gap/french-b2/close' && lastPost(hub).body.note === 'Made-up note: passed an example exam', 'close: the body is { note }');
  check(!s.dialog && s.toast === 'French B2 is closed. 2 roles move to Have.' && s.d.chip.text === '●Closed' && /In your words: “Made-up note: passed an example exam”/.test(s.d.note) && /Reopen/.test(s.d.note) && s.focus === 'detailH',
    'close: the gap shows your words and Reopen: ' + s.d.note);
  check(s.gaps.find((g) => g.key === 'french-b2').closed && s.gh.join() === 'Closed · 2' && s.gaps.find((g) => g.key === 'procurement').n === '3' && s.sideLine.startsWith('Your side: 12 lines'), 'close: French B2 in Closed, the rest numbered again, the side one line longer');
  check(s.d.groles.every((r) => r.chip === '●Have'), 'close: the roles that asked for it are Have now');
  await page.click(`#detail [data-role="${ID.r1}"]`);
  await wait(page);
  s = await snap(page);
  const fr = s.d.reqs.find((q) => q.label === 'French B2');
  check(fr.chip.text === '●Have' && fr.ev === 'From your side: “Made-up note: passed an example exam”' && s.d.fit === '6 have · 1 partly · 2 missing', 'close: the role now has it, from your own words: ' + fr.ev);
  await page.screenshot({ path: file('skills-pc-closed-role') });
  await page.click('#gaps [data-gap="french-b2"]');
  await wait(page);
  await page.screenshot({ path: file('skills-pc-closed-gap') });
  await page.click('#detail [data-act="reopen"]');
  await wait(page, 400);
  s = await snap(page);
  check(lastPost(hub).path === '/gap/french-b2/reopen' && s.d.chip.text === '○Missing' && s.toast === 'French B2 is open again.' && !s.gaps.find((g) => g.key === 'french-b2').closed && s.sideLine.startsWith('Your side: 11 lines'), 'reopen: the gap is open again, the line gone');
  quiet(o, 'close and reopen');
  await o.ctx.close();
}

/* ---------- 6. The role menu: Check again, Past and back, Remove ---------- */
{
  const o = await open(PC, { query: '&r=' + ID.r2 });
  const { page, hub } = o;
  await page.click('#menuBtn');
  await wait(page);
  let s = await snap(page);
  check(s.d.menu && s.d.menu.join() === 'Check again,Move to past,Remove' && s.d.menuExp === 'true' && s.focus === 'recheck', 'menu: Check again, Move to past, Remove: ' + s.d.menu);
  await page.keyboard.press('Escape');
  await wait(page);
  s = await snap(page);
  check(!s.d.menu && s.focus === 'menuBtn', 'menu: Escape closes it, the focus back on ⋯');
  await page.click('#menuBtn');
  await page.mouse.click(700, 600);
  await wait(page);
  check(!(await snap(page)).d.menu, 'menu: a click elsewhere closes it');
  await page.click('#menuBtn');
  await page.click('#roleMenu [data-act="past"]');
  await wait(page, 400);
  s = await snap(page);
  check(lastPost(hub).path === `/role/${ID.r2}/past` && lastPost(hub).body.past === true, 'past: the body is { past: true }');
  check(s.d.boxes.some((b) => b === 'This role is in Past. Back to active') && s.d.pastBox && s.pastTog.text === 'Past · 2' && s.pastTog.exp === 'true' && s.roles.find((r) => r.id === ID.r2).past && s.rolesH === 'Roles you track · 3' && s.toast === 'Project Officer, Example Capabilities is in Past.',
    'past: greyed, in the Past group, Back to active: ' + s.d.boxes);
  check(s.gaps.find((g) => g.key === 'screening-a').sub === 'In 2 of 3 roles', 'past: the gaps count without it: ' + s.gaps.find((g) => g.key === 'screening-a').sub);
  await page.screenshot({ path: file('skills-pc-past') });
  await page.click('#detail .box [data-act="active"]');
  await wait(page, 400);
  s = await snap(page);
  check(lastPost(hub).body.past === false && !s.roles.find((r) => r.id === ID.r2).past && s.rolesH === 'Roles you track · 4' && !s.d.pastBox, 'past: Back to active');
  await page.click('#menuBtn');
  await page.click('#roleMenu [data-act="recheck"]');
  await wait(page, 300);
  s = await snap(page);
  check(lastPost(hub).path === `/role/${ID.r2}/recheck` && s.d.boxes[0].startsWith('Claude is reading the vacancy') && s.roles.find((r) => r.id === ID.r2).state === 'Claude is reading the vacancy', 'check again: the role is being read');
  await page.waitForTimeout(5600);
  s = await snap(page);
  check(!s.d.boxes.length && s.d.reqs.length === 6, 'check again: read again after one look');
  await page.click('#menuBtn');
  await page.click('#roleMenu [data-act="remove"]');
  await wait(page);
  s = await snap(page);
  check(s.d.rm === 'Remove Project Officer, Example Capabilities? What it asks for goes too, and it leaves your gaps.' && s.focus === 'rm-keep' && !hub.posts.some((p) => p.path.endsWith('/delete')), 'remove: asks first, the focus on Keep');
  await page.screenshot({ path: file('skills-pc-remove') });
  await page.click('#detail [data-act="rm-keep"]');
  await wait(page);
  s = await snap(page);
  check(!s.d.rm && s.focus === 'menuBtn', 'remove: Keep keeps it');
  await page.click('#menuBtn');
  await page.click('#roleMenu [data-act="remove"]');
  await page.click('#detail [data-act="rm-go"]');
  await wait(page, 400);
  s = await snap(page);
  check(lastPost(hub).path === `/role/${ID.r2}/delete` && !s.roles.some((r) => r.id === ID.r2) && s.toast === 'Project Officer, Example Capabilities is no longer tracked.' && s.d.h2 === 'Policy Officer, Example Directorate' && !s.url.includes('r='),
    'remove: gone, the first role open');
  check(s.gaps.find((g) => g.key === 'screening-a').sub === 'In 2 of 3 roles' && !s.gaps.some((g) => g.key === 'eu-policy' && g.sub.includes('of 4')), 'remove: the gaps follow');
  quiet(o, 'menu');
  await o.ctx.close();
}

/* ---------- 7. Paste a job, then the 5 s look until it is read, and the 3 minutes ---------- */
{
  const o = await open(PC, { clock: true });
  const { page, hub } = o;
  hub.readAfter = 3;
  await page.click('#pasteBtn');
  await wait(page);
  let s = await snap(page);
  check(s.dialog.id === 'paste' && s.focus === 'pjTitle', 'paste: Paste a job opens, the focus on Title');
  await page.click('#pasteGo');
  await wait(page);
  let pe = await page.evaluate(() => [document.getElementById('pasteErr').textContent, document.activeElement.id, document.getElementById('pjTitle').getAttribute('aria-invalid')]);
  check(pe[0] === 'Give the job a title.' && pe[1] === 'pjTitle' && pe[2] === 'true' && !hub.posts.length, 'paste: the title is required');
  await page.fill('#pjTitle', 'Example Coordinator');
  await page.fill('#pjOrg', 'Example Office');
  await page.fill('#pjText', JOB.slice(0, 150));
  const cnt = await page.evaluate(() => [document.getElementById('pjCount').textContent, document.getElementById('pjCount').classList.contains('is-short')]);
  check(cnt[0] === '150 characters · at least 200' && cnt[1], 'paste: the count says how far: ' + cnt[0]);
  await page.click('#pasteGo');
  await wait(page);
  pe = await page.evaluate(() => [document.getElementById('pasteErr').textContent, document.activeElement.id]);
  check(pe[0] === 'Paste the whole job text: at least 200 characters. This is 150.' && pe[1] === 'pjText' && !hub.posts.length, 'paste: 200 characters at least: ' + pe[0]);
  await page.fill('#pjText', JOB);
  await page.fill('#pjLink', 'example.org/job');
  await page.click('#pasteGo');
  await wait(page);
  pe = await page.evaluate(() => [document.getElementById('pasteErr').textContent, document.activeElement.id]);
  check(pe[1] === 'pjLink' && /https:\/\//.test(pe[0]) && !hub.posts.length, 'paste: a link has to be a web address');
  await page.fill('#pjLink', 'https://example.org/jobs/77');
  await page.screenshot({ path: file('skills-pc-paste') });
  await page.click('#pasteGo');
  await wait(page, 300);
  s = await snap(page);
  const pp = lastPost(hub);
  check(pp.path === '/role' && JSON.stringify(pp.body) === JSON.stringify({ title: 'Example Coordinator', text: JOB.trim(), org: 'Example Office', link: 'https://example.org/jobs/77' }), 'paste: the body is { title, text, org, link }');
  const nid = s.roles.find((r) => r.title === 'Example Coordinator');
  check(!s.dialog && nid && nid.cur && nid.state === 'Claude is reading the vacancy' && s.d.h2 === 'Example Coordinator' && s.d.boxes[0] === 'Claude is reading the vacancy This page looks again every 5 seconds.' && s.toast === 'Claude is reading the vacancy.' && s.focus === 'detailH',
    'paste: the role appears as reading and opens: ' + JSON.stringify(s.d.boxes));
  await page.screenshot({ path: file('skills-pc-reading') });
  const g0 = hub.gets;
  await page.clock.runFor(5100);
  await wait(page, 200);
  check(hub.gets === g0 + 1 && (await snap(page)).d.boxes.length === 1, 'poll: one look after 5 s, still reading');
  await page.clock.runFor(5100);
  await wait(page, 200);
  s = await snap(page);
  check(hub.gets === g0 + 2 && !s.d.boxes.length && s.d.reqs.map((q) => q.label).join() === 'Three years of policy work in an international setting,Writing for a crisis team,French B2' && s.roles.find((r) => r.title === 'Example Coordinator').fit === '1 have · 0 partly · 2 missing',
    'poll: read, the requirements in: ' + s.d.reqs.map((q) => q.label));
  check(s.gaps.find((g) => g.key === 'crisis-writing') && s.gaps.find((g) => g.key === 'french-b2').sub.startsWith('In 3 of 5 roles'), 'poll: the gaps take the new role in');
  await page.clock.runFor(30000);
  await wait(page, 200);
  check(hub.gets === g0 + 2, 'poll: nothing being read, no more looks: ' + (hub.gets - g0));
  quiet(o, 'paste and poll');
  await o.ctx.close();
  // A role that is never read: the looks stop after 3 minutes; Look now looks once and starts again.
  const h2 = makeHub({ extra: [ROLE('r8', 'Example Slow Role', 'Example Place', '2026-11-30', 'digest', [], { state: 'reading', readIn: 1e9 })] });
  const p = await open(PC, { hub: h2, clock: true, query: '&r=' + id12('r8') });
  for (let i = 0; i < 40; i++) { await p.page.clock.runFor(5000); await wait(p.page, 30); }
  const got = h2.gets;
  for (let i = 0; i < 4; i++) { await p.page.clock.runFor(5000); await wait(p.page, 30); }
  s = await snap(p.page);
  check(got >= 35 && got <= 38 && h2.gets === got && /Still reading after 3 minutes/.test(s.d.boxes[0]), 'poll: stops after 3 minutes and says so: ' + got + ' reads');
  await p.page.click('#detail [data-act="look"]');
  await wait(p.page, 200);
  await p.page.clock.runFor(5100);
  await wait(p.page, 200);
  check(h2.gets === got + 2 && /looks again every 5 seconds/.test((await snap(p.page)).d.boxes[0]), 'poll: Look now looks and starts the 3 minutes again');
  await p.page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  const hid = h2.gets;
  await p.page.clock.runFor(20000);
  await wait(p.page, 200);
  check(h2.gets === hid, 'poll: nothing while the page is hidden');
  quiet(p, 'poll for 3 minutes');
  await p.ctx.close();
  // Read on opening, on return, never on a timer when nothing is being read.
  const q = await open(PC, { clock: true });
  await q.page.clock.runFor(60000);
  await wait(q.page, 200);
  const g1 = q.hub.gets;
  await q.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await wait(q.page, 200);
  check(g1 === 1 && q.hub.gets === 2, 'refresh: one read on opening, none on a timer, one on return: ' + [g1, q.hub.gets]);
  await q.ctx.close();
}

/* ---------- 8. Needs the text, could not be read ---------- */
{
  const o = await open(PC, { hub: makeHub({ extra: EXTRA_ROLES }), query: '&r=' + ID.r6 });
  const { page, hub } = o;
  let s = await snap(page);
  check(s.roles.find((r) => r.id === ID.r6).state === 'Needs the job text' && s.roles.find((r) => r.id === ID.r7).state === 'Could not be read', 'states: the rows say what is wrong');
  check(s.d.boxes[0].startsWith('The page could not be read. Paste the text.') && s.d.rtCount === '0 characters · at least 200' && !s.d.fit, 'needs text: the box with a place to paste: ' + s.d.boxes[0]);
  await page.screenshot({ path: file('skills-pc-needs-text') });
  await page.fill('#rtText', JOB.slice(0, 120));
  await page.click('#detail [data-act="text"]');
  await wait(page);
  s = await snap(page);
  const inv = await page.evaluate(() => [document.getElementById('rtText').getAttribute('aria-invalid'), document.activeElement.id, document.getElementById('rtText').value.length]);
  check(s.d.err === 'Paste the whole job text: at least 200 characters. This is 120.' && inv[0] === 'true' && inv[1] === 'rtText' && inv[2] === 120 && !hub.posts.length, 'needs text: too short, nothing sent, the text kept');
  await page.fill('#rtText', JOB);
  await page.click('#detail [data-act="text"]');
  await wait(page, 300);
  s = await snap(page);
  check(lastPost(hub).path === `/role/${ID.r6}/text` && lastPost(hub).body.text === JOB.trim() && s.d.boxes[0].startsWith('Claude is reading the vacancy') && !s.d.err, 'needs text: sent as { text }, being read');
  await page.waitForTimeout(10600);
  s = await snap(page);
  check(!s.d.boxes.length && s.d.reqs.length === 3, 'needs text: read after the looks');
  await page.click(`#roles [data-role="${ID.r7}"]`);
  await wait(page);
  s = await snap(page);
  check(s.d.boxes[0] === 'Claude could not read this role. The vacancy page did not answer. Try again', 'failed: the error and Try again: ' + s.d.boxes[0]);
  await page.screenshot({ path: file('skills-pc-failed') });
  await page.click('#detail .box [data-act="recheck"]');
  await wait(page, 300);
  s = await snap(page);
  check(lastPost(hub).path === `/role/${ID.r7}/recheck` && s.d.boxes[0].startsWith('Claude is reading the vacancy') && s.toast === 'Claude is reading the vacancy again.', 'failed: Try again reads it again');
  quiet(o, 'needs text and failed');
  await o.ctx.close();
}

/* ---------- 9. Your side ---------- */
{
  const o = await open(PC);
  const { page, hub } = o;
  await page.click('#sideBtn');
  await wait(page, 300);
  let s = await snap(page);
  const sd = () => page.evaluate(() => ({
    now: document.getElementById('sdNow').innerText.replace(/\s+/g, ' ').trim(), lines: [...document.querySelectorAll('#sdLines .lines li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim()),
    all: document.getElementById('sdAll') ? document.getElementById('sdAll').textContent : '', closed: [...document.querySelectorAll('#sdClosed li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim()),
    closedNone: document.querySelector('#sdClosed > .hint') ? document.querySelector('#sdClosed > .hint').textContent : '',
    done: document.getElementById('sdDone').hidden ? '' : document.getElementById('sdDone').textContent, err: document.getElementById('sdErr').hidden ? '' : document.getElementById('sdErr').textContent,
    text: document.getElementById('sdText').value, explain: document.querySelector('#side .hint-top').textContent,
  }));
  let v = await sd();
  check(s.dialog.id === 'side' && hub.sideGets === 1 && s.focus === 'sdReplace' && v.explain === 'Only these lines count as yours. Every Have or Partly points to one of them.', 'side: opens, reads the lines, explains them');
  check(v.now === '10 lines from CV Studio updated 22 Oct' && v.lines.length === 8 && v.lines[0] === SIDE[0].text + 'CV Studio' && v.all === 'Show all 10', 'side: the first 8 lines and Show all 10: ' + v.now);
  check(v.closed.join() === `Advanced spreadsheet skills · “${CLOSED_NOTE}”Reopen`, 'side: Gaps you closed with your words and Reopen: ' + v.closed);
  await page.screenshot({ path: file('skills-pc-side') });
  await page.click('#sdAll');
  v = await sd();
  check(v.lines.length === 10 && !v.all, 'side: Show all');
  check(!(await page.isVisible('#sdText')), 'side: the paste box waits behind Replace');
  await page.click('#sdReplace');
  s = await snap(page);
  check(s.focus === 'sdText' && (await page.getAttribute('#sdReplace', 'aria-expanded')) === 'true' && (await page.textContent('#sdReplace')) === 'Cancel', 'side: Replace opens the paste box, the focus in it');
  await page.fill('#sdText', '{"blocks": [ {"title": "Made-up');
  await page.click('#sdGo');
  v = await sd();
  check(/not all of it/.test(v.err) && !hub.posts.length, 'side: a JSON export cut short is caught here: ' + v.err);
  await page.setInputFiles('#sdPick', { name: 'blocks.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ blocks: [{ title: 'Made-up block one', period: '2020 to 2022' }, { title: 'Made-up block two' }] })) });
  await wait(page, 200);
  v = await sd();
  check(v.text.startsWith('{"blocks"') && !v.err, 'side: Choose a file puts the file in the box');
  await page.fill('#sdText', SIDE.slice(0, 4).map((l) => l.text).join('\n'));
  await page.click('#sdGo');
  await wait(page, 400);
  v = await sd();
  s = await snap(page);
  check(lastPost(hub).path === '/side' && lastPost(hub).body.text === SIDE.slice(0, 4).map((l) => l.text).join('\n') && v.done === '5 lines · 4 roles are checked again' && v.text === '' && hub.sideGets === 2 && !(await page.isVisible('#sdText')) && s.focus === 'sdReplace', 'side: a paste is sent as { text }, the counts, read again: ' + v.done);
  check(s.sideLine.startsWith('Your side: 5 lines') && s.roles.filter((r) => !r.past).every((r) => r.state === 'Claude is reading the vacancy'), 'side: the head follows and the roles are being checked again: ' + s.sideLine);
  v = await sd();
  check(v.lines.length === 4, 'side: the new lines are listed');
  await page.keyboard.press('Escape');
  await wait(page);
  s = await snap(page);
  check(!s.dialog && s.focus === 'sideBtn', 'side: Escape closes it, the focus back on Your side');
  await page.waitForTimeout(5600);
  s = await snap(page);
  check(s.roles.filter((r) => !r.past).every((r) => r.fit) && s.d.reqs.find((q) => q.label === 'A master’s degree').chip.text === '○Missing', 'side: checked again with the new lines (no line for the degree any more)');
  // Reopen from Gaps you closed.
  await page.click('#sideBtn');
  await wait(page, 300);
  await page.click('#sdClosed [data-reopen="spreadsheets"]');
  await wait(page, 400);
  v = await sd();
  s = await snap(page);
  check(lastPost(hub).path === '/gap/spreadsheets/reopen' && !v.closed.length && v.closedNone === 'None yet.' && s.toast === 'Advanced spreadsheet skills is open again.' && s.focus === 'sdClosedH', 'side: Reopen from Gaps you closed');
  quiet(o, 'your side');
  await o.ctx.close();
}

/* ---------- 10. An empty side, an empty page, no code, the hub away ---------- */
{
  const o = await open(PC, { hub: makeHub({ side: [], steps: false }) });
  const { page, hub } = o;
  let s = await snap(page);
  check(s.sideLine === 'Your side is empty: add your CV Studio blocks' && s.sideEmpty, 'empty side: the head says so');
  check(s.d.reqs.every((q) => q.chip.text === '◌Not checked' && q.ev === 'Add your side to check this') && s.d.sideNote === 'Your side is empty, so nothing here is checked yet.' && s.d.fit === '9 not checked',
    'empty side: nothing claimed, every requirement waits for your side: ' + s.d.fit);
  check(s.roles[0].fit === '9 not checked' && !s.gaps.length && s.gapsNone === 'Your side is empty, so there are no gaps to show yet. Add your blocks' && !s.gapsSub, 'empty side: no gaps, a way to add your blocks: ' + s.gapsNone);
  await page.screenshot({ path: file('skills-pc-side-empty') });
  await page.click('#detail .side-note [data-open="side"]');
  await wait(page, 300);
  const now = await page.evaluate(() => document.getElementById('sdNow').textContent);
  check(now === 'Your side is empty. Nothing is checked until you paste your CV Studio blocks.', 'empty side: Your side says so');
  await page.fill('#sdText', JSON.stringify(SIDE.map((l) => ({ title: l.text }))));
  await page.click('#sdGo');
  await wait(page, 300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(5600);
  s = await snap(page);
  check(lastPost(hub).path === '/side' && s.sideLine.startsWith('Your side: 10 lines') && s.d.reqs.find((q) => q.label === 'French B2').chip.text === '○Missing' && s.gaps.length === 8, 'empty side: after the JSON export, the roles are checked and the gaps appear');
  quiet(o, 'empty side');
  await o.ctx.close();
}
{
  const o = await open(PC, { hub: makeHub({ roles: [], closed: false, steps: false }) });
  let s = await snap(o.page);
  check(s.d.empty === 'No roles yet. Paste a job, or tap Track this role on an Apply task in To-do.' && s.rolesH === 'Roles you track · 0' && s.gapsNone === 'Gaps show here once you track a role.', 'nothing tracked: the empty page says how to start');
  await o.page.screenshot({ path: file('skills-pc-empty') });
  await o.page.click('#detail [data-open="paste"]');
  await wait(o.page);
  check((await snap(o.page)).dialog.id === 'paste', 'nothing tracked: Paste a job from the empty page');
  await o.ctx.close();
}
{
  const o = await open(PC, { code: '' });
  const s = await snap(o.page);
  check(s.nocode && !s.app && o.hub.gets === 0, 'no code: the page says so and asks nothing');
  await o.ctx.close();
}
{
  const hub = makeHub();
  hub.abort = true;
  const o = await open(PC, { hub });
  let s = await snap(o.page);
  check(s.away === 'Can’t reach the hub.' && !s.cols.roles && !s.status, 'hub away: says so with Retry');
  check(await o.page.evaluate(() => document.getElementById('sideBtn').disabled && document.getElementById('pasteBtn').disabled), 'hub away: nothing to change until the hub answers');
  await o.page.screenshot({ path: file('skills-pc-away') });
  hub.abort = false;
  await o.page.click('#retry');
  await wait(o.page, 300);
  s = await snap(o.page);
  check(!s.away && s.cols.roles && s.d.h2 === 'Policy Officer, Example Directorate' && s.focus === 'detailH', 'hub away: Retry brings it in');
  hub.abort = true;
  await o.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await wait(o.page, 300);
  s = await snap(o.page);
  check(s.status === 'Can’t reach the hub · showing what was there' && s.cols.roles, 'hub away later: what was there stays, with a note');
  await o.page.click(`#roles [data-role="${ID.r2}"]`);
  await o.page.click('#menuBtn');
  await o.page.click('#roleMenu [data-act="past"]');
  await wait(o.page, 300);
  s = await snap(o.page);
  check(s.d.err === 'Can’t reach the hub. Nothing changed, try again.', 'hub away: a change that cannot be sent says so: ' + s.d.err);
  quiet(o, 'hub away');
  await o.ctx.close();
}

/* ---------- 11. The phone at 390 and 375 ---------- */
for (const [name, vp] of [['skills-phone', { width: 390, height: 844 }], ['skills-phone-375', { width: 375, height: 667 }]]) {
  const o = await open(vp);
  const { page, hub } = o;
  let s = await snap(page);
  check(s.tabs && s.tabs.map((x) => x.text + ':' + x.sel).join() === 'Roles 4:true,Gaps 7:false' && s.cols.roles && !s.cols.gaps && !s.d, name + ': tabs Roles | Gaps, the roles first, nothing open: ' + JSON.stringify(s.tabs));
  check(!s.overflow && !small(s).length, name + ': nothing sideways, 44 px: ' + small(s));
  check(s.roles.filter((r) => !r.past).length === 4 && !s.roles.some((r) => r.cur), name + ': the roles, none picked');
  await page.screenshot({ path: file(name), fullPage: true });
  await page.tap('#tabGaps');
  await wait(page);
  s = await snap(page);
  check(s.tabs[1].sel === 'true' && !s.cols.roles && s.cols.gaps && s.gaps.length === 8 && !s.overflow && !small(s).length, name + ': the Gaps tab: ' + small(s));
  await page.screenshot({ path: file(name + '-gaps'), fullPage: true });
  await page.keyboard.press('ArrowLeft');
  s = await snap(page);
  check(s.tabs[0].sel === 'true' && s.focus === 'tabRoles', name + ': arrow keys move between the tabs');
  await page.tap('#tabGaps');
  await wait(page);
  await page.tap('#gaps [data-gap="french-b2"]');
  await wait(page);
  s = await snap(page);
  check(s.d && s.d.full && near(s.d.x, 0, 0.5) && near(s.d.y, 0, 0.5) && near(s.d.w, vp.width, 0.5) && near(s.d.h, vp.height, 0.5) && s.d.back === '‹ Gaps' && s.focus === 'detailH' && /g=french-b2/.test(s.url), name + ': a gap full screen with ‹ Gaps');
  check(!s.overflow && !small(s).length, name + ': the gap: nothing sideways, 44 px: ' + small(s));
  await page.screenshot({ path: file(name + '-gap') });
  await page.tap(`#detail [data-role="${ID.r1}"]`);
  await wait(page);
  s = await snap(page);
  check(s.d.full && s.d.h2 === 'Policy Officer, Example Directorate' && s.d.back === '‹ French B2' && !s.overflow && !small(s).length, name + ': a role from the gap, ‹ back to the gap: ' + small(s));
  await page.screenshot({ path: file(name + '-role') });
  await page.tap('#detail [data-act="back"]');
  await wait(page);
  s = await snap(page);
  check(s.d.full && s.d.h2 === 'French B2' && s.d.back === '‹ Gaps', name + ': ‹ goes back to the gap');
  await page.keyboard.press('Escape');
  await wait(page);
  s = await snap(page);
  check(!s.d && s.focus === 'french-b2' && s.tabs[1].sel === 'true' && !/g=/.test(s.url), name + ': Escape closes it, the focus back on the gap');
  await page.tap('#gaps [data-gap="french-b2"]');
  await wait(page);
  await page.tap('#detail [data-act="close"]');
  await wait(page);
  s = await snap(page);
  check(s.dialog.id === 'close' && near(s.dialog.w, vp.width, 0.5) && near(s.dialog.y + s.dialog.h, vp.height, 0.5) && !small(s).length, name + ': I have this now from below, 44 px: ' + small(s));
  await page.screenshot({ path: file(name + '-close') });
  await page.keyboard.press('Escape');
  await wait(page);
  check((await snap(page)).focus === 'close', name + ': Escape from the sheet, the focus back on I have this now');
  await page.tap('[data-step-del]').catch(() => {});
  await wait(page, 250);
  await page.fill('#stepIn', 'Example step on the phone');
  await page.tap('#detail .step-add .btn');
  await wait(page, 250);
  await page.tap('[data-step-task]');
  await wait(page);
  s = await snap(page);
  check(s.dialog.id === 'task' && near(s.dialog.y + s.dialog.h, vp.height, 0.5) && !small(s).length, name + ': Make a task from below, 44 px');
  await page.screenshot({ path: file(name + '-task') });
  await page.keyboard.press('Escape');
  await wait(page);
  await page.tap('#detail [data-act="back"]');
  await wait(page);
  await page.tap('#tabRoles');
  await page.tap(`#roles [data-role="${ID.r2}"]`);
  await wait(page);
  s = await snap(page);
  check(s.d.full && s.d.back === '‹ Roles' && !small(s).length && !s.overflow, name + ': a role full screen with ‹ Roles');
  await page.tap('#menuBtn');
  await wait(page);
  s = await snap(page);
  check(s.d.menu && !small(s).length, name + ': the role menu, 44 px');
  await page.screenshot({ path: file(name + '-menu') });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await wait(page);
  s = await snap(page);
  check(!s.d && s.focus === ID.r2, name + ': back to the list, the focus on the role');
  await page.tap('#pasteBtn');
  await wait(page);
  s = await snap(page);
  const pw = await page.evaluate(() => { const b = document.querySelector('#paste .pf-body'); return b.scrollWidth <= b.clientWidth + 1; });
  check(s.dialog.id === 'paste' && near(s.dialog.w, vp.width, 0.5) && near(s.dialog.h, vp.height, 0.5) && pw && !small(s).length, name + ': Paste a job full screen, 44 px: ' + small(s));
  await page.screenshot({ path: file(name + '-paste') });
  await page.keyboard.press('Escape');
  await wait(page);
  await page.tap('#sideBtn');
  await wait(page, 300);
  s = await snap(page);
  const sw = await page.evaluate(() => { const b = document.querySelector('#side'); return b.scrollWidth <= b.clientWidth + 1; });
  check(s.dialog.id === 'side' && near(s.dialog.w, vp.width, 0.5) && sw && !small(s).length, name + ': Your side full screen, 44 px: ' + small(s));
  await page.screenshot({ path: file(name + '-side') });
  await page.keyboard.press('Escape');
  quiet(o, name);
  await o.ctx.close();
  // ?g= on the phone opens the gap full screen, on the Gaps tab.
  const p = await open(vp, { query: '&g=screening-a' });
  s = await snap(p.page);
  check(s.d && s.d.full && s.d.h2 === 'Screening level A' && s.d.back === '‹ Gaps', name + ': ?g= opens the gap full screen');
  await p.page.keyboard.press('Escape');
  await wait(p.page);
  s = await snap(p.page);
  check(s.tabs[1].sel === 'true' && s.focus === 'screening-a', name + ': and closes onto the Gaps tab');
  await p.ctx.close();
}
{
  const o = await open({ width: 390, height: 844 }, { hub: makeHub({ roles: [], closed: false, steps: false }) });
  const s = await snap(o.page);
  check(s.rolesNone === 'No roles yet. Paste a job, or tap Track this role on an Apply task in To-do.' && !small(s).length, 'phone: nothing tracked, the Roles tab says how to start');
  await o.page.screenshot({ path: file('skills-phone-empty') });
  await o.ctx.close();
}

/* ---------- 12. Morning's Waiting on card leads here ---------- */
const MORNING = () => ({ now: new Date().toISOString(), waiting: { ok: true, open: 2, due: 0, items: [{ id: 'w1', who: 'Example Ministry', what: 'the application', channel: 'email', since: new Date().toISOString().slice(0, 10), chaseDue: false }] } });
for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 375, height: 667 }]) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: vp.width < 700 });
  const page = await ctx.newPage();
  await page.route('**/api/**', (r) => {
    const u = new URL(r.request().url());
    if (u.pathname.startsWith('/api/morning/')) return r.fulfill({ json: MORNING(), headers: H });
    if (u.pathname.startsWith('/api/skills/')) return r.fulfill({ json: makeHub().answer(), headers: H });
    return r.fulfill({ status: 503, json: { error: 'mocked' }, headers: H });
  });
  await page.route('**/site.**espn.com/**', (r) => r.abort());
  await page.goto(BASE + '?c=' + CODE);
  await page.waitForFunction(() => !document.getElementById('waiting').hidden, null, { timeout: 5000 }).catch(() => {});
  const link = await page.evaluate(() => {
    const a = document.getElementById('waitSkills');
    if (!a) return null;
    const r = a.getBoundingClientRect(), net = document.getElementById('waitNet').getBoundingClientRect(), add = document.getElementById('waitAdd').getBoundingClientRect(), head = a.closest('.card-head').getBoundingClientRect();
    return { href: a.getAttribute('href'), text: a.textContent.replace(/\s+/g, ' ').trim(), h: r.height, inHead: !!a.closest('#waiting .card-head'), cls: a.className, afterNet: r.left >= net.right, beforeAdd: r.right <= add.left, sameRow: Math.abs((r.top + r.bottom) / 2 - (net.top + net.bottom) / 2) < 4 && Math.abs((r.top + r.bottom) / 2 - (add.top + add.bottom) / 2) < 4, inside: add.right <= head.right + 0.5, over: document.documentElement.scrollWidth > innerWidth };
  });
  const tag = vp.width < 700 ? `Morning ${vp.width}` : 'Morning';
  check(link && link.href === 'skills/?c=' + CODE && link.text === 'Skills ›' && link.inHead && /card-link/.test(link.cls) && link.afterNet && link.beforeAdd && link.sameRow && link.inside && !link.over, tag + ': Skills › beside Network › in the head of Waiting on: ' + JSON.stringify(link));
  if (vp.width < 700) check(link && link.h >= 44, tag + ': the link is 44 px tall: ' + (link && link.h));
  else {
    await page.waitForTimeout(1600);
    await page.locator('#waiting').screenshot({ path: file('skills-morning-link') });
    await page.click('#waitSkills');
    await page.waitForURL(/skills\/\?c=/);
    await page.waitForTimeout(400);
    check((await page.title()) === 'Skills' && (await page.locator('#rolesBody .rr').count()) === 5, 'Morning: the link opens Skills with the code');
  }
  if (vp.width === 375) { await page.waitForTimeout(1600); await page.locator('#waiting').screenshot({ path: file('skills-morning-link-375') }); }
  await ctx.close();
}

/* ---------- 13. The service worker keeps this page under its own path ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, json: { error: 'mocked' }, headers: H }));
  await ctx.route('**/site.**espn.com/**', (r) => r.abort());
  await page.goto(BASE + '?c=' + CODE + '&sw=1');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.goto(BASE + 'skills/?c=' + CODE);
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
  check(kept[root] === 'Morning' && kept[root + 'skills/'] === 'Skills', 'service worker: Morning stays Morning, Skills under its own path: ' + JSON.stringify(kept));
  await ctx.close();
}

await browser.close();
console.log(`${passes} of ${passes + fails} skills checks pass`);
if (fails) process.exit(1);
console.log('all skills checks pass');
