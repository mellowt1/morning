# Morning Screen: spec

One page Paul opens with coffee, on the iPhone home screen and on the laptop. Approved by Paul 23 Sept 2026, with extras added the same day (rain soon, Ecuador and Miami clocks, countdowns, bin day). Design approved the same day (canvas https://claude.ai/artifact/Jskv5Xc8m7vF3HUreYxCh7; Paul: the laptop reads like an actual debrief). Repo creation approved; rides at 08:00 and 17:30 confirmed.

## Day one, it must
1. **Show today at a glance:** the date, the bike weather verdict for the next commute, and today's open to-dos.
2. **Show what's coming:** calendar events for today and the next 6 days, archery nights included.
3. **Show Arsenal:** the next fixture and the last result.

## It must not
- Change anything. The to-dos are read only (tap the block to open the to-do app), and nothing is written back to Odysseus.
- Show money, medicine or anything else from Odysseus apart from calendar events.
- Send notifications, or ask for a login beyond the private link.
- Use paid APIs.

## Blocks
| Block | Source | Refresh | Notes |
|---|---|---|---|
| To-dos | paul-hub to-do list, Today section, open items | on open | Read only. Tap to open the to-do app. |
| Calendar | Odysseus sends the next 7 days of events to paul-hub every 15 min | on open | Title, time and place only; event notes never leave the Mac. If the last push is over 1 hour old, the block says "Calendar as of 07:40". |
| Archery | Worker secret `FIXED_EVENTS` (JSON), not in any repo: Groep A Mondays 20:00 to 22:00 until 26 Oct 2026; thema avonden 9 Nov, 23 Nov, 7 Dec 2026 | none | Merged into the calendar. Thema avond start times: not on file. |
| Bike weather | Open-Meteo (free, no key), The Hague | cached 15 min | Weekdays: the rides at 08:00 and 17:30 (confirmed). Rain chance and mm, wind and gusts with direction, temperature. One verdict line, e.g. "Dry, headwind home". On weekends it shows Monday's rides. |
| Arsenal | ESPN open data feed (unofficial, no key) | cached 1 hour | Next: opponent, competition, kickoff in Amsterdam time, home or away. Last: score and opponent. If ESPN changes its feed, the block says it can't load. |
| Rain soon | Open-Meteo 15-minute precipitation | cached 15 min | Inside the bike block: the next 2 hours as a strip, e.g. "Rain from 08:15 to 08:40". |
| Clocks | The page itself (America/Guayaquil, America/New_York) | live | Ecuador and Miami next to The Hague. |
| Countdowns | Worker secret `FIXED_EVENTS` (JSON) | none | "12 days to ...". Dates: not on file yet. |
| Bin day | Den Haag's collection calendar (free, if readable) for Paul's address | cached 12 hours | "Tomorrow: GFT". The address is a Worker secret (`BIN_ADDRESS`), never in the repo. If the source can't be read, the block is left out. |

German phrase: added once Project 5 exists.

## How it works
- **Page:** a static PWA on GitHub Pages at `mellowt1.github.io/morning/`, in a new public repo `mellowt1/morning` (code only). Repo created 23 Sept 2026.
- **Access:** the same private link and code as the to-do app. No new secret for Paul to keep.
- **Worker:** paul-hub gets a new module:
  - `GET /api/morning/:code` returns all blocks in one answer. Weather and Arsenal are cached in `HUB_KV`, which was reserved for this.
  - `POST /api/morning/calendar`, with a new `CALENDAR_PUSH_TOKEN`, is where Odysseus sends events. They are stored in `HUB_KV`.
- **Odysseus change (a PR for Paul's OK):**
  - Every 15 minutes on its existing ticker, it sends events from now to 7 days ahead: title, start, end, all-day and place.
  - Two new values go in the Mac's `.env.production`.
  - If the Worker is down, it sends again next time and nothing else changes.
  - This means event titles leave Tailscale and are stored in Cloudflare, behind the same code as the to-do list.
- **Offline:** the page and the last answer are cached, so the page opens without signal and shows "as of 07:52".

## Look
- Calm morning paper: light, a big date, quiet type, one colour per block.
- It turns dark between sunset and sunrise, using Open-Meteo's times for The Hague.
- On the phone, one column. On the laptop, two or three columns.
- English. No dashes as punctuation in any text.
- The design is made on a Claude Design canvas, and Paul approves it before the build starts.

## Open
- Thema avond start times.
- Countdown dates.
