import { LEAGUES } from '../../../public/js/config.js';
import { fetchScoreboard } from '../lib/espn.js';
import { HttpError, json } from '../lib/http.js';
import { isDate, isLeague } from '../lib/validate.js';

/**
 * GET /api/fixtures?date=2026-10-17[&league=eng.1]
 * One league for the match picker, or every supported league (for team search) when league is omitted.
 */
export async function list({ env, request }) {
  const params = new URL(request.url).searchParams;
  const league = params.get('league');
  const date = params.get('date');

  if (!isDate(date)) throw new HttpError(422, 'Invalid date');

  if (league) {
    if (!isLeague(league)) throw new HttpError(422, 'Unknown league');
    return json(await fetchScoreboard(env, league, date), { cache: 'public, max-age=60' });
  }

  // One slow or failing league shouldn't break search across the rest.
  const results = await Promise.allSettled(LEAGUES.map(({ slug }) => fetchScoreboard(env, slug, date)));
  const failed = LEAGUES.filter((_, i) => results[i].status === 'rejected').map((l) => l.slug);
  const events = results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));

  if (failed.length === LEAGUES.length) throw new HttpError(502, 'Could not reach the scores service');
  return json({ events, failed }, { cache: 'public, max-age=60' });
}
