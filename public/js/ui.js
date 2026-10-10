// Small rendering helpers shared by both pages.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** Team crest, falling back to a coloured initials badge when there is no logo (or it fails to load). */
export function crest(team, size = 'size-9') {
  const badge = `<span class="${size} grid shrink-0 place-items-center rounded-full text-[10px] font-bold tracking-wide text-white ring-1 ring-black/10" style="background:${esc(team.color ?? '#64748b')}">${esc(team.abbr ?? team.name.slice(0, 3).toUpperCase())}</span>`;

  if (!team.logo) {
    return badge;
  }

  return `<img src="${esc(team.logo)}" alt="" loading="lazy" class="${size} shrink-0 object-contain" onerror="this.outerHTML=this.dataset.fallback" data-fallback="${esc(badge)}">`;
}

export const kickoffTime = (iso) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export const clockTime = (date = new Date()) =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(date);

export const longDate = (iso) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));

export const STATUS_STYLES = {
  winning: { label: 'Winning', finalLabel: 'Won', text: 'text-win', bg: 'bg-win', soft: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  drawing: { label: 'Drawing', finalLabel: 'Drew', text: 'text-draw', bg: 'bg-draw', soft: 'bg-amber-400/15 text-amber-700 dark:text-amber-300' },
  losing: { label: 'Losing', finalLabel: 'Lost', text: 'text-lose', bg: 'bg-lose', soft: 'bg-rose-500/10 text-rose-700 dark:text-rose-300' },
  pending: { label: 'Not started', finalLabel: 'Not started', text: 'text-pending', bg: 'bg-slate-300 dark:bg-slate-700', soft: 'bg-slate-500/10 text-slate-600 dark:text-slate-300' },
  void: { label: 'Void', finalLabel: 'Void', text: 'text-pending', bg: 'bg-slate-300 dark:bg-slate-700', soft: 'bg-slate-500/10 text-slate-600 dark:text-slate-300' },
};
