# Morning

One page for the first coffee: the date, the clocks in The Hague, Miami and Ecuador, the bike weather for the next rides, bin day and countdowns, today's to-dos, the week's calendar and Arsenal. On the phone it is one column, on the laptop it reads like a debrief in three. It turns dark between sunset and sunrise in The Hague.

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
| Rides, rain in the next 2 hours, sunrise and sunset | Open-Meteo, The Hague, no key | 15 minutes |
| To-dos | the to-do list, Today, open items | every open |
| Coming up | Odysseus pushes the next 7 days of events every 15 minutes, merged with the fixed events | every open; "Calendar as of" when the last push is over an hour old |
| Countdowns and fixed events | Worker secret `FIXED_EVENTS` | every open |
| Bin day | Den Haag's huisvuilkalender for `BIN_ADDRESS` | 12 hours; left out if it can't be read |
| Arsenal | ESPN's open JSON, all competitions (unofficial) | 1 hour; "can't load" if ESPN changes it |

Rides are at 08:00 and 17:30 on weekdays. After 17:30 and at the weekend the block shows the next weekday's rides ("Tomorrow's rides", "Monday's rides"). Each block fails on its own; the rest of the page still shows.

## Secrets

All in the Worker, none here: `TODO_CODE` (the code in the link), `CALENDAR_PUSH_TOKEN` (Odysseus), `FIXED_EVENTS` (archery nights and countdowns, one line of JSON) and `BIN_ADDRESS` (postcode and house number). The private values sit in the gitignored `secrets.local.txt` files. Upload them with `npx wrangler secret bulk` from a temp JSON file, as the todo README shows; piping into `wrangler secret put` stores an empty secret on Windows.

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
npm run icons                  # redraws app/icons/ from the sunrise mark
```

On localhost the page talks to `http://localhost:8787` and skips the service worker (add `&sw=1` to test it). Add `&api=https://...` to point it at another Worker.
