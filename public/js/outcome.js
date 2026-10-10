/**
 * Work out how a "team to win" bet is going.
 *
 * @param {object} event   Normalised event (see js/espn.js / js/mock-data.js)
 * @param {string} teamId  The team we backed
 * @returns {{status: 'pending'|'winning'|'drawing'|'losing'|'void', final: boolean}}
 */
export function outcome(event, teamId) {
  if (!event || event.postponed) {
    return { status: 'void', final: true };
  }

  if (event.state === 'pre') {
    return { status: 'pending', final: false };
  }

  const backed = event.home.id === teamId ? event.home : event.away;
  const opponent = backed === event.home ? event.away : event.home;
  const diff = Number(backed.score) - Number(opponent.score);

  return {
    status: diff > 0 ? 'winning' : diff < 0 ? 'losing' : 'drawing',
    final: event.state === 'post',
  };
}

/**
 * Tally outcomes for the summary bar.
 *
 * @param {Array<{status: string, final: boolean}>} outcomes
 */
export function summarise(outcomes) {
  const counts = { winning: 0, drawing: 0, losing: 0, pending: 0, void: 0 };

  for (const { status } of outcomes) {
    counts[status]++;
  }

  const settled = outcomes.filter((o) => o.status !== 'void');

  return {
    counts,
    total: outcomes.length,
    allFinal: outcomes.length > 0 && outcomes.every((o) => o.final),
    live: outcomes.filter((o) => !o.final && o.status !== 'pending').length,
    won: settled.filter((o) => o.final && o.status === 'winning').length,
    settledTotal: settled.length,
  };
}
