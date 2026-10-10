# Football Bets — Plan

Live site: **https://bets.chrisutton.co.uk**

## Context
Chris, Jamie, Paul and Steve each back one team to win per **round** (a round can span several days). One of them is **The Guy** each round. The site shows live → final scores from a free, no-key API and tallies how many picks are **winning / drawing / losing**. Everyone sees the same data; picks are entered through a password-protected admin page. Previous rounds stay viewable forever, with a history list and an all-time leaderboard.

## Decisions
| Area | Choice | Why |
|---|---|---|
| Hosting | **Cloudflare Pages**, connected to a new GitHub repo (auto-deploy on push to `main`, preview URL per branch) | Free, static + serverless in one, custom domain |
| Domain | `bets.chrisutton.co.uk` as a Pages custom domain | Auto DNS + SSL if chrisutton.co.uk is on Cloudflare; otherwise CNAME `bets` → `<project>.pages.dev` |
| Frontend | Plain HTML + ES-module JS, **Tailwind v4** built by its CLI (`npm run build`) | No framework needed; proper production CSS |
| Backend | **Pages Functions** (`/functions`) | Deployed with the site, no separate service |
| Database | **Cloudflare D1** (SQLite), binding `DB` | Free (5 GB, 5M reads/day, 100k writes/day); keeps every round. Replaces the earlier KV idea, which could only hold the current round |
| Scores | **ESPN public API**, called server-side with ~30 s edge cache | Free, no key, covers all needed leagues; unofficial, so isolated in one module |
| Admin auth | `ADMIN_PASSWORD` secret, sent as `Authorization: Bearer …`, constant-time compare | Simple, nothing exposed to visitors |
| Design | Mobile-first, **dark only**: near-black canvas, green glow, glass cards with sharp 2px corners; results shown by a coloured glow (no top strips). Gradients: green (win), yellow (draw), red (lose), orange (The Guy). Fonts Space Grotesk + Inter, **self-hosted** in `public/fonts` | Mostly viewed on phones; modern look |

## Concepts
- **Person**: Chris, Jamie, Paul, Steve (list lives in `public/js/config.js` + validated server-side).
- **Round**: number (1, 2, 3…), The Guy, status `open` / `complete`, created date. Date range is derived from its picks' kick-offs.
- **Pick**: belongs to a round; who picked, league, ESPN event ID, team backed (+ names/crests/kick-off snapshot). Once the game ends: final score + result (`won` / `drew` / `lost` / `void`) are **frozen in D1**, so old rounds never depend on ESPN again.
- **Live status** (not stored): `pending` / `winning` / `drawing` / `losing` / `void`, from `outcome()`.

## Data model (D1, `migrations/0001_init.sql`)
```sql
CREATE TABLE rounds (
  id         INTEGER PRIMARY KEY,
  number     INTEGER NOT NULL UNIQUE,
  the_guy    TEXT    NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'open',   -- open | complete
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE picks (
  id          INTEGER PRIMARY KEY,
  round_id    INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  picker      TEXT    NOT NULL,
  league      TEXT    NOT NULL,
  event_id    TEXT    NOT NULL,
  team_id     TEXT    NOT NULL,
  snapshot    TEXT    NOT NULL,   -- JSON: home/away names, abbr, logos, kickoff
  home_score  INTEGER,            -- set when final
  away_score  INTEGER,
  result      TEXT,               -- won | drew | lost | void, set when final
  settled_at  TEXT
);
CREATE INDEX picks_round ON picks(round_id);
```

## Settling results (no cron needed)
When `GET /api/rounds/:n` runs, unsettled picks are refreshed from ESPN; any that are final get their score + result written to D1. When every pick in a round is settled, the round flips to `complete`. Old rounds are then served purely from D1.

