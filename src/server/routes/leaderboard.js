import { json } from '../lib/http.js';
import { leaderboard } from '../lib/rounds.js';

// GET /api/leaderboard — all-time record per person
export async function show({ env }) {
  return json(await leaderboard(env.DB), { cache: 'public, max-age=60' });
}
