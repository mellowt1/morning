# Morning

One page for the daily review. At the top a greeting ("Good morning · Monday"), the date as 28.09 with a gold sun for its full stop, and one sentence about the day (what is on now or next, and sunrise or sunset when it is close). Then numbered cards: 01 the one task to start with (tap it to open the to-do app), 02 Today as an overview (tiles for dinner, bins, birthdays, countdowns and yesterday's wins, then today's events and the to-dos), 03 projects grouped by status, 04 Coming up from tomorrow, then Arsenal with the club crest. The Hague's clock sits in the header with Miami and Ecuador beside it (under it on the phone), each naming its day when it is not ours. One column on the phone, two on a tablet. On the PC (1100 px and up, capped at 1320 px), which is where Paul reads it most: 01 and 02 on the left, Projects over Arsenal on the right, and under them 04 Week, a band of seven day columns, today first. Each day holds its events, bins, birthdays, countdowns and Arsenal's match (with the crest), so on the PC 02 Today drops what the band shows and keeps only what needs doing now (bins going out today or tonight, facts further off than a week). It turns dark between sunset and sunrise in The Hague, worked out on the device (`app/sun.js`), before the first paint. The look is "Swiss Cards" (Geist, white cards on #EEEDE9, green #3F7D5C), approved on 24 September 2026; the motion is "Alive" with "Light", approved on 27 September 2026.

**What moves, and only this:** the clock's changed digit rolls on the minute. The full stop climbs with the real sun and, while the sun is up, breathes warm light around the date (a phrase of three breaths, 15.9 s); in twilight it is a still ember; at night nothing glows. The next event today sends one ring from its dot every 8.1 s. The day's first open plays a one-second entrance, once per device per day. Rows that are new since the page was last hidden (or in the last 30 minutes on a screen left open) get a green tick; more than six marks none. With Reduce Motion on, all of it holds still.

**No personal data lives in this repo.** The page ships empty and loads everything from the `paul-hub` Worker using the code in the link, so the repo can be public.

## The link

```
https://mellowt1.github.io/morning/?c=<code>
```

The same code as the to-do app, so one code opens both. It is remembered after the first visit and put back in the address. If the to-do app has been opened in the same browser, the plain `/morning/` link works too. Without a code the page says so and shows nothing else.

## On the iPhone

Open the link in Safari, tap Share, then **Add to Home Screen**. It opens full screen like an app, with the sunrise icon. It works without signal: the last answer is kept on the phone and the footer says "As of 07:52. No connection, showing the last copy."

## How it updates

* **Data**: on opening, whenever it comes back to the screen, and every ten minutes while open. The page itself never changes anything: to-dos are read only ("Open to-do app" goes to the to-do app).
* **The page**: edit files in `app/`, commit, push. The Pages workflow names the offline cache after the commit, so phones pick up the new version on the next launch.

## Where the data comes from

Everything arrives in one answer from `GET /api/morning/:code` on `paul-hub` (the Worker lives in the `todo` repo, `worker/src/morning.js`; its README has the details).

| Block | Source | Fresh |
|---|---|---|
| Projects | one line per project (status and next step) plus a folded Parked list. Read only: Claude Code sets it with `POST /api/admin/morning/projects`. Hidden until the first push | every open |
| Sunrise and sunset | worked out on the device (`app/sun.js`); no request | always |
| Start with, to-dos | the to-do list, Today, open items; the first one is shown large as "Start with" | every open |
| Waiting on | the hub's `waiting` table (paul-hub `src/waiting.js`): a Chases due tile in Today, a card with the oldest five open items and Add (POST `/api/waiting/:code`), and on Sundays every open item with Answered and Snooze. Hidden until the hub sends the block | every open |
| Energy and its music | the hub's level (paul-hub `src/energy.js`, `GET/POST /api/energy/:code`), shared with To-do and Day: the dial is the fourth read-out on the PC and sits on top of Start with on the phone; with a level on, Start with holds the hub's pick for it. Each answer also carries `play`, the level's first Spotify playlist (paul-hub `src/soundtrack.js`): Play under the dial is a `spotify:playlist:` link, so on the PC the Spotify desktop app opens, and the tap also sends `POST /api/soundtrack/:code/played` (from `dial`, keepalive, never in the way of the link). Every Play (here and in "Music for this?") also asks the hub to really start the playlist through Spotify's Web API (`POST /api/spotify/:code/play` with the uri and `kind`: `phone` on an iPhone, iPad or Android, else `computer`; paul-hub `src/spotify.js`), fire and forget. No level, or no playlist for it: no Play. Playlists are set up in To-do only | every minute and on return |
| Dread meter | the hub's timer (paul-hub `src/dread.js`, `GET/POST /api/dread/:code`): Start on the energy pick starts it; while one runs (from Morning, To-do or Day) Start with holds that task with "Running since", How much do you dread it? (1 to 5), Skip and Stop. While the answer's `offer` is set, the foot of the strip asks "Music for this?" with the playlist (Play sends played from `offer` with the timer's `startedAt`) and Not now (`POST /api/soundtrack/:code/notnow`, the line goes at once). On Sundays the Week view has Biggest lies this week (`week.dread`) | every minute and on return |
| Oracle question | the hub's `oracle` table (paul-hub `src/oracle.js`): on Sundays from 06:00 one question about the week. Sunday's Week view has it on top (`week.oracle`) with Save answer and Not this week; other days one line under the header while it is open (`GET /api/oracle/:code`), with Answer. Past weeks (`oracle/`) lists every question with the answer, Put aside or Not answered yet | every minute and on return |
| Constellation | the hub's log (paul-hub `src/sky.js`, `GET /api/sky/:code`), read only: its own page (`constellation/`, "Constellation ›" in the head of Lately) draws the apps on the hub as stars on a night sky around the Hub, brighter for more events in the last 7 days, dim with an amber "Quiet 5 h" when quiet past its limit, and a line between two apps that told each other something. Tap a star or a line for what was sent and received. Live sends each new event as a small dot from the app that sent it to the apps that react; Last day and Last week replay the log in a minute, with a scrubber. With Reduce Motion nothing travels: the counts sit on the lines and a replay steps one event at a time. Only names, labels, counts and times reach the page | every 30 s while it is open and on return |
| Network | the hub's `people` and `ties` (paul-hub `src/network.js`, `GET /api/network/:code`): its own page (`network/`, "Network ›" in the head of Waiting on) draws the people Paul knows as a map by sector, Embassies, Ministries, Industry and NATO and EU as a 2 x 2 grid with Other as a band under it, a dashed arrow from who introduced to who was introduced and a line between people who work together. After 6 months without contact a person fades, with an amber "8 mo" or "No contact yet". A person opens a card (the right-hand panel on the PC, a sheet on the phone): Talked today, Reach out (a task in To-do that links back with `?p=<id>`), Sent a message (a Waiting on item), Edit with Remove. With nobody open the panel lists People to get back to, longest first. Add person, To sort (people off the map until they get a sector) and Import LinkedIn change the network through the same routes: Paul downloads Connections.csv himself, the page reads it and the hub keeps no email addresses; nothing talks to LinkedIn. Search and Fading only dim the rest; a zone that cannot hold everyone shows the most recent contact first and "+N more" | on opening and on return |
| Skills | the hub's skills gap tracker (paul-hub `src/skills.js`, `GET /api/skills/:code`): its own page (`skills/`, "Skills ›" in the head of Waiting on, beside Network ›). On the PC three columns: Roles you track (by closing date, Past folded under them), the open role or gap, and Gaps across roles (must-haves first, then the ones most roles ask for, closed ones last); on the phone Roles and Gaps are tabs and a role or a gap opens full screen. A role lists what it asks for by kind (Experience, Skills, Languages, Clearances, Qualifications), each Have ●, Partly ◐, Missing ○ or Not checked ◌, with the line from Paul's side it was matched to ("From your side: …"); a Have or Partly the hub sends without a line shows as Not checked, so the page never claims more about Paul than his own lines say. Roles come from Track this role on an Apply task in To-do or from Paste a job here (a title and at least 200 characters of the job text); while Claude reads one the page looks again every 5 s, for 3 minutes at most. Needs the text takes the pasted text, Could not be read has Try again, and the menu has Check again, Move to past and Remove. A gap shows the roles that ask for it, Your plan (a step can become a To-do task with Where and Energy), Ask for options (Claude, up to 30 s, Use as a step) and I have this now: Paul's own words become a line on his side and every role that asked for it moves to Have; Reopen takes the line away again. Your side lists the lines and takes what Paul copies from CV Studio, as text or as the JSON export; every role is then checked again. `?r=<id>` and `?g=<key>` open a role or a gap | on opening, on return, and every 5 s while a role is being read |
| Yesterday's wins | the to-do list, items finished yesterday, up to five names | every open |
| Coming up | Odysseus pushes the next 7 days of events every 15 minutes, merged with the fixed events | every open; "Calendar as of" when the last push is over an hour old |
| Countdowns and fixed events | Worker secret `FIXED_EVENTS` | every open |
| Birthdays | Worker secret `BIRTHDAYS`, the next 14 days | every open |
| Tonight | the Kitchen app: today's dinner, plus "Mix the dough today" in tomato 3 days before a pizza night (1 day for gluten free). Read inside the Worker with the kitchen's own code, which never reaches this page. Hidden when nothing is planned | every open |
| Bin day | Den Haag's huisvuilkalender for `BIN_ADDRESS` | 12 hours; left out if it can't be read |
| Arsenal | ESPN's open JSON, all competitions (unofficial). ESPN refuses Cloudflare, so when the Worker's block fails the page asks ESPN itself (`app/arsenal.js`, same parsing as the Worker) | 1 hour, kept on the phone; "can't load" if ESPN is out of reach |
| NOS | the top three headlines from the NOS news feed, each opens in a new tab | 30 minutes |

The bike weather block was taken off the page on 24 September 2026 (work is two minutes away); the Worker still answers `weather`, but the page no longer reads it. Each block fails on its own; the rest of the page still shows.

## Secrets

All in the Worker, none here: `TODO_CODE` (the code in the link), `CALENDAR_PUSH_TOKEN` (Odysseus), `FIXED_EVENTS` (archery nights and countdowns, one line of JSON), `BIN_ADDRESS` (postcode and house number) and `BIRTHDAYS` (one line of JSON, `[{"name":"Nick","date":"10-12"}]`, or `"1986-10-12"` to show the age they turn). The private values sit in the gitignored `secrets.local.txt` files. Upload them with `npx wrangler secret bulk` from a temp JSON file, as the todo README shows; piping into `wrangler secret put` stores an empty secret on Windows.

## Going live (once)

```powershell
git push -u origin main
gh api -X POST repos/mellowt1/morning/pages -f build_type=workflow
gh workflow run pages.yml -R mellowt1/morning
```

Then deploy the Worker from the todo repo (`cd worker; npx wrangler deploy`) with the three new secrets set.

## Local

```powershell
npm install
cd ..\todo\worker; npx wrangler dev --persist-to C:\wd   # Worker on :8787, dev values only
npm run serve                  # page on http://localhost:8080/morning/?c=<dev code>
npm run shots                  # phone and laptop, light and dark, into verify-shots/
npm run check-arsenal          # the page's own ESPN fallback, with the Worker mocked
npm run extras-shots           # Start with, wins, birthdays, NOS, with the Worker mocked
npm run tonight-shots          # the Tonight line from the kitchen, with the Worker mocked
npm run sky-check              # the Constellation page against a mocked /api/sky, PC and phone
npm run network-check          # the Network page against a mocked /api/network that keeps its own state, PC and phone
npm run skills-check           # the Skills page against a mocked /api/skills that keeps its own state, PC and phone
npm run soundtrack-check       # Play under the dial and "Music for this?" against a mocked hub, PC and phone
npm run icons                  # redraws app/icons/ from the sunrise mark
```

On localhost the page talks to `http://localhost:8787` and skips the service worker (add `&sw=1` to test it). Add `&api=https://...` to point it at another Worker.
