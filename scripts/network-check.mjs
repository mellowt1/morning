// Network (morning/network/) against a mocked paul-hub /api/network/:code that keeps its own state the way
// src/network.js does: the zones and nodes, both kinds of line, faded people and "No contact yet", a person's
// card (PC panel, phone sheet) with every section, Talked today, Reach out (and the 409), Sent a message, Add
// person with links and topics, Edit, Remove with its confirm step, the links picker, search and Fading only,
// To sort, about 400 people packed with "+N more", the LinkedIn import (dry run, preview, a changed sector,
// the import, a drop, a wrong file), ?p=, no code, the hub away and Retry, an empty network, the phone at
// 390 and 375, Morning's link, the service worker and nothing in the console. Every person here is made up.
//   PORT=8193 npm run serve, then: APP=http://localhost:8193/morning/ npm run network-check
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

/* ---------- The made-up network (the approved mockup's people) ---------- */
const TODAY = '2026-10-22', FADE_BEFORE = '2026-04-22';
const SECTORS = [{ id: 'emb', name: 'Embassies' }, { id: 'min', name: 'Ministries' }, { id: 'ind', name: 'Industry' }, { id: 'nato', name: 'NATO and EU' }, { id: 'other', name: 'Other' }];
const ZONE = { emb: 'rgb(220, 229, 239)', min: 'rgb(239, 230, 212)', ind: 'rgb(236, 224, 215)', nato: 'rgb(214, 222, 232)', other: 'rgb(225, 229, 234)' };
const FILL = { emb: 'rgb(157, 187, 219)', min: 'rgb(233, 190, 99)', ind: 'rgb(201, 135, 90)', nato: 'rgb(47, 93, 138)', other: 'rgb(169, 178, 189)' };
const ORDER = ['emb', 'min', 'ind', 'nato', 'other'];
const INK = '#15181C', LINE = '#7A8491';
const id = (k) => k.padEnd(12, '0');
const P = (k, name, sector, role, org, last, extra = {}) => ({ id: id(k), name, org, role, sector, metWhere: null, metWhen: null, topics: [], notes: null, email: null, phone: null, linkedin: null, lastContact: last, source: 'hand', connectedOn: null, reachTask: null, waiting: null, updatedAt: '2026-10-22T08:00:00.000Z', ...extra });
const PEOPLE = [
  P('claire', 'Claire Dubois', 'emb', 'Defence attaché office', 'Embassy of France', '2026-09-10'),
  P('james', 'James Whitfield', 'emb', 'Defence section', 'British Embassy', '2026-08-28'),
  P('lars', 'Lars Eriksen', 'emb', 'Political officer', 'Embassy of Norway', '2026-02-14'),
  P('sofia', 'Sofia Morales', 'emb', 'Trade counsellor', 'Embassy of Colombia', '2025-09-03'),
  P('mark', 'Mark Jansen', 'min', 'Head of unit', 'Buitenlandse Zaken', '2026-10-15'),
  P('anna', 'Anna de Vries', 'min', 'Policy advisor', 'Ministerie van Defensie', '2026-10-02', {
    metWhere: 'Defensie career event, Den Haag', metWhen: '2026-03', topics: ['Defence procurement', 'Economic security', 'Latin America'],
    notes: 'Asked me to keep her posted on the DMO vacancy.', email: 'anna.devries@example.org', phone: '+31 6 1234 5678', linkedin: 'https://www.linkedin.com/in/anna-de-vries-example',
  }),
  P('eva', 'Eva Bakker', 'min', 'Senior advisor', 'Economische Zaken', '2026-07-01'),
  P('ruben', 'Ruben Smit', 'min', 'Programme manager', 'DMO', '2026-09-20'),
  P('pieter', 'Pieter de Groot', 'ind', 'Network coordinator', 'NIDV', '2026-10-08'),
  P('tom', 'Tom Visser', 'ind', 'Business development', 'Thales Nederland', '2026-06-12', { linkedin: 'https://www.linkedin.com/in/tom-visser-ex' }),
  P('lisa', 'Lisa Mulder', 'ind', 'Export manager', 'Damen Naval', '2026-05-30'),
  P('nadia', 'Nadia Haddad', 'ind', 'Researcher', 'TNO', '2026-03-05'),
  P('henrik', 'Henrik Larsen', 'nato', 'Procurement officer', 'NSPA', '2026-10-14'),
  P('olga', 'Olga Petrova', 'nato', 'Recruiter', 'NCIA', '2026-09-02'),
  P('marta', 'Marta Kowalska', 'nato', 'Project officer', 'European Defence Agency', '2026-08-11'),
  P('jean', 'Jean Moreau', 'nato', 'Policy officer', 'DG DEFIS', '2026-07-22'),
  P('femke', 'Femke Janssen', 'other', 'Research fellow', 'Clingendael', '2026-09-28'),
  P('bram', 'Bram Kuipers', 'other', 'Alumni coordinator', 'Leiden University', null),
  P('daan', 'Daan Willems', 'sort', 'Analyst', 'Rabobank', null, { source: 'linkedin', linkedin: 'https://www.linkedin.com/in/daan-willems-ex', connectedOn: '2022-01-14' }),
  P('iris', 'Iris Vermeulen', 'sort', 'Consultant', 'Deloitte', null, { source: 'linkedin' }),
  P('joost', 'Joost van Dam', 'sort', 'Teacher', null, null, { source: 'linkedin' }),
  P('sanne', 'Sanne de Boer', 'sort', 'Student', 'Universiteit Utrecht', null, { source: 'linkedin' }),
];
const T = (a, b, kind) => ({ a: id(a), b: id(b), kind });
const TIES = [T('mark', 'anna', 'introduced'), T('pieter', 'tom', 'introduced'), T('pieter', 'lisa', 'introduced'), T('anna', 'henrik', 'introduced'), T('claire', 'jean', 'introduced'),
  T('anna', 'ruben', 'works_with'), T('nadia', 'tom', 'works_with'), T('henrik', 'olga', 'works_with'), T('jean', 'marta', 'works_with'), T('eva', 'mark', 'works_with')];
const NAME = Object.fromEntries(PEOPLE.map((p) => [p.id, p.name]));

/* About 400: most never contacted (an import), most of them in Industry. */
function manyPeople() {
  const firsts = ['Claire', 'James', 'Lars', 'Sofia', 'Mark', 'Anna', 'Eva', 'Ruben', 'Pieter', 'Tom', 'Lisa', 'Nadia', 'Henrik', 'Olga', 'Marta', 'Jean', 'Frank', 'Ingrid', 'Daan', 'Femke', 'Bram', 'Iris'];
  const lasts = ['Dubois', 'Whitfield', 'Eriksen', 'Morales', 'Jansen', 'de Vries', 'Bakker', 'Smit', 'de Groot', 'Visser', 'Mulder', 'Haddad', 'Larsen', 'Petrova', 'Kowalska', 'Moreau', 'Hoekstra', 'Solberg', 'Willems'];
  const names = [];
  for (const l of lasts) for (const f of firsts) names.push(`${f} ${l}`);
  const plan = [['ind', 230], ['min', 60], ['emb', 50], ['nato', 40], ['other', 15], ['sort', 5]];
  const out = [];
  let i = 0;
  for (const [sector, n] of plan) {
    for (let j = 0; j < n; j++, i++) {
      const recent = j < 6 ? `2026-${String(10 - (j % 6)).padStart(2, '0')}-${String(1 + ((i * 7) % 27)).padStart(2, '0')}` : j < 10 ? `2025-${String(1 + (i % 12)).padStart(2, '0')}-15` : null;
      out.push(P('m' + String(i).padStart(3, '0'), names[i], sector, j % 3 ? 'Business development' : 'Engineer', sector === 'ind' ? `Company ${j}` : `${SECTORS.find((s) => s.id === sector) ? SECTORS.find((s) => s.id === sector).name : 'Elsewhere'} ${j}`, recent, { source: recent ? 'hand' : 'linkedin' }));
    }
  }
  const ties = [];
  for (const s of ['ind', 'min', 'emb', 'nato']) {
    const firstSix = out.filter((p) => p.sector === s).slice(0, 6);
    ties.push({ a: firstSix[0].id, b: firstSix[1].id, kind: 'introduced' }, { a: firstSix[2].id, b: firstSix[3].id, kind: 'works_with' });
  }
  ties.push({ a: out.find((p) => p.sector === 'min').id, b: out.find((p) => p.sector === 'ind').id, kind: 'introduced' });
  return { people: out, ties };
}

/* LinkedIn's Connections.csv as it comes: the Notes lines on top, an email for one, a company with a comma. */
const CSV = [
  'Notes:',
  '"When exporting your connection data, you may notice that some of the email addresses are missing. You will only see email addresses for connections who have allowed their connections to see or download their email address using this setting https://www.linkedin.com/psettings/privacy/email. You can learn more here https://www.linkedin.com/help/linkedin/answer/261"',
  '',
  'First Name,Last Name,URL,Email Address,Company,Position,Connected On',
  'Frank,Hoekstra,https://www.linkedin.com/in/frank-hoekstra-ex,,Ministerie van Defensie,Senior advisor,28 Jun 2023',
  'Ingrid,Solberg,https://www.linkedin.com/in/ingrid-solberg-ex,,Embassy of Norway,Counsellor,09 May 2023',
  'Tom,Visser,https://www.linkedin.com/in/tom-visser-ex,,Thales Nederland,Business development,12 Sep 2024',
  'Willem,Brouwer,https://www.linkedin.com/in/willem-brouwer-ex,willem.brouwer@example.com,Rheinmetall Nederland B.V.,Account manager,14 Jan 2022',
  'Noor,El Amrani,https://www.linkedin.com/in/noor-el-amrani-ex,,European Defence Agency,Policy officer,02 Mar 2024',
  'Daan,Willems,https://www.linkedin.com/in/daan-willems-ex,,Rabobank,Analyst,14 Jan 2022',
  'Kees,Dekker,https://www.linkedin.com/in/kees-dekker-ex,,Albert Heijn,Store manager,11 Nov 2021',
  'Lotte,van Rijn,https://www.linkedin.com/in/lotte-van-rijn-ex,,"Clingendael, Netherlands Institute of International Relations",Research fellow,05 Aug 2025',
].join('\n') + '\n';

