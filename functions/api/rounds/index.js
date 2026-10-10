import { requireAdmin } from '../../_lib/auth.js';
import { json, readJson } from '../../_lib/http.js';
import { createRound, listRounds } from '../../_lib/rounds.js';
import { validateRound } from '../../_lib/validate.js';

// GET /api/rounds — history list
export async function onRequestGet({ env }) {
  return json(await listRounds(env.DB));
}

// POST /api/rounds — start a new round (admin)
export async function onRequestPost({ request, env }) {
  await requireAdmin(request, env);
  const round = validateRound(await readJson(request));
  return json(await createRound(env, round), { status: 201 });
}
