import { PEOPLE } from '../../../public/js/config.js';
import { fetchEventsFor } from './espn.js';
import { HttpError } from './http.js';

// Stored results → the status keys the frontend renders.
export const RESULT_STATUS = { won: 'winning', drew: 'drawing', lost: 'losing', void: 'void' };

/** Final result of a finished (or void) event for the backed team. */
export function resultFor(event, teamId) {
  if (event.postponed) return 'void';

  const backed = event.home.id === teamId ? event.home : event.away;
  const other = backed === event.home ? event.away : event.home;
  const diff = Number(backed.score) - Number(other.score);

  return diff > 0 ? 'won' : diff < 0 ? 'lost' : 'drew';
}

const isFinal = (event) => event.postponed || event.state === 'post';

/** Rebuild a settled pick's event from its snapshot and frozen score. */
function frozenEvent(row) {
  const snapshot = JSON.parse(row.snapshot);
  const postponed = row.result === 'void';

  return {
    ...snapshot,
    state: 'post',
    detail: postponed ? '' : 'FT',
    postponed,
    home: { ...snapshot.home, score: String(row.home_score ?? 0) },
    away: { ...snapshot.away, score: String(row.away_score ?? 0) },
  };
}

const pickDate = (row) => JSON.parse(row.snapshot).kickoff.slice(0, 10);

const toPick = (row) => ({ picker: row.picker, league: row.league, eventId: row.event_id, teamId: row.team_id });

const roundKey = (row) => (row ? { season: row.season, number: row.number } : null);

/** @param {'latest'|{season: string, number: number}} key */
function findRound(db, key) {
  return key === 'latest'
    ? db.prepare('SELECT * FROM rounds ORDER BY season DESC, number DESC LIMIT 1').first()
    : db.prepare('SELECT * FROM rounds WHERE season = ?1 AND number = ?2').bind(key.season, key.number).first();
}

/** Previous / next round in (season, number) order, crossing season boundaries. */
async function neighbours(db, round) {
  const [prev, next] = await Promise.all([
    db.prepare(
      `SELECT season, number FROM rounds WHERE season < ?1 OR (season = ?1 AND number < ?2)
       ORDER BY season DESC, number DESC LIMIT 1`,
    ).bind(round.season, round.number).first(),
    db.prepare(
      `SELECT season, number FROM rounds WHERE season > ?1 OR (season = ?1 AND number > ?2)
       ORDER BY season, number LIMIT 1`,
    ).bind(round.season, round.number).first(),
  ]);
  return { prev: roundKey(prev), next: roundKey(next) };
}

/**
 * A round with live scores merged in. Finished games are frozen into D1 as a side effect,
 * and the round is marked complete once every pick is settled.
 */
export async function getRound(env, key) {
  const db = env.DB;
  const round = await findRound(db, key);

  if (!round) {
    return null;
  }

  const [{ results: rows }, { prev, next }] = await Promise.all([
    db.prepare('SELECT * FROM picks WHERE round_id = ?1 ORDER BY position').bind(round.id).all(),
    neighbours(db, round),
  ]);

  const unsettled = rows.filter((row) => !row.result);
  let live = new Map();
  let warning = null;

  if (unsettled.length) {
    try {
      live = await fetchEventsFor(env, unsettled.map((row) => ({ league: row.league, date: pickDate(row), eventId: row.event_id })));
    } catch (error) {
      warning = `Live scores unavailable (${error.message})`;
    }
  }

  const updates = [];
  const events = rows.map((row) => {
    if (row.result) {
      return frozenEvent(row);
    }

    const event = live.get(row.event_id);

    if (!event) {
      // Not found / scores service down: show the snapshot as "not started" rather than a fake score.
      return { ...JSON.parse(row.snapshot), state: 'pre', detail: '', postponed: false };
    }

    if (isFinal(event)) {
      row.result = resultFor(event, row.team_id);
      updates.push(
        db.prepare(
          `UPDATE picks SET home_score = ?1, away_score = ?2, result = ?3, settled_at = datetime('now') WHERE id = ?4`,
        ).bind(Number(event.home.score), Number(event.away.score), row.result, row.id),
      );
    }

    return event;
  });

  const complete = rows.length > 0 && rows.every((row) => row.result);
  if (complete && round.status !== 'complete') {
    updates.push(db.prepare(`UPDATE rounds SET status = 'complete', updated_at = datetime('now') WHERE id = ?1`).bind(round.id));
    round.status = 'complete';
  }

  if (updates.length) {
    await db.batch(updates);
  }

  return {
    round: { season: round.season, number: round.number, theGuy: round.the_guy, status: round.status },
    picks: rows.map(toPick),
    events,
    prev,
    next,
    ...(warning && { warning }),
  };
}

