// ESPN's public (unofficial, keyless) soccer API. Everything ESPN-specific lives here so it can be swapped.
import { HttpError } from './http.js';

const DEFAULT_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const CACHE_SECONDS = 30;
const VOID_STATUSES = /POSTPONED|CANCELED|CANCELLED|ABANDONED/;

const compact = (date) => date.replaceAll('-', '');

/** YYYY-MM-DD shifted by whole days. */
export function addDays(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const scoreOf = (score) => String((typeof score === 'object' ? score?.displayValue ?? score?.value : score) ?? '0');

function side(competitors, homeAway) {
  const competitor = competitors.find((c) => c.homeAway === homeAway) ?? {};
  const team = competitor.team ?? {};

  return {
    id: String(team.id ?? competitor.id ?? ''),
    name: team.displayName ?? team.name ?? 'TBC',
    abbr: team.abbreviation ?? null,
    color: team.color ? `#${team.color}` : null,
    logo: team.logo ?? team.logos?.[0]?.href ?? null,
    score: scoreOf(competitor.score),
  };
}

/** Map a raw ESPN scoreboard event onto the app's event shape. */
export function normaliseEvent(raw, league) {
  const competition = raw.competitions?.[0] ?? {};
  const status = competition.status ?? raw.status ?? {};
  const type = status.type ?? {};
  const state = ['pre', 'in', 'post'].includes(type.state) ? type.state : 'pre';

  let detail = '';
  if (state === 'in') {
    detail = type.name === 'STATUS_HALFTIME' ? 'HT' : status.displayClock || type.shortDetail || 'Live';
  } else if (state === 'post') {
    detail = type.shortDetail || 'FT';
  }

  return {
    id: String(raw.id),
    league,
    state,
    detail,
    kickoff: new Date(raw.date).toISOString(),
    postponed: VOID_STATUSES.test(type.name ?? ''),
    home: side(competition.competitors ?? [], 'home'),
    away: side(competition.competitors ?? [], 'away'),
  };
}

/** All events in a league between two YYYY-MM-DD dates (inclusive), edge-cached for 30 s. */
export async function fetchScoreboard(env, league, from, to = from) {
  const range = from === to ? compact(from) : `${compact(from)}-${compact(to)}`;
  const url = `${env.ESPN_BASE ?? DEFAULT_BASE}/${league}/scoreboard?dates=${range}&limit=200`;

  let response;
  try {
    response = await fetch(url, {
      headers: { accept: 'application/json' },
      cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
    });
  } catch {
    throw new HttpError(502, 'Could not reach the scores service');
  }

  if (!response.ok) {
    throw new HttpError(502, `Scores service responded ${response.status}`);
  }

  const body = await response.json();
  return (body.events ?? []).map((event) => normaliseEvent(event, league)).sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

/**
 * Look up specific events, batching one scoreboard request per league.
 * A ±1 day window absorbs timezone differences between UK dates and ESPN's.
 *
 * @param {Array<{league: string, date: string}>} wanted
 * @returns {Promise<Map<string, object>>} events by id
 */
export async function fetchEventsFor(env, wanted) {
  const byLeague = new Map();
  for (const { league, date } of wanted) {
    byLeague.set(league, [...(byLeague.get(league) ?? []), date]);
  }

  const lists = await Promise.all(
    [...byLeague].map(([league, dates]) => {
      const sorted = dates.toSorted();
      return fetchScoreboard(env, league, addDays(sorted[0], -1), addDays(sorted.at(-1), 1));
    }),
  );

  return new Map(lists.flat().map((event) => [event.id, event]));
}
