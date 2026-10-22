/* Skills (morning/skills/): the roles Paul tracks, what each one asks for, which of it is on his side,
 * and the gaps across all of them (GET /api/skills/:code, paul-hub src/skills.js). A role comes from Track
 * this role on an Apply task in To-do or from Paste a job here; Claude reads it on the hub. A gap has
 * Paul's plan (a step can become a To-do task), Claude's options on request, and I have this now, which
 * puts his own words on his side and moves every role that asked for it.
 *
 * Nothing about Paul is made up here: every Have or Partly shows the line from his side that the hub
 * matched it to, and a Have or Partly without a line is shown as Not checked.
 *
 * Read on opening and on return to the page; every 5 s while Claude is reading a role, for 3 minutes at
 * most. ?r=<roleId> opens a role and ?g=<gapKey> a gap (To-do links here). Nothing is kept on this
 * device apart from the code, and nothing goes to the console. */
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
  const BASE = API + '/api/skills/' + code;
  const TODO = '../../todo/?c=' + encodeURIComponent(code);
  const WIDE = matchMedia('(min-width: 1100px)');
  const MIN_TEXT = 200;
  const POLL_MS = 5000, POLL_FOR = 180000;

  /* ---------- Words and dates (the hub's today, The Hague's) ---------- */
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const str = (s, n) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, n) : '');
  const num = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Math.floor(Number(n)) : 0);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const enc = encodeURIComponent;
  const SEP = '\u00a0· ';
  const HAGUE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' });
  function dayOf(s) {
    if (typeof s !== 'string' || !s) return '';
    if (DATE.test(s)) return s;
    const t = Date.parse(s);
    return Number.isFinite(t) ? HAGUE.format(new Date(t)) : '';
  }
  const dayNum = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5;
  // "4 Nov" never splits over two lines.
  const shortDate = (s) => `${+s.slice(8, 10)} ${MON[+s.slice(5, 7) - 1]}` + (data && s.slice(0, 4) !== data.today.slice(0, 4) ? ' ' + s.slice(0, 4) : '');
  // "closes 4 Nov", "closes today", "closed 2 Oct".
  function closes(deadline) {
    const d = dayNum(deadline) - dayNum(data.today);
    if (d < 0) return 'closed ' + shortDate(deadline);
    if (d === 0) return 'closes today';
    if (d === 1) return 'closes tomorrow';
    return 'closes ' + shortDate(deadline);
  }

  /* ---------- Have, Partly, Missing: a mark as well as a colour ---------- */
  const ST = { have: ['Have', '●'], partly: ['Partly', '◐'], missing: ['Missing', '○'], unknown: ['Not checked', '◌'], closed: ['Closed', '●'] };
  const chip = (s, small) => `<span class="st st-${s}${small ? ' st-s' : ''}"><i aria-hidden="true">${ST[s][1]}</i>${ST[s][0]}</span>`;
  function fitHTML(c) {
    const t = c.have + c.partly + c.missing + c.unknown;
    if (!t) return '';
    const seg = (k) => (c[k] ? `<i class="fb-${k}" style="width:${((c[k] / t) * 100).toFixed(2)}%"></i>` : '');
    const words = c.have + c.partly + c.missing ? `${c.have} have${SEP}${c.partly} partly${SEP}${c.missing} missing` + (c.unknown ? `${SEP}${c.unknown} not checked` : '') : `${c.unknown} not checked`;
    return `<div class="fit"><div class="fit-bar" aria-hidden="true">${seg('have')}${seg('partly')}${seg('missing')}</div><span class="fit-t">${words}</span></div>`;
  }

  /* ---------- The answer, checked: anything unexpected is left out ---------- */
  const RID = /^[A-Za-z0-9_-]{1,64}$/, GKEY = /^[A-Za-z0-9_.:-]{1,120}$/;
  const KINDS = ['experience', 'skill', 'language', 'clearance', 'qualification'];
  const KIND_NAME = { experience: 'Experience', skill: 'Skills', language: 'Languages', clearance: 'Clearances', qualification: 'Qualifications' };
  const STATES = ['reading', 'ready', 'needs_text', 'failed', 'past'];
  const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'req';
  function cleanLine(l) {
    if (!l || typeof l !== 'object') return null;
    const text = str(l.text, 600);
    return text ? { id: str(l.id, 64), text, source: l.source === 'closed' ? 'closed' : 'cv', gap: GKEY.test(l.gap || '') ? l.gap : '' } : null;
  }
  function cleanReq(q) {
    if (!q || typeof q !== 'object') return null;
    const label = str(q.label, 200);
    if (!label) return null;
    const line = cleanLine(q.line);
    let status = ['have', 'partly', 'missing', 'unknown'].includes(q.status) ? q.status : 'unknown';
    // Have and Partly always point to a line on Paul's side; without one the page claims nothing.
    if ((status === 'have' || status === 'partly') && !line) status = 'unknown';
    return {
      key: GKEY.test(q.key || '') ? q.key : slug(label), label, kind: KINDS.includes(q.kind) ? q.kind : 'skill', must: q.must !== false,
      status, line: status === 'have' || status === 'partly' ? line : null, why: str(q.why, 300),
    };
  }
  function cleanRole(r) {
    if (!r || typeof r !== 'object' || !RID.test(r.id || '')) return null;
    const title = str(r.title, 200);
    if (!title) return null;
    const reqs = Array.isArray(r.reqs) ? r.reqs.map(cleanReq).filter(Boolean) : [];
    const c = r.counts && typeof r.counts === 'object' ? r.counts : {};
    const counts = reqs.length
      ? reqs.reduce((a, q) => { a[q.status]++; return a; }, { have: 0, partly: 0, missing: 0, unknown: 0 })
      : { have: num(c.have), partly: num(c.partly), missing: num(c.missing), unknown: num(c.unknown) };
    return {
      id: r.id, title, org: str(r.org, 200), link: typeof r.link === 'string' && /^https?:\/\/\S+$/i.test(r.link.trim()) ? r.link.trim().slice(0, 500) : '',
      deadline: DATE.test(r.deadline || '') ? r.deadline : '', source: r.source === 'digest' ? 'digest' : 'paste', taskId: str(r.taskId, 64),
      state: STATES.includes(r.state) ? r.state : 'ready', error: str(r.error, 300), counts, created: dayOf(r.createdAt), reqs,
    };
  }
  function cleanStep(s) {
    if (!s || typeof s !== 'object' || !RID.test(s.id || '') || !str(s.text, 300)) return null;
    return { id: s.id, text: str(s.text, 300), taskId: str(s.taskId, 64), source: s.source === 'claude' ? 'claude' : 'paul' };
  }
  function cleanGap(g) {
    if (!g || typeof g !== 'object' || !GKEY.test(g.key || '')) return null;
    const label = str(g.label, 200);
    if (!label) return null;
    return {
      key: g.key, label, roles: Array.isArray(g.roles) ? [...new Set(g.roles.filter((x) => typeof x === 'string' && RID.test(x)))] : [],
      must: num(g.must), total: num(g.total), active: num(g.active), worst: g.worst === 'partly' ? 'partly' : 'missing',
      state: ['open', 'working', 'closed'].includes(g.state) ? g.state : 'open',
      closedNote: typeof g.closedNote === 'string' ? g.closedNote.trim().slice(0, 600) : '', closedAt: dayOf(g.closedAt),
      steps: Array.isArray(g.steps) ? g.steps.map(cleanStep).filter(Boolean) : [],
      options: Array.isArray(g.options) ? g.options.map((o) => (o && str(o.title, 160) ? { title: str(o.title, 160), text: str(o.text, 600) } : null)).filter(Boolean).slice(0, 5) : null,
    };
  }
  function index(d) {
    d.roleById = new Map(d.roles.map((r) => [r.id, r]));
    d.gapByKey = new Map(d.gaps.map((g) => [g.key, g]));
    return d;
  }
  function clean(d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.roles)) throw new Error('shape');
    const s = d.side && typeof d.side === 'object' ? d.side : {};
    return index({
      today: DATE.test(d.today || '') ? d.today : dayOf(new Date().toISOString()),
      side: { lines: num(s.lines), closed: num(s.closed), updated: dayOf(s.updatedAt) },
      roles: d.roles.map(cleanRole).filter(Boolean),
      gaps: (Array.isArray(d.gaps) ? d.gaps : []).map(cleanGap).filter(Boolean),
    });
  }
  // A role or a gap from a POST goes straight into the copy here; the next read puts it in its place.
  function putRole(raw) {
    const r = cleanRole(raw);
    if (!r || !data) return null;
    const i = data.roles.findIndex((x) => x.id === r.id);
    if (i >= 0) data.roles[i] = r;
    else { const p = data.roles.findIndex((x) => x.state === 'past'); data.roles.splice(p < 0 ? data.roles.length : p, 0, r); }
    index(data);
    return r;
  }
  function putGap(raw) {
    const g = cleanGap(raw);
    if (!g || !data) return null;
    const i = data.gaps.findIndex((x) => x.key === g.key);
    if (i >= 0) data.gaps[i] = g; else data.gaps.push(g);
    index(data);
    return g;
  }
  const sideEmpty = () => !!data && !data.side.lines && !data.side.closed;
  const active = () => data.roles.filter((r) => r.state !== 'past');
  // The other active roles that ask for the same thing.
  const others = (r, key) => {
    const g = data.gapByKey.get(key);
    return g ? g.roles.filter((id) => id !== r.id && data.roleById.has(id) && data.roleById.get(id).state !== 'past').length : 0;
  };

  /* ---------- State ---------- */
  let data = null;          // the last good answer, checked
  let failed = false;       // the last read failed
  let sel = null;           // { kind: 'role' | 'gap', id }: what is open
  let implicit = false;     // the PC opened the first role by itself (not in the address)
  let stack = [];           // the phone: where ‹ goes when a gap opened a role
  let opener = null;        // the phone: what gets the focus back when the full screen closes
  let tab = 'roles';        // the phone's tab
  let pastOpen = false, menuOpen = false, rmAsk = false;
  let detailErr = '';
  let busy = false;
  const thinking = new Set();               // gaps waiting for Claude's options
  const drafts = { step: {}, text: {} };    // what is typed in the open role or gap, kept across reads

  const isSel = (kind, id) => !!sel && sel.kind === kind && sel.id === id;
  const valid = (s) => !!s && !!data && (s.kind === 'role' ? data.roleById.has(s.id) : data.gapByKey.has(s.id));
  function ensureSel() {
    if (!data) return;
    if (sel && !valid(sel)) { sel = null; implicit = false; menuOpen = rmAsk = false; detailErr = ''; setUrl(); }
    stack = stack.filter(valid);
    if (WIDE.matches) {
      if (!sel) {
        const r = active()[0] || data.roles[0];
        if (r) { sel = { kind: 'role', id: r.id }; implicit = true; }
      }
    } else if (sel && implicit) { sel = null; implicit = false; }
  }

  /* ---------- The head ---------- */
  function renderHead() {
    const line = $('sideLine');
    const s = data && data.side;
    const words = !data ? '' : sideEmpty() ? 'Your side is empty: add your CV Studio blocks'
      : `Your side: ${plural(s.lines, 'line', 'lines')}${s.updated ? ' · updated ' + shortDate(s.updated) : ''}`;
    if (line.textContent !== words) line.textContent = words;
    line.classList.toggle('is-empty', sideEmpty());
    const st = $('status');
    st.textContent = !data ? (failed ? '' : 'Loading…') : failed ? 'Can’t reach the hub · showing what was there' : '';
    st.classList.toggle('is-quiet', !data && !failed);
    $('away').hidden = !!data || !failed;
    $('cols').hidden = !data;
    for (const b of ['sideBtn', 'pasteBtn']) $(b).disabled = !data;
  }

  /* ---------- The phone's tabs ---------- */
  function renderTabs() {
    const wide = WIDE.matches;
    $('tabs').hidden = wide || !data;
    const open = data ? data.gaps.filter((g) => g.state !== 'closed').length : 0;
    $('tabRolesN').textContent = data && data.roles.length ? String(active().length) : '';
    $('tabGapsN').textContent = open ? String(open) : '';
    for (const [id, t, h] of [['roles', 'tabRoles', 'rolesH'], ['gaps', 'tabGaps', 'gapsH']]) {
      const panel = $(id), on = tab === id;
      $(t).setAttribute('aria-selected', String(on));
      $(t).tabIndex = on ? 0 : -1;
      if (wide) { panel.removeAttribute('role'); panel.setAttribute('aria-labelledby', h); panel.hidden = false; }
      else { panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', t); panel.hidden = !on; }
    }
  }
  function setTab(t, focus) {
    tab = t;
    renderTabs();
    if (focus) $(t === 'roles' ? 'tabRoles' : 'tabGaps').focus();
  }

  /* ---------- Roles you track ---------- */
  function roleSub(r) {
    const when = r.deadline ? closes(r.deadline) : r.source === 'paste' && r.created ? 'pasted ' + shortDate(r.created) : '';
    return [r.org, cap(when)].filter(Boolean).join(SEP);
  }
  function roleRow(r) {
    const sub = roleSub(r);
    let state;
    if (r.state === 'reading') state = '<span class="rr-st">Claude is reading the vacancy</span>';
    else if (r.state === 'needs_text') state = '<span class="rr-st amber">Needs the job text</span>';
    else if (r.state === 'failed') state = '<span class="rr-st amber">Could not be read</span>';
    else state = fitHTML(r.counts) || '<span class="rr-st">Nothing listed</span>';
    return `<li><button type="button" class="rr${r.state === 'past' ? ' is-past' : ''}" data-role="${esc(r.id)}" aria-controls="detail"${isSel('role', r.id) ? ' aria-current="true"' : ''}>` +
      `<span class="rr-t">${esc(r.title)}</span>${sub ? `<span class="rr-s">${esc(sub)}</span>` : ''}${state}</button></li>`;
  }
  const EMPTY = 'No roles yet. Paste a job, or tap Track this role on an Apply task in To-do.';
  const emptyHTML = () => `<div class="d-empty"><p>${esc(EMPTY)}</p><button type="button" class="btn btn-go" data-open="paste">Paste a job</button></div>`;
  function renderRoles() {
    if (!data) return;
    const act = active(), past = data.roles.filter((r) => r.state === 'past');
    const head = `Roles you track · ${act.length}`;
    if ($('rolesH').textContent !== head) $('rolesH').textContent = head;
    let h = '';
    if (!data.roles.length) h = WIDE.matches ? '' : emptyHTML();
    else {
      h += act.length ? `<ul class="rlist">${act.map(roleRow).join('')}</ul>` : '<p class="none">Nothing active. The roles in Past are below.</p>';
      if (past.length) {
        h += `<button type="button" id="pastTog" class="grp-tog" aria-expanded="${pastOpen}" aria-controls="pastList">Past · ${past.length}</button>` +
          `<ul id="pastList" class="rlist"${pastOpen ? '' : ' hidden'}>${past.map(roleRow).join('')}</ul>`;
      }
    }
    setHTML($('rolesBody'), h);
  }

  /* ---------- Gaps across roles ---------- */
  function gapRow(g, n) {
    const M = g.active || active().length;
    const N = g.total || g.roles.length;
    let sub;
    if (g.state === 'closed') sub = `Closed${g.closedAt ? ' ' + shortDate(g.closedAt) : ''}${g.closedNote ? `${SEP}“${g.closedNote.length > 90 ? g.closedNote.slice(0, 88) + '…' : g.closedNote}”` : ''}`;
    else {
      sub = `In ${N} of ${plural(M, 'role', 'roles')}`;
      if (g.steps.length) sub += `${SEP}Plan: ${g.steps[0].text}${g.steps[0].taskId ? SEP + 'task in To-do' : ''}`;
      else if (g.state === 'working') sub += SEP + 'Working on it';
    }
    return `<li><button type="button" class="gr" data-gap="${esc(g.key)}" aria-controls="detail"${isSel('gap', g.key) ? ' aria-current="true"' : ''}>` +
      (n ? `<span class="gr-n">${n}</span>` : '') + `<span class="gr-l">${esc(g.label)}</span>${chip(g.state === 'closed' ? 'closed' : g.worst, true)}<span class="gr-s">${esc(sub)}</span></button></li>`;
  }
  function renderGaps() {
    if (!data) return;
    const open = data.gaps.filter((g) => g.state !== 'closed'), closed = data.gaps.filter((g) => g.state === 'closed');
    let h = '';
    if (open.length) h += `<ul class="glist">${open.map((g, i) => gapRow(g, i + 1)).join('')}</ul>`;
    else if (closed.length) h += '<p class="none">No open gaps.</p>';
    else if (!data.roles.length) h += '<p class="none">Gaps show here once you track a role.</p>';
    else if (sideEmpty()) h += '<div class="none"><p>Your side is empty, so there are no gaps to show yet.</p><button type="button" class="btn" data-open="side">Add your blocks</button></div>';
    else h += '<p class="none">No gaps in the roles read so far.</p>';
    if (closed.length) h += `<h3 class="gh">Closed · ${closed.length}</h3><ul class="glist glist-closed">${closed.map((g) => gapRow(g, 0)).join('')}</ul>`;
    $('gapsSub').hidden = !open.length;
    setHTML($('gapsBody'), h);
  }

  /* ---------- The open role ---------- */
  function reqHTML(r, q) {
    let ev;
    if (q.status === 'have' || q.status === 'partly') ev = `From your side: “${esc(q.line.text)}”` + (q.status === 'partly' && q.why ? `<span class="rq-why">${esc(q.why)}</span>` : '');
    else if (q.status === 'missing') { const n = others(r, q.key); ev = 'Not on your side' + (n ? `${SEP}also in ${plural(n, 'other role', 'other roles')}` : ''); }
    else ev = sideEmpty() ? 'Add your side to check this' : 'Not checked against your side yet';
    return `<li class="rq"><span class="rq-l">${esc(q.label)}${q.must ? '' : ' <span class="nice">· nice to have</span>'}</span>${chip(q.status)}<span class="rq-e">${ev}</span></li>`;
  }
  function countWords(n) { return `${n} ${n === 1 ? 'character' : 'characters'}` + (n < MIN_TEXT ? ` · at least ${MIN_TEXT}` : ''); }
  function roleHTML(r) {
    const parts = [r.org, r.deadline ? closes(r.deadline) : '', r.source === 'digest' ? 'from Defence digest' : 'pasted' + (r.created ? ' ' + shortDate(r.created) : '')].filter(Boolean);
    const sub = parts.map((p, i) => esc(i ? p : cap(p)));
    if (r.link) sub.push(`<a href="${esc(r.link)}" target="_blank" rel="noopener noreferrer">vacancy ›</a>`);
    const reading = r.state === 'reading', past = r.state === 'past';
    const menu = `<div class="menu-wrap"><button type="button" id="menuBtn" class="x menu-btn" aria-label="More for this role" aria-expanded="${menuOpen}" aria-controls="roleMenu">⋯</button>` +
      `<div id="roleMenu" class="menu"${menuOpen ? '' : ' hidden'}><button type="button" data-act="recheck"${reading ? ' disabled' : ''}>Check again</button>` +
      `<button type="button" data-act="${past ? 'active' : 'past'}">${past ? 'Back to active' : 'Move to past'}</button>` +
      '<button type="button" class="m-red" data-act="remove">Remove</button></div></div>';
    const fit = r.state === 'ready' || past ? fitHTML(r.counts) : '';
    let h = `<div class="d-head${fit ? '' : ' d-head-gap'}"><div class="d-who"><h2 id="detailH" tabindex="-1">${esc(r.title)}</h2>${sub.length ? `<p class="d-sub">${sub.join(SEP)}</p>` : ''}</div>` +
      `${fit}${menu}</div>`;
    if (rmAsk) {
      h += `<div class="rm" role="group" aria-label="Remove this role"><p>Remove ${esc(r.title)}? What it asks for goes too, and it leaves your gaps.</p>` +
        '<div class="rm-acts"><button type="button" class="btn btn-red" data-act="rm-go">Remove</button><button type="button" class="btn" data-act="rm-keep">Keep</button></div></div>';
    }
    if (detailErr) h += `<p class="err" role="alert">${esc(detailErr)}</p>`;
    if (reading) {
      h += `<div class="box"><div class="reading"><span class="pulse" aria-hidden="true"></span><span class="box-t">Claude is reading the vacancy</span></div>` +
        (slow ? '<p class="box-s">Still reading after 3 minutes. This page stopped looking; it looks again when you come back to it.</p><div class="box-acts"><button type="button" class="btn" data-act="look">Look now</button></div>'
          : '<p class="box-s">This page looks again every 5 seconds.</p>') + '</div>';
    } else if (r.state === 'needs_text') {
      const t = drafts.text[r.id] || '';
      h += '<div class="box box-amber"><p class="box-t">The page could not be read. Paste the text.</p>' +
        (r.link ? `<p class="box-s">Open the <a href="${esc(r.link)}" target="_blank" rel="noopener noreferrer">vacancy</a>, copy all of its text and paste it here.</p>` : '') +
        `<div class="fld"><label for="rtText">The job text</label><textarea id="rtText" class="in ta ta-job" maxlength="60000" data-draft="text" aria-describedby="rtCount">${esc(t)}</textarea>` +
        `<span id="rtCount" class="count${t.trim().length && t.trim().length < MIN_TEXT ? ' is-short' : ''}">${esc(countWords(t.trim().length))}</span></div>` +
        '<div class="box-acts"><button type="button" class="btn btn-go" data-act="text">Read this text</button></div></div>';
    } else if (r.state === 'failed') {
      h += `<div class="box box-red"><p class="box-t">Claude could not read this role.</p>${r.error ? `<p class="box-s">${esc(r.error)}</p>` : ''}` +
        '<div class="box-acts"><button type="button" class="btn" data-act="recheck">Try again</button></div></div>';
    } else if (past) {
      h += '<div class="box"><p class="box-s">This role is in Past.</p><div class="box-acts"><button type="button" class="btn" data-act="active">Back to active</button></div></div>';
    }
    if (r.reqs.length && sideEmpty() && r.reqs.some((q) => q.status === 'unknown')) {
      h += '<div class="side-note"><span>Your side is empty, so nothing here is checked yet.</span><button type="button" class="btn btn-s" data-open="side">Add your blocks</button></div>';
    }
    if (r.reqs.length) {
      let g = '';
      for (const k of KINDS) {
        const list = r.reqs.filter((q) => q.kind === k);
        if (list.length) g += `<h3 class="kind-h">${KIND_NAME[k]}</h3><ul class="rqs">${list.map((q) => reqHTML(r, q)).join('')}</ul>`;
      }
      h += past ? `<div class="reqs-past">${g}</div>` : g;
    } else if (r.state === 'ready' || past) h += '<p class="box-s" style="margin-top:14px">Claude found no requirements in this vacancy.</p>';
    return h;
  }

  /* ---------- The open gap ---------- */
  function stepHTML(s) {
    return `<li class="step"><span class="step-t">${esc(s.text)}${s.source === 'claude' ? ' <span class="step-src">· from Claude</span>' : ''}</span>` +
      (s.taskId ? `<a class="step-task" href="${esc(TODO)}" data-task-of="${esc(s.id)}">Task in To-do</a>` : `<button type="button" class="btn btn-s" data-step-task="${esc(s.id)}">Make a task</button>`) +
      `<button type="button" class="x" data-step-del="${esc(s.id)}" aria-label="${esc('Remove the step ' + s.text)}">×</button></li>`;
  }
  function gapHTML(g) {
    const closed = g.state === 'closed';
    const roles = g.roles.map((id) => data.roleById.get(id)).filter(Boolean);
    const M = g.active || active().length, N = g.total || roles.length;
    const sub = closed ? `Closed${g.closedAt ? ' ' + shortDate(g.closedAt) : ''}`
      : `In ${N} of ${plural(M, 'role', 'roles')}` + (g.must ? `${SEP}a must-have in ${g.must}` : SEP + 'nice to have in each');
    let h = `<div class="d-head d-head-gap"><div class="d-who"><h2 id="detailH" tabindex="-1">${esc(g.label)}</h2><p class="d-sub">${esc(sub)}</p></div>${chip(closed ? 'closed' : g.worst)}</div>`;
    if (detailErr) h += `<p class="err" role="alert">${esc(detailErr)}</p>`;
    if (closed) {
      h += `<div class="box closed-box"><p class="box-t">You closed this gap${g.closedAt ? ' on ' + shortDate(g.closedAt) : ''}</p>` +
        (g.closedNote ? `<p class="note">In your words: “${esc(g.closedNote)}”</p>` : '') +
        '<div class="box-acts"><button type="button" class="btn" data-act="reopen">Reopen</button></div></div>';
    }
    if (roles.length) {
      h += `<h3 class="d-h">${closed ? 'Asked for in' : 'Needed in'} ${plural(roles.length, 'role', 'roles')}</h3><ul class="g-roles">` + roles.map((r) => {
        const q = r.reqs.find((x) => x.key === g.key);
        const s2 = [r.org, q && !q.must ? 'nice to have' : '', r.state === 'past' ? 'in Past' : ''].filter(Boolean).join(SEP);
        return `<li><button type="button" class="grole" data-role="${esc(r.id)}"><span class="grole-t">${esc(r.title)}</span>${s2 ? `<span class="grole-s">${esc(s2)}</span>` : ''}${q ? chip(q.status, true) : ''}</button></li>`;
      }).join('') + '</ul>';
    }
    if (closed) {
      if (g.steps.length) h += `<h3 class="d-h">Your plan</h3><ul class="steps">${g.steps.map((s) => `<li class="step"><span class="step-t">${esc(s.text)}</span>${s.taskId ? `<a class="step-task" href="${esc(TODO)}">Task in To-do</a>` : ''}</li>`).join('')}</ul>`;
      return h;
    }
    h += '<h3 class="d-h">Your plan</h3>';
    h += g.steps.length ? `<ul class="steps">${g.steps.map(stepHTML).join('')}</ul>` : '<p class="steps-none">No steps yet. Write one, or ask Claude for options.</p>';
    h += `<form class="step-add" data-form="step" novalidate><label for="stepIn" class="sr">A step for ${esc(g.label)}</label>` +
      `<input id="stepIn" class="in" maxlength="200" autocomplete="off" placeholder="Write a step" data-draft="step" value="${esc(drafts.step[g.key] || '')}">` +
      '<button type="submit" class="btn">Add</button></form>';
    const wait = thinking.has(g.key);
    if (wait || g.options) {
      h += '<h3 class="d-h">Options from Claude</h3>';
      if (wait) h += '<div class="thinking" role="status" tabindex="-1"><span class="pulse" aria-hidden="true"></span><span>Claude is looking for options. It can take up to 30 seconds.</span></div>';
      else if (g.options.length) {
        h += '<div class="opts">' + g.options.map((o, i) => {
          const used = g.steps.some((s) => s.text.toLowerCase() === o.title.toLowerCase());
          return `<div class="opt"><span class="opt-t">${esc(o.title)}</span>${o.text ? `<span class="opt-x">${esc(o.text)}</span>` : ''}` +
            (used ? '<span class="opt-used">In your plan</span>' : `<button type="button" class="btn btn-s" data-use="${i}" aria-label="${esc('Use as a step: ' + o.title)}">Use as a step</button>`) + '</div>';
        }).join('') + '</div>';
      } else h += '<p class="steps-none">Claude had no options this time.</p>';
    }
    h += `<div class="g-acts"><button type="button" class="btn" data-act="options"${wait ? ' disabled' : ''}>${g.options && g.options.length ? 'Ask for new options' : 'Ask for options'}</button>` +
      '<button type="button" class="btn btn-go" data-act="close">I have this now</button></div>';
    return h;
  }

  /* ---------- The middle column (PC) or the full screen (phone) ---------- */
  function backHTML() {
    const prev = stack[stack.length - 1];
    let words = sel.kind === 'gap' ? 'Gaps' : 'Roles';
    if (prev) words = prev.kind === 'gap' ? data.gapByKey.get(prev.id).label : data.roleById.get(prev.id).title;
    return `<button type="button" class="d-back" data-act="back"><span aria-hidden="true">‹&nbsp;</span>${esc(words)}</button>`;
  }
  function renderDetail() {
    const box = $('detail');
    if (!data) { box.hidden = true; return; }
    const wide = WIDE.matches, full = !wide && !!sel;
    box.hidden = !wide && !sel;
    box.classList.toggle('is-full', full);
    for (const id of ['top', 'tabs', 'roles', 'gaps']) $(id).inert = full;
    document.documentElement.style.overflow = full ? 'hidden' : '';
    let h = '';
    if (!sel) h = wide ? emptyHTML() : '';
    else if (sel.kind === 'role') h = roleHTML(data.roleById.get(sel.id));
    else h = gapHTML(data.gapByKey.get(sel.id));
    if (full) h = backHTML() + h;
    setHTML($('detailBody'), h);
  }

  function renderAll() {
    ensureSel();
    renderHead();
    renderTabs();
    renderRoles();
    renderGaps();
    renderDetail();
  }

  /* Keep the focus (and the caret) on the same thing when a part of the page is drawn again. */
  function keepFocus() {
    const a = document.activeElement;
    if (!a || a === document.body || !a.closest) return null;
    let q = null;
    if (a.id) q = '#' + CSS.escape(a.id);
    else if (a.dataset.role) q = `${a.closest('#detail') ? '#detail' : '#roles'} [data-role="${CSS.escape(a.dataset.role)}"]`;
    else if (a.dataset.gap) q = `#gaps [data-gap="${CSS.escape(a.dataset.gap)}"]`;
    else if (a.dataset.act) q = `#detail [data-act="${a.dataset.act}"]`;
    else if (a.dataset.stepTask) q = `[data-step-task="${CSS.escape(a.dataset.stepTask)}"]`;
    else if (a.dataset.stepDel) q = `[data-step-del="${CSS.escape(a.dataset.stepDel)}"]`;
    else if (a.dataset.use) q = `[data-use="${a.dataset.use}"]`;
    else if (a.dataset.open) q = `#app [data-open="${a.dataset.open}"]`;
    if (!q) return null;
    const caret = typeof a.selectionStart === 'number' ? [a.selectionStart, a.selectionEnd] : null;
    return { q, caret };
  }
  function restoreFocus(f) {
    if (!f) return;
    const a = document.activeElement;
    if (a && a !== document.body && document.contains(a)) return;
    const el = document.querySelector(f.q);
    if (!el || el.closest('[hidden]') || el.closest('[inert]')) return;
    el.focus({ preventScroll: true });
    if (f.caret && el.setSelectionRange) { try { el.setSelectionRange(f.caret[0], f.caret[1]); } catch (e) { /* not a text field */ } }
  }
  function setHTML(el, h) {
    if (el._h === h) return;
    const f = keepFocus();
    el.innerHTML = h;
    el._h = h;
    restoreFocus(f);
  }
  function focusEl(q) {
    const el = typeof q === 'string' ? document.querySelector(q) : q;
    if (!el || !document.contains(el) || el.closest('[hidden]') || el.closest('[inert]')) return;
    el.focus({ preventScroll: true });
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) el.scrollIntoView({ block: 'nearest' });
  }
  function describe(el) {
    if (!el) return null;
    if (el.id) return '#' + CSS.escape(el.id);
    if (el.dataset.role) return `#roles [data-role="${CSS.escape(el.dataset.role)}"]`;
    if (el.dataset.gap) return `#gaps [data-gap="${CSS.escape(el.dataset.gap)}"]`;
    if (el.dataset.stepTask) return `[data-step-task="${CSS.escape(el.dataset.stepTask)}"]`;
    if (el.dataset.act) return `#detail [data-act="${el.dataset.act}"]`;
    if (el.dataset.open) return `#app [data-open="${el.dataset.open}"]`;
    return null;
  }

  /* ---------- Opening and closing a role or a gap ---------- */
  function select(kind, id, { from = null, focus = true, push = false } = {}) {
    if (!data || !valid({ kind, id })) return;
    const wide = WIDE.matches;
    if (!wide && sel && push) stack.push(sel);
    else if (!wide && !sel) { stack = []; opener = from ? describe(from) : null; }
    else if (wide) stack = [];
    if (!isSel(kind, id)) { menuOpen = rmAsk = false; detailErr = ''; }
    sel = { kind, id };
    implicit = false;
    if (kind === 'role' && data.roleById.get(id).state === 'past') pastOpen = true;
    if (!wide && !push && !stack.length) tab = kind === 'gap' ? 'gaps' : 'roles';
    renderAll();
    $('detail').scrollTop = 0;
    if (focus) focusEl('#detailH');
    setUrl();
  }
  function goBack() {
    if (!sel) return;
    menuOpen = rmAsk = false;
    detailErr = '';
    if (stack.length) {
      sel = stack.pop();
      renderAll();
      $('detail').scrollTop = 0;
      focusEl('#detailH');
      setUrl();
      return;
    }
    const was = sel;
    sel = null;
    renderAll();
    setUrl();
    const row = was.kind === 'role' ? `#roles [data-role="${CSS.escape(was.id)}"]` : `#gaps [data-gap="${CSS.escape(was.id)}"]`;
    focusEl(document.querySelector(opener || row) ? opener || row : row);
    if (document.activeElement === document.body || !document.activeElement) focusEl(tab === 'gaps' ? '#tabGaps' : '#tabRoles');
  }
  function setUrl() {
    try {
      const u = new URL(location.href);
      u.searchParams.delete('r');
      u.searchParams.delete('g');
      if (sel && !implicit) u.searchParams.set(sel.kind === 'role' ? 'r' : 'g', sel.id);
      history.replaceState(null, '', u);
    } catch (e) { /* not allowed here */ }
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
  let inflight = null, lastRead = -1e9, first = true, again = false;
  let pollT = 0, pollSince = 0, slow = false;
  function load() {
    if (inflight) { again = true; return inflight; }
    clearTimeout(pollT);
    pollT = 0;
    inflight = (async () => {
      let fresh = null;
      try {
        const r = await fetch(BASE, { cache: 'no-store' });
        if (!r.ok) throw new Error('status ' + r.status);
        fresh = clean(await r.json());
      } catch (e) { /* the hub is away or said no */ }
      lastRead = performance.now();
      // Something changed while this read was on its way (a POST): its answer may be older, so read again.
      if (again) { again = false; inflight = null; return load(); }
      inflight = null;
      if (fresh) { data = fresh; failed = false; } else failed = true;
      let open = false;
      if (first && data) {
        first = false;
        const r = params.get('r'), g = params.get('g');
        if (r) {
          if (data.roleById.has(r)) { sel = { kind: 'role', id: r }; implicit = false; tab = 'roles'; if (data.roleById.get(r).state === 'past') pastOpen = true; open = true; }
          else { toast('That role is not tracked any more.'); setUrl(); }
        } else if (g) {
          if (data.gapByKey.has(g)) { sel = { kind: 'gap', id: g }; implicit = false; tab = 'gaps'; open = true; }
          else { toast('That gap is not there any more.'); setUrl(); }
        }
      }
      renderAll();
      if (open) focusEl('#detailH');
      schedulePoll();
    })();
    return inflight;
  }
  // While Claude reads a role: every 5 s, for 3 minutes at most; a new reading starts the 3 minutes again.
  function schedulePoll() {
    clearTimeout(pollT);
    pollT = 0;
    const reading = !!data && data.roles.some((r) => r.state === 'reading');
    if (!reading) { pollSince = 0; if (slow) { slow = false; renderDetail(); } return; }
    if (document.hidden) return;
    const now = performance.now();
    if (!pollSince) pollSince = now;
    if (now - pollSince >= POLL_FOR) { if (!slow) { slow = true; renderDetail(); } return; }
    pollT = setTimeout(() => { pollT = 0; load(); }, POLL_MS);
  }
  function freshPoll() { pollSince = 0; slow = false; }
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
      if (/read/i.test(h)) return 'Claude is still reading this role.';
      if (/task/i.test(h)) return 'That step is already a task in To-do.';
      if (/closed/i.test(h)) return 'That gap is already closed.';
      if (/open/i.test(h)) return 'That gap is already open.';
      if (/link|already tracked|exists/i.test(h)) return 'You already track that role.';
      return 'That is already done.';
    }
    if (e.status === 404) return 'That is not on the hub any more.';
    if (e.status === 413) return 'That is too long for the hub.';
    if (e.status === 400) {
      if (/^title/.test(h)) return 'Give the job a title.';
      if (/^text/.test(h)) return `Paste the whole job text: at least ${MIN_TEXT} characters.`;
      if (/^link/.test(h)) return 'The link has to start with https://';
      if (/^note/.test(h)) return 'Say how, in your words.';
      if (/^section|^energy/.test(h)) return 'Pick where it goes and the energy.';
      return 'The hub did not take that' + (h ? ': ' + h : '.');
    }
    if (e.status === 503) return 'The hub cannot ask Claude right now. Try again later.';
    return 'Something went wrong on the hub. Nothing changed.';
  }

  /* ---------- A role's actions ---------- */
  async function roleAct(r, path, body, { done = '', focus = '#menuBtn' } = {}) {
    if (busy) return;
    busy = true;
    detailErr = '';
    menuOpen = false;
    renderDetail();
    try {
      const out = await call(`/role/${enc(r.id)}${path}`, body);
      const n = putRole(out.role);
      if (n && n.state === 'reading') freshPoll();
      if (n && n.state === 'past' && isSel('role', n.id)) pastOpen = true;
      if (done) toast(done);
    } catch (err) {
      detailErr = words(err);
    }
    busy = false;
    renderAll();
    focusEl(document.querySelector(focus) ? focus : '#detailH');
    load();
  }
  async function removeRole(r) {
    if (busy) return;
    busy = true;
    detailErr = '';
    try {
      await call(`/role/${enc(r.id)}/delete`, {});
      data.roles = data.roles.filter((x) => x.id !== r.id);
      index(data);
      rmAsk = menuOpen = false;
      stack = [];
      sel = null;
      implicit = false;
      setUrl();
      toast(`${r.title} is no longer tracked.`);
      busy = false;
      renderAll();
      focusEl(WIDE.matches ? (sel ? '#detailH' : '#pasteBtn') : '#tabRoles');
      load();
      return;
    } catch (err) {
      detailErr = words(err);
    }
    busy = false;
    renderAll();
    focusEl('#detail [data-act="rm-go"]');
  }
  async function sendText(r) {
    const t = (drafts.text[r.id] || '').trim();
    const ta = $('rtText');
    if (t.length < MIN_TEXT) {
      detailErr = `Paste the whole job text: at least ${MIN_TEXT} characters. This is ${t.length}.`;
      renderDetail();
      if ($('rtText')) { $('rtText').setAttribute('aria-invalid', 'true'); $('rtText').focus(); }
      return;
    }
    if (ta) ta.removeAttribute('aria-invalid');
    if (busy) return;
    busy = true;
    detailErr = '';
    try {
      const out = await call(`/role/${enc(r.id)}/text`, { text: t });
      putRole(out.role);
      drafts.text[r.id] = '';
      freshPoll();
      toast('Claude is reading the vacancy.');
    } catch (err) {
      detailErr = words(err);
    }
    busy = false;
    renderAll();
    focusEl($('rtText') && detailErr ? '#rtText' : '#detailH');
    load();
  }

  /* ---------- A gap's actions ---------- */
  async function gapAct(g, path, body, { focus = null, done = '', after = null } = {}) {
    if (busy) return null;
    busy = true;
    detailErr = '';
    let out = null;
    try {
      out = await call(`/gap/${enc(g.key)}${path}`, body);
      putGap(out.gap);
      if (after) after(out);
      if (done) toast(done);
    } catch (err) {
      detailErr = words(err);
      out = null;
    }
    busy = false;
    renderAll();
    if (focus) focusEl(document.querySelector(focus) ? focus : '#detailH');
    return out;
  }
  // A step Paul wrote (the box empties once it is saved) or one of Claude's options (the box keeps what is in it).
  async function addStep(g, text, focus, typed = true) {
    const t = str(text, 200);
    if (!t) { focusEl('#stepIn'); return; }
    await gapAct(g, '/step', { text: t }, { focus, after: () => { if (typed) drafts.step[g.key] = ''; } });
  }
  async function askOptions(g) {
    if (thinking.has(g.key)) return;
    thinking.add(g.key);
    detailErr = '';
    renderAll();
    focusEl('#detail .thinking');
    let err = '';
    try {
      const out = await call(`/gap/${enc(g.key)}/options`, {});
      putGap(out.gap);
    } catch (e) {
      err = words(e);
    }
    thinking.delete(g.key);
    if (isSel('gap', g.key)) detailErr = err;
    else if (err) toast(err);
    const was = document.activeElement;
    renderAll();
    if (isSel('gap', g.key) && (!was || was === document.body || was.dataset.act === 'options')) focusEl(document.querySelector('#detail [data-use]') ? '#detail [data-use]' : '#detail [data-act="options"]');
  }

  /* ---------- Dialogs: each gives the focus back to what opened it ---------- */
  const back = new Map();
  function openDlg(id, from, focus) {
    const d = $(id);
    back.set(id, from && from.isConnected ? describe(from) || from : null);
    if (!d.open) d.showModal();
    if (focus) { const el = typeof focus === 'string' ? d.querySelector(focus) : focus; if (el) el.focus(); }
  }
  for (const id of ['paste', 'side', 'task', 'close']) {
    const d = $(id);
    d.addEventListener('close', () => {
      const to = back.get(id);
      back.delete(id);
      setTimeout(() => focusEl(to || (sel ? '#detailH' : '#pasteBtn')), 0);
    });
    d.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) { e.preventDefault(); d.close(); return; }
      // A tap on the dimmed page around a sheet closes it (not around a form being filled).
      if (e.target === d && (id === 'task' || id === 'close')) {
        const r = d.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
      }
    });
  }
  const errLine = (id, w) => { $(id).textContent = w || ''; $(id).hidden = !w; };
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

  /* ---------- Paste a job ---------- */
  function pasteCount() {
    const n = $('pjText').value.trim().length;
    $('pjCount').textContent = countWords(n);
    $('pjCount').classList.toggle('is-short', n > 0 && n < MIN_TEXT);
  }
  function openPaste(from) {
    errLine('pasteErr', '');
    for (const id of ['pjTitle', 'pjLink', 'pjText']) $(id).removeAttribute('aria-invalid');
    pasteCount();
    $('pasteGo').disabled = false;
    openDlg('paste', from, '#pjTitle');
  }
  $('pjText').addEventListener('input', () => { pasteCount(); if ($('pjText').value.trim().length >= MIN_TEXT) $('pjText').removeAttribute('aria-invalid'); });
  $('pjTitle').addEventListener('input', () => { if ($('pjTitle').value.trim()) $('pjTitle').removeAttribute('aria-invalid'); });
  let pasting = false;
  function bad(id, w) { $(id).setAttribute('aria-invalid', 'true'); errLine('pasteErr', w); $(id).focus(); return false; }
  $('pasteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (pasting || !data) return;
    const title = str($('pjTitle').value, 200), org = str($('pjOrg').value, 200), link = $('pjLink').value.trim(), text = $('pjText').value.trim();
    for (const id of ['pjTitle', 'pjLink', 'pjText']) $(id).removeAttribute('aria-invalid');
    if (!title) return bad('pjTitle', 'Give the job a title.');
    if (link && !/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(link)) return bad('pjLink', 'The link has to be a web address that starts with https://');
    if (text.length < MIN_TEXT) return bad('pjText', `Paste the whole job text: at least ${MIN_TEXT} characters. This is ${text.length}.`);
    const body = { title, text };
    if (org) body.org = org;
    if (link) body.link = link;
    pasting = true;
    $('pasteGo').disabled = true;
    errLine('pasteErr', '');
    try {
      const out = await call('/role', body);
      const r = putRole(out.role);
      if (!r) throw Object.assign(new Error('shape'), { status: 500 });
      for (const id of ['pjTitle', 'pjOrg', 'pjLink', 'pjText']) $(id).value = '';
      pasteCount();
      freshPoll();
      back.set('paste', '#detailH');
      $('paste').close();
      select('role', r.id);
      toast('Claude is reading the vacancy.');
      load();
    } catch (err) {
      errLine('pasteErr', words(err));
    }
    pasting = false;
    $('pasteGo').disabled = false;
  });

  /* ---------- Your side ---------- */
  // The summary with Replace on top (the paste box opens under it, and is open while the side is empty),
  // then the lines from CV Studio; Gaps you closed beside them on the PC, under them on the phone.
  const sd = { lines: null, updated: '', failed: false, all: false, token: 0, busy: false, paste: false };
  const SIDE_SHOWN = 8;
  const sdEmpty = () => (sd.lines ? !sd.lines.length : sideEmpty());
  function openSide(from) {
    sd.all = false;
    sd.paste = false;
    errLine('sdErr', '');
    $('sdDone').hidden = true;
    renderSideDlg();
    openDlg('side', from, WIDE.matches ? (sdEmpty() ? '#sdText' : '#sdReplace') : null);
    loadSide();
  }
  function openPasteBox(on) {
    sd.paste = on;
    renderSideDlg();
    if (on) $('sdText').focus(); else focusEl('#sdReplace');
  }
  async function loadSide() {
    const token = ++sd.token;
    if (!sd.lines) sd.failed = false;
    renderSideDlg();
    try {
      const r = await fetch(BASE + '/side', { cache: 'no-store' });
      if (!r.ok) throw new Error('status ' + r.status);
      const d = await r.json();
      if (token !== sd.token) return;
      sd.lines = (Array.isArray(d && d.lines) ? d.lines : []).map(cleanLine).filter(Boolean);
      sd.updated = dayOf(d.updatedAt);
      sd.failed = false;
    } catch (e) {
      if (token !== sd.token) return;
      sd.failed = true;
    }
    renderSideDlg();
  }
  function renderSideDlg() {
    const cv = sd.lines ? sd.lines.filter((l) => l.source === 'cv') : [];
    const closed = sd.lines ? sd.lines.filter((l) => l.source === 'closed') : [];
    const now = $('sdNow'), empty = sdEmpty();
    $('sdBox').classList.toggle('is-empty', !!sd.lines && empty);
    if (!sd.lines) now.innerHTML = sd.failed ? '' : '<span>Loading…</span>';
    else if (empty) now.innerHTML = '<span>Your side is empty. Nothing is checked until you paste your CV Studio blocks.</span>';
    else now.innerHTML = `<b>${esc(plural(cv.length, 'line', 'lines'))} from CV Studio</b>${sd.updated ? `<span>updated ${esc(shortDate(sd.updated))}</span>` : ''}`;
    $('sdBox').hidden = !sd.lines && sd.failed;
    const open = empty || sd.paste;
    $('sdReplace').hidden = empty || (!sd.lines && sd.failed);
    $('sdReplace').setAttribute('aria-expanded', String(open));
    $('sdReplace').textContent = sd.paste ? 'Cancel' : 'Replace';
    $('sdPaste').hidden = !open;
    let h = '';
    if (!sd.lines && sd.failed) h = '<p class="err">Can’t reach the hub.</p><button type="button" id="sdRetry" class="btn sd-more">Retry</button>';
    else if (cv.length) {
      const shown = sd.all ? cv : cv.slice(0, SIDE_SHOWN);
      h = `<ul class="lines" tabindex="-1" aria-label="Lines from CV Studio">${shown.map((l) => `<li><span class="ln-t">${esc(l.text)}</span><span class="ln-s">CV Studio</span></li>`).join('')}</ul>`;
      if (cv.length > shown.length) h += `<button type="button" id="sdAll" class="btn sd-more">Show all ${cv.length}</button>`;
    }
    const f = keepFocus();
    $('sdLines').innerHTML = h;
    $('sdClosed').innerHTML = !sd.lines ? '' : closed.length
      ? `<ul class="lines">${closed.map((l) => {
        const g = l.gap && data && data.gapByKey.get(l.gap);
        return `<li><span class="ln-t">${g ? esc(g.label) + ' · ' : ''}“${esc(l.text)}”</span>${l.gap ? `<button type="button" class="link-btn" data-reopen="${esc(l.gap)}" aria-label="${esc('Reopen ' + (g ? g.label : 'this gap'))}">Reopen</button>` : ''}</li>`;
      }).join('')}</ul>`
      : '<p class="hint">None yet.</p>';
    restoreFocus(f);
  }
  $('sdReplace').addEventListener('click', () => openPasteBox(!sd.paste));
  $('sdFile').addEventListener('click', () => $('sdPick').click());
  $('sdPick').addEventListener('change', async () => {
    const f = $('sdPick').files && $('sdPick').files[0];
    $('sdPick').value = '';
    if (!f) return;
    if (f.size > 2e6) { errLine('sdErr', 'That file is too large for your blocks.'); return; }
    try { $('sdText').value = await f.text(); errLine('sdErr', ''); $('sdText').focus(); } catch (e) { errLine('sdErr', 'This browser could not read that file.'); }
  });
  $('sdGo').addEventListener('click', async () => {
    if (sd.busy) return;
    const text = $('sdText').value.trim();
    $('sdDone').hidden = true;
    if (!text) { errLine('sdErr', 'Paste your CV Studio blocks first.'); $('sdText').focus(); return; }
    if (/^[[{]/.test(text)) {
      try { JSON.parse(text); } catch (e) { errLine('sdErr', 'That looks like the JSON export, but not all of it. Copy the whole export and paste it again.'); $('sdText').focus(); return; }
    }
    sd.busy = true;
    $('sdGo').disabled = true;
    errLine('sdErr', '');
    try {
      const out = await call('/side', { text });
      const n = num(out.lines), m = num(out.rechecks);
      $('sdDone').textContent = `${plural(n, 'line', 'lines')} · ${m === 1 ? '1 role is' : m + ' roles are'} checked again`;
      $('sdDone').hidden = false;
      $('sdText').value = '';
      sd.paste = false;
      freshPoll();
      await loadSide();
      focusEl($('sdReplace').hidden ? '#sdText' : '#sdReplace');
      load();
    } catch (err) {
      errLine('sdErr', err.status === 400 ? 'The hub could not read those blocks. Paste them as CV Studio gives them, as text or as the JSON export.' : words(err));
    }
    sd.busy = false;
    $('sdGo').disabled = false;
  });
  $('side').addEventListener('click', async (e) => {
    if (e.target.closest('#sdAll')) { sd.all = true; renderSideDlg(); focusEl('#sdLines .lines'); return; }
    if (e.target.closest('#sdRetry')) { loadSide(); return; }
    const b = e.target.closest('[data-reopen]');
    if (!b || !data) return;
    const g = data.gapByKey.get(b.dataset.reopen) || { key: b.dataset.reopen, label: '' };
    b.disabled = true;
    try {
      const out = await call(`/gap/${enc(g.key)}/reopen`, {});
      putGap(out.gap);
      toast(`${g.label || 'The gap'} is open again.`);
      renderAll();
      await loadSide();
      load();
      focusEl('#sdClosedH');
    } catch (err) {
      b.disabled = false;
      errLine('sdErr', words(err));
    }
  });

  /* ---------- Make a task ---------- */
  const tk = { section: 'soon', energy: 'normal', key: null, step: null, busy: false };
  chipGroup($('task'), 'section', (v) => { tk.section = v; });
  chipGroup($('task'), 'energy', (v) => { tk.energy = v; });
  function openTask(g, s, from) {
    Object.assign(tk, { section: 'soon', energy: 'normal', key: g.key, step: s.id, busy: false });
    pickChips($('task'), 'section', 'soon');
    pickChips($('task'), 'energy', 'normal');
    $('taskText').textContent = s.text;
    errLine('taskErr', '');
    $('taskGo').disabled = false;
    openDlg('task', from, '#taskGo');
  }
  $('taskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (tk.busy) return;
    const g = data && data.gapByKey.get(tk.key);
    const s = g && g.steps.find((x) => x.id === tk.step);
    if (!s) { $('task').close(); return; }
    tk.busy = true;
    $('taskGo').disabled = true;
    errLine('taskErr', '');
    try {
      const out = await call(`/gap/${enc(g.key)}/step/${enc(s.id)}/task`, { section: tk.section, energy: tk.energy });
      putGap(out.gap);
      detailErr = '';
      renderAll();
      back.set('task', `[data-task-of="${CSS.escape(s.id)}"]`);
      $('task').close();
      toast(`${(out.task && str(out.task.text, 200)) || s.text} is in To-do · ${tk.section === 'today' ? 'Today' : 'Soon'}`);
    } catch (err) {
      errLine('taskErr', words(err));
    }
    tk.busy = false;
    $('taskGo').disabled = false;
  });

  /* ---------- I have this now ---------- */
  const cl = { key: null, busy: false, moving: 0 };
  function openClose(g, from) {
    cl.key = g.key;
    cl.busy = false;
    $('closeH').textContent = `I have this now: ${g.label}`;
    const moves = g.roles.map((id) => data.roleById.get(id)).filter((r) => r && r.state !== 'past').map((r) => [r, r.reqs.find((q) => q.key === g.key)])
      .filter(([, q]) => q && (q.status === 'missing' || q.status === 'partly'));
    cl.moving = moves.length;
    $('closeHint').textContent = moves.length
      ? 'This becomes a line on your side, next to your CV Studio blocks, and every role that asked for it moves:'
      : 'This becomes a line on your side, next to your CV Studio blocks.';
    $('closeMoves').innerHTML = moves.map(([r, q]) => `<li>${esc(r.title)}: ${chip(q.status, true)}<span class="arrow" aria-label="to">→</span>${chip('have', true)}</li>`).join('');
    $('closeNote').removeAttribute('aria-invalid');
    errLine('closeErr', '');
    $('closeGo').disabled = false;
    openDlg('close', from, '#closeNote');
  }
  $('closeNote').addEventListener('input', () => { if ($('closeNote').value.trim()) { $('closeNote').removeAttribute('aria-invalid'); errLine('closeErr', ''); } });
  $('closeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (cl.busy) return;
    const g = data && data.gapByKey.get(cl.key);
    if (!g) { $('close').close(); return; }
    const note = $('closeNote').value.replace(/\s+/g, ' ').trim().slice(0, 600);
    if (!note) {
      $('closeNote').setAttribute('aria-invalid', 'true');
      errLine('closeErr', 'Say how, in your words.');
      $('closeNote').focus();
      return;
    }
    cl.busy = true;
    $('closeGo').disabled = true;
    errLine('closeErr', '');
    try {
      const out = await call(`/gap/${enc(g.key)}/close`, { note });
      putGap(out.gap);
      $('closeNote').value = '';
      back.set('close', '#detailH');
      $('close').close();
      renderAll();
      toast(`${g.label} is closed.${cl.moving ? ` ${cl.moving === 1 ? '1 role moves' : cl.moving + ' roles move'} to Have.` : ''}`);
      load();
    } catch (err) {
      errLine('closeErr', words(err));
    }
    cl.busy = false;
    $('closeGo').disabled = false;
  });

  /* ---------- Wiring ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('dialog')) return;
    // Everything this click is about, found before any part of the page is drawn again.
    const role = t.closest('[data-role]'), gap = t.closest('[data-gap]'), act = t.closest('#detail [data-act]');
    const mk = t.closest('[data-step-task]'), del = t.closest('[data-step-del]'), use = t.closest('[data-use]');
    if (menuOpen && !t.closest('.menu-wrap')) {
      menuOpen = false;
      if (!role && !gap && !act && !mk && !del && !use) { renderDetail(); return; }
    }
    if (role) { select('role', role.dataset.role, { from: role, push: !!role.closest('#detail') }); return; }
    if (gap) { select('gap', gap.dataset.gap, { from: gap }); return; }
    if (t.closest('#menuBtn')) {
      menuOpen = !menuOpen;
      rmAsk = false;
      renderDetail();
      if (menuOpen) focusEl('#roleMenu button:not(:disabled)');
      return;
    }
    const cur = sel && data ? (sel.kind === 'role' ? data.roleById.get(sel.id) : data.gapByKey.get(sel.id)) : null;
    if (act) {
      const a = act.dataset.act;
      if (a === 'back') { goBack(); return; }
      if (!cur) return;
      if (sel.kind === 'role') {
        if (a === 'recheck') roleAct(cur, '/recheck', {}, { done: 'Claude is reading the vacancy again.', focus: '#detailH' });
        else if (a === 'past') roleAct(cur, '/past', { past: true }, { done: `${cur.title} is in Past.` });
        else if (a === 'active') roleAct(cur, '/past', { past: false }, { done: `${cur.title} is active again.`, focus: '#detailH' });
        else if (a === 'remove') { menuOpen = false; rmAsk = true; renderDetail(); focusEl('#detail [data-act="rm-keep"]'); }
        else if (a === 'rm-keep') { rmAsk = false; renderDetail(); focusEl('#menuBtn'); }
        else if (a === 'rm-go') removeRole(cur);
        else if (a === 'look') { freshPoll(); load(); }
        else if (a === 'text') sendText(cur);
      } else {
        if (a === 'options') askOptions(cur);
        else if (a === 'close') openClose(cur, act);
        else if (a === 'reopen') gapAct(cur, '/reopen', {}, { done: `${cur.label} is open again.`, focus: '#detailH', after: () => load() });
      }
      return;
    }
    if (mk && cur && sel.kind === 'gap') { const s = cur.steps.find((x) => x.id === mk.dataset.stepTask); if (s) openTask(cur, s, mk); return; }
    if (del && cur && sel.kind === 'gap') {
      const i = cur.steps.findIndex((x) => x.id === del.dataset.stepDel);
      const next = cur.steps[i + 1] || cur.steps[i - 1];
      gapAct(cur, `/step/${enc(del.dataset.stepDel)}/delete`, {}, { focus: next ? `[data-step-del="${CSS.escape(next.id)}"]` : '#stepIn' });
      return;
    }
    if (use && cur && sel.kind === 'gap' && cur.options) {
      const o = cur.options[+use.dataset.use];
      const i = +use.dataset.use, rest = [...document.querySelectorAll('#detail [data-use]')].map((b) => +b.dataset.use).filter((x) => x !== i);
      if (o) addStep(cur, o.title, rest.length ? `#detail [data-use="${rest.find((x) => x > i) ?? rest[rest.length - 1]}"]` : '#stepIn', false);
      return;
    }
    if (t.closest('#pastTog')) { pastOpen = !pastOpen; renderRoles(); return; }
    if (t.closest('#pasteBtn') || t.closest('[data-open="paste"]')) { if (data) openPaste(t.closest('button')); return; }
    if (t.closest('#sideBtn') || t.closest('[data-open="side"]')) { if (data) openSide(t.closest('button')); return; }
    if (t.closest('#tabRoles')) { setTab('roles'); return; }
    if (t.closest('#tabGaps')) { setTab('gaps'); return; }
    const retry = t.closest('#retry');
    if (retry) {
      retry.disabled = true;
      retry.textContent = 'Trying…';
      load().then(() => { const b = $('retry'); b.disabled = false; b.textContent = 'Retry'; if (!data) b.focus(); else focusEl(sel ? '#detailH' : '#pasteBtn'); });
    }
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('#detail [data-form="step"]');
    if (!f) return;
    e.preventDefault();
    const g = sel && sel.kind === 'gap' && data ? data.gapByKey.get(sel.id) : null;
    if (g) addStep(g, drafts.step[g.key] || '', '#stepIn');
  });
  $('detail').addEventListener('input', (e) => {
    const t = e.target;
    if (!sel) return;
    if (t.dataset.draft === 'step') drafts.step[sel.id] = t.value;
    if (t.dataset.draft === 'text') {
      drafts.text[sel.id] = t.value;
      const n = t.value.trim().length;
      $('rtCount').textContent = countWords(n);
      $('rtCount').classList.toggle('is-short', n > 0 && n < MIN_TEXT);
      if (n >= MIN_TEXT) t.removeAttribute('aria-invalid');
    }
  });
  $('tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    setTab(e.key === 'Home' ? 'roles' : e.key === 'End' ? 'gaps' : tab === 'roles' ? 'gaps' : 'roles', true);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    if (menuOpen) { e.preventDefault(); menuOpen = false; renderDetail(); focusEl('#menuBtn'); return; }
    if (rmAsk) { e.preventDefault(); rmAsk = false; renderDetail(); focusEl('#menuBtn'); return; }
    if (!WIDE.matches && sel) { e.preventDefault(); goBack(); }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearTimeout(pollT); pollT = 0; return; }
    freshPoll();
    load();
  });
  addEventListener('focus', () => { if (!document.hidden && performance.now() - lastRead > 2000) { freshPoll(); load(); } });
  let sized = 0, wasWide = WIDE.matches;
  addEventListener('resize', () => {
    if (sized) return;
    sized = requestAnimationFrame(() => {
      sized = 0;
      if (WIDE.matches === wasWide) return;
      wasWide = WIDE.matches;
      stack = [];
      renderAll();
    });
  });

  renderAll();
  load();
})();
