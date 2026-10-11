import { LEAGUES, PEOPLE } from '../../../public/js/config.js';
import { isSeason } from '../../../public/js/season.js';
import { HttpError } from './http.js';

const MAX_PICKS = 10;
const MAX_ROUND = 999;
const NAMES = PEOPLE.map((p) => p.name);
const SLUGS = LEAGUES.map((l) => l.slug);

export const isLeague = (slug) => SLUGS.includes(slug);
export const isDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
export const isRoundNumber = (value) => Number.isInteger(value) && value >= 1 && value <= MAX_ROUND;

const fail = (message) => {
  throw new HttpError(422, message);
};

/**
 * Validate a create/update round payload. `number` is optional (null → next free number).
 * @returns {{season: string, number: number|null, theGuy: string, picks: Array<{picker: string, league: string, date: string, eventId: string, teamId: string}>}}
 */
export function validateRound(body) {
  if (!body || typeof body !== 'object') fail('Missing round');

  const { season, theGuy, picks } = body;
  const number = body.number === undefined || body.number === null || body.number === '' ? null : Number(body.number);

  if (!isSeason(season)) fail('Season must look like 2026/27');
  if (number !== null && !isRoundNumber(number)) fail(`Round number must be between 1 and ${MAX_ROUND}`);
  if (!NAMES.includes(theGuy)) fail('Choose The Guy');
  if (!Array.isArray(picks) || picks.length === 0) fail('Add at least one game');
  if (picks.length > MAX_PICKS) fail(`No more than ${MAX_PICKS} games per round`);

  return {
    season,
    number,
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
