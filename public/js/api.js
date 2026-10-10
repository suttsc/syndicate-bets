// Data access. Each function mirrors a planned /api/* endpoint; design mode serves mock data.
import { PEOPLE } from './config.js';
import { mockFixtures, mockRounds } from './mock-data.js';
import { outcome } from './outcome.js';

const USE_MOCK = true;
const MOCK_PASSWORD = 'demo';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const notWired = () => {
  throw new Error('Live API not wired up yet');
};

/** Picks of a round paired with their events and outcomes. */
const withResults = (round) =>
  round.picks.map((pick) => {
    const event = round.events.find((e) => e.id === pick.eventId);
    return { pick, event, result: outcome(event, pick.teamId) };
  });

const roundStatus = (round) => (withResults(round).every((r) => r.result.final) ? 'complete' : 'open');

/**
 * GET /api/rounds/:n (or "latest")
 * @returns {Promise<null|{round: {number, theGuy, status}, picks: Array, events: Array, prev: number|null, next: number|null}>}
 */
export async function loadRound(number = 'latest') {
  if (!USE_MOCK) notWired();
  await delay(250);

  const rounds = mockRounds();
  const index = number === 'latest' ? rounds.length - 1 : rounds.findIndex((r) => r.number === Number(number));
  const round = rounds[index];

  if (!round) {
    return null;
  }

  return {
    round: { number: round.number, theGuy: round.theGuy, status: roundStatus(round) },
    picks: round.picks,
    events: round.events,
    prev: rounds[index - 1]?.number ?? null,
    next: rounds[index + 1]?.number ?? null,
  };
}

/**
 * GET /api/rounds — newest first.
 * @returns {Promise<Array<{number, theGuy, status, from, to, results: Array<{picker, status, final}>}>>}
 */
export async function loadRounds() {
  if (!USE_MOCK) notWired();
  await delay(250);

  return mockRounds()
    .map((round) => {
      const kickoffs = round.events.map((e) => e.kickoff).sort();
      return {
        number: round.number,
        theGuy: round.theGuy,
        status: roundStatus(round),
        from: kickoffs[0],
        to: kickoffs.at(-1),
        results: withResults(round).map(({ pick, result }) => ({ picker: pick.picker, ...result })),
      };
    })
    .reverse();
}

/**
 * GET /api/leaderboard — settled picks only.
 * @returns {Promise<Array<{name, played, won, drew, lost, form: string[], guyRounds: number}>>}
 */
export async function loadLeaderboard() {
  if (!USE_MOCK) notWired();
  await delay(250);

  const rounds = mockRounds();

  return PEOPLE.map(({ name }) => {
    const settled = rounds
      .flatMap((round) => withResults(round))
      .filter(({ pick, result }) => pick.picker === name && result.final && result.status !== 'void')
      .map(({ result }) => result.status);

    return {
      name,
      played: settled.length,
      won: settled.filter((s) => s === 'winning').length,
      drew: settled.filter((s) => s === 'drawing').length,
      lost: settled.filter((s) => s === 'losing').length,
      form: settled.slice(-5).reverse(),
      guyRounds: rounds.filter((r) => r.theGuy === name).length,
    };
  });
}

/** GET /api/fixtures?league=&date= */
export async function loadFixtures(league, date) {
  if (!USE_MOCK) notWired();
  await delay(350);
  return mockFixtures(league, date);
}

function checkMockPassword(password) {
  if (password !== MOCK_PASSWORD) {
    throw new Error(`Wrong password (use "${MOCK_PASSWORD}" in design mode)`);
  }
}

/** POST /api/rounds — start a new round. */
export async function createRound(round, password) {
  if (!USE_MOCK) notWired();
  await delay(600);
  checkMockPassword(password);
  return { ...round, number: mockRounds().length + 1, updatedAt: new Date().toISOString() };
}

/** PUT /api/rounds/:n — edit an existing round. */
export async function updateRound(number, round, password) {
  if (!USE_MOCK) notWired();
  await delay(600);
  checkMockPassword(password);
  return { ...round, number, updatedAt: new Date().toISOString() };
}
