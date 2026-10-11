// Sample-data implementation of js/api.js, loaded only with ?mock or ?scenario=… (design previews, demos).
import { PEOPLE } from './config.js';
import { mockAllFixtures, mockFixtures, mockRounds } from './mock-data.js';
import { outcome } from './outcome.js';

const MOCK_PASSWORD = 'demo';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withResults = (round) =>
  round.picks.map((pick) => {
    const event = round.events.find((e) => e.id === pick.eventId);
    return { pick, event, result: outcome(event, pick.teamId) };
  });

const roundStatus = (round) => (withResults(round).every((r) => r.result.final) ? 'complete' : 'open');
const keyOf = (round) => (round ? { season: round.season, number: round.number } : null);

export async function loadRound(key = 'latest') {
  await delay(250);

  const rounds = mockRounds();
  const index = key === 'latest'
    ? rounds.length - 1
    : rounds.findIndex((r) => r.season === key.season && r.number === Number(key.number));
  const round = rounds[index];

  if (!round) {
    return null;
  }

  return {
    round: { season: round.season, number: round.number, theGuy: round.theGuy, status: roundStatus(round) },
    picks: round.picks,
    events: round.events,
    prev: keyOf(rounds[index - 1]),
    next: keyOf(rounds[index + 1]),
  };
}

export async function loadRounds() {
  await delay(250);

  return mockRounds()
    .map((round) => {
      const kickoffs = round.events.map((e) => e.kickoff).sort();
      return {
        season: round.season,
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

export async function loadNextNumber(season) {
  const numbers = mockRounds().filter((r) => r.season === season).map((r) => r.number);
  return Math.max(0, ...numbers) + 1;
}

export async function loadLeaderboard(season = null) {
  await delay(250);

  const all = mockRounds();
  const rounds = season ? all.filter((r) => r.season === season) : all;

  return {
    seasons: [...new Set(all.map((r) => r.season))].sort().reverse(),
    season,
    people: PEOPLE.map(({ name }) => {
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
    }),
  };
}

export async function loadFixtures(league, date) {
  await delay(350);
  return mockFixtures(league, date);
}

export async function loadAllFixtures(date) {
  await delay(500);
  return mockAllFixtures(date);
}

function checkPassword(password) {
  if (password !== MOCK_PASSWORD) {
    throw new Error(`Wrong password (use "${MOCK_PASSWORD}" in demo mode)`);
  }
}

export async function createRound(round, password) {
  await delay(600);
  checkPassword(password);
  return { season: round.season, number: round.number ?? (await loadNextNumber(round.season)) };
}

export async function updateRound(key, round, password) {
  await delay(600);
  checkPassword(password);
  return { season: round.season, number: round.number ?? key.number };
}
