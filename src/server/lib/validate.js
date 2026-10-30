import { LEAGUES, PEOPLE, isManualLeague } from '../../../public/js/config.js';
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

      if (isManualLeague(pick.league)) {
        return { picker: pick.picker, league: pick.league, date: pick.date, ...validateManualGame(pick, game) };
      }

      if (!/^\d{1,12}$/.test(String(pick.eventId ?? ''))) fail(`${game}: choose a match`);
      if (!/^\d{1,12}$/.test(String(pick.teamId ?? ''))) fail(`${game}: choose a team`);

      return { picker: pick.picker, league: pick.league, date: pick.date, eventId: String(pick.eventId), teamId: String(pick.teamId) };
    }),
  };
}

const MAX_TEAM_NAME = 40;
const MAX_GOALS = 99;

/** A game ESPN doesn't cover: teams and kick-off typed in, and the final score once it's known. */
function validateManualGame(pick, game) {
  const name = (value) => (typeof value === 'string' ? value.trim() : '');
  const home = name(pick.home);
  const away = name(pick.away);
  const goals = (value) => (value === null || value === undefined || value === '' ? null : Number(value));
  const homeScore = goals(pick.homeScore);
  const awayScore = goals(pick.awayScore);
  const validGoals = (value) => value === null || (Number.isInteger(value) && value >= 0 && value <= MAX_GOALS);

  if (!home || !away) fail(`${game}: enter both team names`);
  if (home.length > MAX_TEAM_NAME || away.length > MAX_TEAM_NAME) fail(`${game}: team names can be up to ${MAX_TEAM_NAME} characters`);
  if (typeof pick.kickoff !== 'string' || Number.isNaN(Date.parse(pick.kickoff))) fail(`${game}: enter the kick-off time`);
  if (!['home', 'away'].includes(pick.teamId)) fail(`${game}: choose a team`);
  if (pick.eventId != null && !/^m\d{1,20}$/.test(String(pick.eventId))) fail(`${game}: unknown game`);
  if (!validGoals(homeScore) || !validGoals(awayScore) || (homeScore === null) !== (awayScore === null)) {
    fail(`${game}: enter both scores as whole numbers, or leave both empty`);
  }

  return {
    eventId: pick.eventId == null ? null : String(pick.eventId),
    teamId: pick.teamId,
    home,
    away,
    kickoff: new Date(pick.kickoff).toISOString(),
    homeScore,
    awayScore,
  };
}
