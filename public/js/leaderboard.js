import { loadLeaderboard } from './api.js';
import { avatar, brand, esc, mountTabbar, resultDot } from './ui.js';

const $ = (id) => document.getElementById(id);

const winRate = (p) => (p.played ? Math.round((p.won / p.played) * 100) : 0);

function row(person, position) {
  const leader = position === 1;

  return `
    <li class="glass ${leader ? 'glow-win' : ''} relative overflow-hidden rounded-3xl p-4">
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
          <p class="mt-1 text-[11px] text-zinc-500 tabular">${person.won} of ${person.played}</p>
        </div>
      </div>
      <div class="relative mt-3 flex items-center gap-1.5 border-t border-white/[0.06] pt-3">
        <p class="mr-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">Form</p>
        ${person.form.map((status) => resultDot(status, undefined, 'size-6')).join('')}
      </div>
    </li>`;
}

async function init() {
  $('brand').innerHTML = brand();
  mountTabbar('table');

  // Most wins first; win rate breaks ties.
  const people = (await loadLeaderboard()).sort((a, b) => b.won - a.won || winRate(b) - winRate(a));

  $('content').innerHTML = `<ol class="space-y-3">${people.map((p, i) => row(p, i + 1)).join('')}</ol>`;
}

init();
