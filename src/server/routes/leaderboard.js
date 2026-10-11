import { isSeason, seasonFromSlug } from '../../../public/js/season.js';
import { HttpError, json } from '../lib/http.js';
import { leaderboard } from '../lib/rounds.js';

// GET /api/leaderboard[?season=2026-27] — record per person for a season, or all time
export async function show({ env, request }) {
  const slug = new URL(request.url).searchParams.get('season');
  const season = slug ? seasonFromSlug(slug) : null;
  if (season && !isSeason(season)) throw new HttpError(422, 'Season must look like 2026-27');

  return json(await leaderboard(env.DB, season), { cache: 'public, max-age=60' });
}
