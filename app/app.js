/* Morning Screen. Read only, vanilla, no build step.
 *
 * One request to the paul-hub Worker (GET /api/morning/:code) brings every block.
 * The last good answer is kept in localStorage, so the page opens without signal and
 * says "As of 07:52". It refreshes when it becomes visible again and every ten minutes
 * while open. All times are shown in The Hague's time, whatever the device says.
 *
 * Layout: numbered cards. 01 Start with, 02 Today (tasks, dinner, bins, birthdays,
 * countdowns, yesterday), 03 Projects, 04 Week, then Arsenal.
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
  const ymd = (ms) => {
    const p = {};
    for (const x of fmt(TZ, { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(ms)) p[x.type] = x.value;
    return `${p.year}-${p.month}-${p.day}`;
  };
  const stamp = (ms) => ymd(ms) + 'T' + hm(ms); // 'YYYY-MM-DDTHH:MM', comparable with Open-Meteo's times
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

  /* ---------- Header and clocks ---------- */
  function renderHead(now) {
    const today = ymd(now);
    for (const el of document.querySelectorAll('.js-day')) el.textContent = DAYS[weekday(today)];
    for (const el of document.querySelectorAll('.js-date')) el.textContent = dotDate(today);
    for (const el of document.querySelectorAll('[data-clock]')) el.textContent = hm(now, ZONES[el.dataset.clock]);
  }

  /* Dark between sunset and sunrise in The Hague, light otherwise. Nothing else decides. */
  function applyTheme(now, data) {
    let dark = false;
    const w = data && data.weather;
    if (ok(w) && Array.isArray(w.sun)) {
      const s = w.sun.find((x) => x.date === ymd(now));
      if (s && s.sunrise && s.sunset) {
        const t = stamp(now);
        dark = t < s.sunrise || t >= s.sunset;
      }
    }
    const theme = dark ? 'dark' : 'light';
    if (document.documentElement.dataset.theme !== theme) {
      document.documentElement.dataset.theme = theme;
      document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#111214' : '#EEEDE9');
      document.querySelector('meta[name="color-scheme"]').setAttribute('content', theme);
    }
  }

  /* ---------- 01 Start with ---------- */
  function renderStart(t) {
    const first = ok(t) && t.items.length ? t.items[0].text : '';
    $('start').hidden = !first;
    $('start').querySelector('.start-text').textContent = first;
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

  /* The kitchen's line. The Worker reads the kitchen with its own code; this page never sees it. */
  function dinnerRow(k) {
    if (!ok(k) || (!k.tonight && !k.mixToday)) return '';
    const mix = k.mixToday ? '<span class="accent-text">Mix the dough today</span>' : '';
    if (!k.tonight) {
      const on = k.pizzaOn && /^\d{4}-\d{2}-\d{2}$/.test(k.pizzaOn) ? DAYS[weekday(k.pizzaOn)] : '';
      return row('Dough', mix + (on ? ` for ${esc(on)}` : ''));
    }
    return row('Dinner', esc(k.tonight.title) + (mix ? '<br>' + mix : ''));
  }

  function birthdayRows(b, now) {
    if (!ok(b) || !Array.isArray(b.birthdays)) return '';
    const today = ymd(now);
    return b.birthdays.map((x) => {
      const days = daysFrom(today, x.date);
      if (days < 0 || days > 14) return '';
      const age = x.age ? (days === 0 ? ', turning ' : ', turns ') + x.age : '';
      const when = days === 0 ? '<span class="accent-text">Today</span>' : days === 1 ? 'Tomorrow' : 'In ' + days + ' days';
      return row(esc(x.name) + (/s$/i.test(x.name) ? "'" : "'s") + ' birthday' + esc(age), when);
    }).join('');
  }

  function countdownRows(f, now) {
    const cds = ok(f) && Array.isArray(f.countdowns) ? f.countdowns : [];
    const today = ymd(now);
    return cds.map((c) => {
      const days = daysFrom(today, c.date);
      if (days < 0) return '';
      return row(esc(c.what), days === 0 ? '<span class="accent-text">Today</span>' : days + (days === 1 ? ' day' : ' days'));
    }).join('');
  }

  /* Yesterday's wins, folded: "Yesterday · 4 done", open for the names. */
  function winsRow(y) {
    if (!y || !(y.count > 0)) return '';
    return `<li><details class="fold"><summary><span>Yesterday</span><span class="tag">${esc(y.count)} done</span></summary>
      <ul class="fold-list">${(y.items || []).map((x) => `<li class="fold-muted">${esc(x)}</li>`).join('')}</ul></details></li>`;
  }

  function renderToday(data, now) {
    $('todoLink').href = '../todo/?c=' + encodeURIComponent(code);
    const t = data && data.todos;
    const list = $('todayList');
    const openWins = list.querySelector('details[open]') !== null;
    let html = '';
    if (!t) html += row('Loading', '', 'empty');
    else if (!ok(t)) html += row("To-dos can't load right now.", '', 'empty');
    else if (!t.items.length) html += row('Nothing for today.', '', 'empty');
    else html += t.items.slice(1).map((i) => `<li class="row task"><span class="circle"></span><span>${esc(i.text)}</span></li>`).join('');
    if (data) {
      html += dinnerRow(data.kitchen);
      const bin = binLine(data.bins, now);
      if (bin) html += row('Bins', (bin.soon ? `<span class="accent-text">${esc(bin.when)}</span>` : esc(bin.when)) + ' · ' + esc(bin.what));
      html += birthdayRows(data.birthdays, now);
      html += countdownRows(data.fixed, now);
      html += winsRow(ok(t) ? t.yesterday : null);
    }
    list.innerHTML = html || row('Nothing else for today.', '', 'empty');
    if (openWins) { const d = list.querySelector('details'); if (d) d.open = true; }
  }

  /* ---------- 03 Projects: read only, kept up to date from Claude Code ---------- */
  const STATUS = { active: 'Building', next: 'Next', live: 'Live', parked: 'Parked' };

  function renderProjects(p, now) {
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
    let html = of('waiting').map((x) => `<div class="proj proj-turn">
        <div class="proj-top"><span class="proj-name">${esc(x.name)}</span><span class="pill">Your turn</span></div>${next(x)}</div>`).join('');
    html += [...of('active'), ...of('next')].map((x) => `<div class="proj">
        <div class="proj-top"><span class="proj-name">${esc(x.name)}</span><span class="tag">${STATUS[x.status]}</span></div>${next(x)}</div>`).join('');
    const live = of('live');
    if (live.length) html += `<div class="proj proj-live"><span>${esc(live.map((x) => x.name).join(', '))}</span><span class="tag">Live</span></div>`;
    const parkedProjects = of('parked');
    const parked = Array.isArray(p.parked) ? p.parked : [];
    if (parkedProjects.length || parked.length) {
      const label = [parkedProjects.map((x) => x.name).join(', '), parked.length ? parked.length + ' parked' : '']
        .filter(Boolean).join(parkedProjects.length && parked.length ? ' + ' : '');
      const items = parkedProjects.map((x) => `<li><span class="fold-from">${esc(x.name)}</span><span>${esc(x.next || 'Parked')}</span></li>`)
        .concat(parked.map((x) => `<li>${x.from ? `<span class="fold-from">${esc(x.from)}</span>` : ''}<span>${esc(x.text)}</span></li>`));
      html += `<details class="fold"><summary><span>${esc(label)}</span><span class="tag">Parked</span></summary><ul class="fold-list">${items.join('')}</ul></details>`;
    }
    list.innerHTML = html || `<div class="row empty"><span>No projects listed.</span></div>`;
    if (openParked) { const d = list.querySelector('details'); if (d) d.open = true; }
  }

  /* ---------- 04 Week: Odysseus plus the fixed events, one row per event ---------- */
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
      const title = e.title || 'Untitled';
      if (e.allDay) {
        // End is exclusive: an event on the 29th ends on the 30th. Show it on every day it covers.
        const end = e.end > e.start ? e.end : addDays(e.start, 1);
        for (let d = e.start < today ? today : e.start; d < end && d <= lastDay; d = addDays(d, 1)) {
          add(d, { sort: '', time: 'all day', title, location: e.location });
        }
      } else {
        const s = Date.parse(e.start);
        const en = Date.parse(e.end);
        if (!(en > now.valueOf() || (en === s && s >= now.valueOf()))) continue;
        const d = dateOf(e.start) < today ? today : dateOf(e.start);
        // An event without an end is sent with end equal to start: show the start only.
        const until = fixed && en > s ? '–' + timeOf(e.end) : '';
        add(d, { sort: s < now ? '00:00' : timeOf(e.start), time: timeOf(e.start) + until, title, location: e.location });
      }
    }
    return [...days.entries()]
      .filter(([, list]) => list.length)
      .map(([date, list]) => ({ date, label: date === today ? 'Today' : SHORT[weekday(date)], list: list.sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0)) }));
  }

  function renderCalendar(data, now) {
    const box = $('days');
    const note = $('calNote');
    if (!data) { box.innerHTML = '<div class="row empty"><span>Loading</span></div>'; note.textContent = ''; return; }
    const days = calendarDays(data, now);
    box.innerHTML = days.length
      ? days.map((d) => d.list.map((e, i) => `<div class="ev${i ? ' same' : ''}">
          <span class="ev-day">${i ? '' : esc(d.label)}</span>
          <span class="ev-title">${esc(e.title)}${e.location ? `<span class="place">, ${esc(e.location)}</span>` : ''}</span>
          <span class="ev-time">${esc(e.time)}</span></div>`).join('')).join('')
      : '<div class="row empty"><span>Nothing in the next 7 days.</span></div>';
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
      main += `<span class="fx-sub">Last: ${esc(result)} ${esc(l.us)}–${esc(l.them)} ${l.home ? 'v' : 'at'} ${esc(l.opponent)}</span>`;
    } else if (!n) {
      main += '<span class="fx-sub">No next match listed yet.</span>';
    }
    body.innerHTML = `<div class="fx-main">${main}</div>${when ? `<span class="fx-when${live ? ' live' : ''}">${esc(when)}</span>` : ''}`;
  }

  /* ---------- Footer ---------- */
  function renderAsOf(now) {
    const el = $('asOf');
    if (!last) { el.textContent = failed ? 'No connection yet. Try again when you have signal.' : 'Loading'; return; }
    const at = last.at;
    const when = (ymd(at) === ymd(now) ? '' : SHORT[weekday(ymd(at))] + ' ') + hm(at);
    el.textContent = failed ? `As of ${when}. No connection, showing the last copy.` : `As of ${when}`;
  }

  function render() {
    const now = new Date();
    const data = last && last.data;
    renderHead(now);
    applyTheme(now, data);
    renderStart(data && data.todos);
    renderToday(data, now);
    renderProjects(data && data.projects, now);
    renderCalendar(data, now);
    const a = data && data.arsenal;
    renderArsenal(a && !ok(a) && arsenalDirect ? arsenalDirect : a, now);
    renderAsOf(now);
  }

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

  render();
  load();

  // Clocks and the theme follow the minute; data every ten minutes and on return.
  setInterval(() => { if (!document.hidden) render(); }, 15000);
  setInterval(() => { if (!document.hidden) load(); }, REFRESH);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); load(); } });
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
