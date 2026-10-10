import { HttpError, json } from '../_lib/http.js';

// Turn thrown errors into JSON responses for every /api route.
export async function onRequest({ next }) {
  try {
    return await next();
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ error: error.message }, { status: error.status });
    }

    console.error(error);
    return json({ error: 'Something went wrong' }, { status: 500 });
  }
}
