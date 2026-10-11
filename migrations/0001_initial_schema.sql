-- Syndicate Bets schema.
-- A round is one set of bets (one pick per person), numbered within a football season
-- ("2026/27", July → June), and may span several days.

-- Leftovers from an earlier, abandoned migration.
DROP TABLE IF EXISTS picks_new;
DROP TABLE IF EXISTS rounds_new;

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
