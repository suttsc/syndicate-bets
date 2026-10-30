import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { addDays, fetchEventsFor, normaliseEvent } from '../src/server/lib/espn.js';
import { HttpError } from '../src/server/lib/http.js';
import { resultFor, updateRound } from '../src/server/lib/rounds.js';
import { validateRound } from '../src/server/lib/validate.js';
import { splitStatements } from '../src/server/lib/sql.js';
import { isSeason, roundPath, seasonFor, seasonFromSlug, seasonSlug } from '../public/js/season.js';

const scoreboard = JSON.parse(readFileSync(new URL('./fixtures/espn-scoreboard.json', import.meta.url)));
const [live, halftime, fullTime, postponed, scheduled] = scoreboard.events.map((e) => normaliseEvent(e, 'eng.1'));

describe('normaliseEvent', () => {
  it('maps teams, scores, crests and colours', () => {
    assert.equal(live.id, '740001');
    assert.equal(live.league, 'eng.1');
    assert.equal(live.kickoff, '2026-10-17T14:00:00.000Z');
    assert.deepEqual(live.home, {
      id: '359', name: 'Arsenal', abbr: 'ARS', color: '#ef0107',
      logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/359.png', score: '2',
    });
    assert.equal(live.away.score, '1');
  });

  it('shows the match clock while in play and HT at half time', () => {
    assert.equal(live.state, 'in');
    assert.equal(live.detail, "67'");
    assert.equal(halftime.state, 'in');
    assert.equal(halftime.detail, 'HT');
  });

  it('marks finished, postponed and scheduled games', () => {
    assert.equal(fullTime.state, 'post');
    assert.equal(fullTime.detail, 'FT');
    assert.equal(fullTime.postponed, false);
    assert.equal(postponed.postponed, true);
    assert.equal(scheduled.state, 'pre');
    assert.equal(scheduled.detail, '');
  });

  it('copes with object scores and missing data', () => {
    const event = normaliseEvent({ id: 1, date: '2026-10-17T14:00Z', competitions: [{ competitors: [{ homeAway: 'home', score: { displayValue: '3' }, team: { id: 9 } }] }] }, 'eng.2');
    assert.equal(event.home.score, '3');
    assert.equal(event.home.id, '9');
    assert.equal(event.away.name, 'TBC');
    assert.equal(event.state, 'pre');
  });
});

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    assert.equal(addDays('2026-10-31', 1), '2026-11-01');
    assert.equal(addDays('2027-01-01', -1), '2026-12-31');
  });
});

