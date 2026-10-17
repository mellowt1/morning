// Hiscores: the page (skills tab, tooltip, chatbox, level-up dialogs that wait for a tap, the
// seen levels) and Morning's small card. Against a mocked Worker; every value is made up.
//   PORT=8095 npm run serve, then: APP=http://localhost:8095/morning/ npm run hiscores-check
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CODE = 'abcdefgh23456789';
const BASE = process.env.APP || 'http://localhost:8080/morning/';
const OUT = new URL('../verify-shots/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const file = (n) => fileURLToPath(new URL(n + '.png', OUT));
const NOW = '2026-10-17T20:30:00+02:00';

let failed = false;
const check = (ok, what) => { if (!ok) { failed = true; console.error('FAIL:', what); } else console.log('ok:', what); };

const LV = [0, 0, 83, 174, 276, 388, 512, 650, 801, 969, 1154];
const skill = (id, name, from, xp, level, today = 0) => ({ id, name, from, xp, level, at: 0, next: level < 99 ? xp + 500 : null, today });
const BOARD = {
  skills: [
    skill('ranged', 'Ranged', 'Archery evenings', 6600, 15),
    skill('cooking', 'Cooking', 'Kitchen dinners', 9900, 18, 800),
    skill('prayer', 'Prayer', 'Feeling faces', 8100, 17, 450),
    skill('crafting', 'Crafting', 'Desk actions', 450, 4),
    skill('magic', 'Magic', 'German calls', 0, 1),
    skill('woodcutting', 'Woodcutting', 'To-dos ticked', 11500, 20, 200),
    skill('slayer', 'Slayer', 'Applications', 4000, 13),
    skill('construction', 'Construction', 'Sunday resets', 0, 1),
  ],
  total: 89, totalXp: 40550, at: new Date(NOW).toISOString(),
  log: [
    { skill: 'woodcutting', xp: 100, at: '2026-10-17T18:10:00Z', what: 'Water the plants' },
    { skill: 'cooking', xp: 800, at: '2026-10-16T18:00:00Z', what: 'A stew' },
    { skill: 'prayer', xp: 450, at: '2026-10-16T19:00:00Z', what: 'A face in Feeling' },
    { skill: 'slayer', xp: 4000, at: '2026-10-15T09:00:00Z', what: 'Analyst (A ministry)' },
  ],
};

const browser = await chromium.launch();
async function open(path, viewport, { seen = null, morning = false } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: viewport.width < 700 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date(NOW));
  await page.addInitScript(([code, s, day]) => {
    try {
      localStorage.setItem('morning.code', JSON.stringify(code));
      localStorage.setItem('morning.enteredOn', JSON.stringify(day));
      if (s) localStorage.setItem('hiscores.seen.' + code, JSON.stringify(s));
    } catch (e) {}
  }, [CODE, seen, NOW.slice(0, 10)]);
  const h = { 'Access-Control-Allow-Origin': '*' };
  await page.route('**/api/hiscores/**', (r) => r.fulfill({ json: BOARD, headers: h }));
  await page.route('**/api/morning/**', (r) => r.fulfill({ headers: h, json: {
    now: new Date(NOW).toISOString(), todos: { items: [], updated: NOW, yesterday: { count: 0, items: [] } }, calendar: { events: [], sent: NOW, stale: false },
    fixed: { events: [], countdowns: [] }, weather: null, arsenal: null, bins: null, birthdays: { birthdays: [] }, news: { items: [] }, kitchen: null, projects: null, german: null, week: null,
    hiscores: { ...BOARD, log: BOARD.log.slice(0, 2) } } }));
  await page.route('**/site.**espn.com/**', (r) => r.abort());
  await page.route('**/*.mp3', (r) => r.fulfill({ status: 204 }));
  await page.goto(BASE + path);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  return { page, ctx, errors };
}
const shown = (page, sel) => page.$eval(sel, (e) => !e.hidden && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0).catch(() => false);

