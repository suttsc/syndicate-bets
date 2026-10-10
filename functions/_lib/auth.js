import { HttpError } from './http.js';

const encoder = new TextEncoder();
const sha256 = (value) => crypto.subtle.digest('SHA-256', encoder.encode(value));

/**
 * Require `Authorization: Bearer <ADMIN_PASSWORD>`.
 * Both sides are hashed first so the constant-time compare always sees equal lengths.
 */
export async function requireAdmin(request, env) {
  if (!env.ADMIN_PASSWORD) {
    throw new HttpError(500, 'ADMIN_PASSWORD is not configured');
  }

  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const [a, b] = await Promise.all([sha256(supplied), sha256(env.ADMIN_PASSWORD)]);

  if (!crypto.subtle.timingSafeEqual(a, b)) {
    throw new HttpError(401, 'Wrong password');
  }
}