describe('fetchEventsFor', () => {
  it('asks ESPN for single days only (ranges are rejected), deduped across picks', async (t) => {
    const urls = [];
    t.mock.method(globalThis, 'fetch', async (url) => {
      urls.push(url);
      return new Response(JSON.stringify(scoreboard));
    });

    const events = await fetchEventsFor({ ESPN_BASE: 'https://espn.test' }, [
      { league: 'eng.1', date: '2026-10-17', eventId: '740001' },
      { league: 'eng.1', date: '2026-10-17', eventId: '740002' },
      { league: 'eng.1', date: '2026-10-18', eventId: '740003' },
    ]);

    const dates = urls.map((url) => new URL(url).searchParams.get('dates'));
    assert.ok(dates.every((d) => /^\d{8}$/.test(d)), `unexpected dates param: ${dates}`);
    // Every event is on its pick's own day, so only those two days are asked for, once each.
    assert.deepEqual(dates.sort(), ['20261017', '20261018']);
    assert.equal(events.get('740003').home.name, 'Manchester City');
  });

  it('handles a round spread over Saturday and Sunday in different leagues', async (t) => {
    const urls = [];
    t.mock.method(globalThis, 'fetch', async (url) => {
      urls.push(url);
      const { pathname, searchParams } = new URL(url);
      // Saturday's Premier League games, Sunday's Scottish game; every other day is empty.
      if (pathname.includes('/eng.1/') && searchParams.get('dates') === '20261017') {
        return new Response(JSON.stringify({ events: scoreboard.events.slice(0, 3) }));
      }
      if (pathname.includes('/sco.1/') && searchParams.get('dates') === '20261018') {
        return new Response(JSON.stringify({ events: scoreboard.events.slice(4) }));
      }
      return new Response(JSON.stringify({ events: [] }));
    });

    const events = await fetchEventsFor({ ESPN_BASE: 'https://espn.test' }, [
      { league: 'eng.1', date: '2026-10-17', eventId: '740001' },
      { league: 'eng.1', date: '2026-10-17', eventId: '740002' },
      { league: 'eng.1', date: '2026-10-17', eventId: '740003' },
      { league: 'sco.1', date: '2026-10-18', eventId: '740005' },
    ]);

    assert.deepEqual([...events.keys()].sort(), ['740001', '740002', '740003', '740005']);
    assert.equal(urls.length, 2);
  });

  it('looks a day either side only for a match not on its own day', async (t) => {
    const urls = [];
    t.mock.method(globalThis, 'fetch', async (url) => {
      urls.push(url);
      // ESPN files this late kick-off under the next day (UTC).
      const found = new URL(url).searchParams.get('dates') === '20261019';
      return new Response(JSON.stringify({ events: found ? scoreboard.events.slice(0, 1) : [] }));
    });

    const events = await fetchEventsFor({ ESPN_BASE: 'https://espn.test' }, [
      { league: 'eng.1', date: '2026-10-18', eventId: '740001' },
    ]);

    assert.ok(events.has('740001'));
    assert.deepEqual(urls.map((u) => new URL(u).searchParams.get('dates')).sort(), ['20261017', '20261018', '20261019']);
  });

  it('ignores a failed request that no pick needed', async (t) => {
    t.mock.method(globalThis, 'fetch', async (url) => {
      const { pathname, searchParams } = new URL(url);
      if (pathname.includes('/sco.1/') && searchParams.get('dates') === '20261018') {
        return new Response(JSON.stringify({ events: scoreboard.events.slice(4) }));
      }
      // Any other day errors: today that sinks the whole save even though no pick needs it.
      return new Response('Bad Request', { status: 400 });
    });
    t.mock.method(console, 'error', () => {});

    const events = await fetchEventsFor({ ESPN_BASE: 'https://espn.test' }, [
      { league: 'sco.1', date: '2026-10-18', eventId: '740005' },
    ]);

    assert.ok(events.has('740005'));
  });

  it("explains a failed request when a pick couldn't be checked because of it", async (t) => {
    t.mock.method(globalThis, 'fetch', async () => new Response('Bad Request', { status: 400 }));
    t.mock.method(console, 'error', () => {});

    await assert.rejects(
      fetchEventsFor({ ESPN_BASE: 'https://espn.test' }, [{ league: 'eng.1', date: '2026-10-17', eventId: '740001' }]),
      (error) => error instanceof HttpError && error.status === 502 && /responded 400/.test(error.message),
    );
  });
});

describe('resultFor', () => {
  it('reads the result from the backed side', () => {
    assert.equal(resultFor(fullTime, '361'), 'won');
    assert.equal(resultFor(fullTime, '382'), 'lost');
    assert.equal(resultFor(halftime, '364'), 'drew');
  });

  it('voids postponed games', () => {
    assert.equal(resultFor(postponed, '367'), 'void');
  });
});

