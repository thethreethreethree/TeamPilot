import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { requireEntitledExtensionUser } from "@/lib/api/extensionAuth";
import type { ExtensionUser } from "@/lib/api/extensionAuth";

/**
 * Shared request guard for the C.A.R.E extension tool endpoints (summarize/dissect/coach/copilot/formulate/spawn).
 *
 * Every one of those routes ran the SAME security-critical sequence inline: a coarse per-IP pre-auth flood guard
 * (before the token round-trip), then the Bearer + entitlement gate, then a per-USER rate limit, then body
 * validation. Six copies drift — that's how the Co-Pilot empty-reply divergence crept in. Centralizing it here
 * means ONE correct gate ORDER (the property the route tests assert: an unentitled / rate-limited caller is
 * turned away BEFORE any paid LLM compute) and a single place to change limits.
 *
 * Returns the resolved user + validated body on success, or the NextResponse the route should return as-is.
 * The order is load-bearing — do not reorder without updating the gate-ordering tests.
 */
// Overloads: with a schema → the JSON body is validated and returned typed. WITHOUT a schema → the guard runs
// the SAME auth + rate-limit sequence but does NOT read the body, so a multipart/file route (e.g. /extract) can
// reuse the one canonical gate order and then read `req.formData()` itself. Reusing this here — rather than
// re-inlining the sequence in the multipart route — is the whole point of the guard (the comment above: six
// copies drift).
export async function guardExtensionRequest<T>(
  req: NextRequest,
  opts: { tool: string; perUserMax: number; schema: z.ZodType<T>; productLabel?: string }
): Promise<{ ok: true; user: ExtensionUser; body: T } | { ok: false; response: NextResponse }>;
export async function guardExtensionRequest(
  req: NextRequest,
  opts: { tool: string; perUserMax: number; schema?: undefined; productLabel?: string }
): Promise<{ ok: true; user: ExtensionUser; body: null } | { ok: false; response: NextResponse }>;
export async function guardExtensionRequest<T>(
  req: NextRequest,
  opts: { tool: string; perUserMax: number; schema?: z.ZodType<T>; productLabel?: string }
): Promise<{ ok: true; user: ExtensionUser; body: T | null } | { ok: false; response: NextResponse }> {
  // 1. Coarse per-IP guard BEFORE auth — protects the token-validation round-trip from unauthenticated floods.
  const preAuth = rateLimit(req, { id: "care-ext", windowMs: 60_000, max: 60 });
  if (preAuth) return { ok: false, response: preAuth };

  // 2. Bearer token + pro/enterprise-or-trial entitlement (server-enforced; never trust the client). The
  // optional productLabel names the surface in the 402 message (Sales Coach routes pass their own; C.A.R.E
  // routes omit it and keep the default).
  const gate = await requireEntitledExtensionUser(req, { productLabel: opts.productLabel });
  if (!gate.ok) return { ok: false, response: gate.response };

  // 3. Per-USER limit (so colleagues on one office IP don't share a bucket on a paid feature).
  const limited = rateLimit(req, {
    id: `care-ext-${opts.tool}:${gate.user.userId}`,
    windowMs: 60_000,
    max: opts.perUserMax,
  });
  if (limited) return { ok: false, response: limited };

  // 4. Validate the body against the route's strict schema — ONLY when a schema was given. A multipart route
  // passes no schema and reads req.formData() after this returns (readBody would consume the body first).
  if (!opts.schema) return { ok: true, user: gate.user, body: null };
  const body = await readBody(req, opts.schema);
  if (body instanceof NextResponse) return { ok: false, response: body };

  return { ok: true, user: gate.user, body };
}