/** History list, newest first. Uses stored data only (no ESPN calls). */
export async function listRounds(db) {
  const [{ results: rounds }, { results: picks }] = await Promise.all([
    db.prepare('SELECT * FROM rounds ORDER BY season DESC, number DESC').all(),
    db.prepare(`SELECT round_id, picker, result, json_extract(snapshot, '$.kickoff') AS kickoff FROM picks ORDER BY round_id, position`).all(),
  ]);

  return rounds.map((round) => {
    const own = picks.filter((p) => p.round_id === round.id);
    const kickoffs = own.map((p) => p.kickoff).sort();

    return {
      season: round.season,
      number: round.number,
      theGuy: round.the_guy,
      status: round.status,
      from: kickoffs[0] ?? null,
      to: kickoffs.at(-1) ?? null,
      results: own.map((p) => ({
        picker: p.picker,
        status: p.result ? RESULT_STATUS[p.result] : 'pending',
        final: Boolean(p.result),
      })),
    };
  });
}

/**
 * Per-person record from settled, non-void picks — for one season, or all time when season is null.
 * @returns {Promise<{seasons: string[], season: string|null, people: Array}>}
 */
export async function leaderboard(db, season = null) {
  const bySeason = (sql) => (season ? db.prepare(sql).bind(season) : db.prepare(sql));

  const [{ results: seasons }, { results: settled }, { results: guys }] = await Promise.all([
    db.prepare('SELECT DISTINCT season FROM rounds ORDER BY season DESC').all(),
    bySeason(
      `SELECT p.picker, p.result FROM picks p JOIN rounds r ON r.id = p.round_id
       WHERE p.result IN ('won', 'drew', 'lost') ${season ? 'AND r.season = ?1' : ''}
       ORDER BY r.season, r.number, p.position`,
    ).all(),
    bySeason(`SELECT the_guy, COUNT(*) AS total FROM rounds ${season ? 'WHERE season = ?1' : ''} GROUP BY the_guy`).all(),
  ]);

  return {
    seasons: seasons.map((s) => s.season),
    season,
    people: PEOPLE.map(({ name }) => {
      const results = settled.filter((s) => s.picker === name).map((s) => s.result);

      return {
        name,
        played: results.length,
        won: results.filter((r) => r === 'won').length,
        drew: results.filter((r) => r === 'drew').length,
        lost: results.filter((r) => r === 'lost').length,
        form: results.slice(-5).reverse().map((r) => RESULT_STATUS[r]),
        guyRounds: guys.find((g) => g.the_guy === name)?.total ?? 0,
      };
    }),
  };
}

/** Check each pick against ESPN and capture a snapshot of the match (teams, crests, kick-off). */
async function snapshotPicks(env, picks) {
  const events = await fetchEventsFor(env, picks);

  return picks.map((pick, i) => {
    const event = events.get(pick.eventId);

    if (!event) {
      throw new HttpError(422, `Game ${i + 1}: match not found`);
    }
    if (![event.home.id, event.away.id].includes(pick.teamId)) {
      throw new HttpError(422, `Game ${i + 1}: that team isn't playing in this match`);
    }

    // Keep only what doesn't change during a match; live state and scores come from ESPN or the frozen result.
    const { id, league, kickoff, home, away } = event;
    const strip = ({ score, ...team }) => team;
    return { ...pick, snapshot: JSON.stringify({ id, league, kickoff, home: strip(home), away: strip(away) }) };
  });
}