describe('seasons', () => {
  it('runs July to June', () => {
    assert.equal(seasonFor('2026-10-10'), '2026/27');
    assert.equal(seasonFor('2027-03-06'), '2026/27');
    assert.equal(seasonFor('2026-07-01'), '2026/27');
    assert.equal(seasonFor('2026-06-30'), '2025/26');
    assert.equal(seasonFor('2099-08-01'), '2099/00');
  });

  it('validates the 2026/27 format with consecutive years', () => {
    assert.ok(isSeason('2026/27'));
    assert.ok(isSeason('2099/00'));
    assert.ok(!isSeason('2026/28'));
    assert.ok(!isSeason('2026-27'));
    assert.ok(!isSeason('26/27'));
    assert.ok(!isSeason(undefined));
  });

  it('round-trips URL slugs', () => {
    assert.equal(seasonSlug('2026/27'), '2026-27');
    assert.equal(seasonFromSlug('2026-27'), '2026/27');
    assert.equal(roundPath({ season: '2026/27', number: 9 }), '/round/2026-27/9');
  });
});

describe('validateRound', () => {
  const pick = { picker: 'Chris', league: 'eng.1', date: '2026-10-17', eventId: '740001', teamId: '359' };
  const base = { season: '2026/27', theGuy: 'Paul', picks: [pick] };

  it('accepts a valid round and normalises ids to strings', () => {
    const round = validateRound({ ...base, number: '9', picks: [{ ...pick, eventId: 740001, teamId: 359 }] });
    assert.deepEqual(round, { season: '2026/27', number: 9, theGuy: 'Paul', picks: [pick] });
  });

  it('treats a missing round number as "next free number"', () => {
    assert.equal(validateRound(base).number, null);
    assert.equal(validateRound({ ...base, number: '' }).number, null);
  });

  it('rejects bad input with a 422 naming the problem', () => {
    const cases = [
      [{ ...base, season: '2026/28' }, /Season/],
      [{ ...base, season: undefined }, /Season/],
      [{ ...base, number: 0 }, /Round number/],
      [{ ...base, number: 2.5 }, /Round number/],
      [{ ...base, number: 1000 }, /Round number/],
      [{ ...base, theGuy: 'Bob' }, /The Guy/],
      [{ ...base, picks: [] }, /at least one/],
      [{ ...base, picks: [{ ...pick, picker: 'Bob' }] }, /Game 1: choose who/],
      [{ ...base, picks: [{ ...pick, league: 'usa.1' }] }, /unknown league/],
      [{ ...base, picks: [{ ...pick, date: '17/10/2026' }] }, /invalid date/],
      [{ ...base, picks: [pick, { ...pick, eventId: 'x' }] }, /Game 2: choose a match/],
      [{ ...base, picks: [{ ...pick, teamId: '' }] }, /choose a team/],
      [{ ...base, picks: Array(11).fill(pick) }, /No more than 10/],
    ];

    for (const [body, message] of cases) {
      assert.throws(() => validateRound(body), (error) => error instanceof HttpError && error.status === 422 && message.test(error.message), JSON.stringify(body).slice(0, 80));
    }
  });

  describe('a hand-entered game (league not on ESPN)', () => {
    const manual = {
      picker: 'Steve', league: 'eng.nl_north', date: '2026-10-31', teamId: 'home',
      home: '  Chester ', away: 'Darlington', kickoff: '2026-10-31T15:00:00.000Z',
    };

    it('needs no ESPN match id and trims team names', () => {
      const [game] = validateRound({ ...base, picks: [manual] }).picks;
      assert.deepEqual(game, {
        picker: 'Steve', league: 'eng.nl_north', date: '2026-10-31', eventId: null, teamId: 'home',
        home: 'Chester', away: 'Darlington', kickoff: '2026-10-31T15:00:00.000Z', homeScore: null, awayScore: null,
      });
    });

    it('takes the final score as whole numbers and keeps its id when edited', () => {
      const [game] = validateRound({ ...base, picks: [{ ...manual, eventId: 'm1761922800123', homeScore: '2', awayScore: 0 }] }).picks;
      assert.equal(game.eventId, 'm1761922800123');
      assert.equal(game.homeScore, 2);
      assert.equal(game.awayScore, 0);
    });

    it('rejects a game without its details', () => {
      const cases = [
        [{ ...manual, away: ' ' }, /both team names/],
        [{ ...manual, home: 'x'.repeat(41) }, /up to 40/],
        [{ ...manual, kickoff: 'Saturday' }, /kick-off/],
        [{ ...manual, teamId: '359' }, /choose a team/],
        [{ ...manual, eventId: '740001' }, /unknown game/],
        [{ ...manual, homeScore: 2 }, /both scores/],
        [{ ...manual, homeScore: 1.5, awayScore: 0 }, /both scores/],
        [{ ...manual, homeScore: -1, awayScore: 0 }, /both scores/],
      ];
      for (const [game, message] of cases) {
        assert.throws(() => validateRound({ ...base, picks: [game] }), (error) => error.status === 422 && message.test(error.message), JSON.stringify(game));
      }
    });
  });
});

