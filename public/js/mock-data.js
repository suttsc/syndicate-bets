// Design-phase data. The latest round's state is chosen with ?scenario=live|final|pre|empty (default: live).
import { PEOPLE } from './config.js';

const TEAMS = {
  359: { name: 'Arsenal', abbr: 'ARS', color: '#ef0107', league: 'eng.1' },
  363: { name: 'Chelsea', abbr: 'CHE', color: '#034694', league: 'eng.1' },
  360: { name: 'Manchester United', abbr: 'MUN', color: '#da291c', league: 'eng.1' },
  364: { name: 'Liverpool', abbr: 'LIV', color: '#c8102e', league: 'eng.1' },
  382: { name: 'Manchester City', abbr: 'MNC', color: '#6cabdd', league: 'eng.1' },
  367: { name: 'Tottenham Hotspur', abbr: 'TOT', color: '#132257', league: 'eng.1' },
  361: { name: 'Newcastle United', abbr: 'NEW', color: '#241f20', league: 'eng.1' },
  362: { name: 'Aston Villa', abbr: 'AVL', color: '#670e36', league: 'eng.1' },
  331: { name: 'Leeds United', abbr: 'LEE', color: '#ffcd00', league: 'eng.2' },
  392: { name: 'Sunderland', abbr: 'SUN', color: '#eb172b', league: 'eng.2' },
  393: { name: 'Burnley', abbr: 'BUR', color: '#6c1d45', league: 'eng.2' },
  394: { name: 'Sheffield United', abbr: 'SHU', color: '#ee2737', league: 'eng.2' },
  256: { name: 'Celtic', abbr: 'CEL', color: '#018749', league: 'sco.1' },
  257: { name: 'Rangers', abbr: 'RAN', color: '#1b458f', league: 'sco.1' },
  258: { name: 'Aberdeen', abbr: 'ABE', color: '#c8102e', league: 'sco.1' },
  259: { name: 'Hearts', abbr: 'HEA', color: '#7a263a', league: 'sco.1' },
};

const team = (id, score = '0') => ({ id: String(id), ...TEAMS[id], logo: null, score: String(score) });

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const at = (msFromNow) => new Date(Date.now() + msFromNow).toISOString();

const event = (id, league, state, detail, kickoff, home, away, extra = {}) => ({ id, league, state, detail, kickoff, home, away, ...extra });

// Latest round (Round 12): Chris → Arsenal, Jamie → Liverpool, Paul → Leeds, Steve → Celtic (Monday night).
const LATEST = {
  live: [
    event('1201', 'eng.1', 'in', "67'", at(-1.2 * HOUR), team(359, 2), team(363, 1)),
    event('1202', 'eng.1', 'in', 'HT', at(-0.8 * HOUR), team(360, 1), team(364, 1)),
    event('1203', 'eng.2', 'in', "81'", at(-1.4 * HOUR), team(331, 0), team(392, 2)),
    event('1204', 'sco.1', 'pre', '', at(2 * DAY + 0.5 * HOUR), team(256), team(257)),
  ],
  final: [
    event('1201', 'eng.1', 'post', 'FT', at(-3 * DAY), team(359, 3), team(363, 1)),
    event('1202', 'eng.1', 'post', 'FT', at(-3 * DAY), team(360, 2), team(364, 2)),
    event('1203', 'eng.2', 'post', 'FT', at(-3 * DAY), team(331, 1), team(392, 0)),
    event('1204', 'sco.1', 'post', 'FT', at(-1 * DAY), team(256, 4), team(257, 0)),
  ],
  pre: [
    event('1201', 'eng.1', 'pre', '', at(1 * DAY), team(359), team(363)),
    event('1202', 'eng.1', 'pre', '', at(1 * DAY + 2.5 * HOUR), team(360), team(364)),
    event('1203', 'eng.2', 'pre', '', at(2 * DAY), team(331), team(392)),
    event('1204', 'sco.1', 'pre', '', at(3 * DAY), team(256), team(257), { postponed: true }),
  ],
};
const LATEST_PICKS = [
  { picker: 'Chris', teamId: '359' },
  { picker: 'Jamie', teamId: '364' },
  { picker: 'Paul', teamId: '331' },
  { picker: 'Steve', teamId: '256' },
];

// Small seeded PRNG so past rounds look the same on every load.
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
}

function pastRound(number, weeksAgo) {
  const rand = rng(number * 7919);
  const ids = Object.keys(TEAMS);
  const saturday = Date.now() - weeksAgo * 7 * DAY;
  const goals = () => Math.floor(rand() * rand() * 5);

  const picks = PEOPLE.map(({ name }, i) => {
    const backed = ids[Math.floor(rand() * ids.length)];
    const sameLeague = ids.filter((id) => id !== backed && TEAMS[id].league === TEAMS[backed].league);
    const opponent = sameLeague[Math.floor(rand() * sameLeague.length)];
    const backedHome = rand() > 0.5;
    const [home, away] = backedHome ? [team(backed, goals() + (rand() > 0.45 ? 1 : 0)), team(opponent, goals())] : [team(opponent, goals()), team(backed, goals() + (rand() > 0.45 ? 1 : 0))];
    const dayOffset = [-1, 0, 0, 2][i] * DAY; // Fri → Mon spread
    const id = `${number}0${i + 1}`;

    return {
      pick: { picker: name, teamId: backed, eventId: id, league: TEAMS[backed].league },
      event: event(id, TEAMS[backed].league, 'post', 'FT', new Date(saturday + dayOffset).toISOString(), home, away),
    };
  });

  return {
    number,
    theGuy: PEOPLE[number % PEOPLE.length].name,
    picks: picks.map((p) => p.pick),
    events: picks.map((p) => p.event),
  };
}

export function mockRounds() {
  const scenario = new URLSearchParams(location.search).get('scenario') ?? 'live';

  if (scenario === 'empty') {
    return [];
  }

  const latestEvents = LATEST[scenario] ?? LATEST.live;
  const past = Array.from({ length: 11 }, (_, i) => pastRound(i + 1, 11 - i));

  return [
    ...past,
    {
      number: 12,
      theGuy: 'Paul',
      picks: LATEST_PICKS.map((p, i) => ({ ...p, eventId: latestEvents[i].id, league: latestEvents[i].league })),
      events: latestEvents,
    },
  ];
}

// Fixtures list for the admin match picker: upcoming games in the chosen league.
export function mockFixtures(league, date) {
  const ids = Object.keys(TEAMS).filter((id) => TEAMS[id].league === league);
  const kickoff = new Date(`${date}T15:00:00`).toISOString();
  const fixtures = [];

  for (let i = 0; i + 1 < ids.length; i += 2) {
    fixtures.push(event(`f-${league}-${date}-${i}`, league, 'pre', '', kickoff, team(ids[i]), team(ids[i + 1])));
  }

  return fixtures;
}
