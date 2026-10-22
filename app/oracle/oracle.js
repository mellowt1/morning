/* Past weeks: the Oracle's questions, newest first, and what Paul said (GET /api/oracle/:code/list,
 * paul-hub src/oracle.js). Read only: answering happens on Morning. Read on opening and on return to
 * the page; nothing is kept on this device, and the questions and answers never go to the console. */
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

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const dm = (date) => `${+date.slice(8, 10)} ${MONTHS[+date.slice(5, 7) - 1]}`;
  /* The week's days, Monday to Sunday: "12 to 18 Oct", with the year when it is not this one. */
  function span(monday) {
    const sunday = new Date(Date.parse(monday + 'T12:00:00Z') + 6 * 864e5).toISOString().slice(0, 10);
    const words = monday.slice(5, 7) === sunday.slice(5, 7) ? `${+monday.slice(8, 10)} to ${dm(sunday)}` : `${dm(monday)} to ${dm(sunday)}`;
    return sunday.slice(0, 4) === String(new Date().getFullYear()) ? words : `${words} ${sunday.slice(0, 4)}`;
  }

  function rowHTML(w) {
    let said;
    if (w.state === 'answered' && typeof w.answer === 'string' && w.answer) said = `<p class="pw-a"><span class="sr">You said: </span>${esc(w.answer)}</p>`;
    else if (w.state === 'aside') said = '<p class="pw-a pw-quiet">Put aside</p>';
    else said = '<p class="pw-a pw-quiet pw-open">Not answered yet</p>';
    return `<li class="pw"><div class="pw-week"><span class="pw-label">${esc(w.label || 'Week')}</span>` +
      `<span class="pw-days">${esc(span(w.week))}</span></div>` +
      `<div class="pw-body"><p class="pw-q">${esc(w.question)}</p>${said}</div></li>`;
  }

  let loading = false;
  async function load() {
    if (loading) return;
    loading = true;
    const list = $('list');
    if (!list.firstChild) list.innerHTML = '<p class="pw-note">Loading…</p>';
    try {
      const r = await fetch(API + '/api/oracle/' + code + '/list', { cache: 'no-store' });
      if (r.status === 404 || r.status === 400) { $('app').hidden = true; $('nocode').hidden = false; return; }
      if (!r.ok) throw new Error('status ' + r.status);
      const d = await r.json();
      const weeks = (Array.isArray(d.weeks) ? d.weeks : [])
        .filter((w) => w && typeof w.week === 'string' && DATE.test(w.week) && typeof w.question === 'string' && w.question.trim());
      list.innerHTML = weeks.length ? `<ol class="pw-list">${weeks.map(rowHTML).join('')}</ol>`
        : '<p class="pw-note">No questions yet. The first one comes on a Sunday morning.</p>';
    } catch (e) {
      // Keep what was shown; with nothing shown yet, say so and offer a retry.
      if (!list.querySelector('.pw-list')) list.innerHTML = '<p class="pw-note pw-retry"><span>Can’t reach the hub.</span> <button type="button" id="retry" class="btn">Retry</button></p>';
    } finally {
      loading = false;
    }
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('#retry');
    if (!b) return;
    b.disabled = true;
    b.textContent = 'Trying…';
    load().then(() => { const b = $('retry'); if (b) b.focus(); });
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  load();
})();
