import { fetchScoreboard } from '../lib/espn.js';
import { HttpError, json } from '../lib/http.js';
import { isDate, isLeague } from '../lib/validate.js';

// GET /api/fixtures?league=eng.1&date=2026-10-17 — matches for the admin picker
export async function list({ env, request }) {
  const params = new URL(request.url).searchParams;
  const league = params.get('league');
  const date = params.get('date');

  if (!isLeague(league)) throw new HttpError(422, 'Unknown league');
  if (!isDate(date)) throw new HttpError(422, 'Invalid date');

  return json(await fetchScoreboard(env, league, date), { cache: 'public, max-age=60' });
}
