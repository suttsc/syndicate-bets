import { isSeason, seasonFromSlug } from '../../../public/js/season.js';
import { requireAdmin } from '../lib/auth.js';
import { HttpError, json, readJson } from '../lib/http.js';
import { createRound, getRound, listRounds, nextNumber, updateRound } from '../lib/rounds.js';
import { isRoundNumber, validateRound } from '../lib/validate.js';

/** "2026-27" + "9" from the URL → { season: "2026/27", number: 9 } */
function parseKey(params) {
  const season = seasonFromSlug(params.season ?? '');
  const number = Number(params.number);
  if (!isSeason(season) || !isRoundNumber(number)) throw new HttpError(404, 'Round not found');
  return { season, number };
}

// GET /api/rounds — history list
export async function list({ env }) {
  return json(await listRounds(env.DB));
}

// GET /api/rounds/next?season=2026-27 — the number a new round would get
export async function next({ env, request }) {
  const season = seasonFromSlug(new URL(request.url).searchParams.get('season') ?? '');
  if (!isSeason(season)) throw new HttpError(422, 'Season must look like 2026-27');
  return json({ season, number: await nextNumber(env.DB, season) });
}

// POST /api/rounds — start a new round (admin)
export async function create({ request, env }) {
  await requireAdmin(request, env);
  const round = validateRound(await readJson(request));
  return json(await createRound(env, round), { status: 201 });
}

// GET /api/rounds/latest — most recent round with live scores ("null" when there are none yet)
export async function latest({ env }) {
  return json(await getRound(env, 'latest'));
}

// GET /api/rounds/:season/:number — a round with live scores
export async function show({ env, params }) {
  const data = await getRound(env, parseKey(params));
  if (!data) throw new HttpError(404, 'Round not found');

  // A finished round is frozen, so browsers may reuse it briefly.
  return json(data, { cache: data.round.status === 'complete' ? 'public, max-age=300' : 'no-store' });
}

// PUT /api/rounds/:season/:number — edit a round, including its season / number (admin)
export async function update({ request, env, params }) {
  await requireAdmin(request, env);
  const key = parseKey(params);
  const round = validateRound(await readJson(request));
  return json(await updateRound(env, key, round));
}