/* ---------- The mocked hub ---------- */
const normLink = (v) => {
  try {
    const u = new URL(String(v).trim());
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
    const p = decodeURIComponent(u.pathname).replace(/\/+$/, '').toLowerCase();
    return /^\/(in|pub)\/[^/\s]+/.test(p) ? 'https://www.linkedin.com' + p : null;
  } catch (e) { return null; }
};
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const suggest = (org) => (/\b(nato|ncia|nspa|european defence agency|dg defis|eu)\b/i.test(org) ? 'nato' : /\b(embassy|ambassade|consulate)\b/i.test(org) ? 'emb'
  : /\b(ministerie|ministry|defensie|dmo|zaken)\b/i.test(org) ? 'min' : /\b(b\.?v\.?|thales|damen|rheinmetall|tno|nidv|naval)\b/i.test(org) ? 'ind' : 'sort');
const plus = (date, n) => new Date(Date.parse(date + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);

function makeHub(seed = { people: PEOPLE, ties: TIES }) {
  const w = { people: structuredClone(seed.people), ties: structuredClone(seed.ties), gets: 0, posts: [], status: 200, abort: false, postStatus: 0, n: 0 };
  const view = (p) => ({ ...p, fading: !p.lastContact || p.lastContact < FADE_BEFORE });
  const byName = (a, b) => a.name.localeCompare(b.name);
  w.answer = () => ({ today: TODAY, fadeMonths: 6, sectors: SECTORS, people: w.people.map(view).sort(byName), ties: w.ties.map((t) => ({ ...t })) });
  const find = (pid) => w.people.find((p) => p.id === pid);
  const bad = (error, status = 400) => ({ status, json: { error } });
  const out = (p) => view(find(p.id));
  function fields(b, partial) {
    const f = {};
    if (!partial || 'name' in b) { if (typeof b.name !== 'string' || !b.name.trim()) return { error: 'name required' }; f.name = b.name.trim(); }
    for (const k of ['org', 'role', 'metWhere', 'notes', 'email', 'phone']) if (k in b) f[k] = b[k] === null || b[k] === '' ? null : String(b[k]);
    if ('sector' in b) { if (!['emb', 'min', 'ind', 'nato', 'other', 'sort'].includes(b.sector)) return { error: 'sector: emb, min, ind, nato, other, sort' }; f.sector = b.sector; }
    if ('metWhen' in b) { if (b.metWhen !== null && !/^\d{4}-(0[1-9]|1[0-2])$/.test(b.metWhen)) return { error: 'metWhen: YYYY-MM' }; f.metWhen = b.metWhen; }
    if ('topics' in b) { if (b.topics !== null && !Array.isArray(b.topics)) return { error: 'topics: a list' }; f.topics = b.topics || []; if (f.topics.length > 12) return { error: 'topics: at most 12' }; }
    if ('linkedin' in b) { if (b.linkedin === null || b.linkedin === '') f.linkedin = null; else { const l = normLink(b.linkedin); if (!l) return { error: 'linkedin: a linkedin.com profile link' }; f.linkedin = l; } }
    if ('lastContact' in b) { if (b.lastContact !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(b.lastContact) || b.lastContact > TODAY)) return { error: 'lastContact: a date, not in the future' }; f.lastContact = b.lastContact; }
    return { f };
  }
  function rowsOf(csv) {
    const all = parseCsv(csv);
    const h = all.findIndex((r) => r.map((c) => c.trim().toLowerCase()).includes('first name'));
    if (h < 0) return { error: 'csv: no "First Name, Last Name" header; is this Connections.csv?' };
    const head = all[h].map((c) => c.trim().toLowerCase());
    const [fi, la, ur, co, po, on] = ['first name', 'last name', 'url', 'company', 'position', 'connected on'].map((n) => head.indexOf(n));
    const rows = [];
    for (const r of all.slice(h + 1)) {
      const name = [r[fi] || '', r[la] || ''].join(' ').trim();
      if (!name) continue;
      const org = (r[co] || '').trim() || null, role = (r[po] || '').trim() || null, linkedin = normLink(r[ur]);
      const m = (r[on] || '').match(/^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/);
      const connectedOn = m ? `${m[3]}-${String(MON[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
      const match = w.people.find((p) => (linkedin && p.linkedin === linkedin) || (p.name.toLowerCase() === name.toLowerCase() && (p.org || '').toLowerCase() === (org || '').toLowerCase()));
      rows.push({ key: linkedin || `n:${name.toLowerCase()}|${(org || '').toLowerCase()}`, name, org, role, linkedin, connectedOn, status: match ? 'match' : 'new', sector: suggest(org || '') });
    }
    return { rows };
  }
  w.handle = (parts, b) => {
    const [a0, a1, a2] = parts;
    if (parts.length === 1 && a0 === 'person') {
      const c = fields(b, false);
      if (c.error) return bad(c.error);
      const p = { ...P('x', '', 'other', null, null, null), ...c.f, id: 'new' + String(++w.n).padStart(9, '0'), sector: c.f.sector || 'other' };
      w.people.push(p);
      return { json: { person: out(p) } };
    }
    if (parts.length === 1 && a0 === 'tie') {
      let { a, b: bb, kind } = b;
      if (!find(a) || !find(bb) || a === bb) return bad('no such person', 404);
      if (!['introduced', 'works_with'].includes(kind)) return bad('kind: introduced or works_with');
      if (kind === 'works_with' && bb < a) [a, bb] = [bb, a];
      const same = (t) => t.kind === kind && ((t.a === a && t.b === bb) || (kind === 'works_with' && t.a === bb && t.b === a));
      if (b.remove === true) w.ties = w.ties.filter((t) => !same(t));
      else if (!w.ties.some(same)) w.ties.push({ a, b: bb, kind });
      return { json: { ties: w.ties.map((t) => ({ ...t })) } };
    }
    if (parts.length === 1 && a0 === 'import') {
      if (typeof b.csv !== 'string') return bad('csv: the text of Connections.csv');
      const got = rowsOf(b.csv);
      if (got.error) return bad(got.error);
      const counts = { total: got.rows.length, new: got.rows.filter((r) => r.status === 'new').length, match: got.rows.filter((r) => r.status === 'match').length };
      if (b.dry === true) return { json: { rows: got.rows, counts } };
      for (const r of got.rows) {
        if (r.status !== 'new') continue;
        const sector = ['emb', 'min', 'ind', 'nato', 'other', 'sort'].includes((b.sectors || {})[r.key]) ? b.sectors[r.key] : r.sector;
        w.people.push(P('imp' + String(++w.n).padStart(9, '0'), r.name, sector, r.role, r.org, null, { id: 'imp' + String(w.n).padStart(9, '0'), linkedin: r.linkedin, connectedOn: r.connectedOn, source: 'linkedin' }));
      }
      return { json: { added: counts.new, matched: counts.match } };
    }
    if (a0 === 'person' && a1) {
      const p = find(a1);
      if (!p) return bad('no such person', 404);
      if (!a2) {
        const c = fields(b, true);
        if (c.error) return bad(c.error);
        Object.assign(p, c.f);
        return { json: { person: out(p) } };
      }
      if (a2 === 'delete') { w.people = w.people.filter((x) => x.id !== p.id); w.ties = w.ties.filter((t) => t.a !== p.id && t.b !== p.id); return { json: { ok: true } }; }
      if (a2 === 'talked') { const d = b.date || TODAY; if (!p.lastContact || d > p.lastContact) p.lastContact = d; return { json: { person: out(p) } }; }
      if (a2 === 'reach') {
        if (!['today', 'soon'].includes(b.section) || !['wired', 'normal', 'drained'].includes(b.energy)) return bad('section: today or soon');
        if (p.reachTask) return bad('a Reach out task is already in To-do', 409);
        p.reachTask = 'task' + String(++w.n).padStart(8, '0');
        return { json: { person: out(p), task: { id: p.reachTask, text: 'Reach out to ' + p.name } } };
      }
      if (a2 === 'sent') {
        if (typeof b.what !== 'string' || !b.what.trim()) return bad('what: say what it was about');
        if (![3, 7, 14].includes(b.chaseDays) || !['email', 'phone', 'letter', 'in-person'].includes(b.channel)) return bad('chaseDays: 3, 7, 14');
        p.waiting = { id: 'w' + String(++w.n).padStart(11, '0'), what: b.what.trim(), nextChase: plus(TODAY, b.chaseDays) };
        return { json: { person: out(p), waiting: { id: p.waiting.id } } };
      }
    }
    return bad('not found', 404);
  };
  return w;
}

/* ---------- The page ---------- */
const browser = await chromium.launch();
const H = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
async function open(viewport, { hub = makeHub(), code = CODE, query = '', scale = 1 } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, hasTouch: viewport.width < 700 });
  const page = await ctx.newPage();
  const errors = [], logs = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => logs.push(m.text()));
  await page.route('**/api/network/**', (r) => {
    const q = r.request();
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: H });
    if (hub.abort) return r.abort();
    const parts = new URL(q.url()).pathname.split('/').slice(4);
    if (q.method() === 'GET') {
      hub.gets++;
      if (hub.status !== 200) return r.fulfill({ status: hub.status, json: { error: 'mocked' }, headers: H });
      return r.fulfill({ json: hub.answer(), headers: H });
    }
    const body = q.postDataJSON();
    hub.posts.push({ path: '/' + parts.join('/'), body });
    if (hub.postStatus) return r.fulfill({ status: hub.postStatus, json: { error: 'mocked' }, headers: H });
    const res = hub.handle(parts, body || {});
    return r.fulfill({ status: res.status || 200, json: res.json, headers: H });
  });
  await page.goto(BASE + 'network/' + (code ? '?c=' + code : '') + query);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  return { ctx, page, errors, logs, hub };
}
const noisy = (logs) => logs.filter((x) => !/Failed to load resource|net::ERR_/.test(x));
const wait = (page, ms = 150) => page.waitForTimeout(ms);
const lastPost = (hub) => hub.posts[hub.posts.length - 1];

const snap = (page) => page.evaluate(() => {
  const vis = (el) => !!el && !el.closest('[hidden]') && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
  const t = (el) => (typeof el === 'string' ? t(document.querySelector(el)) : el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
  const map = document.getElementById('map');
  const card = document.getElementById('card'), side = document.getElementById('side');
  const dlg = document.querySelector('dialog[open]');
  const a = document.activeElement;
  return {
    title: document.title, h1: t('h1'), back: document.getElementById('back').getAttribute('href'),
    app: vis(document.getElementById('app')), nocode: vis(document.getElementById('nocode')),
    status: t('#status'), away: vis(document.getElementById('away')) ? t('#away') : '', empty: vis(document.getElementById('empty')) ? t('#empty p') : '',
    legend: vis(document.getElementById('legend')) ? t('#legend') : '', sortBtn: vis(document.getElementById('sortBtn')) ? t('#sortBtn') : '',
    search: { ph: document.getElementById('q').placeholder, value: document.getElementById('q').value }, fade: { text: document.getElementById('fadeOnly').innerText.trim(), pressed: document.getElementById('fadeOnly').getAttribute('aria-pressed') },
    zones: [...map.querySelectorAll('.zone')].map((z) => ({ ...box(z), bg: getComputedStyle(z).backgroundColor })),
    heads: [...map.querySelectorAll('.zone-h')].map((h) => ({ name: t(h.querySelector('h3')), n: t(h.querySelector('.zone-n')), bg: getComputedStyle(h).backgroundColor, ...box(h) })),
    nodes: [...map.querySelectorAll('.node[data-id]')].map((b) => {
      const dot = b.querySelector('.dot'), nm = b.querySelector('.nm'), r = dot.getBoundingClientRect();
      return {
        id: b.dataset.id, label: b.getAttribute('aria-label'), name: t(nm), note: t(b.querySelector('.fd')), ini: t(dot), op: +getComputedStyle(dot).opacity, dim: b.classList.contains('is-dim'),
        sel: b.classList.contains('is-sel'), exp: b.getAttribute('aria-expanded'), fill: getComputedStyle(dot).backgroundColor, ink: getComputedStyle(dot).color, ring: getComputedStyle(dot).boxShadow,
        cut: (() => { const f = b.querySelector('.fd'); return !!f && f.scrollWidth > f.clientWidth + 0.5; })(), nmBg: getComputedStyle(nm).backgroundColor, nmPx: parseFloat(getComputedStyle(nm).fontSize), cx: r.x + r.width / 2, cy: r.y + r.height / 2, R: r.width / 2, ...box(b),
      };
    }),
    more: [...map.querySelectorAll('[data-more]')].map((b) => ({ s: b.dataset.more, label: b.getAttribute('aria-label'), text: t(b.querySelector('.dot')), ...box(b) })),
    lines: [...map.querySelectorAll('line.ln')].map((l) => ({ a: l.dataset.a, b: l.dataset.b, kind: l.dataset.kind, dash: l.getAttribute('stroke-dasharray'), marker: l.getAttribute('marker-end'), stroke: l.getAttribute('stroke'), w: +l.getAttribute('stroke-width'), op: l.getAttribute('opacity') })),
    bands: [...map.querySelectorAll('.band')].map((b) => ({ label: b.getAttribute('aria-label'), sw: b.scrollWidth, cw: b.clientWidth, n: b.querySelectorAll('.node[data-id]').length, ...box(b) })),
    side: vis(side) ? { ...box(side), h2: t('#sideH'), sub: t('#sideSub'), sheet: side.classList.contains('is-sheet'), rows: [...side.querySelectorAll('.pr')].map((b) => [t(b.querySelector('.pr-name')), t(b.querySelector('.pr-when'))]), groups: [...side.querySelectorAll('.sg')].map(t), none: t(side.querySelector('.side-none')), selects: side.querySelectorAll('select[data-sort]').length } : null,
    card: vis(card) ? {
      ...box(card), h2: t('#cardH'), role: t(card.querySelector('.c-role')), sec: t(card.querySelector('.c-sec')), last: [...card.querySelectorAll('.c-last > span')].map(t).join(' '), av: t(card.querySelector('.av')), avBg: getComputedStyle(card.querySelector('.av')).backgroundColor,
      acts: [...card.querySelectorAll('.c-acts button')].map((b) => t(b) + (b.classList.contains('btn-go') ? '*' : '')), state: [...card.querySelectorAll('.c-state li')].map(t), stateHref: card.querySelector('.c-state a') ? card.querySelector('.c-state a').getAttribute('href') : '',
      fields: Object.fromEntries([...card.querySelectorAll('.f')].map((f) => [t(f.querySelector('dt')), t(f.querySelector('dd'))])), tags: [...card.querySelectorAll('.f-tags .tag')].map(t),
      links: [...card.querySelectorAll('.f dd a')].map((x) => x.getAttribute('href')), err: t(card.querySelector('.err')),
    } : null,
    scrim: vis(document.getElementById('scrim')),
    dialog: dlg ? { id: dlg.id, ...box(dlg) } : null,
    toast: vis(document.getElementById('toast')) ? t('#toast') : '',
    focus: a ? a.id || a.dataset.id || a.dataset.act || a.dataset.more || a.tagName : '',
    url: location.search,
    targets: [...document.querySelectorAll('a, button, input, select, textarea')].filter(vis).filter((el) => !el.closest('dialog:not([open])')).map((el) => {
      const r = el.getBoundingClientRect();
      return { what: el.id || el.dataset.id || el.dataset.act || el.getAttribute('aria-label') || el.textContent.trim().slice(0, 30) || el.tagName, w: Math.round(r.width), h: Math.round(r.height), inline: el.classList.contains('inl') || !!el.closest('.f dd') };
    }),
    overflow: document.documentElement.scrollWidth > innerWidth,
  };
});
const inside = (n, z, m = 0.5) => n.x >= z.x - m && n.y >= z.y - m && n.x + n.w <= z.x + z.w + m && n.y + n.h <= z.y + z.h + m;
const overlap = (a, b, m = 1) => a.x + m < b.x + b.w && b.x + m < a.x + a.w && a.y + m < b.y + b.h && b.y + m < a.y + a.h;
const small = (s, wide) => s.targets.filter((x) => x.h < 44 || (!x.inline && x.w < 44)).map((x) => `${x.what} ${x.w}x${x.h}`);
const nodeOf = (s, k) => s.nodes.find((n) => n.id === id(k));
const zoneOf = (s, sector) => s.zones[ORDER.indexOf(sector)];

/* ---------- 1. The PC: the map, nobody open ---------- */
{
  const { ctx, page, errors, logs } = await open({ width: 1440, height: 900 });
  const s = await snap(page);
  check(s.title === 'Network' && s.h1 === 'Network' && s.back === '../?c=' + CODE, 'pc: the title and the way back with the code');
  check(s.search.ph === 'Search a name, organisation or topic' && s.fade.text === 'Fading only' && s.fade.pressed === 'false', 'pc: search and Fading only in the header: ' + JSON.stringify([s.search.ph, s.fade.text]));
  check(s.heads.map((h) => `${h.name} ${h.n}`).join(' | ') === 'Embassies 4 people | Ministries 4 people | Industry 4 people | NATO and EU 4 people | Other 2 people', 'pc: five zones with their counts: ' + s.heads.map((h) => h.name + ' ' + h.n).join(', '));
  check(s.zones.every((z, i) => z.bg === ZONE[ORDER[i]]) && s.heads.every((h, i) => h.bg === ZONE[ORDER[i]]), 'pc: each zone and its heading in its approved colour');
  const [e, m, i, n, o] = s.zones;
  check(Math.abs(e.y - m.y) < 1 && Math.abs(i.y - n.y) < 1 && Math.abs(e.x - i.x) < 1 && Math.abs(m.x - n.x) < 1 && m.x > e.x + e.w && i.y > e.y + e.h && Math.abs(e.w - m.w) < 1,
    'pc: Embassies, Ministries, Industry, NATO and EU as the 2 x 2 grid');
  check(o.y > i.y + i.h && Math.abs(o.x - e.x) < 1 && Math.abs(o.x + o.w - (m.x + m.w)) < 1, 'pc: Other as a band under the grid, the full width');
  check(Math.abs(e.x - 24) < 1.5 && Math.abs(e.y - 92) < 4 && e.h > 290 && o.h <= 124, 'pc: the map starts where the mockup does: ' + JSON.stringify({ x: e.x, y: e.y, h: e.h }));
  const onMap = PEOPLE.filter((p) => p.sector !== 'sort');
  check(s.nodes.length === onMap.length && onMap.every((p) => inside(s.nodes.find((x) => x.id === p.id), zoneOf(s, p.sector))), 'pc: every person on the map in their own zone, none to sort: ' + s.nodes.length);
  const clash = [];
  for (let a = 0; a < s.nodes.length; a++) for (let b = a + 1; b < s.nodes.length; b++) if (overlap(s.nodes[a], s.nodes[b])) clash.push(s.nodes[a].name + '/' + s.nodes[b].name);
  check(!clash.length, 'pc: no node on another: ' + clash);
  check(s.nodes.every((x) => x.fill === FILL[PEOPLE.find((p) => p.id === x.id).sector] && x.nmBg === ZONE[PEOPLE.find((p) => p.id === x.id).sector]),
    'pc: circles in the sector colour, names on the zone colour');
  check(nodeOf(s, 'henrik').ink === 'rgb(255, 255, 255)' && nodeOf(s, 'anna').ink === 'rgb(21, 24, 28)' && nodeOf(s, 'anna').ini === 'AV' && nodeOf(s, 'pieter').ini === 'PG', 'pc: initials, white on NATO and EU');
  check(nodeOf(s, 'anna').name === 'Anna de Vries' && nodeOf(s, 'anna').R === 24 && nodeOf(s, 'anna').nmPx === 14, 'pc: few people: full names, 48 px circles');
  const fades = Object.fromEntries(['lars', 'sofia', 'nadia', 'bram'].map((k) => [k, nodeOf(s, k).note]));
  check(JSON.stringify(fades) === JSON.stringify({ lars: '8 mo', sofia: '13 mo', nadia: '7 mo', bram: '' }) && ['lars', 'sofia', 'nadia', 'bram'].every((k) => nodeOf(s, k).op === 0.4) &&
    s.nodes.filter((x) => !['lars', 'sofia', 'nadia', 'bram'].map(id).includes(x.id)).every((x) => x.op === 1 && !x.note), 'pc: faded at 0.4, the amber note only with a date (never contacted: no note): ' + JSON.stringify(fades));
  check(nodeOf(s, 'lars').label === 'Lars Eriksen, Political officer, Embassy of Norway, no contact for 8 months' && nodeOf(s, 'bram').label === 'Bram Kuipers, Alumni coordinator, Leiden University, no contact yet' &&
    nodeOf(s, 'anna').label === 'Anna de Vries, Policy advisor, Ministerie van Defensie', 'pc: each node says who, and how long: ' + nodeOf(s, 'lars').label);
  const dashed = s.lines.filter((l) => l.kind === 'introduced'), solid = s.lines.filter((l) => l.kind === 'works_with');
  check(dashed.length === 5 && solid.length === 5 && dashed.every((l) => l.dash === '6 5' && l.marker === 'url(#ahm)') && solid.every((l) => !l.dash && !l.marker) && s.lines.every((l) => l.stroke === LINE && l.w === 1.4),
    'pc: five dashed arrows (introduced) and five lines (work together), all quiet');
  check(dashed.some((l) => l.a === id('mark') && l.b === id('anna')) && dashed.some((l) => l.a === id('claire') && l.b === id('jean')), 'pc: an arrow runs from the introducer to the introduced');
  check(s.legend === 'Dashed arrow: introduced · Line: work together · Faded: no contact for 6 months' && s.sortBtn === '4 to sort', 'pc: the legend and 4 to sort');
  check(s.side && s.side.h2 === 'People to get back to' && s.side.sub === 'No contact for 6 months or more, longest first' && Math.round(s.side.w) === 404 && Math.abs(s.side.x + s.side.w - 1416) < 1.5, 'pc: the 404 px panel: People to get back to');
  check(JSON.stringify(s.side.rows) === JSON.stringify([['Sofia Morales', '13 mo'], ['Lars Eriksen', '8 mo'], ['Nadia Haddad', '7 mo'], ['Bram Kuipers', ''], ['Daan Willems', ''], ['Iris Vermeulen', ''], ['Joost van Dam', ''], ['Sanne de Boer', '']]) &&
    s.side.groups.join() === 'No contact yet · 5', 'pc: longest without contact first, then No contact yet (yours before LinkedIn): ' + JSON.stringify(s.side.rows));
  check(!small(s).length && !s.overflow, 'pc: 44 px targets, nothing sideways: ' + small(s));
  await page.screenshot({ path: file('net-pc') });

  // Anna: the card in the panel, every part of it.
  await page.click(`.node[data-id="${id('anna')}"]`);
  await wait(page);
  let c = await snap(page);
  check(c.card && !c.side && Math.round(c.card.w) === 404 && Math.abs(c.card.x + c.card.w - 1416) < 1.5 && c.focus === 'cardH' && /p=anna00000000/.test(c.url), 'pc: a click opens the card in the panel, the focus on the name, ?p= in the address');
  check(c.card.h2 === 'Anna de Vries' && c.card.role === 'Policy advisor · Ministerie van Defensie' && c.card.sec === 'Ministries' && c.card.av === 'AV' && c.card.avBg === FILL.min, 'pc: name, role · organisation, sector, initials');
  check(c.card.last === 'Last contact 2 Oct 2026 3 weeks ago', 'pc: Last contact with the relative words: ' + c.card.last);
  check(c.card.acts.join() === 'Talked today*,Reach out,Sent a message,Edit', 'pc: the four buttons, Talked today the green one');
  check(c.card.fields['Where you met'] === 'Defensie career event, Den Haag · March 2026', 'pc: Where you met · when: ' + c.card.fields['Where you met']);
  check(c.card.fields['How you are connected'] === 'Introduced by Mark Jansen · works with Ruben Smit · introduced you to Henrik Larsen', 'pc: How you are connected: ' + c.card.fields['How you are connected']);
  check(c.card.tags.join() === 'Defence procurement,Economic security,Latin America' && c.card.fields['Your notes'] === 'Asked me to keep her posted on the DMO vacancy.', 'pc: topics and notes');
  check(c.card.fields.Email === 'anna.devries@example.org' && c.card.fields.Phone === '+31 6 1234 5678' && c.card.fields.LinkedIn === 'linkedin.com/in/anna-de-vries-example' &&
    c.card.links.join() === 'mailto:anna.devries@example.org,tel:+31612345678,https://www.linkedin.com/in/anna-de-vries-example', 'pc: email, phone and LinkedIn as links');
  check(!c.card.state.length && !c.card.fields['Connected on LinkedIn'], 'pc: no task, no wait, no LinkedIn date yet');
  const an = nodeOf(c, 'anna');
  check(an.sel && an.exp === 'true' && /rgb\(21, 24, 28\)/.test(an.ring), 'pc: Anna has the ring');
  const hiL = c.lines.filter((l) => l.stroke === INK);
  check(hiL.length === 3 && hiL.every((l) => (l.a === id('anna') || l.b === id('anna')) && l.w === 2.2) && hiL.filter((l) => l.kind === 'introduced').every((l) => l.marker === 'url(#ah)') && c.lines.filter((l) => l.stroke === LINE).length === 7,
    'pc: her three lines dark, the rest quiet');
  await page.screenshot({ path: file('net-pc-card') });
  await page.keyboard.press('Escape');
  await wait(page);
  c = await snap(page);
  check(!c.card && c.side && c.focus === id('anna') && !/p=/.test(c.url), 'pc: Escape closes it, the focus back on Anna, the panel back to People to get back to');
  await page.click(`.node[data-id="${id('anna')}"]`);
  await wait(page);
  await page.click('.inl[data-go="' + id('henrik') + '"]');
  await wait(page);
  c = await snap(page);
  check(c.card.h2 === 'Henrik Larsen' && c.card.fields['How you are connected'] === 'Introduced by Anna de Vries · works with Olga Petrova' && nodeOf(c, 'henrik').sel, 'pc: a name in How you are connected opens that person');
  await page.click('#cardClose');
  await wait(page);
  c = await snap(page);
  check(!c.card && c.focus === id('henrik'), 'pc: × closes and gives the focus back to the node');
  await page.click(`.node[data-id="${id('olga')}"]`);
  await wait(page);
  await page.mouse.click(s.zones[4].x + 20, s.zones[4].y + 100);
  await wait(page);
  check(!(await snap(page)).card, 'pc: a click on the empty map puts the card away');
  check(errors.length === 0 && noisy(logs).length === 0, 'pc: nothing in the console: ' + errors.concat(noisy(logs)).join('; '));
  await ctx.close();
}

/* ---------- 2. Talked today, Reach out, Sent a message ---------- */
{
  const { ctx, page, errors, logs, hub } = await open({ width: 1440, height: 900 });
  await page.click(`.node[data-id="${id('lars')}"]`);
  await wait(page);
  let s = await snap(page);
  check(s.card.last === 'Last contact 14 Feb 2026 8 months ago', 'talked: Lars before: ' + s.card.last);
  await page.click('[data-act="talked"]');
  await wait(page, 250);
  s = await snap(page);
  const tp = lastPost(hub);
  check(tp.path === `/person/${id('lars')}/talked` && JSON.stringify(tp.body) === '{}', 'talked: one tap posts /talked with {}');
  check(s.card.last === 'Last contact 22 Oct 2026 Today' && nodeOf(s, 'lars').op === 1 && !nodeOf(s, 'lars').note && s.toast === 'Last contact with Lars Eriksen is today.' && s.focus === 'talked', 'talked: the card says today, the node is no longer faded: ' + s.card.last);
  await page.keyboard.press('Escape');
  await wait(page);
  check(!(await snap(page)).side.rows.some((r) => r[0] === 'Lars Eriksen'), 'talked: Lars has left People to get back to');

  // Reach out: the sheet, Escape, then Today and Wired.
  await page.click(`.node[data-id="${id('anna')}"]`);
  await wait(page);
  await page.click('[data-act="reach"]');
  await wait(page);
  s = await snap(page);
  const rs = await page.evaluate(() => ({ text: document.getElementById('reachText').textContent, on: [...document.querySelectorAll('#reach [aria-pressed="true"]')].map((b) => b.textContent), hint: document.querySelector('#reach .hint').textContent }));
  check(s.dialog && s.dialog.id === 'reach' && rs.text === 'Reach out to Anna de Vries' && rs.on.join() === 'Soon,Normal' && s.focus === 'reachGo', 'reach: the sheet with the task, Soon and Normal picked, the focus on Make the task: ' + JSON.stringify(rs));
  await page.screenshot({ path: file('net-pc-reach') });
  await page.keyboard.press('Escape');
  await wait(page);
  s = await snap(page);
  check(!s.dialog && s.focus === 'reach' && hub.posts.length === 1, 'reach: Escape closes it with nothing sent, the focus back on Reach out');
  await page.click('[data-act="reach"]');
  await wait(page);
  await page.click('#reach [data-v="today"]');
  await page.click('#reach [data-v="wired"]');
  await page.click('#reachGo');
  await wait(page, 250);
  s = await snap(page);
  const rp = lastPost(hub);
  check(rp.path === `/person/${id('anna')}/reach` && JSON.stringify(rp.body) === '{"section":"today","energy":"wired"}', 'reach: posts the section and energy picked: ' + JSON.stringify(rp.body));
  check(!s.dialog && s.card.state.join() === 'Reach out task in To-do' && s.card.stateHref === '../../todo/?c=' + CODE && s.toast === 'Reach out to Anna de Vries is in To-do · Today', 'reach: the card shows the task in To-do: ' + s.card.state);
  await page.click('[data-act="reach"]');
  await wait(page);
  await page.click('#reachGo');
  await wait(page, 250);
  const err = await page.evaluate(() => document.getElementById('reachErr').textContent);
  s = await snap(page);
  check(s.dialog && s.dialog.id === 'reach' && err === 'There is already a Reach out task for this person in To-do.', 'reach: a second task: the hub says 409 and the sheet says so: ' + err);
  await page.click('#reach [data-close]');
  await wait(page);

  // Sent a message: About is needed; Phone, 14 days.
  await page.click('[data-act="sent"]');
  await wait(page);
  s = await snap(page);
  const sn = await page.evaluate(() => ({ intro: document.getElementById('sentIntro').textContent, on: [...document.querySelectorAll('#sent [aria-pressed="true"]')].map((b) => b.textContent) }));
  check(s.dialog.id === 'sent' && s.focus === 'sentWhat' && sn.on.join() === 'Email,7 days' && sn.intro === 'You sent Anna de Vries something and are waiting for an answer. It goes into Waiting on like any other.', 'sent: the sheet, Email and 7 days picked, the focus in About');
  const before = hub.posts.length;
  await page.click('#sentGo');
  await wait(page);
  const se = await page.evaluate(() => ({ err: document.getElementById('sentErr').textContent, inv: document.getElementById('sentWhat').getAttribute('aria-invalid') }));
  check(hub.posts.length === before && se.err === 'Say what it was about.' && se.inv === 'true', 'sent: About is needed, nothing is sent without it');
  await page.fill('#sentWhat', 'The DMO vacancy');
  await page.click('#sent [data-v="phone"]');
  await page.click('#sent [data-v="14"]');
  await page.screenshot({ path: file('net-pc-sent') });
  await page.click('#sentGo');
  await wait(page, 250);
  s = await snap(page);
  const sp = lastPost(hub);
  check(sp.path === `/person/${id('anna')}/sent` && JSON.stringify(sp.body) === '{"what":"The DMO vacancy","channel":"phone","chaseDays":14}', 'sent: posts what, channel and chase days: ' + JSON.stringify(sp.body));
  check(!s.dialog && s.card.state.join(' / ') === 'Reach out task in To-do / Waiting for an answer about The DMO vacancy · chase 5 Nov' && s.toast === 'Waiting on Anna de Vries about The DMO vacancy', 'sent: the card shows the wait and the chase day: ' + s.card.state.join(' / '));
  await page.screenshot({ path: file('net-pc-card-state') });
  check(errors.length === 0 && noisy(logs).length === 0, 'actions: nothing in the console: ' + errors.concat(noisy(logs)).join('; '));
  await ctx.close();
}

/* ---------- 3. Add a person with links and topics ---------- */
{
  const { ctx, page, errors, logs, hub } = await open({ width: 1440, height: 900 });
  await page.click('#addBtn');
  await wait(page);
  let s = await snap(page);
  const f0 = await page.evaluate(() => ({ h: document.getElementById('pfH').textContent, rm: !document.getElementById('pfRemove').hidden, chips: [...document.querySelectorAll('#pfSec .chip')].map((b) => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')) }));
  check(s.dialog && s.dialog.id === 'form' && f0.h === 'Add a person' && !f0.rm && s.focus === 'pfName' && f0.chips.join() === 'Embassies,Ministries,Industry,NATO and EU,Other', 'add: the form, five sector chips, no Remove, the focus on Name: ' + f0.chips);
  await page.click('#pfSave');
  await wait(page);
  const e0 = await page.evaluate(() => document.getElementById('pfErr').textContent);
  check(e0 === 'Give the person a name.' && hub.posts.length === 0, 'add: a name is needed, nothing sent without it');
  await page.fill('#pfName', 'Pim Bosman');
  await page.fill('#pfOrg', 'NCIA');
  await page.fill('#pfRole', 'Programme officer');
  await page.click('#pfSec [data-v="nato"]');
  await page.fill('#pfWhere', 'NIDV symposium, Rotterdam');
  await page.fill('#pfWhen', '2025-11');
  await page.fill('#pfNotes', 'Said NCIA hires in spring.');
  await page.fill('#pfEmail', 'pim.bosman@example.org');
  await page.fill('#pfPhone', '+32 2 555 0100');
  await page.fill('#pfLinkedin', 'https://www.linkedin.com/in/pim-bosman-ex');
  await page.fill('#pfLast', '2026-10-14');
  // Topics: two kept, one taken off again.
  await page.click('#topicOpen');
  await page.fill('#pfTopic', 'NATO procurement');
  await page.press('#pfTopic', 'Enter');
  await page.fill('#pfTopic', 'Careers');
  await page.click('#pfTopicGo');
  await page.fill('#pfTopic', 'Typo');
  await page.press('#pfTopic', 'Enter');
  await page.click('[data-untopic="2"]');
  const topics = await page.evaluate(() => [...document.querySelectorAll('#pfTopics .tag-x')].map((x) => x.firstChild.textContent));
  check(topics.join() === 'NATO procurement,Careers', 'add: topics added with Enter and Add, one taken off: ' + topics);
  // Links: Introduced by Anna, Works with Olga, Introduced to Marta (then taken off).
  await page.click('#pkOpen');
  await wait(page, 80);
  check(await page.evaluate(() => document.activeElement.id === 'pkQ' && !document.getElementById('picker').hidden), 'add: + Link a person opens the picker, the focus in Find a person');
  await page.fill('#pkQ', 'anna');
  await wait(page, 60);
  const found = await page.evaluate(() => [...document.querySelectorAll('#pkList .pk-n')].map((x) => x.textContent));
  check(found.join() === 'Anna de Vries', 'add: the picker finds by name: ' + found);
  await page.click(`#pkList [data-link="${id('anna')}"]`);
  await page.click('#pkOpen');
  await page.click('#picker [data-v="with"]');
  await page.fill('#pkQ', 'ncia');
  await page.press('#pkQ', 'Enter');
  await page.click('#pkOpen');
  await page.click('#picker [data-v="to"]');
  await page.fill('#pkQ', 'mar');
  await wait(page, 60);
  const mar = await page.evaluate(() => [...document.querySelectorAll('#pkList .pk-n')].map((x) => x.textContent));
  check(mar.join() === 'Mark Jansen,Marta Kowalska', 'add: and by organisation or part of a name: ' + mar);
  await page.click(`#pkList [data-link="${id('marta')}"]`);
  let links = await page.evaluate(() => [...document.querySelectorAll('#pfTies .tag-x')].map((x) => x.firstChild.textContent));
  check(links.join() === 'Introduced by Anna de Vries,Works with Olga Petrova,Introduced you to Marta Kowalska', 'add: three links: ' + links);
  await page.click('[data-unlink="2"]');
  await page.click('#pkOpen');
  await page.keyboard.press('Escape');
  await wait(page, 80);
  const pk = await page.evaluate(() => ({ picker: document.getElementById('picker').hidden, open: document.getElementById('form').open, focus: document.activeElement.id }));
  check(pk.picker && pk.open && pk.focus === 'pkOpen', 'add: Escape in the picker closes only the picker');
  links = await page.evaluate(() => [...document.querySelectorAll('#pfTies .tag-x')].map((x) => x.firstChild.textContent));
  check(links.join() === 'Introduced by Anna de Vries,Works with Olga Petrova', 'add: a link taken off again');
  s = await snap(page);
  check(!small(s).length, 'add: 44 px in the form: ' + small(s));
  await page.screenshot({ path: file('net-pc-add') });
  await page.click('#pfSave');
  await wait(page, 350);
  const add = hub.posts.find((p) => p.path === '/person');
  check(add && JSON.stringify(add.body) === JSON.stringify({ name: 'Pim Bosman', org: 'NCIA', role: 'Programme officer', metWhere: 'NIDV symposium, Rotterdam', notes: 'Said NCIA hires in spring.', email: 'pim.bosman@example.org', phone: '+32 2 555 0100', linkedin: 'https://www.linkedin.com/in/pim-bosman-ex', lastContact: '2026-10-14', metWhen: '2025-11', sector: 'nato', topics: ['NATO procurement', 'Careers'] }),
    'add: POST /person with every field: ' + JSON.stringify(add && add.body));
  const newId = hub.people.find((p) => p.name === 'Pim Bosman').id;
  const ties = hub.posts.filter((p) => p.path === '/tie').map((p) => p.body);
  check(JSON.stringify(ties) === JSON.stringify([{ a: id('anna'), b: newId, kind: 'introduced' }, { a: newId, b: id('olga'), kind: 'works_with' }]), 'add: then a tie for each link: ' + JSON.stringify(ties));
  s = await snap(page);
  const pim = s.nodes.find((x) => x.id === newId);
  check(!s.dialog && s.card && s.card.h2 === 'Pim Bosman' && s.card.fields['How you are connected'] === 'Introduced by Anna de Vries · works with Olga Petrova' && s.card.tags.join() === 'NATO procurement,Careers' && s.card.fields['Where you met'] === 'NIDV symposium, Rotterdam · November 2025',
    'add: the new card: ' + JSON.stringify(s.card && s.card.fields));
  check(pim && pim.sel && inside(pim, zoneOf(s, 'nato')) && s.heads[3].n === '5 people' && s.lines.filter((l) => l.a === newId || l.b === newId).length === 2 && s.toast === 'Pim Bosman is in your network.', 'add: on the map in NATO and EU with its two lines');
  check(errors.length === 0 && noisy(logs).length === 0, 'add: nothing in the console: ' + errors.concat(noisy(logs)).join('; '));
  await ctx.close();
}

/* ---------- 4. Edit, and Remove with its confirm step ---------- */
{
  const { ctx, page, errors, logs, hub } = await open({ width: 1440, height: 900 });
  await page.click(`.node[data-id="${id('anna')}"]`);
  await wait(page);
  await page.click('[data-act="edit"]');
  await wait(page);
  const f = await page.evaluate(() => ({
    h: document.getElementById('pfH').textContent, name: document.getElementById('pfName').value, role: document.getElementById('pfRole').value, when: document.getElementById('pfWhen').value, last: document.getElementById('pfLast').value,
    sec: [...document.querySelectorAll('#pfSec [aria-pressed="true"]')].map((b) => b.textContent).join(), topics: [...document.querySelectorAll('#pfTopics .tag-x')].map((x) => x.firstChild.textContent),
    links: [...document.querySelectorAll('#pfTies .tag-x')].map((x) => x.firstChild.textContent), rm: !document.getElementById('pfRemove').hidden,
  }));
  check(f.h === 'Edit' && f.name === 'Anna de Vries' && f.role === 'Policy advisor' && f.when === '2026-03' && f.last === '2026-10-02' && f.sec === 'Ministries' && f.topics.length === 3 && f.rm &&
    f.links.join() === 'Introduced by Mark Jansen,Works with Ruben Smit,Introduced you to Henrik Larsen', 'edit: the form filled in: ' + JSON.stringify(f));
  await page.fill('#pfRole', 'Senior policy advisor');
  await page.click('[data-untopic="2"]');
  await page.click('[data-unlink="1"]');
  await page.click('#pfSave');
  await wait(page, 300);
  const up = hub.posts.find((p) => p.path === `/person/${id('anna')}`), rm = hub.posts.find((p) => p.path === '/tie');
  check(up && JSON.stringify(up.body) === '{"role":"Senior policy advisor","topics":["Defence procurement","Economic security"]}', 'edit: POST /person/:id with only what changed: ' + JSON.stringify(up && up.body));
  check(rm && JSON.stringify(rm.body) === JSON.stringify({ a: id('anna'), b: id('ruben'), kind: 'works_with', remove: true }), 'edit: a link taken off is removed: ' + JSON.stringify(rm && rm.body));
  let s = await snap(page);
  check(s.card.role === 'Senior policy advisor · Ministerie van Defensie' && s.card.tags.length === 2 && s.card.fields['How you are connected'] === 'Introduced by Mark Jansen · introduced you to Henrik Larsen' && s.toast === 'Saved.' &&
    !s.lines.some((l) => l.kind === 'works_with' && [l.a, l.b].includes(id('ruben'))), 'edit: the card and the map follow');
  // Remove Jean: Keep first, then Remove.
  await page.click(`.node[data-id="${id('jean')}"]`);
  await wait(page);
  await page.click('[data-act="edit"]');
  await wait(page);
  await page.click('#rmAsk');
  await wait(page, 80);
  const rmq = await page.evaluate(() => ({ text: document.getElementById('rmText').textContent, focus: document.activeElement.id, shown: !document.getElementById('rmConfirm').hidden }));
  check(rmq.shown && rmq.text === 'Remove Jean Moreau from your network? Their links go too.' && rmq.focus === 'rmKeep', 'remove: asks first, the focus on Keep');
  await page.click('#rmKeep');
  await wait(page, 60);
  check(await page.evaluate(() => document.getElementById('rmConfirm').hidden && document.activeElement.id === 'rmAsk') && !hub.posts.some((p) => /delete/.test(p.path)), 'remove: Keep keeps');
  await page.click('#rmAsk');
  await page.screenshot({ path: file('net-pc-edit-remove') });
  await page.click('#rmGo');
  await wait(page, 300);
  s = await snap(page);
  const del = hub.posts.find((p) => /delete$/.test(p.path));
  check(del && del.path === `/person/${id('jean')}/delete` && JSON.stringify(del.body) === '{}', 'remove: POST /person/:id/delete');
  check(!s.dialog && !s.card && !nodeOf(s, 'jean') && s.heads[3].n === '3 people' && !s.lines.some((l) => [l.a, l.b].includes(id('jean'))) && s.toast === 'Jean Moreau is no longer in your network.', 'remove: gone from the map with the links');
  check(errors.length === 0 && noisy(logs).length === 0, 'edit: nothing in the console: ' + errors.concat(noisy(logs)).join('; '));
  await ctx.close();
}

/* ---------- 5. Search and Fading only ---------- */
{
  const { ctx, page, errors, logs } = await open({ width: 1440, height: 900 });
  await page.click('#q');
  await page.keyboard.type('thales');
  await wait(page);
  let s = await snap(page);
  check(s.nodes.filter((x) => !x.dim).map((x) => x.name).join() === 'Tom Visser' && s.card && s.card.h2 === 'Tom Visser' && s.focus === 'q', 'search: an organisation: only Tom stays lit; one match opens him and the focus stays in the box');
  await page.screenshot({ path: file('net-pc-search') });
  await page.keyboard.press('Escape');
  await wait(page);
  s = await snap(page);
  check(!s.card && s.focus === 'q' && s.search.value === 'thales', 'search: Escape closes the card first');
  await page.fill('#q', 'procurement');
  await wait(page);
  s = await snap(page);
  check(s.nodes.filter((x) => !x.dim).map((x) => x.name).sort().join() === 'Anna de Vries,Henrik Larsen' && !s.card, 'search: a role and a topic match; two matches open nothing');
  check(s.lines.filter((l) => l.op === '0.22').length === s.lines.filter((l) => ![l.a, l.b].every((x) => [id('anna'), id('henrik')].includes(x))).length, 'search: lines to a dimmed person dim too');
  await page.press('#q', 'Enter');
  await wait(page);
  s = await snap(page);
  check(s.card && s.card.h2 === 'Anna de Vries' && s.focus === 'cardH', 'search: Enter opens the first match');
  await page.keyboard.press('Escape');
  await page.focus('#q');
  await page.keyboard.press('Escape');
  await wait(page);
  s = await snap(page);
  check(s.search.value === '' && s.nodes.every((x) => !x.dim), 'search: Escape in the box clears it');
  await page.click('#fadeOnly');
  await wait(page);
  s = await snap(page);
  check(s.fade.pressed === 'true' && s.nodes.filter((x) => !x.dim).map((x) => x.name).sort().join() === 'Bram Kuipers,Lars Eriksen,Nadia Haddad,Sofia Morales', 'fading only: everyone else dims');
  await page.screenshot({ path: file('net-pc-fading') });
  await page.click('#fadeOnly');
  await wait(page);
  s = await snap(page);
  check(s.fade.pressed === 'false' && s.nodes.every((x) => !x.dim), 'fading only: off again');
  check(errors.length === 0 && noisy(logs).length === 0, 'search: nothing in the console');
  await ctx.close();
}

/* ---------- 6. To sort ---------- */
{
  const { ctx, page, errors, logs, hub } = await open({ width: 1440, height: 900 });
  await page.click('#sortBtn');
  await wait(page);
  let s = await snap(page);
  check(s.side.h2 === 'To sort' && s.side.rows.map((r) => r[0]).join() === 'Daan Willems,Iris Vermeulen,Joost van Dam,Sanne de Boer' && s.side.selects === 4 && s.focus === 'sideH' &&
    (await page.getAttribute('#sortBtn', 'aria-expanded')) === 'true', 'sort: the four, each with a sector to pick');
  await page.screenshot({ path: file('net-pc-sort') });
  await page.selectOption(`select[data-sort="${id('daan')}"]`, 'ind');
  await wait(page, 300);
  s = await snap(page);
  const sp = lastPost(hub);
  check(sp.path === `/person/${id('daan')}` && JSON.stringify(sp.body) === '{"sector":"ind"}', 'sort: POST /person/:id with the sector');
  check(s.side.rows.length === 3 && s.sortBtn === '3 to sort' && nodeOf(s, 'daan') && inside(nodeOf(s, 'daan'), zoneOf(s, 'ind')) && s.heads[2].n === '5 people' && s.toast === 'Daan Willems is on the map in Industry.', 'sort: Daan moves onto the map in Industry');
  await page.click(`#sideBody .pr[data-id="${id('iris')}"]`);
  await wait(page);
  s = await snap(page);
  check(s.card && s.card.h2 === 'Iris Vermeulen' && s.card.sec === 'To sort, off the map' && s.card.last === 'Last contact No contact yet', 'sort: a name opens the card');
  await page.keyboard.press('Escape');
  await wait(page);
  s = await snap(page);
  check(!s.card && s.side.h2 === 'To sort' && s.focus === id('iris'), 'sort: Escape goes back to the list, on the same row');
  await page.keyboard.press('Escape');
  await wait(page);
  s = await snap(page);
  check(s.side.h2 === 'People to get back to' && s.focus === 'sortBtn', 'sort: Escape again: back to People to get back to');
  check(errors.length === 0 && noisy(logs).length === 0, 'sort: nothing in the console');
  await ctx.close();
}

/* ---------- 7. About 400 people ---------- */
{
  const many = manyPeople();
  const hub = makeHub(many);
  const { ctx, page, errors, logs } = await open({ width: 1440, height: 900 }, { hub });
  let s = await snap(page);
  const per = Object.fromEntries(ORDER.map((k) => [k, many.people.filter((p) => p.sector === k).length]));
  check(s.heads.map((h) => h.n).join() === ORDER.map((k) => `${per[k]} people`).join(), 'many: the counts: ' + s.heads.map((h) => h.n));
  const sec = Object.fromEntries(many.people.map((p) => [p.id, p.sector]));
  check(s.nodes.every((x) => inside(x, zoneOf(s, sec[x.id]))) && s.more.every((x) => inside(x, zoneOf(s, x.s))), 'many: every node inside its zone');
  const all = s.nodes.concat(s.more);
  let clash = 0;
  for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) if (overlap(all[a], all[b])) clash++;
  check(!clash && s.nodes.every((x) => x.h >= 44 && x.nmPx >= 13), 'many: packed without overlap, 44 px nodes, names 13 px or more: ' + clash);
  check(s.nodes.filter((x) => x.note).length >= 5 && !s.nodes.some((x) => x.cut), 'many: every amber note whole at the smallest size (dated ones only): ' + s.nodes.filter((x) => x.cut).map((x) => x.note).slice(0, 3));
  const ind = s.more.find((x) => x.s === 'ind');
  const shownInd = s.nodes.filter((x) => sec[x.id] === 'ind');
  check(ind && ind.label === `${per.ind - shownInd.length} more in Industry` && ind.text === `+${per.ind - shownInd.length}`, 'many: Industry overflows: ' + (ind && ind.label));
  const lc = Object.fromEntries(many.people.map((p) => [p.id, p.lastContact || '']));
  const hidden = many.people.filter((p) => p.sector === 'ind' && !shownInd.some((x) => x.id === p.id));
  check(hidden.every((p) => shownInd.every((x) => (lc[x.id] || '') >= (p.lastContact || ''))), 'many: the most recently contacted are the ones shown');
  check(shownInd.length >= 12 && shownInd.every((x) => !x.name.includes(' ')), 'many: shrunk to first names: ' + shownInd.length + ' shown');
  check(!s.overflow && !small(s).length, 'many: nothing sideways, 44 px');
  await page.screenshot({ path: file('net-pc-many') });
  const ms = await page.evaluate(() => { const q = document.getElementById('q'); const t = performance.now(); q.value = 'engineer'; q.dispatchEvent(new Event('input')); const d = performance.now() - t; q.value = ''; q.dispatchEvent(new Event('input')); return d; });
  check(ms < 150, 'many: a search redraws in ' + Math.round(ms) + ' ms');
  await page.click('[data-more="ind"]');
  await wait(page);
  s = await snap(page);
  check(s.side.h2 === 'Industry' && s.side.sub === `${per.ind} people · most recent contact first` && s.side.rows.length === per.ind && s.focus === 'sideH', '+N more: the whole sector in the panel: ' + s.side.rows.length);
  await page.keyboard.press('Escape');
  await wait(page);
  check((await snap(page)).focus === 'ind', '+N more: Escape back to the button');
  // Someone not shown: search finds them and they get a place.
  const who = hidden[hidden.length - 1];
  await page.fill('#q', who.name);
  await wait(page);
  s = await snap(page);
  const hit = s.nodes.find((x) => x.id === who.id);
  check(hit && hit.sel && !hit.dim && s.card && s.card.h2 === who.name, 'many: a person under +N more gets a place when found: ' + who.name);
  check(s.side === null, 'many: the card has the panel');
  await page.fill('#q', '');
  await page.keyboard.press('Escape');
  await wait(page);
  s = await snap(page);
  const never = many.people.filter((p) => !p.lastContact).length;
  check(s.side.groups[0] === `No contact yet · ${never}` && s.side.rows.length < 60, 'many: People to get back to keeps No contact yet short: ' + s.side.rows.length);
  await page.click('#sideAll');
  await wait(page);
  s = await snap(page);
  check(s.side.rows.filter((r) => r[1] === '').length === never, 'many: Show all lists every one');
  check(errors.length === 0 && noisy(logs).length === 0, 'many: nothing in the console: ' + errors.concat(noisy(logs)).join('; '));
  await ctx.close();

  const ph = await open({ width: 390, height: 844 }, { hub: makeHub(many) });
  s = await snap(ph.page);
  const band = s.bands.find((b) => b.label === 'Industry');
  const more = s.more.find((x) => x.s === 'ind');
  check(band && band.n === 30 && more && more.label === `${per.ind - 30} more in Industry` && band.sw > band.cw && !s.overflow, 'many phone: 30 in the Industry band, +N more at its end, it scrolls sideways, the page does not: ' + JSON.stringify({ band, more, overflow: s.overflow }));
  await ph.page.evaluate(() => { const b = [...document.querySelectorAll('.band')].find((x) => x.getAttribute('aria-label') === 'Industry'); b.scrollLeft = 400; b.dispatchEvent(new Event('scroll')); });
  await wait(ph.page, 120);
  const s2 = await snap(ph.page);
  check(!s2.overflow && ph.errors.length === 0, 'many phone: scrolling a band redraws its lines');
  await ph.page.screenshot({ path: file('net-phone-many'), fullPage: true });
  await ph.ctx.close();
}

/* ---------- 8. Import LinkedIn ---------- */
{
  const { ctx, page, errors, logs, hub } = await open({ width: 1440, height: 900 });
  await page.click('#importBtn');
  await wait(page);
  let s = await snap(page);
  const intro = await page.evaluate(() => document.querySelector('#imp .hint-top').textContent);
  check(s.dialog && s.dialog.id === 'imp' && s.focus === 'impPick' && /LinkedIn › Settings › Data privacy › Get a copy of your data › Connections/.test(intro) && /Nothing here talks to LinkedIn/.test(intro) && /Email addresses are never kept/.test(intro) &&
    !(await page.$('#imp input[type="checkbox"]')), 'import: how to get the file, nothing talks to LinkedIn, no email box');
  await page.setInputFiles('#impFile', { name: 'Connections.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV) });
  await wait(page, 400);
  const dry = hub.posts.find((p) => p.path === '/import');
  check(dry && dry.body.csv === CSV && dry.body.dry === true && Object.keys(dry.body).length === 2, 'import: the file is read in the browser and sent as text with dry: true');
  const v = await page.evaluate(() => ({
    name: document.getElementById('impFileName').textContent, counts: document.getElementById('impCounts').textContent, pick: document.getElementById('impPick').textContent,
    rows: [...document.querySelectorAll('#impTable tbody tr')].map((tr) => [...tr.children].map((td) => (td.querySelector('select') ? 'select:' + td.querySelector('select').value + (td.querySelector('select').classList.contains('is-sort') ? '!' : '') : td.textContent))),
    heads: [...document.querySelectorAll('#impTable th')].map((x) => x.textContent), note: document.getElementById('impNote').textContent, go: document.getElementById('impGo').textContent, text: document.getElementById('imp').innerText,
  }));
  check(v.name === 'Connections.csv' && v.counts === '8 connections · 6 new · 2 already here' && v.pick === 'Choose another file', 'import: the counts: ' + v.counts);
  check(v.heads.join() === 'Name,Company,Position,Connected on,Sector' && v.rows.length === 8, 'import: the whole preview table');
  check(JSON.stringify(v.rows.map((r) => r[4])) === JSON.stringify(['select:min', 'select:emb', 'Already here', 'select:ind', 'select:nato', 'Already here', 'select:sort!', 'select:sort!']), 'import: sectors suggested, To sort in amber, matches not editable: ' + v.rows.map((r) => r[4]));
  check(v.rows[7][1] === 'Clingendael, Netherlands Institute of International Relations' && v.rows[0][3] === '28 Jun 2023' && !/willem\.brouwer@example\.com/.test(v.text), 'import: a comma in a company, the day connected; no email anywhere');
  check(v.go === 'Import 6 people' && v.note === 'Sectors are suggested from the company name; change any of them. 2 are To sort: off the map until you give them a sector.', 'import: Import 6 people, the note: ' + v.note);
  await page.selectOption('#impTable select[data-row="7"]', 'other');
  await wait(page, 60);
  check((await page.evaluate(() => document.getElementById('impNote').textContent)).endsWith('1 is To sort: off the map until you give them a sector.'), 'import: a changed sector counts');
  s = await snap(page);
  check(!small(s).length, 'import: 44 px: ' + small(s));
  await page.screenshot({ path: file('net-pc-import') });
  const gets = hub.gets;
  await page.click('#impGo');
  await wait(page, 400);
  const fin = hub.posts.filter((p) => p.path === '/import')[1];
  const want = { 'https://www.linkedin.com/in/frank-hoekstra-ex': 'min', 'https://www.linkedin.com/in/ingrid-solberg-ex': 'emb', 'https://www.linkedin.com/in/willem-brouwer-ex': 'ind', 'https://www.linkedin.com/in/noor-el-amrani-ex': 'nato', 'https://www.linkedin.com/in/kees-dekker-ex': 'sort', 'https://www.linkedin.com/in/lotte-van-rijn-ex': 'other' };
  check(fin && fin.body.csv === CSV && !('dry' in fin.body) && JSON.stringify(fin.body.sectors) === JSON.stringify(want), 'import: Import sends the file with the sectors chosen: ' + JSON.stringify(fin && fin.body.sectors));
  const done = await page.evaluate(() => ({ done: document.getElementById('impDone').textContent, shown: !document.getElementById('impDone').hidden, cancel: document.getElementById('impCancel').textContent, table: document.getElementById('impTable').hidden }));
  check(done.shown && done.done === 'Added 6 · 2 already here' && done.cancel === 'Done' && done.table && hub.gets === gets + 1, 'import: Added 6 · 2 already here, and the map reads again');
  await page.screenshot({ path: file('net-pc-import-done') });
  await page.click('#impCancel');
  await wait(page);
  s = await snap(page);
  check(!s.dialog && s.heads.map((h) => h.n).join() === '5 people,5 people,5 people,5 people,3 people' && s.sortBtn === '5 to sort' && s.nodes.some((x) => x.name === 'Lotte van Rijn'), 'import: the new people are on the map; Kees is to sort: ' + s.heads.map((h) => h.n));
  // A drop on the PC, then a file that is not Connections.csv.
  await page.click('#importBtn');
  await wait(page);
  await page.evaluate((csv) => {
    const dt = new DataTransfer();
    dt.items.add(new File([csv], 'Connections.csv', { type: 'text/csv' }));
    document.getElementById('drop').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, CSV);
  await wait(page, 400);
  const dropped = await page.evaluate(() => document.getElementById('impCounts').textContent);
  check(dropped === '8 connections · 0 new · 8 already here' && (await page.evaluate(() => document.getElementById('impGo').hidden && document.getElementById('impNote').textContent === 'Everyone in this file is already here.')), 'import: a dropped file works too; all already here: ' + dropped);
  await page.setInputFiles('#impFile', { name: 'notes.csv', mimeType: 'text/csv', buffer: Buffer.from('Hello,World\n1,2\n') });
  await wait(page, 400);
  const bad = await page.evaluate(() => ({ err: document.getElementById('impErr').textContent, table: document.getElementById('impTable').hidden, go: document.getElementById('impGo').hidden }));
  check(bad.err === 'That file has no First Name and Last Name columns. Is it Connections.csv?' && bad.table && bad.go, 'import: a wrong file says so: ' + bad.err);
  await page.keyboard.press('Escape');
  await wait(page);
  s = await snap(page);
  check(!s.dialog && s.focus === 'importBtn', 'import: Escape closes it, the focus back on Import LinkedIn');
  check(errors.length === 0 && noisy(logs).length === 0, 'import: nothing in the console: ' + errors.concat(noisy(logs)).join('; '));
  await ctx.close();

  const ph = await open({ width: 390, height: 844 }, { hub: makeHub() });
  await ph.page.click('#importBtn2');
  await wait(ph.page);
  await ph.page.setInputFiles('#impFile', { name: 'Connections.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV) });
  await wait(ph.page, 400);
  s = await snap(ph.page);
  const tw = await ph.page.evaluate(() => { const t = document.querySelector('#impTable table'); return { tw: t.getBoundingClientRect().width, cw: document.getElementById('impTable').clientWidth, sw: document.getElementById('impTable').scrollWidth }; });
  check(s.dialog && Math.round(s.dialog.w) === 390 && Math.round(s.dialog.h) === 844 && tw.sw <= tw.cw + 1 && !small(s).length, 'import phone: full screen, one block per connection, nothing sideways, 44 px: ' + JSON.stringify(tw) + ' ' + small(s));
  await ph.page.screenshot({ path: file('net-phone-import') });
  await ph.ctx.close();
}

/* ---------- 9. ?p= opens a person ---------- */
{
  let o = await open({ width: 1440, height: 900 }, { query: '&p=' + id('anna') });
  let s = await snap(o.page);
  check(s.card && s.card.h2 === 'Anna de Vries' && s.focus === 'cardH' && nodeOf(s, 'anna').sel, '?p=: opens that card on the PC');
  await o.ctx.close();
  o = await open({ width: 390, height: 844 }, { query: '&p=' + id('henrik') });
  s = await snap(o.page);
  check(s.card && s.card.h2 === 'Henrik Larsen' && s.scrim, '?p=: and as a sheet on the phone');
  await o.ctx.close();
  o = await open({ width: 1440, height: 900 }, { query: '&p=gone00000000' });
  s = await snap(o.page);
  check(!s.card && s.toast === 'That person is not in your network any more.' && !/p=/.test(s.url), '?p= for someone removed: says so');
  await o.ctx.close();
}

/* ---------- 10. No code, the hub away, an empty network, refresh on return ---------- */
{
  let o = await open({ width: 390, height: 844 }, { code: '' });
  let s = await snap(o.page);
  check(!s.app && s.nocode, 'no code: the page says to open Morning from the private link');
  await o.ctx.close();
  for (const how of [503, 404]) {
    const hub = makeHub();
    hub.status = how;
    o = await open({ width: 1440, height: 900 }, { hub });
    s = await snap(o.page);
    const off = await o.page.evaluate(() => ['addBtn', 'importBtn', 'q', 'fadeOnly'].every((x) => document.getElementById(x).disabled));
    check(s.away === 'Can’t reach the hub. Retry' && !s.nodes.length && !s.side && off, `away (${how}): says so with Retry; Add, Import and search wait for the hub`);
    if (how === 503) {
      await o.page.screenshot({ path: file('net-away') });
      hub.status = 200;
      await o.page.click('#retry');
      await wait(o.page, 300);
      s = await snap(o.page);
      check(!s.away && s.nodes.length === 18 && hub.gets === 2, 'away: Retry reads again and draws the map');
      // A failed read after a good one keeps the map and says so.
      hub.abort = true;
      await o.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await wait(o.page, 300);
      s = await snap(o.page);
      check(s.nodes.length === 18 && !s.away && s.status === 'Can’t reach the hub · showing what was there', 'away after a good read: the map stays, the header says so');
      hub.abort = false;
    }
    check(o.errors.length === 0, `away (${how}): no page errors`);
    await o.ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.route('**/api/network/**', (r) => r.abort());
    await page.goto(BASE + 'network/?c=' + CODE);
    await wait(page, 400);
    s = await snap(page);
    check(s.away === 'Can’t reach the hub. Retry', 'network failure on the first read: the hub away with Retry');
    await ctx.close();
  }
  o = await open({ width: 1440, height: 900 }, { hub: makeHub({ people: [], ties: [] }) });
  s = await snap(o.page);
  check(s.empty === 'No one yet. Add a person or import your LinkedIn connections.' && !s.legend && !s.sortBtn && s.side && s.side.none === 'No one yet.' && s.heads.every((h) => h.n === 'No one yet') && s.heads.length === 4, 'empty: says so, four empty zones');
  await o.page.screenshot({ path: file('net-empty') });
  await o.page.click('#empty [data-open="add"]');
  await wait(o.page);
  check((await snap(o.page)).dialog.id === 'form', 'empty: Add person from the empty map');
  await o.ctx.close();
  // Reads on return, never on a timer.
  o = await open({ width: 1440, height: 900 });
  await wait(o.page, 2500);
  const g1 = o.hub.gets;
  await o.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await wait(o.page, 200);
  check(g1 === 1 && o.hub.gets === 2, 'refresh: one read on opening, none on a timer, one on return: ' + [g1, o.hub.gets]);
  await o.ctx.close();
}

/* ---------- 11. The phone at 390 and 375 ---------- */
for (const [name, vp] of [['net-phone', { width: 390, height: 844 }], ['net-phone-375', { width: 375, height: 667 }]]) {
  const { ctx, page, errors, logs, hub } = await open(vp);
  let s = await snap(page);
  const head = await page.evaluate(() => ({ add: !!document.getElementById('addBtn').offsetParent, imp: getComputedStyle(document.getElementById('importBtn')).display, imp2: !!document.getElementById('importBtn2').offsetParent }));
  check(head.add && head.imp === 'none' && head.imp2 && s.search.ph === 'Search' && s.fade.text === 'Fading', name + ': Add person on top, Search and Fading, Import under the map');
  check(s.bands.map((b) => b.label).join() === 'Embassies,Ministries,Industry,NATO and EU,Other' && s.bands.every((b) => Math.abs(b.x - 12) < 1 && Math.abs(b.w - (vp.width - 24)) < 1), name + ': one band per sector, 12 px from the sides');
  check(s.nodes.length === 18 && s.nodes.every((n) => !n.name.includes(' ') && n.R === 19) && s.bands.every((b, i) => i === 0 || b.y >= s.bands[i - 1].y + s.bands[i - 1].h), name + ': first names, 38 px circles, bands stacked');
  check(s.nodes.every((n) => { const b = s.bands.find((x) => n.cy > x.y && n.cy < x.y + x.h); return b && Math.abs(n.cy - (b.y + 66)) < 1; }), name + ': each row of people in the middle of its band');
  check(nodeOf(s, 'sofia').note === '13 mo' && nodeOf(s, 'bram').note === '' && !s.nodes.some((x) => x.cut) && s.lines.length === 10, name + ': faded notes, whole, and lines on the phone: ' + s.lines.length);
  check(!s.overflow && !small(s).length, name + ': nothing sideways, 44 px: ' + small(s));
  await page.screenshot({ path: file(name), fullPage: true });
  await page.tap(`.node[data-id="${id('anna')}"]`);
  await wait(page);
  s = await snap(page);
  check(s.card && s.scrim && Math.round(s.card.x) === 0 && Math.round(s.card.w) === vp.width && Math.abs(s.card.y - 56) < 1 && Math.abs(s.card.y + s.card.h - vp.height) < 1 && s.focus === 'cardH', name + ': the card as a sheet from 56 px to the bottom');
  check(!small(s).length && !s.overflow, name + ': the sheet: 44 px, nothing sideways: ' + small(s));
  await page.screenshot({ path: file(name + '-card') });
  await page.keyboard.press('Escape');
  await wait(page);
  s = await snap(page);
  check(!s.card && !s.scrim && s.focus === id('anna'), name + ': Escape closes the sheet, the focus back on Anna');
  await page.tap(`.node[data-id="${id('anna')}"]`);
  await wait(page);
  await page.tap('#scrim', { position: { x: 20, y: 20 } });
  await wait(page);
  check(!(await snap(page)).card, name + ': a tap above the sheet closes it');
  await page.tap(`.node[data-id="${id('anna')}"]`);
  await wait(page);
  await page.tap('[data-act="reach"]');
  await wait(page);
  s = await snap(page);
  check(s.dialog.id === 'reach' && Math.round(s.dialog.w) === vp.width && Math.abs(s.dialog.y + s.dialog.h - vp.height) < 1 && !small(s).length, name + ': Reach out from below, 44 px');
  await page.screenshot({ path: file(name + '-reach') });
  await page.keyboard.press('Escape');
  await wait(page);
  await page.tap('[data-act="sent"]');
  await wait(page);
  s = await snap(page);
  check(s.dialog.id === 'sent' && Math.abs(s.dialog.y + s.dialog.h - vp.height) < 1 && !small(s).length, name + ': Sent a message from below');
  await page.screenshot({ path: file(name + '-sent') });
  await page.keyboard.press('Escape');
  await wait(page);
  await page.tap('[data-act="edit"]');
  await wait(page);
  s = await snap(page);
  const fw = await page.evaluate(() => { const b = document.querySelector('#form .pf-body'); return b.scrollWidth <= b.clientWidth + 1; });
  const when = await page.evaluate(() => document.getElementById('pfWhen').getBoundingClientRect().width);
  check(s.dialog.id === 'form' && Math.round(s.dialog.w) === vp.width && Math.round(s.dialog.h) === vp.height && fw && when >= 140 && !small(s).length, name + ': Edit full screen, When wide enough for the month, nothing sideways, 44 px: ' + small(s));
  await page.screenshot({ path: file(name + '-edit') });
  await page.keyboard.press('Escape');
  await wait(page);
  check((await snap(page)).focus === 'edit', name + ': Escape from the form, the focus back on Edit');
  await page.keyboard.press('Escape');
  await wait(page);
  await page.tap('#addBtn');
  await wait(page);
  await page.screenshot({ path: file(name + '-add') });
  await page.keyboard.press('Escape');
  await wait(page);
  await page.tap('#sortBtn');
  await wait(page);
  s = await snap(page);
  check(s.side && s.side.sheet && s.side.h2 === 'To sort' && s.scrim && Math.abs(s.side.y - 56) < 1 && !small(s).length, name + ': To sort as a sheet');
  await page.screenshot({ path: file(name + '-sort') });
  await page.keyboard.press('Escape');
  await wait(page);
  s = await snap(page);
  check(s.side && !s.side.sheet && s.side.h2 === 'People to get back to' && !s.scrim && s.focus === 'sortBtn', name + ': Escape: back, with People to get back to under the map');
  check(errors.length === 0 && noisy(logs).length === 0 && hub.posts.length === 0, name + ': nothing in the console, nothing sent: ' + errors.concat(noisy(logs)).join('; '));
  await ctx.close();
}

/* ---------- 12. Morning's Waiting on card leads here ---------- */
const MORNING = () => ({ now: new Date().toISOString(), waiting: { ok: true, open: 2, due: 0, items: [{ id: 'w1', who: 'Example Ministry', what: 'the application', channel: 'email', since: new Date().toISOString().slice(0, 10), chaseDue: false }] } });
for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: vp.width < 700 });
  const page = await ctx.newPage();
  await page.route('**/api/**', (r) => {
    const u = new URL(r.request().url());
    if (u.pathname.startsWith('/api/morning/')) return r.fulfill({ json: MORNING(), headers: H });
    if (u.pathname.startsWith('/api/network/')) return r.fulfill({ json: makeHub().answer(), headers: H });
    return r.fulfill({ status: 503, json: { error: 'mocked' }, headers: H });
  });
  await page.route('**/site.**espn.com/**', (r) => r.abort());
  await page.goto(BASE + '?c=' + CODE);
  await page.waitForFunction(() => !document.getElementById('waiting').hidden, null, { timeout: 5000 }).catch(() => {});
  const link = await page.evaluate(() => {
    const a = document.getElementById('waitNet');
    if (!a) return null;
    const r = a.getBoundingClientRect(), add = document.getElementById('waitAdd').getBoundingClientRect();
    return { href: a.getAttribute('href'), text: a.textContent.replace(/\s+/g, ' ').trim(), h: r.height, inHead: !!a.closest('#waiting .card-head'), cls: a.className, beforeAdd: r.right <= add.left, sameRow: Math.abs((r.top + r.bottom) / 2 - (add.top + add.bottom) / 2) < 4 };
  });
  const tag = vp.width < 700 ? 'Morning phone' : 'Morning';
  check(link && link.href === 'network/?c=' + CODE && link.text === 'Network ›' && link.inHead && /card-link/.test(link.cls) && link.beforeAdd && link.sameRow, tag + ': Network › in the head of Waiting on, beside Add: ' + JSON.stringify(link));
  if (vp.width < 700) check(link && link.h >= 44, tag + ': the link is 44 px tall: ' + (link && link.h));
  else {
    await page.waitForTimeout(1600);
    await page.locator('#waiting').screenshot({ path: file('net-morning-link') });
    await page.click('#waitNet');
    await page.waitForURL(/network\/\?c=/);
    await page.waitForTimeout(400);
    check((await page.title()) === 'Network' && (await page.locator('#map .node[data-id]').count()) === 18, 'Morning: the link opens Network with the code');
  }
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
  await page.goto(BASE + 'network/?c=' + CODE);
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
  check(kept[root] === 'Morning' && kept[root + 'network/'] === 'Network', 'service worker: Morning stays Morning, Network under its own path: ' + JSON.stringify(kept));
  await ctx.close();
}

await browser.close();
console.log(`${passes} of ${passes + fails} network checks pass`);
if (fails) process.exit(1);
console.log('all network checks pass');