/** Just enough of D1 for updateRound: canned SELECT answers, and every statement the batch ran. */
function fakeDb(round, existingPicks = []) {
  const ran = [];
  const statement = (sql) => ({
    sql,
    args: [],
    bind(...args) { this.args = args; return this; },
    async first() { return sql.includes('FROM rounds WHERE season = ?1 AND number = ?2') && !sql.startsWith('SELECT id') ? round : null; },
    async all() { return { results: existingPicks }; },
  });
  return { ran, prepare: statement, async batch(statements) { ran.push(...statements); } };
}

describe('updateRound with a hand-entered game', () => {
  const round = { id: 7, season: '2026/27', number: 12, the_guy: 'Steve', status: 'open' };
  const game = {
    picker: 'Steve', league: 'eng.nl_north', date: '2026-10-31', eventId: 'm1', teamId: 'home',
    home: 'Chester', away: 'Darlington', kickoff: '2026-10-31T15:00:00.000Z',
  };

  it('settles it from the typed-in score and completes the round', async () => {
    const db = fakeDb(round);
    await updateRound({ DB: db }, { season: '2026/27', number: 12 }, {
      season: '2026/27', number: 12, theGuy: 'Steve', picks: [{ ...game, homeScore: 2, awayScore: 1 }],
    });

    const insert = db.ran.find((st) => st.sql.startsWith('INSERT INTO picks'));
    assert.deepEqual(insert.args.slice(4, 10), ['m1', 'home', insert.args[6], 2, 1, 'won']);
    assert.match(JSON.parse(insert.args[6]).home.name, /Chester/);
    assert.equal(db.ran.find((st) => st.sql.startsWith('UPDATE rounds')).args[3], 'complete');
  });

  it('leaves the round open while the score is still to come', async () => {
    const db = fakeDb(round);
    await updateRound({ DB: db }, { season: '2026/27', number: 12 }, {
      season: '2026/27', number: 12, theGuy: 'Steve', picks: [{ ...game, homeScore: null, awayScore: null }],
    });

    assert.equal(db.ran.find((st) => st.sql.startsWith('INSERT INTO picks')).args[9], null);
    assert.equal(db.ran.find((st) => st.sql.startsWith('UPDATE rounds')).args[3], 'open');
  });
});

describe('schema', () => {
  const sql = readFileSync(new URL('../migrations/0001_initial_schema.sql', import.meta.url), 'utf8');
  const statements = splitStatements(sql);

  it('splits the migration into idempotent statements without comments', () => {
    assert.ok(statements.length >= 5);
    assert.ok(statements.every((s) => !s.includes('--') && !s.includes(';')));
    assert.ok(statements.every((s) => /IF (NOT )?EXISTS/.test(s)), 'every statement must be safe to re-run');
  });

  it('creates rounds with a per-season round number', () => {
    const rounds = statements.find((s) => s.startsWith('CREATE TABLE IF NOT EXISTS rounds'));
    assert.match(rounds, /UNIQUE \(season, number\)/);
  });
});
