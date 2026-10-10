import { createRound, loadFixtures, loadRound, updateRound } from './api.js';
import { LEAGUES, PEOPLE, personColor } from './config.js';
import { crest, esc, kickoffTime, shortDate } from './ui.js';

const PASSWORD_KEY = 'bets.adminPassword';

const $ = (id) => document.getElementById(id);

const storage = {
  get: (key) => { try { return localStorage.getItem(key) ?? ''; } catch { return ''; } },
  set: (key, value) => { try { localStorage.setItem(key, value); } catch { /* private mode */ } },
};

/** @type {{mode: 'new'|'edit', latest: null|{round: object, picks: Array, events: Array}, theGuy: string|null, slots: Array}} */
const state = { mode: 'new', latest: null, theGuy: null, slots: [] };

const FIELD = 'mt-2 block h-12 w-full rounded-xs border-0 bg-white/5 px-3 text-base text-white ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-emerald-400';
const LABEL = 'text-[11px] font-semibold tracking-wider text-zinc-400 uppercase';

function nextSaturday() {
  const date = new Date();
  date.setDate(date.getDate() + ((6 - date.getDay() + 7) % 7));
  return date.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
}

function newSlot(overrides = {}) {
  return { picker: null, league: 'eng.1', date: nextSaturday(), eventId: null, teamId: null, fixtures: null, loading: false, ...overrides };
}

const isReady = (slot) => slot.picker && slot.eventId && slot.teamId;
const nextNumber = () => (state.latest?.round.number ?? 0) + 1;

