import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time equality for SECRETS — webhook secrets, cron bearer tokens.
 *
 * A plain `===` / `!==` short-circuits on the first differing byte, so response
 * timing leaks how many leading bytes matched — a timing side channel against the
 * secret. Over a network the signal is largely buried in jitter (low practical
 * risk for high-entropy server-to-server secrets), but constant-time comparison
 * is the standard discipline for secret material and costs nothing. §A13: the
 * three secret-compare sites (inbound-email webhook + 2 cron routes) share this
 * one helper rather than each open-coding `!==`.
 *
 * Returns false if either side is missing or lengths differ (length is not
 * sensitive for these fixed-shape secrets). Never throws — `timingSafeEqual`
 * requires equal-length buffers, so the length guard runs first.
 */
export function constantTimeEqual(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
