import { requireAdmin } from '../lib/auth.js';
import { HttpError, json, readJson } from '../lib/http.js';
import { createRound, getRound, listRounds, updateRound } from '../lib/rounds.js';
import { validateRound } from '../lib/validate.js';

function parseNumber(param) {
  if (param === 'latest') return 'latest';
  if (/^\d{1,6}$/.test(param)) return Number(param);
  throw new HttpError(404, 'Round not found');
}

// GET /api/rounds — history list
export async function list({ env }) {
  return json(await listRounds(env.DB));
}

// POST /api/rounds — start a new round (admin)
export async function create({ request, env }) {
  await requireAdmin(request, env);
  const round = validateRound(await readJson(request));
  return json(await createRound(env, round), { status: 201 });
}

// GET /api/rounds/:number (or "latest") — round with live scores
export async function show({ env, params }) {
  const data = await getRound(env, parseNumber(params.number));

  if (!data) {
    // "latest" with no rounds yet is a normal empty state, not an error.
    if (params.number === 'latest') return json(null);
    throw new HttpError(404, 'Round not found');
  }

  // A finished round fetched by number is frozen, so browsers may reuse it briefly.
  // Never cache "latest": a new round must show up straight away.
  const frozen = params.number !== 'latest' && data.round.status === 'complete';
  return json(data, { cache: frozen ? 'public, max-age=300' : 'no-store' });
}

// PUT /api/rounds/:number — edit a round (admin)
export async function update({ request, env, params }) {
  await requireAdmin(request, env);
  const number = parseNumber(params.number);
  if (number === 'latest') throw new HttpError(400, 'Edit a round by its number');

  const round = validateRound(await readJson(request));
  return json(await updateRound(env, number, round));
}