/** Fill the form for a fresh round, or with the latest round's picks for editing. */
function setMode(mode) {
  state.mode = mode;

  if (mode === 'edit' && state.latest) {
    const { round, picks, events } = state.latest;
    state.theGuy = round.theGuy;
    state.slots = picks.map((p) => {
      const event = events.find((e) => e.id === p.eventId);
      return newSlot({ ...p, date: event?.kickoff.slice(0, 10), fixtures: events.filter((e) => e.league === p.league) });
    });
  } else {
    state.theGuy = null;
    state.slots = PEOPLE.map(({ name }) => newSlot({ picker: name }));
  }

  $('save-status').textContent = '';
  render();
  state.slots.filter((s) => !s.fixtures).forEach(fetchFixtures);
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

/** A row of name buttons; used for The Guy and for each game's picker. */
function personButtons({ selected, attrs, dimmed = [], activeClass = '', activeStyle = (name) => `background:${personColor(name)}` }) {
  return PEOPLE.map(({ name }) => {
    const active = name === selected;
    return `
      <button type="button" ${attrs(name)} aria-pressed="${active}"
        class="h-11 rounded-xs text-sm font-bold transition active:scale-95 ${active ? `text-white shadow-lg ${activeClass}` : 'bg-white/5 text-zinc-300 ring-1 ring-white/10'} ${!active && dimmed.includes(name) ? 'opacity-35' : ''}"
        ${active ? `style="${activeStyle(name)}"` : ''}>${name}</button>`;
  }).join('');
}

function render() {
  const latest = state.latest?.round;

  $('subtitle').textContent = state.mode === 'edit' ? `Editing round ${latest.number}` : `Starting round ${nextNumber()}`;

  const tab = (mode, label, disabled = false) => `
    <button type="button" role="tab" data-mode="${mode}" aria-selected="${state.mode === mode}" ${disabled ? 'disabled' : ''}
      class="h-11 rounded-xs font-display text-sm font-bold transition disabled:opacity-30 ${state.mode === mode ? 'grad-win text-black shadow-[0_6px_24px_-8px_rgb(16_185_129/0.8)]' : 'text-zinc-400'}">${label}</button>`;
  $('mode').innerHTML = tab('new', `New round ${nextNumber()}`) + tab('edit', latest ? `Edit round ${latest.number}` : 'Edit round', !latest);

  $('the-guy').innerHTML = personButtons({
    selected: state.theGuy,
    attrs: (name) => `data-guy="${name}"`,
    activeClass: 'grad-guy !text-black',
    activeStyle: () => '',
  });

  $('slots').innerHTML = state.slots.map(slotCard).join('');

  const ready = state.slots.filter(isReady).length;
  const complete = state.slots.length > 0 && ready === state.slots.length && state.theGuy;
  $('save').disabled = !complete;

  if (!state.slots.length) {
    $('save-status').textContent = 'Add a game';
  } else if (!state.theGuy) {
    $('save-status').textContent = 'Choose The Guy';
  } else {
    $('save-status').textContent = complete ? 'Ready to save' : `${ready} of ${state.slots.length} games ready`;
  }
}

function slotCard(slot, index) {
  const event = slot.fixtures?.find((f) => f.id === slot.eventId);

  let matchControl;
  if (slot.loading) {
    matchControl = '<div class="mt-2 h-12 animate-pulse rounded-xs bg-white/5"></div>';
  } else if (slot.fixtures?.length === 0) {
    matchControl = `<p class="mt-2 rounded-xs bg-white/5 px-3 py-3.5 text-sm text-zinc-500">No games on ${esc(shortDate(slot.date))}</p>`;
  } else {
    matchControl = `
      <select data-field="eventId" data-index="${index}" class="${FIELD}">
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
        class="flex min-h-14 items-center gap-2 rounded-xs p-2 text-left text-sm font-semibold transition active:scale-[.98] ${active ? 'bg-emerald-400/10 ring-2 ring-emerald-400' : 'bg-white/5 ring-1 ring-white/10'}">
        ${crest(team, 'size-8')}<span class="min-w-0 flex-1 leading-tight">${esc(team.name)}</span>
        ${active ? '<svg class="size-5 shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>' : ''}
      </button>`;
  };

  return `
    <li class="glass relative overflow-hidden rounded-xs p-4">
      <div class="flex items-center justify-between">
        <h2 class="font-display font-bold">Game ${index + 1}</h2>
        <button type="button" data-remove="${index}" class="-mr-2 rounded-xs px-2 py-1 text-sm font-semibold text-rose-400 active:bg-rose-500/10">Remove</button>
      </div>

      <fieldset class="mt-2">
        <legend class="${LABEL}">Picked by</legend>
        <div class="mt-2 grid grid-cols-4 gap-2">
          ${personButtons({
            selected: slot.picker,
            attrs: (name) => `data-picker="${name}" data-index="${index}"`,
            dimmed: state.slots.filter((s) => s !== slot).map((s) => s.picker),
          })}
        </div>
      </fieldset>

      <div class="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:gap-2">
        <label class="block min-w-0">
          <span class="${LABEL}">League</span>
          <select data-field="league" data-index="${index}" class="${FIELD}">
            ${LEAGUES.map((l) => `<option value="${l.slug}" ${l.slug === slot.league ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}
          </select>
        </label>
        <label class="block">
          <span class="${LABEL}">Date</span>
          <input type="date" data-field="date" data-index="${index}" value="${esc(slot.date)}" class="${FIELD} sm:w-[9.5rem]" />
        </label>
      </div>

      <label class="mt-3 block">
        <span class="${LABEL}">Match</span>
        ${matchControl}
      </label>

      ${event ? `
        <fieldset class="mt-3">
          <legend class="${LABEL}">Backing to win</legend>
          <div class="mt-2 grid grid-cols-2 gap-2">${teamButton(event.home)}${teamButton(event.away)}</div>
        </fieldset>` : ''}
    </li>`;
}

$('mode').addEventListener('click', (e) => {
  const tab = e.target.closest('[data-mode]');
  if (tab && !tab.disabled && tab.dataset.mode !== state.mode) {
    setMode(tab.dataset.mode);
  }
});

$('the-guy').addEventListener('click', (e) => {
  const button = e.target.closest('[data-guy]');
  if (button) {
    state.theGuy = button.dataset.guy;
    render();
  }
});

$('slots').addEventListener('change', (e) => {
  const { field, index } = e.target.dataset;
  if (!field) return;

  const slot = state.slots[Number(index)];
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
  const person = e.target.closest('[data-picker]');

  if (person) {
    state.slots[Number(person.dataset.index)].picker = person.dataset.picker;
  } else if (team) {
    state.slots[Number(team.dataset.index)].teamId = team.dataset.team;
  } else if (remove) {
    state.slots.splice(Number(remove.dataset.remove), 1);
  } else {
    return;
  }

  render();
});

$('add-slot').addEventListener('click', () => {
  const last = state.slots.at(-1);
  const slot = newSlot({ league: last?.league, date: last?.date ?? nextSaturday() });
  state.slots.push(slot);
  fetchFixtures(slot);
});

$('password').value = storage.get(PASSWORD_KEY);
$('password').addEventListener('change', (e) => storage.set(PASSWORD_KEY, e.target.value));

$('save').addEventListener('click', async () => {
  $('save').disabled = true;
  $('save-status').textContent = 'Saving…';

  const payload = {
    theGuy: state.theGuy,
    picks: state.slots.map(({ picker, league, date, eventId, teamId }) => ({ picker, league, date, eventId, teamId })),
  };

  try {
    const saved = state.mode === 'edit'
      ? await updateRound(state.latest.round.number, payload, $('password').value)
      : await createRound(payload, $('password').value);

    $('save-status').innerHTML = `<span class="font-semibold text-emerald-400">Round ${saved.number} saved ✓ Everyone can see it now</span>`;
  } catch (error) {
    $('save-status').innerHTML = `<span class="font-semibold text-rose-400">${esc(error.message)}</span>`;
  } finally {
    $('save').disabled = false;
  }
});

// Default to editing an unfinished round, otherwise start the next one.
state.latest = await loadRound('latest');
setMode(state.latest?.round.status === 'open' ? 'edit' : 'new');