// A device that saw everything already: no dialog.
const all = Object.fromEntries(BOARD.skills.map((s) => [s.id, s.level]));
for (const [name, viewport] of [['hiscores-pc', { width: 1440, height: 1000 }], ['hiscores-phone', { width: 390, height: 844 }]]) {
  const { page, ctx, errors } = await open('hiscores/', viewport, { seen: all });
  check((await page.$$('#grid .slot')).length === 9, name + ': eight skills and the total');
  check((await page.textContent('#grid .total')).includes('89'), name + ': total level 89');
  check((await page.textContent('#sub')) === 'Total level 89 · 40,550 XP · +1,450 today', name + ': sub ' + await page.textContent('#sub'));
  check(!(await shown(page, '#levelup')), name + ': no dialog when nothing is new');
  const lines = await page.$$eval('#log p', (p) => p.map((x) => x.textContent));
  check(lines.length === 4 && lines[3].includes('You chop through: Water the plants. (+100 XP)'), name + ': newest line last ' + lines[3]);
  check(lines[0].includes('You complete a Slayer task: Analyst (A ministry).'), name + ': slayer line');
  await page.click('.slot[data-skill="woodcutting"]');
  const tip = await page.textContent('#tip');
  check(tip.includes('Woodcutting XP: 11,500') && tip.includes('Next level at: 12,000') && tip.includes('Remaining XP: 500') && tip.includes('From: To-dos ticked'), name + ': tooltip ' + tip);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ': no sideways scroll');
  check(await page.evaluate(() => getComputedStyle(document.querySelector('.lv')).fontFamily.includes('RS Small')), name + ': RuneScape font');
  check(await page.evaluate(() => [...document.querySelectorAll('#grid img')].every((i) => i.complete && i.naturalWidth > 0)), name + ': every icon loads');
  await page.screenshot({ path: file(name) });
  await page.click('h1');
  check(!(await shown(page, '#tip')), name + ': a tap elsewhere closes the tooltip');
  check(errors.length === 0, name + ': no page errors ' + errors.join('; '));
  await ctx.close();
}

// A new device: every skill above 1 levels up, one dialog at a time; the first tap is for the sound.
{
  const { page, ctx, errors } = await open('hiscores/', { width: 390, height: 844 }, { seen: { ...all, woodcutting: 18, cooking: 18 } });
  check(await shown(page, '#levelup'), 'level up: dialog shows');
  check(await page.textContent('#luHead') === 'Congratulations, you just advanced 2 Woodcutting levels.', 'level up: ' + await page.textContent('#luHead'));
  check(await page.textContent('#luBody') === 'Your Woodcutting level is now 20.', 'level up: body');
  check(await page.$eval('#levelup', (e) => e.classList.contains('wait')), 'level up: waits for a tap for sound');
  await page.screenshot({ path: file('hiscores-levelup') });
  await page.tap('#luNext');
  await page.waitForTimeout(200);
  check(await page.textContent('#luBody') === 'Your Woodcutting level is now 20.' && !(await page.$eval('#levelup', (e) => e.classList.contains('wait'))), 'level up: the first tap plays it, the dialog stays');
  check((await page.$$('#fx .px')).length > 0, 'level up: fireworks');
  await page.tap('#luNext');
  check(!(await shown(page, '#levelup')), 'level up: continue closes it (cooking was already seen)');
  const seen = await page.evaluate((c) => JSON.parse(localStorage.getItem('hiscores.seen.' + c)), CODE);
  check(seen.woodcutting === 20, 'level up: seen saved ' + JSON.stringify(seen));
  check((await page.$$eval('#log p.lvl', (p) => p.map((x) => x.textContent)))[0] === "Congratulations, you've just advanced your Woodcutting level. You are now level 20.", 'level up: chat line');
  check(errors.length === 0, 'level up: no page errors ' + errors.join('; '));
  await ctx.close();
}

// Morning's card.
{
  const { page, ctx, errors } = await open('?c=' + CODE, { width: 1440, height: 1000 }, { seen: { ...all, magic: 0, slayer: 10 } });
  check(await shown(page, '#hiscores'), 'morning: card shows');
  check((await page.$$('#hsGrid .hs-slot')).length === 9, 'morning: nine slots');
  check(await page.textContent('#hsNote') === 'Level up waiting: Slayer', 'morning: ' + await page.textContent('#hsNote'));
  check((await page.getAttribute('#hiscores', 'href')) === 'hiscores/?c=' + CODE, 'morning: opens the page');
  await page.locator('#hiscores').screenshot({ path: file('hiscores-morning-card') });
  check(errors.length === 0, 'morning: no page errors ' + errors.join('; '));
  await ctx.close();
}
await browser.close();
if (failed) process.exit(1);
console.log('all hiscores checks pass');
