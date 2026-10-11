-- Rounds belong to a season ("2026/27") and are numbered within it, so round numbers are
-- unique per season rather than globally. SQLite can't drop the old UNIQUE(number) in place,
-- so both tables are rebuilt and the data copied across.
--
-- Order matters: picks are copied to the new table and the old picks dropped *before* the old
-- rounds, so dropping rounds can never cascade-delete picks.

PRAGMA defer_foreign_keys = on;

CREATE TABLE rounds_new (
  id         INTEGER PRIMARY KEY,
  season     TEXT    NOT NULL,
  number     INTEGER NOT NULL,
  the_guy    TEXT    NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'complete')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (season, number)
);

-- Existing rounds get the season of their earliest kick-off (July → June seasons),
-- falling back to when the round was created.
WITH firsts AS (
  SELECT r.id,
         COALESCE((SELECT MIN(json_extract(p.snapshot, '$.kickoff')) FROM picks p WHERE p.round_id = r.id), r.created_at) AS kickoff
  FROM rounds r
)
INSERT INTO rounds_new (id, season, number, the_guy, status, created_at, updated_at)
SELECT r.id,
       CASE
         WHEN CAST(strftime('%m', f.kickoff) AS INTEGER) >= 7
           THEN strftime('%Y', f.kickoff) || '/' || substr(CAST(CAST(strftime('%Y', f.kickoff) AS INTEGER) + 1 AS TEXT), 3, 2)
         ELSE CAST(CAST(strftime('%Y', f.kickoff) AS INTEGER) - 1 AS TEXT) || '/' || substr(strftime('%Y', f.kickoff), 3, 2)
       END,
       r.number, r.the_guy, r.status, r.created_at, r.updated_at
FROM rounds r
JOIN firsts f ON f.id = r.id;

CREATE TABLE picks_new (
  id         INTEGER PRIMARY KEY,
  round_id   INTEGER NOT NULL REFERENCES rounds_new (id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  picker     TEXT    NOT NULL,
  league     TEXT    NOT NULL,
  event_id   TEXT    NOT NULL,
  team_id    TEXT    NOT NULL,
  snapshot   TEXT    NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  result     TEXT CHECK (result IN ('won', 'drew', 'lost', 'void')),
  settled_at TEXT
);

INSERT INTO picks_new SELECT * FROM picks;

DROP TABLE picks;
DROP TABLE rounds;

-- Renaming also repoints picks_new's foreign key at the renamed table.
ALTER TABLE rounds_new RENAME TO rounds;
ALTER TABLE picks_new RENAME TO picks;

CREATE INDEX picks_round ON picks (round_id, position);
CREATE INDEX rounds_order ON rounds (season, number);
