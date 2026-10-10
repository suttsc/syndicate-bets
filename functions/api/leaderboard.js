import { json } from '../_lib/http.js';
import { leaderboard } from '../_lib/rounds.js';

// GET /api/leaderboard — all-time record per person
export async function onRequestGet({ env }) {
  return json(await leaderboard(env.DB), { cache: 'public, max-age=60' });
}
