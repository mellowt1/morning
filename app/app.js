/* Morning Screen. Read only, vanilla, no build step.
 *
 * One request to the paul-hub Worker (GET /api/morning/:code) brings every block.
 * The last good answer is kept in localStorage, so the page opens without signal and
 * says "As of 07:52". It refreshes when it becomes visible again and every ten minutes
 * while open. All times are shown in The Hague's time, whatever the device says.
 *
 * Layout: a greeting, the date with the sun as its full stop, one sentence about the day,
 * then numbered cards. 01 Start with, 02 Today (fact tiles, today's events, to-dos),
 * 03 Projects, 04 Coming up (from tomorrow), then Arsenal.
 *
 * Motion ("Alive", approved 27 Sept 2026 through the prototype): the clock rolls on the
 * minute, the sun's full stop climbs with the real sun and breathes light while it is up,
 * the next event's dot sends a ring every 8.1 s, the day's first open plays once, and rows
 * that are new since the page was last hidden get a green tick. Nothing else moves.
 */
(() => {
  'use strict';

  const TZ = 'Europe/Amsterdam';
  const ZONES = { here: TZ, miami: 'America/New_York', ecuador: 'America/Guayaquil' };
  const REFRESH = 10 * 60 * 1000;
  const CODE_RE = /^[a-z0-9]{16}$/;

  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const apiParam = params.get('api') || '';
  const API = (/^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)/.test(apiParam)
    ? apiParam
    : isLocal ? 'http://localhost:8787' : 'https://paul-hub.paul-o-a04.workers.dev').replace(/\/+$/, '');

  /* ---------- Storage (every access guarded; private mode can throw) ---------- */
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* full or blocked */ } },
  };

  /* ---------- The code in the link: the same link and code as the to-do app ---------- */
  let code = (params.get('c') || '').trim().toLowerCase();
  if (CODE_RE.test(code)) {
    store.set('morning.code', code);
  } else {
    // The to-do app lives on the same site and remembers the same code.
    code = store.get('morning.code') || store.get('todo.code') || '';
    if (CODE_RE.test(code)) {
      params.set('c', code);
      history.replaceState(null, '', location.pathname + '?' + params.toString());
    }
  }
  if (!CODE_RE.test(code)) {
    $('nocode').hidden = false;
    return;
  }
  $('app').hidden = false;

  const KEY = 'morning.last.' + code;
  let last = store.get(KEY); // { at, data }
  let failed = false;
  let arsenalDirect = null; // the Arsenal block fetched by the browser, when the Worker's failed

  /* ---------- Time in The Hague ---------- */
  const fmtCache = {};
  const fmt = (tz, opts) => {
    const k = tz + JSON.stringify(opts);
    return fmtCache[k] || (fmtCache[k] = new Intl.DateTimeFormat('en-GB', Object.assign({ timeZone: tz }, opts)));
  };
  const hm = (ms, tz = TZ) => fmt(tz, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms);
  const ymd = (ms, tz = TZ) => {
    const p = {};
    for (const x of fmt(tz, { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(ms)) p[x.type] = x.value;
    return `${p.year}-${p.month}-${p.day}`;
  };
  const addDays = (date, n) => new Date(Date.parse(date + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
  const daysFrom = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const weekday = (date) => new Date(date + 'T12:00:00Z').getUTCDay();
  const dotDate = (date) => `${date.slice(8, 10)}.${date.slice(5, 7)}`; // '24.09'
  const shortDate = (date) => `${SHORT[weekday(date)]} ${+date.slice(8, 10)} ${MONTHS[+date.slice(5, 7) - 1].slice(0, 3)}`;
  const timeOf = (iso) => hm(Date.parse(iso));
  const dateOf = (iso) => ymd(Date.parse(iso));

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ok = (b) => b && typeof b === 'object' && !b.error;
  const row = (left, side, cls = '') => `<li class="row${cls ? ' ' + cls : ''}"><span>${left}</span>${side ? `<span class="side">${side}</span>` : ''}</li>`;

  /* ---------- The sun (app/sun.js works it out on the device) ---------- */
  const MIN = 60000;
  const Sun = self.MorningSun;

  /* The UTC offset of The Hague at ms, and the ms of midnight there on a 'YYYY-MM-DD'. */
  const offsetAt = (ms) => {
    const p = {};
    for (const x of fmt(TZ, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(ms)) p[x.type] = x.value;
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000;
  };
  const midnight = (date) => { const g = Date.parse(date + 'T00:00:00Z'); return g - offsetAt(g - offsetAt(g)); };

  /* Where the sun is: up, in twilight (0 to -6 degrees) or down, and the full stop's lift:
   * 0 on the baseline, up to .3em at solar noon. */
  function sunNow(ms) {
    if (!Sun) return null;
    const a = Sun.alt(ms);
    const day = Sun.day(midnight(ymd(ms)));
    const up = a > Sun.HORIZON;
    return { day, up, twi: !up && a > -6, lift: up && day.max > 0 ? (Math.max(0, a) / day.max) * 0.3 : 0 };
  }

  /* ---------- Header: greeting, date, clocks ---------- */
  function greeting(now) {
    const h = +hm(now).slice(0, 2);
    if (h >= 5 && h < 11) return 'Good morning';
    if (h >= 11 && h < 17) return 'Good afternoon';
    if (h >= 17 && h < 22) return 'Good evening';
    return 'Still up';
  }

  let shownDay = '';
  let shownClock = '';
  let holdSun = false; // true while the first light holds the sun on the baseline

  function renderHead(now, roll) {
    const today = ymd(now);
    const date = document.querySelector('.js-date');
    if (shownDay !== today) {
      // Rebuilt only when the day changes, so the sun's own animations run on undisturbed.
      shownDay = today;
      date.setAttribute('aria-label', dotDate(today));
      date.innerHTML = `${today.slice(8, 10)}<span class="sun-stop" aria-hidden="true"></span>${today.slice(5, 7)}`;
    }
    document.querySelector('.js-eyebrow').textContent = greeting(now) + ' · ' + DAYS[weekday(today)];
    for (const el of document.querySelectorAll('[data-clock]')) {
      if (el.dataset.clock === 'here') continue;
      // The far clocks name the day when theirs is not ours: "Sun 19:00" at 01:00 on a Monday here.
      const d = ymd(now, ZONES[el.dataset.clock]);
      el.textContent = (d !== today ? SHORT[weekday(d)] + ' ' : '') + hm(now, ZONES[el.dataset.clock]);
    }
    const here = document.querySelector('[data-clock="here"]');
    const c = hm(now);
    if (c !== shownClock) {
      if (roll && shownClock) rollClock(here, shownClock, c);
      else here.textContent = c;
      shownClock = c;
    }
    if (!holdSun) placeSun(now, !roll);
  }

  /* Only the digits that changed roll; the rest of the time stays still. */
  function rollClock(el, old, neu) {
    if (old.length !== neu.length) { el.textContent = neu; return; }
    el.innerHTML = [...neu].map((ch, i) => (ch === old[i] ? ch
      : `<span class="roll"><span class="r-old" aria-hidden="true">${old[i]}</span><span class="r-new">${ch}</span></span>`)).join('');
    setTimeout(() => { if (shownClock === neu) el.textContent = neu; }, 520);
  }

  /* The full stop sits on the baseline at night and climbs with the sun by day. `instant`
   * skips the 1.2 s glide (a return to the page, or the first paint). */
  function placeSun(now, instant) {
    const el = document.querySelector('.sun-stop');
    const s = sunNow(now.valueOf());
    if (!el || !s) return;
    el.classList.toggle('up', s.up);
    el.classList.toggle('twi', s.twi);
    el.classList.toggle('down', !s.up && !s.twi);
    const date = el.parentElement;
    const sy = (-s.lift).toFixed(4) + 'em';
    if (instant) { date.classList.add('nt'); void date.offsetWidth; }
    el.style.setProperty('--sy', sy);
    date.style.setProperty('--sy', sy);
    // The pool of light behind the date is centred on the stop's resting place.
    date.style.setProperty('--sx', (el.offsetLeft + el.offsetWidth / 2).toFixed(1) + 'px');
    date.style.setProperty('--st', (el.offsetTop + el.offsetHeight / 2).toFixed(1) + 'px');
    if (instant) { void date.offsetWidth; date.classList.remove('nt'); }
  }

  /* Dark between sunset and sunrise in The Hague, light otherwise. Nothing else decides.
   * sun.js already set it before the first paint; this keeps it right as the day turns. */
  let shownTheme = '';
  function applyTheme(now) {
    const theme = Sun && Sun.dark(now.valueOf()) ? 'dark' : 'light';
    if (shownTheme === theme) return;
    shownTheme = theme;
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').setAttribute('content', theme === 'dark' ? '#111214' : '#EEEDE9');
    document.querySelector('meta[name="color-scheme"]').setAttribute('content', theme);
  }

  /* ---------- Since you last looked ----------
   * When the page is hidden (and every 30 minutes on a screen that stays open), the keys of
   * what it showed are kept on this device. Rows whose key was not there get a green tick
   * until the page is next hidden. The first ever open marks nothing, and more than six new
   * rows marks nothing either: that is a new day, not news. Never sent anywhere. */
  const SEEN_KEY = 'morning.seen.' + code;
  const SEEN_EVERY = 30 * MIN;
  let seen = store.get(SEEN_KEY); // { at, keys: [] }
  let fresh = new Set();
  const freshAt = new Map(); // key -> when it was first shown as new

  const todoKey = (text) => 't:' + text;
  const projKey = (x) => 'p:' + x.name + '|' + x.status + '|' + (x.status === 'live' ? '' : x.next || '');

  /* Every row that can be marked, with the date events fall on (for the window check). */
  function keysOf(data, now) {
    const out = [];
    if (ok(data.todos)) for (const i of data.todos.items.slice(1)) out.push({ key: todoKey(i.text) });
    for (const d of calendarDays(data, now)) for (const e of d.list) out.push({ key: e.key, date: d.date });
    if (ok(data.projects) && Array.isArray(data.projects.projects)) {
      for (const x of data.projects.projects) if (x.status !== 'parked') out.push({ key: projKey(x) });
    }
    return out;
  }

  function findFresh(data, now) {
    fresh = new Set();
    if (!data || !seen || !Array.isArray(seen.keys)) return;
    const had = new Set(seen.keys);
    // The calendar covers seven days; an event only counts as new if the last look covered its day too.
    const edge = addDays(ymd(seen.at), 6);
    const found = keysOf(data, now).filter((k) => !had.has(k.key) && !(k.date && k.date > edge)).map((k) => k.key);
    if (found.length > 6) return;
    for (const k of found) { fresh.add(k); if (!freshAt.has(k)) freshAt.set(k, Date.now()); }
  }

  function saveSeen() {
    const data = last && last.data;
    if (!data) return;
    seen = { at: Date.now(), keys: keysOf(data, new Date()).map((k) => k.key) };
    store.set(SEEN_KEY, seen);
    fresh = new Set();
    freshAt.clear();
  }

  const isNew = (key) => (fresh.has(key) ? ' is-new' : '');

  /* ---------- 01 Start with: tapping it opens the to-do app ---------- */
  function renderStart(t) {
    const first = ok(t) && t.items.length ? t.items[0].text : '';
    $('start').hidden = !first;
    $('start').href = '../todo/?c=' + encodeURIComponent(code);
    $('start').setAttribute('aria-label', first ? 'Start with: ' + cap(first) + '. Opens the to-do app.' : '');
    $('start').querySelector('.start-text').textContent = cap(first);
  }

  /* ---------- 02 Today: the rest of Today, then the day's small facts ---------- */

  /* Next bin collection: { when, what }. A collection this morning is old news by midday. */
  function binLine(bins, now) {
    if (!ok(bins) || !Array.isArray(bins.collections)) return null;
    const today = ymd(now);
    const hour = +hm(now).slice(0, 2);
    const next = bins.collections.find((c) => c.date > today || (c.date === today && hour < 12));
    if (!next || !next.types.length) return null;
    const names = next.types.length > 1 ? next.types.slice(0, -1).join(', ') + ' and ' + next.types[next.types.length - 1] : next.types[0];
    const diff = daysFrom(today, next.date);
    if (diff === 0) return { when: 'Today', what: names + ' out', soon: true };
    if (diff === 1) return { when: hour >= 17 ? 'Tonight' : 'Tomorrow', what: names + ' out', soon: true };
    return { when: diff < 7 ? SHORT[weekday(next.date)] : shortDate(next.date), what: names };
  }

  /* To-dos are shown as typed, except for a capital first letter. */
  const cap = (s) => String(s).replace(/^\s*\p{Ll}/u, (c) => c.toUpperCase());

  /* One fact tile: a small label, the value, and an optional line under it. */
  const tile = (label, value, sub = '', title = '') =>
    `<div class="tile"${title ? ` title="${esc(title)}"` : ''}><span class="tile-label">${esc(label)}</span>` +
    `<span class="tile-value">${value}</span>${sub ? `<span class="tile-sub">${sub}</span>` : ''}</div>`;

  const subHead = (label, count) =>
    `<div class="sub-head"><span>${esc(label)}</span>${count !== undefined ? `<span class="sub-count">${esc(count)}</span>` : ''}</div>`;

  /* Rebuild a block only when its HTML changed, so hover and open folds survive the 15 s tick. */
  function setHTML(el, html) {
    if (el.dataset.html === html) return false;
    el.dataset.html = html;
    el.innerHTML = html;
    return true;
  }

  /* The kitchen's tile. The Worker reads the kitchen with its own code; this page never sees it. */
  function dinnerTile(k) {
    if (!ok(k) || (!k.tonight && !k.mixToday)) return '';
    const mix = k.mixToday ? '<span class="accent-text">Mix the dough today</span>' : '';
    if (!k.tonight) {
      const on = k.pizzaOn && /^\d{4}-\d{2}-\d{2}$/.test(k.pizzaOn) ? DAYS[weekday(k.pizzaOn)] : '';
      return tile('Dough', mix, on ? 'For ' + esc(on) : '');
    }
    return tile('Dinner', esc(k.tonight.title), mix);
  }

  function birthdayTiles(b, now, skip = () => false) {
    if (!ok(b) || !Array.isArray(b.birthdays)) return '';
    const today = ymd(now);
    return b.birthdays.map((x) => {
      const days = daysFrom(today, x.date);
      if (days < 0 || days > 14 || skip(x.date)) return '';
      const who = esc(x.name) + (x.age ? ' turns ' + esc(x.age) : '');
      const when = days === 0 ? '<span class="accent-text">Today</span>' : days === 1 ? 'Tomorrow' : 'In ' + days + ' days';
      return tile('Birthday', who, when);
    }).join('');
  }

  function countdownTiles(f, now, skip = () => false) {
    const cds = ok(f) && Array.isArray(f.countdowns) ? f.countdowns : [];
    const today = ymd(now);
    return cds.map((c) => {
      const days = daysFrom(today, c.date);
      if (days < 0 || skip(c.date)) return '';
      return tile('Countdown', esc(cap(c.what)), days === 0 ? '<span class="accent-text">Today</span>' : days + (days === 1 ? ' day' : ' days'));
    }).join('');
  }

  /* Whose turn it is (the cleaning): who, and when. The next turn's name on hover. */
  function rotaTiles(r, now, skip = () => false) {
    if (!ok(r) || !Array.isArray(r.rotas)) return '';
    const today = ymd(now);
    return r.rotas.map((x) => {
      if (skip(x.date)) return '';
      const days = daysFrom(today, x.date);
      const weekend = weekday(x.date) === 6;
      const when = days <= 0 ? `<span class="accent-text">${weekend ? 'This weekend' : 'Now'}</span>`
        : days < 7 ? (weekend ? 'This weekend' : DAYS[weekday(x.date)]) : shortDate(x.date);
      return tile(cap(x.what), esc(cap(x.who)), when, x.then ? 'Then: ' + cap(x.then) : '');
    }).join('');
  }

  /* Yesterday's wins: the count, and one filled circle per win (the same circles as
   * today's open to-dos, filled in); the names on hover. */
  function winsTile(y) {
    if (!y || !(y.count > 0)) return '';
    const names = (y.items || []).map(cap);
    const shown = Math.min(y.count, 8);
    const dots = `<span class="wins" aria-hidden="true">${'<i></i>'.repeat(shown)}${y.count > shown ? `<b>+${esc(y.count - shown)}</b>` : ''}</span>`;
    return tile('Yesterday', `${esc(y.count)} done`, dots, names.join('\n'));
  }

  /* Today's events that have not ended: the one on now or next today gets a green dot. */
  function agendaRows(data, now) {
    const today = ymd(now);
    const day = calendarDays(data, now).find((d) => d.date === today);
    if (!day) return '';
    const t = now.valueOf();
    const nextUp = day.list.find((e) => !e.allDay && e.s > t);
    return day.list.map((e) => {
      const on = !e.allDay && e.s <= t;
      const next = e === nextUp;
      let side = '';
      if (on && e.en > e.s) side = `<span class="accent-text">until ${esc(timeOf(e.end))}</span>`;
      else if (on) side = '<span class="accent-text">Now</span>';
      else if (next && e.s - t <= 60 * MIN) side = `<span class="accent-text">in ${Math.max(1, Math.ceil((e.s - t) / MIN))} min</span>`;
      return `<li class="row evt${isNew(e.key)}"><span class="dotc"><span class="nd${next ? ' next' : on ? ' on' : ''}"></span></span>` +
        `<span class="evt-main"><span class="evt-time">${esc(e.allDay ? 'All day' : e.time)}</span> ${esc(e.title)}` +
        `${e.location ? `<span class="place">, ${esc(e.location)}</span>` : ''}</span>${side ? `<span class="side">${side}</span>` : ''}</li>`;
    }).join('');
  }

  /* 02 Today as an overview: the day's facts as tiles, then what is left to do. */
  function renderToday(data, now) {
    $('todoLink').href = '../todo/?c=' + encodeURIComponent(code);
    const t = data && data.todos;
    // On the PC the week band holds anything dated this week, so Today keeps only what needs
    // doing now: bins going out today or tonight, and facts further off than the band reaches.
    const wide = WIDE.matches;
    const inBand = (date) => wide && daysFrom(ymd(now), date) <= 6;
    let tiles = '';
    if (data) {
      tiles += dinnerTile(data.kitchen);
      const bin = binLine(data.bins, now);
      if (bin && (bin.soon || !wide)) tiles += tile('Bins', bin.soon ? `<span class="accent-text">${esc(bin.when)}</span>` : esc(bin.when), esc(bin.what));
      tiles += birthdayTiles(data.birthdays, now, inBand);
      tiles += countdownTiles(data.fixed, now, inBand);
      tiles += rotaTiles(data.rotas, now, inBand);
      tiles += winsTile(ok(t) ? t.yesterday : null);
    }
    let html = tiles ? `<div class="tiles">${tiles}</div>` : '';
    const agenda = data && !wide ? agendaRows(data, now) : '';
    if (agenda) html += subHead('On today') + `<ul class="rows">${agenda}</ul>`;
    if (!t) html += `<ul class="rows">${row('Loading', '', 'empty')}</ul>`;
    else if (!ok(t)) html += `<ul class="rows">${row("To-dos can't load right now.", '', 'empty')}</ul>`;
    else {
      const rest = t.items.slice(1);
      html += subHead('To do', rest.length);
      html += `<ul class="rows">${rest.length
        ? rest.map((i) => `<li class="row task${isNew(todoKey(i.text))}"><span class="circle"></span><span>${esc(cap(i.text))}</span></li>`).join('')
        : row(t.items.length ? 'Nothing else on the list.' : 'Nothing for today.', '', 'empty')}</ul>`;
    }
    setHTML($('todayList'), html);
  }

  /* ---------- 03 Projects: kept up to date from Claude Code; only Parked has buttons ---------- */
  const STATUS = { active: 'Building', next: 'Next', live: 'Live', parked: 'Parked' };

  function renderProjects(p, now, repos) {
    const box = $('projects');
    if (!p) { box.hidden = true; return; }
    box.hidden = false;
    const list = $('projList');
    if (!ok(p)) {
      list.innerHTML = `<div class="row empty"><span>Projects can't load right now.</span></div>`;
      $('projUpdated').textContent = '';
      return;
    }
    const openParked = list.querySelector('details[open]') !== null;
    const at = Date.parse(p.updated);
    $('projUpdated').textContent = Number.isFinite(at) ? 'Updated ' + (ymd(at) === ymd(now) ? 'today' : shortDate(ymd(at))) : '';
    const projects = Array.isArray(p.projects) ? p.projects : [];
    const of = (s) => projects.filter((x) => x.status === s);
    const next = (x) => (x.next ? `<span class="proj-next">${esc(x.next)}</span>` : '');
    const rows = (list) => `<div class="rows">${list.map((x) => `<div class="proj${isNew(projKey(x))}"><span class="proj-name">${esc(x.name)}</span>${next(x)}</div>`).join('')}</div>`;
    // A project that has just become Your turn pops its pill once, in its first second on screen.
    const pops = (x) => fresh.has(projKey(x)) && Date.now() - (freshAt.get(projKey(x)) || 0) < 1500;

    // Your turn first, then one group per status: Building, Up next, Live (chips), Parked (folded).
    let html = of('waiting').map((x) => `<div class="proj proj-turn${isNew(projKey(x))}">
        <div class="proj-top"><span class="proj-name">${esc(x.name)}</span><span class="pill${pops(x) ? ' pop' : ''}">Your turn</span></div>${next(x)}</div>`).join('');
    if (of('active').length) html += subHead('Building', of('active').length) + rows(of('active'));
    if (of('next').length) html += subHead('Up next', of('next').length) + rows(of('next'));
    const live = of('live');
    if (live.length) {
      html += subHead('Live', live.length) + `<div class="chips">${live.map((x) =>
        `<span class="chip${isNew(projKey(x))}"${x.next ? ` title="${esc(x.next)}"` : ''}><span class="chip-dot"></span>${esc(x.name)}</span>`).join('')}</div>`;
    }
    // Work that only lives on the PC (the daily run scans the repos). Hidden when everything is pushed.
    const unpushed = repos && ok(repos) && Array.isArray(repos.repos) ? repos.repos : [];
    if (unpushed.length) {
      html += subHead('Not pushed', unpushed.length) + `<div class="rows">${unpushed.map((r) =>
        `<div class="proj proj-repo"><span class="proj-name">${esc(r.name)}</span>${r.why ? `<span class="proj-next">${esc(r.why)}</span>` : ''}</div>`).join('')}</div>`;
    }
    if (setHTML(list, html || `<div class="row empty"><span>No projects listed.</span></div>`) && openParked) {
      const d = list.querySelector('details'); if (d) d.open = true;
    }
  }

  /* ---------- Apps: one-tap links from the Worker's LINKS secret (they carry codes) ---------- */
  function renderApps(l) {
    const links = l && ok(l) && Array.isArray(l.links) ? l.links.filter((x) => /^https:\/\//.test(x.url)) : [];
    const nav = $('apps');
    nav.hidden = !links.length;
    setHTML(nav, links.map((x) => `<a class="app-link" href="${esc(x.url)}" rel="noreferrer">${esc(x.name)}</a>`).join(''));
  }

  /* ---------- Parked: its own card under Projects, stares back until something is done ----------
   * Oldest first. Calm for a week, then an amber age, then red from two weeks. Do today puts
   * it on the to-do list's Today; Done and Drop take it off. Every button takes it off Parked
   * (POST /api/morning/:code/parked) with a few seconds of Undo. Hidden when nothing is parked. */
  const AMBER_DAYS = 7;
  const RED_DAYS = 14;
  const hiding = new Set(); // ids taken off on this screen while the Worker answers
  const inflight = new Map(); // id -> that button's request, so Undo waits for it
  const ageLevel = (d) => (d >= RED_DAYS ? 'red' : d >= AMBER_DAYS ? 'amber' : 'calm');
  const ageText = (d) => (d <= 0 ? 'Today' : d === 1 ? '1 day' : d + ' days');

  function parkedOf(p, now) {
    const today = ymd(now);
    const out = [];
    for (const x of Array.isArray(p.projects) ? p.projects : []) if (x.status === 'parked') out.push({ id: x.id, from: x.name, text: x.next || 'Parked', since: x.since });
    for (const x of Array.isArray(p.parked) ? p.parked : []) out.push({ id: x.id, from: x.from || 'Other', text: x.text, since: x.since });
    for (const x of out) x.age = x.since ? Math.max(0, daysFrom(x.since, today)) : null;
    return out.filter((x) => !hiding.has(x.id)).sort((a, b) => (b.age ?? -1) - (a.age ?? -1));
  }

  function renderParked(p, now) {
    const items = p && ok(p) ? parkedOf(p, now) : [];
    $('parked').hidden = !items.length && $('parkToast').hidden;
    const oldest = items.length ? items[0].age : null;
    setHTML($('parkHead'), `<span class="num">Parked <span class="sub-count">${items.length}</span></span>` +
      (oldest !== null ? `<span class="park-oldest lv-${ageLevel(oldest)}">Oldest ${esc(ageText(oldest).toLowerCase())}</span>` : ''));
    setHTML($('parkList'), items.length ? parkedHTML(items) : `<div class="row empty"><span>Nothing parked.</span></div>`);
  }

  function parkedHTML(items) {
    const rows = items.map((x) => {
      const lv = x.age === null ? 'calm' : ageLevel(x.age);
      const btns = x.id ? `<div class="park-btns">
          <button type="button" class="pbtn pbtn-today" data-act="today" data-id="${esc(x.id)}" aria-label="Do today: ${esc(x.text)}">Do today</button>
          <button type="button" class="pbtn pbtn-done" data-act="done" data-id="${esc(x.id)}" aria-label="Done: ${esc(x.text)}">Done</button>
          <button type="button" class="pbtn pbtn-drop" data-act="drop" data-id="${esc(x.id)}" aria-label="Drop: ${esc(x.text)}">Drop</button>
        </div>` : '';
      return `<div class="park lv-${lv}">
        <span class="fold-from park-from">${esc(x.from)}</span>
        ${x.age !== null ? `<span class="park-age">${esc(ageText(x.age))}</span>` : ''}
        <span class="park-what">${esc(x.text)}</span>${btns}</div>`;
    }).join('');
    return `<div class="parks">${rows}</div>`;
  }

  const TOAST_WORDS = { today: 'On today’s to-do list', done: 'Marked done', drop: 'Dropped' };
  let toastT = 0;
  let toastId = '';
  function toast(words, id) {
    const el = $('parkToast');
    clearTimeout(toastT);
    toastId = id || '';
    el.firstChild.textContent = words;
    el.lastChild.hidden = !id;
    el.hidden = false;
    toastT = setTimeout(() => { el.hidden = true; toastId = ''; render(); }, 6000);
  }

  async function parkedPost(id, action) {
    const r = await fetch(API + '/api/morning/' + code + '/parked', {
      method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }),
    });
    if (!r.ok) throw new Error('status ' + r.status);
    const out = await r.json();
    if (last && last.data && out.projects) { last.data.projects = out.projects; store.set(KEY, last); }
  }

  $('parkList').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b || hiding.has(b.dataset.id)) return;
    const { id, act } = b.dataset;
    hiding.add(id);
    render();
    toast(TOAST_WORDS[act], id);
    const req = parkedPost(id, act);
    inflight.set(id, req);
    try {
      await req;
    } catch (err) {
      toast('Couldn’t save that. Try again.');
    }
    inflight.delete(id);
    hiding.delete(id);
    render();
  });

  $('parkToast').lastChild.addEventListener('click', async () => {
    const id = toastId;
    if (!id) return;
    $('parkToast').hidden = true;
    toastId = '';
    try {
      await (inflight.get(id) || Promise.resolve()).catch(() => {});
      await parkedPost(id, 'undo');
    } catch (err) {
      toast('Couldn’t undo that. Try again.');
    }
    render();
  });

  /* ---------- 04 Coming up: Odysseus plus the fixed events, one row per event ---------- */

  /* "Sint Sebastiaen - Groep A" reads "Sint Sebastiaen: Groep A". Only a dash with a space on
   * both sides, so "Jan-Willem" stays. The same rule the Worker applies to NOS titles. */
  const cleanTitle = (s) => cap(String(s).replace(/\s+[-–—]\s+/g, ': ').trim());
  /* The place is dropped when the title already says it. */
  const cleanPlace = (title, place) => (place && !title.toLowerCase().includes(String(place).toLowerCase()) ? place : '');

  function calendarDays(data, now) {
    const today = ymd(now);
    const lastDay = addDays(today, 6);
    const days = new Map();
    for (let i = 0; i < 7; i++) days.set(addDays(today, i), []);
    const add = (date, item) => { if (days.has(date)) days.get(date).push(item); };
    const events = [];
    if (ok(data.calendar)) for (const e of data.calendar.events || []) events.push([e, false]);
    if (ok(data.fixed)) for (const e of data.fixed.events || []) events.push([e, true]);
    for (const [e, fixed] of events) {
      const title = cleanTitle(e.title || 'Untitled');
      const location = cleanPlace(title, e.location);
      if (e.allDay) {
        // End is exclusive: an event on the 29th ends on the 30th. Show it on every day it covers.
        const end = e.end > e.start ? e.end : addDays(e.start, 1);
        for (let d = e.start < today ? today : e.start; d < end && d <= lastDay; d = addDays(d, 1)) {
          add(d, { sort: '', time: 'all day', title, location, allDay: true, key: 'e:' + title + '|' + e.start });
        }
      } else {
        const s = Date.parse(e.start);
        const en = Date.parse(e.end);
        if (!(en > now.valueOf() || (en === s && s >= now.valueOf()))) continue;
        const d = dateOf(e.start) < today ? today : dateOf(e.start);
        // An event without an end is sent with end equal to start: show the start only.
        const until = fixed && en > s ? '–' + timeOf(e.end) : '';
        add(d, { sort: s < now ? '00:00' : timeOf(e.start), time: timeOf(e.start) + until, title, location, s, en, end: e.end, key: 'e:' + title + '|' + e.start });
      }
    }
    return [...days.entries()]
      .filter(([, list]) => list.length)
      .map(([date, list]) => ({ date, label: date === today ? 'Today' : SHORT[weekday(date)], list: list.sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0)) }));
  }

  function renderCalendar(data, now) {
    const box = $('days');
    const note = $('calNote');
    if (!data) { setHTML(box, '<div class="row empty"><span>Loading</span></div>'); note.textContent = ''; return; }
    // Today's events live in 02 Today; this card starts tomorrow.
    const today = ymd(now);
    const tomorrow = addDays(today, 1);
    const days = calendarDays(data, now).filter((d) => d.date !== today);
    setHTML(box, days.length
      ? days.map((d) => d.list.map((e, i) => `<div class="ev${i ? ' same' : ''}${isNew(e.key)}">
          <span class="ev-day">${i ? '' : esc(d.date === tomorrow ? 'Tomorrow' : d.label)}</span>
          <span class="ev-title">${esc(e.title)}${e.location ? `<span class="place">, ${esc(e.location)}</span>` : ''}</span>
          <span class="ev-time">${esc(e.time)}</span></div>`).join('')).join('')
      : '<div class="row empty"><span>Nothing in the next six days.</span></div>');
    const c = data.calendar;
    if (!ok(c)) {
      note.textContent = "Odysseus calendar can't load right now.";
    } else if (!c.sent) {
      note.textContent = 'Waiting for the first calendar from Odysseus.';
    } else if (c.stale) {
      const sent = Date.parse(c.sent);
      const when = (ymd(sent) === ymd(now) ? '' : SHORT[weekday(ymd(sent))] + ' ') + hm(sent);
      note.textContent = `Calendar as of ${when}. Odysseus has not sent an update since.`;
    } else {
      note.textContent = '';
    }
    $('bandNote').textContent = note.textContent; // the PC's week band says the same
  }

  /* ---------- PC only: the week band, seven day columns across the bottom ----------
   * Today first. Each day holds its all-day events, then its dated facts (bins, birthdays,
   * countdowns), then its timed events and Arsenal's match in time order. An empty day shows
   * only its date. Today's column carries the live parts: the next event's ring, "in 42 min". */
  const WIDE = self.matchMedia ? matchMedia('(min-width: 1100px)') : { matches: false };
  const BAND_MAX = 5;
  const CREST = 'https://a.espncdn.com/i/teamlogos/soccer/500/359.png';

  function renderBand(data, now, arsenal) {
    const box = $('bandDays');
    if (!WIDE.matches) return; // hidden below 1100 px; nothing to keep up to date
    if (!data) { setHTML(box, ''); return; }
    const today = ymd(now);
    const t = now.valueOf();
    const hour = +hm(now).slice(0, 2);
    const events = new Map(calendarDays(data, now).map((d) => [d.date, d.list]));
    const nextUp = (events.get(today) || []).find((e) => !e.allDay && e.s > t);
    const item = (cls, time, title, place = '', key = '') =>
      `<li class="bi${cls ? ' ' + cls : ''}${key ? isNew(key) : ''}"><span class="bi-time">${time}</span>` +
      `<span class="bi-title">${title}</span>${place ? `<span class="bi-place">${esc(place)}</span>` : ''}</li>`;

    const cols = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(today, i);
      const list = events.get(date) || [];
      const items = [];
      for (const e of list.filter((x) => x.allDay)) items.push({ sort: '', html: item('', 'All day', esc(e.title), e.location, e.key) });
      // Dated facts. A collection this morning is old news by midday, as in binLine().
      const bins = ok(data.bins) && Array.isArray(data.bins.collections) ? data.bins.collections : [];
      for (const c of bins) {
        if (c.date !== date || !c.types.length || (date === today && hour >= 12)) continue;
        const names = c.types.length > 1 ? c.types.slice(0, -1).join(', ') + ' and ' + c.types[c.types.length - 1] : c.types[0];
        items.push({ sort: ' ', html: item('bi-fact', 'Bins', esc(names) + ' out') });
      }
      const bdays = ok(data.birthdays) && Array.isArray(data.birthdays.birthdays) ? data.birthdays.birthdays : [];
      for (const x of bdays) if (x.date === date) items.push({ sort: ' ', html: item('bi-bday', 'Birthday', esc(x.name) + (x.age ? ' turns ' + esc(x.age) : '')) });
      const cds = ok(data.fixed) && Array.isArray(data.fixed.countdowns) ? data.fixed.countdowns : [];
      for (const c of cds) if (c.date === date) items.push({ sort: ' ', html: item('bi-fact', 'Countdown', esc(cap(c.what))) });
      const rotas = ok(data.rotas) && Array.isArray(data.rotas.rotas) ? data.rotas.rotas : [];
      for (const r of rotas) if (r.date <= date && date <= r.end) items.push({ sort: ' ', html: item('bi-fact', esc(cap(r.what)), esc(cap(r.who))) });
      // Timed events; in today's column the next one gets its dot and ring.
      for (const e of list.filter((x) => !x.allDay)) {
        let time = esc(e.time);
        if (date === today) {
          const on = e.s <= t;
          const next = e === nextUp;
          let side = '';
          if (on && e.en > e.s) side = `until ${timeOf(e.end)}`;
          else if (next && e.s - t <= 60 * MIN) side = `in ${Math.max(1, Math.ceil((e.s - t) / MIN))} min`;
          time = `<span class="nd${next ? ' next' : on ? ' on' : ''}"></span>${time}${side ? ` <span class="accent-text">${esc(side)}</span>` : ''}`;
        }
        items.push({ sort: e.sort, html: item('', time, esc(e.title), e.location, e.key) });
      }
      // Arsenal's next match, on its day, with the crest. Red only while it is on.
      const n = ok(arsenal) && arsenal.next;
      if (n && ymd(Date.parse(n.kickoff)) === date) {
        const k = Date.parse(n.kickoff);
        const live = n.live || (k <= t && t - k < 150 * MIN);
        const time = `<img class="bi-crest" src="${CREST}" alt="" width="16" height="16" onerror="this.remove()">` +
          (live ? '<span class="bi-live">Live now</span>' : esc(hm(k)));
        items.push({ sort: live ? '00:00' : hm(k), html: item('bi-arsenal', time, esc(n.home ? `Arsenal v ${n.opponent}` : `${n.opponent} v Arsenal`), n.competition) });
      }
      items.sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0));
      const shown = items.length > BAND_MAX ? items.slice(0, BAND_MAX - 1) : items;
      const more = items.length - shown.length;
      cols.push(`<div class="bd${i === 0 ? ' today' : ''}"><div class="bd-head"><span class="bd-wd">${i === 0 ? 'Today' : SHORT[weekday(date)]}</span>` +
        `<span class="bd-num">${+date.slice(8, 10)}</span></div><ul class="bd-items">${shown.map((x) => x.html).join('')}` +
        `${more ? `<li class="bi bi-more">+${more} more</li>` : ''}</ul></div>`);
    }
    setHTML(box, cols.join(''));
  }

  /* ---------- Arsenal ---------- */
  function renderArsenal(a, now) {
    const body = $('arsenalBody');
    if (!a) { body.innerHTML = '<span class="fx-error">Loading</span>'; return; }
    if (!ok(a)) { body.innerHTML = `<span class="fx-error">Arsenal can't load right now</span>`; return; }
    const n = a.next;
    const l = a.last;
    let main = '';
    let when = '';
    let live = false;
    if (n) {
      const k = Date.parse(n.kickoff);
      const kd = ymd(k);
      const inWeek = kd <= addDays(ymd(now), 6);
      live = n.live || (k <= now && now - k < 150 * 60000);
      when = live ? 'Live now' : (kd === ymd(now) ? 'Today' : inWeek ? SHORT[weekday(kd)] : shortDate(kd)) + ' ' + hm(k);
      main = `<span class="fx-next">${esc(n.home ? `Arsenal v ${n.opponent}` : `${n.opponent} v Arsenal`)}</span>`;
    } else {
      main = '<span class="fx-next">Arsenal</span>';
    }
    if (l) {
      const result = l.result + (l.pens !== null && l.pens !== undefined ? ' on penalties' : '');
      main += `<span class="fx-sub">Last: ${esc(result)} ${esc(l.us)} to ${esc(l.them)} ${l.home ? 'v' : 'at'} ${esc(l.opponent)}</span>`;
    } else if (!n) {
      main += '<span class="fx-sub">No next match listed yet.</span>';
    }
    setHTML(body, `<div class="fx-main">${main}</div>${when ? `<span class="fx-when${live ? ' live' : ''}">${esc(when)}</span>` : ''}`);
  }

  /* ---------- The day in one sentence, under the date ----------
   * What is on now or next today, or "Nothing more today." and what comes next; plus
   * "Sunrise in 14 min." within 40 minutes of sunrise and "Sunset in 20 min." within 45 of sunset. */
  const shortTitle = (s) => s.split(' at ')[0];
  const inMin = (ms) => Math.max(1, Math.ceil(ms / MIN));

  function daySentence(data, now) {
    const t = now.valueOf();
    const today = ymd(now);
    const parts = [];
    if (data) {
      const days = calendarDays(data, now);
      const todayList = (days.find((d) => d.date === today) || { list: [] }).list;
      const timed = todayList.filter((e) => !e.allDay);
      const cur = timed.find((e) => e.s <= t && e.en > t);
      const nxt = timed.find((e) => e.s > t);
      if (cur) parts.push(`${cur.title} until ${timeOf(cur.end)}.`);
      else if (nxt) parts.push(nxt.s - t <= 60 * MIN ? `${nxt.title} in ${inMin(nxt.s - t)} min.` : `${nxt.title} at ${hm(nxt.s)}.`);
      else if (todayList.length) parts.push(`${shortTitle(todayList[0].title)} today.`);
      else {
        parts.push('Nothing more today.');
        const later = days.find((d) => d.date > today);
        if (later) {
          const e = later.list[0];
          const when = later.date === addDays(today, 1) ? 'tomorrow' : 'on ' + DAYS[weekday(later.date)];
          parts.push(`${shortTitle(e.title)} ${when}${e.allDay ? '' : ' at ' + hm(e.s)}.`);
        }
      }
    }
    const s = sunNow(t);
    if (s) {
      const toRise = s.day.rise - t;
      const toSet = s.day.set - t;
      if (toRise > 0 && toRise <= 40 * MIN) parts.push(`Sunrise in ${inMin(toRise)} min.`);
      else if (toSet > 0 && toSet <= 45 * MIN) parts.push(`Sunset in ${inMin(toSet)} min.`);
    }
    return parts.join(' ');
  }

  function renderSay(data, now) {
    const el = document.querySelector('.js-say');
    const s = daySentence(data, now);
    if (el.textContent !== s) el.textContent = s;
  }

  /* ---------- Footer ---------- */
  function renderAsOf(now) {
    const el = $('asOf');
    if (!last) { el.textContent = failed ? 'No connection yet. Try again when you have signal.' : 'Loading'; return; }
    const at = last.at;
    const when = (ymd(at) === ymd(now) ? '' : SHORT[weekday(ymd(at))] + ' ') + hm(at);
    el.textContent = failed ? `As of ${when}. No connection, showing the last copy.` : `As of ${when}`;
  }

  /* `roll` is set only by the minute tick: then the clock's changed digits roll and the sun
   * glides. Every other render (opening, returning, new data) sets them without motion. */
  let lastRender = 0;
  function render(roll = false) {
    const now = new Date();
    const data = last && last.data;
    roll = roll && now - lastRender < 90000;
    lastRender = now.valueOf();
    applyTheme(now);
    renderHead(now, roll);
    renderSay(data, now);
    findFresh(data, now);
    if (data && !seen) saveSeen(); // the first ever open: remember it, mark nothing
    renderStart(data && data.todos);
    renderToday(data, now);
    renderApps(data && data.links);
    renderProjects(data && data.projects, now, data && data.repos);
    renderParked(data && data.projects, now);
    renderCalendar(data, now);
    const a = data && data.arsenal;
    const arsenal = a && !ok(a) && arsenalDirect ? arsenalDirect : a;
    renderBand(data, now, arsenal);
    renderArsenal(arsenal, now);
    renderAsOf(now);
  }
  // Crossing 1100 px moves this week's facts between Today and the band.
  if (WIDE.addEventListener) WIDE.addEventListener('change', () => render());

  /* ---------- Loading ---------- */
  let loading = false;
  async function load() {
    if (loading) return;
    loading = true;
    try {
      const r = await fetch(API + '/api/morning/' + code, { cache: 'no-store' });
      if (r.status === 404 || r.status === 400) {
        // The code is not known to the Worker: say so, show nothing else.
        $('app').hidden = true;
        $('nocode').hidden = false;
        return;
      }
      if (!r.ok) throw new Error('status ' + r.status);
      const data = await r.json();
      last = { at: Date.now(), data };
      store.set(KEY, last);
      failed = false;
    } catch (e) {
      failed = true;
    } finally {
      loading = false;
    }
    render();
    directArsenal();
  }

  /* ESPN refuses the Worker's requests but answers browsers, so when the Worker's
   * Arsenal block is an error the page asks ESPN itself (app/arsenal.js). */
  function directArsenal() {
    const a = last && last.data && last.data.arsenal;
    if (!a || ok(a) || !self.MorningArsenal) return;
    self.MorningArsenal.load().then((b) => { arsenalDirect = b; render(); }).catch(() => {});
  }

  /* ---------- First light: the day's first open, once per device per day ----------
   * The date settles, the sun waits on the baseline and rises to its place, the sentence
   * and the cards fade in (opacity only). About a second, then everything holds. */
  const ENTERED = 'morning.enteredOn';
  const calm = () => !!(self.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  function firstLight() {
    const today = ymd(new Date());
    if (store.get(ENTERED) === today) return;
    store.set(ENTERED, today);
    if (calm()) return;
    const root = document.documentElement;
    root.classList.add('first');
    holdSun = true;
    const stop = document.querySelector('.sun-stop');
    if (stop) { stop.parentElement.classList.add('nt'); stop.style.setProperty('--sy', '0em'); stop.parentElement.style.setProperty('--sy', '0em'); }
    setTimeout(() => {
      if (stop) stop.parentElement.classList.remove('nt');
      holdSun = false;
      placeSun(new Date(), false);
    }, 320);
    setTimeout(() => root.classList.remove('first'), 1500);
  }

  /* ---------- The minute ----------
   * The tick lands just after each minute turns, so the clock is never late. */
  let tickT = 0;
  let visibleSince = Date.now();
  function tick() {
    clearTimeout(tickT);
    if (!document.hidden) {
      // A screen left open all day refreshes its "last looked" every 30 minutes.
      if (seen && Date.now() - Math.max(seen.at, visibleSince) > SEEN_EVERY) saveSeen();
      render(true);
    }
    tickT = setTimeout(tick, 60000 - (Date.now() % 60000) + 30);
  }

  firstLight();
  render();
  load();
  tick();

  // Data every ten minutes and on return. Hiding the page is "the last look".
  setInterval(() => { if (!document.hidden) load(); }, REFRESH);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { saveSeen(); return; }
    visibleSince = Date.now();
    firstLight();
    render();
    load();
    tick();
  });
  addEventListener('pagehide', saveSeen);
  addEventListener('online', load);

  if ('serviceWorker' in navigator && (!isLocal || params.get('sw') === '1')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    // On the first visit the page is not yet controlled, so the service worker never saw
    // the Google Fonts requests. Hand it the URLs the page actually loaded to keep offline.
    Promise.all([navigator.serviceWorker.ready, document.fonts ? document.fonts.ready : null]).then(([reg]) => {
      const urls = performance.getEntriesByType('resource').map((e) => e.name)
        .filter((u) => /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u));
      const sw = reg.active || navigator.serviceWorker.controller;
      if (sw && urls.length) sw.postMessage({ type: 'cache-fonts', urls });
    }).catch(() => {});
  }
})();
