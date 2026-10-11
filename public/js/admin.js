import { createRound, loadAllFixtures, loadFixtures, loadNextNumber, loadRound, loadRounds, updateRound } from './api.js';
import { LEAGUES, PEOPLE, leagueName, personColor } from './config.js';
import { isSeason, seasonFor } from './season.js';
import { crest, esc, kickoffTime, shortDate } from './ui.js';

const PASSWORD_KEY = 'bets.adminPassword';
const MIN_QUERY = 2;
const MAX_SUGGESTIONS = 8;

const $ = (id) => document.getElementById(id);

const storage = {
  get: (key) => { try { return localStorage.getItem(key) ?? ''; } catch { return ''; } },
  set: (key, value) => { try { localStorage.setItem(key, value); } catch { /* private mode */ } },
};

/**
 * mode:      'new' (nothing saved yet) or 'edit' (form is bound to an existing round)
 * editing:   { season, number } of the round being edited, as currently stored
 * season / number: what the round will be saved as (number null = next free one)
 */
const state = {
  mode: 'new',
  rounds: [],
  editing: null,
  season: seasonFor(),
  number: null,
  theGuy: null,
  slots: [],
  message: null,
};

// Every league's fixtures per date, fetched once per date and shared by all games' team search.
const allFixtures = new Map();

const FIELD = 'mt-2 block h-12 w-full rounded-xs border-0 bg-white/5 px-3 text-base text-white ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-emerald-400';
const LABEL = 'text-[11px] font-semibold tracking-wider text-zinc-400 uppercase';

const localDate = (iso) => new Date(iso).toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

function nextSaturday() {
  const date = new Date();
  date.setDate(date.getDate() + ((6 - date.getDay() + 7) % 7));
  return localDate(date.toISOString());
}

function newSlot(overrides = {}) {
  return { picker: null, league: 'eng.1', date: nextSaturday(), eventId: null, teamId: null, fixtures: null, loading: false, ...overrides };
}

const isReady = (slot) => slot.picker && slot.eventId && slot.teamId;
const sameRound = (a, b) => a && b && a.season === b.season && a.number === b.number;
const roundLabel = ({ season, number }) => `${season} · Round ${number}`;

function fixturesForDate(date) {
  if (!allFixtures.has(date)) {
    const request = loadAllFixtures(date).catch((error) => {
      allFixtures.delete(date); // let the next keystroke retry
      throw error;
    });
    allFixtures.set(date, request);
  }
  return allFixtures.get(date);
}

/** Start a blank round: one game per person, next free number in the current season. */
async function startNew() {
  Object.assign(state, {
    mode: 'new',
    editing: null,
    season: seasonFor(nextSaturday()),
    number: null,
    theGuy: null,
    slots: PEOPLE.map(({ name }) => newSlot({ picker: name })),
    message: null,
  });
  render();
  state.slots.forEach(fetchFixtures);
  state.number = await loadNextNumber(state.season);
  render();
}

/** Load an existing round into the form. */
async function startEdit(key) {
  const data = await loadRound(key);
  if (!data) return startNew();

  const { round, picks, events } = data;
  Object.assign(state, {
    mode: 'edit',
    editing: { season: round.season, number: round.number },
    season: round.season,
    number: round.number,
    theGuy: round.theGuy,
    message: null,
    slots: picks.map((pick) => {
      const event = events.find((e) => e.id === pick.eventId);
      return newSlot({ ...pick, date: event ? localDate(event.kickoff) : nextSaturday(), fixtures: event ? [event] : null });
    }),
  });
  render();
  state.slots.forEach(fetchFixtures);
}