async function assertNumberFree(db, season, number, exceptId = null) {
  const taken = await db.prepare('SELECT id FROM rounds WHERE season = ?1 AND number = ?2').bind(season, number).first();
  if (taken && taken.id !== exceptId) {
    throw new HttpError(409, `Round ${number} already exists in ${season}`);
  }
}

/** Next unused number in a season (1 for a new season). */
export async function nextNumber(db, season) {
  const row = await db.prepare('SELECT MAX(number) AS number FROM rounds WHERE season = ?1').bind(season).first();
  return (row?.number ?? 0) + 1;
}

/** Start a round. Uses the requested number, or the next free one in the season. */
export async function createRound(env, { season, number, theGuy, picks }) {
  const db = env.DB;
  const withSnapshots = await snapshotPicks(env, picks);
  const roundNumber = number ?? (await nextNumber(db, season));
  await assertNumberFree(db, season, roundNumber);

  // One batch = one transaction: the round and its picks land together or not at all.
  // A concurrent save racing for the same number fails on UNIQUE(season, number) and rolls back.
  await db.batch([
    db.prepare('INSERT INTO rounds (season, number, the_guy) VALUES (?1, ?2, ?3)').bind(season, roundNumber, theGuy),
    ...withSnapshots.map((pick, i) =>
      db.prepare(
        `INSERT INTO picks (round_id, position, picker, league, event_id, team_id, snapshot)
         VALUES ((SELECT id FROM rounds WHERE season = ?1 AND number = ?2), ?3, ?4, ?5, ?6, ?7, ?8)`,
      ).bind(season, roundNumber, i, pick.picker, pick.league, pick.eventId, pick.teamId, pick.snapshot),
    ),
  ]);

  return { season, number: roundNumber };
}

/**
 * Update a round, including moving it to another season / number. Picks whose match and team
 * are unchanged keep their frozen results, so correcting an old round doesn't lose its scores.
 */
export async function updateRound(env, key, { season, number, theGuy, picks }) {
  const db = env.DB;
  const round = await findRound(db, key);

  if (!round) {
    throw new HttpError(404, `Round ${key.number} (${key.season}) not found`);
  }

  const target = { season, number: number ?? round.number };
  await assertNumberFree(db, target.season, target.number, round.id);

  const { results: existing } = await db.prepare('SELECT * FROM picks WHERE round_id = ?1').bind(round.id).all();
  const keep = (pick) => existing.find((row) => row.event_id === pick.eventId && row.team_id === pick.teamId);

  const fresh = picks.filter((pick) => !keep(pick));
  const snapshots = fresh.length ? await snapshotPicks(env, fresh) : [];

  const statements = [db.prepare('DELETE FROM picks WHERE round_id = ?1').bind(round.id)];

  picks.forEach((pick, i) => {
    const kept = keep(pick);
    if (kept) {
      statements.push(
        db.prepare(
          `INSERT INTO picks (round_id, position, picker, league, event_id, team_id, snapshot, home_score, away_score, result, settled_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
        ).bind(round.id, i, pick.picker, kept.league, kept.event_id, kept.team_id, kept.snapshot, kept.home_score, kept.away_score, kept.result, kept.settled_at),
      );
    } else {
      const snapshot = snapshots.find((s) => s.eventId === pick.eventId && s.teamId === pick.teamId);
      statements.push(
        db.prepare(
          `INSERT INTO picks (round_id, position, picker, league, event_id, team_id, snapshot) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
        ).bind(round.id, i, pick.picker, pick.league, pick.eventId, pick.teamId, snapshot.snapshot),
      );
    }
  });

  // Re-open the round if a new, unsettled pick was added; getRound marks it complete again when due.
  const status = picks.every((pick) => keep(pick)?.result) ? 'complete' : 'open';
  statements.push(
    db.prepare(
      `UPDATE rounds SET season = ?1, number = ?2, the_guy = ?3, status = ?4, updated_at = datetime('now') WHERE id = ?5`,
    ).bind(target.season, target.number, theGuy, status, round.id),
  );

  await db.batch(statements);
  return target;
}
