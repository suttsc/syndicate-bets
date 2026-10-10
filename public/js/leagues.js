// ESPN league slugs supported by the app (also whitelisted server-side).
export const LEAGUES = [
  { slug: 'eng.1', name: 'Premier League' },
  { slug: 'eng.2', name: 'Championship' },
  { slug: 'eng.3', name: 'League One' },
  { slug: 'eng.4', name: 'League Two' },
  { slug: 'eng.fa', name: 'FA Cup' },
  { slug: 'eng.league_cup', name: 'Carabao Cup' },
  { slug: 'sco.1', name: 'Scottish Premiership' },
  { slug: 'esp.1', name: 'La Liga' },
  { slug: 'ita.1', name: 'Serie A' },
  { slug: 'ger.1', name: 'Bundesliga' },
  { slug: 'fra.1', name: 'Ligue 1' },
  { slug: 'uefa.champions', name: 'Champions League' },
  { slug: 'uefa.europa', name: 'Europa League' },
];

export const leagueName = (slug) => LEAGUES.find((l) => l.slug === slug)?.name ?? slug;
