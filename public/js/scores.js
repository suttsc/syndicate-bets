import { loadBoard } from './api.js';
import { leagueName } from './leagues.js';
import { outcome, summarise } from './outcome.js';
import { STATUS_STYLES, clockTime, crest, esc, kickoffTime, longDate } from './ui.js';

const LIVE_REFRESH_MS = 60_000;
const IDLE_REFRESH_MS = 5 * 60_000;

const $ = (id) => document.getElementById(id);

let timer;

async function refresh() {
  clearTimeout(timer);
  $('refresh-icon').classList.add('animate-spin');

  try {
    const { picks, events } = await loadBoard();
    const rows = picks.map((pick) => {
      const event = events.find((e) => e.id === pick.eventId);
      return { pick, event, result: outcome(event, pick.teamId) };
    });

    const summary = summarise(rows.map((r) => r.result));

    renderSubtitle(rows, summary);
    renderSummary(summary);
    renderGames(rows);
    $('updated').textContent = `Updated ${clockTime()} · refreshes automatically`;

    timer = setTimeout(refresh, summary.live > 0 ? LIVE_REFRESH_MS : IDLE_REFRESH_MS);
  } catch (error) {
    $('updated').textContent = `Couldn't load scores (${error.message}). Retrying in a minute.`;
    timer = setTimeout(refresh, LIVE_REFRESH_MS);
  } finally {
    $('refresh-icon').classList.remove('animate-spin');
  }
}

function renderSubtitle(rows, summary) {
  const dates = rows.map((r) => r.event?.kickoff).filter(Boolean).sort();
  const range = dates.length ? [...new Set([dates[0], dates.at(-1)].map(longDate))].join(' – ') : 'No games set';
  const live = summary.live ? ` · <span class="font-semibold text-rose-600 dark:text-rose-400">${summary.live} live</span>` : '';

  $('subtitle').innerHTML = `${esc(range)}${live}`;
}

function renderSummary(summary) {
  const { counts, total } = summary;

  if (total === 0) {
    $('summary').innerHTML = '';
    return;
  }

  const bar = segmentBar(summary);

  if (summary.allFinal) {
    $('summary').innerHTML = `
      <div class="rounded-2xl bg-slate-900 p-4 text-white shadow-lg dark:bg-white dark:text-slate-900">
        <p class="text-xs font-semibold uppercase tracking-widest opacity-60">Full time</p>
        <p class="mt-1 text-4xl font-black tracking-tight tabular">${summary.won} <span class="text-xl font-bold opacity-60">of ${summary.settledTotal} won</span></p>
        <div class="mt-3">${bar}</div>
        <p class="mt-2 text-xs opacity-70">${counts.drawing} drew · ${counts.losing} lost${counts.void ? ` · ${counts.void} void` : ''}</p>
      </div>`;
    return;
  }

  const tile = (key) => {
    const style = STATUS_STYLES[key];
    return `
      <div class="rounded-xl bg-white p-3 text-center ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <p class="text-3xl font-black tabular ${counts[key] ? style.text : 'text-slate-300 dark:text-slate-700'}">${counts[key]}</p>
        <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">${style.label}</p>
      </div>`;
  };

  const extras = [
    counts.pending && `${counts.pending} not started`,
    counts.void && `${counts.void} void`,
  ].filter(Boolean);

  $('summary').innerHTML = `
    <div class="grid grid-cols-3 gap-2">${tile('winning')}${tile('drawing')}${tile('losing')}</div>
    <div class="mt-2 flex items-center gap-3">
      <div class="flex-1">${bar}</div>
      <p class="shrink-0 text-xs text-slate-500 dark:text-slate-400">${extras.join(' · ') || `${total} games`}</p>
    </div>`;
}

/** One segment per game, ordered best to worst, so the bar reads like a progress meter. */
function segmentBar({ counts }) {
  const order = ['winning', 'drawing', 'losing', 'pending', 'void'];
  const segments = order.flatMap((key) => Array(counts[key]).fill(key));

  return `<div class="flex h-2 gap-1" role="img" aria-label="${segments.join(', ')}">${segments
    .map((key) => `<span class="flex-1 rounded-full ${STATUS_STYLES[key].bg}"></span>`)
    .join('')}</div>`;
}

function renderGames(rows) {
  if (rows.length === 0) {
    $('games').innerHTML = `
      <div class="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center text-slate-500 md:col-span-2 dark:border-slate-800">
        <p class="text-3xl">⚽</p>
        <p class="mt-2 font-semibold">No games picked yet</p>
        <p class="text-sm">Check back once this week's bets are in.</p>
      </div>`;
    return;
  }

  $('games').innerHTML = rows.map(gameCard).join('');
}

function gameCard({ pick, event, result }) {
  if (!event) {
    return `<article class="rounded-2xl bg-white p-4 text-sm text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">Game not found (${esc(pick.league)} · ${esc(pick.date)})</article>`;
  }

  const style = STATUS_STYLES[result.status];
  const label = result.final ? style.finalLabel : style.label;
  const showScore = event.state !== 'pre' && !event.postponed;

  const teamRow = (team) => {
    const picked = team.id === pick.teamId;
    return `
      <div class="flex items-center gap-3 ${picked ? '' : 'opacity-60'}">
        ${crest(team)}
        <p class="min-w-0 flex-1 truncate ${picked ? 'font-bold' : 'font-medium'}">
          ${esc(team.name)}
          ${picked ? '<span class="ml-1 rounded bg-slate-900 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wider text-white dark:bg-white dark:text-slate-900">Pick</span>' : ''}
        </p>
        <p class="w-8 text-right text-2xl font-black tabular">${showScore ? esc(team.score) : ''}</p>
      </div>`;
  };

  return `
    <article class="relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <span class="absolute inset-y-0 left-0 w-1.5 ${style.bg}" aria-hidden="true"></span>
      <div class="flex items-center justify-between gap-2 px-4 pt-3 pl-5 text-xs">
        <p class="truncate font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">${esc(leagueName(event.league))}</p>
        ${statusChip(event)}
      </div>
      <div class="space-y-2.5 px-4 py-3 pl-5">
        ${teamRow(event.home)}
        ${teamRow(event.away)}
      </div>
      <div class="border-t border-slate-100 px-4 py-2 pl-5 dark:border-slate-800">
        <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${style.soft}">
          <span class="size-1.5 rounded-full ${style.bg}"></span>${label}
        </span>
      </div>
    </article>`;
}

function statusChip(event) {
  if (event.postponed) {
    return '<span class="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Postponed</span>';
  }

  if (event.state === 'in') {
    return `
      <span class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rose-500/10 px-2 py-0.5 font-bold text-rose-600 dark:text-rose-400">
        <span class="relative flex size-2"><span class="absolute inline-flex size-full animate-ping rounded-full bg-rose-500 opacity-75"></span><span class="relative inline-flex size-2 rounded-full bg-rose-500"></span></span>
        ${esc(event.detail)}
      </span>`;
  }

  if (event.state === 'post') {
    return `<span class="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">${esc(event.detail || 'FT')}</span>`;
  }

  return `<span class="shrink-0 font-semibold text-slate-600 tabular dark:text-slate-300">${esc(kickoffTime(event.kickoff))}</span>`;
}

$('refresh').addEventListener('click', refresh);
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && refresh());

refresh();
