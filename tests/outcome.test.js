import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { outcome, summarise } from '../public/js/outcome.js';

const event = (state, homeScore, awayScore, extra = {}) => ({
  state,
  home: { id: 'H', score: String(homeScore) },
  away: { id: 'A', score: String(awayScore) },
  ...extra,
});

describe('outcome', () => {
  it('is pending before kick-off', () => {
    assert.deepEqual(outcome(event('pre', 0, 0), 'H'), { status: 'pending', final: false });
  });

  it('reads the score from the backed side', () => {
    assert.equal(outcome(event('in', 2, 1), 'H').status, 'winning');
    assert.equal(outcome(event('in', 2, 1), 'A').status, 'losing');
    assert.equal(outcome(event('in', 1, 1), 'A').status, 'drawing');
  });

  it('compares numerically, not as strings', () => {
    assert.equal(outcome(event('in', 10, 9), 'H').status, 'winning');
  });

  it('marks finished games as final', () => {
    assert.deepEqual(outcome(event('post', 0, 3), 'A'), { status: 'winning', final: true });
  });

  it('voids postponed or missing games', () => {
    assert.deepEqual(outcome(event('pre', 0, 0, { postponed: true }), 'H'), { status: 'void', final: true });
    assert.deepEqual(outcome(undefined, 'H'), { status: 'void', final: true });
  });
});

describe('summarise', () => {
  it('counts statuses and live games', () => {
    const s = summarise([
      { status: 'winning', final: false },
      { status: 'drawing', final: false },
      { status: 'losing', final: true },
      { status: 'pending', final: false },
    ]);

    assert.deepEqual(s.counts, { winning: 1, drawing: 1, losing: 1, pending: 1, void: 0 });
    assert.equal(s.live, 2);
    assert.equal(s.allFinal, false);
  });

  it('reports wins out of non-void games once all are final', () => {
    const s = summarise([
      { status: 'winning', final: true },
      { status: 'winning', final: true },
      { status: 'losing', final: true },
      { status: 'void', final: true },
    ]);

    assert.equal(s.allFinal, true);
    assert.equal(s.won, 2);
    assert.equal(s.settledTotal, 3);
  });

  it('is not final when empty', () => {
    assert.equal(summarise([]).allFinal, false);
  });
});
