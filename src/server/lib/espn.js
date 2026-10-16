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

/** All events in a league on one YYYY-MM-DD date, edge-cached for 30 s. ESPN rejects date ranges (400). */
export async function fetchScoreboard(env, league, date) {
  const url = `${env.ESPN_BASE ?? DEFAULT_BASE}/${league}/scoreboard?dates=${compact(date)}&limit=200`;

  let response;
  try {
    response = await fetch(url, {
      headers: { accept: 'application/json' },
      // Cache good answers only, so one bad response from ESPN isn't served again for the next 30 s.
      cf: { cacheEverything: true, cacheTtlByStatus: { '200-299': CACHE_SECONDS, '300-599': 0 } },
    });
  } catch {
    throw new HttpError(502, 'Could not reach the scores service');
  }

  if (!response.ok) {
    // Visible in the Worker's logs (observability is on) to diagnose API changes.
    console.error('ESPN error', response.status, url, (await response.text()).slice(0, 300));
    throw new HttpError(502, `Scores service responded ${response.status}`);
  }

  const body = await response.json();
  return (body.events ?? []).map((event) => normaliseEvent(event, league)).sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

/**
 * Fetch each league|date scoreboard once, in parallel, adding what comes back to `events`.
 * A failed day doesn't fail the rest; its error is returned for the caller to judge.
 */
async function fetchDays(env, keys, events, done) {
  const todo = [...new Set(keys)].filter((key) => !done.has(key));
  todo.forEach((key) => done.add(key));

  const results = await Promise.allSettled(
    todo.map((key) => {
      const [league, date] = key.split('|');
      return fetchScoreboard(env, league, date);
    }),
  );

  const errors = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      result.value.forEach((event) => events.set(event.id, event));
    } else {
      errors.push(result.reason);
    }
  }
  return errors;
}

/**
 * Look up specific events with single-day scoreboard requests (ESPN rejects ranges), so a round can
 * mix days and leagues freely. Each pick's own day is asked first; only a match not found there is
 * looked for a day either side, to absorb UK vs ESPN (UTC) date differences. A failed request only
 * matters if it leaves a pick unchecked: then its error is thrown, rather than "match not found".
 *
 * @param {Array<{league: string, date: string, eventId: string}>} wanted
 * @returns {Promise<Map<string, object>>} events by id
 */
export async function fetchEventsFor(env, wanted) {
  const events = new Map();
  const done = new Set();
  const missing = () => wanted.filter((pick) => !events.has(pick.eventId));

  const errors = await fetchDays(env, wanted.map(({ league, date }) => `${league}|${date}`), events, done);

  if (missing().length) {
    const nearby = missing().flatMap(({ league, date }) => [-1, 1].map((offset) => `${league}|${addDays(date, offset)}`));
    errors.push(...(await fetchDays(env, nearby, events, done)));
  }

  if (missing().length && errors.length) {
    throw errors[0];
  }

  return events;
}
