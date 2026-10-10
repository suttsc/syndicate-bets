// Rendering helpers shared by every page.
import { personColor } from './config.js';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

export const STATUS_STYLES = {
  winning: { label: 'Winning', finalLabel: 'Won', short: 'W', grad: 'grad-win', glow: 'glow-win' },
  drawing: { label: 'Drawing', finalLabel: 'Drew', short: 'D', grad: 'grad-draw', glow: 'glow-draw' },
  losing: { label: 'Losing', finalLabel: 'Lost', short: 'L', grad: 'grad-lose', glow: 'glow-lose' },
  pending: { label: 'Not started', finalLabel: 'Not started', short: '–', grad: 'grad-muted', glow: '' },
  void: { label: 'Void', finalLabel: 'Void', short: 'V', grad: 'grad-muted', glow: '' },
};

/** Team crest, falling back to a coloured initials badge when there is no logo (or it fails to load). */
export function crest(team, size = 'size-9') {
  const badge = `<span class="${size} grid shrink-0 place-items-center rounded-full text-[10px] font-bold tracking-wide text-white ring-1 ring-white/15" style="background:${esc(team.color ?? '#3f3f46')}">${esc(team.abbr ?? team.name.slice(0, 3).toUpperCase())}</span>`;

  if (!team.logo) {
    return badge;
  }

  return `<img src="${esc(team.logo)}" alt="" loading="lazy" class="${size} shrink-0 object-contain" onerror="this.outerHTML=this.dataset.fallback" data-fallback="${esc(badge)}">`;
}

export const avatar = (name, size = 'size-7 text-xs') =>
  `<span class="${size} grid shrink-0 place-items-center rounded-full font-bold text-white ring-2 ring-black/40" style="background:${esc(personColor(name))}">${esc(name[0])}</span>`;

export const theGuyBadge = () =>
  '<span class="grad-guy inline-flex shrink-0 items-center gap-1 rounded-xs px-2 py-0.5 text-[11px] font-bold tracking-wider text-black uppercase shadow-[0_4px_16px_-4px_rgb(249_115_22/0.7)]"><span aria-hidden="true">👑</span>The Guy</span>';

/** Who made a pick: avatar + name, plus the badge for this round's Guy. */
export function picker(name, isTheGuy) {
  if (!name) {
    return '<span class="text-sm text-zinc-500">Unassigned</span>';
  }

  return `
    <span class="flex min-w-0 items-center gap-2">
      ${avatar(name)}
      <span class="truncate font-display font-bold">${esc(name)}</span>
      ${isTheGuy ? theGuyBadge() : ''}
    </span>`;
}

/** Gradient pill describing how a bet is going / went. */
export function statusPill(result) {
  const style = STATUS_STYLES[result.status];
  const muted = style.grad === 'grad-muted';
  return `<span class="${style.grad} inline-flex shrink-0 items-center rounded-xs px-2.5 py-1 text-xs font-bold ${muted ? 'text-zinc-300' : 'text-black'}">${result.final ? style.finalLabel : style.label}</span>`;
}

/** Small W/D/L disc, optionally lettered with a person's initial. */
export function resultDot(status, label = STATUS_STYLES[status].short, size = 'size-7') {
  const style = STATUS_STYLES[status];
  const muted = style.grad === 'grad-muted';
  return `<span class="${style.grad} ${size} grid shrink-0 place-items-center rounded-full text-[11px] font-black ${muted ? 'text-zinc-400' : 'text-black'}">${esc(label)}</span>`;
}

export const kickoffTime = (iso) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export const clockTime = (date = new Date()) =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(date);

export const shortDate = (iso) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));

/** "Fri 9 – Mon 12 Oct" (or a single day). */
export function dateRange(fromIso, toIso) {
  if (!fromIso) return '';
  const from = shortDate(fromIso);
  const to = shortDate(toIso ?? fromIso);
  if (from === to) return from;

  const sameMonth = new Date(fromIso).getMonth() === new Date(toIso).getMonth();
  const start = sameMonth
    ? new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric' }).format(new Date(fromIso))
    : from;
  return `${start} – ${to}`;
}

const TABS = [
  { key: 'live', href: '/', label: 'Live', icon: '<circle cx="12" cy="12" r="9"/><path d="m12 7 3.5 2.5-1.3 4h-4.4l-1.3-4Z"/>' },
  { key: 'history', href: '/history', label: 'History', icon: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>' },
  { key: 'table', href: '/leaderboard', label: 'Table', icon: '<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/>' },
];

/** Fixed bottom tab bar; `active` is one of live | history | table. */
export function mountTabbar(active) {
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Main');
  nav.className = 'fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-black/70 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl';
  nav.innerHTML = `
    <div class="mx-auto grid max-w-md grid-cols-3">
      ${TABS.map((tab) => {
        const on = tab.key === active;
        return `
          <a href="${tab.href}" ${on ? 'aria-current="page"' : ''} class="relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${on ? 'text-white' : 'text-zinc-500'}">
            ${on ? '<span class="grad-win absolute top-0 h-0.5 w-10"></span>' : ''}
            <svg class="size-6 ${on ? 'text-emerald-400' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${tab.icon}</svg>
            ${tab.label}
          </a>`;
      }).join('')}
    </div>`;
  document.body.append(nav);
}

/** Shared top bar: brand on the left, optional actions on the right. */
export const brand = () => `
  <a href="/" class="flex items-center gap-2 font-display text-sm font-bold tracking-wide text-zinc-300">
    <span class="grad-win grid size-7 place-items-center rounded-xs text-base shadow-[0_4px_20px_-4px_rgb(16_185_129/0.8)]">⚽</span>
    BETS
  </a>`;
