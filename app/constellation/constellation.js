/* Constellation (morning/constellation/): the apps on the hub as stars on a night sky, a line between two
 * apps that told each other something in the last 7 days, and a small bright dot for each event as it
 * travels from the app that sent it to the apps that react (GET /api/sky/:code, paul-hub src/sky.js).
 *
 * Live: read on opening, every `poll` seconds while the page is visible and at once on return; events
 * that are new since the last check travel (at most 5, 300 ms apart), nothing travels on the first read.
 * Last day and Last week replay the log in `replay.day` / `replay.week` seconds, time mapped linearly.
 * With Reduce Motion nothing travels or flashes: the counts sit on the lines, Live names the newest
 * event under the header, and a replay steps through the events one at a time.
 * Read only. The answer holds star names, labels, counts and times, and the page shows nothing else;
 * nothing is kept on this device and nothing goes to the console. */
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

  drawField();

  // The same link and code as Morning and the to-do app.
  let code = (params.get('c') || '').trim().toLowerCase();
  if (CODE_RE.test(code)) store.set('morning.code', code);
  else code = store.get('morning.code') || store.get('todo.code') || '';
  if (!CODE_RE.test(code)) { $('app').hidden = true; $('nocode').hidden = false; return; }
  $('back').href = '../?c=' + encodeURIComponent(code);

  /* ---------- The sky's fixed shape ---------- */
  // The ten stars in the API's order. Each has its own place, so Paul learns where an app lives.
  const IDS = ['todo', 'morning', 'day', 'kitchen', 'mail', 'defence-digest', 'lift', 'pc', 'arsenal-watch', 'hub'];
  const KNOWN = new Set(IDS);
  const NAMES = { todo: 'To-do', morning: 'Morning', day: 'Day', kitchen: 'Kitchen', mail: 'Email in', 'defence-digest': 'Defence digest', lift: 'Lift', pc: 'PC', 'arsenal-watch': 'Arsenal watch', hub: 'Hub' };
  // Clockwise from the top, on an ellipse around the Hub.
  const ANGLE = { morning: 0, day: 40, kitchen: 80, mail: 120, 'defence-digest': 160, lift: 200, pc: 240, 'arsenal-watch': 280, todo: 320 };
  const PC = { w: 960, h: 740, cx: 480, cy: 380, rx: 330, ry: 270, k: 1, font: 15, phone: false };
  const PH = { w: 390, h: 400, cx: 195, cy: 200, rx: 130, ry: 152, k: 0.75, font: 13, phone: true };
  const MIN_PX = 13; // no label smaller than this on the screen
  const WIDE = matchMedia('(min-width: 1100px)');
  const CALM = matchMedia('(prefers-reduced-motion: reduce)');
  const TZ = 'Europe/Amsterdam';
  const HOUR = 36e5, DAY = 24 * HOUR;
  const TRAVEL_MS = 1600, FLASH_MS = 1200, LIVE_MAX = 5, LIVE_GAP = 300, TARGET_GAP = 150, FX_MAX = 40;

  const rad = (d) => (d * Math.PI) / 180;
  const r1 = (n) => Math.round(n * 10) / 10;
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Times, always The Hague's ---------- */
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const FMT = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  function parts(ms) {
    const o = {};
    for (const p of FMT.formatToParts(new Date(ms))) o[p.type] = p.value;
    return { y: +o.year, mo: +o.month, d: +o.day, wd: o.weekday, h: o.hour === '24' ? '00' : o.hour, mi: o.minute };
  }
  const hm = (ms) => { const p = parts(ms); return `${p.h}:${p.mi}`; };
  const clockText = (ms) => { const p = parts(ms); return `${p.wd} ${p.d} ${MONTHS[p.mo - 1]} · ${p.h}:${p.mi}`; };
  // "14:58" today, "Wed 18:15" this week, "15 Oct 14:58" a week ago on today's weekday.
  function when(ms) {
    const p = parts(ms), n = parts(data.now);
    if (p.y === n.y && p.mo === n.mo && p.d === n.d) return `${p.h}:${p.mi}`;
    if (p.wd === n.wd) return `${p.d} ${MONTHS[p.mo - 1]} ${p.h}:${p.mi}`;
    return `${p.wd} ${p.h}:${p.mi}`;
  }

  /* ---------- Words ---------- */
  const name = (id) => (data && data.star.get(id) ? data.star.get(id).name : NAMES[id] || '');
  const andList = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
  const events = (n) => `${n} event${n === 1 ? '' : 's'} this week`;
  const span = (h) => (h < 48 ? `${h} h` : `${Math.floor(h / 24)} d`);
  const quietShort = (s) => (s.quietHours === null ? 'Quiet' : `Quiet ${span(s.quietHours)}`);
  function quietLong(s) {
    if (s.quietHours === null) return 'quiet';
    if (s.quietHours < 48) return `quiet ${s.quietHours} hour${s.quietHours === 1 ? '' : 's'}`;
    return `quiet ${Math.floor(s.quietHours / 24)} days`;
  }
  const starLabel = (s) => `${s.name}, ${s.quiet ? quietLong(s) : s.events ? events(s.events) : 'nothing this week'}`;
  const who = (p) => (p.to.length ? `${name(p.from)} to ${andList(p.to.map(name))}` : name(p.from));
  const lineKey = (a, b) => (IDS.indexOf(a) <= IDS.indexOf(b) ? `${a}|${b}` : `${b}|${a}`);
  const lineName = (l) => `${name(l.a)} and ${name(l.b)}`;

  /* ---------- The answer, checked: anything unexpected is left out ---------- */
  const str = (s, n = 48) => (typeof s === 'string' ? s.trim().slice(0, n) : '');
  const whole = (n) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
  const time = (s) => { const t = typeof s === 'string' ? Date.parse(s) : NaN; return Number.isFinite(t) ? t : null; };
  const stars = (a) => (Array.isArray(a) ? [...new Set(a.filter((x) => KNOWN.has(x)))] : []);
  const tally = (a, dir) => (Array.isArray(a) ? a : [])
    .map((r) => (r && typeof r === 'object' ? { label: str(r.label), n: whole(r.n), who: dir ? stars(r[dir]) : [] } : null))
    .filter((r) => r && r.label && r.n);
  function clean(d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.stars)) throw new Error('shape');
    const now = time(d.now) ?? Date.now();
    const from = Math.min(now, time(d.from) ?? now - 7 * DAY);
    const rp = d.replay && typeof d.replay === 'object' ? d.replay : {};
    const byId = new Map(d.stars.filter((s) => s && KNOWN.has(s.id)).map((s) => [s.id, s]));
    const list = IDS.map((id) => {
      const s = byId.get(id) || {};
      const quiet = s.quiet === true;
      return {
        id, name: str(s.name, 40) || NAMES[id], events: whole(s.events),
        sent: tally(s.sent, 'to'), received: tally(s.received, 'from'),
        limitHours: whole(s.limitHours), quiet,
        quietHours: quiet && Number.isFinite(s.quietHours) && s.quietHours >= 0 ? Math.floor(s.quietHours) : null,
        how: quiet ? str(s.how, 160) || null : null,
      };
    });
    const lines = new Map();
    for (const l of Array.isArray(d.lines) ? d.lines : []) {
      if (!l || !KNOWN.has(l.a) || !KNOWN.has(l.b) || l.a === l.b || !whole(l.n)) continue;
      const [a, b] = lineKey(l.a, l.b) === `${l.a}|${l.b}` ? [l.a, l.b] : [l.b, l.a];
      const flip = a !== l.a;
      lines.set(`${a}|${b}`, { key: `${a}|${b}`, a, b, n: whole(l.n), ab: tally(flip ? l.ba : l.ab), ba: tally(flip ? l.ab : l.ba) });
    }
    const pulses = (Array.isArray(d.pulses) ? d.pulses : [])
      .map((p) => (p && typeof p === 'object' && KNOWN.has(p.from)
        ? { id: str(p.id, 64), at: time(p.at), from: p.from, label: str(p.label), to: stars(p.to).filter((t) => t !== p.from) } : null))
      .filter((p) => p && p.id && p.at !== null && p.label)
      .sort((a, b) => a.at - b.at);
    return {
      now, from,
      poll: clamp(Number(d.poll) || 30, 1, 3600),
      replay: { day: clamp(Number(rp.day) || 60, 1, 3600), week: clamp(Number(rp.week) || 60, 1, 3600) },
      stars: list, star: new Map(list.map((s) => [s.id, s])), lines: [...lines.values()], line: lines, pulses,
    };
  }

  /* ---------- State ---------- */
  let data = null;        // the last good answer, checked
  let failed = false;     // the last read failed
  let mode = 'live';      // 'live' | 'day' | 'week'
  let open = null;        // { kind: 'star' | 'line', id } in the panel
  let seen = null;        // pulse ids already on the page; null until the first answer
  let G = PC, S = 1;      // the geometry in use and its scale on the screen

  /* ---------- Geometry ---------- */
  function pos(id) {
    if (id === 'hub') return { x: G.cx, y: G.cy, a: null };
    const a = ANGLE[id];
    return { x: r1(G.cx + G.rx * Math.sin(rad(a))), y: r1(G.cy - G.ry * Math.cos(rad(a))), a };
  }
  const font = (base) => r1(Math.max(base, MIN_PX / S));
  // Where a star's name goes: outward on the PC, under (over, near the top) on the phone.
  function labelAt(id, r, f) {
    const p = pos(id);
    if (p.a === null) return { x: p.x, y: r1(p.y + r + f + 8), anchor: 'middle', up: false };
    const dx = Math.sin(rad(p.a)), dy = -Math.cos(rad(p.a));
    if (G.phone || Math.abs(dx) < 0.5) {
      const up = dy < -0.5;
      return { x: p.x, y: r1(up ? p.y - r - Math.max(12, f * 0.8) : p.y + r + f + 6), anchor: 'middle', up };
    }
    return { x: r1(p.x + (r + 12) * Math.sign(dx)), y: r1(p.y + f / 3), anchor: dx > 0 ? 'start' : 'end', up: false };
  }

  function layout() {
    const area = $('skyarea'), sky = $('sky');
    const wide = WIDE.matches;
    area.style.height = '';
    const W = area.clientWidth;
    if (!wide && innerWidth < 640) { G = PH; S = clamp(W / PH.w, 0.5, 1.3); }
    else if (wide) { G = PC; S = clamp(Math.min(W / PC.w, area.clientHeight / PC.h), 0.5, 1.3); }
    else { G = PC; S = clamp(W / PC.w, 0.5, 1.3); }
    const w = Math.round(G.w * S), h = Math.round(G.h * S);
    if (!wide) area.style.height = h + 'px';
    sky.style.width = w + 'px';
    sky.style.height = h + 'px';
    sky.style.left = Math.max(0, Math.round((W - w) / 2)) + 'px';
  }
  const px = (id) => { const p = pos(id); return { x: p.x * S, y: p.y * S }; };

  /* ---------- Drawing ---------- */
  function radiusOf(s, max) {
    if (s.quiet) return 3 * G.k;
    return r1((3 + (max ? 6 * Math.sqrt(s.events / max) : 0)) * G.k);
  }

  // A count sits on its line where it hits no other count, no star and no name (Reduce Motion only).
  function placeTags(lines, f, room) {
    const boxes = [];
    const clear = (o, x, y, w, h) => Math.abs(o.x - x) >= (o.w + w) / 2 + 3 || Math.abs(o.y - y) >= (o.h + h) / 2 + 3;
    const centres = IDS.map(pos);
    return lines.map((l) => {
      const p = pos(l.a), q = pos(l.b);
      const w = String(l.n).length * f * 0.56 + 12, h = f + 6;
      let best = null;
      for (const t of [0.5, 0.42, 0.58, 0.34, 0.66, 0.27, 0.73]) {
        const x = r1(p.x + (q.x - p.x) * t), y = r1(p.y + (q.y - p.y) * t);
        const hitTag = boxes.some((o) => !clear(o, x, y, w, h)) || room.some((o) => !clear(o, x, y, w, h));
        const hitStar = centres.some((o) => Math.hypot(o.x - x, o.y - y) < 14 * G.k + w / 2);
        if (!hitTag && !hitStar) { best = { x, y }; break; }
        if (!best) best = { x, y };
      }
      const box = { ...best, w, h };
      boxes.push(box);
      return box;
    });
  }

  function highlighted() {
    const on = new Set();
    if (open && open.kind === 'line') on.add(open.id);
    const p = mode !== 'live' && CALM.matches ? rp.list[rp.step] : null;
    if (p) for (const t of p.to) on.add(lineKey(p.from, t));
    return on;
  }

  function render() {
    layout();
    const chart = $('chart'), starsEl = $('stars');
    const focused = document.activeElement;
    const keep = focused && focused.dataset ? (focused.dataset.star ? `.star-btn[data-star="${focused.dataset.star}"]` : focused.dataset.line ? `.hit[data-line="${focused.dataset.line}"]` : '') : '';
    chart.setAttribute('viewBox', `0 0 ${G.w} ${G.h}`);
    if (!data) { chart.innerHTML = ''; starsEl.innerHTML = ''; return; }
    const on = highlighted();
    const calm = CALM.matches;
    const f = font(G.font), fSmall = font(G.font - 2), fHub = font(G.font - 1), fTag = r1(Math.max(12, MIN_PX / S));
    const max = Math.max(0, ...data.stars.filter((s) => s.id !== 'hub').map((s) => s.events));
    let s = '';
    // The lines, the highlighted ones on top.
    const lines = [...data.lines].sort((x, y) => on.has(x.key) - on.has(y.key));
    for (const l of lines) {
      const p = pos(l.a), q = pos(l.b), hi = on.has(l.key);
      s += `<line class="ln${hi ? ' on' : ''}" data-key="${l.key}" x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" stroke="${hi ? '#F4EFE1' : '#9AA3B5'}" stroke-opacity="${hi ? 0.85 : 0.3}" stroke-width="${hi ? 2.4 : r1(Math.min(2.6, 0.9 + l.n / 9) * G.k)}" stroke-linecap="round"></line>`;
    }
    // Wide invisible strokes to tap or tab to, in the answer's order.
    for (const l of data.lines) {
      const p = pos(l.a), q = pos(l.b);
      s += `<line class="hit" data-line="${l.key}" tabindex="0" role="button" aria-label="${esc(lineName(l) + ', ' + events(l.n))}" aria-controls="panel" aria-expanded="${!!open && open.kind === 'line' && open.id === l.key}" x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" stroke="#000" stroke-opacity="0" stroke-width="${r1(18 / S)}" stroke-linecap="round"></line>`;
    }
    // The names first: where they sit, and roughly how much room each takes (for the counts to keep clear).
    const hub = data.star.get('hub'), h = pos('hub'), hr = 9 * G.k;
    const names = [];
    const hl = labelAt('hub', hr, fHub);
    names.push({ id: 'hub', x: hl.x, y: hl.y, anchor: 'middle', size: fHub, text: hub.name, fill: hub.quiet ? '#7D8597' : '#9AA3B5', weight: 400 });
    if (hub.quiet) names.push({ id: 'hub', q: true, x: hl.x, y: r1(hl.y + fHub + 3), anchor: 'middle', size: fSmall, text: quietShort(hub) });
    for (const st of data.stars) {
      if (st.id === 'hub') continue;
      const l = labelAt(st.id, st.quiet ? 4 : radiusOf(st, max), f);
      // A quiet star's second line goes under its name; over the star, the name moves up to make room.
      const y = st.quiet && l.up ? r1(l.y - fSmall - 3) : l.y;
      names.push({ id: st.id, x: l.x, y, anchor: l.anchor, size: f, text: st.name, fill: st.quiet ? '#7D8597' : '#D5DAE3', weight: 500 });
      if (st.quiet) names.push({ id: st.id, q: true, x: l.x, y: r1(y + fSmall + 3), anchor: l.anchor, size: fSmall, text: quietShort(st) });
    }
    const room = names.map((n) => {
      const w = n.text.length * n.size * 0.52;
      const x = n.anchor === 'start' ? n.x : n.anchor === 'end' ? n.x - w : n.x - w / 2;
      return { x: x + w / 2, y: n.y - n.size * 0.32, w, h: n.size };
    });
    let deco = '';
    if (calm) {
      const boxes = placeTags(lines, fTag, room);
      lines.forEach((l, i) => {
        const b = boxes[i], hi = on.has(l.key);
        deco += `<g class="tag${hi ? ' on' : ''}" data-key="${l.key}"><rect x="${r1(b.x - b.w / 2)}" y="${r1(b.y - b.h / 2)}" width="${r1(b.w)}" height="${r1(b.h)}" rx="${r1(b.h / 2)}" fill="${hi ? '#F4EFE1' : '#0A0E17'}"></rect>` +
          `<text x="${b.x}" y="${r1(b.y + fTag * 0.36)}" fill="${hi ? '#0A0E17' : '#AEB6C6'}" font-size="${fTag}" font-family="Barlow Condensed, Barlow, sans-serif" font-weight="600" text-anchor="middle">${l.n}</text></g>`;
      });
    }
    // The hub, in the middle.
    deco += `<circle class="hub-ring" cx="${h.x}" cy="${h.y}" r="${hr}" fill="#0A0E17" stroke="${hub.quiet ? '#4A5263' : '#F4EFE1'}" stroke-opacity="${hub.quiet ? 1 : 0.55}" stroke-width="1.2"></circle>` +
      `<circle cx="${h.x}" cy="${h.y}" r="${r1(2.6 * G.k)}" fill="${hub.quiet ? '#4A5263' : '#F4EFE1'}"></circle>`;
    let buttons = '';
    for (const st of data.stars) {
      const p = pos(st.id);
      const ring = Math.round(2 * ((st.id === 'hub' ? 9 * G.k : radiusOf(st, max)) * S + 6));
      buttons += `<button type="button" class="star-btn" data-star="${st.id}" style="left:${r1(p.x * S)}px;top:${r1(p.y * S)}px;--ring:${ring}px" aria-label="${esc(starLabel(st))}" aria-controls="panel" aria-expanded="${!!open && open.kind === 'star' && open.id === st.id}"></button>`;
      if (st.id === 'hub') continue;
      const r = radiusOf(st, max);
      if (st.quiet) deco += `<circle class="star dim" data-star="${st.id}" cx="${p.x}" cy="${p.y}" r="${r1(r)}" fill="#4A5263"></circle>`;
      else {
        deco += `<circle cx="${p.x}" cy="${p.y}" r="${r1(r * 3.2)}" fill="#F4EFE1" fill-opacity="0.07"></circle><circle cx="${p.x}" cy="${p.y}" r="${r1(r * 1.8)}" fill="#F4EFE1" fill-opacity="0.12"></circle>` +
          `<circle class="star" data-star="${st.id}" cx="${p.x}" cy="${p.y}" r="${r1(r)}" fill="#F7F2E4"></circle>`;
      }
    }
    const labels = names.map((n) => n.q
      ? `<text class="lab-q" data-star="${n.id}" x="${n.x}" y="${n.y}" fill="#E5B45A" font-size="${n.size}" text-anchor="${n.anchor}">${esc(n.text)}</text>`
      : `<text class="lab" data-star="${n.id}" x="${n.x}" y="${n.y}" fill="${n.fill}" font-size="${n.size}" font-weight="${n.weight}" text-anchor="${n.anchor}">${esc(n.text)}</text>`).join('');
    chart.innerHTML = s + `<g class="deco" aria-hidden="true">${deco}</g><g aria-hidden="true" font-family="Barlow, system-ui, sans-serif">${labels}</g>`;
    starsEl.innerHTML = buttons;
    if (keep) { const el = document.querySelector(keep); if (el) el.focus({ preventScroll: true }); }
  }

  /* ---------- Motion: a dot travels, the sender flashes once ---------- */
  function flash(id) {
    const st = data && data.star.get(id);
    if (!st) return;
    const { x, y } = px(id);
    const max = Math.max(0, ...data.stars.filter((s) => s.id !== 'hub').map((s) => s.events));
    const r = Math.max(3, (id === 'hub' ? 9 * G.k : radiusOf(st, max)) * S);
    const el = document.createElement('div');
    el.className = 'flash';
    el.style.cssText = `left:${x - r}px;top:${y - r}px;width:${2 * r}px;height:${2 * r}px`;
    $('fx').appendChild(el);
    run(el, [{ opacity: 0.8, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(2.8)' }], { duration: FLASH_MS, easing: 'ease-out' });
  }
  function travel(a, b, delay) {
    const p = px(a), q = px(b);
    const el = document.createElement('div');
    el.className = 'pulse';
    $('fx').appendChild(el);
    run(el, [
      { transform: `translate(${p.x}px, ${p.y}px)`, opacity: 0 },
      { opacity: 1, offset: 0.12 },
      { opacity: 1, offset: 0.86 },
      { transform: `translate(${q.x}px, ${q.y}px)`, opacity: 0 },
    ], { duration: TRAVEL_MS, delay, easing: 'cubic-bezier(.45, 0, .55, 1)', fill: 'both' });
  }
  function run(el, frames, opts) {
    let gone = false;
    const done = () => { if (!gone) { gone = true; el.remove(); } };
    try { const a = el.animate(frames, opts); a.onfinish = done; a.oncancel = done; } catch (e) { done(); return; }
    setTimeout(done, (opts.delay || 0) + opts.duration + 400);
  }
  function pulse(p) {
    if (CALM.matches || !data || $('fx').childElementCount > FX_MAX) return;
    flash(p.from);
    p.to.forEach((t, i) => travel(p.from, t, i * TARGET_GAP));
  }
  const timers = new Set();
  function later(fn, ms) { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); }
  function stopMotion() { for (const t of timers) clearTimeout(t); timers.clear(); $('fx').textContent = ''; }

  /* ---------- Live ---------- */
  let timer = 0, inflight = false, lastRead = -1e9;
  async function load() {
    if (inflight) return;
    inflight = true;
    clearTimeout(timer);
    try {
      const r = await fetch(API + '/api/sky/' + code, { cache: 'no-store' });
      if (!r.ok) throw new Error('status ' + r.status);
      apply(clean(await r.json()));
      failed = false;
    } catch (e) {
      failed = true;
    } finally {
      inflight = false;
      lastRead = performance.now();
      show();
      next();
    }
  }
  function next() {
    clearTimeout(timer);
    if (mode !== 'live' || document.hidden) return;
    timer = setTimeout(load, (data ? data.poll : 30) * 1000);
  }
  function apply(d) {
    const before = seen;
    data = d;
    seen = new Set(d.pulses.map((p) => p.id));
    if (open && (open.kind === 'star' ? !d.star.has(open.id) : !d.line.has(open.id))) closePanel(false);
    render();
    if (open) fillPanel();
    if (!before || mode !== 'live' || CALM.matches) return;
    // New since the last check: the newest five, oldest of them first, 300 ms apart.
    d.pulses.filter((p) => !before.has(p.id)).slice(-LIVE_MAX).forEach((p, i) => later(() => { if (mode === 'live') pulse(p); }, i * LIVE_GAP));
  }

  // The parts of the page that follow the state: the away message, the buttons, the status, the note, the bars.
  function show() {
    $('away').hidden = !!data || !failed;
    for (const b of document.querySelectorAll('.seg button')) {
      b.disabled = !data;
      b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    }
    const calm = CALM.matches, replaying = mode !== 'live';
    $('replay').hidden = !replaying || calm || !data;
    $('stepper').hidden = !replaying || !calm || !data;
    $('legend').hidden = replaying || !data;
    status();
    let note = '';
    if (data && !data.pulses.length) note = 'Nothing in the last 7 days';
    else if (data && calm && !replaying) {
      const p = data.pulses[data.pulses.length - 1];
      note = `Latest: ${p.label}, ${who(p)} · ${when(p.at)}`;
    }
    $('note').hidden = !note;
    $('note').textContent = note;
  }
  function status() {
    const el = $('status');
    el.classList.toggle('is-clock', mode !== 'live' && !!data);
    if (mode !== 'live' && data) {
      const t = CALM.matches ? (rp.list[rp.step] ? rp.list[rp.step].at : null) : rp.start + rp.pos * (rp.end - rp.start);
      setText(el, t === null ? '' : clockText(t));
    } else if (!data) setText(el, failed ? '' : 'Loading…');
    else if (failed) el.innerHTML = `Can’t reach the hub · as of ${hm(data.now)}`;
    else el.innerHTML = `Live<span class="st-long"> · checks every ${data.poll} s</span> · ${hm(data.now)}`;
  }
  const setText = (el, t) => { if (el.textContent !== t) el.textContent = t; };

  /* ---------- Replay ---------- */
  const rp = { which: 'day', start: 0, end: 0, dur: 60000, pos: 0, playing: false, dragging: false, raf: 0, last: 0, list: [], step: 0 };
  function setMode(m) {
    if (!data || m === mode) return;
    mode = m;
    pause();
    stopMotion();
    if (m === 'live') {
      show();
      render();
      load();
      return;
    }
    clearTimeout(timer);
    rp.which = m;
    rp.end = data.now;
    rp.start = m === 'day' ? data.now - DAY : data.from;
    rp.dur = data.replay[m] * 1000;
    rp.list = data.pulses.filter((p) => p.at >= rp.start && p.at <= rp.end);
    rp.pos = 0;
    rp.step = 0;
    $('replayK').textContent = rp.list.length ? `A ${m} in ${data.replay[m]} s` : m === 'day' ? 'Nothing in the last day' : 'Nothing in the last 7 days';
    show();
    ticks();
    if (CALM.matches) step(0);
    else { render(); play(); }
  }
  function ticks() {
    let out = '';
    const len = rp.end - rp.start;
    const at = (t, text) => {
      const f = (t - rp.start) / len;
      if (f < 0.03 || f > 0.97) return;
      out += `<span style="left:calc(9px + (100% - 18px) * ${f.toFixed(4)})">${text}</span>`;
    };
    if (rp.which === 'day') {
      for (let t = Math.ceil(rp.start / HOUR) * HOUR; t <= rp.end; t += HOUR) {
        const h = +parts(t).h;
        if (h % 6 === 0) at(t, String(h).padStart(2, '0'));
      }
    } else {
      // Each weekday under the middle of its day; a part day under 10 hours gets no name.
      let a = rp.start;
      for (let t = Math.ceil(rp.start / HOUR) * HOUR; t <= rp.end + HOUR; t += HOUR) {
        const end = Math.min(t, rp.end);
        if (t > rp.end || +parts(t).h === 0) {
          if (end - a >= 10 * HOUR) at(a + (end - a) / 2, parts(a + 1).wd);
          a = end;
          if (t > rp.end) break;
        }
      }
    }
    const el = $('ticks');
    el.innerHTML = out;
    let right = Infinity;
    for (const t of [...el.children].reverse()) {
      const r = t.getBoundingClientRect();
      if (r.right > right - 6) t.hidden = true;
      else right = r.left;
    }
  }
  function play() {
    if (rp.pos >= 1) rp.pos = 0;
    rp.playing = true;
    rp.last = performance.now();
    if (!rp.raf) rp.raf = requestAnimationFrame(frame);
    paint();
  }
  function pause() {
    rp.playing = false;
    cancelAnimationFrame(rp.raf);
    rp.raf = 0;
    paint();
  }
  function frame(t) {
    rp.raf = 0;
    if (!rp.playing || mode === 'live') return;
    const dt = clamp(t - rp.last, 0, 100); // a hidden tab holds the replay where it was
    rp.last = t;
    if (!rp.dragging) {
      const before = rp.pos;
      rp.pos = Math.min(1, before + dt / rp.dur);
      const a = rp.start + before * (rp.end - rp.start), b = rp.start + rp.pos * (rp.end - rp.start);
      for (const p of rp.list) if ((p.at > a || (before === 0 && p.at >= a)) && p.at <= b) pulse(p);
      if (rp.pos >= 1) rp.playing = false;
    }
    paint();
    if (rp.playing) rp.raf = requestAnimationFrame(frame);
  }
  function paint() {
    const scrub = $('scrub'), btn = $('play');
    const v = Math.round(rp.pos * 1000);
    if (+scrub.value !== v && !rp.dragging) scrub.value = String(v);
    scrub.style.setProperty('--p', (rp.pos * 100).toFixed(2) + '%');
    if (mode !== 'live' && data) scrub.setAttribute('aria-valuetext', clockText(rp.start + rp.pos * (rp.end - rp.start)));
    btn.classList.toggle('is-playing', rp.playing);
    const label = rp.playing ? 'Pause' : 'Play';
    if (btn.getAttribute('aria-label') !== label) btn.setAttribute('aria-label', label);
    status();
  }
  function step(i) {
    const n = rp.list.length;
    rp.step = clamp(i, 0, Math.max(0, n - 1));
    const what = rp.which === 'day' ? 'Last day' : 'Last week';
    $('stepK').textContent = `${what}, one at a time · ${n ? `${rp.step + 1} of ${n}` : 'nothing to show'}`;
    const p = rp.list[rp.step];
    $('stepLabel').textContent = p ? p.label : rp.which === 'day' ? 'Nothing in the last day' : 'Nothing in the last 7 days';
    $('stepWho').textContent = p ? `${who(p)} · ${when(p.at)}` : '';
    $('prev').setAttribute('aria-disabled', String(!p || rp.step === 0));
    $('next').setAttribute('aria-disabled', String(!p || rp.step >= n - 1));
    status();
    render();
  }

  /* ---------- The panel ---------- */
  function rowsHTML(rows, dir) {
    return `<ul class="pn-rows">${rows.map((r) => `<li><span class="pn-l">${esc(r.label)}</span><span class="pn-n">${r.n}</span>` +
      (dir ? `<span class="pn-w">${r.who.length ? esc(dir + ' ' + r.who.map(name).join(', ')) : ''}</span>` : '') + '</li>').join('')}</ul>`;
  }
  function fillPanel() {
    let title = '', h = '';
    if (open.kind === 'star') {
      const s = data.star.get(open.id);
      title = s.name;
      const mine = data.pulses.filter((p) => p.from === s.id || p.to.includes(s.id));
      const last = mine[mine.length - 1];
      h += `<p class="pn-sub">${s.events ? esc(events(s.events) + (last ? ' · last one ' + when(last.at) : '')) : 'Nothing this week'}</p>`;
      if (s.quiet) {
        h += `<p class="pn-quiet"><span class="chip">${esc(quietShort(s))}</span>${s.limitHours ? `<span>its limit is ${esc(span(s.limitHours))}</span>` : ''}</p>`;
        if (s.how) h += `<p class="pn-how">${esc(s.how)}</p>`;
      }
      if (s.sent.length) h += '<h3>Sent</h3>' + rowsHTML(s.sent, 'to');
      if (s.received.length) h += '<h3>Received</h3>' + rowsHTML(s.received, 'from');
      if (mine.length) {
        h += '<h3>Latest</h3><ol class="pn-latest">' + mine.slice(-4).reverse().map((p) => {
          const w = p.from === s.id ? (p.to.length ? 'to ' + p.to.map(name).join(', ') : '') : 'from ' + name(p.from);
          return `<li><span class="pn-t">${esc(when(p.at))}</span><span class="pn-l">${esc(p.label)}</span><span class="pn-w">${esc(w)}</span></li>`;
        }).join('') + '</ol>';
      }
    } else {
      const l = data.line.get(open.id);
      title = lineName(l);
      h += `<p class="pn-sub">${esc(events(l.n))}</p>`;
      if (l.ab.length) h += `<h3>${esc(name(l.a) + ' to ' + name(l.b))}</h3>` + rowsHTML(l.ab);
      if (l.ba.length) h += `<h3>${esc(name(l.b) + ' to ' + name(l.a))}</h3>` + rowsHTML(l.ba);
    }
    setText($('panelH'), title);
    $('panelBody').innerHTML = h;
  }
  function openPanel(kind, id) {
    if (!data || (kind === 'star' ? !data.star.has(id) : !data.line.has(id))) return;
    if (open && open.kind === kind && open.id === id) { closePanel(true); return; }
    open = { kind, id };
    fillPanel();
    $('panel').hidden = false;
    $('panel').scrollTop = 0;
    render();
    $('panelH').focus({ preventScroll: true });
  }
  function closePanel(back) {
    const was = open;
    open = null;
    $('panel').hidden = true;
    render();
    if (back && was) {
      const el = document.querySelector(was.kind === 'star' ? `.star-btn[data-star="${was.id}"]` : `.hit[data-line="${was.id}"]`);
      if (el) el.focus({ preventScroll: true });
    }
  }

  /* ---------- Wiring ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target;
    const m = t.closest('.seg button');
    if (m) { setMode(m.dataset.mode); return; }
    const star = t.closest('[data-star]');
    if (star && star.closest('#sky')) { openPanel('star', star.dataset.star); return; }
    const hit = t.closest('.hit');
    if (hit) { openPanel('line', hit.dataset.line); return; }
    if (t.closest('#close')) { closePanel(true); return; }
    if (t.closest('#play')) { if (rp.playing) pause(); else play(); return; }
    if (t.closest('#prev')) { if (rp.step > 0) step(rp.step - 1); return; }
    if (t.closest('#next')) { if (rp.step < rp.list.length - 1) step(rp.step + 1); return; }
    const retry = t.closest('#retry');
    if (retry) {
      retry.disabled = true;
      retry.textContent = 'Trying…';
      load().then(() => { const b = $('retry'); b.disabled = false; b.textContent = 'Retry'; if (!data) b.focus(); });
      return;
    }
    // A tap on the empty sky puts the panel away.
    if (open && t.closest('#skyarea')) closePanel(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) { e.preventDefault(); closePanel(true); return; }
    const hit = e.target.closest && e.target.closest('.hit');
    if (hit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPanel('line', hit.dataset.line); }
  });
  const scrub = $('scrub');
  scrub.addEventListener('input', () => {
    rp.pos = clamp(+scrub.value / 1000, 0, 1); // a jump: nothing on the way animates
    stopMotion();
    paint();
  });
  scrub.addEventListener('pointerdown', () => { rp.dragging = true; });
  for (const ev of ['pointerup', 'pointercancel', 'change', 'blur']) scrub.addEventListener(ev, () => { rp.dragging = false; rp.last = performance.now(); });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearTimeout(timer); return; }
    if (mode === 'live') load();
  });
  addEventListener('focus', () => { if (mode === 'live' && !document.hidden && performance.now() - lastRead > 2000) load(); });
  let sized = 0;
  addEventListener('resize', () => { if (!sized) sized = requestAnimationFrame(() => { sized = 0; render(); if (mode !== 'live') ticks(); }); });
  CALM.addEventListener('change', () => {
    stopMotion();
    if (mode !== 'live') {
      if (CALM.matches) {
        pause();
        const i = rp.list.findIndex((p) => p.at >= rp.start + rp.pos * (rp.end - rp.start));
        step(i < 0 ? rp.list.length - 1 : i);
      }
      else { rp.step = 0; play(); }
    }
    show();
    render();
    if (mode !== 'live') ticks();
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { render(); if (mode !== 'live') ticks(); });

  show();
  render();
  load();

  /* ---------- The faint field of stars behind everything (decoration) ---------- */
  function drawField() {
    let seed = 7, out = '';
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 128; i++) {
      const t = (n) => Math.round(n * 10) / 10;
      const x = t(rnd() * 1440), y = t(rnd() * 900), r = t(0.5 + rnd() * 0.8), o = t(0.18 + rnd() * 0.3);
      out += `<circle cx="${x}" cy="${y}" r="${r}" fill="#C9CFDA" fill-opacity="${o}"></circle>`;
    }
    const f = document.getElementById('field');
    f.setAttribute('viewBox', '0 0 1440 900');
    f.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    f.innerHTML = out;
  }
})();
