# Syndicate Bets

Live scores for Chris, Jamie, Paul and Steve's football bets — **https://bets.chrisutton.co.uk**

Each **round** everyone backs one team to win and one person is **The Guy**. The site shows live → final
scores, how many picks are winning / drawing / losing, every past round, and an all-time table.

## Stack

| | |
|---|---|
| Hosting | Cloudflare Pages (Git integration — every push to `main` deploys) |
| Frontend | Plain HTML + ES modules, Tailwind CSS v4 (built by its CLI), self-hosted Space Grotesk + Inter |
| Backend | Cloudflare Pages Functions (`functions/`) |
| Database | Cloudflare D1 (SQLite) — rounds, picks, frozen final results |
| Scores | ESPN's public scoreboard API (free, no key), cached 30 s at the edge |

## Pages

| URL | |
|---|---|
| `/` | Latest round, live |
| `/round/:n` | A specific round (shareable) |
| `/history` | Every round, newest first |
| `/leaderboard` | All-time table |
| `/admin` | Start / edit rounds (password protected) |

Add `?mock` (or `?scenario=live|final|pre|empty`) to any page to see it with built-in sample data —
no backend needed. The demo admin password is `demo`.

## API

| | Auth | |
|---|---|---|
| `GET /api/rounds` | – | History list |
| `GET /api/rounds/latest` · `/api/rounds/:n` | – | Round + live scores (settles finished games) |
| `POST /api/rounds` | admin | Start a new round |
| `PUT /api/rounds/:n` | admin | Edit a round |
| `GET /api/fixtures?league=&date=` | – | Matches for the admin picker |
| `GET /api/leaderboard` | – | Per-person record |

Admin requests send `Authorization: Bearer <ADMIN_PASSWORD>`.

Finished games are written to D1 the first time a round is viewed after full time, so old rounds never
depend on ESPN again. A round flips to `complete` once every pick is settled.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars      # set ADMIN_PASSWORD
npm run db:migrate:local
npm run preview                     # builds CSS, serves site + functions + local D1 on :8788
npm run dev                         # (optional, second terminal) rebuild CSS on change
npm test
```

## Deploying (one-off setup)

1. **Create the database**
   ```bash
   npx wrangler login
   npx wrangler d1 create syndicate-bets
   ```
   Copy the printed `database_id` into `wrangler.toml`, commit and push.

2. **Create the tables**
   ```bash
   npm run db:migrate:remote
   ```

3. **Connect Cloudflare Pages to GitHub** — Cloudflare dashboard → *Workers & Pages* → *Create* →
   *Pages* → *Connect to Git* → `suttsc/syndicate-bets`.
   - Framework preset: *None*
   - Build command: `npm run build`
   - Build output directory: `public`

   The D1 binding (`DB`) is picked up from `wrangler.toml`.

4. **Set the admin password** — Pages project → *Settings* → *Variables and Secrets* → add
   `ADMIN_PASSWORD` as a **Secret** (Production, and Preview if you use preview URLs). Then
   *Deployments* → *Retry deployment* so it takes effect.

5. **Add the domain** — Pages project → *Custom domains* → *Set up a domain* → `bets.chrisutton.co.uk`.
   If chrisutton.co.uk's DNS is on Cloudflare this is automatic; otherwise add a `CNAME` record
   `bets` → `syndicate-bets.pages.dev` at your DNS provider.

After that, every push to `main` redeploys. New migrations: add `migrations/000N_*.sql` and run
`npm run db:migrate:remote`.

## Changing people or leagues

Both lists live in `public/js/config.js` (used by the pages and validated by the API).

## Notes

- ESPN's API is unofficial. Everything ESPN-specific is in `functions/_lib/espn.js`; if it ever
  changes, that's the only file to touch.
- See `docs/PLAN.md` for the full plan and decisions.
