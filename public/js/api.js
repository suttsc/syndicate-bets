// Data access for the pages. Talks to the Worker's /api/* routes.
// Add ?mock (or ?scenario=live|final|pre|empty) to any page to use built-in sample data instead.

import { seasonSlug } from './season.js';

const params = new URLSearchParams(location.search);
const USE_MOCK = params.has('mock') || params.has('scenario');

const mock = () => import('./mock-api.js');

async function request(path, { method = 'GET', body, password } = {}) {
  const response = await fetch(path, {
    method,
    headers: {
      accept: 'application/json',
      ...(body && { 'content-type': 'application/json' }),
      ...(password !== undefined && { authorization: `Bearer ${password}` }),
    },
    body: body && JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error ?? `Request failed (${response.status})`);
  }

  return data;
}

/**
 * GET /api/rounds/latest or /api/rounds/:season/:number.
 * @param {'latest'|{season: string, number: number}} key
 * @returns {Promise<null|{round: {season, number, theGuy, status}, picks: Array, events: Array, prev: object|null, next: object|null, warning?: string}>}
 */
export async function loadRound(key = 'latest') {
  if (USE_MOCK) return (await mock()).loadRound(key);
  return request(key === 'latest' ? '/api/rounds/latest' : `/api/rounds/${seasonSlug(key.season)}/${key.number}`);
}

/** GET /api/rounds — newest first. */
export async function loadRounds() {
  if (USE_MOCK) return (await mock()).loadRounds();
  return request('/api/rounds');
}

/** GET /api/rounds/next — the number a new round in this season would get. */
export async function loadNextNumber(season) {
  if (USE_MOCK) return (await mock()).loadNextNumber(season);
  return (await request(`/api/rounds/next?season=${seasonSlug(season)}`)).number;
}

/** GET /api/leaderboard — one season, or all time when season is null. */
export async function loadLeaderboard(season = null) {
  if (USE_MOCK) return (await mock()).loadLeaderboard(season);
  return request(`/api/leaderboard${season ? `?season=${seasonSlug(season)}` : ''}`);
}

/** GET /api/fixtures?league=&date= — one league's matches on a date. */
export async function loadFixtures(league, date) {
  if (USE_MOCK) return (await mock()).loadFixtures(league, date);
  return request(`/api/fixtures?${new URLSearchParams({ league, date })}`);
}

/** GET /api/fixtures?date= — every supported league's matches on a date (for team search). */
export async function loadAllFixtures(date) {
  if (USE_MOCK) return (await mock()).loadAllFixtures(date);
  return (await request(`/api/fixtures?${new URLSearchParams({ date })}`)).events;
}

/** POST /api/rounds — start a new round. Resolves to its { season, number }. */
export async function createRound(round, password) {
  if (USE_MOCK) return (await mock()).createRound(round, password);
  return request('/api/rounds', { method: 'POST', body: round, password });
}

/** PUT /api/rounds/:season/:number — edit a round (may move it to a new season / number). */
export async function updateRound(key, round, password) {
  if (USE_MOCK) return (await mock()).updateRound(key, round, password);
  return request(`/api/rounds/${seasonSlug(key.season)}/${key.number}`, { method: 'PUT', body: round, password });
}
