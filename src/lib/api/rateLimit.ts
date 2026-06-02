import "server-only";
import { NextRequest, NextResponse } from "next/server";

/**
 * In-memory sliding-window rate limiter (audit Tier 2 #12).
 *
 * Sufficient for single-instance deployments. For horizontally-scaled
 * deployments, swap this for a Redis-backed implementation.
 *
 * Usage in an AI route handler:
 *   const limited = rateLimit(req, { id: 'ai-briefing', windowMs: 60_000, max: 10 });
 *   if (limited) return limited;
 */

const buckets = new Map<string, number[]>();

/** Garbage-collect old buckets occasionally so memory doesn't grow unbounded. */
let lastGc = Date.now();
function maybeGc(now: number) {
  if (now - lastGc < 60_000) return;
  lastGc = now;
  for (const [k, arr] of buckets) {
    const fresh = arr.filter((t) => now - t < 5 * 60_000);
    if (fresh.length === 0) buckets.delete(k);
    else buckets.set(k, fresh);
  }
}

function clientKey(req: NextRequest): string {
  // Prefer x-forwarded-for; fall back to a coarse session-cookie key.
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0];
    if (first) return first.trim();
  }
  return req.headers.get("user-agent")?.slice(0, 64) ?? "anon";
}

export function rateLimit(
  req: NextRequest,
  args: { id: string; windowMs: number; max: number }
): NextResponse | null {
  const now = Date.now();
  maybeGc(now);
  const key = `${args.id}:${clientKey(req)}`;
  const arr = buckets.get(key) ?? [];
  const cutoff = now - args.windowMs;
  const inWindow = arr.filter((t) => t > cutoff);
  if (inWindow.length >= args.max) {
    const earliest = inWindow[0] ?? now;
    const retryAfterSec = Math.max(
      1,
      Math.ceil((earliest + args.windowMs - now) / 1000)
    );
    return NextResponse.json(
      {
        error: `Rate limit exceeded for ${args.id}. Try again in ${retryAfterSec}s.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSec) },
      }
    );
  }
  inWindow.push(now);
  buckets.set(key, inWindow);
  return null;
}
