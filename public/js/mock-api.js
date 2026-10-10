// Sample-data implementation of js/api.js, loaded only with ?mock or ?scenario=… (design previews, demos).
import { PEOPLE } from './config.js';
import { mockFixtures, mockRounds } from './mock-data.js';
import { outcome } from './outcome.js';

const MOCK_PASSWORD = 'demo';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withResults = (round) =>
  round.picks.map((pick) => {
    const event = round.events.find((e) => e.id === pick.eventId);
    return { pick, event, result: outcome(event, pick.teamId) };
  });

const roundStatus = (round) => (withResults(round).every((r) => r.result.final) ? 'complete' : 'open');

export async function loadRound(number = 'latest') {
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

export async function loadRounds() {
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
        results: withResults(round).map(({ pick, result }) => ({
          picker: pick.picker,
          // Like the real API, the history list only knows settled results.
          status: result.final ? result.status : 'pending',
          final: result.final,
        })),
      };
    })
    .reverse();
}

export async function loadLeaderboard() {
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

export async function loadFixtures(league, date) {
  await delay(350);
  return mockFixtures(league, date);
}

function checkPassword(password) {
  if (password !== MOCK_PASSWORD) {
    throw new Error(`Wrong password (use "${MOCK_PASSWORD}" in demo mode)`);
  }
}

export async function createRound(round, password) {
  await delay(600);
  checkPassword(password);
  return { number: mockRounds().length + 1 };
}

export async function updateRound(number, round, password) {
  await delay(600);
  checkPassword(password);
  return { number };
}
