/* Hiscores: Paul's real life as OSRS skills. Reads GET /api/hiscores/:code (paul-hub,
 * src/hiscores.js), draws the skills tab and the chatbox, and plays the level-up dialog for every
 * level gained since this device last looked (localStorage hiscores.seen.<code>; Morning reads the
 * same key to show "Level up waiting"). Browsers only play sound after a tap, so the first
 * dialog waits for one. */
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

  let code = (params.get('c') || '').trim().toLowerCase();
  if (CODE_RE.test(code)) store.set('morning.code', code);
  else code = store.get('morning.code') || store.get('todo.code') || '';
  if (!CODE_RE.test(code)) { $('app').hidden = true; $('nocode').hidden = false; return; }

  const SEEN = 'hiscores.seen.' + code;
  const LAST = 'hiscores.last.' + code;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => Number(n || 0).toLocaleString('en-GB');
  const VERB = {
    woodcutting: (w) => `You chop through: ${w}.`,
    slayer: (w) => `You complete a Slayer task: ${w}.`,
    cooking: (w) => `You cook ${w}.`,
    prayer: () => 'You pray at the altar of Feeling.',
    ranged: (w) => `You fire some arrows: ${w}.`,
    magic: (w) => `You cast a spell: ${w}.`,
    crafting: (w) => `You craft: ${w}.`,
    construction: (w) => `You build: ${w}.`,
  };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let data = (store.get(LAST) || {}).data || null;
  let tipFor = null;
  const queue = [];
  let showing = null;
  let unlocked = false;
  const extra = []; // level-up lines written here, shown at the bottom of the log

  /* ---------- Drawing ---------- */

  function stamp(at) {
    const d = new Date(at);
    if (!Number.isFinite(d.valueOf())) return '';
    const today = new Date().toDateString() === d.toDateString();
    return today ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
  }

  function drawGrid() {
    const g = $('grid');
    if (!data) return;
    let html = '';
    for (const s of data.skills) {
      html += `<button type="button" class="slot${tipFor === s.id ? ' on' : ''}" data-skill="${s.id}" aria-label="${esc(s.name)} level ${s.level}, ${num(s.xp)} XP">`
        + `<img src="assets/${s.id}.png" alt="" draggable="false">`
        + `<span class="lv a">${s.level}</span><span class="slash"></span><span class="lv b">${s.level}</span>`
        + (s.today ? '<span class="gain" title="XP today"></span>' : '')
        + '</button>';
    }
    html += `<div class="slot total" role="note"><span>Total level:</span><span>${data.total}</span></div>`;
    if (g.dataset.html !== html) { g.innerHTML = html; g.dataset.html = html; }
    const today = data.skills.reduce((n, s) => n + s.today, 0);
    $('sub').textContent = `Total level ${data.total} · ${num(data.totalXp)} XP` + (today ? ` · +${num(today)} today` : '');
    $('foot').textContent = 'Updated ' + stamp(data.at) + ' · To-do, Kitchen, Feeling, Day, Desk, German';
  }

  function drawLog() {
    if (!data) return;
    const lines = (data.log || []).slice().reverse().map((r) => {
      const verb = VERB[r.skill] || ((w) => w);
      return `<p><span class="t">[${esc(stamp(r.at))}]</span> ${esc(verb(r.what || ''))} <span class="x">(+${num(r.xp)} XP)</span></p>`;
    });
    const el = $('log');
    const html = lines.join('') + extra.join('');
    if (el.dataset.html === html) return;
    el.innerHTML = html || '<p>Welcome to Old School RuneScape.</p>';
    el.dataset.html = html;
    el.scrollTop = el.scrollHeight;
  }

  /* ---------- The tooltip ---------- */

  function showTip(id) {
    const s = data && data.skills.find((x) => x.id === id);
    const tip = $('tip');
    tipFor = s ? id : null;
    document.querySelectorAll('.slot[data-skill]').forEach((b) => b.classList.toggle('on', b.dataset.skill === tipFor));
    if (!s) { tip.hidden = true; return; }
    const rows = [`${s.name} XP: ${num(s.xp)}`];
    if (s.next !== null) rows.push(`Next level at: ${num(s.next)}`, `Remaining XP: ${num(s.next - s.xp)}`);
    rows.push(`From: ${s.from}`);
    if (s.today) rows.push(`Today: +${num(s.today)} XP`);
    tip.innerHTML = rows.map(esc).join('<br>');
    tip.hidden = false;
    const slot = document.querySelector(`.slot[data-skill="${id}"]`);
    const tab = slot.offsetParent;
    const left = Math.min(slot.offsetLeft + 8, tab.clientWidth - tip.offsetWidth - 4);
    tip.style.left = Math.max(4, left) + 'px';
    tip.style.top = (slot.offsetTop + slot.offsetHeight - 6) + 'px';
  }
  $('grid').addEventListener('click', (e) => {
    const b = e.target.closest('.slot[data-skill]');
    if (!b) return;
    showTip(tipFor === b.dataset.skill ? null : b.dataset.skill);
  });
  $('grid').addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const b = e.target.closest('.slot[data-skill]');
    if (b) showTip(b.dataset.skill);
  });
  $('grid').addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') showTip(null); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.tab')) showTip(null); });

  /* ---------- Level ups ---------- */

  function findLevelUps() {
    if (!data) return;
    let seen = store.get(SEEN);
    if (!seen || typeof seen !== 'object') seen = {}; // a new device starts at level 1 everywhere: celebrate the lot
    for (const s of data.skills) {
      const was = Number(seen[s.id]) || 1;
      if (s.level > was && !queue.some((q) => q.id === s.id) && (!showing || showing.id !== s.id)) queue.push({ id: s.id, name: s.name, level: s.level, from: was });
    }
    if (!showing) next();
  }

  function markSeen(id, level) {
    const seen = store.get(SEEN) || {};
    seen[id] = level;
    store.set(SEEN, seen);
  }

  function next() {
    showing = queue.shift() || null;
    const box = $('levelup');
    if (!showing) { box.hidden = true; return; }
    const n = showing.level - showing.from;
    $('luIcon').src = `assets/${showing.id}-big.png`;
    const an = /^[aeiou]/i.test(showing.name) ? 'an' : 'a';
    $('luHead').textContent = n > 1 ? `Congratulations, you just advanced ${n} ${showing.name} levels.` : `Congratulations, you just advanced ${an} ${showing.name} level.`;
    $('luBody').textContent = `Your ${showing.name} level is now ${showing.level}.`;
    box.hidden = false;
    box.classList.toggle('wait', !unlocked);
    if (unlocked) celebrate(showing.id);
  }

  let audio = null;
  function celebrate(id) {
    try {
      if (audio) audio.pause();
      audio = new Audio(`assets/levelup-${id}.mp3`);
      audio.volume = 0.7;
      audio.play().catch(() => {});
      const pop = new Audio('assets/fireworks-sfx.mp3');
      pop.volume = 0.5;
      pop.play().catch(() => {});
    } catch (e) { /* no sound, still the fireworks */ }
    fireworks(id);
  }

  const COLOURS = ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ffffff', '#ff981f'];
  function fireworks(id) {
    const slot = document.querySelector(`.slot[data-skill="${id}"]`);
    if (!slot) return;
    slot.classList.remove('flash');
    void slot.offsetWidth;
    slot.classList.add('flash');
    if (reduce) return;
    const r = slot.getBoundingClientRect();
    const fx = $('fx');
    for (let i = 0; i < 48; i++) {
      const p = document.createElement('i');
      p.className = 'px';
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 110;
      p.style.left = r.left + r.width / 2 + 'px';
      p.style.top = r.top + r.height / 2 + 'px';
      p.style.background = COLOURS[i % COLOURS.length];
      p.style.setProperty('--dx', Math.round(Math.cos(a) * d / 2) * 2 + 'px');
      p.style.setProperty('--dy', Math.round(Math.sin(a) * d / 2) * 2 + 'px');
      p.style.animationDelay = (i % 3) * 120 + 'ms';
      fx.appendChild(p);
      setTimeout(() => p.remove(), 1600);
    }
  }

  // The first tap anywhere unlocks sound; if a dialog is waiting, it plays now, and a tap on
  // "Click here to continue" that did the unlocking does not also move on.
  let swallow = false;
  function unlock(e) {
    if (unlocked) return;
    unlocked = true;
    if (!showing) return;
    $('levelup').classList.remove('wait');
    celebrate(showing.id);
    swallow = !!(e && e.target && e.target.id === 'luNext');
  }
  document.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('keydown', unlock, { capture: true });

  $('luNext').addEventListener('click', () => {
    if (swallow) { swallow = false; return; } // that tap was for the sound
    if (!showing) return;
    const s = showing;
    markSeen(s.id, s.level);
    extra.push(`<p class="lvl">Congratulations, you've just advanced your ${esc(s.name)} level. You are now level ${s.level}.</p>`);
    drawLog();
    next();
  });

  /* ---------- Loading ---------- */

  function draw() { drawGrid(); drawLog(); if (tipFor) showTip(tipFor); findLevelUps(); }

  async function load() {
    try {
      const r = await fetch(API + '/api/hiscores/' + code, { cache: 'no-store' });
      if (!r.ok) throw new Error('status ' + r.status);
      const d = await r.json();
      if (!d || !Array.isArray(d.skills)) throw new Error('bad answer');
      data = d;
      store.set(LAST, { at: Date.now(), data });
    } catch (e) {
      if (!data) { $('sub').textContent = "Can't reach the hiscores right now."; return; }
    }
    draw();
  }

  if (data) draw();
  load();
  setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') load(); });
})();
