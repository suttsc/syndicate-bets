import { loadBoard, loadFixtures, savePicks } from './api.js';
import { LEAGUES } from './leagues.js';
import { crest, esc, kickoffTime, longDate } from './ui.js';

const PASSWORD_KEY = 'bets.adminPassword';

const $ = (id) => document.getElementById(id);

/** @type {Array<{league: string, date: string, eventId: string|null, teamId: string|null, fixtures: Array|null, loading: boolean}>} */
let slots = [];

const storage = {
  get: (key) => { try { return localStorage.getItem(key) ?? ''; } catch { return ''; } },
  set: (key, value) => { try { localStorage.setItem(key, value); } catch { /* private mode */ } },
};

function nextSaturday() {
  const date = new Date();
  date.setDate(date.getDate() + ((6 - date.getDay() + 7) % 7));
  return date.toISOString().slice(0, 10);
}

function newSlot(overrides = {}) {
  return { league: 'eng.1', date: nextSaturday(), eventId: null, teamId: null, fixtures: null, loading: false, ...overrides };
}

async function fetchFixtures(slot) {
  slot.loading = true;
  render();

  try {
    slot.fixtures = await loadFixtures(slot.league, slot.date);
  } catch {
    slot.fixtures = [];
  } finally {
    slot.loading = false;
    render();
  }
}

function render() {
  $('slots').innerHTML = slots.map(slotCard).join('');
  const complete = slots.length > 0 && slots.every((s) => s.eventId && s.teamId);
  $('save').disabled = !complete;
  if (!complete && slots.length) {
    $('save-status').textContent = `${slots.filter((s) => s.eventId && s.teamId).length} of ${slots.length} games ready`;
  }
}

function slotCard(slot, index) {
  const field = 'mt-1.5 block h-12 w-full rounded-xl border-0 bg-slate-100 px-3 text-base outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800';
  const event = slot.fixtures?.find((f) => f.id === slot.eventId);

  let matchControl;
  if (slot.loading) {
    matchControl = `<div class="mt-1.5 h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"></div>`;
  } else if (slot.fixtures?.length === 0) {
    matchControl = `<p class="mt-1.5 rounded-xl bg-slate-100 px-3 py-3.5 text-sm text-slate-500 dark:bg-slate-800">No games on ${esc(longDate(slot.date))}</p>`;
  } else {
    matchControl = `
      <select data-field="eventId" data-index="${index}" class="${field}">
        <option value="">Choose a match…</option>
        ${(slot.fixtures ?? [])
          .map((f) => `<option value="${esc(f.id)}" ${f.id === slot.eventId ? 'selected' : ''}>${esc(f.home.name)} v ${esc(f.away.name)} · ${esc(kickoffTime(f.kickoff))}</option>`)
          .join('')}
      </select>`;
  }

  const teamButton = (team) => {
    const active = team.id === slot.teamId;
    return `
      <button type="button" data-team="${esc(team.id)}" data-index="${index}" aria-pressed="${active}"
        class="flex min-h-14 items-center gap-2 rounded-xl p-2 text-left text-sm font-semibold ring-2 transition active:scale-[.98] ${active ? 'bg-emerald-500/10 ring-emerald-500' : 'bg-slate-100 ring-transparent dark:bg-slate-800'}">
        ${crest(team, 'size-8')}<span class="min-w-0 flex-1 leading-tight">${esc(team.name)}</span>
        ${active ? '<svg class="size-5 shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>' : ''}
      </button>`;
  };

  return `
    <li class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <div class="flex items-center justify-between">
        <h2 class="font-bold">Game ${index + 1}</h2>
        <button type="button" data-remove="${index}" class="-mr-2 rounded-lg px-2 py-1 text-sm font-semibold text-rose-600 active:bg-rose-500/10 dark:text-rose-400">Remove</button>
      </div>

      <div class="mt-2 grid gap-3 sm:grid-cols-[1fr_auto] sm:gap-2">
        <label class="block min-w-0">
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">League</span>
          <select data-field="league" data-index="${index}" class="${field}">
            ${LEAGUES.map((l) => `<option value="${l.slug}" ${l.slug === slot.league ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}
          </select>
        </label>
        <label class="block">
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Date</span>
          <input type="date" data-field="date" data-index="${index}" value="${esc(slot.date)}" class="${field} sm:w-[9.5rem]" />
        </label>
      </div>

      <label class="mt-3 block">
        <span class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Match</span>
        ${matchControl}
      </label>

      ${event ? `
        <fieldset class="mt-3">
          <legend class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Backing to win</legend>
          <div class="mt-1.5 grid grid-cols-2 gap-2">${teamButton(event.home)}${teamButton(event.away)}</div>
        </fieldset>` : ''}
    </li>`;
}

$('slots').addEventListener('change', (e) => {
  const { field, index } = e.target.dataset;
  if (!field) return;

  const slot = slots[Number(index)];
  slot[field] = e.target.value || null;

  if (field === 'eventId') {
    slot.teamId = null;
    render();
  } else {
    Object.assign(slot, { eventId: null, teamId: null });
    fetchFixtures(slot);
  }
});

$('slots').addEventListener('click', (e) => {
  const team = e.target.closest('[data-team]');
  const remove = e.target.closest('[data-remove]');

  if (team) {
    slots[Number(team.dataset.index)].teamId = team.dataset.team;
    render();
  } else if (remove) {
    slots.splice(Number(remove.dataset.remove), 1);
    render();
  }
});

$('add-slot').addEventListener('click', () => {
  const slot = newSlot({ league: slots.at(-1)?.league, date: slots.at(-1)?.date ?? nextSaturday() });
  slots.push(slot);
  fetchFixtures(slot);
});

$('password').value = storage.get(PASSWORD_KEY);
$('password').addEventListener('change', (e) => storage.set(PASSWORD_KEY, e.target.value));

$('save').addEventListener('click', async () => {
  $('save').disabled = true;
  $('save-status').textContent = 'Saving…';

  try {
    const picks = slots.map(({ league, date, eventId, teamId }) => ({ league, date, eventId, teamId }));
    const { updatedAt } = await savePicks(picks, $('password').value);
    $('save-status').innerHTML = '<span class="font-semibold text-emerald-600 dark:text-emerald-400">Saved ✓ Everyone sees these now</span>';
    $('last-saved').textContent = `Last saved ${longDate(updatedAt)}`;
  } catch (error) {
    $('save-status').innerHTML = `<span class="font-semibold text-rose-600 dark:text-rose-400">${esc(error.message)}</span>`;
  } finally {
    $('save').disabled = false;
  }
});

// Start from the current picks so editing one game doesn't mean re-entering all four.
const { picks, events, updatedAt } = await loadBoard();
$('last-saved').textContent = `Last saved ${longDate(updatedAt)}`;

slots = picks.length
  ? picks.map((p) => newSlot({ ...p, fixtures: events.filter((e) => e.league === p.league) }))
  : Array.from({ length: 4 }, () => newSlot());

render();
slots.filter((s) => !s.fixtures).forEach(fetchFixtures);
