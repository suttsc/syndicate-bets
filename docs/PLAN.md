# Syndicate Bets — Plan

Live site: **https://bets.chrissutton.co.uk**

## Context
Chris, Jamie, Paul and Steve each back one team to win per **round** (a round can span several days). One of them is **The Guy** each round. The site shows live → final scores from a free, no-key API and tallies how many picks are **winning / drawing / losing**. Everyone sees the same data; picks are entered through a password-protected admin page. Previous rounds stay viewable forever, with a history list and an all-time leaderboard.

## Decisions
| Area | Choice | Why |
|---|---|---|
| Hosting | **Cloudflare Worker with static assets**, connected to `suttsc/syndicate-bets` (Workers Builds: auto-deploy on push to `main`) | Free; Cloudflare's recommended path (originally planned as Pages, switched when the dashboard created a Worker) |
| Domain | `bets.chrissutton.co.uk` as a Worker custom domain | Needs chrissutton.co.uk as a zone in the Cloudflare account |
| Frontend | Plain HTML + ES-module JS, **Tailwind v4** built by its CLI (`npm run build`) | No framework needed; proper production CSS |
| Backend | The same Worker: `src/server/index.js` routes `/api/*`; everything else is served from `public/` by asset handling | One deployable, no separate service |
| Database | **Cloudflare D1** (SQLite), binding `DB` | Free (5 GB, 5M reads/day, 100k writes/day); keeps every round. Replaces the earlier KV idea, which could only hold the current round |
| Scores | **ESPN public API**, called server-side with ~30 s edge cache | Free, no key, covers all needed leagues; unofficial, so isolated in one module |
| Admin auth | `ADMIN_PASSWORD` secret, sent as `Authorization: Bearer …`, constant-time compare | Simple, nothing exposed to visitors |
| Design | Mobile-first, **dark by default with a light mode** (toggle top right, remembered per device; colours are theme tokens in `src/app.css`): near-black canvas, green glow, glass cards with sharp 2px corners, a compact scale (two thirds of Tailwind defaults); results shown by a coloured glow (no top strips). Gradients: green (win), yellow (draw), red (lose), orange (The Guy). Fonts Space Grotesk + Inter, **self-hosted** in `public/fonts` | Mostly viewed on phones; modern look |

## Concepts
- **Person**: Chris, Jamie, Paul, Steve (list lives in `public/js/config.js` + validated server-side).
- **Round**: number (1, 2, 3…), The Guy, status `open` / `complete`, created date. Date range is derived from its picks' kick-offs.
- **Pick**: belongs to a round; who picked, league, ESPN event ID, team backed (+ names/crests/kick-off snapshot). Once the game ends: final score + result (`won` / `drew` / `lost` / `void`) are **frozen in D1**, so old rounds never depend on ESPN again.
- **Live status** (not stored): `pending` / `winning` / `drawing` / `losing` / `void`, from `outcome()`.

## Data model (D1, `migrations/0001_initial_schema.sql`)
```sql
CREATE TABLE IF NOT EXISTS rounds (
  id         INTEGER PRIMARY KEY,
  season     TEXT    NOT NULL,
  number     INTEGER NOT NULL,
  the_guy    TEXT    NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'complete')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (season, number)
);

-- A pick backs one team to win. Final score + result are frozen once the game ends,
-- so finished rounds never depend on ESPN again.
CREATE TABLE IF NOT EXISTS picks (
  id         INTEGER PRIMARY KEY,
  round_id   INTEGER NOT NULL REFERENCES rounds (id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  picker     TEXT    NOT NULL,
  league     TEXT    NOT NULL,
  event_id   TEXT    NOT NULL,
  team_id    TEXT    NOT NULL,
  snapshot   TEXT    NOT NULL, -- JSON: teams, crests and kick-off at the time of picking
  home_score INTEGER,
  away_score INTEGER,
  result     TEXT CHECK (result IN ('won', 'drew', 'lost', 'void')),
  settled_at TEXT
);

CREATE INDEX IF NOT EXISTS picks_round ON picks (round_id, position);
```

## Settling results (no cron needed)
When `GET /api/rounds/:n` runs, unsettled picks are refreshed from ESPN; any that are final get their score + result written to D1. When every pick in a round is settled, the round flips to `complete`. Old rounds are then served purely from D1.

## API (Worker routes)
| Method & path | Auth | Purpose |
|---|---|---|
| `GET /api/rounds` | – | History list: number, date range, The Guy, won / total, status |
| `GET /api/rounds/latest` · `GET /api/rounds/:n` | – | Round + picks merged with live ESPN state; settles finished games |
| `POST /api/rounds` | admin | Start a new round (next number) with The Guy + picks |
| `PUT /api/rounds/:n` | admin | Edit a round's picks / The Guy |
| `GET /api/fixtures?league=&date=` | – | ESPN scoreboard proxy for the admin match picker (league whitelist, 30 s cache) |
| `GET /api/leaderboard` | – | Per-person all-time record from settled picks |

