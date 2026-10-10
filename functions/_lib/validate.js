import { LEAGUES, PEOPLE } from '../../public/js/config.js';
import { HttpError } from './http.js';

const MAX_PICKS = 10;
const NAMES = PEOPLE.map((p) => p.name);
const SLUGS = LEAGUES.map((l) => l.slug);

export const isLeague = (slug) => SLUGS.includes(slug);
export const isDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

const fail = (message) => {
  throw new HttpError(422, message);
};

/**
 * Validate a create/update round payload.
 * @returns {{theGuy: string, picks: Array<{picker: string, league: string, date: string, eventId: string, teamId: string}>}}
 */
export function validateRound(body) {
  if (!body || typeof body !== 'object') fail('Missing round');

  const { theGuy, picks } = body;

  if (!NAMES.includes(theGuy)) fail('Choose The Guy');
  if (!Array.isArray(picks) || picks.length === 0) fail('Add at least one game');
  if (picks.length > MAX_PICKS) fail(`No more than ${MAX_PICKS} games per round`);

  return {
    theGuy,
    picks: picks.map((pick, i) => {
      const game = `Game ${i + 1}`;
      if (!NAMES.includes(pick?.picker)) fail(`${game}: choose who picked it`);
      if (!isLeague(pick.league)) fail(`${game}: unknown league`);
      if (!isDate(pick.date)) fail(`${game}: invalid date`);
      if (!/^\d{1,12}$/.test(String(pick.eventId ?? ''))) fail(`${game}: choose a match`);
      if (!/^\d{1,12}$/.test(String(pick.teamId ?? ''))) fail(`${game}: choose a team`);

      return { picker: pick.picker, league: pick.league, date: pick.date, eventId: String(pick.eventId), teamId: String(pick.teamId) };
    }),
  };
}
