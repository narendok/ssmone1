import { timingSafeEqual } from "crypto";

/**
 * Extract a cron secret from request headers. Accepts either:
 *  - `x-cron-secret: <secret>`
 *  - `authorization: Bearer <secret>`
 */
export function extractCronSecret(headers: Headers): string {
  const direct = headers.get("x-cron-secret");
  if (direct) return direct;
  const auth = headers.get("authorization");
  if (auth) return auth.replace(/^Bearer\s+/i, "");
  return "";
}

/**
 * Timing-safe comparison of a provided secret against the expected value.
 * Returns false if either value is empty or lengths differ.
 */
export function verifyCronSecret(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isAuthorizedCronRequest(headers: Headers, expected: string): boolean {
  return verifyCronSecret(extractCronSecret(headers), expected);
}