/** Load a league's matches for a slot's date, keeping an already-chosen match in the list. */
async function fetchFixtures(slot) {
  const chosen = slot.fixtures?.find((f) => f.id === slot.eventId);
  slot.loading = true;
  render();

  try {
    const list = await loadFixtures(slot.league, slot.date);
    slot.fixtures = chosen && !list.some((f) => f.id === chosen.id) ? [chosen, ...list] : list;
  } catch {
    slot.fixtures = chosen ? [chosen] : [];
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
  const target = { season: state.season, number: state.number ?? '…' };
  $('subtitle').textContent = `${state.mode === 'edit' ? 'Editing' : 'Starting'} ${roundLabel(target)}`;

  const tab = (mode, label, disabled = false) => `
    <button type="button" role="tab" data-mode="${mode}" aria-selected="${state.mode === mode}" ${disabled ? 'disabled' : ''}
      class="h-11 rounded-xs font-display text-sm font-bold transition disabled:opacity-30 ${state.mode === mode ? 'grad-win text-black shadow-[0_6px_24px_-8px_rgb(16_185_129/0.8)]' : 'text-zinc-400'}">${label}</button>`;
  $('mode').innerHTML = tab('new', 'New round') + tab('edit', 'Edit a round', !state.rounds.length);

  $('round-meta').innerHTML = roundMeta();

  $('the-guy').innerHTML = personButtons({
    selected: state.theGuy,
    attrs: (name) => `data-guy="${name}"`,
    activeClass: 'grad-guy !text-black',
    activeStyle: () => '',
  });

  $('slots').innerHTML = state.slots.map(slotCard).join('');
  renderStatus();
}

function renderStatus() {
  const ready = state.slots.filter(isReady).length;
  const seasonOk = isSeason(state.season);
  const complete = state.slots.length > 0 && ready === state.slots.length && state.theGuy && seasonOk;
  $('save').disabled = !complete;

  if (state.message) {
    $('save-status').innerHTML = state.message;
  } else if (!seasonOk) {
    $('save-status').textContent = 'Season must look like 2026/27';
  } else if (!state.slots.length) {
    $('save-status').textContent = 'Add a game';
  } else if (!state.theGuy) {
    $('save-status').textContent = 'Choose The Guy';
  } else {
    $('save-status').textContent = complete ? 'Ready to save' : `${ready} of ${state.slots.length} games ready`;
  }
}

function roundMeta() {
  const picker = state.mode === 'edit' ? `
    <label class="mb-3 block">
      <span class="${LABEL}">Round to edit</span>
      <select id="round-select" class="${FIELD}">
        ${state.rounds.map((r) => `<option value="${esc(r.season)}|${r.number}" ${sameRound(r, state.editing) ? 'selected' : ''}>${esc(roundLabel(r))}</option>`).join('')}
      </select>
    </label>` : '';

  return `
    ${picker}
    <div class="grid grid-cols-2 gap-2">
      <label class="block">
        <span class="${LABEL}">Season</span>
        <input id="season" inputmode="numeric" autocomplete="off" placeholder="2026/27" value="${esc(state.season)}" class="${FIELD} ${isSeason(state.season) ? '' : 'ring-2 ring-rose-400'}" />
      </label>
      <label class="block">
        <span class="${LABEL}">Round number</span>
        <input id="number" type="number" min="1" max="999" inputmode="numeric" value="${state.number ?? ''}" class="${FIELD} tabular" />
      </label>
    </div>`;
}

function slotCard(slot, index) {
  const event = slot.fixtures?.find((f) => f.id === slot.eventId);

  let matchControl;
  if (slot.loading && !slot.fixtures?.length) {
    matchControl = '<div class="mt-2 h-12 animate-pulse rounded-xs bg-white/5"></div>';
  } else if (slot.fixtures?.length === 0) {
    matchControl = `<p class="mt-2 rounded-xs bg-white/5 px-3 py-3.5 text-sm text-zinc-500">No ${esc(leagueName(slot.league))} games on ${esc(shortDate(slot.date))}</p>`;
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
    <li class="glass relative rounded-xs p-4">
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

      <label class="mt-3 block">
        <span class="${LABEL}">Date</span>
        <input type="date" data-field="date" data-index="${index}" value="${esc(slot.date)}" class="${FIELD}" />
      </label>

      <div class="mt-3">
        <label class="block">
          <span class="${LABEL}">Find a team</span>
          <div class="relative">
            <input type="search" data-search="${index}" autocomplete="off" enterkeyhint="search" placeholder="Type a team, e.g. York"
              class="${FIELD} pl-10" />
            <svg class="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          </div>
        </label>
        <div id="suggest-${index}" role="listbox" class="mt-2 space-y-1 empty:hidden"></div>
      </div>

      <p class="mt-4 flex items-center gap-3 text-[11px] font-semibold tracking-wider text-zinc-600 uppercase">
        <span class="h-px flex-1 bg-white/10"></span>or choose by league<span class="h-px flex-1 bg-white/10"></span>
      </p>

      <label class="mt-2 block">
        <span class="${LABEL}">League</span>
        <select data-field="league" data-index="${index}" class="${FIELD}">
          ${LEAGUES.map((l) => `<option value="${l.slug}" ${l.slug === slot.league ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}
        </select>
      </label>

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

/** Teams playing on the slot's date whose name contains the query, in any supported league. */
async function suggest(index, query) {
  const box = $(`suggest-${index}`);
  const slot = state.slots[index];
  const q = query.trim().toLowerCase();

  if (q.length < MIN_QUERY) {
    box.innerHTML = '';
    return;
  }

  box.innerHTML = '<p class="px-1 text-sm text-zinc-500">Searching every league…</p>';

  let events;
  try {
    events = await fixturesForDate(slot.date);
  } catch {
    box.innerHTML = '<p class="px-1 text-sm text-rose-400">Couldn\'t load matches. Try again.</p>';
    return;
  }

  // Ignore stale results if the user kept typing or changed the date meanwhile.
  const input = document.querySelector(`[data-search="${index}"]`);
  if (!input || input.value.trim().toLowerCase() !== q) return;

  const matches = events
    .flatMap((event) => [event.home, event.away].map((team) => ({ event, team, opponent: team === event.home ? event.away : event.home })))
    .filter(({ team }) => team.name.toLowerCase().includes(q) || team.abbr?.toLowerCase() === q)
    .slice(0, MAX_SUGGESTIONS);

  box.innerHTML = matches.length
    ? matches.map(({ event, team, opponent }) => `
        <button type="button" role="option" data-suggest="${index}" data-event="${esc(event.id)}" data-team-id="${esc(team.id)}" data-league="${esc(event.league)}"
          class="flex w-full items-center gap-3 rounded-xs bg-white/5 p-2 text-left ring-1 ring-white/10 transition active:scale-[.99] hover:bg-white/10">
          ${crest(team, 'size-8')}
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold">${esc(team.name)}</span>
            <span class="block truncate text-xs text-zinc-400">v ${esc(opponent.name)} · ${esc(leagueName(event.league))} · ${esc(kickoffTime(event.kickoff))}</span>
          </span>
        </button>`).join('')
    : `<p class="px-1 text-sm text-zinc-500">No team matching “${esc(query.trim())}” on ${esc(shortDate(slot.date))}</p>`;
}

/** Picking a suggestion fills in league, match and team in one go. */
async function applySuggestion(button) {
  const slot = state.slots[Number(button.dataset.suggest)];
  const events = await fixturesForDate(slot.date);

  Object.assign(slot, {
    league: button.dataset.league,
    eventId: button.dataset.event,
    teamId: button.dataset.teamId,
    fixtures: events.filter((e) => e.league === button.dataset.league),
  });
  state.message = null;
  render();
}

$('mode').addEventListener('click', (e) => {
  const tab = e.target.closest('[data-mode]');
  if (!tab || tab.disabled || tab.dataset.mode === state.mode) return;

  if (tab.dataset.mode === 'new') startNew();
  else startEdit(state.rounds[0]);
});

$('round-meta').addEventListener('change', async (e) => {
  if (e.target.id === 'round-select') {
    const [season, number] = e.target.value.split('|');
    startEdit({ season, number: Number(number) });
    return;
  }

  if (e.target.id === 'season') {
    state.season = e.target.value.trim();
    // A new round in a different season starts from that season's next free number.
    if (state.mode === 'new' && isSeason(state.season)) {
      state.number = await loadNextNumber(state.season);
    }
  }

  if (e.target.id === 'number') {
    state.number = e.target.value ? Number(e.target.value) : null;
  }

  state.message = null;
  render();
});

$('the-guy').addEventListener('click', (e) => {
  const button = e.target.closest('[data-guy]');
  if (button) {
    state.theGuy = button.dataset.guy;
    state.message = null;
    render();
  }
});

$('slots').addEventListener('input', (e) => {
  if (e.target.dataset.search !== undefined) {
    suggest(Number(e.target.dataset.search), e.target.value);
  }
});

$('slots').addEventListener('change', (e) => {
  const { field, index } = e.target.dataset;
  if (!field) return;

  const slot = state.slots[Number(index)];
  slot[field] = e.target.value || null;
  state.message = null;

  if (field === 'eventId') {
    slot.teamId = null;
    render();
  } else {
    Object.assign(slot, { eventId: null, teamId: null, fixtures: null });
    fetchFixtures(slot);
  }
});

$('slots').addEventListener('click', (e) => {
  const suggestion = e.target.closest('[data-suggest]');
  const team = e.target.closest('[data-team]');
  const remove = e.target.closest('[data-remove]');
  const person = e.target.closest('[data-picker]');

  if (suggestion) {
    applySuggestion(suggestion);
    return;
  }

  if (person) {
    state.slots[Number(person.dataset.index)].picker = person.dataset.picker;
  } else if (team) {
    state.slots[Number(team.dataset.index)].teamId = team.dataset.team;
  } else if (remove) {
    state.slots.splice(Number(remove.dataset.remove), 1);
  } else {
    return;
  }

  state.message = null;
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
    season: state.season,
    number: state.number,
    theGuy: state.theGuy,
    picks: state.slots.map(({ picker, league, date, eventId, teamId }) => ({ picker, league, date, eventId, teamId })),
  };

  try {
    const saved = state.mode === 'edit'
      ? await updateRound(state.editing, payload, $('password').value)
      : await createRound(payload, $('password').value);

    // From now on this form is bound to the saved round: saving again updates it rather than creating another.
    Object.assign(state, {
      mode: 'edit',
      editing: saved,
      season: saved.season,
      number: saved.number,
      message: `<span class="font-semibold text-emerald-400">${esc(roundLabel(saved))} saved ✓ Everyone can see it now</span>`,
    });
    state.rounds = await loadRounds();
  } catch (error) {
    state.message = `<span class="font-semibold text-rose-400">${esc(error.message)}</span>`;
  }

  render();
});

// Default to editing an unfinished latest round, otherwise start the next one.
state.rounds = await loadRounds();
const latest = state.rounds[0];
if (latest?.status === 'open') {
  await startEdit(latest);
} else {
  await startNew();
}
