/* Morning Screen. Read only, vanilla, no build step.
 *
 * One request to the paul-hub Worker (GET /api/morning/:code) brings every block.
 * The last good answer is kept in localStorage, so the page opens without signal and
 * says "As of 07:52". It refreshes when it becomes visible again and every ten minutes
 * while open. All times are shown in The Hague's time, whatever the device says.
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
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const weekday = (date) => new Date(date + 'T12:00:00Z').getUTCDay();
  const dayMonth = (date) => `${+date.slice(8, 10)} ${MONTHS[+date.slice(5, 7) - 1]}`;
  const shortDate = (date) => `${SHORT[weekday(date)]} ${+date.slice(8, 10)} ${MONTHS[+date.slice(5, 7) - 1].slice(0, 3)}`;
  const timeOf = (iso) => hm(Date.parse(iso));
  const dateOf = (iso) => ymd(Date.parse(iso));

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ok = (b) => b && typeof b === 'object' && !b.error;

  /* ---------- Header and clocks ---------- */
  function renderHead(now) {
    const today = ymd(now);
    for (const el of document.querySelectorAll('.js-day')) el.textContent = DAYS[weekday(today)];
    for (const el of document.querySelectorAll('.js-date')) el.textContent = dayMonth(today);
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
      document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#14171B' : '#F1F0EC');
      document.querySelector('meta[name="color-scheme"]').setAttribute('content', theme);
    }
  }

  /* ---------- Bike weather ---------- */
  function renderBike(w, now) {
    const today = ymd(now);
    const rides = $('rides');
    const strip = $('strip');
    if (!ok(w)) {
      $('bikeLabel').textContent = "Today's rides";
      $('verdict').textContent = w ? "Weather can't load right now." : 'Loading';
      rides.innerHTML = '';
      strip.hidden = true;
      return;
    }
    const day = w.day;
    $('bikeLabel').textContent = day === today ? "Today's rides" : day === addDays(today, 1) ? "Tomorrow's rides" : DAYS[weekday(day)] + "'s rides";
    $('verdict').textContent = w.verdict || '';
    rides.innerHTML = (w.rides || []).map((r) => {
      const rain = 'Rain ' + r.rainProb + '%' + (r.rainMm >= 0.1 ? ', ' + r.rainMm.toFixed(1) + ' mm' : '');
      const wind = `${r.compass} ${r.wind} km/h, ${r.relative ? r.relative : 'gusts ' + r.gusts}`;
      // A ride that ended more than a few minutes ago is dimmed.
      const [h, m] = String(r.time).split(':').map(Number);
      const endMin = h * 60 + m + 30;
      const rideEnd = `${day}T${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
      const past = day === today && stamp(now) > rideEnd ? ' past' : '';
      return `<div class="ride${past}">
        <div class="ride-top"><span class="ride-time">${esc(r.time)}</span><span class="ride-label">${esc(r.label)}</span></div>
        <span class="temp">${esc(r.temp)}°</span>
        <span class="ride-rain">${esc(rain)}</span>
        <span class="ride-wind">${esc(wind)}</span>
      </div>`;
    }).join('');

    const slots = (w.rain && w.rain.slots) || [];
    if (!slots.length || !w.rain.line) { strip.hidden = true; return; }
    strip.hidden = false;
    $('rainLine').textContent = w.rain.line;
    const level = (mm) => (mm < 0.1 ? 0 : mm < 0.5 ? 1 : mm < 1.5 ? 2 : 3);
    $('bars').innerHTML = slots.map((s) => `<div class="bar${level(s.mm) ? ' l' + level(s.mm) : ''}" title="${esc(s.time)}: ${esc(s.mm)} mm"></div>`).join('');
    $('barTimes').innerHTML = slots.map((s, i) => `<span>${i % 2 === 0 ? esc(s.time) : ''}</span>`).join('');
  }

  /* ---------- Bin day and countdowns ---------- */
  function binLine(bins, now) {
    if (!ok(bins) || !Array.isArray(bins.collections)) return null;
    const today = ymd(now);
    const hour = +hm(now).slice(0, 2);
    // A collection this morning is old news by midday.
    const next = bins.collections.find((c) => c.date > today || (c.date === today && hour < 12));
    if (!next || !next.types.length) return null;
    const names = next.types.length > 1 ? next.types.slice(0, -1).join(', ') + ' and ' + next.types[next.types.length - 1] : next.types[0];
    const out = names + (next.types.length > 1 ? ' bins out' : ' bin out');
    const diff = Math.round((Date.parse(next.date) - Date.parse(today)) / 86400000);
    if (diff === 0) return { when: 'Today:', what: out };
    if (diff === 1) return { when: hour >= 17 ? 'Tonight:' : 'Tomorrow:', what: out };
    return { when: (diff < 7 ? DAYS[weekday(next.date)] : shortDate(next.date)) + ':', what: names };
  }

  function renderExtras(data, now) {
    const bin = binLine(data && data.bins, now);
    $('bin').hidden = !bin;
    if (bin) {
      $('binWhen').textContent = bin.when;
      $('binWhat').textContent = bin.what;
    }
    const today = ymd(now);
    const cds = ok(data && data.fixed) && Array.isArray(data.fixed.countdowns) ? data.fixed.countdowns : [];
    const html = cds.map((c) => {
      const days = Math.round((Date.parse(c.date) - Date.parse(today)) / 86400000);
      if (days < 0) return '';
      if (days === 0) return `<div class="cd"><span class="cd-num">Today</span><span>${esc(c.what)}</span></div>`;
      return `<div class="cd"><span class="cd-num">${days}</span><span>${days === 1 ? 'day' : 'days'} to ${esc(c.what)}</span></div>`;
    }).join('');
    $('countdowns').innerHTML = html;
    $('extras').hidden = !bin && !html;
  }

  /* ---------- To-dos ---------- */
  function renderTodos(t) {
    $('todoLink').href = '../todo/?c=' + encodeURIComponent(code);
    const list = $('todoList');
    if (!t) { list.innerHTML = '<li class="empty">Loading</li>'; return; }
    if (!ok(t)) { list.innerHTML = `<li class="empty">To-dos can't load right now.</li>`; return; }
    if (!t.items.length) { list.innerHTML = '<li class="empty">Nothing for today.</li>'; return; }
    list.innerHTML = t.items.map((i) => `<li><span class="circle"></span><span>${esc(i.text)}</span></li>`).join('');
  }

  /* ---------- Calendar: Odysseus plus the fixed events, grouped by day ---------- */
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
        const until = fixed && en > s ? ' until ' + timeOf(e.end) : '';
        add(d, { sort: s < now ? '00:00' : timeOf(e.start), time: timeOf(e.start), title: title + until, location: e.location });
      }
    }
    return [...days.entries()]
      .filter(([, list]) => list.length)
      .map(([date, list]) => ({ date, label: date === today ? 'Today' : SHORT[weekday(date)], list: list.sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0)) }));
  }

  function renderCalendar(data, now) {
    const box = $('days');
    const note = $('calNote');
    if (!data) { box.innerHTML = '<div class="days-empty">Loading</div>'; note.textContent = ''; return; }
    const days = calendarDays(data, now);
    box.innerHTML = days.length
      ? days.map((d) => `<div class="day"><span class="day-name">${esc(d.label)}</span><div class="day-events">${d.list.map((e) =>
        `<div class="event"><span class="event-time">${esc(e.time)}</span><span class="event-title">${esc(e.title)}${e.location ? `<span class="place">, ${esc(e.location)}</span>` : ''}</span></div>`).join('')}</div></div>`).join('')
      : '<div class="days-empty">Nothing in the next 7 days.</div>';
    const c = data.calendar;
    if (!ok(c)) {
      note.textContent = "Odysseus calendar can't load right now.";
    } else if (!c.sent) {
      note.textContent = 'Waiting for the first calendar from Odysseus.';
    } else {
      const sent = Date.parse(c.sent);
      const when = (ymd(sent) === ymd(now) ? '' : SHORT[weekday(ymd(sent))] + ' ') + hm(sent);
      note.textContent = c.stale ? `Calendar as of ${when}. Odysseus has not sent an update since.` : `From Odysseus, updated ${when}`;
    }
  }

  /* ---------- Arsenal ---------- */
  function renderArsenal(a, now) {
    const body = $('arsenalBody');
    if (!a) { body.innerHTML = '<span class="fx-error">Loading</span>'; return; }
    if (!ok(a)) { body.innerHTML = `<span class="fx-error">Arsenal can't load right now</span>`; return; }
    let html = '';
    const n = a.next;
    if (n) {
      const k = Date.parse(n.kickoff);
      const kd = ymd(k);
      const inWeek = kd <= addDays(ymd(now), 6);
      const when = n.live || (k <= now && now - k < 150 * 60000) ? 'Live now' : (kd === ymd(now) ? 'Today' : inWeek ? SHORT[weekday(kd)] : shortDate(kd)) + ' ' + hm(k);
      const match = n.home ? `Arsenal v ${n.opponent}` : `${n.opponent} v Arsenal`;
      html += `<div class="fx"><span class="fx-next">Next: ${esc(match)}</span><span class="fx-when">${esc(when)}</span></div>
        <span class="fx-sub">${esc([n.competition, n.home ? 'home' : 'away'].filter(Boolean).join(', '))}</span>`;
    } else {
      html += '<span class="fx-sub">No next match listed yet.</span>';
    }
    const l = a.last;
    if (l) {
      const score = l.home ? `Arsenal ${l.us}, ${l.opponent} ${l.them}` : `${l.opponent} ${l.them}, Arsenal ${l.us}`;
      const result = l.result + (l.pens !== null && l.pens !== undefined ? ' on penalties' : '');
      html += `<div class="fx fx-last"><span class="fx-score">Last: ${esc(score)}</span><span class="fx-result">${esc(result)}</span></div>`;
    }
    body.innerHTML = html;
  }

  /* ---------- Footer ---------- */
  function renderAsOf(now) {
    const el = $('asOf');
    if (!last) { el.textContent = failed ? 'No connection yet. Try again when you have signal.' : 'Loading'; return; }
    const at = last.at;
    const when = (ymd(at) === ymd(now) ? '' : SHORT[weekday(ymd(at))] + ' ') + hm(at);
    el.textContent = failed ? `As of ${when}. No connection, showing the last copy.` : `As of ${when}. Opens without signal.`;
  }

  function render() {
    const now = new Date();
    const data = last && last.data;
    renderHead(now);
    applyTheme(now, data);
    renderBike(data && data.weather, now);
    renderExtras(data, now);
    renderTodos(data && data.todos);
    renderCalendar(data, now);
    renderArsenal(data && data.arsenal, now);
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
