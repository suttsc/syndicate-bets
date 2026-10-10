// Data access for the pages. Talks to the /api/* Pages Functions.
// Add ?mock (or ?scenario=live|final|pre|empty) to any page to use built-in sample data instead.

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
 * GET /api/rounds/:n (or "latest").
 * @returns {Promise<null|{round: {number, theGuy, status}, picks: Array, events: Array, prev: number|null, next: number|null, warning?: string}>}
 */
export async function loadRound(number = 'latest') {
  if (USE_MOCK) return (await mock()).loadRound(number);
  return request(`/api/rounds/${encodeURIComponent(number)}`);
}

/** GET /api/rounds — newest first. */
export async function loadRounds() {
  if (USE_MOCK) return (await mock()).loadRounds();
  return request('/api/rounds');
}

/** GET /api/leaderboard */
export async function loadLeaderboard() {
  if (USE_MOCK) return (await mock()).loadLeaderboard();
  return request('/api/leaderboard');
}

/** GET /api/fixtures?league=&date= */
export async function loadFixtures(league, date) {
  if (USE_MOCK) return (await mock()).loadFixtures(league, date);
  return request(`/api/fixtures?${new URLSearchParams({ league, date })}`);
}

/** POST /api/rounds — start a new round. */
export async function createRound(round, password) {
  if (USE_MOCK) return (await mock()).createRound(round, password);
  return request('/api/rounds', { method: 'POST', body: round, password });
}

/** PUT /api/rounds/:n — edit an existing round. */
export async function updateRound(number, round, password) {
  if (USE_MOCK) return (await mock()).updateRound(number, round, password);
  return request(`/api/rounds/${number}`, { method: 'PUT', body: round, password });
}
