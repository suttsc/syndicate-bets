// Make sure the database tables exist before handling API requests, so the site works
// even if the deploy never ran the migration. The schema file is the same one in /migrations,
// bundled as text (see [[rules]] in wrangler.toml); every statement is idempotent.
import schema from '../../../migrations/0001_initial_schema.sql';
import { splitStatements } from './sql.js';

const STATEMENTS = splitStatements(schema);

let ready = null;

/** Runs once per Worker instance; a failure is retried on the next request. */
export function ensureSchema(db) {
  ready ??= db.batch(STATEMENTS.map((sql) => db.prepare(sql))).catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}
