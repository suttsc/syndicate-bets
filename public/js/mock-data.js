// Phase 1 design data. Pick a scenario with ?scenario=live|final|pre|empty (default: live).

const team = (id, name, abbr, color, score = '0') => ({ id, name, abbr, color, logo: null, score });

const kickoff = (hoursFromNow) => new Date(Date.now() + hoursFromNow * 3_600_000).toISOString();

const SCENARIOS = {
  live: [
    { id: '1', league: 'eng.1', state: 'in', detail: "67'", kickoff: kickoff(-1.2), home: team('359', 'Arsenal', 'ARS', '#ef0107', '2'), away: team('363', 'Chelsea', 'CHE', '#034694', '1') },
    { id: '2', league: 'eng.1', state: 'in', detail: 'HT', kickoff: kickoff(-0.8), home: team('360', 'Manchester United', 'MUN', '#da291c', '1'), away: team('364', 'Liverpool', 'LIV', '#c8102e', '1') },
    { id: '3', league: 'eng.2', state: 'in', detail: "81'", kickoff: kickoff(-1.4), home: team('331', 'Leeds United', 'LEE', '#ffcd00', '0'), away: team('392', 'Sunderland', 'SUN', '#eb172b', '2') },
    { id: '4', league: 'sco.1', state: 'pre', detail: '', kickoff: kickoff(2.5), home: team('256', 'Celtic', 'CEL', '#018749'), away: team('257', 'Rangers', 'RAN', '#1b458f') },
  ],
  final: [
    { id: '1', league: 'eng.1', state: 'post', detail: 'FT', kickoff: kickoff(-3), home: team('359', 'Arsenal', 'ARS', '#ef0107', '3'), away: team('363', 'Chelsea', 'CHE', '#034694', '1') },
    { id: '2', league: 'eng.1', state: 'post', detail: 'FT', kickoff: kickoff(-3), home: team('360', 'Manchester United', 'MUN', '#da291c', '2'), away: team('364', 'Liverpool', 'LIV', '#c8102e', '2') },
    { id: '3', league: 'eng.2', state: 'post', detail: 'FT', kickoff: kickoff(-3), home: team('331', 'Leeds United', 'LEE', '#ffcd00', '1'), away: team('392', 'Sunderland', 'SUN', '#eb172b', '0') },
    { id: '4', league: 'sco.1', state: 'post', detail: 'FT', kickoff: kickoff(-3), home: team('256', 'Celtic', 'CEL', '#018749', '4'), away: team('257', 'Rangers', 'RAN', '#1b458f', '0') },
  ],
  pre: [
    { id: '1', league: 'eng.1', state: 'pre', detail: '', kickoff: kickoff(26), home: team('359', 'Arsenal', 'ARS', '#ef0107'), away: team('363', 'Chelsea', 'CHE', '#034694') },
    { id: '2', league: 'eng.1', state: 'pre', detail: '', kickoff: kickoff(28.5), home: team('360', 'Manchester United', 'MUN', '#da291c'), away: team('364', 'Liverpool', 'LIV', '#c8102e') },
    { id: '3', league: 'eng.2', state: 'pre', detail: '', kickoff: kickoff(26), home: team('331', 'Leeds United', 'LEE', '#ffcd00'), away: team('392', 'Sunderland', 'SUN', '#eb172b') },
    { id: '4', league: 'sco.1', state: 'pre', detail: '', postponed: true, kickoff: kickoff(50), home: team('256', 'Celtic', 'CEL', '#018749'), away: team('257', 'Rangers', 'RAN', '#1b458f') },
  ],
  empty: [],
};

// Backed teams: Arsenal, Liverpool, Leeds, Celtic.
const PICKED = { 1: '359', 2: '364', 3: '331', 4: '256' };

export function mockScenario() {
  const name = new URLSearchParams(location.search).get('scenario') ?? 'live';
  const events = SCENARIOS[name] ?? SCENARIOS.live;

  return {
    events,
    picks: events.map((e) => ({ eventId: e.id, league: e.league, date: e.kickoff.slice(0, 10), teamId: PICKED[e.id] })),
    updatedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  };
}

// Fixtures list for the admin match picker.
export function mockFixtures(league) {
  return SCENARIOS.pre.filter((e) => e.league === league || league === 'eng.1').map((e) => ({ ...e, league }));
}
