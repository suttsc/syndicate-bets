// Worker entry point. Static files in /public are served by Cloudflare's asset handling;
// only /api/* requests reach this code (see run_worker_first in wrangler.toml).
import { HttpError, json } from './lib/http.js';
import { ensureSchema } from './lib/schema.js';
import * as fixtures from './routes/fixtures.js';
import * as leaderboard from './routes/leaderboard.js';
import * as rounds from './routes/rounds.js';

const ROUTES = [
  ['GET', /^\/api\/rounds$/, rounds.list],
  ['POST', /^\/api\/rounds$/, rounds.create],
  ['GET', /^\/api\/rounds\/latest$/, rounds.latest],
  ['GET', /^\/api\/rounds\/next$/, rounds.next],
  ['GET', /^\/api\/rounds\/(?<season>\d{4}-\d{2})\/(?<number>\d+)$/, rounds.show],
  ['PUT', /^\/api\/rounds\/(?<season>\d{4}-\d{2})\/(?<number>\d+)$/, rounds.update],
  ['GET', /^\/api\/fixtures$/, fixtures.list],
  ['GET', /^\/api\/leaderboard$/, leaderboard.show],
];

function route(request) {
  const { pathname } = new URL(request.url);
  const matches = ROUTES.filter(([, pattern]) => pattern.test(pathname));

  if (!matches.length) {
    throw new HttpError(404, 'Not found');
  }

  const match = matches.find(([method]) => method === request.method);
  if (!match) {
    throw new HttpError(405, 'Method not allowed');
  }

  const [, pattern, handler] = match;
  return { handler, params: pattern.exec(pathname).groups ?? {} };
}

export default {
  async fetch(request, env, ctx) {
    if (!new URL(request.url).pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    try {
      const { handler, params } = route(request);
      await ensureSchema(env.DB);
      return await handler({ request, env, ctx, params });
    } catch (error) {
      if (error instanceof HttpError) {
        return json({ error: error.message }, { status: error.status });
      }

      // Message first so it shows as the log line's text in Cloudflare's dashboard.
      console.error(`Unhandled error: ${error?.message}`, error?.stack);
      return json({ error: 'Something went wrong' }, { status: 500 });
    }
  },
};