## API (Pages Functions)
| Method & path | Auth | Purpose |
|---|---|---|
| `GET /api/rounds` | – | History list: number, date range, The Guy, won / total, status |
| `GET /api/rounds/latest` · `GET /api/rounds/:n` | – | Round + picks merged with live ESPN state; settles finished games |
| `POST /api/rounds` | admin | Start a new round (next number) with The Guy + picks |
| `PUT /api/rounds/:n` | admin | Edit a round's picks / The Guy |
| `GET /api/fixtures?league=&date=` | – | ESPN scoreboard proxy for the admin match picker (league whitelist, 30 s cache) |
| `GET /api/leaderboard` | – | Per-person all-time record from settled picks |

## Pages
- **`/`** — latest round. **`/round/:n`** — a specific round (shareable; `_redirects` rewrites to `index.html`).
  - Header "Round 12", date range ("Fri 17 – Mon 20 Oct"), live count, ‹ › arrows to previous/next round.
  - Sticky summary: Winning / Drawing / Losing tiles + per-game bar; "3 of 4 won" card when complete.
  - Game cards: picker (avatar + name + 👑 The Guy badge), teams with crests, score, live minute / FT / kick-off / Postponed, league + status badge.
  - Auto-refresh 60 s while live, 5 min otherwise, on tab focus, and manual button. Completed rounds don't poll.
- **`/history`** — list of rounds, newest first: number, dates, The Guy, result dots + "3 of 4 won". Tap → `/round/:n`.
- **`/leaderboard`** — per person: won / played, win %, drawn, lost, last-5 form dots; their record when they were The Guy.
- **`/admin`** — password (remembered on device); mode switch **Start new round** / **Edit round N**; The Guy chooser; per game: Picked by → league → date → match → team; add/remove game; sticky "Save for everyone".
- Shared bottom nav on public pages: **Live · History · Table**.

## Project layout
```
public/
  index.html  history.html  leaderboard.html  admin.html  _redirects
  assets/app.css            (built, git-ignored)
  js/config.js              leagues, people
  js/outcome.js             outcome() + summarise()  (pure, unit-tested)
  js/ui.js                  escaping, crest, picker badge, formatting
  js/api.js                 fetch wrappers (mock mode during design)
  js/mock-data.js           design-phase data (dev only)
  js/scores.js history.js leaderboard.js admin.js
functions/
  api/rounds/index.js       GET list, POST create
  api/rounds/[n].js         GET (latest|n), PUT edit
  api/fixtures.js           ESPN proxy
  api/leaderboard.js
  _lib/espn.js              fetch + normalise ESPN events
  _lib/auth.js              bearer check
  _lib/validate.js          payload validation
migrations/0001_init.sql
src/app.css                 Tailwind entry
tests/                      node:test — outcome, validation, ESPN normalising
wrangler.toml               D1 binding, pages_build_output_dir = "public"
docs/PLAN.md                this plan
README.md                   setup + usage
```

## Phases
1. **Frontend design** — *done (awaiting sign-off).* Dark gradient theme; Live page with round number + ‹ › nav; History; Table (leaderboard); bottom tab bar; admin with New round / Edit round, pickers and The Guy — all on mock data (11 past rounds + a live Round 12).
2. **Backend** — D1 schema + migrations, Functions above, ESPN module, settling, validation + tests; switch `api.js` off mock mode.
3. **Deploy** —
   1. Create GitHub repo, push.
   2. Cloudflare → Workers & Pages → Create → Pages → Connect to Git → repo. Build command `npm run build`, output `public`.
   3. `npx wrangler d1 create football-bets`, add binding `DB` to the Pages project, run `npx wrangler d1 migrations apply football-bets --remote`.
   4. Pages → Settings → Variables and secrets → add secret `ADMIN_PASSWORD`.
   5. Pages → Custom domains → `bets.chrisutton.co.uk`.

## Verification
- `npm test` — outcome/summary, validation, ESPN normalisation.
- Design phase: Playwright screenshots at 390 px (light + dark) and 1280 px for every page/state; no console errors.
- Backend: `npx wrangler pages dev` with local D1 and a mocked ESPN response (sandbox can't reach ESPN): create round → view live → simulate full time → confirm frozen results, history and leaderboard.
- After deploy: check bets.chrisutton.co.uk on two devices; create a real round; confirm everyone sees it and live scores tick.
