/* Arsenal straight from ESPN, for when the Worker cannot reach it.
 *
 * ESPN refuses requests from Cloudflare's servers but answers browsers, with
 * Access-Control-Allow-Origin: *. So when the Worker's arsenal block is an error, the page
 * asks ESPN itself. The parsing is the same as parseArsenal and arsenalBlock in
 * paul-hub's worker/src/morning.js (todo repo); keep the two in step.
 *
 * A plain script, no build step: it sets self.MorningArsenal = { load, parse, block }.
 * The parsed result is kept in localStorage for an hour, and served for up to a day
 * if ESPN cannot be reached.
 */
(function (root) {
  'use strict';

  const ARSENAL = '359';
  const PATH = '/apis/site/v2/sports/soccer/all/teams/359/schedule';
  // Same order as the Worker: site.web.api.espn.com first, site.api.espn.com as fallback.
  const HOSTS = ['https://site.web.api.espn.com', 'https://site.api.espn.com'];
  const KEY = 'morning.arsenal';
  const FRESH = 60 * 60 * 1000;
  const STALE = 24 * 60 * 60 * 1000;
  const MIN = 60 * 1000;

  const competitionName = (e) => {
    const n = (e.league && (e.league.shortName || e.league.abbreviation || e.league.name)) || '';
    return n.replace(/^(UEFA|English|FIFA)\s+/, '');
  };

  /* One ESPN event from Arsenal's side, or null if it does not parse. */
  function match(e) {
    const c = e && Array.isArray(e.competitions) && e.competitions[0];
    if (!c || !Array.isArray(c.competitors) || c.competitors.length !== 2) return null;
    const us = c.competitors.find((x) => x.team && String(x.team.id) === ARSENAL);
    const them = c.competitors.find((x) => x !== us);
    if (!us || !them || !them.team) return null;
    const kickoff = Date.parse(e.date);
    if (!Number.isFinite(kickoff)) return null;
    const score = (x) => {
      const v = x.score && typeof x.score === 'object' ? x.score.value : x.score;
      const n = Number(v);
      return v === undefined || v === null || v === '' || !Number.isFinite(n) ? null : n;
    };
    const shoot = (x) => (x.score && typeof x.score === 'object' && Number.isFinite(Number(x.score.shootoutScore)) ? Number(x.score.shootoutScore) : null);
    const type = (c.status && c.status.type) || {};
    return {
      opponent: them.team.shortDisplayName || them.team.displayName || 'Opponent',
      home: us.homeAway === 'home',
      competition: competitionName(e),
      kickoff: new Date(kickoff).toISOString(),
      state: type.state || (type.completed ? 'post' : 'pre'),
      completed: type.completed === true,
      us: score(us),
      them: score(them),
      usPens: shoot(us),
      themPens: shoot(them),
      won: us.winner === true,
      lost: them.winner === true,
    };
  }

  /* Last result and the next few fixtures, as the Worker caches them. */
  function parse(results, fixtures) {
    const done = (results && Array.isArray(results.events) ? results.events : [])
      .map(match)
      .filter((m) => m && m.completed && m.us !== null && m.them !== null)
      .sort((a, b) => Date.parse(b.kickoff) - Date.parse(a.kickoff));
    const upcoming = (fixtures && Array.isArray(fixtures.events) ? fixtures.events : [])
      .map(match)
      .filter((m) => m && !m.completed && m.state !== 'post')
      .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff))
      .slice(0, 6);
    if (!done.length && !upcoming.length) throw new Error('no matches');
    let last = null;
    if (done[0]) {
      const m = done[0];
      let result = m.us > m.them ? 'Won' : m.us < m.them ? 'Lost' : 'Drew';
      let pens = null;
      if (result === 'Drew' && m.usPens !== null && m.themPens !== null && m.usPens !== m.themPens) {
        result = m.usPens > m.themPens ? 'Won' : 'Lost';
        pens = m.usPens + ' to ' + m.themPens;
      } else if (result === 'Drew' && (m.won || m.lost)) {
        result = m.won ? 'Won' : 'Lost';
        pens = '';
      }
      last = { opponent: m.opponent, home: m.home, competition: m.competition, kickoff: m.kickoff, us: m.us, them: m.them, result, pens };
    }
    return {
      last,
      upcoming: upcoming.map((m) => ({ opponent: m.opponent, home: m.home, competition: m.competition, kickoff: m.kickoff })),
    };
  }

  /* The block the page shows, for the moment `now`: the same shape as the Worker's. */
  function block(data, now) {
    const m = data.upcoming.find((x) => Date.parse(x.kickoff) > now - 150 * MIN);
    const next = m ? Object.assign({}, m, { live: Date.parse(m.kickoff) <= now }) : null;
    return { next, last: data.last };
  }

  async function getJson(query) {
    let err;
    for (const host of HOSTS) {
      try {
        const r = await fetch(host + PATH + query, { cache: 'no-store' });
        if (!r.ok) throw new Error('status ' + r.status);
        return await r.json();
      } catch (e) {
        err = e;
      }
    }
    throw err;
  }

  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };
  const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* full or blocked */ } };

  /* The Arsenal block from the browser. Resolves to the block, or to { error } like the Worker. */
  async function load(now = Date.now()) {
    const hit = read();
    const age = hit && typeof hit.at === 'number' ? now - hit.at : Infinity;
    if (hit && hit.data && age >= 0 && age < FRESH) return block(hit.data, now);
    try {
      const [r, f] = await Promise.allSettled([getJson(''), getJson('?fixture=true')]);
      if (r.status === 'rejected' && f.status === 'rejected') throw new Error('espn down');
      const data = parse(r.value, f.value);
      write({ at: now, data });
      return block(data, now);
    } catch (e) {
      if (hit && hit.data && age >= 0 && age < STALE) return block(hit.data, now);
      return { error: "Arsenal can't load right now" };
    }
  }

  root.MorningArsenal = { load, parse, block };
})(typeof self !== 'undefined' ? self : globalThis);
