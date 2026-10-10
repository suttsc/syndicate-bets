import { loadRounds } from './api.js';
import { avatar, brand, dateRange, esc, mountTabbar, resultDot } from './ui.js';

const $ = (id) => document.getElementById(id);

function roundRow(round) {
  const settled = round.results.filter((r) => r.status !== 'void');
  const won = settled.filter((r) => r.final && r.status === 'winning').length;
  const open = round.status === 'open';
  const good = won * 2 >= settled.length;

  // Each disc is a pick: coloured by result, lettered with the picker's initial.
  const dots = round.results.map((r) => resultDot(r.status, r.picker[0])).join('');

  return `
    <a href="/round/${round.number}" class="glass relative flex items-center gap-4 overflow-hidden rounded-3xl p-4 transition active:scale-[0.99]">
      ${open ? '<span class="grad-win absolute inset-y-0 left-0 w-1"></span>' : ''}
      <div class="w-14 shrink-0 text-center">
        <p class="text-[10px] font-semibold tracking-[0.25em] text-zinc-500 uppercase">Rnd</p>
        <p class="font-display text-3xl leading-none font-bold tabular">${round.number}</p>
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm text-zinc-300">${esc(dateRange(round.from, round.to))}</p>
        <p class="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
          ${avatar(round.theGuy, 'size-4 text-[9px]')}<span><span class="text-orange-300">👑</span> ${esc(round.theGuy)}</span>
        </p>
        <div class="mt-2 flex gap-1.5">${dots}</div>
      </div>
      <div class="shrink-0 text-right">
        ${open
          ? '<span class="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-bold text-red-200 ring-1 ring-red-400/30"><span class="size-1.5 animate-pulse rounded-full bg-red-400"></span>Live</span>'
          : `<p class="font-display text-3xl leading-none font-bold tabular"><span class="${good ? 'grad-win' : 'grad-lose'} text-grad">${won}</span><span class="text-lg text-zinc-500">/${settled.length}</span></p>
             <p class="mt-1 text-[11px] text-zinc-500">won</p>`}
      </div>
    </a>`;
}

async function init() {
  $('brand').innerHTML = brand();
  mountTabbar('history');

  const rounds = await loadRounds();

  $('content').innerHTML = rounds.length
    ? rounds.map(roundRow).join('')
    : '<div class="glass rounded-3xl p-10 text-center text-zinc-400">No rounds yet.</div>';
}

init();
