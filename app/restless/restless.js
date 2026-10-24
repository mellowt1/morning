/* The Restless list (paul-hub src/restless.js, wave 2 Phase 4, approved 2026-10-24): every thing Paul
 * keeps for spare energy, by kind, To sort (no kind yet) first. Each row: the words, what is known
 * (how long, inside or outside, free or costs money) and how it drifts ("done 4", "skipped 2", "new").
 * Edit opens the same fields in the row (Save sends every field, so one can be cleared); Delete asks once
 * more. Add one sends source "morning". Read on opening and on return; nothing is kept on this device,
 * and the items never go to the console. Picking one happens on Morning while the dial says wired. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const CODE_RE = /^[a-z0-9]{16}$/;
  const ID = /^[a-z0-9]{12}$/;
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
  const KIND = { move: 'Move', build: 'Build', outside: 'Outside', social: 'Social', learn: 'Learn', home: 'Home' };
  const MINS = [[15, '15 min'], [30, '30 min'], [60, '1 h'], [120, '2 h+']];
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const span = (m) => (m >= 120 ? '2 h+' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}`);

  let items = null; // null until the first answer
  let counts = null;
  let editing = null; // the id whose row is a form
  let adding = false;
  let busy = false;

  function clean(it) {
    if (!it || typeof it !== 'object' || typeof it.id !== 'string' || !ID.test(it.id) || typeof it.text !== 'string' || !it.text.trim()) return null;
    return {
      id: it.id, text: it.text.trim(), kind: KIND[it.kind] ? it.kind : null, mins: Number.isFinite(it.mins) ? it.mins : null,
      place: it.place === 'inside' || it.place === 'outside' ? it.place : null, costs: typeof it.costs === 'boolean' ? it.costs : null,
      done: Math.max(0, Number(it.done) || 0), skipped: Math.max(0, Number(it.skipped) || 0),
    };
  }
  const meta = (it) => [it.mins ? span(it.mins) : '', it.place || '', it.costs === true ? 'costs money' : it.costs === false ? 'free' : '',
    it.kind ? '' : 'no kind yet'].filter(Boolean).join(' · ');
  const drift = (it) => [it.done ? `done ${it.done}` : '', it.skipped ? `skipped ${it.skipped}` : ''].filter(Boolean).join(' · ') || 'new';

  /* The fields, for Add one (it null) and Edit. A chosen chip tapped again leaves that field open. */
  function formHTML(it) {
    const key = it ? it.id : 'new';
    const seg = (name, label, opts, val) => `<div class="rf-row" role="group" aria-labelledby="${key}-${name}"><span id="${key}-${name}" class="rf-k">${label}</span>` +
      `<div class="seg" data-rf="${name}">${opts.map(([v, w]) => `<button type="button" data-v="${v}" aria-pressed="${String(val) === String(v)}">${w}</button>`).join('')}</div></div>`;
    return `<form class="rf" data-form="${key}" novalidate aria-label="${it ? 'Edit ' + esc(it.text) : 'Add to the Restless list'}">` +
      `<label class="rf-row"><span class="rf-k">What</span><input class="rf-in" name="text" maxlength="80" autocomplete="off" required value="${it ? esc(it.text) : ''}"></label>` +
      seg('kind', 'Kind', Object.entries(KIND), it ? it.kind : null) +
      seg('mins', 'About how long', MINS, it ? it.mins : null) +
      seg('place', 'Where', [['inside', 'Inside'], ['outside', 'Outside']], it ? it.place : null) +
      seg('costs', 'Money', [['false', 'Free'], ['true', 'Costs money']], it ? it.costs : null) +
      (it ? '' : '<p class="rf-hint">Only What is needed. Tap a chosen one again to leave it open.</p>') +
      '<p class="rf-err" role="alert" hidden></p>' +
      `<div class="rf-acts"><button type="submit" class="btn btn-go">${it ? 'Save' : 'Add to the list'}</button>` +
      '<button type="button" class="btn btn-quiet" data-act="cancel">Cancel</button>' +
      (it ? '<button type="button" class="btn btn-del" data-act="delete">Delete</button>' : '') + '</div></form>';
  }

  function rowHTML(it) {
    if (editing === it.id) return `<li class="rr rr-edit" data-id="${it.id}">${formHTML(it)}</li>`;
    return `<li class="rr" data-id="${it.id}"><span class="rr-text">${esc(it.text)}</span><span class="rr-drift">${esc(drift(it))}</span>` +
      `<button type="button" class="rr-edit-btn" data-act="edit" aria-label="Edit ${esc(it.text)}">Edit</button>` +
      `<span class="rr-meta">${esc(meta(it))}</span></li>`;
  }

  function render() {
    const list = $('list');
    if (!items) return;
    const total = counts ? counts.total : items.length;
    const sub = total ? `${plural(total, 'thing', 'things')} · done ${plural(counts ? counts.done : 0, 'time', 'times')}, skipped ${counts ? counts.skipped : 0}` : 'Things to do with spare energy.';
    if ($('sub').textContent !== sub) $('sub').textContent = sub;
    if (!items.length) {
      list.innerHTML = '<p class="note sheet">Nothing on the list yet. Add one: a few words are enough.</p>';
      return;
    }
    const groups = [['', 'To sort'], ...Object.entries(KIND)]
      .map(([k, title]) => [k, title, items.filter((it) => (it.kind || '') === k)])
      .filter(([, , rows]) => rows.length);
    list.innerHTML = groups.map(([k, title, rows]) => `<section class="sheet group" aria-labelledby="g-${k || 'sort'}">` +
      `<h2 id="g-${k || 'sort'}" class="group-h">${title} <span class="group-n">${rows.length}</span></h2>` +
      `<ul class="rows">${rows.map(rowHTML).join('')}</ul></section>`).join('');
  }

  function say(words) {
    $('status').textContent = words;
    $('status').hidden = !words;
  }

  let loading = false;
  async function load() {
    if (loading) return;
    loading = true;
    const list = $('list');
    if (!items && !list.firstChild) list.innerHTML = '<p class="note sheet">Loading…</p>';
    try {
      const r = await fetch(API + '/api/restless/' + code, { cache: 'no-store' });
      if (r.status === 404 || r.status === 400) { $('app').hidden = true; $('nocode').hidden = false; return; }
      if (!r.ok) throw new Error('status ' + r.status);
      const d = await r.json();
      items = (Array.isArray(d.items) ? d.items : []).map(clean).filter(Boolean);
      counts = d.counts && Number.isFinite(d.counts.total) ? { total: d.counts.total, done: Number(d.counts.done) || 0, skipped: Number(d.counts.skipped) || 0 } : null;
      if (editing && !items.some((it) => it.id === editing)) editing = null;
      render();
    } catch (e) {
      // Keep what was shown; with nothing shown yet, say so and offer a retry.
      if (!items) list.innerHTML = '<p class="note sheet note-retry"><span>Can’t reach the hub.</span> <button type="button" id="retry" class="btn">Retry</button></p>';
    } finally {
      loading = false;
    }
  }

  async function post(path, body) {
    const r = await fetch(API + '/api/restless/' + code + path, {
      method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    let out = null;
    try { out = await r.json(); } catch (e) { /* none */ }
    return { ok: r.ok, out };
  }

  /* What the form says: { text, kind, mins, place, costs }, a field with no chip chosen as null. */
  function read(form) {
    const out = { text: form.querySelector('[name="text"]').value.replace(/\s+/g, ' ').trim() };
    for (const seg of form.querySelectorAll('[data-rf]')) {
      const b = seg.querySelector('[aria-pressed="true"]');
      const v = b ? b.dataset.v : null;
      out[seg.dataset.rf] = v === null ? null : seg.dataset.rf === 'mins' ? Number(v) : seg.dataset.rf === 'costs' ? v === 'true' : v;
    }
    return out;
  }
  function formError(form, words) {
    const p = form.querySelector('.rf-err');
    p.textContent = words;
    p.hidden = !words;
    const input = form.querySelector('[name="text"]');
    if (words && !input.value.trim()) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  }

  function openAdd(on) {
    adding = on;
    $('addBox').hidden = !on;
    $('addBtn').setAttribute('aria-expanded', String(on));
    $('addBox').innerHTML = on ? formHTML(null) : '';
    if (on) { say(''); $('addBox').querySelector('[name="text"]').focus(); } else $('addBtn').focus();
  }

  function edit(id) {
    editing = id;
    say('');
    render();
    const input = document.querySelector(`.rr[data-id="${id}"] [name="text"]`);
    if (input) input.focus();
  }
  function stopEdit(id) {
    editing = null;
    render();
    const b = document.querySelector(`.rr[data-id="${id}"] [data-act="edit"]`);
    if (b) b.focus();
  }

  async function submit(form) {
    if (busy) return;
    const f = read(form);
    if (!f.text) { formError(form, 'What is it? A few words are enough.'); form.querySelector('[name="text"]').focus(); return; }
    const id = form.dataset.form;
    const isNew = id === 'new';
    let body = f;
    if (isNew) { body = { text: f.text, source: 'morning' }; for (const k of ['kind', 'mins', 'place', 'costs']) if (f[k] !== null) body[k] = f[k]; }
    busy = true;
    for (const b of form.querySelectorAll('button')) b.disabled = true;
    formError(form, '');
    let done = false;
    try {
      const { ok, out } = await post(isNew ? '/add' : `/item/${id}`, body);
      if (ok && out && out.item) done = true;
      else formError(form, out && typeof out.error === 'string' && out.error ? `Not saved: ${out.error}` : 'Not saved. Try again.');
    } catch (e) {
      formError(form, 'Can’t reach the hub. Nothing changed, try again.');
    }
    busy = false;
    for (const b of form.querySelectorAll('button')) b.disabled = false;
    if (!done) return;
    if (isNew) { openAdd(false); say(`Added: ${f.text}.`); await load(); return; }
    editing = null;
    await load();
    say('Saved.');
    const b = document.querySelector(`.rr[data-id="${id}"] [data-act="edit"]`);
    if (b) b.focus();
  }

  /* Delete asks once more: the button says "Delete for good?" for five seconds. */
  async function remove(form, btn) {
    if (busy) return;
    if (btn.dataset.armed !== '1') {
      btn.dataset.armed = '1';
      btn.textContent = 'Delete for good?';
      setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = 'Delete'; } }, 5000);
      return;
    }
    const id = form.dataset.form;
    const row = btn.closest('.rr');
    const next = row && (row.nextElementSibling || row.previousElementSibling);
    const nextId = next ? next.dataset.id : null;
    busy = true;
    for (const b of form.querySelectorAll('button')) b.disabled = true;
    let done = false;
    try {
      const { ok } = await post(`/item/${id}/delete`, {});
      done = ok;
      if (!ok) formError(form, 'Not deleted. Try again.');
    } catch (e) {
      formError(form, 'Can’t reach the hub. Nothing changed, try again.');
    }
    busy = false;
    for (const b of form.querySelectorAll('button')) b.disabled = false;
    if (!done) return;
    editing = null;
    await load();
    say('Deleted.');
    const b = (nextId && document.querySelector(`.rr[data-id="${nextId}"] [data-act="edit"]`)) || $('addBtn');
    b.focus();
  }

  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.rf [data-rf] button');
    if (chip) {
      const on = chip.getAttribute('aria-pressed') !== 'true';
      for (const x of chip.parentElement.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === chip && on));
      return;
    }
    if (e.target.closest('#addBtn')) { openAdd(!adding); return; }
    const retry = e.target.closest('#retry');
    if (retry) {
      retry.disabled = true;
      retry.textContent = 'Trying…';
      load().then(() => { const b = $('retry'); if (b) b.focus(); });
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const form = b.closest('.rf');
    if (b.dataset.act === 'edit') edit(b.closest('.rr').dataset.id);
    else if (b.dataset.act === 'cancel') { if (form.dataset.form === 'new') openAdd(false); else stopEdit(form.dataset.form); }
    else if (b.dataset.act === 'delete') remove(form, b);
  });
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('.rf');
    if (!form) return;
    e.preventDefault();
    submit(form);
  });
  document.addEventListener('keydown', (e) => {
    const form = e.key === 'Escape' && e.target.closest && e.target.closest('.rf');
    if (!form) return;
    e.preventDefault();
    if (form.dataset.form === 'new') openAdd(false); else stopEdit(form.dataset.form);
  });
  // On return, read again, but never under an open form (its draft stays).
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !editing && !adding) load(); });
  say('');
  load();
})();
