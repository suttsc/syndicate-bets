import { loadRound } from './api.js';
import { leagueName } from './config.js';
import { roundPath, seasonFromSlug } from './season.js';
import { outcome, summarise } from './outcome.js';
import { STATUS_STYLES, brand, clockTime, crest, dateRange, esc, kickoffTime, mountTabbar, picker, statusPill } from './ui.js';

const LIVE_REFRESH_MS = 60_000;
const IDLE_REFRESH_MS = 5 * 60_000;

const $ = (id) => document.getElementById(id);

// /round/2026-27/9 → { season: "2026/27", number: 9 }; anything else → latest
const [, slug, number] = location.pathname.match(/^\/round\/(\d{4}-\d{2})\/(\d+)/) ?? [];
const requested = slug ? { season: seasonFromSlug(slug), number: Number(number) } : 'latest';

let timer;

async function refresh() {
  clearTimeout(timer);
  $('refresh-icon').classList.add('animate-spin');

  try {
    const data = await loadRound(requested);

    if (!data) {
      renderEmpty();
      return;
    }

    const { round, picks, events, prev, next } = data;
    const rows = picks.map((pick) => {
      const event = events.find((e) => e.id === pick.eventId);
      return { pick, event, result: outcome(event, pick.teamId) };
    });
    const summary = summarise(rows.map((r) => r.result));

    document.title = `Syndicate Bets · Round ${round.number} · ${round.season}`;
    renderRoundHead(round, rows, summary, prev, next);
    renderSummary(summary);
    $('games').innerHTML = rows.map((row) => gameCard(row, round.theGuy)).join('');
    $('updated').textContent = data.warning
      ?? (round.status === 'complete' ? 'Round complete' : `Updated ${clockTime()} · refreshes automatically`);

    // Finished rounds never change, so stop polling.
    if (round.status !== 'complete') {
      timer = setTimeout(refresh, summary.live > 0 ? LIVE_REFRESH_MS : IDLE_REFRESH_MS);
    }
  } catch (error) {
    $('updated').textContent = `Couldn't load scores (${error.message}). Retrying in a minute.`;
    timer = setTimeout(refresh, LIVE_REFRESH_MS);
  } finally {
    $('refresh-icon').classList.remove('animate-spin');
  }
}

