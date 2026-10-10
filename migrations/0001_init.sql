-- A round is one set of bets (one pick per person), possibly spanning several days.
CREATE TABLE rounds (
  id         INTEGER PRIMARY KEY,
  number     INTEGER NOT NULL UNIQUE,
  the_guy    TEXT    NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'complete')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- A pick backs one team to win. Final score + result are frozen once the game ends,
-- so finished rounds never depend on ESPN again.
CREATE TABLE picks (
  id         INTEGER PRIMARY KEY,
  round_id   INTEGER NOT NULL REFERENCES rounds (id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  picker     TEXT    NOT NULL,
  league     TEXT    NOT NULL,
  event_id   TEXT    NOT NULL,
  team_id    TEXT    NOT NULL,
  snapshot   TEXT    NOT NULL, -- JSON: normalised event at the time of picking (teams, crests, kickoff)
  home_score INTEGER,
  away_score INTEGER,
  result     TEXT CHECK (result IN ('won', 'drew', 'lost', 'void')),
  settled_at TEXT
);

CREATE INDEX picks_round ON picks (round_id, position);
