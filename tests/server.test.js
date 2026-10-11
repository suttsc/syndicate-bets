import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { addDays, normaliseEvent } from '../src/server/lib/espn.js';
import { HttpError } from '../src/server/lib/http.js';
import { resultFor } from '../src/server/lib/rounds.js';
import { validateRound } from '../src/server/lib/validate.js';

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

describe('validateRound', () => {
  const pick = { picker: 'Chris', league: 'eng.1', date: '2026-10-17', eventId: '740001', teamId: '359' };

  it('accepts a valid round and normalises ids to strings', () => {
    const round = validateRound({ theGuy: 'Paul', picks: [{ ...pick, eventId: 740001, teamId: 359 }] });
    assert.deepEqual(round, { theGuy: 'Paul', picks: [pick] });
  });

  it('rejects bad input with a 422 naming the problem', () => {
    const cases = [
      [{ theGuy: 'Bob', picks: [pick] }, /The Guy/],
      [{ theGuy: 'Paul', picks: [] }, /at least one/],
      [{ theGuy: 'Paul', picks: [{ ...pick, picker: 'Bob' }] }, /Game 1: choose who/],
      [{ theGuy: 'Paul', picks: [{ ...pick, league: 'usa.1' }] }, /unknown league/],
      [{ theGuy: 'Paul', picks: [{ ...pick, date: '17/10/2026' }] }, /invalid date/],
      [{ theGuy: 'Paul', picks: [pick, { ...pick, eventId: 'x' }] }, /Game 2: choose a match/],
      [{ theGuy: 'Paul', picks: [{ ...pick, teamId: '' }] }, /choose a team/],
      [{ theGuy: 'Paul', picks: Array(11).fill(pick) }, /No more than 10/],
    ];

    for (const [body, message] of cases) {
      assert.throws(() => validateRound(body), (error) => error instanceof HttpError && error.status === 422 && message.test(error.message));
    }
  });
});
