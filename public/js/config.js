// Leagues that can be picked from (also whitelisted server-side). Slugs are ESPN's, except for
// `manual` leagues, which ESPN doesn't cover: their games are typed in and scored by hand in admin.
export const LEAGUES = [
  { slug: 'eng.1', name: 'Premier League' },
  { slug: 'eng.2', name: 'Championship' },
  { slug: 'eng.3', name: 'League One' },
  { slug: 'eng.4', name: 'League Two' },
  { slug: 'eng.5', name: 'National League' },
  { slug: 'eng.nl_north', name: 'National League North', manual: true },
  { slug: 'eng.nl_south', name: 'National League South', manual: true },
  { slug: 'eng.fa', name: 'FA Cup' },
  { slug: 'eng.league_cup', name: 'Carabao Cup' },
  { slug: 'sco.1', name: 'Scottish Premiership' },
  { slug: 'sco.2', name: 'Scottish Championship' },
  { slug: 'sco.3', name: 'Scottish League One' },
  { slug: 'sco.4', name: 'Scottish League Two' },
  { slug: 'esp.1', name: 'La Liga' },
  { slug: 'ita.1', name: 'Serie A' },
  { slug: 'ger.1', name: 'Bundesliga' },
  { slug: 'fra.1', name: 'Ligue 1' },
  { slug: 'uefa.champions', name: 'Champions League' },
  { slug: 'uefa.europa', name: 'Europa League' },
];

export const ESPN_LEAGUES = LEAGUES.filter((l) => !l.manual);

export const isManualLeague = (slug) => LEAGUES.some((l) => l.slug === slug && l.manual);

export const leagueName = (slug) => LEAGUES.find((l) => l.slug === slug)?.name ?? slug;

// The syndicate. Each week every person backs one team and one of them is "The Guy".
export const PEOPLE = [
  // Avatar colours avoid the green / yellow / orange / red used for results and The Guy.
  { name: 'Chris', color: '#3b82f6' },
  { name: 'Jamie', color: '#d946ef' },
  { name: 'Paul', color: '#8b5cf6' },
  { name: 'Steve', color: '#06b6d4' },
];

export const personColor = (name) => PEOPLE.find((p) => p.name === name)?.color ?? '#64748b';
