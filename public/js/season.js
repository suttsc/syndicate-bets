// Football seasons run July → June and are written "2026/27". URLs use "2026-27".

const pad = (n) => String(n % 100).padStart(2, '0');

/** Season a date falls in, e.g. 2026-10-10 → "2026/27", 2027-03-01 → "2026/27". */
export function seasonFor(date = new Date()) {
  const d = typeof date === 'string' ? new Date(`${date.slice(0, 10)}T12:00:00Z`) : date;
  const year = d.getUTCFullYear();
  const start = d.getUTCMonth() >= 6 ? year : year - 1;
  return `${start}/${pad(start + 1)}`;
}

/** "2026/27" with consecutive years. */
export function isSeason(value) {
  const match = /^(\d{4})\/(\d{2})$/.exec(value ?? '');
  return Boolean(match) && pad(Number(match[1]) + 1) === match[2];
}

export const seasonSlug = (season) => season.replace('/', '-');
export const seasonFromSlug = (slug) => slug.replace('-', '/');

/** Path of a round page, e.g. /round/2026-27/9 */
export const roundPath = ({ season, number }) => `/round/${seasonSlug(season)}/${number}`;
