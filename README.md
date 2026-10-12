# Syndicate Bets

Live scores for Chris, Jamie, Paul and Steve's football bets — **https://bets.chrissutton.co.uk**

Each **round** everyone backs one team to win and one person is **The Guy**. Rounds are numbered within a
**season** (July → June, written `2026/27`). The site shows live → final scores, how many picks are
winning / drawing / losing, every past round, and a table per season or all time.

## Stack

| | |
|---|---|
| Hosting | Cloudflare Worker with static assets (Git integration — every push to `main` deploys) |
| Frontend | Plain HTML + ES modules, Tailwind CSS v4 (built by its CLI), self-hosted Space Grotesk + Inter |
| Backend | The same Worker (`src/server/`) — only `/api/*` requests run code; pages are served as static files |
| Database | Cloudflare D1 (SQLite) — rounds, picks, frozen final results |
| Scores | ESPN's public scoreboard API (free, no key), cached 30 s at the edge |

## Pages

| URL | |
|---|---|
| `/` | Latest round, live |
| `/round/2026-27/9` | A specific round (shareable) |
| `/history` | Every round, grouped by season |
| `/leaderboard` | Table — `?season=2026-27` or `?season=all` |
| `/admin` | Start / edit rounds (password protected): choose season + round number, find teams by name |

Add `?mock` (or `?scenario=live|final|pre|empty`) to any page to see it with built-in sample data —
no backend needed. The demo admin password is `demo`.

## API

| | Auth | |
|---|---|---|
| `GET /api/rounds` | – | History list |
| `GET /api/rounds/latest` · `/api/rounds/:season/:number` | – | Round + live scores (settles finished games) |
| `GET /api/rounds/next?season=2026-27` | – | Next free round number in a season |
| `POST /api/rounds` | admin | Start a round (`season`, optional `number`, `theGuy`, `picks`) |
| `PUT /api/rounds/:season/:number` | admin | Edit a round — can also change its season / number |
| `GET /api/fixtures?date=[&league=]` | – | One league's matches, or every league's (team search) |
| `GET /api/leaderboard[?season=2026-27]` | – | Per-person record for a season, or all time |

Round numbers are unique per season; saving a number that's taken returns `409`.

Admin requests send `Authorization: Bearer <ADMIN_PASSWORD>`.

Finished games are written to D1 the first time a round is viewed after full time, so old rounds never
depend on ESPN again. A round flips to `complete` once every pick is settled.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars      # set ADMIN_PASSWORD
npm run db:migrate:local
npm run dev                         # builds CSS, serves site + API + local D1 on http://localhost:8787
npm run dev:css                     # (optional, second terminal) rebuild CSS on change
npm test
```

## Deploying (one-off setup, all in the Cloudflare dashboard)

1. **Create the database** — *Storage & databases* → *D1 SQL database* → *Create* → name it
   `syndicate-bets`. Copy its **Database ID** into `database_id` in `wrangler.toml`, commit and push.

2. **Name the Worker `syndicate-bets`** — it must match `name` in `wrangler.toml`. Either create a
   Worker with that name, or rename an existing one (*Settings* → *General* → *Name*).

3. **Connect GitHub** — Worker → *Settings* → *Build* → *Connect* → GitHub → `suttsc/syndicate-bets`,
   branch `main`.
   - Build command: *(leave empty — Wrangler builds the CSS itself)*
   - Deploy command: `npm run deploy` (applies database migrations, then deploys). `npx wrangler deploy`
     also works — the Worker creates missing tables on its own.

4. **Set the admin password** — Worker → *Settings* → *Variables and Secrets* → *Add* → type **Secret**,
   name `ADMIN_PASSWORD`. Secrets survive future deploys.

5. **Add the domain** — Worker → *Settings* → *Domains & Routes* → *Add* → *Custom domain* →
   `bets.chrissutton.co.uk` (chrissutton.co.uk must be a zone in this Cloudflare account).

Then push any commit (or *Deployments* → *Retry build*) to deploy. Every push to `main` redeploys.

The Worker also creates any missing tables itself on its first API request (it runs the same
`migrations/0001_initial_schema.sql`, whose statements are all `IF NOT EXISTS`). So a fresh or emptied
database fixes itself after a deploy and one visit to the site, even if the migration step didn't run.

## Changing people or leagues

Both lists live in `public/js/config.js` (used by the pages and validated by the API).

## Notes

- ESPN's API is unofficial. Everything ESPN-specific is in `src/server/lib/espn.js`; if it ever
  changes, that's the only file to touch.
- See `docs/PLAN.md` for the full plan and decisions.
