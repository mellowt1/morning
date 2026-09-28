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
npm run icons                  # redraws app/icons/ from the sunrise mark
```

On localhost the page talks to `http://localhost:8787` and skips the service worker (add `&sw=1` to test it). Add `&api=https://...` to point it at another Worker.