function renderRoundHead(round, rows, summary, prev, next) {
  const kickoffs = rows.map((r) => r.event?.kickoff).filter(Boolean).sort();
  const live = summary.live
    ? ` · <span class="inline-flex items-center gap-1 font-semibold text-red-300"><span class="size-1.5 animate-pulse rounded-full bg-red-400"></span>${summary.live} live</span>`
    : '';

  const arrow = (target, dir) => {
    const path = dir === 'prev' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6';
    const label = dir === 'prev' ? 'Previous round' : 'Next round';
    const icon = `<svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
    return target
      ? `<a href="${roundPath(target)}" aria-label="${label} (${target.season} round ${target.number})" class="glass grid size-11 shrink-0 place-items-center rounded-xs text-zinc-200 transition active:scale-90">${icon}</a>`
      : `<span class="grid size-11 shrink-0 place-items-center rounded-xs text-zinc-700" aria-hidden="true">${icon}</span>`;
  };

  $('round-head').innerHTML = `
    ${arrow(prev, 'prev')}
    <div class="min-w-0 text-center">
      <p class="text-[7.5px] font-semibold tracking-[0.35em] text-zinc-500 uppercase">${esc(round.season)} · Round</p>
      <h1 class="grad-win text-grad font-display text-6xl leading-none font-bold tracking-tight tabular">${round.number}</h1>
      <p class="mt-1.5 text-sm text-zinc-400">${esc(dateRange(kickoffs[0], kickoffs.at(-1)))}${live}</p>
    </div>
    ${arrow(next, 'next')}`;
}

function renderSummary(summary) {
  const { counts } = summary;
  const bar = segmentBar(summary);

  if (summary.allFinal) {
    const good = summary.won * 2 >= summary.settledTotal;
    const grad = good ? 'grad-win' : 'grad-lose';

    $('summary').innerHTML = `
      <div class="glass ${good ? 'glow-win' : 'glow-lose'} relative overflow-hidden rounded-xs p-5">
        <div class="${grad} absolute -top-24 -right-20 size-56 rounded-full opacity-25 blur-3xl"></div>
        <p class="text-[7.5px] font-semibold tracking-[0.3em] text-zinc-400 uppercase">Full time</p>
        <p class="mt-1 font-display font-bold tracking-tight">
          <span class="${grad} text-grad text-6xl tabular">${summary.won}</span>
          <span class="text-2xl text-zinc-400">of ${summary.settledTotal} won</span>
        </p>
        <div class="mt-4">${bar}</div>
        <p class="mt-2.5 text-xs text-zinc-400">${counts.drawing} drew · ${counts.losing} lost${counts.void ? ` · ${counts.void} void` : ''}</p>
      </div>`;
    return;
  }

  const tile = (key) => {
    const style = STATUS_STYLES[key];
    const value = counts[key];
    return `
      <div class="glass relative overflow-hidden rounded-xs px-2 py-3 text-center">
        ${value ? `<span class="${style.grad} absolute -top-10 left-1/2 size-20 -translate-x-1/2 rounded-full opacity-20 blur-2xl"></span>` : ''}
        <p class="relative font-display text-4xl font-bold tabular ${value ? `${style.grad} text-grad` : 'text-zinc-700'}">${value}</p>
        <p class="relative text-[7.5px] font-semibold tracking-wider text-zinc-400 uppercase">${style.label}</p>
      </div>`;
  };

  const extras = [counts.pending && `${counts.pending} to play`, counts.void && `${counts.void} void`].filter(Boolean);

  $('summary').innerHTML = `
    <div class="grid grid-cols-3 gap-2">${tile('winning')}${tile('drawing')}${tile('losing')}</div>
    <div class="mt-3 flex items-center gap-3">
      <div class="flex-1">${bar}</div>
      ${extras.length ? `<p class="shrink-0 text-xs text-zinc-500">${extras.join(' · ')}</p>` : ''}
    </div>`;
}

/** One segment per game, ordered best to worst, so the bar reads like a meter. */
function segmentBar({ counts }) {
  const segments = ['winning', 'drawing', 'losing', 'pending', 'void'].flatMap((key) => Array(counts[key]).fill(key));

  return `<div class="flex h-1.5 gap-1" role="img" aria-label="${segments.join(', ')}">${segments
    .map((key) => `<span class="${STATUS_STYLES[key].grad} flex-1 rounded-xs"></span>`)
    .join('')}</div>`;
}

function renderEmpty() {
  $('round-head').innerHTML = '';
  $('summary').innerHTML = '';
  $('updated').textContent = '';
  $('games').innerHTML = `
    <div class="glass rounded-xs p-10 text-center md:col-span-2">
      <p class="text-4xl">⚽</p>
      <p class="mt-3 font-display text-lg font-bold">No rounds yet</p>
      <p class="mt-1 text-sm text-zinc-400">Check back once the first bets are in.</p>
    </div>`;
}

function gameCard({ pick, event, result }, theGuy) {
  if (!event) {
    return `<article class="glass rounded-xs p-4 text-sm text-zinc-400">Game not found (${esc(pick.league)})</article>`;
  }

  const style = STATUS_STYLES[result.status];
  const showScore = event.state !== 'pre' && !event.postponed;

  const teamRow = (team) => {
    const backed = team.id === pick.teamId;
    return `
      <div class="flex items-center gap-3">
        ${crest(team)}
        <p class="min-w-0 flex-1 truncate ${backed ? 'font-semibold text-white' : 'text-zinc-400'}">
          ${esc(team.name)}
          ${backed ? '<span class="ml-1 rounded-xs bg-white/10 px-1.5 py-0.5 align-middle text-[6.5px] font-bold tracking-wider text-zinc-200 uppercase">Pick</span>' : ''}
        </p>
        <p class="w-8 text-right font-display text-3xl font-bold tabular ${backed ? 'text-white' : 'text-zinc-500'}">${showScore ? esc(team.score) : ''}</p>
      </div>`;
  };

  return `
    <article class="glass ${style.glow} relative overflow-hidden rounded-xs">
      ${style.grad !== 'grad-muted' ? `<span class="${style.grad} pointer-events-none absolute -top-16 -right-16 size-40 rounded-full opacity-[0.12] blur-3xl" aria-hidden="true"></span>` : ''}
      <div class="relative flex items-center justify-between gap-2 px-4 pt-4">
        ${picker(pick.picker, pick.picker === theGuy)}
        ${statusChip(event)}
      </div>
      <div class="relative space-y-2.5 px-4 py-4">
        ${teamRow(event.home)}
        ${teamRow(event.away)}
      </div>
      <div class="relative flex items-center justify-between gap-2 border-t border-white/[0.06] px-4 py-2.5">
        <p class="truncate text-[7.5px] font-semibold tracking-wider text-zinc-500 uppercase">${esc(leagueName(event.league))}</p>
        ${statusPill(result)}
      </div>
    </article>`;
}

function statusChip(event) {
  const base = 'inline-flex shrink-0 items-center gap-1.5 rounded-xs px-2.5 py-1 text-xs font-bold';

  if (event.postponed) {
    return `<span class="${base} bg-white/5 text-zinc-400">Postponed</span>`;
  }

  if (event.state === 'in') {
    return `
      <span class="${base} bg-red-500/15 text-red-200 ring-1 ring-red-400/30">
        <span class="relative flex size-2"><span class="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75"></span><span class="relative inline-flex size-2 rounded-full bg-red-400"></span></span>
        ${esc(event.detail)}
      </span>`;
  }

  if (event.state === 'post') {
    return `<span class="${base} bg-white/5 text-zinc-300">${esc(event.detail || 'FT')}</span>`;
  }

  return `<span class="${base} bg-white/5 text-zinc-300 tabular">${esc(kickoffTime(event.kickoff))}</span>`;
}

$('brand').innerHTML = brand();
mountTabbar('live');
$('refresh').addEventListener('click', refresh);
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && refresh());

refresh();
