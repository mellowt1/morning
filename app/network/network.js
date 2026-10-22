/* Network (morning/network/): the people Paul knows as a map by sector, who introduced whom and who
 * works together, and who he has not spoken to for a while (GET /api/network/:code, paul-hub
 * src/network.js). A person opens a card with Talked today, Reach out (a To-do task that links back
 * here), Sent a message (a Waiting on item) and Edit. Add person, To sort and Import LinkedIn change the
 * network through the same hub routes; nothing here talks to LinkedIn or to anyone else.
 *
 * Read on opening, on return to the page and after an import; no polling. ?p=<id> opens that person
 * (To-do's "Reach out to ..." task links here). Nothing is kept on this device apart from the code, and
 * nothing goes to the console. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const CODE_RE = /^[a-z0-9]{16}$/;
  const params = new URLSearchParams(location.search);
  const isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const apiParam = params.get('api') || '';
  const API = (/^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)/.test(apiParam)
    ? apiParam
    : isLocal ? 'http://localhost:8787' : 'https://paul-hub.paul-o-a04.workers.dev').replace(/\/+$/, '');
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* blocked */ } },
  };

  // The same link and code as Morning and the to-do app.
  let code = (params.get('c') || '').trim().toLowerCase();
  if (CODE_RE.test(code)) store.set('morning.code', code);
  else code = store.get('morning.code') || store.get('todo.code') || '';
  if (!CODE_RE.test(code)) { $('app').hidden = true; $('nocode').hidden = false; return; }
  $('back').href = '../?c=' + encodeURIComponent(code);
  const BASE = API + '/api/network/' + code;
  const TODO = '../todo/?c=' + encodeURIComponent(code);

  /* ---------- Sectors: the zone colours are the approved ones; Other is the neutral fifth ---------- */
  const SEC = {
    emb: { name: 'Embassies', fill: '#9DBBDB', ink: '#15181C', zone: '#DCE5EF' },
    min: { name: 'Ministries', fill: '#E9BE63', ink: '#15181C', zone: '#EFE6D4' },
    ind: { name: 'Industry', fill: '#C9875A', ink: '#15181C', zone: '#ECE0D7' },
    nato: { name: 'NATO and EU', fill: '#2F5D8A', ink: '#FFFFFF', zone: '#D6DEE8' },
    other: { name: 'Other', fill: '#A9B2BD', ink: '#15181C', zone: '#E1E5EA' },
    sort: { name: 'To sort', fill: '#D4D9DF', ink: '#15181C', zone: '#E7EAEE' },
  };
  const ON_MAP = ['emb', 'min', 'ind', 'nato', 'other'];
  const WIDE = matchMedia('(min-width: 1100px)');
  const INK = '#15181C', LINE = '#7A8491';

  /* ---------- Words and dates (the hub's today, The Hague's) ---------- */
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DATE = /^\d{4}-\d{2}-\d{2}$/, YM = /^\d{4}-(0[1-9]|1[0-2])$/;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const str = (s, n) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, n) : '');
  const r1 = (n) => Math.round(n * 10) / 10;
  const day = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5;
  const fullDate = (s) => `${+s.slice(8, 10)} ${MON[+s.slice(5, 7) - 1]} ${s.slice(0, 4)}`;
  const shortDate = (s) => `${+s.slice(8, 10)} ${MON[+s.slice(5, 7) - 1]}` + (data && s.slice(0, 4) !== data.today.slice(0, 4) ? ' ' + s.slice(0, 4) : '');
  const monthYear = (s) => `${MONTH[+s.slice(5, 7) - 1]} ${s.slice(0, 4)}`;
  function months(from, to) {
    const [ay, am, ad] = from.split('-').map(Number), [by, bm, bd] = to.split('-').map(Number);
    return (by - ay) * 12 + (bm - am) - (bd < ad ? 1 : 0);
  }
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  // "Today", "3 days ago", "3 weeks ago", "8 months ago", "2 years ago".
  function ago(date) {
    const d = day(data.today) - day(date);
    if (d <= 0) return 'Today';
    if (d === 1) return 'Yesterday';
    if (d < 7) return `${d} days ago`;
    if (d < 30) return `${plural(Math.max(1, Math.round(d / 7)), 'week', 'weeks')} ago`;
    const m = Math.max(1, months(date, data.today));
    if (m < 12) return `${plural(m, 'month', 'months')} ago`;
    return `${plural(Math.floor(m / 12), 'year', 'years')} ago`;
  }
  // The amber note under a faded node: "8 mo" or "2 yr"; someone never contacted only fades (an
  // import of hundreds would otherwise fill the map with amber). The card and the list still say it.
  function fadeNote(p) {
    if (!p.lastContact) return 'No contact yet';
    const m = Math.max(1, months(p.lastContact, data.today));
    return m < 24 ? `${m} mo` : `${Math.floor(m / 12)} yr`;
  }
  function fadeWords(p) {
    if (!p.lastContact) return 'no contact yet';
    const m = Math.max(1, months(p.lastContact, data.today));
    return `no contact for ${plural(m, 'month', 'months')}`;
  }
  function initials(name) {
    const words = name.split(' ').filter(Boolean);
    const caps = words.filter((w) => /^\p{Lu}/u.test(w));
    const use = caps.length ? caps : words;
    const first = (w) => Array.from(w)[0] || '';
    return (first(use[0]) + (use.length > 1 ? first(use[use.length - 1]) : '')).toUpperCase();
  }
  const firstName = (name) => name.split(' ')[0];
  const roleOrg = (p) => [p.role, p.org].filter(Boolean).join(' · ');
  const secName = (s) => (data && data.names[s]) || SEC[s].name;
  const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  /* ---------- The answer, checked: anything unexpected is left out ---------- */
  const PID = /^[A-Za-z0-9_-]{1,64}$/;
  function cleanPerson(p) {
    if (!p || typeof p !== 'object' || !PID.test(p.id || '') || !str(p.name, 120)) return null;
    const w = p.waiting && typeof p.waiting === 'object' ? p.waiting : null;
    return {
      id: p.id, name: str(p.name, 120), org: str(p.org, 120), role: str(p.role, 120),
      sector: SEC[p.sector] ? p.sector : 'sort',
      metWhere: str(p.metWhere, 120), metWhen: YM.test(p.metWhen || '') ? p.metWhen : '',
      topics: Array.isArray(p.topics) ? p.topics.map((t) => str(t, 40)).filter(Boolean).slice(0, 12) : [],
      notes: typeof p.notes === 'string' ? p.notes.trim().slice(0, 1000) : '',
      email: str(p.email, 254), phone: str(p.phone, 40),
      linkedin: /^https:\/\/([a-z0-9-]+\.)*linkedin\.com\//i.test(p.linkedin || '') ? str(p.linkedin, 200) : '',
      lastContact: DATE.test(p.lastContact || '') ? p.lastContact : '',
      fading: p.fading === true,
      source: p.source === 'linkedin' ? 'linkedin' : 'hand',
      connectedOn: DATE.test(p.connectedOn || '') ? p.connectedOn : '',
      reachTask: typeof p.reachTask === 'string' && p.reachTask ? p.reachTask : '',
      waiting: w && str(w.what, 160) ? { id: str(w.id, 64), what: str(w.what, 160), nextChase: DATE.test(w.nextChase || '') ? w.nextChase : '' } : null,
    };
  }
  function cleanTies(list, byId) {
    const seen = new Set();
    return (Array.isArray(list) ? list : []).filter((t) => {
      if (!t || !byId.has(t.a) || !byId.has(t.b) || t.a === t.b || (t.kind !== 'introduced' && t.kind !== 'works_with')) return false;
      const k = t.kind + '|' + t.a + '|' + t.b;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).map((t) => ({ a: t.a, b: t.b, kind: t.kind }));
  }
  function clean(d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.people)) throw new Error('shape');
    const names = {};
    for (const s of Array.isArray(d.sectors) ? d.sectors : []) if (s && SEC[s.id] && str(s.name, 40)) names[s.id] = str(s.name, 40);
    const people = d.people.map(cleanPerson).filter(Boolean);
    const byId = new Map(people.map((p) => [p.id, p]));
    const fm = Number(d.fadeMonths);
    return {
      today: DATE.test(d.today || '') ? d.today : new Date().toISOString().slice(0, 10),
      fadeMonths: Number.isFinite(fm) && fm > 0 ? Math.floor(fm) : 6,
      names, people, byId, ties: cleanTies(d.ties, byId),
    };
  }
  const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || (a.id < b.id ? -1 : 1);
  // Most recent contact first; never contacted last; then by name.
  const byRecent = (a, b) => (b.lastContact || '').localeCompare(a.lastContact || '') || byName(a, b);
  function put(raw) {
    const p = cleanPerson(raw);
    if (!p || !data) return null;
    const i = data.people.findIndex((x) => x.id === p.id);
    if (i >= 0) data.people[i] = p; else data.people.push(p);
    data.people.sort(byName);
    data.byId = new Map(data.people.map((x) => [x.id, x]));
    return p;
  }
  function drop(id) {
    data.people = data.people.filter((x) => x.id !== id);
    data.byId.delete(id);
    data.ties = data.ties.filter((t) => t.a !== id && t.b !== id);
  }

  /* ---------- State ---------- */
  let data = null;          // the last good answer, checked
  let failed = false;       // the last read failed
  let sel = null;           // the person whose card is open
  let opener = null;        // where the focus goes back to when the card closes
  let side = { mode: 'back', sector: null, all: false, opener: null }; // back | sector | sort
  let query = '', fadeOnly = false;
  let cardErr = '';
  let lastAuto = '';        // the single search match already opened

  const matches = (p) => {
    if (!query) return true;
    const hay = fold([p.name, p.org, p.role, ...p.topics].join(' '));
    return fold(query).split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
  };
  const lit = (p) => matches(p) && (!fadeOnly || p.fading);
  const filtering = () => !!query || fadeOnly;

  /* ---------- Layout: zones and a packed grid of nodes in each ---------- */
  // Node sizes, largest first; a zone takes the largest that holds everyone, down to the smallest.
  const LV = [
    { R: 24, font: 14, full: true, cw: 150, ch: 104, bw: 150 },
    { R: 20, font: 13, full: true, cw: 124, ch: 92, bw: 120 },
    { R: 17, font: 13, full: false, cw: 92, ch: 80, bw: 88, dense: true },
    { R: 14, font: 13, full: false, cw: 80, ch: 68, bw: 76, dense: true },
  ];
  const PH = { R: 19, font: 13, full: false, bw: 84, step: 90, x0: 48, cy: 66, bh: 140, gap: 10, cap: 30, dense: false };
  const HEAD = 46, PADX = 12, PADB = 8, GAP = 20, OTHER_X = 150;
  const nodeH = (L) => 2 * L.R + 4 + Math.round(L.font * 1.2) + 12;

  function shape(n, w, h, mc, mr) {
    let best = null;
    for (let c = 1; c <= mc; c++) {
      const r = Math.ceil(n / c);
      if (r > mr) continue;
      const s = Math.abs(Math.log((w / c) / (h / r) / 1.5));
      if (!best || s < best.s - 1e-9) best = { cols: c, rows: r, s };
    }
    return best || { cols: mc, rows: mr };
  }
  function pack(n, w, h) {
    for (const L of LV) {
      const mc = Math.max(1, Math.floor(w / L.cw)), mr = Math.max(1, Math.floor(h / L.ch));
      if (mc * mr >= n) return { L, ...shape(Math.max(1, n), w, h, mc, mr), cap: mc * mr };
    }
    const L = LV[LV.length - 1];
    const mc = Math.max(1, Math.floor(w / L.cw)), mr = Math.max(1, Math.floor(h / L.ch));
    return { L, cols: mc, rows: mr, cap: mc * mr };
  }
  // A zone's people in the order they get a place: most recent contact first. When not everyone
  // fits, what the search or Fading only lights goes first, and the open person always has a place.
  function order(list, cap) {
    let out = list.slice().sort(byRecent);
    if (out.length <= cap) return { shown: out, more: 0 };
    if (filtering()) out = [...out.filter(lit), ...out.filter((p) => !lit(p))];
    const room = Math.max(1, cap - 1);
    const i = sel ? out.findIndex((p) => p.id === sel) : -1;
    if (i >= room) { const [p] = out.splice(i, 1); out.splice(room - 1, 0, p); }
    return { shown: out.slice(0, room), more: out.length - room };
  }
  function groups() {
    const g = { emb: [], min: [], ind: [], nato: [], other: [], sort: [] };
    for (const p of data.people) g[p.sector].push(p);
    return g;
  }

  /* ---------- Drawing ---------- */
  function nodeHTML(p, x, y, L) {
    const S = SEC[p.sector];
    const on = p.id === sel;
    const note = p.fading && p.lastContact ? fadeNote(p) : '';
    const label = `${p.name}${roleOrg(p) ? ', ' + [p.role, p.org].filter(Boolean).join(', ') : ''}${p.fading ? ', ' + fadeWords(p) : ''}`;
    return `<button type="button" class="node${on ? ' is-sel' : ''}${p.fading ? ' is-fade' : ''}${filtering() && !lit(p) ? ' is-dim' : ''}" data-id="${esc(p.id)}" ` +
      `style="left:${r1(x - L.bw / 2)}px;top:${r1(y - L.R)}px;width:${L.bw}px;--r:${L.R}px;--f:${L.font}px" aria-label="${esc(label)}" aria-controls="card" aria-expanded="${on}">` +
      `<span class="dot" style="background:${S.fill};color:${S.ink}" aria-hidden="true">${esc(initials(p.name))}</span>` +
      `<span class="nm" style="background:${S.zone}" aria-hidden="true">${esc(L.full ? p.name : firstName(p.name))}</span>` +
      (note ? `<span class="fd${L.dense ? ' fd-dense' : ''}" style="background:${S.zone}" aria-hidden="true">${esc(note)}</span>` : '') + '</button>';
  }
  function moreHTML(s, n, x, y, L) {
    return `<button type="button" class="node node-more" data-more="${s}" style="left:${r1(x - L.bw / 2)}px;top:${r1(y - L.R)}px;width:${L.bw}px;--r:${L.R}px;--f:${L.font}px" ` +
      `aria-label="${esc(`${n} more in ${secName(s)}`)}" aria-controls="side"><span class="dot" aria-hidden="true">+${n}</span><span class="nm" style="background:${SEC[s].zone}" aria-hidden="true">more</span></button>`;
  }
  const countWords = (n) => (n ? plural(n, 'person', 'people') : 'No one yet');
  const headHTML = (s, n, x, y) => `<div class="zone-h" style="left:${r1(x)}px;top:${r1(y)}px;background:${SEC[s].zone}"><h3>${esc(secName(s))}</h3><span class="zone-n">${esc(countWords(n))}</span></div>`;
  const zoneHTML = (z) => `<div class="zone" style="left:${r1(z.x)}px;top:${r1(z.y)}px;width:${r1(z.w)}px;height:${r1(z.h)}px;background:${SEC[z.s].zone}"></div>`;

  let pos = new Map();      // person id -> { band, x, y, R } of the nodes on the map
  let bands = [];           // the phone's bands: { s, x, y, w, h, el }

  // The PC: the four zones as drawn, Other as a band under them when someone is in it: one row beside
  // its heading, at the largest size that holds everyone in the row, else the smallest with +N more.
  function layoutPC(W, H, g) {
    const zones = [];
    let otherH = 0;
    if (g.other.length) {
      const iw = W - OTHER_X - PADX;
      const L = LV.find((x) => Math.floor(iw / x.cw) >= g.other.length) || LV[LV.length - 1];
      otherH = L.ch + 16;
    }
    const gridH = H - (otherH ? otherH + GAP : 0);
    const zw = (W - GAP) / 2, zh = (gridH - GAP) / 2;
    for (const [s, c, r] of [['emb', 0, 0], ['min', 1, 0], ['ind', 0, 1], ['nato', 1, 1]]) zones.push({ s, x: c * (zw + GAP), y: r * (zh + GAP), w: zw, h: zh });
    if (otherH) zones.push({ s: 'other', x: 0, y: gridH + GAP, w: W, h: otherH });
    return zones;
  }

  /* Where each zone's people sit. On the PC a grid per zone; on the phone a row per band. Slots are
   * in the map's own pixels (a band's slots as if it were not scrolled). */
  function place(g, W, H) {
    const out = [];
    if (WIDE.matches) {
      for (const z of layoutPC(W, H, g)) {
        const inner = z.s === 'other' ? { x: z.x + OTHER_X, y: z.y + 8, w: z.w - OTHER_X - PADX, h: z.h - 16 } : { x: z.x + PADX, y: z.y + HEAD, w: z.w - 2 * PADX, h: z.h - HEAD - PADB };
        const list = g[z.s];
        const zone = { z, list: [], slots: [], more: 0, moreAt: null, L: LV[0], band: null };
        out.push(zone);
        if (!list.length) continue;
        const pk = pack(list.length, inner.w, inner.h);
        const o = order(list, pk.cap);
        const n = o.shown.length + (o.more ? 1 : 0);
        const cw = inner.w / pk.cols, ch = inner.h / pk.rows, nh = nodeH(pk.L);
        zone.L = { ...pk.L, bw: Math.min(pk.L.bw, Math.floor(cw) - 4) };
        const at = (i) => {
          const r = Math.floor(i / pk.cols), c = i % pk.cols;
          const inRow = Math.min(pk.cols, n - r * pk.cols);
          return { x: inner.x + (pk.cols - inRow) * cw / 2 + (c + 0.5) * cw, y: inner.y + r * ch + Math.max(0, (ch - nh) / 2) + zone.L.R };
        };
        zone.list = o.shown;
        zone.slots = o.shown.map((p, i) => at(i));
        zone.more = o.more;
        if (o.more) zone.moreAt = at(o.shown.length);
      }
    } else {
      ON_MAP.filter((s) => s !== 'other' || g.other.length).forEach((s, i) => {
        const z = { s, x: 12, y: i * (PH.bh + PH.gap), w: W - 24, h: PH.bh };
        const o = order(g[s], PH.cap + 1);
        out.push({
          z, list: o.shown, slots: o.shown.map((p, j) => ({ x: z.x + PH.x0 + j * PH.step, y: z.y + PH.cy })), more: o.more,
          moreAt: o.more ? { x: z.x + PH.x0 + o.shown.length * PH.step, y: z.y + PH.cy } : null, L: PH, band: i,
        });
      });
    }
    return out;
  }

  /* A zone that holds everyone and has six people or fewer gets the order with the fewest crossing
   * lines, the fewest lines under someone else's circle (in any zone) and the shortest lines; a draw
   * keeps the most recent contact first. A zone that overflows keeps its order (most recent first). */
  const ccw = (a, b, c) => (c.y - a.y) * (b.x - a.x) - (b.y - a.y) * (c.x - a.x);
  const crosses = (a, b, c, d) => (ccw(a, b, c) > 0) !== (ccw(a, b, d) > 0) && (ccw(c, d, a) > 0) !== (ccw(c, d, b) > 0);
  function nearSeg(q, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
    const t = l ? Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l)) : 0;
    return Math.hypot(q.x - (a.x + t * dx), q.y - (a.y + t * dy));
  }
  function tidy(zones) {
    const at = new Map();
    for (const zn of zones) zn.list.forEach((p, i) => at.set(p.id, zn.slots[i]));
    for (const zn of zones) {
      const n = zn.list.length;
      if (n < 2 || n > 6 || zn.more) continue;
      const ids = new Set(zn.list.map((p) => p.id));
      const mine = data.ties.filter((t) => at.has(t.a) && at.has(t.b) && (ids.has(t.a) || ids.has(t.b)));
      if (!mine.length) continue;
      const R = zn.L.R;
      const where = new Map();
      const rest = [];
      for (const [id, q] of at) if (!ids.has(id)) rest.push({ id, x: q.x, y: q.y });
      const score = (perm) => {
        perm.forEach((pi, si) => where.set(zn.list[pi].id, zn.slots[si]));
        const P = (id) => where.get(id) || at.get(id);
        let s = 0;
        for (let i = 0; i < mine.length; i++) {
          const t = mine[i], a = P(t.a), b = P(t.b);
          s += Math.hypot(b.x - a.x, b.y - a.y);
          for (let j = i + 1; j < mine.length; j++) {
            const u = mine[j];
            if (t.a === u.a || t.a === u.b || t.b === u.a || t.b === u.b) continue;
            if (crosses(a, b, P(u.a), P(u.b))) s += 600;
          }
          for (const p of zn.list) if (p.id !== t.a && p.id !== t.b && nearSeg(where.get(p.id), a, b) < R + 4) s += 400;
          const x0 = Math.min(a.x, b.x) - R - 4, x1 = Math.max(a.x, b.x) + R + 4, y0 = Math.min(a.y, b.y) - R - 4, y1 = Math.max(a.y, b.y) + R + 4;
          for (const q of rest) {
            if (q.x < x0 || q.x > x1 || q.y < y0 || q.y > y1 || q.id === t.a || q.id === t.b) continue;
            if (nearSeg(q, a, b) < R + 4) s += 400;
          }
        }
        return s;
      };
      const a = [...Array(n).keys()], c = Array(n).fill(0);
      let best = a.slice(), low = score(a);
      for (let i = 0; i < n;) {
        if (c[i] < i) {
          if (i % 2 === 0) [a[0], a[i]] = [a[i], a[0]]; else [a[c[i]], a[i]] = [a[i], a[c[i]]];
          const sc = score(a);
          if (sc < low - 0.5) { low = sc; best = a.slice(); }
          c[i]++;
          i = 0;
        } else { c[i] = 0; i++; }
      }
      zn.list = best.map((i) => zn.list[i]);
      zn.list.forEach((p, i) => at.set(p.id, zn.slots[i]));
    }
  }

  function renderMap() {
    const map = $('map');
    pos = new Map();
    bands = [];
    if (!data) { map.innerHTML = ''; map.style.height = ''; return; }
    const g = groups();
    const focus = keepFocus();
    const wide = WIDE.matches;
    let W, H;
    if (wide) {
      map.style.height = '';
      W = map.clientWidth;
      H = Math.max(map.clientHeight, 360);
    } else {
      W = map.clientWidth || innerWidth;
      H = (ON_MAP.length - (g.other.length ? 0 : 1)) * (PH.bh + PH.gap) - PH.gap;
      map.style.height = H + 'px';
    }
    const zones = place(g, W, H);
    tidy(zones);
    let html = '', heads = '', nodes = '', scrollers = '';
    for (const zn of zones) {
      const { z, L } = zn;
      html += zoneHTML(z);
      if (wide) {
        heads += headHTML(z.s, g[z.s].length, z.x + PADX, z.y + 8);
        zn.list.forEach((p, i) => {
          const { x, y } = zn.slots[i];
          pos.set(p.id, { band: null, x, y, R: L.R });
          nodes += nodeHTML(p, x, y, L);
        });
        if (zn.more) nodes += moreHTML(z.s, zn.more, zn.moreAt.x, zn.moreAt.y, L);
      } else {
        bands.push(z);
        heads += headHTML(z.s, g[z.s].length, z.x + 6, z.y + 6);
        let inner = '';
        zn.list.forEach((p, i) => {
          const x = zn.slots[i].x - z.x, y = zn.slots[i].y - z.y;
          pos.set(p.id, { band: zn.band, x, y, R: L.R });
          inner += nodeHTML(p, x, y, L);
        });
        if (zn.more) inner += moreHTML(z.s, zn.more, zn.moreAt.x - z.x, zn.moreAt.y - z.y, L);
        const n = zn.list.length + (zn.more ? 1 : 0);
        const tw = Math.max(z.w, PH.x0 + (n - 1) * PH.step + PH.bw / 2 + 12);
        scrollers += `<div class="band" data-band="${zn.band}" role="group" aria-label="${esc(secName(z.s))}" style="left:${z.x}px;top:${z.y}px;width:${z.w}px;height:${z.h}px"><div class="track" style="width:${r1(tw)}px">${inner}</div></div>`;
      }
    }
    const svg = `<svg id="lines" class="lines" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"></svg>`;
    if (wide) map.innerHTML = html + svg + heads + `<div class="nodes">${nodes}</div>`;
    else {
      map.innerHTML = html + svg + scrollers + heads;
      for (const el of map.querySelectorAll('.band')) {
        bands[+el.dataset.band].el = el;
        el.addEventListener('scroll', onBandScroll, { passive: true });
      }
    }
    drawLines();
    restoreFocus(focus);
  }


  let lineFrame = 0;
  function onBandScroll() { if (!lineFrame) lineFrame = requestAnimationFrame(() => { lineFrame = 0; drawLines(); }); }

  // Where a node's centre is now (a phone band may be scrolled); null when it is out of sight.
  function centre(id) {
    const n = pos.get(id);
    if (!n) return null;
    if (n.band === null) return n;
    const b = bands[n.band];
    const x = b.x + n.x - (b.el ? b.el.scrollLeft : 0);
    if (x < b.x + 4 || x > b.x + b.w - 4) return null;
    return { x, y: b.y + n.y, R: n.R };
  }
  function drawLines() {
    const svg = $('lines');
    if (!svg || !data) return;
    let base = '', hi = '';
    for (const t of data.ties) {
      const p = centre(t.a), q = centre(t.b);
      if (!p || !q) continue;
      const intro = t.kind === 'introduced';
      const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
      const s = p.R + 1, e = intro ? q.R + 4 : q.R + 1;
      if (d < s + e + 4) continue;
      const on = !!sel && (t.a === sel || t.b === sel);
      const dim = !on && filtering() && (!lit(data.byId.get(t.a)) || !lit(data.byId.get(t.b)));
      const el = `<line class="ln${on ? ' on' : ''}" data-a="${esc(t.a)}" data-b="${esc(t.b)}" data-kind="${t.kind}" x1="${r1(p.x + dx / d * s)}" y1="${r1(p.y + dy / d * s)}" x2="${r1(q.x - dx / d * e)}" y2="${r1(q.y - dy / d * e)}" ` +
        `stroke="${on ? INK : LINE}" stroke-width="${on ? 2.2 : 1.4}"${intro ? ` stroke-dasharray="6 5" marker-end="url(#${on ? 'ah' : 'ahm'})"` : ''}${dim ? ' opacity="0.22"' : ''}></line>`;
      if (on) hi += el; else base += el;
    }
    svg.innerHTML = `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${INK}"></path></marker>` +
      `<marker id="ahm" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${LINE}"></path></marker></defs>` + base + hi;
  }

  /* Keep the focus on the same thing when a part of the page is drawn again. */
  function keepFocus() {
    const a = document.activeElement;
    if (!a || a === document.body || !a.closest) return null;
    if (a.closest('#map')) return a.dataset.id ? `#map .node[data-id="${CSS.escape(a.dataset.id)}"]` : a.dataset.more ? `#map [data-more="${a.dataset.more}"]` : null;
    if (a.closest('#cardBody')) return a.dataset.act ? `#cardBody [data-act="${a.dataset.act}"]` : a.dataset.go ? `#cardBody [data-go="${CSS.escape(a.dataset.go)}"]` : a.id ? '#' + a.id : null;
    if (a.closest('#sideBody')) return a.dataset.id ? `#sideBody [data-id="${CSS.escape(a.dataset.id)}"]` : a.dataset.sort ? `#sideBody [data-sort="${CSS.escape(a.dataset.sort)}"]` : a.id ? '#' + a.id : null;
    return null;
  }
  function restoreFocus(q) {
    if (!q || (document.activeElement && document.activeElement !== document.body && document.contains(document.activeElement))) return;
    const el = document.querySelector(q);
    if (el) el.focus({ preventScroll: true });
  }

  /* ---------- The card ---------- */
  function connections(p) {
    const out = [];
    for (const t of data.ties) if (t.kind === 'introduced' && t.b === p.id) out.push(['Introduced by', t.a]);
    for (const t of data.ties) if (t.kind === 'works_with' && (t.a === p.id || t.b === p.id)) out.push(['works with', t.a === p.id ? t.b : t.a]);
    for (const t of data.ties) if (t.kind === 'introduced' && t.a === p.id) out.push(['introduced you to', t.b]);
    return out.filter(([, id]) => data.byId.has(id));
  }
  const field = (k, v, cls = '') => `<div class="f${cls}"><dt>${esc(k)}</dt><dd>${v}</dd></div>`;
  function cardHTML(p) {
    const S = SEC[p.sector];
    let h = `<div class="c-head"><span class="av" style="background:${S.fill};color:${S.ink}" aria-hidden="true">${esc(initials(p.name))}</span>` +
      `<div class="c-who"><h2 id="cardH" tabindex="-1">${esc(p.name)}</h2>` +
      (roleOrg(p) ? `<span class="c-role">${esc(roleOrg(p))}</span>` : '') +
      `<span class="c-sec"><i style="background:${S.fill}" aria-hidden="true"></i>${esc(secName(p.sector))}${p.sector === 'sort' ? ', off the map' : ''}</span></div>` +
      `<button type="button" class="x" id="cardClose" aria-label="Close">×</button></div>`;
    h += '<div class="c-last"><span class="c-last-k">Last contact</span>' + (p.lastContact
      ? `<span class="c-last-d">${esc(fullDate(p.lastContact))}</span><span class="c-last-r${p.fading ? ' fade' : ''}">${esc(ago(p.lastContact))}</span>`
      : '<span class="c-last-r fade">No contact yet</span>') + '</div>';
    h += '<div class="c-acts"><button type="button" class="btn btn-go" data-act="talked">Talked today</button>' +
      '<button type="button" class="btn" data-act="reach">Reach out</button>' +
      '<button type="button" class="btn" data-act="sent">Sent a message</button>' +
      '<button type="button" class="btn" data-act="edit">Edit</button></div>';
    if (cardErr) h += `<p class="err" role="alert">${esc(cardErr)}</p>`;
    const state = [];
    if (p.reachTask) state.push(`<li><a href="${esc(TODO)}">Reach out task in To-do</a></li>`);
    if (p.waiting) {
      const due = p.waiting.nextChase && p.waiting.nextChase <= data.today;
      state.push(`<li class="${due ? 'due' : ''}"><span>Waiting for an answer about ${esc(p.waiting.what)}${p.waiting.nextChase ? ` · chase ${esc(due && p.waiting.nextChase === data.today ? 'today' : shortDate(p.waiting.nextChase))}` : ''}</span></li>`);
    }
    if (state.length) h += `<ul class="c-state">${state.join('')}</ul>`;
    let f = '';
    const met = [p.metWhere, p.metWhen ? monthYear(p.metWhen) : ''].filter(Boolean).join(' · ');
    if (met) f += field('Where you met', esc(met));
    const ties = connections(p);
    if (ties.length) {
      f += field('How you are connected', ties.map(([w, id], i) => `${i ? w : w[0].toUpperCase() + w.slice(1)} <button type="button" class="inl" data-go="${esc(id)}">${esc(data.byId.get(id).name)}</button>`).join(' · '), ' f-ties');
    }
    if (p.topics.length) f += field('Topics', p.topics.map((t) => `<span class="tag">${esc(t)}</span>`).join(''), ' f-tags');
    if (p.notes) f += field('Your notes', esc(p.notes));
    if (p.email) f += field('Email', `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>`);
    if (p.phone) f += field('Phone', `<a href="tel:${esc(p.phone.replace(/[^0-9+]/g, ''))}">${esc(p.phone)}</a>`);
    if (p.linkedin) f += field('LinkedIn', `<a href="${esc(p.linkedin)}" target="_blank" rel="noopener noreferrer">${esc(p.linkedin.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a>`);
    if (p.connectedOn) f += field('Connected on LinkedIn', esc(fullDate(p.connectedOn)));
    if (f) h += `<dl class="c-fields">${f}</dl>`;
    return h;
  }
  function renderCard() {
    const card = $('card');
    const p = sel && data ? data.byId.get(sel) : null;
    if (!p) { card.hidden = true; return; }
    const focus = keepFocus();
    $('cardBody').innerHTML = cardHTML(p);
    card.hidden = false;
    restoreFocus(focus);
  }

  /* ---------- The side: People to get back to, a sector, To sort ---------- */
  function rowHTML(p, right, fade) {
    const S = SEC[p.sector];
    return `<li><button type="button" class="pr" data-id="${esc(p.id)}" aria-controls="card"><span class="av-s" style="background:${S.fill};color:${S.ink}" aria-hidden="true">${esc(initials(p.name))}</span>` +
      `<span class="pr-main"><span class="pr-name">${esc(p.name)}</span><span class="pr-sub">${esc(roleOrg(p) || secName(p.sector))}</span></span>` +
      `<span class="pr-when${fade ? ' fade' : ''}">${esc(right)}</span></button></li>`;
  }
  const NEVER_SHOWN = 20;
  function renderSide() {
    const box = $('side');
    if (!data) { box.hidden = true; return; }
    const wide = WIDE.matches;
    box.hidden = wide && !!sel;
    box.classList.toggle('is-sheet', !wide && side.mode !== 'back');
    $('sideClose').hidden = side.mode === 'back';
    const focus = keepFocus();
    let title = '', sub = '', h = '';
    if (side.mode === 'sector' && side.sector) {
      const list = data.people.filter((p) => p.sector === side.sector).sort(byRecent);
      title = secName(side.sector);
      sub = `${countWords(list.length)} · most recent contact first`;
      h = `<ul class="plist">${list.map((p) => rowHTML(p, p.fading ? fadeNote(p) : ago(p.lastContact), p.fading)).join('')}</ul>`;
    } else if (side.mode === 'sort') {
      const list = data.people.filter((p) => p.sector === 'sort').sort(byName);
      title = 'To sort';
      sub = list.length ? 'Give each person a sector to put them on the map.' : '';
      h = list.length ? `<ul class="plist">${list.map((p) => {
        const opts = ['<option value="">Pick a sector</option>', ...ON_MAP.map((s) => `<option value="${s}">${esc(secName(s))}</option>`)].join('');
        const S = SEC.sort;
        return `<li class="sort-row"><button type="button" class="pr" data-id="${esc(p.id)}" aria-controls="card"><span class="av-s" style="background:${S.fill};color:${S.ink}" aria-hidden="true">${esc(initials(p.name))}</span>` +
          `<span class="pr-main"><span class="pr-name">${esc(p.name)}</span><span class="pr-sub">${esc(roleOrg(p) || 'No company given')}</span></span><span class="pr-when"></span></button>` +
          `<div class="sort-sel"><label for="ss-${esc(p.id)}">Sector</label><select id="ss-${esc(p.id)}" class="sel" data-sort="${esc(p.id)}">${opts}</select></div></li>`;
      }).join('')}</ul>` : '<p class="side-none">No one to sort. Everyone is on the map.</p>';
    } else {
      side.mode = 'back';
      title = 'People to get back to';
      const gone = data.people.filter((p) => p.fading && p.lastContact).sort((a, b) => a.lastContact.localeCompare(b.lastContact) || byName(a, b));
      const never = data.people.filter((p) => p.fading && !p.lastContact).sort((a, b) => (a.source === b.source ? 0 : a.source === 'hand' ? -1 : 1) || byName(a, b));
      sub = gone.length || never.length ? `No contact for ${data.fadeMonths} months or more, longest first` : '';
      if (gone.length) h += `<ul class="plist">${gone.map((p) => rowHTML(p, fadeNote(p), true)).join('')}</ul>`;
      if (never.length) {
        const shown = side.all ? never : never.slice(0, NEVER_SHOWN);
        h += `<h3 class="sg">No contact yet · ${never.length}</h3><ul class="plist">${shown.map((p) => rowHTML(p, '', false)).join('')}</ul>`;
        if (never.length > shown.length) h += `<button type="button" id="sideAll" class="btn more-all">Show all ${never.length}</button>`;
      }
      if (!h) h = `<p class="side-none">${data.people.length ? `No one to get back to. Everyone has heard from you in the last ${data.fadeMonths} months.` : 'No one yet.'}</p>`;
    }
    if ($('sideH').textContent !== title) $('sideH').textContent = title;
    $('sideSub').textContent = sub;
    $('sideBody').innerHTML = h;
    restoreFocus(focus);
  }
  function openSide(mode, sector, from) {
    if (!data) return;
    if (sel) closeCard(false);
    side = { mode, sector: sector || null, all: false, opener: from || null };
    renderAll();
    $('side').scrollTop = 0;
    $('sideH').focus({ preventScroll: !WIDE.matches ? false : true });
  }
  function closeSide() {
    const back = side.opener;
    side = { mode: 'back', sector: null, all: false, opener: null };
    renderAll();
    focusEl(back);
  }

  /* ---------- Opening and closing a person ---------- */
  function select(id, { from = null, focus = true } = {}) {
    if (!data || !data.byId.has(id)) return;
    if (sel !== id) cardErr = '';
    sel = id;
    lastAuto = '';
    opener = from ? describe(from) : `#map .node[data-id="${CSS.escape(id)}"]`;
    renderAll();
    $('card').scrollTop = 0;
    if (focus) $('cardH').focus({ preventScroll: true });
    setUrl();
  }
  function closeCard(back = true) {
    if (!sel) return;
    const was = sel;
    sel = null;
    cardErr = '';
    renderAll();
    setUrl();
    if (back) focusEl(opener || `#map .node[data-id="${CSS.escape(was)}"]`);
  }
  // A way to find an element again after it is drawn anew.
  function describe(el) {
    if (el.id) return '#' + el.id;
    if (el.dataset.id) return `${el.closest('#side') ? '#sideBody .pr' : '#map .node'}[data-id="${CSS.escape(el.dataset.id)}"]`;
    if (el.dataset.more) return `#map [data-more="${el.dataset.more}"]`;
    if (el.dataset.act) return `#cardBody [data-act="${el.dataset.act}"]`;
    if (el.dataset.open) return `#app [data-open="${el.dataset.open}"]`;
    return null;
  }
  function focusEl(q) {
    const el = typeof q === 'string' ? document.querySelector(q) : q;
    if (el && document.contains(el) && !el.closest('[hidden]')) el.focus({ preventScroll: WIDE.matches });
  }
  function setUrl() {
    try {
      const u = new URL(location.href);
      if (sel) u.searchParams.set('p', sel); else u.searchParams.delete('p');
      history.replaceState(null, '', u);
    } catch (e) { /* not allowed here */ }
  }

  /* ---------- The page's state ---------- */
  function renderAll() {
    const ph = WIDE.matches ? 'Search a name, organisation or topic' : 'Search';
    if ($('q').placeholder !== ph) $('q').placeholder = ph;
    show();
    renderMap();
    renderSide();
    renderCard();
    const phoneSheet = !WIDE.matches && (!!sel || side.mode !== 'back');
    $('scrim').hidden = !phoneSheet;
  }
  function show() {
    $('away').hidden = !!data || !failed;
    $('empty').hidden = !data || data.people.length > 0;
    const st = $('status');
    st.textContent = !data ? (failed ? '' : 'Loading…') : failed ? 'Can’t reach the hub · showing what was there' : '';
    st.style.color = !data && !failed ? 'var(--muted)' : '';
    st.style.fontWeight = !data && !failed ? '500' : '';
    const nSort = data ? data.people.filter((p) => p.sector === 'sort').length : 0;
    $('sortBtn').hidden = !nSort;
    $('sortBtn').textContent = `${nSort} to sort`;
    $('sortBtn').setAttribute('aria-expanded', String(side.mode === 'sort'));
    $('legend').hidden = !data || !data.people.length;
    if (data) $('legend').textContent = `Dashed arrow: introduced · Line: work together · Faded: no contact for ${data.fadeMonths} months`;
    $('foot').hidden = !data;
    // Nothing to add to, search or import into until the hub has answered once.
    for (const b of ['addBtn', 'importBtn', 'q', 'fadeOnly']) $(b).disabled = !data;
  }

  let toastTimer = 0;
  function toast(words) {
    const t = $('toast');
    t.textContent = words;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 5000);
  }

  /* ---------- The hub ---------- */
  let inflight = null, lastRead = -1e9, first = true;
  function load() {
    if (inflight) return inflight;
    lastRead = performance.now();
    inflight = (async () => {
      try {
        const r = await fetch(BASE, { cache: 'no-store' });
        if (!r.ok) throw new Error('status ' + r.status);
        data = clean(await r.json());
        failed = false;
        if (sel && !data.byId.has(sel)) { sel = null; setUrl(); }
      } catch (e) {
        failed = true;
      } finally {
        inflight = null;
        lastRead = performance.now();
        renderAll();
      }
      if (first && data) {
        first = false;
        const p = params.get('p');
        if (p) {
          if (data.byId.has(p)) select(p);
          else { toast('That person is not in your network any more.'); setUrl(); }
        }
      }
    })();
    return inflight;
  }
  async function call(path, body) {
    let r;
    try {
      r = await fetch(BASE + path, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    } catch (e) {
      const err = new Error('away');
      err.status = 0;
      throw err;
    }
    let out = null;
    try { out = await r.json(); } catch (e) { /* not JSON */ }
    if (!r.ok) {
      const err = new Error('status ' + r.status);
      err.status = r.status;
      err.hub = out && typeof out.error === 'string' ? out.error : '';
      throw err;
    }
    return out || {};
  }
  // The hub's short reasons, in plain words.
  function words(e) {
    const h = e.hub || '';
    if (!e.status) return 'Can’t reach the hub. Nothing changed, try again.';
    if (e.status === 409) {
      if (/reach/i.test(h)) return 'There is already a Reach out task for this person in To-do.';
      if (/linkedin/i.test(h)) return 'Someone with that LinkedIn link is already in your network.';
      return 'That is already done.';
    }
    if (e.status === 404) return 'That person is not on the hub any more.';
    if (e.status === 413) return 'That is too large for the hub.';
    if (e.status === 400) {
      if (/^name/.test(h)) return 'Give the person a name.';
      if (/^linkedin/.test(h)) return 'The LinkedIn link has to be a linkedin.com profile link.';
      if (/^email/.test(h)) return 'That email address does not look right.';
      if (/^phone/.test(h)) return 'That phone number does not look right.';
      if (/^lastContact|^date/.test(h)) return 'Last contact has to be a day that has been, not one to come.';
      if (/^metWhen/.test(h)) return 'When has to be a month and a year.';
      if (/^topics/.test(h)) return 'Twelve topics at most.';
      if (/^notes/.test(h)) return 'The notes are too long: 1000 characters at most.';
      if (/^what/.test(h)) return 'Say what it was about.';
      if (/empty/.test(h)) return 'That file is empty.';
      if (/^csv/.test(h)) return 'That file has no First Name and Last Name columns. Is it Connections.csv?';
      return 'The hub did not take that' + (h ? ': ' + h : '.');
    }
    if (e.status === 503) return 'The hub is not ready for this yet. Try again later.';
    return 'Something went wrong on the hub. Nothing changed.';
  }

  /* ---------- Talked today ---------- */
  async function talked(p, btn) {
    btn.disabled = true;
    cardErr = '';
    try {
      const out = await call(`/person/${encodeURIComponent(p.id)}/talked`, {});
      put(out.person);
      toast(`Last contact with ${p.name} is today.`);
    } catch (e) {
      cardErr = words(e);
      if (e.status === 404) load();
    }
    renderAll();
    focusEl('#cardBody [data-act="talked"]');
  }

  /* ---------- Dialogs: each gives the focus back to what opened it ---------- */
  const back = new Map();
  function openDlg(id, from, focus) {
    const d = $(id);
    back.set(id, from && from.isConnected ? describe(from) || from : null);
    if (!d.open) d.showModal();
    if (focus) { const el = typeof focus === 'string' ? d.querySelector(focus) : focus; if (el) el.focus(); }
  }
  for (const id of ['reach', 'sent', 'form', 'imp']) {
    const d = $(id);
    d.addEventListener('close', () => {
      const to = back.get(id);
      back.delete(id);
      setTimeout(() => focusEl(to || (sel ? '#cardH' : '#addBtn')), 0);
    });
    d.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) { e.preventDefault(); d.close(); return; }
      // A tap on the dimmed page around a sheet closes it (not around a form being filled).
      if (e.target === d && id !== 'form') {
        const r = d.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
      }
    });
  }
  function pickChips(root, attr, value) {
    for (const b of root.querySelectorAll(`[data-pick="${attr}"] .chip`)) b.setAttribute('aria-pressed', String(b.dataset.v === String(value)));
  }
  function chipGroup(root, attr, onPick) {
    root.addEventListener('click', (e) => {
      const b = e.target.closest(`[data-pick="${attr}"] .chip`);
      if (!b) return;
      onPick(b.dataset.v);
      pickChips(root, attr, b.dataset.v);
    });
  }
  const errLine = (id, words) => { $(id).textContent = words || ''; $(id).hidden = !words; };

  /* ---------- Reach out ---------- */
  const rc = { section: 'soon', energy: 'normal', id: null, busy: false };
  chipGroup($('reach'), 'section', (v) => { rc.section = v; });
  chipGroup($('reach'), 'energy', (v) => { rc.energy = v; });
  function openReach(p, from) {
    Object.assign(rc, { section: 'soon', energy: 'normal', id: p.id, busy: false });
    pickChips($('reach'), 'section', 'soon');
    pickChips($('reach'), 'energy', 'normal');
    $('reachText').textContent = 'Reach out to ' + p.name;
    errLine('reachErr', '');
    $('reachGo').disabled = false;
    openDlg('reach', from, '#reachGo');
  }
  $('reachForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (rc.busy) return;
    const p = data && data.byId.get(rc.id);
    if (!p) { $('reach').close(); return; }
    rc.busy = true;
    $('reachGo').disabled = true;
    errLine('reachErr', '');
    try {
      const out = await call(`/person/${encodeURIComponent(p.id)}/reach`, { section: rc.section, energy: rc.energy });
      put(out.person);
      cardErr = '';
      renderAll();
      $('reach').close();
      toast(`${(out.task && str(out.task.text, 160)) || 'Reach out to ' + p.name} is in To-do · ${rc.section === 'today' ? 'Today' : 'Soon'}`);
    } catch (err) {
      errLine('reachErr', words(err));
    }
    rc.busy = false;
    $('reachGo').disabled = false;
  });

  /* ---------- Sent a message ---------- */
  const sn = { channel: 'email', chaseDays: 7, id: null, busy: false };
  chipGroup($('sent'), 'channel', (v) => { sn.channel = v; });
  chipGroup($('sent'), 'chaseDays', (v) => { sn.chaseDays = Number(v); });
  function openSent(p, from) {
    Object.assign(sn, { channel: 'email', chaseDays: 7, id: p.id, busy: false });
    pickChips($('sent'), 'channel', 'email');
    pickChips($('sent'), 'chaseDays', 7);
    $('sentIntro').textContent = `You sent ${p.name} something and are waiting for an answer. It goes into Waiting on like any other.`;
    $('sentWhat').value = '';
    $('sentWhat').removeAttribute('aria-invalid');
    errLine('sentErr', '');
    $('sentGo').disabled = false;
    openDlg('sent', from, '#sentWhat');
  }
  $('sentWhat').addEventListener('input', () => { if ($('sentWhat').value.trim()) { $('sentWhat').removeAttribute('aria-invalid'); errLine('sentErr', ''); } });
  $('sentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sn.busy) return;
    const p = data && data.byId.get(sn.id);
    if (!p) { $('sent').close(); return; }
    const what = $('sentWhat').value.trim();
    if (!what) {
      $('sentWhat').setAttribute('aria-invalid', 'true');
      errLine('sentErr', 'Say what it was about.');
      $('sentWhat').focus();
      return;
    }
    sn.busy = true;
    $('sentGo').disabled = true;
    errLine('sentErr', '');
    try {
      const out = await call(`/person/${encodeURIComponent(p.id)}/sent`, { what, channel: sn.channel, chaseDays: sn.chaseDays });
      put(out.person);
      cardErr = '';
      renderAll();
      $('sent').close();
      toast(`Waiting on ${p.name} about ${what}`);
    } catch (err) {
      errLine('sentErr', words(err));
    }
    sn.busy = false;
    $('sentGo').disabled = false;
  });

  /* ---------- Add a person, Edit ---------- */
  const KIND_WORDS = { by: 'Introduced by', to: 'Introduced you to', with: 'Works with' };
  const pf = { mode: 'add', id: null, sector: '', links: [], topics: [], orig: null, origLinks: [], kind: 'by', busy: false };
  const FIELDS = [['name', 'pfName'], ['org', 'pfOrg'], ['role', 'pfRole'], ['metWhere', 'pfWhere'], ['notes', 'pfNotes'], ['email', 'pfEmail'], ['phone', 'pfPhone'], ['linkedin', 'pfLinkedin'], ['lastContact', 'pfLast']];
  $('pfSec').innerHTML = ON_MAP.map((s) => `<button type="button" class="chip" data-v="${s}" aria-pressed="false">${esc(SEC[s].name)}</button>`).join('');
  $('pfSec').dataset.pick = 'sector';
  chipGroup($('form'), 'sector', (v) => { pf.sector = v; $('pfSecHint').hidden = true; });
  chipGroup($('form'), 'kind', (v) => { pf.kind = v; renderPicker(); });

  // In the card's order: Introduced by, works with, introduced you to.
  const linksOf = (p) => connections(p).map(([w, id]) => ({ kind: w === 'Introduced by' ? 'by' : w === 'works with' ? 'with' : 'to', id }));
  function openForm(p, from) {
    const edit = !!p;
    Object.assign(pf, {
      mode: edit ? 'edit' : 'add', id: edit ? p.id : null, sector: edit && p.sector !== 'sort' ? p.sector : '',
      links: edit ? linksOf(p) : [], topics: edit ? p.topics.slice() : [], orig: edit ? { ...p, topics: p.topics.slice() } : null, kind: 'by', busy: false,
    });
    pf.origLinks = pf.links.map((l) => ({ ...l }));
    $('pfH').textContent = edit ? 'Edit' : 'Add a person';
    for (const [k, id] of FIELDS) { $(id).value = edit ? p[k] || '' : ''; $(id).removeAttribute('aria-invalid'); }
    $('pfWhen').value = edit ? p.metWhen : '';
    $('pfWhen').removeAttribute('aria-invalid');
    if (data) $('pfLast').max = data.today;
    pickChips($('form'), 'sector', pf.sector);
    pickChips($('form'), 'kind', 'by');
    $('pfSecHint').hidden = !(edit && p.sector === 'sort');
    $('pfSecHint').textContent = 'To sort: off the map until you pick a sector.';
    $('picker').hidden = true;
    $('pkQ').value = '';
    $('topicAdd').hidden = true;
    $('pfTopic').value = '';
    $('pfRemove').hidden = !edit;
    $('rmConfirm').hidden = true;
    $('rmAsk').hidden = false;
    errLine('pfErr', '');
    $('pfSave').disabled = false;
    renderLinks();
    renderTopics();
    openDlg('form', from, '#pfName');
    $('form').querySelector('.pf-body').scrollTop = 0;
  }
  function renderLinks() {
    $('pfTies').innerHTML = pf.links.map((l, i) => {
      const who = data.byId.get(l.id);
      if (!who) return '';
      const t = `${KIND_WORDS[l.kind]} ${who.name}`;
      return `<span class="tag-x">${esc(t)}<button type="button" data-unlink="${i}" aria-label="${esc('Remove ' + t)}">×</button></span>`;
    }).join('') + `<button type="button" id="pkOpen" class="add-btn" aria-expanded="${!$('picker').hidden}" aria-controls="picker">+ Link a person</button>`;
  }
  function renderTopics() {
    $('pfTopics').innerHTML = pf.topics.map((t, i) => `<span class="tag-x">${esc(t)}<button type="button" data-untopic="${i}" aria-label="${esc('Remove ' + t)}">×</button></span>`).join('') +
      (pf.topics.length < 12 ? `<button type="button" id="topicOpen" class="add-btn" aria-expanded="${!$('topicAdd').hidden}" aria-controls="topicAdd">+ Topic</button>` : '');
  }
  function renderPicker() {
    const q = fold($('pkQ').value.trim());
    const taken = new Set(pf.links.filter((l) => l.kind === pf.kind || (pf.kind === 'with' && l.kind === 'with')).map((l) => l.id));
    const list = data.people.filter((p) => p.id !== pf.id && !taken.has(p.id) && (!q || fold([p.name, p.org, p.role].join(' ')).includes(q)));
    const shown = (q ? list.sort(byName) : list.sort(byRecent)).slice(0, 8);
    $('pkList').innerHTML = shown.length
      ? shown.map((p) => `<li><button type="button" class="pk" data-link="${esc(p.id)}"><span class="pk-n">${esc(p.name)}</span><span class="pk-s">${esc(roleOrg(p) || secName(p.sector))}</span></button></li>`).join('')
      : `<li class="pk-none">${q ? 'No one by that name.' : 'No one to link yet.'}</li>`;
  }
  function openPicker(on) {
    $('picker').hidden = !on;
    renderLinks();
    if (on) { $('pkQ').value = ''; renderPicker(); $('pkQ').focus(); } else focusEl('#pkOpen');
  }
  function openTopic(on) {
    $('topicAdd').hidden = !on;
    renderTopics();
    if (on) $('pfTopic').focus(); else focusEl('#topicOpen');
  }
  function addTopic() {
    const t = str($('pfTopic').value, 40);
    if (t && pf.topics.length < 12 && !pf.topics.some((x) => x.toLowerCase() === t.toLowerCase())) pf.topics.push(t);
    $('pfTopic').value = '';
    renderTopics();
    if (pf.topics.length >= 12) openTopic(false); else $('pfTopic').focus();
  }
  $('form').addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('#pkOpen')) { openPicker($('picker').hidden); return; }
    if (t.closest('#pkDone')) { openPicker(false); return; }
    const link = t.closest('[data-link]');
    if (link) {
      pf.links.push({ kind: pf.kind, id: link.dataset.link });
      openPicker(false);
      return;
    }
    const un = t.closest('[data-unlink]');
    if (un) { pf.links.splice(+un.dataset.unlink, 1); renderLinks(); focusEl('#pkOpen'); return; }
    if (t.closest('#topicOpen')) { openTopic($('topicAdd').hidden); return; }
    if (t.closest('#pfTopicGo')) { addTopic(); return; }
    const ut = t.closest('[data-untopic]');
    if (ut) { pf.topics.splice(+ut.dataset.untopic, 1); renderTopics(); focusEl('#topicOpen'); return; }
    if (t.closest('#rmAsk')) {
      $('rmText').textContent = `Remove ${pf.orig ? pf.orig.name : 'this person'} from your network? Their links go too.`;
      $('rmConfirm').hidden = false;
      $('rmAsk').hidden = true;
      $('rmKeep').focus();
      return;
    }
    if (t.closest('#rmKeep')) { $('rmConfirm').hidden = true; $('rmAsk').hidden = false; $('rmAsk').focus(); return; }
    if (t.closest('#rmGo')) removePerson();
  });
  $('pkQ').addEventListener('input', renderPicker);
  $('pkQ').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); const b = $('pkList').querySelector('[data-link]'); if (b) b.click(); }
  });
  $('picker').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); openPicker(false); } });
  $('pfTopic').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addTopic(); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); openTopic(false); }
  });

  // "2026-03", "03-2026", "March 2026" or "Mar 2026" to YYYY-MM; '' when empty; null when not a month.
  function monthOf(s) {
    s = s.trim();
    if (!s) return '';
    let m = s.match(/^(\d{4})-(\d{1,2})$/);
    if (m && +m[2] >= 1 && +m[2] <= 12) return `${m[1]}-${m[2].padStart(2, '0')}`;
    m = s.match(/^(\d{1,2})[/-](\d{4})$/);
    if (m && +m[1] >= 1 && +m[1] <= 12) return `${m[2]}-${m[1].padStart(2, '0')}`;
    m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{4})$/);
    if (m) {
      const i = MONTH.findIndex((x) => x.toLowerCase().startsWith(m[1].toLowerCase().slice(0, 3)));
      if (i >= 0) return `${m[2]}-${String(i + 1).padStart(2, '0')}`;
    }
    return null;
  }
  function formValues() {
    const v = {};
    for (const [k, id] of FIELDS) v[k] = k === 'notes' ? $(id).value.trim() : str($(id).value, 1000);
    v.metWhen = monthOf($('pfWhen').value);
    return v;
  }
  function invalid(id, words) {
    $(id).setAttribute('aria-invalid', 'true');
    errLine('pfErr', words);
    $(id).focus();
    return false;
  }
  function check(v) {
    for (const [, id] of FIELDS) $(id).removeAttribute('aria-invalid');
    $('pfWhen').removeAttribute('aria-invalid');
    if (!v.name) return invalid('pfName', 'Give the person a name.');
    if (v.metWhen === null) return invalid('pfWhen', 'When has to be a month and a year, like March 2026.');
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return invalid('pfEmail', 'That email address does not look right.');
    if (v.phone && (!/^[0-9+()\s./-]{3,}$/.test(v.phone) || !/\d/.test(v.phone))) return invalid('pfPhone', 'That phone number does not look right.');
    if (v.linkedin && !/^https?:\/\/([a-z0-9-]+\.)*linkedin\.com\/(in|pub)\/[^/\s]+/i.test(v.linkedin)) return invalid('pfLinkedin', 'The LinkedIn link has to be a linkedin.com profile link, like https://www.linkedin.com/in/name.');
    if (v.lastContact && (!DATE.test(v.lastContact) || (data && v.lastContact > data.today))) return invalid('pfLast', 'Last contact has to be a day that has been, not one to come.');
    return true;
  }
  const tieOf = (me, l) => (l.kind === 'by' ? { a: l.id, b: me, kind: 'introduced' } : l.kind === 'to' ? { a: me, b: l.id, kind: 'introduced' } : { a: me, b: l.id, kind: 'works_with' });
  const sameLink = (x, y) => x.kind === y.kind && x.id === y.id;
  $('pf').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (pf.busy || !data) return;
    const v = formValues();
    if (!check(v)) return;
    errLine('pfErr', '');
    let body = {};
    if (pf.mode === 'add') {
      for (const [k] of FIELDS) if (v[k]) body[k] = v[k];
      if (v.metWhen) body.metWhen = v.metWhen;
      body.sector = pf.sector || 'other';
      if (pf.topics.length) body.topics = pf.topics.slice();
    } else {
      const o = pf.orig;
      for (const [k] of [...FIELDS, ['metWhen']]) if ((v[k] || '') !== (o[k] || '')) body[k] = v[k] || (k === 'name' ? v[k] : null);
      if (pf.sector && pf.sector !== o.sector) body.sector = pf.sector;
      if (pf.topics.join('\n') !== o.topics.join('\n')) body.topics = pf.topics.slice();
    }
    pf.busy = true;
    $('pfSave').disabled = true;
    const added = pf.mode === 'add';
    let saved = false;
    try {
      let p;
      if (pf.mode === 'add') p = put((await call('/person', body)).person);
      else if (Object.keys(body).length) p = put((await call(`/person/${encodeURIComponent(pf.id)}`, body)).person);
      else p = data.byId.get(pf.id);
      if (!p) throw Object.assign(new Error('shape'), { status: 500 });
      saved = true;
      // Saved: from here a second Save only does the links that are left.
      if (pf.mode === 'add') { pf.mode = 'edit'; pf.id = p.id; pf.origLinks = []; }
      pf.orig = { ...p, topics: p.topics.slice() };
      const adds = pf.links.filter((l) => !pf.origLinks.some((x) => sameLink(x, l)));
      const gone = pf.origLinks.filter((l) => !pf.links.some((x) => sameLink(x, l)));
      for (const l of gone) {
        const out = await call('/tie', { ...tieOf(p.id, l), remove: true });
        data.ties = cleanTies(out.ties, data.byId);
        pf.origLinks = pf.origLinks.filter((x) => !sameLink(x, l));
      }
      for (const l of adds) {
        const out = await call('/tie', tieOf(p.id, l));
        data.ties = cleanTies(out.ties, data.byId);
        pf.origLinks.push({ ...l });
      }
      pf.busy = false;
      back.set('form', null);
      $('form').close();
      select(p.id);
      toast(added ? `${p.name} is in your network.` : 'Saved.');
    } catch (err) {
      errLine('pfErr', saved ? `Saved, but a link did not save. ${words(err)}` : words(err));
      if (saved) renderAll();
      $('form').querySelector('.pf-body').scrollTop = 0;
    }
    pf.busy = false;
    $('pfSave').disabled = false;
  });
  async function removePerson() {
    if (pf.busy || !pf.id) return;
    const name = pf.orig ? pf.orig.name : '';
    pf.busy = true;
    $('rmGo').disabled = true;
    try {
      await call(`/person/${encodeURIComponent(pf.id)}/delete`, {});
      drop(pf.id);
      if (sel === pf.id) sel = null;
      cardErr = '';
      back.set('form', '#q');
      $('form').close();
      setUrl();
      renderAll();
      toast(`${name} is no longer in your network.`);
    } catch (err) {
      errLine('pfErr', words(err));
    }
    pf.busy = false;
    $('rmGo').disabled = false;
  }

  /* ---------- Import LinkedIn ---------- */
  const imp = { csv: '', rows: [], counts: null, choice: {}, busy: false, token: 0 };
  function impReset() {
    Object.assign(imp, { csv: '', rows: [], counts: null, choice: {}, busy: false, token: imp.token + 1 });
    $('impFileName').hidden = true;
    $('impCounts').textContent = '';
    $('impPick').textContent = 'Choose Connections.csv';
    $('impPick').disabled = false;
    $('impTable').hidden = true;
    $('impTable').innerHTML = '';
    $('impNote').hidden = true;
    $('impDone').hidden = true;
    $('impGo').hidden = true;
    $('impCancel').textContent = 'Cancel';
    $('impFile').value = '';
    errLine('impErr', '');
  }
  function openImport(from) {
    impReset();
    openDlg('imp', from, '#impPick');
  }
  function impNote() {
    const k = imp.rows.filter((r) => r.status === 'new' && imp.choice[r.key] === 'sort').length;
    $('impNote').textContent = 'Sectors are suggested from the company name; change any of them.' +
      (k ? ` ${k === 1 ? '1 is' : k + ' are'} To sort: off the map until you give them a sector.` : '');
    $('impNote').hidden = false;
  }
  const OPTS = [...ON_MAP, 'sort'];
  function impTable() {
    const rows = imp.rows.map((r, i) => {
      const sec = r.status === 'match' ? '<span class="here">Already here</span>'
        : `<select class="sel${imp.choice[r.key] === 'sort' ? ' is-sort' : ''}" data-row="${i}" aria-label="${esc('Sector for ' + r.name)}">${OPTS.map((s) => `<option value="${s}"${imp.choice[r.key] === s ? ' selected' : ''}>${esc(secName(s))}</option>`).join('')}</select>`;
      return `<tr class="${r.status === 'match' ? 'is-match' : ''}"><td>${esc(r.name)}</td><td>${esc(r.org)}</td><td>${esc(r.role)}</td><td>${r.connectedOn ? esc(fullDate(r.connectedOn)) : ''}</td><td>${sec}</td></tr>`;
    }).join('');
    $('impTable').innerHTML = `<table><thead><tr><th scope="col">Name</th><th scope="col">Company</th><th scope="col">Position</th><th scope="col">Connected on</th><th scope="col">Sector</th></tr></thead><tbody>${rows}</tbody></table>`;
    $('impTable').hidden = false;
    $('impTable').scrollTop = 0;
  }
  async function impRead(file) {
    if (!file || imp.busy) return;
    const token = ++imp.token;
    errLine('impErr', '');
    $('impDone').hidden = true;
    if (file.size > 3e6) { errLine('impErr', 'That file is too large to be Connections.csv.'); return; }
    let text = '';
    try { text = await file.text(); } catch (e) { errLine('impErr', 'This browser could not read that file.'); return; }
    imp.busy = true;
    $('impPick').disabled = true;
    $('impFileName').textContent = file.name || 'Connections.csv';
    $('impFileName').hidden = false;
    $('impCounts').textContent = 'Reading…';
    try {
      const out = await call('/import', { csv: text, dry: true });
      if (token !== imp.token) return;
      const rows = (Array.isArray(out.rows) ? out.rows : []).filter((r) => r && typeof r.key === 'string' && str(r.name, 120)).map((r) => ({
        key: r.key, name: str(r.name, 120), org: str(r.org, 120), role: str(r.role, 120),
        connectedOn: DATE.test(r.connectedOn || '') ? r.connectedOn : '', status: r.status === 'match' ? 'match' : 'new', sector: OPTS.includes(r.sector) ? r.sector : 'sort',
      }));
      const c = out.counts && typeof out.counts === 'object' ? out.counts : {};
      imp.csv = text;
      imp.rows = rows;
      imp.counts = { total: Number(c.total) || rows.length, new: Number(c.new) || rows.filter((r) => r.status === 'new').length, match: Number(c.match) || rows.filter((r) => r.status === 'match').length };
      imp.choice = {};
      for (const r of rows) if (r.status === 'new') imp.choice[r.key] = r.sector;
      $('impCounts').textContent = `${plural(imp.counts.total, 'connection', 'connections')} · ${imp.counts.new} new · ${imp.counts.match} already here`;
      $('impPick').textContent = 'Choose another file';
      if (rows.length) { impTable(); impNote(); } else { $('impTable').hidden = true; $('impNote').hidden = true; }
      $('impGo').hidden = !imp.counts.new;
      $('impGo').textContent = `Import ${plural(imp.counts.new, 'person', 'people')}`;
      if (!imp.counts.new) { $('impNote').textContent = rows.length ? 'Everyone in this file is already here.' : 'There is no one in this file.'; $('impNote').hidden = false; }
    } catch (err) {
      if (token !== imp.token) return;
      $('impCounts').textContent = '';
      $('impTable').hidden = true;
      $('impNote').hidden = true;
      $('impGo').hidden = true;
      errLine('impErr', words(err));
    } finally {
      if (token === imp.token) { imp.busy = false; $('impPick').disabled = false; }
    }
  }
  $('impPick').addEventListener('click', () => $('impFile').click());
  $('impFile').addEventListener('change', () => { const f = $('impFile').files && $('impFile').files[0]; if (f) impRead(f); });
  $('impTable').addEventListener('change', (e) => {
    const s = e.target.closest('select[data-row]');
    if (!s) return;
    const r = imp.rows[+s.dataset.row];
    if (!r) return;
    imp.choice[r.key] = s.value;
    s.classList.toggle('is-sort', s.value === 'sort');
    impNote();
  });
  const zone = $('drop');
  for (const ev of ['dragenter', 'dragover']) zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('is-over'); });
  for (const ev of ['dragleave', 'dragend']) zone.addEventListener(ev, () => zone.classList.remove('is-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('is-over');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) impRead(f);
  });
  $('impGo').addEventListener('click', async () => {
    if (imp.busy || !imp.csv) return;
    const token = imp.token;
    imp.busy = true;
    $('impGo').disabled = true;
    $('impPick').disabled = true;
    errLine('impErr', '');
    try {
      const out = await call('/import', { csv: imp.csv, sectors: { ...imp.choice } });
      if (token !== imp.token) return;
      $('impDone').textContent = `Added ${Number(out.added) || 0} · ${Number(out.matched) || 0} already here`;
      $('impDone').hidden = false;
      $('impTable').hidden = true;
      $('impNote').hidden = true;
      $('impGo').hidden = true;
      $('impCancel').textContent = 'Done';
      $('impCancel').focus();
      imp.csv = '';
      load();
    } catch (err) {
      if (token === imp.token) errLine('impErr', words(err));
    } finally {
      if (token === imp.token) { imp.busy = false; $('impGo').disabled = false; $('impPick').disabled = false; }
    }
  });
  $('imp').addEventListener('close', () => { imp.token++; imp.busy = false; $('impGo').disabled = false; });

  /* ---------- To sort: a sector from the list ---------- */
  $('side').addEventListener('change', async (e) => {
    const s = e.target.closest('select[data-sort]');
    if (!s || !s.value || !data) return;
    const p = data.byId.get(s.dataset.sort);
    if (!p) return;
    const sector = s.value;
    s.disabled = true;
    try {
      const out = await call(`/person/${encodeURIComponent(p.id)}`, { sector });
      put(out.person);
      renderAll();
      toast(`${p.name} is on the map in ${secName(sector)}.`);
      const next = $('sideBody').querySelector('select[data-sort]');
      focusEl(next || '#sideH');
    } catch (err) {
      s.disabled = false;
      s.value = '';
      toast(words(err));
    }
  });

  /* ---------- Wiring ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('dialog')) return;
    const node = t.closest('#map .node[data-id]');
    if (node) { if (sel === node.dataset.id) closeCard(true); else select(node.dataset.id, { from: node }); return; }
    const more = t.closest('[data-more]');
    if (more) { openSide('sector', more.dataset.more, describe(more)); return; }
    const row = t.closest('#sideBody .pr[data-id]');
    if (row) { select(row.dataset.id, { from: row }); return; }
    const go = t.closest('#cardBody [data-go]');
    if (go) { select(go.dataset.go, { from: null }); return; }
    if (t.closest('#cardClose')) { closeCard(true); return; }
    const act = t.closest('#cardBody [data-act]');
    if (act && sel && data) {
      const p = data.byId.get(sel);
      if (!p) return;
      const a = act.dataset.act;
      if (a === 'talked') talked(p, act);
      else if (a === 'reach') openReach(p, act);
      else if (a === 'sent') openSent(p, act);
      else if (a === 'edit') openForm(p, act);
      return;
    }
    if (t.closest('#sideClose')) { closeSide(); return; }
    if (t.closest('#sideAll')) { side.all = true; renderSide(); return; }
    if (t.closest('#sortBtn')) { if (side.mode === 'sort') closeSide(); else openSide('sort', null, '#sortBtn'); return; }
    if (t.closest('#addBtn') || t.closest('[data-open="add"]')) { if (data) openForm(null, t.closest('button')); return; }
    if (t.closest('#importBtn') || t.closest('#importBtn2') || t.closest('[data-open="import"]')) { if (data) openImport(t.closest('button')); return; }
    if (t.closest('#fadeOnly')) {
      fadeOnly = !fadeOnly;
      $('fadeOnly').setAttribute('aria-pressed', String(fadeOnly));
      renderMap();
      return;
    }
    const retry = t.closest('#retry');
    if (retry) {
      retry.disabled = true;
      retry.textContent = 'Trying…';
      load().then(() => { const b = $('retry'); b.disabled = false; b.textContent = 'Retry'; if (!data) b.focus(); else $('q').focus(); });
      return;
    }
    if (t.closest('#scrim')) { if (sel) closeCard(true); else if (side.mode !== 'back') closeSide(); return; }
    // A click on the empty map puts the card away (PC).
    if (sel && t.closest('#map') && WIDE.matches) closeCard(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    if (sel) { e.preventDefault(); closeCard(true); return; }
    if (side.mode !== 'back') { e.preventDefault(); closeSide(); return; }
    if (e.target === $('q') && $('q').value) { e.preventDefault(); $('q').value = ''; setQuery(''); }
  });

  // Search: what does not match dims. Enter opens the first match; on the PC a single match opens at once.
  function found() { return data ? data.people.filter((p) => matches(p)).sort(byName) : []; }
  function setQuery(v) {
    query = v.trim();
    renderMap();
    if (!query || !data) { lastAuto = ''; return; }
    const f = found();
    if (WIDE.matches && f.length === 1 && f[0].id !== sel && f[0].id !== lastAuto) {
      select(f[0].id, { from: $('q'), focus: false });
      lastAuto = f[0].id;
    }
  }
  $('q').addEventListener('input', () => setQuery($('q').value));
  $('q').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const f = found();
    if (query && f.length) select(f[0].id, { from: $('q') });
  });

  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  addEventListener('focus', () => { if (!document.hidden && performance.now() - lastRead > 2000) load(); });
  let sized = 0, wasWide = WIDE.matches;
  addEventListener('resize', () => {
    if (sized) return;
    sized = requestAnimationFrame(() => {
      sized = 0;
      if (WIDE.matches !== wasWide) { wasWide = WIDE.matches; renderAll(); } else renderMap();
    });
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (data) renderMap(); });

  renderAll();
  load();
})();
