import { PEOPLE } from '../../public/js/config.js';
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

async function findRound(db, number) {
  const sql = number === 'latest'
    ? 'SELECT * FROM rounds ORDER BY number DESC LIMIT 1'
    : 'SELECT * FROM rounds WHERE number = ?1';
  const statement = db.prepare(sql);
  return number === 'latest' ? statement.first() : statement.bind(Number(number)).first();
}

/**
 * A round with live scores merged in. Finished games are frozen into D1 as a side effect,
 * and the round is marked complete once every pick is settled.
 */
export async function getRound(env, number) {
  const db = env.DB;
  const round = await findRound(db, number);

  if (!round) {
    return null;
  }

  const [{ results: rows }, neighbours] = await Promise.all([
    db.prepare('SELECT * FROM picks WHERE round_id = ?1 ORDER BY position').bind(round.id).all(),
    db.prepare(
      `SELECT (SELECT MAX(number) FROM rounds WHERE number < ?1) AS prev,
              (SELECT MIN(number) FROM rounds WHERE number > ?1) AS next`,
    ).bind(round.number).first(),
  ]);

  const unsettled = rows.filter((row) => !row.result);
  let live = new Map();
  let warning = null;

  if (unsettled.length) {
    try {
      live = await fetchEventsFor(env, unsettled.map((row) => ({ league: row.league, date: pickDate(row) })));
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
    round: { number: round.number, theGuy: round.the_guy, status: round.status },
    picks: rows.map(toPick),
    events,
    prev: neighbours?.prev ?? null,
    next: neighbours?.next ?? null,
    ...(warning && { warning }),
  };
}

/** History list, newest first. Uses stored data only (no ESPN calls). */
export async function listRounds(db) {
  const [{ results: rounds }, { results: picks }] = await Promise.all([
    db.prepare('SELECT * FROM rounds ORDER BY number DESC').all(),
    db.prepare(`SELECT round_id, picker, result, json_extract(snapshot, '$.kickoff') AS kickoff FROM picks ORDER BY round_id, position`).all(),
  ]);

  return rounds.map((round) => {
    const own = picks.filter((p) => p.round_id === round.id);
    const kickoffs = own.map((p) => p.kickoff).sort();

    return {
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

/** Per-person record from settled, non-void picks. */
export async function leaderboard(db) {
  const [{ results: settled }, { results: guys }] = await Promise.all([
    db.prepare(
      `SELECT p.picker, p.result FROM picks p JOIN rounds r ON r.id = p.round_id
       WHERE p.result IN ('won', 'drew', 'lost') ORDER BY r.number, p.position`,
    ).all(),
    db.prepare('SELECT the_guy, COUNT(*) AS total FROM rounds GROUP BY the_guy').all(),
  ]);

  return PEOPLE.map(({ name }) => {
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
  });
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

const insertPick = (db, roundId, position, pick) =>
  db.prepare(
    `INSERT INTO picks (round_id, position, picker, league, event_id, team_id, snapshot) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
  ).bind(roundId, position, pick.picker, pick.league, pick.eventId, pick.teamId, pick.snapshot);

/** Start the next round. */
export async function createRound(env, { theGuy, picks }) {
  const db = env.DB;
  const withSnapshots = await snapshotPicks(env, picks);
  const latest = await db.prepare('SELECT MAX(number) AS number FROM rounds').first();
  const number = (latest?.number ?? 0) + 1;

  // One batch = one transaction: the round and its picks land together or not at all.
  // A concurrent save racing for the same number fails on the UNIQUE constraint and rolls back.
  await db.batch([
    db.prepare('INSERT INTO rounds (number, the_guy) VALUES (?1, ?2)').bind(number, theGuy),
    ...withSnapshots.map((pick, i) =>
      db.prepare(
        `INSERT INTO picks (round_id, position, picker, league, event_id, team_id, snapshot)
         VALUES ((SELECT id FROM rounds WHERE number = ?1), ?2, ?3, ?4, ?5, ?6, ?7)`,
      ).bind(number, i, pick.picker, pick.league, pick.eventId, pick.teamId, pick.snapshot),
    ),
  ]);

  return { number };
}

/**
 * Replace a round's picks. Picks whose match and team are unchanged keep their frozen results,
 * so correcting a typo in an old round doesn't lose its scores.
 */
export async function updateRound(env, number, { theGuy, picks }) {
  const db = env.DB;
  const round = await findRound(db, number);

  if (!round) {
    throw new HttpError(404, `Round ${number} not found`);
  }

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
      statements.push(insertPick(db, round.id, i, snapshots.find((s) => s.eventId === pick.eventId && s.teamId === pick.teamId)));
    }
  });

  // Re-open the round if a new, unsettled pick was added; getRound will mark it complete again when due.
  const status = picks.every((pick) => keep(pick)?.result) ? 'complete' : 'open';
  statements.push(
    db.prepare(`UPDATE rounds SET the_guy = ?1, status = ?2, updated_at = datetime('now') WHERE id = ?3`).bind(theGuy, status, round.id),
  );

  await db.batch(statements);
  return { number: round.number };
}
