import { loadLeaderboard } from './api.js';
import { seasonFor, seasonFromSlug, seasonSlug } from './season.js';
import { avatar, brand, esc, mountTabbar, resultDot } from './ui.js';

const $ = (id) => document.getElementById(id);

const winRate = (p) => (p.played ? Math.round((p.won / p.played) * 100) : 0);

function row(person, position) {
  const leader = position === 1;

  return `
    <li class="glass ${leader ? 'glow-win' : ''} relative overflow-hidden rounded-xs p-4">
      ${leader ? '<span class="grad-win pointer-events-none absolute -top-20 -left-16 size-48 rounded-full opacity-20 blur-3xl"></span>' : ''}
      <div class="relative flex items-center gap-3">
        <p class="w-6 shrink-0 text-center font-display text-lg font-bold ${leader ? 'grad-win text-grad' : 'text-zinc-500'}">${position}</p>
        ${avatar(person.name, 'size-10 text-sm')}
        <div class="min-w-0 flex-1">
          <p class="truncate font-display text-lg font-bold">${esc(person.name)}</p>
          <p class="text-xs text-zinc-500">
            ${person.won}W · ${person.drew}D · ${person.lost}L
            ${person.guyRounds ? `· <span class="text-orange-300">👑 ${person.guyRounds}×</span>` : ''}
          </p>
        </div>
        <div class="shrink-0 text-right">
          <p class="font-display text-3xl leading-none font-bold tabular"><span class="${leader ? 'grad-win text-grad' : ''}">${winRate(person)}</span><span class="text-base text-zinc-500">%</span></p>
          <p class="mt-1 text-[7.5px] text-zinc-500 tabular">${person.won} of ${person.played}</p>
        </div>
      </div>
      <div class="relative mt-3 flex items-center gap-1.5 border-t border-white/[0.06] pt-3">
        <p class="mr-1 text-[6.5px] font-semibold tracking-wider text-zinc-500 uppercase">Form</p>
        ${person.form.map((status) => resultDot(status, undefined, 'size-6')).join('')}
      </div>
    </li>`;
}

const ALL_TIME = 'all';

function seasonTabs(seasons, active) {
  const tab = (value, label) => {
    const on = value === active;
    return `<button type="button" data-season="${esc(value)}" aria-pressed="${on}"
      class="h-9 shrink-0 rounded-xs px-3 font-display text-sm font-bold transition active:scale-95 ${on ? 'grad-win text-black' : 'glass text-zinc-400'}">${esc(label)}</button>`;
  };
  return [...seasons.map((s) => tab(s, s)), tab(ALL_TIME, 'All time')].join('');
}

async function show(selected) {
  const data = await loadLeaderboard(selected === ALL_TIME ? null : selected);

  // Most wins first; win rate breaks ties.
  const people = data.people.sort((a, b) => b.won - a.won || winRate(b) - winRate(a));
  const empty = people.every((p) => p.played === 0);

  $('content').innerHTML = `
    <div id="seasons" class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">${seasonTabs(data.seasons, selected)}</div>
    ${empty
      ? '<div class="glass rounded-xs p-10 text-center text-zinc-400">No finished games yet.</div>'
      : `<ol class="space-y-3">${people.map((p, i) => row(p, i + 1)).join('')}</ol>`}`;

  return data;
}

async function init() {
  $('brand').innerHTML = brand();
  mountTabbar('table');

  // ?season=2026-27 or ?season=all; default to the current season (or the latest one with rounds).
  const param = new URLSearchParams(location.search).get('season');
  const requested = param === ALL_TIME ? ALL_TIME : param ? seasonFromSlug(param) : seasonFor();
  const data = await show(requested);

  if (!param && !data.seasons.includes(requested)) {
    await show(data.seasons[0] ?? ALL_TIME);
  }

  $('content').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-season]');
    if (!tab) return;

    const url = new URL(location.href);
    url.searchParams.set('season', tab.dataset.season === ALL_TIME ? ALL_TIME : seasonSlug(tab.dataset.season));
    history.replaceState(null, '', url);
    show(tab.dataset.season);
  });
}

init();