## Pages
- **`/`** — latest round. **`/round/2026-27/9`** — a specific round (shareable; unknown paths fall back to `index.html`).
  - Header "Round 12", date range ("Fri 17 – Mon 20 Oct"), live count, ‹ › arrows to previous/next round.
  - Sticky summary: Winning / Drawing / Losing tiles + per-game bar; "3 of 4 won" card when complete.
  - Game cards: picker (avatar + name + 👑 The Guy badge) with the league and clock (kick-off → live minute / HT → FT, or Postponed) top right; teams with crests and score, the backed team carrying a Winning / Drawing / Losing (then Won / Drew / Lost) pill once the game starts.
  - Auto-refresh 60 s while live, 5 min otherwise, on tab focus, and manual button. Completed rounds don't poll.
- **`/history`** — list of rounds, newest first: number, dates, The Guy, result dots + "3 of 4 won". Tap → `/round/:n`.
- **`/leaderboard`** — per person: won / played, win %, drawn, lost, last-5 form dots; their record when they were The Guy.
- **`/admin`** — password (remembered on device); mode switch **Start new round** / **Edit round N**; The Guy chooser; per game: Picked by → league → date → match → team; add/remove game; sticky "Save for everyone".
- Shared bottom nav on public pages: **Live · History · Table**.

## Project layout
```
public/
  index.html  history.html  leaderboard.html  admin.html
  assets/app.css            (built, git-ignored)
  js/config.js              leagues, people
  js/outcome.js             outcome() + summarise()  (pure, unit-tested)
  js/ui.js                  escaping, crest, picker badge, formatting
  js/theme.js               light / dark toggle
  js/api.js                 fetch wrappers for /api/*
  js/mock-api.js            sample-data API (?mock)
  js/mock-data.js           sample rounds
  js/scores.js history.js leaderboard.js admin.js
src/server/
  index.js                  Worker entry: /api router + JSON errors; other paths → static assets
  routes/rounds.js          list, create, show (latest|n), update
  routes/fixtures.js        ESPN proxy for the admin picker
  routes/leaderboard.js
  lib/rounds.js             D1 queries, settling, leaderboard
  lib/espn.js               fetch + normalise ESPN events
  lib/http.js               JSON helpers + HttpError
  lib/auth.js               bearer check
  lib/validate.js           payload validation
migrations/0001_initial_schema.sql
src/app.css                 Tailwind entry
tests/                      node:test — outcome, validation, ESPN normalising
wrangler.toml               Worker + assets (SPA fallback for /round/:n), D1 binding, CSS build step
docs/PLAN.md                this plan
README.md                   setup + usage
```

## Phases
1. **Frontend design** — *done.* Dark gradient theme; Live page with round number + ‹ › nav; History; Table (leaderboard); bottom tab bar; admin with New round / Edit round, pickers and The Guy — all on mock data (11 past rounds + a live Round 12).
2. **Backend** — *done.* D1 schema, Functions, ESPN module, settling, validation; 17 unit tests + end-to-end run against local D1 and a stand-in ESPN. Sample data still available via `?mock`.
3. **Deploy** — code pushed to `suttsc/syndicate-bets` (`main`); remaining steps are one-off Cloudflare setup (see README):
   1. D1 → create `syndicate-bets`, put its id in `wrangler.toml`, push.
   2. Worker named `syndicate-bets` → Settings → Build → connect the repo; deploy command `npm run deploy` (migrations + deploy).
   3. Worker → Variables and Secrets → secret `ADMIN_PASSWORD`.
   4. Worker → Domains & Routes → custom domain `bets.chrissutton.co.uk`.

## Update: seasons, chosen round numbers, team search
- Rounds have a `season` with `UNIQUE(season, number)`. (A table-rebuild migration for this caused problems on live, so the live tables were cleared and the schema is now a single fresh migration, `0001_initial_schema.sql`.)
- Admin: New round / Edit a round (any round, via picker); season + round number fields; after the first save the form is bound to that round, so saving again updates it.
- "Find a team" searches every supported league's fixtures on the game's date (one cached request per date) and fills league, match and backed team. Added National League and Scottish Championship / League One / League Two.
- URLs `/round/2026-27/9`; History grouped by season; Table has season tabs + All time.

## Verification
- `npm test` — outcome/summary, validation, ESPN normalisation.
- Design phase: Playwright screenshots at 390 px (light + dark) and 1280 px for every page/state; no console errors.
- Backend: `npx wrangler dev` with local D1 and a mocked ESPN response (sandbox can't reach ESPN): create round → view live → simulate full time → confirm frozen results, history and leaderboard.
- After deploy: check bets.chrissutton.co.uk on two devices; create a real round; confirm everyone sees it and live scores tick.
